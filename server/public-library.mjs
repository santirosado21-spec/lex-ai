import {DatabaseSync} from 'node:sqlite';
import {createReadStream} from 'node:fs';
import {readFile,writeFile,mkdir,rename,unlink,stat,open} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {createInterface} from 'node:readline';
import path from 'node:path';
import {ARTICLE_ID_PATTERN,articleCanonical} from './article-id.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const SHA=/^[a-f0-9]{64}$/;
const STATUS='structurally-verified-currentness-unverified';
async function fileHash(file){const h=createHash('sha256');for await(const bytes of createReadStream(file))h.update(bytes);return h.digest('hex');}
function string(value,name,max){if(typeof value!=='string'||!value.trim()||value.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value))throw new Error(`Invalid ${name}`);return value;}
export function publicSource(row){
  if(!row||typeof row!=='object'||Array.isArray(row))throw new Error('Invalid public article');
  if(['matterId','matter_id','firmId','workspaceId','documentId','client'].some(k=>k in row))throw new Error('Private record fields are forbidden in public library');
  const lawId=string(row.lawId,'lawId',100);if(!/^MX-FED-[A-Z0-9_-]+$/.test(lawId)||row.jurisdiction!=='MX-FED')throw new Error('Unsupported public jurisdiction or law');
  const article=string(row.articleId,'articleId',80),version=string(row.versionId,'versionId',200),originalId=string(row.id,'id',300);
  if(!ARTICLE_ID_PATTERN.test(article))throw new Error('Invalid public article reference');
  const text=string(row.text,'text',60000);if(text.length<60||!SHA.test(row.textSha256)||hash(text)!==row.textSha256||!SHA.test(row.pdfSha256))throw new Error('Public article text/hash mismatch');
  if(row.quality?.status!=='structurally-verified'||row.quality?.currentness!=='unverified'||row.effectiveAt!==null)throw new Error('Public article lacks accepted structural quality metadata');
  if(!version.startsWith(lawId+'@')||originalId!==`${version}:art:${article}`||!version.endsWith('+'+row.pdfSha256.slice(0,16)))throw new Error('Public article identity mismatch');
  const url=new URL(string(row.sourceUrl,'sourceUrl',1000));if(url.protocol!=='https:'||url.hostname!=='www.diputados.gob.mx'||url.port||url.username||url.password||url.search||url.hash||!/^\/LeyesBiblio\/pdf\/[A-Za-z0-9_-]+\.pdf$/.test(url.pathname))throw new Error('Public source URL not allowed');
  if(!Array.isArray(row.sourcePages)||!row.sourcePages.length||row.sourcePages.length>1200||!row.sourcePages.every(p=>Number.isInteger(p)&&p>=1&&p<=1200))throw new Error('Invalid source pages');
  if(!['train','validation','test'].includes(row.split)||row.splitGroup!==lawId)throw new Error('Invalid law partition');
  const retrievedAt=string(row.retrievedAt,'retrievedAt',40);if(!Number.isFinite(Date.parse(retrievedAt)))throw new Error('Invalid retrieval date');
  const title=string(row.lawTitle,'title',1000),authority=string(row.publisher,'publisher',300);
  return {id:'PUB-'+hash(originalId),sourceId:'PUB-'+hash(originalId),originalId,title,law:lawId,lawId,article,articleCanonical:articleCanonical(article),url:url.href,jurisdiction:row.jurisdiction,text,retrievedAt,version,pages:[...new Set(row.sourcePages)],status:STATUS,authority,category:'official-public-legislation',pdfSha256:row.pdfSha256,textSha256:row.textSha256,amendedAt:row.declaredAmendedAt??null,effectiveAt:null,split:row.split};
}

