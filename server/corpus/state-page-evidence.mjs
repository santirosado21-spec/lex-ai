// Separate state-page research profile. No operative-law selection or client integration.
import {createHash} from 'node:crypto';
import {open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {canonicalJson} from '../canonical-json.mjs';

export const PROFILE_VERSION='nle-page-evidence-v1';
export const PAGE_LIMITS=Object.freeze({maxPages:1200,maxItemsPerPage:10000,maxTotalItems:250000,maxTextBytes:16*1024*1024,
  maxCandidates:50000,maxJsonBytes:64*1024*1024,maxPdfBytes:10*1024*1024,workerTimeoutMs:120000,workerHeapMiB:768});
const hash=value=>createHash('sha256').update(value).digest('hex');
export const evidenceError=code=>Object.assign(new Error(code),{code});
export const QUARANTINE=Object.freeze({status:'quarantined',rightsReview:'pending',textReview:'pending',legalReview:'pending',
  effectiveAt:null,published:false,indexed:false,trainingExported:false,approvedForAcquisition:false});
const invalid=()=>{throw evidenceError('page-evidence-invalid');};
const boundedText=value=>{if(typeof value!=='string'||value.length>1024*1024)invalid();return value;};
const optionalText=value=>{if(value===undefined||value===null)return null;if(typeof value!=='string'||value.length>256)invalid();return value;};
const optionalNumber=value=>{if(value===undefined||value===null)return null;if(!Number.isFinite(value))invalid();return value;};
const HEADER=/^[\t \u00a0]*(?:C[ÓO]DIGO\b|H\.?[\t ]*CONGRESO\b|[ÚU]LTIMA[\t ]+REFORMA\b|P[ÁA]GINA[\t ]+\d+|\d+[\t ]+(?:de|\/)[\t ]+\d+)/iu;
const EDITORIAL=/(?:\b(?:REFORMAD[OA]|ADICIONAD[OA]|DEROGAD[OA])\b|^[\t ]*NOTA[\t ]*:|FE[\t ]+DE[\t ]+ERRATAS|\bP\.[\t ]*O\.)/iu;
const TRANSITORY=/^[\t \u00a0]*(?:(?:ART[ÍI]CULOS?)[\t ]+)?TRANSITORIOS?(?:\b|(?=[.:\-–]))/iu;
// Explicit NLE ".-" delimiter, allowing whitespace before its dash. A wrapped
// body reference ending only in "ARTICULO96." is not an article heading.
const HEADING=/^[\t \u00a0]*(?:art(?:í|i\u0301|i)culo|art\.?)[\t \u00a0]*(\d+)(?:[oº°](?=[\t \u00a0.\-–:]|$))?(?:[\t \u00a0.\-–]+(BIS|TER|QU[ÁA]TER|QUATER|QUINQUIES)(?:[\t \u00a0\-–]+([A-ZÑ]|\d+))?)?[\t \u00a0]*\.[\t \u00a0]*[-–]/iu;
const BARE_REFERENCE=/^[\t \u00a0]*(?:art(?:í|i\u0301|i)culo|art\.?)[\t \u00a0]*\d+(?:[oº°])?(?:[\t \u00a0\-–]+(?:BIS|TER|QU[ÁA]TER|QUATER|QUINQUIES))?\.[\t \u00a0]*$/iu;

function sourceCheck(source,metadata){
  if(!source||typeof source.id!=='string'||!/^nl-(?:civil|penal)$/.test(source.id)||typeof source.lawId!=='string'||!source.lawId.startsWith('MX-NLE-')||typeof source.url!=='string'||!/^https:\/\/www\.hcnl\.gob\.mx\//.test(source.url)||!metadata||!/^[a-f0-9]{64}$/.test(metadata.pdfSha256)||typeof metadata.capturedAt!=='string'||!Number.isFinite(Date.parse(metadata.capturedAt)))throw evidenceError('page-provenance');
}
function evidenceHash(page){const {pageSha256,...body}=page;return hash(canonicalJson(body));}

export function buildPageEvidence(number,rawItems,metadata,limits=PAGE_LIMITS){
  if(!metadata||!/^[a-f0-9]{64}$/.test(metadata.pdfSha256))throw evidenceError('page-provenance');
  if(!Number.isSafeInteger(number)||number<1||number>limits.maxPages)throw evidenceError('page-budget');
  if(!Array.isArray(rawItems)||rawItems.length>limits.maxItemsPerPage)throw evidenceError('item-budget');
  const pieces=[],items=[];let length=0,textBytes=0,lastY,lastEol=false;
  for(const [index,item]of rawItems.entries()){
    const text=boundedText(item.str);
    let coordinates=null;
    if(item.transform!==undefined&&item.transform!==null){if(!Array.isArray(item.transform)||item.transform.length!==6||item.transform.some(n=>!Number.isFinite(n)))invalid();coordinates=[...item.transform];}
    if(item.hasEOL!==undefined&&item.hasEOL!==null&&typeof item.hasEOL!=='boolean')invalid();
    const y=coordinates?.[5],separator=index>0&&(lastEol||(lastY!==undefined&&y!==undefined&&lastY!==y))?'\n':'';
    textBytes+=Buffer.byteLength(text)+separator.length;if(textBytes>limits.maxTextBytes)throw evidenceError('text-budget');
    const separatorStart=length;pieces.push(separator);length+=separator.length;
    const start=length;pieces.push(text);length+=text.length;
    items.push({itemIndex:index,text,start,end:length,separatorBefore:{text:separator,start:separatorStart,end:start},coordinates,
      width:optionalNumber(item.width),height:optionalNumber(item.height),dir:optionalText(item.dir),fontName:optionalText(item.fontName),hasEOL:item.hasEOL??null});
    lastY=y;lastEol=item.hasEOL===true;
  }
  const text=pieces.join('');if(Buffer.byteLength(text)>limits.maxTextBytes)throw evidenceError('text-budget');
  const lines=[];let start=0;
  for(const [index,literal]of text.split('\n').entries()){
    lines.push({line:index+1,start,end:start+literal.length,text:literal,textSha256:hash(literal)});start+=literal.length+1;
  }
  const page={pageNumber:number,pdfSha256:metadata.pdfSha256,profileVersion:PROFILE_VERSION,offsetUnit:'UTF-16-code-units',
    textConstruction:'PDF.js text items verbatim; generated newline for changed item Y or preceding hasEOL; no inserted spaces/NFC',
    text,textSha256:hash(text),lines,items,...QUARANTINE};
  return {...page,pageSha256:evidenceHash(page)};
}

function assemble(pages,source,metadata,limits,runtimeParserVersion=null){
  sourceCheck(source,metadata);
  if(!Array.isArray(pages)||!pages.length||pages.length>limits.maxPages)throw evidenceError('page-budget');
  pages.sort((a,b)=>a.pageNumber-b.pageNumber);
  if(pages.some((page,index)=>page.pageNumber!==index+1))throw evidenceError('page-coverage');
  const totalItems=pages.reduce((n,p)=>n+p.items.length,0),textBytes=pages.reduce((n,p)=>n+Buffer.byteLength(p.text),0);
  if(totalItems>limits.maxTotalItems)throw evidenceError('item-budget');if(textBytes>limits.maxTextBytes)throw evidenceError('text-budget');
  const records=[],metadataCandidates=[],firstKeys=new Map();let duplicates=0;
  for(const page of pages){
    if(page.pageSha256!==evidenceHash(page)||page.pdfSha256!==metadata.pdfSha256)throw evidenceError('page-provenance');
    for(const line of page.lines){
      const common={documentId:source.id,lawId:source.lawId,sourceUrl:source.url,pdfSha256:metadata.pdfSha256,pageNumber:page.pageNumber,
        pageSha256:page.pageSha256,pageTextSha256:page.textSha256,line:line.line,...QUARANTINE};
      const heading=HEADING.exec(line.text);
      if(heading){
        const key=[heading[1],heading[2]?.toUpperCase(),heading[3]?.toUpperCase()].filter(Boolean).join('-');
        const id=source.id+'@sha256:'+metadata.pdfSha256+':heading:'+(records.length+1),duplicateOf=firstKeys.get(key)??null;
        if(duplicateOf)duplicates++;else firstKeys.set(key,id);
        records.push({...common,id,kind:'article-heading-candidate',literal:heading[0],start:line.start,end:line.start+heading[0].length,
          textSha256:hash(heading[0]),lineText:line.text,lineTextSha256:line.textSha256,technicalHeadingKey:key,duplicateOf,
          duplicateHeadingKey:duplicateOf!==null,operativeClassification:'not-performed',profileVersion:PROFILE_VERSION});
      }
      for(const [kind,pattern]of [['transitory-heading-candidate',TRANSITORY],['editorial-line-candidate',EDITORIAL],['header-line-candidate',HEADER],['ambiguous-bare-article-reference-candidate',BARE_REFERENCE]]){
        if(pattern.test(line.text))metadataCandidates.push({...common,kind,literal:line.text,start:line.start,end:line.end,textSha256:line.textSha256,
          operativeClassification:'not-performed'});
      }
      if(records.length+metadataCandidates.length>limits.maxCandidates)throw evidenceError('candidate-budget');
    }
  }
  const result={schemaVersion:1,kind:'state-page-research-evidence',profileVersion:PROFILE_VERSION,documentId:source.id,lawId:source.lawId,
    sourceUrl:source.url,pdfSha256:metadata.pdfSha256,capturedAt:metadata.capturedAt,runtimeParserVersion:optionalText(runtimeParserVersion),
    offsetUnit:'UTF-16-code-units',pages,records,metadataCandidates,
    coverage:{pages:pages.length,pageNumbers:pages.map(p=>p.pageNumber),textBytes,totalItems,headingCandidates:records.length,
      repeatedHeadingCandidates:duplicates,transitoryCandidates:metadataCandidates.filter(c=>c.kind==='transitory-heading-candidate').length,
      editorialCandidates:metadataCandidates.filter(c=>c.kind==='editorial-line-candidate').length,
      headerCandidates:metadataCandidates.filter(c=>c.kind==='header-line-candidate').length,
      ambiguousBareReferences:metadataCandidates.filter(c=>c.kind==='ambiguous-bare-article-reference-candidate').length,rawPageEvidenceStored:true},
    limitations:['Page text is item-derived, not original page bytes or independent fidelity validation.','Candidate counts do not establish operative articles, applicable version, complete law or legal correctness.','Repeated headings, editorial material and transitories are retained; no remainder is truncated or selected.'],...QUARANTINE};
  const documentEvidenceSha256=hash(canonicalJson(result));
  const final={...result,documentEvidenceSha256};
  if(Buffer.byteLength(canonicalJson(final))>limits.maxJsonBytes)throw evidenceError('output-budget');
  return final;
}

export function buildStatePageEvidence(rawPages,source,metadata,limits=PAGE_LIMITS,runtimeParserVersion=null){
  sourceCheck(source,metadata);
  if(!Array.isArray(rawPages)||!rawPages.length||rawPages.length>limits.maxPages)throw evidenceError('page-budget');
  const pages=[];let totalText=0,totalItems=0;
  for(const raw of rawPages){const page=buildPageEvidence(raw.number,raw.items,metadata,limits);totalText+=Buffer.byteLength(page.text);totalItems+=page.items.length;if(totalText>limits.maxTextBytes)throw evidenceError('text-budget');if(totalItems>limits.maxTotalItems)throw evidenceError('item-budget');pages.push(page);}
  return assemble(pages,source,metadata,limits,runtimeParserVersion);
}

export function verifyStatePageEvidence(input,source,metadata,limits=PAGE_LIMITS){
  let clone;try{clone=JSON.parse(canonicalJson(input));}catch{throw evidenceError('page-evidence-invalid');}
  if(!Array.isArray(clone.pages))invalid();
  const rawPages=clone.pages.map(p=>({number:p.pageNumber,items:p.items.map(i=>({str:i.text,transform:i.coordinates,width:i.width,height:i.height,dir:i.dir,fontName:i.fontName,hasEOL:i.hasEOL}))}));
  const expected=buildStatePageEvidence(rawPages,source,metadata,limits,clone.runtimeParserVersion);
  if(canonicalJson(expected)!==canonicalJson(clone))throw evidenceError('page-evidence-invalid');
  return expected;
}

export function parseStatePagesInWorker(file,source,metadata,{limits=PAGE_LIMITS,signal}={}){
  sourceCheck(source,metadata);
  for(const [key,max]of Object.entries(PAGE_LIMITS))if(!Number.isSafeInteger(limits[key])||limits[key]<1||limits[key]>max)throw evidenceError('page-budget');
  if(signal?.aborted)return Promise.reject(evidenceError('cancelled'));
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL(import.meta.url),{execArgv:[],workerData:{kind:PROFILE_VERSION,file,source,metadata,limits},resourceLimits:{maxOldGenerationSizeMb:limits.workerHeapMiB}});
    let settled=false;const finish=async(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);await worker.terminate();error?reject(error):resolve(result);};
    const abort=()=>{void finish(evidenceError('cancelled'));};signal?.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(()=>{void finish(evidenceError('parser-timeout'));},limits.workerTimeoutMs);
    worker.on('message',message=>{void finish(message.ok?null:evidenceError(message.errorCode??'page-extract-failed'),message.result);});
    worker.on('error',()=>{void finish(evidenceError('page-extract-failed'));});worker.on('exit',()=>{if(!settled)void finish(evidenceError('page-extract-failed'));});
  });
}

