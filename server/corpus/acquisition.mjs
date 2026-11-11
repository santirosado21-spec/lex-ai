// Opt-in public acquisition worker. Never imported by the end-user application.
import {mkdir,readFile,writeFile,rename,open,unlink,lstat,readdir} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import path from 'node:path';
import {runLegalSync,robotsPolicy} from '../legal-sync.mjs';
import {parsePdfInWorker,EXTRACTOR_VERSION} from '../legal-library.mjs';
import {verifyAcquisitionPlan} from './source-registry.mjs';

export const ACQUISITION_POLICY_VERSION='public-quarantine-v1';
const HASH=/^[a-f0-9]{64}$/;
const ID=/^[a-z][a-z0-9-]{0,39}$/;
const RESERVED_IDS=new Set(['constructor','prototype','__proto__','toString','valueOf']);
const hash=value=>createHash('sha256').update(value).digest('hex');
const jsonBytes=value=>JSON.stringify(value,null,2)+'\n';
const fail=code=>Object.assign(new Error(code),{code});
const categories=new Set(['cancelled','duration-budget','request-budget','byte-budget','document-byte-budget','request-timeout','redirect-denied','robots-blocked','robots-unavailable','http-error','invalid-pdf','network-error','extract-failed','extraction-invalid','integrity-error','snapshot-unavailable','source-drift','unsafe-output','locked']);
const errorCode=error=>categories.has(error?.code)?error.code:'extract-failed';
function abortableSleep(ms,signal){return new Promise((resolve,reject)=>{if(signal?.aborted){reject(fail('cancelled'));return;}const finish=()=>{signal?.removeEventListener('abort',abort);resolve();};const timer=setTimeout(finish,ms);const abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(fail('cancelled'));};signal?.addEventListener('abort',abort,{once:true});});}

// Dedicated directories only: reject symlinks (including ancestors) and special files.
async function safePath(root,relative='',{directory=false,create=false}={}){
  if(path.isAbsolute(relative)||relative.split(/[\\/]/).some(part=>part==='..'))throw fail('unsafe-output');
  const target=path.resolve(root,relative);
  if(target!==root&&!target.startsWith(root+path.sep))throw fail('unsafe-output');
  const parsed=path.parse(target);let current=parsed.root;
  for(const part of target.slice(parsed.root.length).split(path.sep).filter(Boolean)){
    current=path.join(current,part);let info;
    try{info=await lstat(current);}catch(error){if(error.code!=='ENOENT')throw error;if(create&&(current!==target||directory)){await mkdir(current,{mode:0o700});info=await lstat(current);}else continue;}
    if(info.isSymbolicLink()||(!info.isDirectory()&&!info.isFile())||(current!==target&&!info.isDirectory())||(current===target&&directory&&!info.isDirectory()))throw fail('unsafe-output');
  }
  return target;
}
async function checkTree(root,check=()=>{}){
  check();
  for(const entry of await readdir(root,{withFileTypes:true})){
    check();
    if(entry.isSymbolicLink()||(!entry.isDirectory()&&!entry.isFile()))throw fail('unsafe-output');
    if(entry.isDirectory())await checkTree(path.join(root,entry.name),check);
  }
}
async function readSafe(root,relative){const file=await safePath(root,relative);const handle=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);try{return await handle.readFile();}finally{await handle.close();}}
async function readJson(root,relative,fallback){try{return JSON.parse((await readSafe(root,relative)).toString('utf8'));}catch(error){if(error.code==='ENOENT')return fallback;throw fail('integrity-error');}}
async function atomic(root,relative,value){
  const file=await safePath(root,relative);await safePath(root,path.dirname(relative),{directory:true,create:true});
  const temp=file+'.'+randomUUID()+'.tmp';const handle=await open(temp,'wx',0o600);
  try{await handle.writeFile(jsonBytes(value));}finally{await handle.close();}
  try{await safePath(root,relative);await rename(temp,file);}finally{await unlink(temp).catch(()=>{});}
}
async function immutableJson(root,relative,value){
  const bytes=Buffer.from(jsonBytes(value));await safePath(root,path.dirname(relative),{directory:true,create:true});
  const file=await safePath(root,relative);let handle;
  try{handle=await open(file,'wx',0o600);await handle.writeFile(bytes);}catch(error){if(error.code!=='EEXIST')throw error;if(!(await readSafe(root,relative)).equals(bytes))throw fail('integrity-error');}finally{await handle?.close();}
  return hash(bytes);
}
async function acquireRoot(outputDir,check){
  if(typeof outputDir!=='string'||!outputDir.trim()||outputDir.split(/[\\/]/).includes('..'))throw fail('unsafe-output');
  const root=path.resolve(outputDir);if(root===path.parse(root).root)throw fail('unsafe-output');
  check();await safePath(root,'',{directory:true,create:true});await checkTree(root,check);
  const marker=await readJson(root,'owner.json',null);
  if(!marker){if((await readdir(root)).length)throw fail('unsafe-output');await immutableJson(root,'owner.json',{kind:'lex-public-acquisition',schemaVersion:1});}
  else if(marker.kind!=='lex-public-acquisition'||marker.schemaVersion!==1)throw fail('unsafe-output');
  let lock;try{lock=await open(path.join(root,'acquisition.lock'),'wx',0o600);await lock.writeFile(jsonBytes({pid:process.pid}));await lock.close();}catch(error){if(error.code==='EEXIST')throw fail('locked');throw error;}
  return {root,unlock:()=>unlink(path.join(root,'acquisition.lock'))};
}

