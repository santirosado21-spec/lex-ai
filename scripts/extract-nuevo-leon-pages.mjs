// Fixed, offline research entry point. No client integration or legal version selection.
import {open,lstat,mkdir} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {canonicalJson} from '../server/canonical-json.mjs';
import {verifyInputs,REPOSITORY_ROOT,DOCUMENTS,CAPTURE_ROOT,CAPTURE_REPORT_SHA256} from './extract-nuevo-leon-research.mjs';
import {PROFILE_VERSION,PAGE_LIMITS,QUARANTINE,parseStatePagesInWorker,verifyStatePageEvidence,evidenceError} from '../server/corpus/state-page-evidence.mjs';

export const SOURCE_WRAPPER_SHA256='c8ae506abd7a19a81971e305c3cf25719c4d3eb3570cebd8c53f966cd2d3783a';
export const RUN_LIMITS=Object.freeze({...PAGE_LIMITS,maxBatchMs:300000,maxDocuments:2,concurrency:1});
const hash=data=>createHash('sha256').update(data).digest('hex');
const CATEGORIES=new Set(['input-integrity','source-drift','unsafe-path','page-provenance','page-evidence-invalid','page-budget','page-coverage','item-budget','text-budget','candidate-budget','output-budget','parser-timeout','duration-budget','cancelled','page-extract-failed']);
const category=error=>CATEGORIES.has(error?.code)?error.code:'page-extract-failed';
const nowStamp=()=>new Date().toISOString();

export function statePagePlan(){
  const proposal={schemaVersion:1,kind:'nle-state-page-evidence-proposal',action:'plan',profileVersion:PROFILE_VERSION,
    dataClass:'public-development',productionEnabled:false,captureRoot:CAPTURE_ROOT,captureReportSha256:CAPTURE_REPORT_SHA256,
    verifiedInputWrapperSha256:SOURCE_WRAPPER_SHA256,documents:DOCUMENTS,limits:RUN_LIMITS,outputRoot:'artifacts/public-corpus',
    scope:'all PDF.js page text/items and candidate headings; no operative article classification, OCR or publication',...QUARANTINE};
  return JSON.parse(canonicalJson({...proposal,proposalSha256:hash(canonicalJson(proposal))}));
}