if(!isMainThread&&workerData?.kind===PROFILE_VERSION){
  try{
    globalThis.fetch=()=>{throw evidenceError('network-denied');};
    const {default:pdf}=await import('pdf-parse/lib/pdf-parse.js');
    const {file,source,metadata,limits}=workerData;
    const handle=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);let bytes;
    try{
      const info=await handle.stat();if(!info.isFile()||info.size>limits.maxPdfBytes)throw evidenceError('input-integrity');
      const buffer=Buffer.alloc(Math.min(info.size+1,limits.maxPdfBytes+1));let size=0;
      while(size<buffer.length){const part=await handle.read(buffer,size,buffer.length-size,null);if(!part.bytesRead)break;size+=part.bytesRead;}
      if(size!==info.size||size>limits.maxPdfBytes)throw evidenceError('input-integrity');bytes=buffer.subarray(0,size);
    }finally{await handle.close();}
    if(bytes.length>limits.maxPdfBytes||!bytes.subarray(0,5).equals(Buffer.from('%PDF-'))||hash(bytes)!==metadata.pdfSha256)throw evidenceError('input-integrity');
    const pages=[];let totalText=0,totalItems=0;
    const parsed=await pdf(new Uint8Array(bytes),{max:limits.maxPages,pagerender:async page=>{
      const content=await page.getTextContent({normalizeWhitespace:false,disableCombineTextItems:false});
      const evidence=buildPageEvidence(page.pageNumber,content.items,metadata,limits);totalText+=Buffer.byteLength(evidence.text);totalItems+=evidence.items.length;
      if(totalText>limits.maxTextBytes)throw evidenceError('text-budget');if(totalItems>limits.maxTotalItems)throw evidenceError('item-budget');pages.push(evidence);return '';
    }});
    if(parsed.numpages>limits.maxPages||pages.length!==parsed.numpages)throw evidenceError('page-coverage');
    const result=assemble(pages,source,metadata,limits,parsed.version??null);
    parentPort.postMessage({ok:true,result});
  }catch(error){parentPort.postMessage({ok:false,errorCode:['page-budget','item-budget','text-budget','candidate-budget','output-budget','input-integrity','page-coverage','page-provenance','page-evidence-invalid'].includes(error?.code)?error.code:'page-extract-failed'});}
}
