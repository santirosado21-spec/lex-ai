import {readFile,writeFile,mkdir,rename,open,unlink,statfs,mkdtemp,readdir,rm} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {spawn,spawnSync,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import os from 'node:os';
import path from 'node:path';
import {runLegalSync,validateSourceUrl,robotsPolicy,LEGAL_SYNC_AGENT,detectDocumentFormat} from './legal-sync.mjs';

export const EXTRACTOR_VERSION=31;
// v31: non-article document classes, only when ZERO article headings parse.
// 'principios' (numbered named values, e.g. ethics codes: "1.- Integridad."),
// 'capitulos-numerados' (all-caps numbered chapters: "1. DISPOSICIONES")
// and 'resolutivos' (decree resolve points: "Primero.", "Segundo."). Strictly
// sequential from the first word/number, minimum 3/2 headings, each record
// >=60 chars. Records carry articleId:null + recordKind, are always
// quality=quarantined (never exportable) and the class is anomaly-flagged.
// Numbers are never invented: identifiers come only from the document text.
// v30: OCR path additionally repairs an OCR-comma heading terminator
// ("Artículo 3," when the scan prints "Artículo 3.") — only when the number is
// the strictly expected next article AND a sentence-case capital follows, so a
// body reference like "Artículo 3, fracción..." never misfires. Anomaly-flagged.
// v29: OCR fallback for image-only (scanned) PDFs. When the digital text layer
// is absent (average extracted text below OCR_MIN_PAGE_CHARS per page), the
// worker rasterizes pages locally with pdftoppm and OCRs them locally with
// tesseract (offline, no network, no cost), then runs the SAME article parsing
// on the OCR text. Provenance stays fail-closed: OCR-derived records are demoted
// to 'quarantined' quality with the 'ocr-derived-text-layer' anomaly, so they
// can never reach exportLibrary (structurally-verified only). Documents over
// OCR_PAGE_CAP pages are never partially OCRed; they keep failing as
// extraction-invalid with an 'ocr-page-cap-exceeded' coverage note.
export const OCR_PAGE_CAP=160;
export const OCR_DPI=300;
const OCR_MIN_PAGE_CHARS=10;
const OCR_PAGE_TIMEOUT_MS=30000;
const OCR_MS_PER_PAGE=6000;
const OCR_MAX_TOTAL_MS=1200000;
// Maximum PDF pages the worker will parse. Raised 1200 -> 2000 in v26 after verifying the largest observed official document (nay-ley-148, Presupuesto de Egresos Nayarit 2026: 1,376 pages, 20.3 MB) parses in ~12 s and ~77 MB heap, well inside the worker's 120 s timeout and 768 MB old-generation limit. Documents above the cap still fail closed as 'PDF page coverage incomplete'.
export const EXTRACTOR_MAX_PAGES=2000;
export const INDEX_URL='https://www.diputados.gob.mx/LeyesBiblio/index.htm';
export const REGLAMENTOS_INDEX_URL='https://www.diputados.gob.mx/LeyesBiblio/regla.htm';
export const CANDIDATE_REPOSITORIES=['renich/LeyesMexicanas','rafael-afie/leyes-fiscales-mx','alfonsomp18/mx-law-code-v2'];
const digest=value=>createHash('sha256').update(value).digest('hex');
// v27: official Word formats (.docx OOXML, .doc legacy OLE) as acquisition input, detected by magic bytes.
// Extraction is isolated and read-only: .docx reads only word/document.xml from the ZIP (string-based, no XML parser,
// macros and active content are never touched); .doc goes through antiword, a static read-only text extractor that
// cannot execute macros. Nothing else about the pipeline changes; PDF path is byte-identical to v26.
// v28: document.xml is read as a STREAM (yauzl lazy entry + incremental w:t scan) instead of JSZip whole-string, so
// memory stays bounded regardless of XML size. Same paragraph semantics as v27 (split on </w:p[ >], join w:t runs,
// then unescape), verified byte-identical against the v27 string parser on fixtures. Hard caps (fail closed):
// document.xml uncompressed <= 1 GiB, compression ratio <= 200, no encrypted entries, single text run <= 4 MiB,
// single paragraph <= 8 MiB, total extracted text <= 64 MiB, unclosed-tag carry <= 1 MiB. Closes the
// document-xml-budget gap class (real case: mex-ley-222, document.xml of 314 MB inside a 6.9 MB docx).
export {detectDocumentFormat};
const xmlUnescape=value=>value.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
// Incremental scan of an XML byte stream: emits the text of each <w:t> run and splits paragraphs at </w:p[ >],
// byte-identical to the v27 expression xml.split(/<\/w:p[ >]/).map(seg => join of seg's <w:t> contents).
// Unclosed trailing tags at EOF are dropped, exactly like the v27 regexes (which require closing tags).
export async function docxParagraphsFromXmlStream(stream){
  const decoder=new TextDecoder('utf-8',{stream:true});
  let pending='',current='';const paragraphs=[];let totalText=0,mode='gap';
  const appendText=text=>{current+=text;totalText+=text.length;
    if(current.length>8*1024*1024)throw new Error('DOCX paragraph exceeds safety cap');
    if(totalText>64*1024*1024)throw new Error('DOCX text exceeds safety cap');};
  const consume=final=>{
    for(;;){
      if(mode==='gap'){
        const startIdx=pending.search(/<w:t[\s>]/),paraIdx=pending.search(/<\/w:p[ >]/);
        if(startIdx===-1&&paraIdx===-1){
          if(final){pending='';return;}
          const cut=pending.lastIndexOf('<');pending=cut===-1?'':pending.slice(cut);
          if(pending.length>1024*1024)throw new Error('DOCX unclosed tag run exceeds safety cap');
          return;
        }
        if(paraIdx!==-1&&(startIdx===-1||paraIdx<startIdx)){paragraphs.push(current);current='';pending=pending.slice(paraIdx+6);continue;}
        const gt=pending.indexOf('>',startIdx);
        if(gt===-1){if(final){pending='';return;}if(pending.length>1024*1024)throw new Error('DOCX unclosed tag run exceeds safety cap');return;}
        pending=pending.slice(gt+1);mode='text';continue;
      }
      const close=pending.indexOf('</w:t>');
      if(close===-1){
        if(pending.length>4*1024*1024)throw new Error('DOCX text run exceeds safety cap');
        if(final)pending=''; // unclosed w:t at EOF: dropped, same as the v27 regex
        return;
      }
      appendText(xmlUnescape(pending.slice(0,close)));pending=pending.slice(close+6);mode='gap';
    }
  };
  for await(const chunk of stream){pending+=decoder.decode(chunk,{stream:true});consume(false);}
  pending+=decoder.decode();consume(true);
  paragraphs.push(current); // trailing segment after the last </w:p>, as produced by v27's split
  return paragraphs;
}
function docxPages(bytes){
  const yauzl=require('yauzl');
  return new Promise((resolve,reject)=>{
    yauzl.fromBuffer(bytes,{lazyEntries:true,validateEntrySizes:true},(error,zip)=>{
      if(error)return reject(new Error('DOCX inválido.'));
      let found=false,settled=false;
      const fail=cause=>{if(settled)return;settled=true;zip.close();reject(cause);};
      zip.on('error',()=>fail(new Error('DOCX inválido.')));
      zip.on('entry',entry=>{
        if(entry.fileName!=='word/document.xml')return zip.readEntry();
        found=true;
        if(entry.generalPurposeBitFlag&1)return fail(new Error('DOCX encrypted entries are not supported'));
        if(entry.uncompressedSize>1024*1024*1024)return fail(new Error('DOCX document.xml exceeds safety cap'));
        if(entry.compressedSize>0&&entry.uncompressedSize/entry.compressedSize>200)return fail(new Error('DOCX compression ratio exceeds safety cap'));
        zip.openReadStream(entry,(streamError,stream)=>{
          if(streamError)return fail(new Error('DOCX document.xml unreadable'));
          stream.on('error',()=>fail(new Error('DOCX document.xml unreadable')));
          docxParagraphsFromXmlStream(stream).then(paragraphs=>{if(settled)return;settled=true;zip.close();resolve([{number:1,text:paragraphs.join('\n')}]);},fail);
        });
      });
      zip.on('end',()=>{if(!found)fail(new Error('DOCX without word/document.xml'));});
      zip.readEntry();
    });
  });
}
function docPages(file){
  return new Promise((resolve,reject)=>{
    const child=spawn('antiword',['-m','UTF-8.txt',file],{stdio:['ignore','pipe','ignore']});
    const chunks=[];let size=0,settled=false;
    const timer=setTimeout(()=>{if(!settled){settled=true;child.kill('SIGKILL');reject(new Error('antiword timeout after 60 seconds'));}},60000);
    child.stdout.on('data',chunk=>{size+=chunk.length;if(size>64*1024*1024){settled=true;clearTimeout(timer);child.kill('SIGKILL');reject(new Error('antiword output exceeds cap'));}else chunks.push(chunk);});
    child.on('error',error=>{if(!settled){settled=true;clearTimeout(timer);reject(error);}});
    child.on('close',code=>{if(settled)return;settled=true;clearTimeout(timer);
      if(code!==0&&!chunks.length)return reject(new Error(`antiword exited with code ${code}`));
      const text=Buffer.concat(chunks).toString('utf8');
      resolve(text.split('\f').map((pageText,index)=>({number:index+1,text:pageText})));
    });
  });
}
export async function parseWordInWorker(file,source,metadata){
  return new Promise((resolve,reject)=>{const worker=new Worker(new URL(import.meta.url),{execArgv:[],workerData:{kind:'extract-word-library',file,source,metadata},resourceLimits:{maxOldGenerationSizeMb:768}});let settled=false;const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);void worker.terminate();error?reject(error):resolve(value);};const timer=setTimeout(()=>finish(new Error('Word extraction timeout after 120 seconds')),120000);worker.on('message',m=>m.error?finish(new Error(m.error)):finish(null,m.result));worker.on('error',e=>finish(e));worker.on('exit',code=>{if(!settled)finish(new Error(`Extractor exited without result (${code})`));});});
}
const normalize=value=>value.normalize('NFC').replace(/\s+/g,' ').trim();
const folded=value=>normalize(value).normalize('NFD').replace(/\p{M}/gu,'').toUpperCase();
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function atomic(file,value){await mkdir(path.dirname(file),{recursive:true});const tmp=file+'.'+randomUUID()+'.tmp';await writeFile(tmp,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{mode:0o600});await rename(tmp,file);}
async function json(file,fallback){try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}

