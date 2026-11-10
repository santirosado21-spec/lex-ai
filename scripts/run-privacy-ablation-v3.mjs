// Development-only paired diagnostic. No retained acceptance path or product activation.
import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {canonicalJson} from '../server/canonical-json.mjs';
import {copyPrivacyJson,exactFields,validateOperationalInput,projectPrivacyCase} from '../server/privacy/operational-v2.mjs';
import {validateCases,scorePredictions} from './eval-privacy-v2.mjs';
import {candidateSandboxProfile,candidateSourceHashes,runtimeIdentity} from './run-privacy-detector-v2.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export const IDS=Object.freeze(['gliner-pii-small-uint8-local-v2','gliner-pii-small-uint8-local-v3']);
export const DEV_PATH='eval/privacy-development-v3/cases.jsonl';
export const DEV_SHA256='511f2da926df75a84a9624147d61bbff189bfa72cd5c931f71f437d41a83552d';
const sha=b=>createHash('sha256').update(b).digest('hex');
const failure=()=>Error('privacy_ablation_failed');
export function validateAblationManifests(bytes){
 if(!Array.isArray(bytes)||bytes.length!==2)throw failure();
 const [a,b]=bytes.map(x=>JSON.parse(x));
 const labels=[{label:'name',category:'person'},{label:'organization',category:'organization'},{label:'location address',category:'address'}];
 const full=[...labels,{label:'identifying context',category:'context'},{label:'sensitive relationship',category:'sensitive_relation'}];
 if(a.id!==IDS[0]||b.id!==IDS[1]||a.productionEnabled!==false||b.productionEnabled!==false||a.runtime.threshold!==.3||b.runtime.threshold!==.3||canonicalJson(a.runtime.labels)!==canonicalJson(full)||canonicalJson(b.runtime.labels)!==canonicalJson(labels))throw failure();
 // Only this exact historical-note correction may differ; all other limitations remain equal.
 if(!Array.isArray(a.limitations)||!Array.isArray(b.limitations)||a.limitations.length!==5||b.limitations.length!==5||a.limitations[4]!=='No model bytes have been downloaded or loaded when this selection metadata was created.'||b.limitations[4]!=='Reuses previously prepared pinned v2 weights; no additional download for this ablation.')throw failure();
 b.limitations[4]=a.limitations[4];
 for(const m of [a,b]){delete m.id;delete m.runtime.labels;delete m.runtime.labelsStatus;}
 if(canonicalJson(a)!==canonicalJson(b))throw failure();
 return bytes.map(sha);
}
export async function ablationIdentity(){
 const sources=await candidateSourceHashes();
 for(const f of ['scripts/run-privacy-ablation-v3.mjs','resources/privacy-detector-candidate-v3.json'])sources[f]=sha(await readFile(path.join(root,f)));
 return {sources,runtime:await runtimeIdentity()};
}
// Pure admission for injected buffers. The real CLI pins the independent-author corpus hash.
export function validateAblation({freeze,identity,manifestBytes,protocolBytes,guideBytes,devBytes}){
 const manifests=validateAblationManifests(manifestBytes),protocol=JSON.parse(protocolBytes);
 const binding={version:1,candidateIds:IDS,identity,manifestSha256:manifests,protocolSha256:sha(protocolBytes),guideSha256:sha(guideBytes),devSha256:sha(devBytes),cases:60,threshold:.3};
 if(freeze?.approvedForDevelopmentAblation!==true||typeof freeze.independentReviewer!=='string'||!freeze.independentReviewer.trim()||canonicalJson(freeze.binding)!==canonicalJson(binding)||protocol.annotationGuideSha256!==sha(guideBytes))throw failure();
 const rows=devBytes.toString('utf8').trimEnd().split('\n').map(x=>JSON.parse(x));
 if(rows.length!==60)throw failure();validateCases(rows,{protocol,split:'dev'});
 return {binding,protocol,rows};
}
export async function runAblation(input,{startWorker=startAblationWorker}={}){
 const admitted=validateAblation(input),results=[];
 for(let index=0;index<2;index++){
  const candidateId=IDS[index],worker=await startWorker({candidateId});const batches=[];let metadata;
  try{metadata=await worker.ready;if(metadata.candidateId!==candidateId||metadata.manifestSha256!==admitted.binding.manifestSha256[index])throw failure();
   for(const row of admitted.rows)batches.push(await worker.request(projectPrivacyCase(row)));
  }finally{worker.close();}
  const artifact={candidateId,protocolSha256:admitted.binding.protocolSha256,corpusSha256:admitted.binding.devSha256,predictions:admitted.rows.map((row,i)=>({id:row.id,...batches[i].result}))};
  const score=scorePredictions({protocol:admitted.protocol,cases:admitted.rows,split:'dev',artifact,protocolSha256:artifact.protocolSha256,corpusSha256:artifact.corpusSha256});
  results.push({candidateId,artifact,score,metadata,latenciesMs:batches.map(b=>b.latencyMs),peakRssBytes:Math.max(...batches.map(b=>b.peakRssBytes))});
 }
 return {binding:admitted.binding,diagnosticOnly:true,productionEnabled:false,results};
}
export async function startAblationWorker({candidateId,timeoutMs=15000}={}){
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>15000)throw failure();
 if(!IDS.includes(candidateId))throw failure();
 const base=await candidateSandboxProfile();
 const profile=base+`(deny file-read* (literal ${JSON.stringify(fileURLToPath(import.meta.url))}))`; 
 const child=spawn('/usr/bin/sandbox-exec',['-p',profile,process.execPath,fileURLToPath(new URL('./privacy-candidate-worker-v2.mjs',import.meta.url)),...(candidateId===IDS[1]?['--ablation-v3']:[])],{stdio:['ignore','ignore','ignore','ipc'],detached:true,env:{PATH:'/usr/bin:/bin',LANG:'en_US.UTF-8'},serialization:'json'});
 let dead=false,pending=null,readyResolve,readyReject,metadata;
 const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
 function close(){if(dead)return;dead=true;clearTimeout(loadTimer);try{process.kill(-child.pid,'SIGKILL');}catch{}readyReject(failure());pending?.reject(failure());pending=null;}
 const loadTimer=setTimeout(close,15000);
 child.on('error',close);child.on('exit',close);
 child.on('message',message=>{try{
  const m=copyPrivacyJson(message);
  if(!metadata){exactFields(m,['ready']);if(m.ready.candidateId!==candidateId)throw failure();metadata=m.ready;clearTimeout(loadTimer);readyResolve(metadata);return;}
  if(!pending)throw failure();exactFields(m,['result','latencyMs','peakRssBytes']);
  if(!Number.isFinite(m.latencyMs)||m.latencyMs<0||!Number.isInteger(m.peakRssBytes)||m.peakRssBytes>1073741824)throw failure();
  exactFields(m.result,['status','reasonCategory','detections']);
  const p=pending;pending=null;p.resolve(m);
 }catch{close();}});
 return {ready,pid:child.pid,close,
  async request(input,{signal}={}){const clean=validateOperationalInput(input);await ready;if(dead||pending||signal?.aborted)throw failure();return new Promise((resolve,reject)=>{
   const abort=()=>{close();reject(failure());};const timer=setTimeout(abort,timeoutMs);signal?.addEventListener('abort',abort,{once:true});
   const finish=fn=>value=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);fn(value);};pending={resolve:finish(resolve),reject:finish(reject)};
   child.send({input:clean},error=>{if(error)close();});
  });},
 };
}
export async function main(args=process.argv.slice(2)){
 if(!args.length||args.length===1&&args[0]==='--plan'){console.log(JSON.stringify({action:'plan',candidateIds:IDS,cases:60,maximumRequests:120,threshold:.3,productionEnabled:false,requires:'independent reviewed freeze; explicit --dev --freeze FILE --out-dir NEW_DIRECTORY'}));return 0;}
 if(args.length!==5||args[0]!=='--dev'||args[1]!=='--freeze'||args[3]!=='--out-dir')throw failure();
 const freeze=JSON.parse(await readFile(args[2]));
 const [identity,manifestBytes,protocolBytes,guideBytes,devBytes]=await Promise.all([
  ablationIdentity(),Promise.all([2,3].map(v=>readFile(path.join(root,`resources/privacy-detector-candidate-v${v}.json`)))),
  readFile(path.join(root,'eval/privacy-v2/protocol.json')),readFile(path.join(root,'eval/privacy-v2/annotation-guide.md')),readFile(path.join(root,DEV_PATH))]);
 if(sha(devBytes)!==DEV_SHA256)throw failure();
 const input={freeze,identity,manifestBytes,protocolBytes,guideBytes,devBytes};validateAblation(input);
 const artifacts=await realpath(path.join(root,'artifacts/privacy')),out=path.resolve(args[4]);
 if(path.dirname(out)!==artifacts||await realpath(path.dirname(out))!==artifacts)throw failure();
 await mkdir(out); // Exclusive reservation; never remove/retry/overwrite on any failure.
 const result=await runAblation(input);
 if(canonicalJson(identity)!==canonicalJson(await ablationIdentity()))throw failure();
 for(const [i,bytes] of manifestBytes.entries())if(sha(await readFile(path.join(root,`resources/privacy-detector-candidate-v${i+2}.json`)))!==sha(bytes))throw failure();
 if(sha(await readFile(path.join(root,DEV_PATH)))!==sha(devBytes)||sha(await readFile(path.join(root,'eval/privacy-v2/protocol.json')))!==sha(protocolBytes)||sha(await readFile(path.join(root,'eval/privacy-v2/annotation-guide.md')))!==sha(guideBytes))throw failure();
 await writeFile(path.join(out,'ablation-execution.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log(JSON.stringify({diagnosticOnly:true,cases:60,configurations:2,productionEnabled:false}));return 0;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{process.exitCode=await main();}catch{console.error('privacy_ablation_failed');process.exitCode=2;}}