function runController(limits,signal,sleep){
  const started=performance.now(),controller=new AbortController();let fatal=null;
  const stats={requests:0,decodedBodyBytes:0,elapsedMs:0};const origins=new Map(),delays=new Map();
  const stop=code=>{fatal??=code;controller.abort(fail(fatal));return fail(fatal);};
  const timer=setTimeout(()=>stop('duration-budget'),limits.maxDurationMs);
  const cancel=()=>stop('cancelled');signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
  function check(){if(signal?.aborted)throw stop('cancelled');if(performance.now()-started>=limits.maxDurationMs)throw stop('duration-budget');if(fatal)throw fail(fatal);}
  async function bounded(promise,requestSignal=controller.signal){
    check();if(requestSignal.aborted)throw fail(fatal??'request-timeout');
    let listener;try{return await Promise.race([promise,new Promise((_,reject)=>{listener=()=>reject(fail(fatal??(signal?.aborted?'cancelled':'request-timeout')));requestSignal.addEventListener('abort',listener,{once:true});})]);}catch(error){if(requestSignal.aborted)throw fail(fatal??(signal?.aborted?'cancelled':'request-timeout'));throw error;}finally{requestSignal.removeEventListener('abort',listener);}
  }
  async function pause(ms,pauseSignal=controller.signal){check();if(ms>0)await bounded(sleep(ms,pauseSignal),pauseSignal);check();}
  function consume(bytes,isDocument){stats.decodedBodyBytes+=bytes;if(stats.decodedBodyBytes>limits.maxTotalBytes)throw stop('byte-budget');if(isDocument>limits.maxDocumentBytes)throw fail('document-byte-budget');check();}
  function fetchFor(document,fetchImpl,receipt){
    const origin=new URL(document.url).origin,robotsUrl=origin+'/robots.txt';
    return async(url,options={})=>{
      check();const isRobots=url===robotsUrl;
      if(url!==document.url&&!isRobots)throw fail('redirect-denied');
      const requestSignal=AbortSignal.any([controller.signal,AbortSignal.timeout(limits.timeoutMs),...(options.signal?[options.signal]:[])]);
      const last=origins.get(origin);if(last!==undefined)await pause(Math.max(limits.rateMs,delays.get(origin)??0)-(performance.now()-last),requestSignal);
      check();if(stats.requests>=limits.maxRequests)throw stop('request-budget');stats.requests++;origins.set(origin,performance.now());
      let response;
      try{response=await bounded(Promise.resolve().then(()=>fetchImpl(url,{...options,signal:requestSignal,redirect:'manual'})),requestSignal);}catch(error){if(error.code)throw error;throw fail(requestSignal.aborted?(fatal??'request-timeout'):'network-error');}
      if(response.url&&response.url!==url){await response.body?.cancel();throw fail('redirect-denied');}
      const chunks=[];let size=0;const reader=response.body?.getReader();
      try{if(reader)while(true){const {done,value}=await bounded(reader.read(),requestSignal);if(done)break;size+=value.byteLength;consume(value.byteLength,isRobots?0:size);if(isRobots&&size>512000)throw fail('robots-unavailable');chunks.push(Buffer.from(value));}}
      catch(error){void reader?.cancel().catch(()=>{});throw error.code?error:fail('network-error');}finally{reader?.releaseLock();}
      const bytes=Buffer.concat(chunks);
      const mime=/^[a-z0-9.+-]+\/[a-z0-9.+-]+/i.exec(response.headers.get('content-type')??'')?.[0].toLowerCase()??null;
      receipt({url,status:response.status,kind:isRobots?'robots':'document',mime,decodedBodyBytes:bytes.length,bodySha256:hash(bytes)});
      if(isRobots){if(![200,404,410].includes(response.status))throw fail('robots-unavailable');const policy=robotsPolicy(response.status===200?bytes.toString('utf8'):'',document.url);if(!policy.allowed||policy.crawlDelayMs>60000)throw fail('robots-blocked');delays.set(origin,policy.crawlDelayMs);}
      if([301,302,303,307,308].includes(response.status)){
        const location=response.headers.get('location');let destination;try{destination=new URL(location,url).href;}catch{throw fail('redirect-denied');}
        // HTTP does not grant new destinations, even on an approved host.
        if(!location||destination!==url)throw fail('redirect-denied');
      }else if(!isRobots&&![200,304].includes(response.status))throw fail('http-error');
      if(!isRobots&&response.status===200&&!bytes.subarray(0,5).equals(Buffer.from('%PDF-')))throw fail('invalid-pdf');
      const headers=new Headers(response.headers);headers.delete('content-encoding');headers.delete('content-length');
      return new Response([204,205,304].includes(response.status)?null:bytes,{status:response.status,headers});
    };
  }
  return {stats,signal:controller.signal,check,bounded,pause,fetchFor,get fatal(){return fatal;},finish(){clearTimeout(timer);signal?.removeEventListener('abort',cancel);stats.elapsedMs=Math.round(performance.now()-started);}};
}