const named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',aacute:'á',eacute:'é',iacute:'í',oacute:'ó',uacute:'ú',Aacute:'Á',Eacute:'É',Iacute:'Í',Oacute:'Ó',Uacute:'Ú',ntilde:'ñ',Ntilde:'Ñ',uuml:'ü',Uuml:'Ü'};
function htmlText(value){return normalize(value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ').replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi,(match,name)=>{if(name.startsWith('#')){const number=name[1].toLowerCase()==='x'?parseInt(name.slice(2),16):parseInt(name.slice(1),10);return number<=0x10ffff?String.fromCodePoint(number):match;}return named[name]??match;}));}
export function decodeIndex(bytes){try{return {text:new TextDecoder('utf-8',{fatal:true}).decode(bytes),encoding:'utf-8'};}catch{return {text:new TextDecoder('windows-1252').decode(bytes),encoding:'windows-1252'};}}

export function parseOfficialIndex(html,{retrievedAt=new Date().toISOString(),indexSha256=digest(html)}={}){
  const sources=[],seen=new Set(),anomalies=[];
  for(const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
    const contents=row[1];const links=[...contents.matchAll(/href\s*=\s*["']([^"']+)["']/gi)];
    for(const link of links){let url;try{url=new URL(link[1].replaceAll('&amp;','&'),INDEX_URL);}catch{continue;}
      if(url.origin!=='https://www.diputados.gob.mx'||!/^\/LeyesBiblio\/pdf\/[A-Za-z0-9_-]+\.pdf$/i.test(url.pathname)||seen.has(url.href))continue;
      const ref=/<a\b[^>]*href\s*=\s*["'](?:ref\/[^"']+|[^"']*\/ref\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/i.exec(contents);
      const cells=[...contents.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(x=>htmlText(x[1]));
      const title=ref?htmlText(ref[1]):cells[1]?.split(/\s+DOF\b/)[0];
      if(!title||title.length<5||title.length>1000){anomalies.push({url:url.href,reason:'missing-or-ambiguous-title'});continue;}
      const code=path.posix.basename(url.pathname,'.pdf');const stableCode=code.replace(/_\d{6,8}$/,'');const baseId=stableCode.toLowerCase().replace(/_/g,'-');const id=/^[a-z]/.test(baseId)?baseId:'law-'+baseId;
      if(!/^[a-z][a-z0-9-]{0,39}$/.test(id)){anomalies.push({url:url.href,reason:'unsupported-source-id'});continue;}
      sources.push({id,lawId:`MX-FED-${stableCode.toUpperCase()}`,title,url:url.href,authority:'Cámara de Diputados del H. Congreso de la Unión',jurisdiction:'MX-FED',language:'es',publisherIndex:INDEX_URL,indexRow:cells.slice(0,3),indexSha256,discoveredAt:retrievedAt,listedStatus:'publisher-index-listing-not-independent-currentness-verification',reuseBasis:{kind:'official-legislative-text',reference:'https://www.diputados.gob.mx/LeyesBiblio/pdf/LFDA.pdf',article:'14 VIII',scope:'Statutory text only; commentary excluded; source fidelity required; not an individualized legal license opinion.'}});seen.add(url.href);
    }
  }
  if(!sources.length)throw new Error('El índice no contiene filas PDF reconocibles; no se crea un catálogo vacío.');
  return {schemaVersion:1,source:INDEX_URL,retrievedAt,indexSha256,count:sources.length,sources,anomalies,coverage:'Recognized main PDF links from this dated index snapshot; not all Mexican law.'};
}

// The regulations index has a different, older table layout than index.htm. Keep
// this parser separate so a markup change cannot silently broaden the law parser.
export function parseRegulationsIndex(html,{retrievedAt=new Date().toISOString(),indexSha256=digest(html)}={}){
  const sources=[],seen=new Set(),anomalies=[];let rows=0;
  for(const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
    const contents=row[1];const cells=[...contents.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(x=>htmlText(x[1]));
    const titleCandidates=[...(cells[1]??'').matchAll(/(?:^|\s)(REGLAMENTO\b[\s\S]*?)(?=\s+(?:Original|Reformas?|Cantidades)\b|$)/gi)].map(x=>normalize(x[1]));
    const title=titleCandidates[0]??normalize(cells[1]?.split(/\s+(?:Original|Reformas?|Cantidades)\b/i)[0]??'');
    if(/\.pdf(?:["']|\s|$)/i.test(contents))rows++;
    for(const link of contents.matchAll(/href\s*=\s*["']([^"']+)["']/gi)){
      let url;try{url=new URL(link[1].replaceAll('&amp;','&'),REGLAMENTOS_INDEX_URL);}catch{anomalies.push({row:cells.slice(0,4),target:link[1],reason:'invalid-link-target'});continue;}
      const isPdf=/\.pdf$/i.test(url.pathname);
      if(!isPdf)continue;
      if(url.origin!=='https://www.diputados.gob.mx'||!/^\/LeyesBiblio\/regley\/[A-Za-z0-9_-]+\.pdf$/i.test(url.pathname)){
        anomalies.push({row:cells.slice(0,4),url:url.href,reason:'excluded-noncanonical-or-foreign-pdf-target'});continue;
      }
      if(seen.has(url.href)){anomalies.push({row:cells.slice(0,4),url:url.href,reason:'excluded-duplicate-pdf-target'});continue;}
      if(!title||title.length<5||title.length>1000){anomalies.push({row:cells.slice(0,4),url:url.href,reason:'missing-or-ambiguous-title'});continue;}
      const code=path.posix.basename(url.pathname,'.pdf');const stableCode=code.replace(/_\d{6,8}$/,'').replace(/^Reg_/i,'');const baseId='reg-'+stableCode.toLowerCase().replace(/_/g,'-');
      if(!/^[a-z][a-z0-9-]{0,39}$/.test(baseId)){anomalies.push({row:cells.slice(0,4),url:url.href,reason:'unsupported-source-id'});continue;}
      sources.push({id:baseId,lawId:`MX-FED-REG-${stableCode.toUpperCase()}`,title,url:url.href,authority:'Cámara de Diputados del H. Congreso de la Unión',jurisdiction:'MX-FED',language:'es',publisherIndex:REGLAMENTOS_INDEX_URL,indexRow:cells.slice(0,4),indexSha256,discoveredAt:retrievedAt,listedStatus:'publisher-index-listing-not-independent-currentness-verification',reuseBasis:{kind:'official-legislative-text',reference:'https://www.diputados.gob.mx/LeyesBiblio/pdf/LFDA.pdf',article:'14 VIII',scope:'Statutory text only; commentary excluded; source fidelity required; not an individualized legal license opinion.'}});seen.add(url.href);
    }
  }
  if(!sources.length)throw new Error('El índice de reglamentos no contiene filas PDF reconocibles; no se crea un catálogo vacío.');
  const excluded=anomalies.filter(anomaly=>anomaly.reason.startsWith('excluded-')).length;
  return {schemaVersion:1,source:REGLAMENTOS_INDEX_URL,retrievedAt,indexSha256,count:sources.length,rows,kept:sources.length,excluded,sources,anomalies,coverage:'Recognized main PDF links from this dated federal regulations index snapshot; not all Mexican law or regulations.'};
}

async function boundedGet(url,{fetchImpl=fetch,maxBytes=5*1024*1024,timeoutMs=45000,github=false}={}){
  let current=new URL(url);
  for(let n=0;n<4;n++){
    if(github){if(current.protocol!=='https:'||current.hostname!=='api.github.com'||current.port||current.username||current.password)throw new Error('Destino GitHub no permitido.');}else validateSourceUrl(current.href);
    const response=await fetchImpl(current.href,{redirect:'manual',headers:{'User-Agent':LEGAL_SYNC_AGENT,Accept:github?'application/vnd.github.raw+json':'text/html, text/plain'},signal:AbortSignal.timeout(timeoutMs)});
    if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('location');await response.body?.cancel();if(!location)throw new Error('Redirección sin destino');current=new URL(location,current);continue;}
    if(Number(response.headers.get('content-length')||0)>maxBytes){await response.body?.cancel();throw new Error('Respuesta demasiado grande');}
    const chunks=[];let total=0;for await(const b of response.body??[]){total+=b.length;if(total>maxBytes)throw new Error('Respuesta demasiado grande');chunks.push(Buffer.from(b));}
    return {status:response.status,bytes:Buffer.concat(chunks),headers:Object.fromEntries(response.headers),url:current.href};
  }
  throw new Error('Demasiadas redirecciones.');
}

export async function discoverLibrary({outputDir,catalogPath,indexFile,compareRepositories=false,fetchImpl=fetch,sleep=pause}={}){
  await mkdir(path.join(outputDir,'discovery'),{recursive:true});let bytes,network=null;
  if(indexFile)bytes=await readFile(indexFile);
  else{
    const robots=await boundedGet(new URL('/robots.txt',INDEX_URL).href,{fetchImpl,maxBytes:512000});
    if(![200,404,410].includes(robots.status))throw new Error('robots.txt no verificable; descubrimiento aplazado.');
    const policy=robotsPolicy(robots.status===200?robots.bytes.toString('utf8'):'',INDEX_URL);if(!policy.allowed||policy.crawlDelayMs>60_000)throw new Error('Índice bloqueado o aplazado por robots.txt.');
    await sleep(Math.max(2000,policy.crawlDelayMs));network=await boundedGet(INDEX_URL,{fetchImpl});if(network.status!==200)throw new Error(`Índice HTTP ${network.status}`);bytes=network.bytes;
    await atomic(path.join(outputDir,'discovery/network.json'),{retrievedAt:new Date().toISOString(),headers:network.headers,robotsStatus:robots.status,robotsSha256:digest(robots.bytes)});
  }
  const decoded=decodeIndex(bytes);const catalog=parseOfficialIndex(decoded.text,{indexSha256:digest(bytes)});catalog.encoding=decoded.encoding;catalog.importedSnapshot=Boolean(indexFile);
  await writeFile(path.join(outputDir,'discovery/index.html'),bytes);
  catalog.repositoryComparisons=[];
  if(compareRepositories){for(const repository of CANDIDATE_REPOSITORIES){try{const result=await boundedGet(`https://api.github.com/repos/${repository}/readme`,{fetchImpl,maxBytes:256000,github:true});if(result.status!==200)throw new Error(`README HTTP ${result.status}`);let text=result.bytes.toString('utf8');try{const body=JSON.parse(text);if(body.encoding==='base64'&&body.content)text=Buffer.from(body.content,'base64').toString('utf8');}catch{}
    const candidates=[...new Set(text.match(/https?:\/\/(?:www\.)?diputados\.gob\.mx\/LeyesBiblio\/pdf\/[A-Za-z0-9_-]+\.pdf/g)??[])];
    catalog.repositoryComparisons.push({repository,url:`https://github.com/${repository}`,checkedAt:new Date().toISOString(),readmeSha256:digest(result.bytes),officialUrlCandidates:candidates.map(url=>({url,matchedOfficialCatalog:catalog.sources.some(s=>s.url===url.replace(/^http:/,'https:').replace('://diputados.', '://www.diputados.'))})),status:'candidate-only',codeExecuted:false,textIngested:false});
    await writeFile(path.join(outputDir,'discovery',repository.replace('/','--')+'.README.txt'),text);
  }catch(e){catalog.repositoryComparisons.push({repository,status:'unavailable',error:e.message,codeExecuted:false,textIngested:false});}await sleep(2000);}}
  else catalog.repositoryComparisons=CANDIDATE_REPOSITORIES.map(repository=>({repository,status:'documented-candidate-not-fetched-this-run',reference:'docs/architecture/legal-repositories.md',codeExecuted:false,textIngested:false}));
  await atomic(catalogPath,catalog);return catalog;
}

export async function discoverRegulationsLibrary({outputDir,catalogPath,indexFile,fetchImpl=fetch,sleep=pause}={}){
  await mkdir(path.join(outputDir,'discovery'),{recursive:true});let bytes,network=null;
  if(indexFile)bytes=await readFile(indexFile);
  else{
    const robots=await boundedGet(new URL('/robots.txt',REGLAMENTOS_INDEX_URL).href,{fetchImpl,maxBytes:512000});
    if(![200,404,410].includes(robots.status))throw new Error('robots.txt no verificable; descubrimiento aplazado.');
    const policy=robotsPolicy(robots.status===200?robots.bytes.toString('utf8'):'',REGLAMENTOS_INDEX_URL);if(!policy.allowed||policy.crawlDelayMs>60_000)throw new Error('Índice bloqueado o aplazado por robots.txt.');
    await sleep(Math.max(2000,policy.crawlDelayMs));network=await boundedGet(REGLAMENTOS_INDEX_URL,{fetchImpl});if(network.status!==200)throw new Error(`Índice HTTP ${network.status}`);bytes=network.bytes;
    await atomic(path.join(outputDir,'discovery/reglamentos-network.json'),{retrievedAt:new Date().toISOString(),headers:network.headers,robotsStatus:robots.status,robotsSha256:digest(robots.bytes)});
  }
  const decoded=decodeIndex(bytes);const catalog=parseRegulationsIndex(decoded.text,{indexSha256:digest(bytes)});catalog.encoding=decoded.encoding;catalog.importedSnapshot=Boolean(indexFile);catalog.repositoryComparisons=[];
  await writeFile(path.join(outputDir,'discovery/reglamentos-index.html'),bytes);await atomic(catalogPath,catalog);return catalog;
}

export function splitForLaw(lawId){const bucket=parseInt(digest('lex-law-split-v1:'+lawId).slice(0,8),16)%100;return bucket<80?'train':bucket<90?'validation':'test';}
const ARTICLE=/^[ \t]*(?:ART[ÍI]CULO|Art[íi]culo|ART\.|Art\.)\s+(\d+)(?:(?:[oº°]|\/o)(?=\s|[.\-]))?(?:[.](?=[ \t]+(?:BIS|TER|QU[ÁA]TER|QUATER|QUINQUIES|QUINTUS|SEXIES|SEXTUS|SEPTIES|SEPTIMUS|OCTIES|NONIES|NONUS|DECIES|UNDECIES|DUODECIES|DUODECIMUS)\b|[ \t]*-[ \t]*(?:[A-ZÑ]|\d+)(?:[ \t]+(?:BIS|TER|QU[ÁA]TER|QUATER|QUINQUIES|QUINTUS|SEXIES|SEXTUS|SEPTIES|SEPTIMUS|OCTIES|NONIES|NONUS|DECIES|UNDECIES|DUODECIES|DUODECIMUS))?[.\-]))?(?:[ \t]*[-–][ \t]*(BIS|TER|QU[ÁA]TER|QUATER|QUINQUIES|QUINTUS|SEXIES|SEXTUS|SEPTIES|SEPTIMUS|OCTIES|NONIES|NONUS|DECIES|UNDECIES|DUODECIES|DUODECIMUS|[A-ZÑ]|\d+))?(?:[ \t]+(BIS|TER|QU[ÁA]TER|QUATER|QUINQUIES|QUINTUS|SEXIES|SEXTUS|SEPTIES|SEPTIMUS|OCTIES|NONIES|NONUS|DECIES|UNDECIES|DUODECIES|DUODECIMUS)(?:(?:[ \t-]+|\.[ \t]+)((?:[IVXL]+)|\d+)(?=[ \t]*[.\-]))?)?(?:[ \t]*[-–][ \t]*((?:[IVXL]+)|\d+)(?=[ \t]*[.\-]))?[ \t]*(?:[.:]|[-–](?![A-Za-zÑñ\d])|[ \t]+\((?=(?:DEROGADO|REFORMADO|ADICIONADO)\b))/i;
const amendment=/^(?:Art[íi]culo|P[áa]rrafo|Fracci[óo]n|Inciso|Numeral|Apartado|Cap[íi]tulo|Secci[óo]n|Denominaci[óo]n|T[íi]tulo)\b.*\b(?:reformad[oa]|adicionad[oa]|derogad[oa]|recorrid[oa])\b.*\bDOF\b/i;
const section=/^(?:LIBRO|T[IÍ]TULO|CAP[IÍ]TULO|SECCI[ÓO]N|SUBSECCI[ÓO]N)\s+(?:[IVXLCDM]+|\d+|PRIMER[OA]|SEGUND[OA]|TERCER[OA]?|CUART[OA]|QUINT[OA]|SEXTO|S[ÉE]PTIMO|OCTAVO|NOVENO|D[ÉE]CIMO|[ÚU]NIC[OA])\b/i;
const transitory=/^(?:ART[IÍ]CULOS?\s+)?TRANSITORIOS?\s*[.:]?$/i;
const editorialLine=/^(?:Reforma DOF|Fe de erratas|Art[íi]culo vinculado con art[íi]culo transitorio|[A-Za-zÁÉÍÓÚáéíóúñÑ ]+ (?:reformado|adicionado|derogado) DOF)\b/i;
const reformNote=/^\((?:REFORMADO|ADICIONADO|DEROGADO)/i;
const headingPre=/^(?:ART[IÍ]CULO|Art[íi]culo|ART\.|Art\.)\s/;
// Spelled-out ordinal headings in older official PDFs ("ARTICULO PRIMERO.-", "ARTICULOS PRIMERO A OCTAVO.-"). Fail-closed: all-caps ARTICULO(S) only (body references like "el artículo primero de esta ley" never match), a strict terminator, only while no numeric article has opened, and strictly sequential from the previous ordinal. Unknown ordinal words never match.
const ordWord='(?:PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO|SEXTO|S[EÉ]PTIMO|OCTAVO|NOVENO|D[EÉ]CIMO|UND[EÉ]CIMO|DUOD[EÉ]CIMO|VIG[EÉ]SIMO|TRIG[EÉ]SIMO)';
const ordinalHeading=new RegExp(`^ART[ÍI]CULO ((?:${ordWord})(?: ${ordWord})?|UNICO)[ \\t]*[.:\\-]`);
const ordinalRange=new RegExp(`^ART[ÍI]CULOS (${ordWord}) A (${ordWord})[ \\t]*[.:\\-]`);
// Title-case spelled-ordinal heading variant ("Artículo Primero.-", seen in older Yucatán official PDFs). Fail-closed like the all-caps path: the strict terminator immediately after the ordinal word is required, so body references like "el artículo primero de esta ley" never match; it runs only inside the ordinal gate (no spaced numeric heading anywhere) and must continue strictly sequentially.
const ordWordTC='(?:Primero|Segundo|Tercero|Cuarto|Quinto|Sexto|S[eé]ptimo|Octavo|Noveno|D[eé]cimo|Und[eé]cimo|Duod[eé]cimo|Vig[eé]simo|Trig[eé]simo)';
const ordinalHeadingTC=new RegExp(`^Art[íi]culo ((?:${ordWordTC})(?: ${ordWordTC})?|Único|[ÚU]NICO)[ \\t]*[.:\\-]`);
// No-space numeric heading variant from PDFs whose text items omit space glyphs ("Artículo1.-Se crea…", "Artículo1o.-…", seen in Yucatán official PDFs). Fail-closed: strict ".-" terminator (wrapped body references like "Artículo65 del Código" never carry it), ordinal gate only, strictly sequential, and the document is flagged.
const nospaceHeading=/^Art[íi]culo(\d+)[oº°]?[.][-–]/;
// Reversed ordinal variant ("Artículo.-1o.Constituyen…", seen in Yucatán official PDFs): the word takes its terminator first, then the ordinal number. Fail-closed: exact rigid shape with the ordinal number carrying its own terminator; ordinal gate only, strictly sequential, document flagged.
const reversedOrdinal=/^Art[íi]culo[ \t]*[.:][ \t]*-[ \t]*(\d+)[oº°]?(?=[ \t]*[.:])/;
const ORD_UNIT={PRIMERO:1,SEGUNDO:2,TERCERO:3,CUARTO:4,QUINTO:5,SEXTO:6,SEPTIMO:7,OCTAVO:8,NOVENO:9};
const ORD_BASE={DECIMO:10,UNDECIMO:11,DUODECIMO:12,VIGESIMO:20,TRIGESIMO:30};
function ordinalValue(phrase){const p=phrase.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();if(p==='UNICO')return 1;if(ORD_UNIT[p])return ORD_UNIT[p];if(ORD_BASE[p])return ORD_BASE[p];const m=/^(DECIMO|VIGESIMO|TRIGESIMO) (PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO|SEXTO|SEPTIMO|OCTAVO|NOVENO)$/.exec(p);return m?ORD_BASE[m[1]]+ORD_UNIT[m[2]]:null;}
// Loose heading without terminator: number followed by an uppercase word. A suffix word after the number blocks this route (it is handled by noTermSuffix/bareSuffix) so "Artículo 21 Bis ..." can never open a plain article 21.
const noTerm=/^[ \t]*(?:ART[ÍI]CULO|Art[íi]culo|ART\.|Art\.)\s+(\d+)[ \t]+(?!(?:Bis|Ter|Qu[áa]ter|Quater|Quinquies|Quintus|Sexies|Sextus|Septies|Septimus|Octies|Nonies|Nonus|Decies|Undecies|Duodecies|Duodecimus)\b)(?=[A-ZÁÉÍÓÚÑ])/i;
// Loose suffixed heading glued to body text ("Artículo 21 Bis 1. ..."): after the suffix there must be EOL, a terminator, a numeric list marker or an uppercase word; "Artículo 21 Bis de la ley" (lowercase tail) stays body text.
const noTermSuffix=/^[ \t]*(?:ART[ÍI]CULO|Art[íi]culo|ART\.|Art\.)\s+(\d+)[ \t]+(Bis|Ter|Qu[áa]ter|Quater|Quinquies|Quintus|Sexies|Sextus|Septies|Septimus|Octies|Nonies|Nonus|Decies|Undecies|Duodecies|Duodecimus)(?![a-záéíóúñ])(?:[ \t]+([IVXL]+)(?=[ \t]*[.,\-]))?(?=[ \t]*[.:]|[ \t]+\d+[.)]|[ \t]+[A-ZÁÉÍÓÚÑ(]|[ \t]*,[ \t]*\((?:DEROGADO|Derogado)|[ \t]*$)/i;
// Official period-less heading variant: the whole line is exactly "Artículo N" (seen in LGSMIME and Reg_Senado official PDFs). Accepted fail-closed: it can only open the body at article 1 or continue it strictly sequentially; anything else stays body text.
const bare=/^[ \t]*(?:ART[ÍI]CULO|Art[íi]culo)\s+(\d+)[ \t]*$/;
// Official period-less SUFFIXED heading variant: the whole line is exactly "Artículo N Sufijo" (seen in LGSMIME and Reg_Senado official PDFs). Accepted fail-closed: only right after its numeric base article; anything else stays body text and flags the document.
const bareSuffix=/^[ \t]*(?:ART[ÍI]CULO|Art[íi]culo)\s+(\d+)[ \t]+(Bis|Ter|Qu[áa]ter|Quater|Quinquies|Quintus|Sexies|Sextus|Septies|Septimus|Octies|Nonies|Nonus|Decies|Undecies|Duodecies|Duodecimus)(?:[ \t]+([IVXL]+|\d+))?[ \t]*$/i;
const suffixId=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const sentenceClosed=/[.…:;!?"'»)\]]\s*$|(?:\bDerogad[oa])\.?\s*$/;
function midSentenceFragment(lines,i,checkNext=true){
  let j=i-1;
  while(j>=0&&(amendment.test(lines[j].text)||editorialLine.test(lines[j].text)||reformNote.test(lines[j].text)||section.test(lines[j].text)||lines[j].secSkip))j--;
  if(j>=0&&!sentenceClosed.test(lines[j].text))return true;
  if(!checkNext)return false;
  const next=lines[i+1];
  return Boolean(next&&headingPre.test(next.text)&&ARTICLE.test(next.text));
}
// True when the previous significant line closed its sentence (or nothing precedes), so a LIBRO/TÍTULO/CAPÍTULO/SECCIÓN line can be a real heading rather than a wrapped body line.
function prevClosed(lines,i){
  let j=i-1;
  while(j>=0&&(amendment.test(lines[j].text)||editorialLine.test(lines[j].text)||reformNote.test(lines[j].text)||section.test(lines[j].text)||lines[j].secSkip))j--;
  return j<0||sentenceClosed.test(lines[j].text);
}
// Trailing editorial headings that belong to the NEXT section but landed at the end of an article: title-case subtitles without final punctuation ("De las Licencias"), short ALL-CAPS headings, service/corps subtitles ("Servicio de Ingenieros"), single title-case words ("Generalidades"), and headings glued to their DOF amendment note. A trailing line WITH sentence-final punctuation is never trimmed.
const rubricTitle=/^(?:De (?:la|las|los|del)|Del) [A-ZÁÉÍÓÚÑ][^.:;!?"'»)\]]{0,59}$/;
const rubricAllCaps=/^(?=[A-ZÁÉÍÓÚÑ ,.'-]{8,90}$)(?!.*\.$)(?!(?:[^ ]* ){8})[A-ZÁÉÍÓÚÑ]+(?: [A-ZÁÉÍÓÚÑ0-9.'-]+)+$/;
const prevLineClosed=(lines,idx)=>idx<=0||/[.!?)]$/ .test(lines[idx-1].text.trim());
const rubricService=/^(?:Servicio|Cuerpo|Departamento|Direcci[óo]n|Subdirecci[óo]n|Jefatura|Unidad) (?:(?:de|del|de la|de las|de los) )?[A-ZÁÉÍÓÚÑ][^.:;!?"'»)\]]{0,55}$/;
const rubricSingleWord=/^(?:Generalidades|Disposiciones)$/;
const rubricGluedNote=/^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ,.'-]{6,90}(?:Secci[óo]n|Subsecci[óo]n|Cap[íi]tulo|T[íi]tulo|Apartado|Numeral|Inciso|Denominaci[óo]n) (?:adicionad[oa]|reformad[oa]|derogad[oa]|recorrid[oa]) DOF \d{2}-\d{2}-\d{4}$/;
const trailingRubric=line=>rubricTitle.test(line)||rubricAllCaps.test(line)||rubricService.test(line)||rubricSingleWord.test(line)||rubricGluedNote.test(line)||/^(?:DE LA CAPACIDAD|DE LOS COMERCIANTES|DE LA FORMA)$/i.test(line);
// Same rúbricas when the PDF text layer glues them onto the end of the last body line. Only cut at a sentence-close boundary (keeping the period); the ALL-CAPS variant requires lowercase in the preceding text so wrapped body sentences in all-caps documents are never cut.
const inlineRubricSuffix=line=>{
  let m=/\s([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ,.'()-]{6,89}(?:Secci[óo]n|Subsecci[óo]n|Cap[íi]tulo|T[íi]tulo|Apartado|Numeral|Inciso|Denominaci[óo]n) (?:adicionad[oa]|reformad[oa]|derogad[oa]|recorrid[oa]) DOF \d{2}-\d{2}-\d{4})$/.exec(line);
  if(m)return m;
  m=/ (Generalidades|Disposiciones)$/.exec(line);
  if(m&&/DOF \d{2}-\d{2}-\d{4}$/.test(line.slice(0,m.index)))return m;
  m=/[.!?] ((?:De (?:la|las|los|del)|Del) [A-ZÁÉÍÓÚÑ][^.:;!?"'»)\]]{2,59})$/.exec(line);
  if(m)return m;
  m=/[.!?] ((?:Servicio|Cuerpo|Departamento|Direcci[óo]n|Subdirecci[óo]n|Jefatura|Unidad) (?:(?:de|del|de la|de las|de los) )?[A-ZÁÉÍÓÚÑ][^.:;!?"'»)\]]{1,45})$/.exec(line);
  if(m)return m;
  m=/[.!?] ([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ,.'()-]{7,89})$/.exec(line);
  if(m&&!m[1].endsWith('.')&&m[1].includes(' ')&&(m[1].match(/ /g)||[]).length<=10&&/[a-záéíóúñ]/.test(line.slice(0,m.index)))return m;
  return null;
};

const RESOLUTIVO_ORDINALS=['PRIMERO','SEGUNDO','TERCERO','CUARTO','QUINTO','SEXTO','SEPTIMO','OCTAVO','NOVENO','DECIMO'];
function extractNonArticleRecords(lines,{versionId,versionDate,source,pdfSha256,declaredAmendedAt,retrievedAt,coverage,documentAnomalies}){
  const build=(kind,heads)=>{
    const recs=[];
    for(let i=0;i<heads.length;i++){
      const start=heads[i].index,end=i+1<heads.length?heads[i+1].index:lines.length;
      const bodyLines=[];let transitoryCut=false;
      for(const line of lines.slice(start,end)){if(transitory.test(line.text)){transitoryCut=true;break;}if(amendment.test(line.text)||editorialLine.test(line.text)){coverage.removedEditorialLines++;continue;}bodyLines.push(line);}
      if(transitoryCut){coverage.nonArticleTransitoryOmitted=true;documentAnomalies.push('non-article-transitory-content-not-structured');}
      let text=normalize(bodyLines.map(l=>l.text).join(' '));
      let inlinePops=0;while(inlinePops<2){const m=inlineRubricSuffix(text);if(!m)break;const cut=/^[.!?]/.test(m[0])?m.index+1:m.index;text=text.slice(0,cut).trimEnd();inlinePops++;coverage.removedTrailingRubrics++;}
      if(text.length<60)return null; // fail-closed: a thin section means the class guess was wrong
      recs.push({id:`${versionId}:${kind}:${i+1}`,lawId:source.lawId,lawTitle:source.title,versionId,versionDate,articleId:null,recordKind:kind,ordinalLabel:heads[i].label??null,headingTitle:heads[i].title??null,text,sourceUrl:source.url,publisher:source.authority,jurisdiction:source.jurisdiction,language:'es',pdfSha256,textSha256:digest(text),contentSha256:digest(text),sourcePages:[...new Set(bodyLines.map(x=>x.page))],declaredAmendedAt,effectiveAt:null,retrievedAt,split:splitForLaw(source.lawId),splitGroup:source.lawId,quality:{status:'quarantined',anomalies:['non-article-'+kind+'-record'],legalAccuracy:'not-evaluated',currentness:'unverified',extraction:'deterministic-pdf-text-no-generated-content'},rights:source.reuseBasis,editorialNotes:[]});
    }
    return recs;
  };
  const principioHead=/^\s*(\d+)\.\-\s+([A-ZÁÉÍÓÚÑ][^.\n]{1,58}[A-Za-záéíóúñ\)])\.\s*$/;
  const pHeads=[];for(let i=0;i<lines.length;i++){const m=principioHead.exec(lines[i].text);if(m&&Number(m[1])===pHeads.length+1)pHeads.push({index:i,title:m[2].trim(),label:m[1]});}
  if(pHeads.length>=3){const recs=build('principio',pHeads);if(recs)return{kind:'principios',records:recs};}
  // capitulos numerados: "1. TRÁMITES Y SERVICIOS" (all-caps chapter headings,
  // no trailing period required). The all-caps gate excludes numbered
  // enumerations ("1. Constitución Política...") which are lists, not chapters.
  const capituloHead=/^\s*(\d+)\.\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 ,;()/\-]{3,70})\.?\s*$/;
  const cHeads=[];for(let i=0;i<lines.length;i++){const m=capituloHead.exec(lines[i].text);if(m&&Number(m[1])===cHeads.length+1)cHeads.push({index:i,title:m[2].trim(),label:m[1]});}
  if(cHeads.length>=3){const recs=build('capitulo',cHeads);if(recs)return{kind:'capitulos-numerados',records:recs};}
  const rHeads=[];for(let i=0;i<lines.length;i++){const m=/^\s*([A-ZÁÉÍÓÚÑa-záéíóúñ]+)\.\-?\s*$/.exec(lines[i].text);if(m&&folded(m[1])===RESOLUTIVO_ORDINALS[rHeads.length])rHeads.push({index:i,label:m[1]});}
  if(rHeads.length>=2){const recs=build('resolutivo',rHeads);if(recs)return{kind:'resolutivos',records:recs};}
  return null;
}

export function extractArticles(pages,source,{pdfSha256,retrievedAt}={}){
  const titleFold=folded(source.title);const lines=[];const rawLines=[];
  const coverage={pages:pages.length,rawCharacters:pages.reduce((n,p)=>n+p.text.length,0),removedHeaderLines:0,removedEditorialLines:0,removedSectionLines:0,removedSubtitleLines:0,removedTrailingRubrics:0,removedBulletGlyphs:0,keptAmbiguousStructuralLines:0,discardedSamples:[],operativeArticleCandidates:0,exportableArticles:0,transitoryStartPage:null};
  const cover=pages.slice(0,2).map(p=>p.text).join('\n');const date=/Últimas?\s+Reformas?(?:\s+publicadas?)?(?:\s+DOF)?\s+(\d{2})[-/](\d{2})[-/](\d{4})/i.exec(cover);const declaredAmendedAt=date?`${date[3]}-${date[2]}-${date[1]}`:null;
  const versionDate=declaredAmendedAt??retrievedAt.slice(0,10);const versionId=`${source.lawId}@${versionDate}+${pdfSha256.slice(0,16)}`;
  for(const p of pages){for(const line of p.text.split('\n')){const cleaned=normalize(line);const glyphCount=(cleaned.match(/\u00AC/g)||[]).length;const value=glyphCount?cleaned.replace(/\u00AC/g,' ').replace(/\s+/g,' ').trim():cleaned;if(glyphCount)coverage.removedBulletGlyphs+=glyphCount;if(!value)continue;rawLines.push({text:value,page:p.number});const upper=folded(value);
    if(upper===titleFold||/^CÁMARA DE DIPUTADOS/.test(value)||/^Secretaría General$|^Secretaría de Servicios Parlamentarios$|^Últimas?\s+Reformas?\s+DOF|^\d+ de \d+$/i.test(value)){coverage.removedHeaderLines++;continue;}lines.push({text:value,page:p.number});}}
  const records=[],documentAnomalies=[];let current=null,started=false,ended=false,pendingSection=false,sectionDiscard=0,numericStarted=false,lastOrd=0;const seen=new Set();
  // Two-pass mode gate: any strict numeric heading anywhere in the document selects numeric mode (byte-identical to v22); the ordinal path below only runs for documents with NO numeric headings at all, so preambles of modern laws ("ARTÍCULO PRIMERO.- Se expide…") can never poison numeric extraction.
  const ordinalEnabled=!lines.some(l=>headingPre.test(l.text)&&(ARTICLE.test(l.text)||bare.test(l.text)));
  const sampleDiscard=(rule,line)=>{if(coverage.discardedSamples.length<50)coverage.discardedSamples.push({rule,page:line.page,line:line.text.slice(0,200)});};
  function finish(){if(!current)return;const anomalies=[...(current.anomalies??[])];let rubricPops=0;while(current.lines.length&&rubricPops<2&&trailingRubric(current.lines.at(-1).text)&&prevLineClosed(current.lines,current.lines.length-1)){const removed=current.lines.pop();current.editorial.push(removed.text);coverage.removedTrailingRubrics++;rubricPops++;sampleDiscard('trailing-rubric',removed);}
    const body=current.lines.map(x=>x.text);let text=normalize(body.join(' '));
    let inlinePops=0;while(inlinePops<2){const m=inlineRubricSuffix(text);if(!m)break;const cut=/^[.!?]/.test(m[0])?m.index+1:m.index;const note=text.slice(cut).trim();text=text.slice(0,cut).trimEnd();current.editorial.push(note);coverage.removedTrailingRubrics++;inlinePops++;sampleDiscard('trailing-rubric-inline',{page:current.lines.at(-1)?.page??null,text:note});}
    const gluedDerogated=/\s+(Derogad[oa]\.?)\s+((?:De (?:la|las|los|del)|Del) [A-ZÁÉÍÓÚÑ][^.:;!?"'»)\]]{0,59}|Generalidades)$/.exec(text);if(gluedDerogated){text=text.slice(0,gluedDerogated.index)+' '+gluedDerogated[1];current.editorial.push(gluedDerogated[2]);coverage.removedTrailingRubrics++;coverage.discardedSamples.push({rule:'trailing-rubric',page:current.lines.at(-1)?.page??null,line:gluedDerogated[2].slice(0,200)});}
    if(text.length<60)anomalies.push('too-short-for-structural-export');if(/\uFFFD|Secretaría General|CÁMARA DE DIPUTADOS/.test(text))anomalies.push('extraction-artifact');if(text.length>60000)anomalies.push('article-exceeds-60000-characters');if(/(?:\bSe deroga\b|\bDerogado\b)/i.test(text)&&text.length<140)anomalies.push('repealed-marker-not-training-example');
    if(seen.has(current.articleId))anomalies.push('duplicate-article-identifier');seen.add(current.articleId);
    const content=text.replace(ARTICLE,'').trim();
    records.push({id:`${versionId}:art:${current.articleId}`,lawId:source.lawId,lawTitle:source.title,versionId,versionDate,articleId:current.articleId,text,sourceUrl:source.url,publisher:source.authority,jurisdiction:source.jurisdiction,language:'es',pdfSha256,textSha256:digest(text),contentSha256:digest(content),sourcePages:[...new Set(current.lines.map(x=>x.page))],declaredAmendedAt,effectiveAt:null,retrievedAt,split:splitForLaw(source.lawId),splitGroup:source.lawId,quality:{status:anomalies.length?'quarantined':'structurally-verified',anomalies,legalAccuracy:'not-evaluated',currentness:'unverified',extraction:'deterministic-pdf-text-no-generated-content'},rights:source.reuseBasis,editorialNotes:current.editorial});current=null;}
  for(let li=0;li<lines.length;li++){const line=lines[li];
    if(started&&transitory.test(line.text)){finish();coverage.transitoryStartPage=line.page;ended=true;break;}
    if(current&&/^Nota\s*:/i.test(line.text)){current.note=true;current.anomalies=['publisher-note-requires-manual-segmentation'];current.editorial.push(line.text);continue;}
    const match=headingPre.test(line.text)?ARTICLE.exec(line.text):null;
    if(current?.note&&(!match||Number(match[1])<=Number(current.articleId.split('-')[0]))){current.editorial.push(line.text);continue;}
    if(match){
      const rest=line.text.slice(match[0].length);
      if((rest.trim()===''||match[0].endsWith('('))&&midSentenceFragment(lines,li)){if(current)current.lines.push(line);continue;}
      finish();started=true;numericStarted=true;pendingSection=false;const articleId=[match[1],match[2]?.toUpperCase(),match[3]?.toUpperCase(),match[4]?.toUpperCase(),match[5]?.toUpperCase()].filter(Boolean).join('-');
      if(seen.has(articleId)){documentAnomalies.push('operative-numbering-restarts-before-transitory-boundary');coverage.stoppedAt={page:line.page,line:line.text.slice(0,300),articleId};ended=true;break;}
      current={articleId,lines:[line],editorial:[]};continue;}
    if(!match&&current){
      const looseS=noTermSuffix.exec(line.text);
      if(looseS){
        const base=Number(current.articleId.split('-')[0]);
        if(Number(looseS[1])===base&&!midSentenceFragment(lines,li,false)){
          finish();pendingSection=false;sectionDiscard=0;numericStarted=true;const looseId=looseS[1]+'-'+suffixId(looseS[2])+(looseS[3]?'-'+looseS[3].toUpperCase():'');
          if(seen.has(looseId)){documentAnomalies.push('operative-numbering-restarts-before-transitory-boundary');coverage.stoppedAt={page:line.page,line:line.text.slice(0,300),articleId:looseId};ended=true;break;}
          current={articleId:looseId,lines:[line],editorial:[]};continue;
        }
        if(!midSentenceFragment(lines,li,false)&&!documentAnomalies.includes('unmatched-suffixed-heading-in-body'))documentAnomalies.push('unmatched-suffixed-heading-in-body');
      }
      const loose=noTerm.exec(line.text);
      if(loose&&Number(loose[1])===Number(current.articleId.split('-')[0])+1&&!midSentenceFragment(lines,li,false)){
        finish();pendingSection=false;sectionDiscard=0;numericStarted=true;const looseId=loose[1];
        if(seen.has(looseId)){documentAnomalies.push('operative-numbering-restarts-before-transitory-boundary');coverage.stoppedAt={page:line.page,line:line.text.slice(0,300),articleId:looseId};ended=true;break;}
        current={articleId:looseId,lines:[line],editorial:[]};continue;
      }
    }
    if(!match){
      const bareMatch=bare.exec(line.text);
      if(bareMatch){
        const bareNumber=Number(bareMatch[1]);
        const currentNumber=current?Number(current.articleId.split('-')[0]):null;
        if((!started&&bareNumber===1)||(current&&bareNumber===currentNumber+1)){
          finish();started=true;numericStarted=true;pendingSection=false;sectionDiscard=0;const bareId=bareMatch[1];
          if(seen.has(bareId)){documentAnomalies.push('operative-numbering-restarts-before-transitory-boundary');coverage.stoppedAt={page:line.page,line:line.text.slice(0,300),articleId:bareId};ended=true;break;}
          current={articleId:bareId,lines:[line],editorial:[]};continue;
        }
      }
      const bareSuf=bareSuffix.exec(line.text);
      if(bareSuf){
        const base=current?Number(current.articleId.split('-')[0]):null;
        if(started&&current&&Number(bareSuf[1])===base){
          finish();pendingSection=false;sectionDiscard=0;numericStarted=true;const sufId=bareSuf[1]+'-'+suffixId(bareSuf[2])+(bareSuf[3]?'-'+bareSuf[3].toUpperCase():'');
          if(seen.has(sufId)){documentAnomalies.push('operative-numbering-restarts-before-transitory-boundary');coverage.stoppedAt={page:line.page,line:line.text.slice(0,300),articleId:sufId};ended=true;break;}
          current={articleId:sufId,lines:[line],editorial:[]};continue;
        }
        if(!documentAnomalies.includes('unmatched-suffixed-heading-in-body'))documentAnomalies.push('unmatched-suffixed-heading-in-body');
      }
    }
    if(!match&&ordinalEnabled&&!numericStarted){
      const range=ordinalRange.exec(line.text);
      if(range){
        const n1=ordinalValue(range[1]),n2=ordinalValue(range[2]);
        if(n1&&n2&&n2>n1&&n1===lastOrd+1){
          finish();started=true;pendingSection=false;sectionDiscard=0;const rangeId=n1+'-'+n2;
          if(seen.has(rangeId)){documentAnomalies.push('operative-numbering-restarts-before-transitory-boundary');coverage.stoppedAt={page:line.page,line:line.text.slice(0,300),articleId:rangeId};ended=true;break;}
          if(!documentAnomalies.includes('ordinal-range-heading-single-record'))documentAnomalies.push('ordinal-range-heading-single-record');
          current={articleId:rangeId,lines:[line],editorial:[]};lastOrd=n2;continue;
        }
      }else{
        const ordM=ordinalHeading.exec(line.text)||ordinalHeadingTC.exec(line.text);
        if(ordM){
          const n=ordinalValue(ordM[1]);
          if(n&&n===lastOrd+1){
            finish();started=true;pendingSection=false;sectionDiscard=0;const ordId=String(n);
            if(seen.has(ordId)){documentAnomalies.push('operative-numbering-restarts-before-transitory-boundary');coverage.stoppedAt={page:line.page,line:line.text.slice(0,300),articleId:ordId};ended=true;break;}
            if(ordinalHeadingTC.test(line.text)&&!documentAnomalies.includes('titlecase-ordinal-heading-mode'))documentAnomalies.push('titlecase-ordinal-heading-mode');
            current={articleId:ordId,lines:[line],editorial:[]};lastOrd=n;continue;
          }
        }
        const revM=reversedOrdinal.exec(line.text);
        if(revM){
          const n=Number(revM[1]);
          if(n===lastOrd+1){
            finish();started=true;pendingSection=false;sectionDiscard=0;const revId=String(n);
            if(seen.has(revId)){documentAnomalies.push('operative-numbering-restarts-before-transitory-boundary');coverage.stoppedAt={page:line.page,line:line.text.slice(0,300),articleId:revId};ended=true;break;}
            if(!documentAnomalies.includes('reversed-ordinal-heading-mode'))documentAnomalies.push('reversed-ordinal-heading-mode');
            current={articleId:revId,lines:[line],editorial:[]};lastOrd=n;continue;
          }
        }
        const nsM=nospaceHeading.exec(line.text);
        if(nsM){
          const n=Number(nsM[1]);
          if(n===lastOrd+1){
            finish();started=true;pendingSection=false;sectionDiscard=0;const nsId=String(n);
            if(seen.has(nsId)){documentAnomalies.push('operative-numbering-restarts-before-transitory-boundary');coverage.stoppedAt={page:line.page,line:line.text.slice(0,300),articleId:nsId};ended=true;break;}
            if(!documentAnomalies.includes('nospace-heading-mode'))documentAnomalies.push('nospace-heading-mode');
            current={articleId:nsId,lines:[line],editorial:[]};lastOrd=n;continue;
          }
        }
      }
    }
    if(!started||!current)continue;
    if(amendment.test(line.text)||editorialLine.test(line.text)){coverage.removedEditorialLines++;current.editorial.push(line.text);continue;}
    if(section.test(line.text)){
      if(prevClosed(lines,li)||!/[a-záéíóúñ]/.test(line.text)){coverage.removedSectionLines++;sampleDiscard('section-heading',line);pendingSection=true;sectionDiscard=0;continue;}
      coverage.keptAmbiguousStructuralLines++;sampleDiscard('ambiguous-structural-kept-as-body',line);
      if(!documentAnomalies.includes('mid-sentence-structural-line-kept-as-body'))documentAnomalies.push('mid-sentence-structural-line-kept-as-body');
      current.lines.push(line);continue;
    }
    if(pendingSection){
      sectionDiscard++;
      if(sectionDiscard<=2){coverage.removedSubtitleLines++;sampleDiscard('section-subtitle',line);line.secSkip=true;continue;}
      if(!documentAnomalies.includes('section-discard-exceeded-2-lines'))documentAnomalies.push('section-discard-exceeded-2-lines');
      pendingSection=false;current.lines.push(line);continue;
    }
    if(reformNote.test(line.text)){coverage.removedEditorialLines++;continue;}
    current.lines.push(line);
  }
  if(!ended){finish();documentAnomalies.push('no-explicit-transitory-boundary');}
  coverage.operativeArticleCandidates=records.length;
  if(!records.length){
    const nonArticle=extractNonArticleRecords(lines,{versionId,versionDate,source,pdfSha256,declaredAmendedAt,retrievedAt,coverage,documentAnomalies});
    if(nonArticle){records.push(...nonArticle.records);coverage.nonArticleClass=nonArticle.kind;documentAnomalies.push('non-article-document-class:'+nonArticle.kind);}
    else documentAnomalies.push('no-numeric-article-headings');
  }
  if(documentAnomalies.length)for(const record of records){record.quality.status='quarantined';record.quality.anomalies.push(...documentAnomalies);}
  coverage.exportableArticles=records.filter(r=>r.quality.status==='structurally-verified').length;
  return {schemaVersion:1,extractorVersion:EXTRACTOR_VERSION,lawId:source.lawId,versionId,pdfSha256,sourceUrl:source.url,retrievedAt,declaredAmendedAt,coverage,documentAnomalies,records};
}

let ocrToolsCache;
export function detectOcrTools(env=process.env){
  if(env===process.env&&ocrToolsCache)return ocrToolsCache;
  const probe=(command,args)=>{try{const result=spawnSync(command,args,{env,encoding:'utf8',timeout:10000});return{ok:!result.error,stdout:result.stdout??'',stderr:result.stderr??''};}catch{return{ok:false,stdout:'',stderr:''};}};
  const render=probe('pdftoppm',['-v']);
  const version=probe('tesseract',['--version']);
  const languages=version.ok?probe('tesseract',['--list-langs']):{ok:false,stdout:''};
  const languageList=languages.stdout.split('\n').map(line=>line.trim()).filter(line=>line&&!line.startsWith('List of'));
  const lang=languageList.includes('spa')?'spa':(languageList.includes('eng')?'eng':null);
  const tools={available:render.ok&&languages.ok&&!!lang,renderer:render.ok,engine:'tesseract',engineVersion:(version.stdout.split('\n')[0]||'unknown').trim(),languages:languageList,lang};
  if(env===process.env)ocrToolsCache=tools;
  return tools;
}

async function ocrPdfPages(file,pageCount,tools,{cacheKey=null}={}){
  const execFileAsync=promisify(execFile);
  const dir=await mkdtemp(path.join(os.tmpdir(),'lex-ocr-'));
  // Page texts cache outside the temp dir when LEX_OCR_CACHE_DIR is set and the
  // caller supplies a content key (the snapshot sha256): a killed attempt resumes
  // instead of restarting, which keeps long scanned documents reachable in bounded
  // runs. Cache entries are keyed by page, dpi and language.
  const cacheDir=cacheKey&&process.env.LEX_OCR_CACHE_DIR?path.join(process.env.LEX_OCR_CACHE_DIR,cacheKey):null;
  if(cacheDir)await mkdir(cacheDir,{recursive:true,mode:0o700});
  try{
    const capped=Math.min(pageCount,OCR_PAGE_CAP);
    // Render and OCR page by page, only for pages not already cached: an attempt
    // killed by the acquisition time budget still leaves every finished page in
    // the cache (atomic tmp+rename), so retries resume instead of restarting.
    const one=async number=>{
      const cacheFile=cacheDir?path.join(cacheDir,`p${number}-${OCR_DPI}-${tools.lang}.txt`):null;
      if(cacheFile){
        const cached=await readFile(cacheFile,'utf8').catch(()=>undefined);
        if(cached!==undefined)return{number,text:cached};
      }
      const image=path.join(dir,`page-${number}`);
      await execFileAsync('pdftoppm',['-r',String(OCR_DPI),'-gray','-png','-f',String(number),'-l',String(number),file,image],{timeout:30000,maxBuffer:1<<20});
      const rendered=(await readdir(dir)).find(name=>name.startsWith(`page-${number}-`)&&name.endsWith('.png'));
      if(!rendered)throw new Error(`OCR render coverage incomplete at page ${number}`);
      const base=path.join(dir,'ocr-'+number);
      await execFileAsync('tesseract',[path.join(dir,rendered),base,'-l',tools.lang,'--dpi',String(OCR_DPI)],{timeout:OCR_PAGE_TIMEOUT_MS,maxBuffer:1<<22});
      const text=await readFile(base+'.txt','utf8');
      if(cacheFile){const tmp=cacheFile+'.tmp-'+randomUUID();await writeFile(tmp,text,{mode:0o600});await rename(tmp,cacheFile);}
      await unlink(path.join(dir,rendered)).catch(()=>{});await unlink(base+'.txt').catch(()=>{});
      return{number,text};
    };
    const pages=[];let next=1;
    const workers=Array.from({length:3},async()=>{while(next<=capped){const number=next++;pages.push(await one(number));}});
    await Promise.all(workers);
    pages.sort((a,b)=>a.number-b.number);
    return pages;
  }finally{await rm(dir,{recursive:true,force:true}).catch(()=>{});}
}

// OCR-path-only repair: tesseract fuses the ordinal suffix in headings like
// 'Artículo 2o.-' into 'Artículo 20.-'. When the running sequence expects n and a
// line-start heading reads exactly n*10, the trailing zero is the fused suffix;
// rewrite it to the expected number. Mid-line references never match (^ anchor).
// Every repair is recorded as a document anomaly and records stay quarantined.
function repairOcrArticleHeadings(pages){
  let expected=1,repaired=0,commaRepaired=0;
  const heading=/^(\s*ART[ÍI]CULO\s+)(\d+)(o)?([\.\-].*)$/i;
  const commaHeading=/^(\s*ART[ÍI]CULO\s+)(\d+)(o)?(, )([A-ZÁÉÍÓÚÑ].*)$/i;
  for(const page of pages){
    page.text=page.text.split('\n').map(line=>{
      const match=heading.exec(line);
      if(match){
        const n=Number(match[2]);
        if(n===expected){expected=n+1;return line;}
        if(!match[3]&&n===expected*10){expected++;repaired++;return `${match[1]}${expected-1}o${match[4]}`;}
        return line;
      }
      const comma=commaHeading.exec(line);
      if(comma&&Number(comma[2])===expected){expected++;commaRepaired++;return `${comma[1]}${comma[2]}${comma[3]??''}. ${comma[5]}`;}
      return line;
    }).join('\n');
  }
  return {repaired,commaRepaired};}

export async function parsePdfInWorker(file,source,metadata){
  return new Promise((resolve,reject)=>{const worker=new Worker(new URL(import.meta.url),{execArgv:[],workerData:{kind:'extract-legal-library',file,source,metadata},resourceLimits:{maxOldGenerationSizeMb:768}});let settled=false;let timer;
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);void worker.terminate();error?reject(error):resolve(value);};
    const arm=ms=>{clearTimeout(timer);timer=setTimeout(()=>finish(new Error(`PDF extraction timeout after ${Math.round(ms/1000)} seconds`)),ms);};
    arm(120000);
    worker.on('message',m=>{if(m&&m.progress==='ocr'&&Number.isInteger(m.pages)){arm(Math.min(OCR_MAX_TOTAL_MS,120000+m.pages*OCR_MS_PER_PAGE));return;}m.error?finish(new Error(m.error)):finish(null,m.result);});
    worker.on('error',e=>finish(e));worker.on('exit',code=>{if(!settled)finish(new Error(`Extractor exited without result (${code})`));});});
}

const PRIORITY=['cpeum','ccf','ccom','cff','cpf','cnpp','cnpcf','lamp','lft','lfpc','lfda','lfpa','lfpca','lfpdppp','lgsm','lgtoc','lic','liva','lisr','lss','linfonavit','lfce','lpi','lfpp','lgra','lga','lgtaip','lgps','lgahotdu','lgcc','lan','lgen','lgs','lgvs','lgeepa','la','laf','lgsc','lcpaf','lfd'];
export function selectSources(catalog,limit=40){const rank=id=>{const i=PRIORITY.indexOf(id);return i<0?1000:i;};return [...catalog.sources].sort((a,b)=>rank(a.id)-rank(b.id)||a.id.localeCompare(b.id)).slice(0,limit);}

export async function exportLibrary(extractions,outputDir){
  const eligible=extractions.flatMap(x=>x.records).filter(r=>r.quality.status==='structurally-verified');const groups=new Map();for(const row of eligible){const values=groups.get(row.contentSha256)??[];values.push(row);groups.set(row.contentSha256,values);}
  const rows=[],excluded=[];for(const records of groups.values()){if(new Set(records.map(x=>x.split)).size>1){excluded.push(...records.map(x=>({id:x.id,reason:'exact-content-duplicate-across-splits'})));continue;}rows.push(records[0]);excluded.push(...records.slice(1).map(x=>({id:x.id,reason:'exact-content-duplicate-within-split'})));}
  rows.sort((a,b)=>a.id.localeCompare(b.id));await mkdir(outputDir,{recursive:true});
  for(const split of ['train','validation','test'])await atomic(path.join(outputDir,split+'.jsonl'),rows.filter(x=>x.split===split).map(x=>JSON.stringify(x)).join('\n')+'\n');
  await atomic(path.join(outputDir,'corpus.jsonl'),rows.map(x=>JSON.stringify(x)).join('\n')+'\n');await atomic(path.join(outputDir,'excluded.json'),excluded);
  const report={schemaVersion:1,createdAt:new Date().toISOString(),laws:new Set(rows.map(x=>x.lawId)).size,articles:rows.length,exactDuplicateExclusions:excluded.length,splits:Object.fromEntries(['train','validation','test'].map(s=>[s,{laws:new Set(rows.filter(x=>x.split===s).map(x=>x.lawId)).size,articles:rows.filter(x=>x.split===s).length}])),partitionRule:'sha256(lex-law-split-v1:lawId) mod100, 80/10/10; all versions of a law share partition',trainingUse:'Source text only. Do not treat model-generated text or retrieval interpretations as true labels. No professional legal validation.'};await atomic(path.join(outputDir,'manifest.json'),report);return report;
}

export async function ingestLibrary({catalog,outputDir,limit=40,download=true,fetchImpl=fetch,maxTotalBytes=1024**3,extractor=parsePdfInWorker,sleep=pause}={}){
  if(!Number.isInteger(limit)||limit<1||limit>500)throw new Error('limit must be 1..500');await mkdir(outputDir,{recursive:true});
  const lockPath=path.join(outputDir,'ingest.lock');let handle;try{handle=await open(lockPath,'wx',0o600);await handle.writeFile(JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));await handle.close();}catch(e){if(e.code==='EEXIST')throw new Error('Library ingest already running or stale lock requires explicit review.');throw e;}
  const status={schemaVersion:1,state:'running',startedAt:new Date().toISOString(),catalogTotal:catalog.sources.length,requestedLimit:limit,phase:'download',sources:[],summary:{downloadedLaws:0,extractedLaws:0,failedLaws:0,quarantinedArticles:0,exportableArticles:0}};
  try{
    const disk=await statfs(outputDir);if(Number(disk.bavail)*Number(disk.bsize)<2*1024**3)throw new Error('At least 2GiB free required.');
    const selected=selectSources(catalog,limit);await atomic(path.join(outputDir,'status.json'),status);
    const acquisitionDir=path.join(outputDir,'acquisitions');
    if(download){for(let start=0;start<selected.length;start+=30){const batch=selected.slice(start,start+30);const before=await json(path.join(acquisitionDir,'manifest.json'),{sources:{}});const used=Object.values(before.sources).reduce((n,s)=>n+s.versions.reduce((m,v)=>m+v.bytes,0),0);if(used+batch.length*20*1024*1024>maxTotalBytes)throw new Error('Download budget insufficient for next bounded batch; snapshots preserved.');await runLegalSync({sources:batch,outputDir:acquisitionDir,fetchImpl,sleep,limits:{rateMs:2000,maxBytes:20*1024*1024,timeoutMs:45000,maxRetries:1}});const manifest=await json(path.join(acquisitionDir,'manifest.json'),{sources:{}});const total=Object.values(manifest.sources).reduce((n,s)=>n+s.versions.reduce((m,v)=>m+v.bytes,0),0);if(total>maxTotalBytes)throw new Error('Download budget reached; snapshots preserved for resume.');}}
    const manifest=await json(path.join(acquisitionDir,'manifest.json'),{sources:{}});status.phase='extract';const extractions=[];
    for(const source of selected){const stored=manifest.sources[source.id];const version=stored?.url===source.url?stored.versions.find(v=>v.sha256===stored.latestSha256):null;const entry={id:source.id,lawId:source.lawId,title:source.title,state:'pending'};
      try{if(!version)throw new Error('No downloaded version available');if(!/^[a-f0-9]{64}$/.test(version.sha256)||version.snapshotPath!==`snapshots/${source.id}/${version.sha256}.pdf`)throw new Error('Invalid snapshot path');const file=path.join(acquisitionDir,version.snapshotPath);const bytes=await readFile(file);if(digest(bytes)!==version.sha256)throw new Error('PDF hash mismatch');status.summary.downloadedLaws++;
        const extractedPath=path.join(outputDir,'extractions',source.id,version.sha256+'.json');let result=await json(extractedPath,null);
        if(!result||result.extractorVersion!==EXTRACTOR_VERSION){result=await extractor(file,source,{pdfSha256:version.sha256,retrievedAt:version.retrievedAt});await atomic(extractedPath,result);}
        if(result.pdfSha256!==version.sha256||result.lawId!==source.lawId||result.sourceUrl!==version.url||version.url!==source.url)throw new Error('Extraction provenance mismatch');extractions.push(result);entry.state=result.documentAnomalies.length?'quarantined':'extracted';entry.versionId=result.versionId;entry.pdfSha256=version.sha256;entry.coverage=result.coverage;entry.anomalies=result.documentAnomalies;status.summary.extractedLaws++;status.summary.quarantinedArticles+=result.records.filter(r=>r.quality.status!=='structurally-verified').length;status.summary.exportableArticles+=result.records.filter(r=>r.quality.status==='structurally-verified').length;
      }catch(e){entry.state='failed';entry.error=e.message;status.summary.failedLaws++;}status.sources.push(entry);await atomic(path.join(outputDir,'status.json'),status);
    }
    status.phase='export';status.export=await exportLibrary(extractions,path.join(outputDir,'exports'));status.state=status.summary.failedLaws||status.sources.some(s=>s.state==='quarantined')?'partial':'complete';status.phase='finished';status.finishedAt=new Date().toISOString();await atomic(path.join(outputDir,'status.json'),status);return status;
  }catch(e){status.state='failed';status.error=e.message;status.finishedAt=new Date().toISOString();await atomic(path.join(outputDir,'status.json'),status);throw e;}finally{await unlink(lockPath).catch(()=>{});}
}

if(!isMainThread&&workerData?.kind==='extract-legal-library'){
  try{const {default:pdf}=await import('pdf-parse/lib/pdf-parse.js');const bytes=await readFile(workerData.file);if(bytes.length>20*1024*1024)throw new Error('PDF too large');const pages=[];
    const result=await pdf(new Uint8Array(bytes),{max:EXTRACTOR_MAX_PAGES,pagerender:async page=>{const content=await page.getTextContent({normalizeWhitespace:false,disableCombineTextItems:false});let text='',lastY;for(const item of content.items){text+=(lastY===undefined||lastY===item.transform[5]?'':'\n')+item.str;lastY=item.transform[5];}pages.push({number:page.pageNumber,text});return text;}});
    if(result.numpages>EXTRACTOR_MAX_PAGES||pages.length!==result.numpages)throw new Error('PDF page coverage incomplete');pages.sort((a,b)=>a.number-b.number);
    let ocr=null;
    const digitalChars=pages.reduce((total,page)=>total+page.text.trim().length,0);
    if(digitalChars<pages.length*OCR_MIN_PAGE_CHARS){
      const tools=detectOcrTools();
      if(!tools.available)ocr={skipped:'ocr-tools-unavailable'};
      else if(pages.length>OCR_PAGE_CAP)ocr={skipped:'ocr-page-cap-exceeded',pages:pages.length,cap:OCR_PAGE_CAP};
      else{
        parentPort.postMessage({progress:'ocr',pages:pages.length});
        const sha=workerData.metadata?.pdfSha256;
        const ocrPages=await ocrPdfPages(workerData.file,pages.length,tools,{cacheKey:/^[a-f0-9]{64}$/.test(sha??'')?sha:null});
        const ocrChars=ocrPages.reduce((total,page)=>total+page.text.trim().length,0);
        ocr={engine:'tesseract',engineVersion:tools.engineVersion,lang:tools.lang,dpi:OCR_DPI,pages:ocrPages.length};
        if(ocrChars>digitalChars){pages.length=0;pages.push(...ocrPages);const fixes=repairOcrArticleHeadings(pages);ocr.repairedHeadings=fixes.repaired;if(fixes.commaRepaired)ocr.commaTerminatorRepaired=fixes.commaRepaired;}
        else ocr.outcome='no-text-recovered-digital-kept';
      }
    }
    const parsed=extractArticles(pages,workerData.source,workerData.metadata);
    if(ocr){parsed.coverage.ocr=ocr;if(!ocr.skipped&&ocr.outcome!=='no-text-recovered-digital-kept'){parsed.documentAnomalies.push('ocr-derived-text-layer');if(ocr.repairedHeadings)parsed.documentAnomalies.push('ocr-ordinal-suffix-fused-heading-repaired');if(ocr.commaTerminatorRepaired)parsed.documentAnomalies.push('ocr-comma-terminator-heading-repaired');for(const record of parsed.records){record.quality.status='quarantined';if(!record.quality.anomalies.includes('ocr-derived-text-layer'))record.quality.anomalies.push('ocr-derived-text-layer');}}}
    parentPort.postMessage({result:parsed});
  }catch(e){parentPort.postMessage({error:e.message});}
}

if(!isMainThread&&workerData?.kind==='extract-word-library'){
  try{
    const bytes=await readFile(workerData.file);if(bytes.length>20*1024*1024)throw new Error('Word document too large');
    const format=detectDocumentFormat(bytes);
    if(format!=='docx'&&format!=='doc')throw new Error('not a supported Word document');
    const pages=format==='docx'?await docxPages(bytes):await docPages(workerData.file);
    parentPort.postMessage({result:extractArticles(pages,workerData.source,workerData.metadata)});
  }catch(e){parentPort.postMessage({error:e.message});}
}