export async function buildPublicLibrary({inputDir,outputFile,maxBytes=256*1024*1024}={}){
  const corpusFile=path.join(inputDir,'corpus.jsonl');const inputStat=await stat(corpusFile);if(inputStat.size>maxBytes)throw new Error('Public corpus exceeds byte limit');
  const hashes=JSON.parse(await readFile(path.join(inputDir,'sha256.json'),'utf8'));const audit=JSON.parse(await readFile(path.join(inputDir,'independent-extraction-audit.json'),'utf8'));
  const corpusSha256=await fileHash(corpusFile);if(hashes['corpus.jsonl']!==corpusSha256||audit.corpusSha256!==corpusSha256||!Number.isInteger(audit.checked)||audit.checked<1||audit.checked!==audit.passed)throw new Error('Snapshot hash or independent sample audit missing/mismatch');
  await mkdir(path.dirname(outputFile),{recursive:true});const lock=await open(outputFile+'.lock','wx',0o600);await lock.close();
  const temporary=outputFile+'.'+randomUUID()+'.tmp';let db;
  try{
    db=new DatabaseSync(temporary);db.exec(`PRAGMA journal_mode=DELETE; PRAGMA cache_size=-16384; PRAGMA temp_store=FILE; PRAGMA application_id=1279613016; PRAGMA user_version=1;
      CREATE TABLE metadata (key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE articles (id TEXT PRIMARY KEY,law_id TEXT NOT NULL,jurisdiction TEXT NOT NULL,payload TEXT NOT NULL);
      CREATE INDEX by_law ON articles(law_id);
      CREATE VIRTUAL TABLE articles_fts USING fts5(id UNINDEXED,title,article,text,tokenize='unicode61 remove_diacritics 2'); BEGIN IMMEDIATE;`);
    const put=db.prepare('INSERT INTO articles VALUES(?,?,?,?)'),fts=db.prepare('INSERT INTO articles_fts(id,title,article,text) VALUES(?,?,?,?)');
    const laws=new Map();let count=0,bytesSeen=0;
    const lines=createInterface({input:createReadStream(corpusFile),crlfDelay:Infinity});
    try{for await(const line of lines){bytesSeen+=Buffer.byteLength(line)+1;if(bytesSeen>maxBytes||line.length>512000)throw new Error('Public corpus stream/line limit exceeded');if(!line.trim())continue;if(++count>200000)throw new Error('Public article count limit exceeded');const source=publicSource(JSON.parse(line));const known=laws.get(source.lawId);if(known&&known.split!==source.split)throw new Error('Law versions cross dataset partitions');laws.set(source.lawId,{id:source.lawId,title:source.title,jurisdiction:source.jurisdiction,split:source.split,articles:(known?.articles??0)+1});put.run(source.id,source.lawId,source.jurisdiction,JSON.stringify(source));fts.run(source.id,source.title,source.article,source.text);}}finally{lines.close();}
    if(!count)throw new Error('Empty public corpus refused');if(await fileHash(corpusFile)!==corpusSha256)throw new Error('Corpus changed during index build');
    const metadata={schemaVersion:1,kind:'public-legal-library',builtAt:new Date().toISOString(),corpusSha256,articles:count,laws:[...laws.values()].sort((a,b)=>a.id.localeCompare(b.id)),audit:{checked:audit.checked,passed:audit.passed,scope:'independent sample fidelity only'},status:STATUS,privateDocumentsIncluded:false};
    db.prepare('INSERT INTO metadata VALUES(?,?)').run('library',JSON.stringify(metadata));db.exec("COMMIT; INSERT INTO articles_fts(articles_fts) VALUES('optimize');");if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Public index integrity failed');db.close();db=null;
    const indexSha256=await fileHash(temporary);const manifest={...metadata,indexSha256,bytes:(await stat(temporary)).size};const manifestTemp=temporary+'.manifest';await writeFile(manifestTemp,JSON.stringify(manifest,null,2)+'\n',{mode:0o600});await rename(temporary,outputFile);await rename(manifestTemp,outputFile+'.manifest.json');return manifest;
  }finally{try{db?.close();}catch{}await unlink(temporary).catch(()=>{});await unlink(temporary+'.manifest').catch(()=>{});await unlink(outputFile+'.lock').catch(()=>{});}
}

