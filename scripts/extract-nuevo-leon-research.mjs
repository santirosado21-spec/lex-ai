// Offline development research only. Never imported by the end-user client.
import {open,lstat,mkdir} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {canonicalJson} from '../server/canonical-json.mjs';

export const REPOSITORY_ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const CAPTURE_ROOT='artifacts/public-corpus/nl-pdfs-revision-01';
export const CAPTURE_REPORT_SHA256='888972f9e20cfc17f573ed43b37d23ab3c00db4efc2b963ed7b1483478759246';
export const HTML_REPORT_SHA256='05ad65a4b84f011905f6336e4b94cece7800ffb71c010e863bf542b5f503a719';
export const PARSER_VERSION='legal-library-17';
export const FROZEN_HASHES=Object.freeze({
  'server/legal-library.mjs':'b2e7bb70657a7bffd0f5b31da6d32405a6be43691683817b70d869ed35c017ed',
  'scripts/capture-nuevo-leon-pdfs.py':'dab58faebb598c3ce4b48333b1e618bb3a4ccda2ae4268f0ba3965be50b0f944',
  'scripts/inspect-nuevo-leon-links.py':'0294d183590c126bf7d6228f588b96968b320ec03828b3076b638de4016cbad7',
  'docs/architecture/nuevo-leon-pdf-research-v1.md':'9c17021c45cd95dc51a7f78644dc062bf4d468c987c1142eac0210654571ffcd',
  'docs/architecture/nuevo-leon-link-inspector-v1.md':'81eefeeffc64946c9fa043f70be308c19c6001236810dfad17444fbcdf325250',
  'docs/qa/nuevo-leon-pdf-capture-C1b3-freeze-2026-11-10.json':'5af6d8246548dcfab7e358ac14973e121c268d339ad4dc0ff2b9cbe2ad3930d4',
});
export const DOCUMENTS=Object.freeze([
  Object.freeze({id:'nl-civil',lawId:'MX-NLE-CIVIL',title:'CÓDIGO CIVIL PARA EL ESTADO DE NUEVO LEÓN',bytes:1779177,
    sha256:'a517709dd10664bbf7fc4ee77e32e4a0da7fdfbce45b662166dc706ead3c8af7',
    htmlSha256:'7ad6ac47640688a911f135a690080677f6e4e2cf5927e17e2d70637e601925c9',
    url:'https://www.hcnl.gob.mx/trabajo_legislativo/leyes/pdf/CODIGO%20CIVIL%20PARA%20EL%20ESTADO%20DE%20NUEVO%20LEON%20.pdf?2026-06-26',
    htmlUrl:'https://www.hcnl.gob.mx/trabajo_legislativo/leyes/codigos/codigo_civil_para_el_estado_de_nuevo_leon/'}),
  Object.freeze({id:'nl-penal',lawId:'MX-NLE-PENAL',title:'CÓDIGO PENAL PARA EL ESTADO DE NUEVO LEÓN',bytes:1222017,
    sha256:'440f28ca7515f63c35e5e9034086e843e126bed75f6d07dfe1067537607c3d76',
    htmlSha256:'f087c1a18f6784c0fa46ca9d7fae62dda745795109b226153ca481a09b57b356',
    url:'https://www.hcnl.gob.mx/trabajo_legislativo/leyes/pdf/CODIGO%20PENAL%20PARA%20EL%20ESTADO%20DE%20%20NUEVO%20LEON.pdf?2026-06-15',
    htmlUrl:'https://www.hcnl.gob.mx/trabajo_legislativo/leyes/codigos/codigo_penal_para_el_estado_de_nuevo_leon/'}),
]);
export const LIMITS=Object.freeze({maxDocuments:2,maxPdfBytes:10*1024*1024,maxTotalPdfBytes:20*1024*1024,
  maxPages:1200,maxRecords:20000,maxOutputBytes:64*1024*1024,workerTimeoutMs:120000,workerHeapMiB:768,maxBatchMs:300000,concurrency:1});