async function safe(root,relative,{parents=false}={}){
  if(typeof relative!=='string'||path.isAbsolute(relative)||relative.split(/[\\/]/).some(s=>!s||s==='.'||s==='..'))throw evidenceError('unsafe-path');
  const target=path.resolve(root,relative);if(!target.startsWith(path.resolve(root)+path.sep))throw evidenceError('unsafe-path');
  let current=path.parse(target).root;
  for(const part of target.slice(current.length).split(path.sep)){
    current=path.join(current,part);let info;
    try{info=await lstat(current);}catch(error){
      if(error.code==='ENOENT'&&current===target)return target;
      if(error.code==='ENOENT'&&parents){try{await mkdir(current,{mode:0o700});}catch(e){if(e.code!=='EEXIST')throw evidenceError('unsafe-path');}info=await lstat(current);}
      else throw evidenceError('unsafe-path');
    }
    if(info.isSymbolicLink()||(current!==target&&!info.isDirectory())||(!info.isFile()&&!info.isDirectory()))throw evidenceError('unsafe-path');
  }
  return target;
}
async function readSafe(root,relative,maximum){
  const file=await safe(root,relative);let handle;
  try{
    handle=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);const stat=await handle.stat();if(!stat.isFile()||stat.size>maximum)throw evidenceError('input-integrity');
    const bytes=Buffer.alloc(Math.min(stat.size+1,maximum+1));let size=0;
    while(size<bytes.length){const part=await handle.read(bytes,size,bytes.length-size,null);if(!part.bytesRead)break;size+=part.bytesRead;}
    if(size!==stat.size||size>maximum)throw evidenceError('input-integrity');return bytes.subarray(0,size);
  }catch(error){throw CATEGORIES.has(error.code)?error:evidenceError('input-integrity');}finally{await handle?.close();}
}
async function writeOnce(root,relative,bytes){
  const file=await safe(root,relative),handle=await open(file,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
  try{await handle.writeFile(bytes);await handle.sync();await handle.chmod(0o400);}finally{await handle.close();}
  return {path:relative,bytes:bytes.length,sha256:hash(bytes)};
}
function boundedLimits(bounds,extractor){
  if(bounds!==undefined&&typeof extractor!=='function')throw evidenceError('source-drift');
  const limits={...RUN_LIMITS,...bounds};if(Object.keys(limits).length!==Object.keys(RUN_LIMITS).length)throw evidenceError('source-drift');
  for(const [key,maximum]of Object.entries(RUN_LIMITS))if(!Number.isSafeInteger(limits[key])||limits[key]<1||limits[key]>maximum)throw evidenceError('source-drift');
  if(limits.maxDocuments!==2||limits.concurrency!==1)throw evidenceError('source-drift');return limits;
}

export async function runStatePages({outName,repositoryRoot=REPOSITORY_ROOT,extractor,fixturePins,fixtureWrapperSha256,bounds,clock=()=>performance.now(),now=nowStamp}={}){
  if(typeof outName!=='string'||!/^[a-z][a-z0-9-]{0,79}$/.test(outName))throw evidenceError('unsafe-path');
  if((fixtureWrapperSha256!==undefined||repositoryRoot!==REPOSITORY_ROOT)&&typeof extractor!=='function')throw evidenceError('source-drift');
  const limits=boundedLimits(bounds,extractor),started=clock(),check=()=>{if(clock()-started>=limits.maxBatchMs)throw evidenceError('duration-budget');};
  check();const wrapperBytes=await readSafe(repositoryRoot,'scripts/extract-nuevo-leon-research.mjs',1024*1024);
  if(hash(wrapperBytes)!==(fixtureWrapperSha256??SOURCE_WRAPPER_SHA256))throw evidenceError('input-integrity');
  const verified=await verifyInputs({repositoryRoot,fixturePins,extractor,limits:{maxPdfBytes:limits.maxPdfBytes,maxTotalPdfBytes:20*1024*1024}});check();
  const relative='artifacts/public-corpus/'+outName,output=await safe(repositoryRoot,relative,{parents:true});
  try{await mkdir(output,{mode:0o700});}catch{throw evidenceError('unsafe-path');}
  const report={...statePagePlan(),action:'extract-offline',state:'running',artifactDirectory:relative,startedAt:now(),limits,
    inputLedger:[{path:'scripts/extract-nuevo-leon-research.mjs',bytes:wrapperBytes.length,sha256:hash(wrapperBytes)},...verified.ledger],outputs:[],documents:[],notExtracted:[],workerInvocations:0,networkRequests:0};
  const parse=extractor??parseStatePagesInWorker;
  try{
    report.outputs.push(await writeOnce(output,'source-capture-report.json',verified.captureBytes));
    report.outputs.push(await writeOnce(output,'source-html-report.json',verified.htmlReportBytes));
    for(const input of verified.inputs){check();report.outputs.push(await writeOnce(output,input.doc.id+'.pdf',input.bytes));}
    for(const input of verified.inputs){
      const {doc,capturedAt,binding}=input;
      try{
        check();if(limits.maxBatchMs-(clock()-started)<limits.workerTimeoutMs)throw evidenceError('duration-budget');
        const file=await safe(output,doc.id+'.pdf');
        if(hash(await readSafe(output,doc.id+'.pdf',limits.maxPdfBytes))!==doc.sha256)throw evidenceError('input-integrity');
        const source=Object.freeze({id:doc.id,lawId:doc.lawId,title:doc.title,url:doc.url}),metadata=Object.freeze({pdfSha256:doc.sha256,capturedAt});
        const controller=new AbortController();let timer;
        report.workerInvocations++;
        let raw;
        try{raw=await Promise.race([parse(file,source,metadata,{limits,signal:controller.signal}),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(evidenceError('parser-timeout'));},limits.workerTimeoutMs);})]);}
        finally{clearTimeout(timer);controller.abort();}
        check();if(hash(await readSafe(output,doc.id+'.pdf',limits.maxPdfBytes))!==doc.sha256)throw evidenceError('input-integrity');
        const result=verifyStatePageEvidence(raw,source,metadata,limits);
        const artifact={...result,sourceBinding:binding,captureReportSha256:verified.pins.capture},bytes=Buffer.from(canonicalJson(artifact)+'\n');
        const used=report.outputs.filter(row=>row.path.endsWith('.pages.json')).reduce((n,row)=>n+row.bytes,0);
        if(used+bytes.length>limits.maxJsonBytes)throw evidenceError('output-budget');
        report.outputs.push(await writeOnce(output,doc.id+'.pages.json',bytes));
        report.documents.push({id:doc.id,state:'quarantined',pdfSha256:doc.sha256,pageEvidencePath:doc.id+'.pages.json',documentEvidenceSha256:result.documentEvidenceSha256,coverage:result.coverage,...QUARANTINE});
      }catch(error){report.documents.push({id:doc.id,state:'failed',errorCategory:category(error),...QUARANTINE});report.state='partial-quarantine';break;}
    }
    if(report.state==='running')report.state='complete-quarantine';
  }catch(error){report.state='partial-quarantine';report.errorCategory=category(error);}
  finally{
    const done=new Set(report.documents.filter(d=>d.pageEvidencePath).map(d=>d.id)),complete=report.documents.filter(d=>d.pageEvidencePath);
    report.notExtracted=DOCUMENTS.filter(d=>!done.has(d.id)).map(d=>({id:d.id,state:'pending-page-evidence'}));
    report.summary={planned:2,pages:complete.reduce((n,d)=>n+d.coverage.pages,0),headingCandidates:complete.reduce((n,d)=>n+d.coverage.headingCandidates,0),
      repeatedHeadingCandidates:complete.reduce((n,d)=>n+d.coverage.repeatedHeadingCandidates,0),metadataCandidates:complete.reduce((n,d)=>n+d.coverage.transitoryCandidates+d.coverage.editorialCandidates+d.coverage.headerCandidates+d.coverage.ambiguousBareReferences,0),
      newlyApprovedCorpusDocuments:0,indexed:0,published:0,trainingExported:0};
    report.finishedAt=now();report.elapsedMs=Math.max(0,clock()-started);
    await writeOnce(output,'report.json',Buffer.from(canonicalJson(report)+'\n'));
  }
  return report;
}

export async function main(args=process.argv.slice(2)){
  if(args.length===0||(args.length===1&&args[0]==='--plan')){process.stdout.write(JSON.stringify(statePagePlan(),null,2)+'\n');return 0;}
  if(args.length!==3||args[0]!=='--extract'||args[1]!=='--out-name')throw evidenceError('unsafe-path');
  const report=await runStatePages({outName:args[2]});process.stdout.write(JSON.stringify({state:report.state,artifactDirectory:report.artifactDirectory,workerInvocations:report.workerInvocations,networkRequests:0,summary:report.summary})+'\n');
  return report.state==='complete-quarantine'?0:1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().then(code=>{process.exitCode=code;}).catch(error=>{process.stderr.write(category(error)+'\n');process.exitCode=2;});
