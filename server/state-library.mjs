import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import catalog from '../resources/state-library-catalog.json' with {type:'json'};
import {ARTICLE_ID_PATTERN,articleCanonical} from './article-id.mjs';
const CORPUS_SHA='448e7f1e180e4fd56cedab1608bb7fc82dc3c6fc340a6f8e81a41f19f1fbd001';
const hash=x=>createHash('sha256').update(x).digest('hex');
const key=x=>String(x).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const articlePattern=/\b(?:articulo|art\.?)\s+(\d{1,6})(?:[oº°])?((?:(?:\s*-\s*|\s+)(?:bis|ter|quater|quinquies|[ivxlcdm]+|\d+)(?![\p{L}\p{N}])|\s*-\s*[a-zñ](?![\p{L}\p{N}])){0,4})(?![\p{L}\p{N}])/giu;
export function createStateLibrary({corpusPath=new URL('../resources/state-library.jsonl',import.meta.url)}={}){
 let articles;
 function load(){
  if(articles)return;
  if(statSync(corpusPath).size>16*1024*1024)throw Error('State library exceeds snapshot budget');
  const bytes=readFileSync(corpusPath);if(hash(bytes)!==CORPUS_SHA||catalog.corpusSha256!==CORPUS_SHA)throw Error('State library snapshot integrity mismatch');
  const next=new Map(),counts=new Map();
  for(const line of bytes.toString('utf8').split('\n').filter(Boolean)){
   const row=JSON.parse(line),law=catalog.laws.find(s=>s.lawId===row.lawId);
   if(!law||row.sourceUrl!==law.sourceUrl||row.pdfSha256!==law.pdfSha256||row.jurisdiction!==law.jurisdiction||row.lawTitle!==law.title||row.quality?.status!=='structurally-verified'||row.quality?.currentness!=='unverified'||row.quality.anomalies.length||row.effectiveAt!==null||hash(row.text)!==row.textSha256||row.split!==law.split||!row.sourcePages.length||!row.sourcePages.every(p=>Number.isInteger(p)&&p>0&&p<=law.pages))throw Error('Invalid state library provenance');
   const id=row.lawId+':'+articleCanonical(row.articleId);if(next.has(id))throw Error('Duplicate state article');
   next.set(id,{id:`STATE-${row.lawId}-${row.articleId}`,originalId:row.id,title:row.lawTitle,law:row.lawId,lawId:row.lawId,article:row.articleId,url:row.sourceUrl,jurisdiction:row.jurisdiction,text:row.text,retrievedAt:row.retrievedAt,version:row.versionId,pages:row.sourcePages,status:'structurally-verified-currentness-unverified',authority:row.publisher,category:'official-public-legislation',pdfSha256:row.pdfSha256,textSha256:row.textSha256,amendedAt:row.declaredAmendedAt,effectiveAt:null,coverage:'partial-audited-articles-only',corpusSha256:CORPUS_SHA});
   counts.set(row.lawId,(counts.get(row.lawId)||0)+1);
  }
  if(next.size!==catalog.articles||catalog.laws.some(law=>counts.get(law.lawId)!==law.acceptedArticles))throw Error('State library coverage mismatch');articles=next;
 }
 return {
  status(){return {available:true,exactOnly:true,currentness:'unverified',laws:catalog.laws.map(s=>({id:s.lawId,title:s.title,jurisdiction:s.jurisdiction,articles:s.acceptedArticles})),corpusSha256:CORPUS_SHA};},
  reference(query){
   const q=' '+key(query)+' ',laws=catalog.laws.filter(law=>q.includes(' '+key(law.title)+' '));
   if(!laws.length)return null;
   const articles=[...String(query).normalize('NFD').replace(/\p{M}/gu,'').matchAll(articlePattern)];
   if(!articles.length)return null;
   if(laws.length!==1||articles.length!==1||q.includes(' jalisco ')&&q.includes(' nuevo leon ')||/\b(?:codigo civil federal|codigo penal federal|cpeum|ccf)\b/.test(q))return {unavailable:true};
   const match=articles[0],articleId=[match[1],...(match[2].match(/bis|ter|quater|quinquies|[ivxlcdm]+|[a-zñ]|\d+/gi)||[])].map(x=>x.toUpperCase()).join('-');
   return {lawId:laws[0].lawId,jurisdiction:laws[0].jurisdiction,articleId,state:true};
  },
  lookupArticle({lawId,articleId}={}){
   if(!catalog.laws.some(law=>law.lawId===lawId)||typeof articleId!=='string'||!ARTICLE_ID_PATTERN.test(articleId))return null;
   load();const source=articles.get(lawId+':'+articleCanonical(articleId));return source?structuredClone(source):null;
  }
 };
}