const hash=value=>createHash('sha256').update(value).digest('hex');
const fail=code=>Object.assign(new Error(code),{code});
const CATEGORIES=new Set(['input-integrity','source-drift','unsafe-path','parser-provenance','parser-result-invalid','parser-timeout','page-budget','record-budget','output-budget','duration-budget','pdf-byte-budget','pdf-signature-invalid','extract-failed','io-failure']);
const category=error=>CATEGORIES.has(error?.code)?error.code:'extract-failed';
const quarantine={status:'quarantined',rightsReview:'pending',textReview:'pending',legalReview:'pending',versionBindingReview:'pending',effectiveAt:null,published:false,indexed:false,trainingExported:false,approvedForAcquisition:false};
const stamp=()=>new Date().toISOString();

export function extractionPlan(){
  const body={schemaVersion:1,kind:'nl-offline-extraction-proposal',action:'plan',dataClass:'public-development',productionEnabled:false,
    captureRoot:CAPTURE_ROOT,captureReportSha256:CAPTURE_REPORT_SHA256,htmlReportSha256:HTML_REPORT_SHA256,
    documents:DOCUMENTS,sourceProtocolHashes:FROZEN_HASHES,parserVersion:PARSER_VERSION,limits:LIMITS,
    scope:'two pinned local public PDFs; offline extraction in quarantine; no promotion or training export',
    outputRoot:'artifacts/public-corpus',querySemantics:'opaque source href; not a legal date or version',...quarantine};
  return JSON.parse(canonicalJson({...body,proposalSha256:hash(canonicalJson(body))}));
}

async function safePath(root,relative,{createDirectories=false}={}){
  if(typeof relative!=='string'||path.isAbsolute(relative)||relative.split(/[\\/]/).some(p=>!p||p==='.'||p==='..'))throw fail('unsafe-path');
  const target=path.resolve(root,relative);
  if(!target.startsWith(path.resolve(root)+path.sep))throw fail('unsafe-path');
  const parsed=path.parse(target);let cursor=parsed.root;
  for(const segment of target.slice(parsed.root.length).split(path.sep)){
    cursor=path.join(cursor,segment);let info;
    try{info=await lstat(cursor);}catch(error){
      if(error.code==='ENOENT'&&createDirectories&&cursor!==target){try{await mkdir(cursor,{mode:0o700});}catch(e){if(e.code!=='EEXIST')throw fail('io-failure');}info=await lstat(cursor);}
      else if(error.code==='ENOENT'&&cursor===target)return target;
      else throw fail('unsafe-path');
    }
    if(info.isSymbolicLink()||(cursor!==target&&!info.isDirectory())||(cursor===target&&!info.isFile()&&!info.isDirectory()))throw fail('unsafe-path');
  }
  return target;
}

async function readBounded(root,relative,maximum){
  const file=await safePath(root,relative);let handle;
  try{
    handle=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);
    const stat=await handle.stat();if(!stat.isFile()||stat.size>maximum)throw fail('input-integrity');
    const buffer=Buffer.alloc(Math.min(stat.size+1,maximum+1));let size=0;
    while(size<buffer.length){const read=await handle.read(buffer,size,buffer.length-size,null);if(!read.bytesRead)break;size+=read.bytesRead;}
    if(size!==stat.size||size>maximum)throw fail('input-integrity');
    return buffer.subarray(0,size);
  }catch(error){throw CATEGORIES.has(error.code)?error:fail('input-integrity');}finally{await handle?.close();}
}
const parseJson=bytes=>{try{return JSON.parse(bytes.toString('utf8'));}catch{throw fail('input-integrity');}};
const same=(a,b)=>canonicalJson(a)===canonicalJson(b);
const iso=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;