function defaultExtractor(file,source,metadata,{signal}){
  return new Promise((resolve,reject)=>{
    if(signal.aborted){reject(fail('cancelled'));return;}
    const worker=new Worker(new URL(import.meta.url),{execArgv:[],workerData:{kind:'public-acquisition-extract',file,source,metadata},resourceLimits:{maxOldGenerationSizeMb:768}});
    let settled=false;const finish=(error,result)=>{if(settled)return;settled=true;signal.removeEventListener('abort',abort);void worker.terminate();error?reject(error):resolve(result);};
    const abort=()=>finish(fail('cancelled'));signal.addEventListener('abort',abort,{once:true});
    worker.on('message',message=>message.ok?finish(null,message.result):finish(fail('extract-failed')));worker.on('error',()=>finish(fail('extract-failed')));worker.on('exit',()=>finish(fail('extract-failed')));
  });
}

function quarantine(result,document,version,configHash){
  if(result?.pdfSha256!==version.sha256||result?.sourceUrl!==document.url||!Array.isArray(result.records)||!result.records.length)throw fail('extraction-invalid');
  const versionId=`${document.id}@sha256:${version.sha256}`;
  const records=result.records.map((record,index)=>{
    if(typeof record.text!=='string'||!record.text.trim()||hash(record.text)!==record.textSha256||!Array.isArray(record.sourcePages)||!record.sourcePages.length||record.sourcePages.some(page=>!Number.isInteger(page)||page<1))throw fail('extraction-invalid');
    return {id:`${versionId}:record:${index+1}`,sourceId:document.sourceId,documentId:document.id,versionId,pdfSha256:version.sha256,sourceUrl:document.url,finalUrl:version.finalUrl,articleId:record.articleId??null,text:record.text,textSha256:hash(record.text),sourcePages:record.sourcePages,pageReferencesSha256:hash(JSON.stringify(record.sourcePages)),declaredAmendedAt:record.declaredAmendedAt??null,effectiveAt:null,capturedAt:version.retrievedAt,extractionDiagnostics:{parserStatus:record.quality?.status??'unknown',anomalies:record.quality?.anomalies??[],editorialNotes:record.editorialNotes??[]},textReview:'pending',legalReview:'pending',status:'quarantined',published:false,indexed:false};
  });
  const coverage=result.coverage?{...result.coverage,structuralCandidateCount:result.coverage.exportableArticles??null}:null;if(coverage)delete coverage.exportableArticles;
  return {schemaVersion:1,kind:'quarantined-public-extraction',configSha256:configHash,documentId:document.id,sourceId:document.sourceId,versionId,pdfSha256:version.sha256,sourceUrl:document.url,finalUrl:version.finalUrl,capturedAt:version.retrievedAt,declaredAmendedAt:result.declaredAmendedAt??null,effectiveAt:null,declaredPublicationAt:null,legalDateBasis:'unknown-unless-declared-in-source',textReview:'pending',legalReview:'pending',status:'quarantined',published:false,indexed:false,documentAnomalies:Array.isArray(result.documentAnomalies)?result.documentAnomalies:[],coverage,records};
}