export function searchTokens(query){string(query,'query',300);const tokens=[...new Set(query.normalize('NFC').match(/[\p{L}\p{N}]+/gu)??[])];if(!tokens.length||tokens.length>12||tokens.some(t=>t.length>40))throw new Error('Query requires 1–12 words of at most 40 characters');return tokens.map(t=>'"'+t+'"').join(' AND ');}
export async function openPublicLibrary(file){
  const manifest=JSON.parse(await readFile(file+'.manifest.json','utf8'));if(manifest.schemaVersion!==1||manifest.kind!=='public-legal-library'||!SHA.test(manifest.indexSha256)||(await stat(file)).size>1024**3||await fileHash(file)!==manifest.indexSha256)throw new Error('Public library manifest/index integrity mismatch');
  const db=new DatabaseSync(file,{readOnly:true});
  try{
    db.exec('PRAGMA query_only=ON; PRAGMA trusted_schema=OFF; PRAGMA cache_size=-16384;');if(db.prepare('PRAGMA application_id').get().application_id!==1279613016||db.prepare('PRAGMA user_version').get().user_version!==1)throw new Error('Not a public library index');
    const metadata=JSON.parse(db.prepare("SELECT value FROM metadata WHERE key='library'").get().value);if(metadata.corpusSha256!==manifest.corpusSha256||metadata.kind!=='public-legal-library'||metadata.privateDocumentsIncluded!==false)throw new Error('Public metadata mismatch');
    return {status(){return {available:true,...metadata,indexSha256:manifest.indexSha256};},search({query,lawId,jurisdiction='MX-FED',limit=10,offset=0}={}){
      const match=searchTokens(query);if(!Number.isInteger(limit)||limit<1||limit>10||!Number.isInteger(offset)||offset<0||offset>1000)throw new Error('Invalid search page');if(jurisdiction!=='MX-FED')throw new Error('Unsupported jurisdiction');if(lawId!==undefined&&(typeof lawId!=='string'||!/^MX-FED-[A-Z0-9_-]{1,90}$/.test(lawId)))throw new Error('Invalid law filter');
      const rows=db.prepare(`SELECT a.payload,snippet(articles_fts,3,'','','…',32) AS excerpt FROM articles_fts JOIN articles a ON a.id=articles_fts.id WHERE articles_fts MATCH ? AND a.jurisdiction=? AND (? IS NULL OR a.law_id=?) ORDER BY bm25(articles_fts),a.id LIMIT ? OFFSET ?`).all(match,jurisdiction,lawId??null,lawId??null,limit+1,offset);
      return {query,corpusSha256:metadata.corpusSha256,offset,limit,hasMore:rows.length>limit,sources:rows.slice(0,limit).map(row=>{const source=JSON.parse(row.payload);return {...source,text:source.text.slice(0,12000),textLength:source.text.length,truncated:source.text.length>12000,excerpt:row.excerpt};})};
    },lookupArticle({lawId,articleId}={}){
      if(typeof lawId!=='string'||!/^MX-FED-[A-Z0-9_-]{1,90}$/.test(lawId)||typeof articleId!=='string'||articleId.length>80||!ARTICLE_ID_PATTERN.test(articleId))throw new Error('Invalid exact article reference');
      // Existing by_law index bounds the lookup to one instrument; no index mutation required.
      // Canonical comparison folds diacritics ("26-QUATER" resolves stored "26-QUÁTER").
      // COALESCE keeps indexes built before articleCanonical existed readable for unaccented ids.
      const row=db.prepare("SELECT payload FROM articles INDEXED BY by_law WHERE law_id=? AND COALESCE(json_extract(payload,'$.articleCanonical'),json_extract(payload,'$.article'))=? ORDER BY json_extract(payload,'$.retrievedAt') DESC,id LIMIT 1").get(lawId,articleCanonical(articleId));
      return row?JSON.parse(row.payload):null;
    },getSource(id){if(typeof id!=='string'||!/^PUB-[a-f0-9]{64}$/.test(id))throw new Error('Invalid public source ID');const row=db.prepare('SELECT payload FROM articles WHERE id=?').get(id);return row?JSON.parse(row.payload):null;},close(){db.close();}};
  }catch(e){db.close();throw e;}
}