function pinsFor(fixturePins,extractor){
  if(fixturePins===undefined)return {capture:CAPTURE_REPORT_SHA256,htmlReport:HTML_REPORT_SHA256,frozen:FROZEN_HASHES,documents:DOCUMENTS};
  // Synthetic tests may substitute hashes/byte counts only, never file paths/URLs or the real parser.
  if(typeof extractor!=='function')throw fail('source-drift');
  const pins=JSON.parse(canonicalJson(fixturePins));
  if(!same(Object.keys(pins).sort(),['capture','documents','frozen','htmlReport'])||!same(Object.keys(pins.frozen).sort(),Object.keys(FROZEN_HASHES).sort())||!Array.isArray(pins.documents)||pins.documents.length!==2)throw fail('source-drift');
  for(const [i,doc] of pins.documents.entries()){
    const fixed=DOCUMENTS[i];if(!same(Object.keys(doc).sort(),Object.keys(fixed).sort()))throw fail('source-drift');
    for(const key of ['id','lawId','title','url','htmlUrl'])if(doc[key]!==fixed[key])throw fail('source-drift');
    if(!Number.isSafeInteger(doc.bytes)||doc.bytes<=0||doc.bytes>LIMITS.maxPdfBytes)throw fail('pdf-byte-budget');
  }
  for(const value of [pins.capture,pins.htmlReport,...Object.values(pins.frozen),...pins.documents.flatMap(d=>[d.sha256,d.htmlSha256])])if(!/^[a-f0-9]{64}$/.test(value))throw fail('source-drift');
  return pins;
}

export async function verifyInputs({repositoryRoot=REPOSITORY_ROOT,fixturePins,extractor,limits=LIMITS}={}){
  const pins=pinsFor(fixturePins,extractor),ledger=[];
  async function verified(relative,expected,maximum){const bytes=await readBounded(repositoryRoot,relative,maximum);if(hash(bytes)!==expected)throw fail('input-integrity');ledger.push({path:relative,bytes:bytes.length,sha256:expected});return bytes;}
  for(const [file,digest] of Object.entries(pins.frozen))await verified(file,digest,1024*1024);
  const captureBytes=await verified(CAPTURE_ROOT+'/report.json',pins.capture,1024*1024),capture=parseJson(captureBytes);
  const htmlReportBytes=await verified(CAPTURE_ROOT+'/source-report.json',pins.htmlReport,1024*1024),htmlReport=parseJson(htmlReportBytes);
  if(capture.schemaVersion!==1||capture.state!=='complete-quarantine'||capture.productionEnabled!==false||capture.approvedForAcquisition!==false||capture.sourceReportSha256!==pins.htmlReport||capture.reviewedHelperSha256!==pins.frozen['scripts/inspect-nuevo-leon-links.py']||!Array.isArray(capture.documents)||capture.documents.length!==2||!Array.isArray(capture.requests)||capture.requests.length!==3||!Array.isArray(capture.sourceBindings)||capture.sourceBindings.length!==2)throw fail('source-drift');
  if(htmlReport.schemaVersion!==1||htmlReport.state!=='complete-quarantine')throw fail('source-drift');
  const robot=capture.requests[0];
  if(robot.url!=='https://www.hcnl.gob.mx/robots.txt'||robot.finalUrl!==robot.url||robot.mime!=='text/plain'||robot.status!==200||robot.snapshotPath!=='robots.txt'||robot.error!==null)throw fail('source-drift');
  const robots=await verified(CAPTURE_ROOT+'/robots.txt',robot.sha256,128*1024);if(robots.length!==robot.bodyBytes)throw fail('input-integrity');
  let total=0;const inputs=[];
  for(const [index,doc] of pins.documents.entries()){
    const entry=capture.documents[index],receipt=capture.requests[index+1],binding=capture.sourceBindings[index];
    if(entry.id!==doc.id||entry.url!==doc.url||entry.sha256!==doc.sha256||entry.bytes!==doc.bytes||entry.snapshotPath!==doc.id+'.pdf'||entry.state!=='captured-quarantine'||entry.extracted!==false||entry.published!==false||entry.indexed!==false||entry.approvedForAcquisition!==false||!same(entry.sourceBinding,binding))throw fail('source-drift');
    if(receipt.url!==doc.url||receipt.finalUrl!==doc.url||receipt.status!==200||receipt.mime!=='application/pdf'||receipt.sha256!==doc.sha256||receipt.bodyBytes!==doc.bytes||receipt.snapshotPath!==doc.id+'.pdf'||receipt.error!==null||!iso(receipt.finishedAt))throw fail('source-drift');
    if(binding.id!==doc.id||binding.url!==doc.url||binding.literal!==doc.url||binding.htmlUrl!==doc.htmlUrl||binding.htmlSha256!==doc.htmlSha256||binding.htmlLine!==556||binding.sourceReportSha256!==pins.htmlReport||binding.effectiveAt!==null||binding.versionBindingReview!=='pending')throw fail('source-drift');
    const html=await verified(CAPTURE_ROOT+'/source-'+doc.id+'.html',doc.htmlSha256,2*1024*1024);
    const htmlDoc=htmlReport.documents?.find(d=>d.id===doc.id),htmlReceipt=htmlReport.requests?.find(r=>r.url===doc.htmlUrl);
    if(htmlDoc?.url!==doc.htmlUrl||htmlDoc.snapshotSha256!==doc.htmlSha256||htmlReceipt?.sha256!==doc.htmlSha256||htmlReceipt.bodyBytes!==html.length||htmlReceipt.status!==200||htmlReceipt.mime!=='text/html'||htmlReceipt.finalUrl!==doc.htmlUrl||!html.toString('utf8').split(/\r?\n/)[555]?.includes(binding.rawStartTag)||!binding.rawStartTag?.includes('href="'+doc.url+'"'))throw fail('source-drift');
    const bytes=await readBounded(repositoryRoot,CAPTURE_ROOT+'/'+doc.id+'.pdf',limits.maxPdfBytes);
    if(!bytes.subarray(0,5).equals(Buffer.from('%PDF-')))throw fail('pdf-signature-invalid');
    if(bytes.length!==doc.bytes||hash(bytes)!==doc.sha256)throw fail('input-integrity');
    total+=bytes.length;if(total>limits.maxTotalPdfBytes)throw fail('pdf-byte-budget');
    ledger.push({path:CAPTURE_ROOT+'/'+doc.id+'.pdf',bytes:bytes.length,sha256:doc.sha256});
    inputs.push({doc,bytes,capturedAt:receipt.finishedAt,binding});
  }
  return {pins,inputs,ledger,captureBytes,htmlReportBytes};
}

