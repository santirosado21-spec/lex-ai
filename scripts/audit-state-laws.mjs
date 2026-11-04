import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';import {createHash} from 'node:crypto';import path from 'node:path';import {pathToFileURL} from 'node:url';import {execFileSync} from 'node:child_process';
import {splitForLaw} from '../server/legal-library.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const norm=s=>s.normalize('NFC').replace(/\s+/g,' ').trim();
const folded=s=>norm(s).normalize('NFD').replace(/\p{M}/gu,'').toUpperCase().replace(/[.]$/,'');
export const STATE_ARTICLE=/^(?:ART[ÍI]CULO|Art[íi]culo|Art\.|ART\.)\s*(\d+)(?:[oº°])?((?:(?:\s*[.\-–]\s*|\s+)(?:BIS|TER|QU[ÁA]TER|QUATER|QUINQUIES|[IVXLCDM]+|[A-ZÑ]|\d+)(?![\p{L}\p{N}]))*)\s*[.\-–:]+/iu;
const transitory=/^(?:(?:ART[ÍI]CULOS?|Art[íi]culos?)\s+)?TRANSITORIOS?\s*[.:]?$/i;
const section=/^(?:LIBRO|T[IÍ]TULO|CAP[IÍ]TULO|SECCI[ÓO]N|SUBSECCI[ÓO]N)\s+(?:[IVXLCDM]+|\d+|PRIMER[OA]|SEGUND[OA]|TERCER[OA]?|CUART[OA]|QUINT[OA]|SEXT[OA]|S[ÉE]PTIM[OA]|OCTAV[OA]|NOVEN[OA]|D[ÉE]CIM[OA]|[ÚU]NIC[OA])\b/i;
const editorial=/^(?:\(?\s*(?:REFORMAD[OA]|ADICIONAD[OA]|DEROGAD[OA]|REUBICAD[OA]|RECORRID[OA])\b|(?:Art[íi]culo|Fracci[oó]n|P[aá]rrafo)\s+(?:reformad[oa]|adicionad[oa]|derogad[oa])\b|FE DE ERRATAS\b|\(?\s*(?:PUBLICAD[OA]|N\.?\s*DE\s*E\.?|NOTA\s+DE\s+EDITOR)\b)/i;
function header(line,title){return folded(line)===folded(title)||/^(?:H\.?\s*CONGRESO|CONGRESO DEL ESTADO|CONGRESO DE LA CIUDAD|SECRETAR[IÍ]A GENERAL|SECRETAR[IÍ]A DE SERVICIOS|DIRECCI[ÓO]N (?:DE|GENERAL)|[ÚU]LTIMA REFORMA PUBLICADA|P[ÁA]GINA\s+\d+|\d+\s*(?:DE|\/)\s*\d+\s*$)/i.test(line)||/^\d{1,4}$/.test(line);}
export function extractStateArticles(pages,source,metadata){
 const rows=[],docAnomalies=[],seen=new Set();let current=null,ended=false,skipSection=false;const removals=[];
 const recordRemoval=(line,page,reason)=>{removals.push({text:line,page,reason});if(current)current.editorialNotes.push(line);};
 function finish(){if(!current)return;const text=norm(current.lines.map(l=>l.text).join(' ')),anomalies=[...(current.anomalies||[])];
  if(/declarad[oa]s?\s+inv[aá]lid[oa]|acci[oó]n\s+de\s+inconstitucionalidad|porci[oó]n\s+normativa\s+entrecomillada/i.test(text))anomalies.push('invalidity-annotation-requires-review');if(text.length<60)anomalies.push('too-short');if(text.length>60000)anomalies.push('too-long');if(/\uFFFD/.test(text))anomalies.push('replacement-character');if(/\b(?:DEROGADO|SE DEROGA)\b/i.test(text)&&text.length<180)anomalies.push('repealed-marker');
  const versionDate=metadata.declaredAmendedAt??metadata.retrievedAt.slice(0,10),versionId=`${source.lawId}@${versionDate}+${metadata.sha256.slice(0,16)}`;
  rows.push({id:`${versionId}:art:${current.articleId}`,lawId:source.lawId,lawTitle:source.title,versionId,versionDate,articleId:current.articleId,text,sourceUrl:source.url,publisher:source.authority,publisherIndex:source.publisherIndex,indexSha256:source.indexSha256,jurisdiction:source.jurisdiction,practiceAreas:source.practiceAreas,language:'es',pdfSha256:metadata.sha256,textSha256:sha(text),contentSha256:sha(norm(text.replace(STATE_ARTICLE,''))),sourcePages:[...new Set(current.lines.map(l=>l.page))],declaredAmendedAt:metadata.declaredAmendedAt??null,effectiveAt:null,retrievedAt:metadata.retrievedAt,split:source.split??splitForLaw(source.lawId),splitGroup:source.lawId,quality:{status:anomalies.length?'quarantined':'structurally-verified',anomalies,legalAccuracy:'not-evaluated',currentness:'unverified',extraction:'deterministic-pdfjs-with-independent-poppler-checks'},rights:source.reuseBasis,editorialNotes:current.editorialNotes});current=null;
 }
 outer:for(const page of pages)for(const raw of page.text.split('\n')){
  const line=norm(raw);if(!line)continue;
  if(header(line,source.title)){recordRemoval(line,page.number,'running-header-or-footer');continue;}
  if(current&&(transitory.test(line)||/^(?:ARTICULOS?)?TRANSITORIOS?[.:]?$/.test(folded(line).replace(/\s+/g,'')))){finish();ended=true;break outer;}
  const match=/^(?:ART[ÍI]CULO|Art[íi]culo|Art\.|ART\.)/.test(line)?STATE_ARTICLE.exec(line):null;
  if(match&&!line.slice(match[0].length).trim()){if(current){current.anomalies??=[];current.anomalies.push('bare-article-label-needs-review');current.lines.push({text:line,page:page.number});}continue;}
  if(match){finish();skipSection=false;const suffixes=match[2]?.match(/BIS|TER|QU[ÁA]TER|QUATER|QUINQUIES|[IVXLCDM]+|[A-ZÑ]|\d+/gi)||[];const articleId=[match[1],...suffixes.map(x=>x.toUpperCase())].join('-');
   if(seen.has(articleId)){docAnomalies.push('operative-numbering-restarts-before-transitory-boundary');ended=true;break outer;}seen.add(articleId);current={articleId,lines:[{text:line,page:page.number}],editorialNotes:[]};continue;
  }
  if(!current)continue;
  if(editorial.test(line)){recordRemoval(line,page.number,'publisher-editorial-annotation');continue;}
  if(section.test(line)){skipSection=true;recordRemoval(line,page.number,'section-heading');continue;}
  if(skipSection){recordRemoval(line,page.number,'section-heading-continuation');continue;}
  current.lines.push({text:line,page:page.number});
 }
 if(!ended){finish();docAnomalies.push('no-explicit-transitory-boundary');}
 if(rows[0]?.articleId!=='1')docAnomalies.push('operative-body-start-not-established');
 if(!rows.length)docAnomalies.push('no-article-headings');
 if(docAnomalies.length)for(const row of rows){row.quality.status='quarantined';row.quality.anomalies.push(...docAnomalies);}
 return {schemaVersion:1,extractorVersion:'state-v1',lawId:source.lawId,pdfSha256:metadata.sha256,sourceUrl:source.url,pages:pages.length,documentAnomalies:docAnomalies,stoppedAtExplicitBoundary:ended&&!docAnomalies.length,removedLines:removals,records:rows};
}
function declaredDate(text){
 const marker=/[ÚU]LTIMA\s+REFORMA/i.exec(text);if(!marker)return null;const nearby=norm(text.slice(marker.index,marker.index+350));let match=/(\d{2})[-/](\d{2})[-/](\d{4})/.exec(nearby);if(match)return `${match[3]}-${match[2]}-${match[1]}`;
 match=/(\d{1,2})\s+DE\s+(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\s+DE\s+(\d{4})/i.exec(nearby);if(!match)return null;const months=['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];return `${match[3]}-${String(months.indexOf(match[2].toUpperCase())+1).padStart(2,'0')}-${match[1].padStart(2,'0')}`;
}
export function independentCheck(row,pageText,removals=[]){
 let independent=pageText;for(const item of removals.filter(x=>row.sourcePages.includes(x.page)).sort((a,b)=>b.text.length-a.text.length))independent=independent.replaceAll(norm(item.text),' ');independent=norm(independent);
 const text=norm(row.text),width=Math.min(120,text.length),head=text.slice(0,width),tail=text.slice(-width),middle=text.slice(Math.max(0,Math.floor((text.length-width)/2)),Math.max(0,Math.floor((text.length-width)/2))+width);
 return {id:row.id,sourcePages:row.sourcePages,headPresent:independent.includes(head),middlePresent:independent.includes(middle),tailPresent:independent.includes(tail),fullBodyPresent:independent.includes(text),textSha256:row.textSha256};
}
export async function auditAndFreeze({root=path.resolve('artifacts/legal-library/state-expansion-2026-11-02'),freeze=false}={}){
 const catalog=JSON.parse(await readFile(path.join(root,'catalog.json'),'utf8')),acquisitions=JSON.parse(await readFile(path.join(root,'acquisitions.json'),'utf8'));
 await mkdir(path.join(root,'extractions'),{recursive:true});const {default:pdf}=await import('pdf-parse/lib/pdf-parse.js');const candidates=[],checks=[],sourceReports=[],excluded=[];
 for(const item of acquisitions){const source=catalog.sources.find(s=>s.id===item.id);if(!source||item.error){sourceReports.push({lawId:item.lawId,error:item.error||'source-not-in-catalog'});continue;}
  try{
   const file=path.join(root,item.file),bytes=await readFile(file);if(sha(bytes)!==item.sha256)throw Error('Source hash mismatch');if(bytes.length>25*1024*1024)throw Error('PDF exceeds budget');const pages=[];
   const parsed=await pdf(new Uint8Array(bytes),{max:1200,pagerender:async p=>{const content=await p.getTextContent({normalizeWhitespace:false,disableCombineTextItems:false});let text='',lastY;for(const x of content.items){text+=(lastY===undefined||lastY===x.transform[5]?'':'\n')+x.str;lastY=x.transform[5];}pages.push({number:p.pageNumber,text});return text;}});
   pages.sort((a,b)=>a.number-b.number);if(pages.length!==parsed.numpages||parsed.numpages>1200)throw Error('Incomplete page coverage');
   const result=extractStateArticles(pages,source,{...item,declaredAmendedAt:declaredDate(pages.slice(0,2).map(p=>p.text).join('\n'))});await writeFile(path.join(root,'extractions',source.id+'.json'),JSON.stringify(result,null,2)+'\n');
   const poppler=execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8',maxBuffer:32*1024*1024}).split('\f');
   for(const row of result.records){const independent=norm(row.sourcePages.map(n=>poppler[n-1]??'').join(' ')),check=independentCheck(row,independent,result.removedLines);checks.push(check);
    if(row.quality.status==='structurally-verified'&&check.headPresent&&check.middlePresent&&check.tailPresent&&check.fullBodyPresent)candidates.push(row);else excluded.push({id:row.id,lawId:row.lawId,reasons:[...row.quality.anomalies,...(!check.fullBodyPresent?['independent-full-body-fidelity-failure']:[])],pdfSha256:row.pdfSha256,sourcePages:row.sourcePages});
   }
   sourceReports.push({lawId:source.lawId,sourceUrl:source.url,jurisdiction:source.jurisdiction,practiceAreas:source.practiceAreas,split:source.split,pdfSha256:item.sha256,bytes:item.bytes,pages:pages.length,candidates:result.records.length,documentAnomalies:result.documentAnomalies,acceptedBeforeDedup:candidates.filter(r=>r.lawId===source.lawId).length,declaredAmendedAt:result.records[0]?.declaredAmendedAt??null});
  }catch(e){sourceReports.push({lawId:source.lawId,error:e.message});}
  console.log(JSON.stringify(sourceReports.at(-1)));
 }
 const canonicalBody=text=>sha(norm(text.replace(STATE_ARTICLE,'')));
 const basePath=path.resolve('artifacts/legal-library/exports-v2/corpus.jsonl'),baseBytes=await readFile(basePath),baseRows=baseBytes.toString('utf8').split('\n').filter(Boolean).map(JSON.parse),baseBodies=new Set(baseRows.map(r=>canonicalBody(r.text)));
 const groups=new Map();for(const row of candidates){const key=canonicalBody(row.text),group=groups.get(key)||[];group.push(row);groups.set(key,group);}const accepted=[];
 for(const [key,rows]of groups){if(baseBodies.has(key)){excluded.push(...rows.map(r=>({id:r.id,lawId:r.lawId,reasons:['duplicate-content-existing-frozen-corpus']})));continue;}if(new Set(rows.map(r=>r.split)).size>1){excluded.push(...rows.map(r=>({id:r.id,lawId:r.lawId,reasons:['exact-content-duplicate-across-new-splits']})));continue;}accepted.push(rows[0]);excluded.push(...rows.slice(1).map(r=>({id:r.id,lawId:r.lawId,reasons:['exact-content-duplicate-within-new-split']})));}
 accepted.sort((a,b)=>a.id.localeCompare(b.id));const selectedIds=new Set(accepted.map(r=>r.id)),acceptedChecks=checks.filter(c=>selectedIds.has(c.id));
 const audit={schemaVersion:1,method:'Every accepted article full normalized body plus head/middle/tail independently found in recorded source pages extracted by Poppler pdftotext; PDF.js is the primary extractor. Only NFC/whitespace normalization and explicitly recorded publisher/layout-line removal. Structural fidelity only, not legal/currentness/completeness validation.',checked:acceptedChecks.length,passed:acceptedChecks.filter(c=>c.fullBodyPresent&&c.headPresent&&c.middlePresent&&c.tailPresent).length,checks:acceptedChecks};
 const summary={schemaVersion:1,releaseStatus:freeze?'FROZEN':'CANDIDATE',createdAt:new Date().toISOString(),laws:new Set(accepted.map(r=>r.lawId)).size,articles:accepted.length,sources:sourceReports.map(s=>({...s,acceptedArticles:accepted.filter(r=>r.lawId===s.lawId).length})),excluded:excluded.length,partitionRule:catalog.partitionRule,baseCorpusSha256:sha(baseBytes),baseCorpusUnmodified:true,splits:Object.fromEntries(['train','validation','test'].map(s=>[s,{laws:new Set(accepted.filter(r=>r.split===s).map(r=>r.lawId)).size,articles:accepted.filter(r=>r.split===s).length}])),scope:'Bounded Jalisco/Nuevo León official-codes expansion; CDMX acquisition deferred for invalid certificate on robots redirect; not all32states/practices/currentness verified.'};
 await writeFile(path.join(root,'candidate-audit.json'),JSON.stringify({summary,checks,excluded},null,2)+'\n');
 if(freeze){if(!accepted.length||audit.passed!==audit.checked)throw Error('Nothing independently verified to freeze');const dest=path.join(root,'frozen-v1');await mkdir(dest);const hashes={};
  for(const split of ['train','validation','test','corpus']){const name=split+'.jsonl',content=accepted.filter(r=>split==='corpus'||r.split===split).map(r=>JSON.stringify(r)).join('\n')+'\n';hashes[name]=sha(content);await writeFile(path.join(dest,name),content,{flag:'wx'});}
  audit.corpusSha256=hashes['corpus.jsonl'];summary.corpusSha256=hashes['corpus.jsonl'];
  const frozenAcquisitions=acquisitions.map(item=>{const source=catalog.sources.find(s=>s.id===item.id);return {...item,acquisitionSplit:item.split,split:source?.split??item.split,partitionAuthority:'frozen catalog and corpus rows; any acquisition-time split is historical only'};});
  for(const [name,data]of [['manifest.json',summary],['independent-extraction-audit.json',audit],['review-exclusions.json',excluded],['catalog.json',catalog],['acquisitions.json',frozenAcquisitions]]){const content=JSON.stringify(data,null,2)+'\n';hashes[name]=sha(content);await writeFile(path.join(dest,name),content,{flag:'wx'});}
  await writeFile(path.join(dest,'sha256.json'),JSON.stringify(hashes,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({frozen:dest,...summary}));
 }
 return summary;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await auditAndFreeze({freeze:process.argv.includes('--freeze')});