async function verifyLedger(root,ledger,documents,check){
  if(ledger.schemaVersion!==1||!ledger.files||!ledger.documents||Array.isArray(ledger.files)||Array.isArray(ledger.documents))throw fail('integrity-error');
  for(const [relative,digest] of Object.entries(ledger.files)){check();if(!HASH.test(digest)||hash(await readSafe(root,relative))!==digest)throw fail('integrity-error');}
  for(const document of documents){if(!ID.test(document.id))throw fail('integrity-error');const existing=ledger.documents[document.id];if(existing&&(existing.url!==document.url||existing.sourceId!==document.sourceId))throw fail('source-drift');}
  const manifest=await readJson(root,'acquisitions/manifest.json',null);
  if(manifest&&!ledger.files['acquisitions/manifest.json'])throw fail('integrity-error');
  if(manifest)for(const [id,source] of Object.entries(manifest.sources??{})){
    if(!ID.test(id)||!ledger.documents[id]||source.url!==ledger.documents[id].url||!Array.isArray(source.versions))throw fail('integrity-error');
    for(const version of source.versions){const relative=`acquisitions/snapshots/${id}/${version.sha256}.pdf`;if(!HASH.test(version.sha256)||version.snapshotPath!==`snapshots/${id}/${version.sha256}.pdf`||version.url!==source.url||version.finalUrl!==source.url||ledger.files[relative]!==version.sha256)throw fail('integrity-error');}
  }
}
async function captureSync(root,ledger){
  const manifest=await readJson(root,'acquisitions/manifest.json',null);if(!manifest)return;
  for(const [id,source] of Object.entries(manifest.sources))for(const version of source.versions){const relative=`acquisitions/snapshots/${id}/${version.sha256}.pdf`;if(!HASH.test(version.sha256)||version.snapshotPath!==`snapshots/${id}/${version.sha256}.pdf`||version.url!==ledger.documents[id]?.url||version.finalUrl!==version.url||hash(await readSafe(root,relative))!==version.sha256)throw fail('integrity-error');ledger.files[relative]=version.sha256;}
  ledger.files['acquisitions/manifest.json']=hash(await readSafe(root,'acquisitions/manifest.json'));await atomic(root,'integrity.json',ledger);
}

export async function loadPublicAcquisitionReport({outputDir}={}){
  const root=path.resolve(outputDir);await safePath(root,'',{directory:true});await checkTree(root);return readJson(root,'report.json',null);
}