function boundedStrings(value){if(!Array.isArray(value)||value.length>5000||value.some(s=>typeof s!=='string'||s.length>64000))throw fail('parser-result-invalid');return value;}
function declaredDate(value){if(value===null)return null;if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!iso(value+'T00:00:00.000Z'))throw fail('parser-result-invalid');return value;}
export function quarantineExtraction(raw,input,limits=LIMITS){
  const {doc,capturedAt,binding}=input;
  if(raw?.schemaVersion!==1||raw.extractorVersion!==17||raw.lawId!==doc.lawId||raw.pdfSha256!==doc.sha256||raw.sourceUrl!==doc.url||raw.retrievedAt!==capturedAt||typeof raw.versionId!=='string'||!raw.versionId.startsWith(doc.lawId+'@')||!raw.versionId.endsWith('+'+doc.sha256.slice(0,16)))throw fail('parser-provenance');
  if(!Array.isArray(raw.records)||!raw.coverage||!Number.isSafeInteger(raw.coverage.pages)||raw.coverage.pages<1)throw fail('parser-result-invalid');
  if(raw.coverage.pages>limits.maxPages)throw fail('page-budget');
  if(raw.records.length>limits.maxRecords)throw fail('record-budget');
  const amendedAt=declaredDate(raw.declaredAmendedAt),anomalies=boundedStrings(raw.documentAnomalies),versionId=doc.lawId+'@sha256:'+doc.sha256;
  const technicalDate=amendedAt??capturedAt.slice(0,10);
  if(raw.versionId!==doc.lawId+'@'+technicalDate+'+'+doc.sha256.slice(0,16))throw fail('parser-provenance');
  let textBytes=0;const seen=new Set();
  const records=raw.records.map((record,index)=>{
    if(record.pdfSha256!==doc.sha256||record.sourceUrl!==doc.url||record.lawId!==doc.lawId||record.lawTitle!==doc.title||record.publisher!=='H. Congreso del Estado de Nuevo León'||record.language!=='es'||record.jurisdiction!=='MX-NLE'||record.versionId!==raw.versionId||record.versionDate!==technicalDate||record.retrievedAt!==capturedAt||typeof record.id!=='string'||!record.id.startsWith(raw.versionId+':art:'))throw fail('parser-provenance');
    if(typeof record.text!=='string'||!record.text.trim()||hash(record.text)!==record.textSha256||!Array.isArray(record.sourcePages)||!record.sourcePages.length||record.sourcePages.some(p=>!Number.isSafeInteger(p)||p<1||p>raw.coverage.pages)||!['quarantined','structurally-verified'].includes(record.quality?.status)||seen.has(record.id))throw fail('parser-result-invalid');
    seen.add(record.id);textBytes+=Buffer.byteLength(record.text);if(textBytes>limits.maxOutputBytes)throw fail('output-budget');
    const declared=declaredDate(record.declaredAmendedAt);if(declared!==amendedAt)throw fail('parser-provenance');
    return {id:versionId+':record:'+(index+1),documentId:doc.id,lawId:doc.lawId,lawTitle:doc.title,jurisdiction:'MX-NLE',language:'es',
      versionId,articleId:record.articleId,text:record.text,textSha256:record.textSha256,pdfSha256:doc.sha256,
      sourceUrl:doc.url,sourcePages:record.sourcePages,pageReferencesSha256:hash(canonicalJson(record.sourcePages)),capturedAt,
      parserVersion:PARSER_VERSION,parserRecordId:record.id,parserTechnicalVersionDate:record.versionDate,
      declaredAmendedAt:declared,legalDateBasis:amendedAt?'unverified-parser-recognized-publisher-declaration':'unknown',
      parserDiagnostics:{status:record.quality.status,anomalies:boundedStrings(record.quality.anomalies),editorialNotes:boundedStrings(record.editorialNotes)},...quarantine};
  });
  const coverage=JSON.parse(canonicalJson(raw.coverage));coverage.structuralCandidateCount=coverage.exportableArticles??null;delete coverage.exportableArticles;
  for(const key of ['rawCharacters','removedHeaderLines','removedEditorialLines','operativeArticleCandidates'])if(!Number.isSafeInteger(coverage[key])||coverage[key]<0)throw fail('parser-result-invalid');
  if(coverage.operativeArticleCandidates!==records.length||!Number.isSafeInteger(coverage.structuralCandidateCount)||coverage.structuralCandidateCount<0||coverage.structuralCandidateCount>records.length)throw fail('parser-result-invalid');
  if(coverage.transitoryStartPage!==null&&(!Number.isSafeInteger(coverage.transitoryStartPage)||coverage.transitoryStartPage<1||coverage.transitoryStartPage>coverage.pages))throw fail('parser-result-invalid');
  return {schemaVersion:1,kind:'quarantined-state-research-extraction',documentId:doc.id,lawId:doc.lawId,versionId,
    sourceUrl:doc.url,pdfSha256:doc.sha256,capturedAt,sourceBinding:binding,parserVersion:PARSER_VERSION,
    parserVersionId:raw.versionId,parserTechnicalVersionDate:amendedAt??capturedAt.slice(0,10),
    parserDateBasis:amendedAt?'unverified-parser-recognized-publisher-declaration':'capture-date-fallback-not-legal-date',
    declaredAmendedAt:amendedAt,declaredPublicationAt:null,legalDateBasis:amendedAt?'unverified-publisher-declaration':'unknown',
    querySemantics:'opaque source href; never used as a legal date',coverage,documentAnomalies:anomalies,
    diagnostics:{records:records.length,recordsWithAnomalies:records.filter(r=>r.parserDiagnostics.anomalies.length).length,
      editorialNotes:records.reduce((n,r)=>n+r.parserDiagnostics.editorialNotes.length,0),
      missingNumericHeadings:records.length===0||anomalies.includes('no-numeric-article-headings'),
      transitoryBoundaryObserved:coverage.transitoryStartPage!==null,rawPageTextStored:false,
      fidelityReview:'not performed; page references do not attest raw text or full transitory coverage'},records,...quarantine};
}

async function immutableWrite(root,relative,bytes){
  const file=await safePath(root,relative);const handle=await open(file,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
  try{await handle.writeFile(bytes);await handle.sync();await handle.chmod(0o400);}finally{await handle.close();}
  return {path:relative,bytes:bytes.length,sha256:hash(bytes)};
}
async function defaultExtractor(file,source,metadata){const library=await import('../server/legal-library.mjs');if(library.EXTRACTOR_VERSION!==12)throw fail('source-drift');return library.parsePdfInWorker(file,source,metadata);}
function limited(values){const limits={...LIMITS,...values};if(Object.keys(limits).length!==Object.keys(LIMITS).length)throw fail('source-drift');for(const [key,max]of Object.entries(LIMITS))if(!Number.isSafeInteger(limits[key])||limits[key]<=0||limits[key]>max||(key==='concurrency'&&limits[key]!==1))throw fail('source-drift');return limits;}

export async function runResearchExtraction({outName,repositoryRoot=REPOSITORY_ROOT,extractor,fixturePins,bounds,clock=()=>performance.now(),now=stamp}={}){
  if(typeof outName!=='string'||!/^[a-z][a-z0-9-]{0,79}$/.test(outName))throw fail('unsafe-path');
  if(bounds!==undefined&&typeof extractor!=='function')throw fail('source-drift');
  if(repositoryRoot!==REPOSITORY_ROOT&&typeof extractor!=='function')throw fail('source-drift');
  const limits=limited(bounds),started=clock(),check=()=>{if(clock()-started>=limits.maxBatchMs)throw fail('duration-budget');};
  if(limits.maxDocuments!==DOCUMENTS.length)throw fail('source-drift');
  check();const verified=await verifyInputs({repositoryRoot,fixturePins,extractor,limits});check();
  const relative='artifacts/public-corpus/'+outName,output=await safePath(repositoryRoot,relative,{createDirectories:true});
  try{await mkdir(output,{mode:0o700});}catch{throw fail('unsafe-path');}
  const report={...extractionPlan(),action:'extract-offline',state:'running',startedAt:now(),artifactDirectory:relative,
    limits,inputLedger:verified.ledger,outputs:[],documents:[],notExtracted:[],networkRequests:0,parserInvocations:0,rawPageTextStored:false};
  const run=extractor??defaultExtractor;
  try{
    report.outputs.push(await immutableWrite(output,'source-capture-report.json',verified.captureBytes));
    report.outputs.push(await immutableWrite(output,'source-html-report.json',verified.htmlReportBytes));
    for(const input of verified.inputs){check();report.outputs.push(await immutableWrite(output,input.doc.id+'.pdf',input.bytes));}
    for(const input of verified.inputs){
      const {doc,capturedAt}=input;check();if(limits.maxBatchMs-(clock()-started)<limits.workerTimeoutMs)throw fail('duration-budget');
      try{
        const file=await safePath(output,doc.id+'.pdf');
        if(hash(await readBounded(output,doc.id+'.pdf',limits.maxPdfBytes))!==doc.sha256)throw fail('input-integrity');
        const source=Object.freeze({id:doc.id,lawId:doc.lawId,title:doc.title,url:doc.url,authority:'H. Congreso del Estado de Nuevo León',jurisdiction:'MX-NLE',language:'es',reuseBasis:{kind:'public-research-quarantine',scope:'Rights and commercial reuse pending; not approved corpus.'}});
        report.parserInvocations++;
        // The production function owns worker termination at 120s. Synthetic adapters
        // have an abortable timeout seam and are never allowed to select the real parser.
        let raw;
        if(extractor){const controller=new AbortController();let timer;try{raw=await Promise.race([run(file,source,{pdfSha256:doc.sha256,retrievedAt:capturedAt},{signal:controller.signal}),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(fail('parser-timeout'));},limits.workerTimeoutMs);})]);}finally{clearTimeout(timer);controller.abort();}}
        else raw=await run(file,source,{pdfSha256:doc.sha256,retrievedAt:capturedAt});
        check();if(hash(await readBounded(output,doc.id+'.pdf',limits.maxPdfBytes))!==doc.sha256)throw fail('input-integrity');
        const result=quarantineExtraction(raw,input,limits),bytes=Buffer.from(canonicalJson(result)+'\n');
        const used=report.outputs.filter(o=>o.path.endsWith('.extraction.json')).reduce((n,o)=>n+o.bytes,0);
        if(used+bytes.length>limits.maxOutputBytes)throw fail('output-budget');
        report.outputs.push(await immutableWrite(output,doc.id+'.extraction.json',bytes));
        report.documents.push({id:doc.id,state:'quarantined',extractionPath:doc.id+'.extraction.json',pdfSha256:doc.sha256,
          parserVersion:PARSER_VERSION,declaredAmendedAt:result.declaredAmendedAt,coverage:result.coverage,documentAnomalies:result.documentAnomalies,diagnostics:result.diagnostics,...quarantine});
      }catch(error){report.documents.push({id:doc.id,state:'failed',errorCategory:category(error),...quarantine});report.state='partial-quarantine';break;}
    }
    if(report.state==='running')report.state='complete-quarantine';
  }catch(error){report.state='partial-quarantine';report.errorCategory=category(error);}
  finally{
    const done=new Set(report.documents.filter(d=>d.extractionPath).map(d=>d.id));
    report.notExtracted=DOCUMENTS.filter(d=>!done.has(d.id)).map(d=>({id:d.id,state:'pending-offline-extraction'}));
    const extracted=report.documents.filter(d=>d.extractionPath);
    report.summary={planned:2,attempted:report.parserInvocations,extractedQuarantine:extracted.length,failed:report.documents.filter(d=>d.state==='failed').length,
      pages:extracted.reduce((n,d)=>n+d.coverage.pages,0),records:extracted.reduce((n,d)=>n+d.diagnostics.records,0),
      recordsWithAnomalies:extracted.reduce((n,d)=>n+d.diagnostics.recordsWithAnomalies,0),editorialNotes:extracted.reduce((n,d)=>n+d.diagnostics.editorialNotes,0),
      missingHeadingsDocuments:extracted.filter(d=>d.diagnostics.missingNumericHeadings).length,
      transitoryBoundaryDocuments:extracted.filter(d=>d.diagnostics.transitoryBoundaryObserved).length,
      newlyApprovedCorpusDocuments:0,published:0,indexed:0,trainingExported:0};
    report.finishedAt=now();report.elapsedMs=Math.max(0,clock()-started);
    await immutableWrite(output,'report.json',Buffer.from(canonicalJson(report)+'\n'));
  }
  return report;
}

export async function main(args=process.argv.slice(2)){
  if(args.length===0||same(args,['--plan'])){process.stdout.write(JSON.stringify(extractionPlan(),null,2)+'\n');return 0;}
  if(args.length!==3||args[0]!=='--extract'||args[1]!=='--out-name')throw fail('unsafe-path');
  const report=await runResearchExtraction({outName:args[2]});
  process.stdout.write(JSON.stringify({state:report.state,artifactDirectory:report.artifactDirectory,parserInvocations:report.parserInvocations,networkRequests:0})+'\n');
  return report.state==='complete-quarantine'?0:1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){main().then(code=>{process.exitCode=code;}).catch(error=>{process.stderr.write(category(error)+'\n');process.exitCode=2;});}