export async function runPublicAcquisition({plan,outputDir,mode='offline',fetchImpl=fetch,extractor=defaultExtractor,signal,sleep=abortableSleep,parserVersion=`legal-library-${EXTRACTOR_VERSION}`,policyVersion=ACQUISITION_POLICY_VERSION}={}){
  const verified=verifyAcquisitionPlan(plan);if(!['live','offline'].includes(mode))throw new Error('mode must be live or offline');
  if(verified.documents.some(document=>RESERVED_IDS.has(document.id)))throw fail('integrity-error');
  if(typeof parserVersion!=='string'||!parserVersion||typeof policyVersion!=='string'||!policyVersion)throw new Error('Explicit parser/policy versions required');
  const budget=runController(verified.limits,signal,sleep);let unlock;
  try{
    const acquired=await acquireRoot(outputDir,budget.check);const root=acquired.root;unlock=acquired.unlock;budget.check();
    const ledger=await readJson(root,'integrity.json',{schemaVersion:1,files:{},documents:{}});await verifyLedger(root,ledger,verified.documents,budget.check);budget.check();
    const config={parserVersion,policyVersion,limits:verified.limits};const configHash=hash(JSON.stringify(config));
    const approved=verified.registry.documents.filter(document=>document.status==='approved').length;
    const report={schemaVersion:1,kind:'public-acquisition-report',mode,planSha256:verified.sha256,registrySha256:verified.registrySha256,configSha256:configHash,config,startedAt:new Date().toISOString(),finishedAt:null,state:'running',documents:[],blockedDocuments:verified.blockedDocuments,summary:{planned:verified.registry.documents.length,approved,approvedNotSelected:approved-verified.documents.length,selected:verified.documents.length,pending:verified.blockedDocuments.filter(document=>document.status==='pending').length,blocked:verified.blockedDocuments.filter(document=>document.status==='blocked').length,downloaded:0,extracted:0,cached:0,failed:0,published:0,indexed:0},metrics:{...budget.stats,rssStartBytes:process.memoryUsage().rss},limitations:['Public bounded pilot; no national coverage or legal/current-law validation.','All extracted text remains quarantined; no publication, training export or product route.','Article text and page-reference hashes do not attest raw page text fidelity.']};
    await immutableJson(root,`plans/${verified.sha256}.json`,verified);
    for(const document of verified.documents){
      const entry={id:document.id,sourceId:document.sourceId,url:document.url,sourceSha256:hash(JSON.stringify(document)),state:'pending',requests:[],textReview:'pending',legalReview:'pending',published:false,indexed:false};
      try{
        budget.check();ledger.documents[document.id]??={url:document.url,sourceId:document.sourceId};
        const sourceRecord=verified.registry.sources.find(source=>source.id===document.sourceId);
        const source={...document,id:document.id,lawId:`${document.jurisdiction}-${document.id.toUpperCase()}`,authority:sourceRecord?.title??null,reuseBasis:sourceRecord?.rightsReview??null};
        const extractionConfigHash=hash(JSON.stringify({configSha256:configHash,document,source:sourceRecord}));entry.extractionConfigSha256=extractionConfigHash;
        const docSignal=AbortSignal.any([budget.signal,AbortSignal.timeout(verified.limits.timeoutMs)]);
        if(mode==='live'){
          let wrapperError=null;const boundedFetch=budget.fetchFor(document,fetchImpl,receipt=>entry.requests.push(receipt));
          const sync=await runLegalSync({sources:[source],outputDir:path.join(root,'acquisitions'),fetchImpl:async(...args)=>{try{return await boundedFetch(...args);}catch(error){wrapperError=error;throw error;}},signal:docSignal,sleep:async()=>{},limits:{...verified.limits,maxBytes:verified.limits.maxDocumentBytes,rateMs:0,timeoutMs:verified.limits.timeoutMs,maxRetries:0}});
          await captureSync(root,ledger);
          if(sync.summary.failed){if(wrapperError)throw wrapperError;if(docSignal.aborted)throw fail(budget.fatal??'request-timeout');throw fail('network-error');}
          entry.downloadState=sync.sources[0].state;if(entry.downloadState==='downloaded')report.summary.downloaded++;
        }
        budget.check();const manifest=await readJson(root,'acquisitions/manifest.json',null);const stored=manifest?.sources?.[document.id];const version=stored?.versions?.find(value=>value.sha256===stored.latestSha256);
        if(!version||stored.url!==document.url)throw fail('snapshot-unavailable');
        const relative=`acquisitions/snapshots/${document.id}/${version.sha256}.pdf`;if(hash(await readSafe(root,relative))!==version.sha256)throw fail('integrity-error');
        entry.versionId=`${document.id}@sha256:${version.sha256}`;entry.pdfSha256=version.sha256;entry.capturedAt=version.retrievedAt;
        const versionEvidencePath=`versions/${document.id}/${version.sha256}.json`;
        if(!ledger.files[versionEvidencePath]){
          const receipt=entry.requests.find(request=>request.kind==='document'&&request.status===200&&request.bodySha256===version.sha256);
          const evidence={schemaVersion:1,documentId:document.id,sourceId:document.sourceId,versionId:entry.versionId,pdfSha256:version.sha256,bytes:version.bytes,sourceUrl:version.url,finalUrl:version.finalUrl,capturedAt:version.retrievedAt,mime:receipt?.mime??null,mimeBasis:receipt?'observed-response':'unknown',discoverySelectionVersionId:document.versionId,declaredPublicationAt:null,declaredAmendedAt:null,effectiveAt:null,textReview:'pending',legalReview:'pending',status:'quarantined',published:false,indexed:false};
          ledger.files[versionEvidencePath]=await immutableJson(root,versionEvidencePath,evidence);await atomic(root,'integrity.json',ledger);
        }
        entry.versionEvidencePath=versionEvidencePath;
        const extractionPath=`extractions/${document.id}/${version.sha256}/${extractionConfigHash}.json`;let result;
        if(ledger.files[extractionPath]){result=await readJson(root,extractionPath,null);if(result?.configSha256!==extractionConfigHash||result.pdfSha256!==version.sha256||result.sourceUrl!==document.url||result.status!=='quarantined'||result.records.some(record=>record.status!=='quarantined'||record.textReview!=='pending'||record.legalReview!=='pending'||hash(record.text)!==record.textSha256))throw fail('integrity-error');report.summary.cached++;}
        else{
          const started=performance.now();let extracted;try{extracted=await budget.bounded(Promise.resolve().then(()=>extractor(path.join(root,relative),source,{pdfSha256:version.sha256,retrievedAt:version.retrievedAt},{signal:docSignal})),docSignal);}catch(error){if(error.code)throw error;throw fail('extract-failed');}
          budget.check();result=quarantine(extracted,document,version,extractionConfigHash);ledger.files[extractionPath]=await immutableJson(root,extractionPath,result);await atomic(root,'integrity.json',ledger);entry.extractionMs=Math.round(performance.now()-started);
        }
        entry.state='quarantined';entry.extractionPath=extractionPath;entry.records=result.records.length;entry.declaredAmendedAt=result.declaredAmendedAt;entry.effectiveAt=null;report.summary.extracted++;
      }catch(error){entry.state='failed';entry.errorCategory=errorCode(error);report.summary.failed++;}
      report.documents.push(entry);Object.assign(report.metrics,budget.stats);await atomic(root,'report.json',report);
      if(budget.fatal)break;
    }
    if(report.documents.length<verified.documents.length)for(const document of verified.documents.slice(report.documents.length)){report.documents.push({id:document.id,sourceId:document.sourceId,state:'not-attempted',errorCategory:budget.fatal??'cancelled',textReview:'pending',legalReview:'pending',published:false,indexed:false});report.summary.failed++;}
    budget.finish();Object.assign(report.metrics,budget.stats,{rssEndBytes:process.memoryUsage().rss,rssMeasurement:'coordinator start/end samples; excludes terminated extraction workers, not peak RSS'});report.finishedAt=new Date().toISOString();report.state=budget.fatal==='cancelled'?'cancelled':report.summary.failed?(report.summary.extracted?'partial':'failed'):'complete';await atomic(root,'report.json',report);return report;
  }finally{budget.finish();await unlock?.();}
}

if(!isMainThread&&workerData?.kind==='public-acquisition-extract'){
  try{parentPort.postMessage({ok:true,result:await parsePdfInWorker(workerData.file,workerData.source,workerData.metadata)});}catch{parentPort.postMessage({ok:false});}
}
