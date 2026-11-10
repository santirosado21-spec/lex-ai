// OFFLINE developer evaluator: plan by default; explicit dev or reviewed single heldout run.
import {readFile,writeFile,mkdir,realpath,stat,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {copyPrivacyJson,exactFields,validateOperationalInput,projectPrivacyCase} from '../server/privacy/operational-v2.mjs';
import {canonicalJson} from '../server/canonical-json.mjs';
import {validateCases,scorePredictions,validateManifestBytes} from './eval-privacy-v2.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export const CANDIDATE_ID='gliner-pii-small-uint8-local-v2';
export const CANDIDATE_SOURCES=['server/privacy/semantic-v2.mjs','server/privacy/detector.mjs','server/privacy/provenance.mjs','server/privacy/operational-v2.mjs','server/canonical-json.mjs','scripts/privacy-onnx-worker.py','scripts/privacy-candidate-worker-v2.mjs','scripts/run-privacy-detector-v2.mjs','scripts/eval-privacy-v2.mjs','scripts/eval-privacy.mjs','resources/privacy-detector-candidate-v2.json'];
const sha=b=>createHash('sha256').update(b).digest('hex');
const failure=()=>Error('privacy_candidate_failed');
export async function candidateSourceHashes(){return Object.fromEntries(await Promise.all(CANDIDATE_SOURCES.map(async f=>[f,sha(await readFile(path.join(root,f)))])));}
export async function runtimeIdentity(){
 const base=path.join(root,'artifacts/privacy/onnx-env');const files=[];
 async function walk(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const p=path.join(directory,entry.name);if(entry.isDirectory()){if(entry.name!=='__pycache__')await walk(p);}else if(entry.isFile())files.push(p);}}
 await walk(path.join(base,'lib'));
 const h=createHash('sha256');for(const p of files.sort()){h.update(path.relative(base,p));h.update(sha(await readFile(p)));}
 h.update(await readFile(path.join(root,'artifacts/privacy/onnx-requirements.lock')));
 const python=await realpath(path.join(base,'bin/python'));h.update(sha(await readFile(python)));
 return {runtimeTreeSha256:h.digest('hex'),node:process.version,platform:process.platform,arch:process.arch};
}
// macOS network and evaluator/corpus isolation, NOT a general filesystem sandbox.
// Strict allowlist profile aborts this installed Node at startup; no inference used it.
// All eval files and scorer/runner sources are unreadable in the candidate tree.
export async function candidateSandboxProfile(){
 if(process.platform!=='darwin')throw failure();
 const q=s=>JSON.stringify(s);
 const denied=[path.join(root,'eval'),path.join(root,'artifacts/privacy')];
 // Artifact exclusions are scoped to evaluation outputs; model/env remain readable.
 const files=['scripts/eval-privacy.mjs','scripts/eval-privacy-v2.mjs','scripts/run-privacy-detector.mjs','scripts/run-privacy-detector-v2.mjs'];
 return `(version 1)(allow default)(deny network*)(deny file-write*)(allow file-write* (literal "/dev/null"))(deny file-read* (subpath ${q(denied[0])}) ${files.map(p=>`(literal ${q(path.join(root,p))})`).join(' ')} (regex ${q('^'+root.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'artifacts/privacy/.*(predictions|score|freeze|execution)[^/]*\\.json$')}))`;
}
export async function startCandidateWorker({timeoutMs=15000}={}){
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>15000)throw failure();
 const profile=await candidateSandboxProfile();
 const child=spawn('/usr/bin/sandbox-exec',['-p',profile,process.execPath,fileURLToPath(new URL('./privacy-candidate-worker-v2.mjs',import.meta.url))],{stdio:['ignore','ignore','ignore','ipc'],detached:true,env:{PATH:'/usr/bin:/bin',LANG:'en_US.UTF-8'},serialization:'json'});
 let dead=false,pending=null,readyResolve,readyReject,metadata;
 const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
 function close(){if(dead)return;dead=true;clearTimeout(loadTimer);try{process.kill(-child.pid,'SIGKILL');}catch{}readyReject(failure());pending?.reject(failure());pending=null;}
 const loadTimer=setTimeout(close,15000);
 child.on('error',close);child.on('exit',close);
 child.on('message',message=>{try{
  const m=copyPrivacyJson(message);
  if(!metadata){exactFields(m,['ready']);if(m.ready.candidateId!==CANDIDATE_ID)throw failure();metadata=m.ready;clearTimeout(loadTimer);readyResolve(metadata);return;}
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
export async function assertCandidateFreeze(freeze,{sources,runtime,manifest,modelManifestSha256}){
 if(freeze?.candidateId!==CANDIDATE_ID||freeze.productionEnabled!==false||freeze.approvedForSingleHeldoutRun!==true||typeof freeze.independentReviewer!=='string'||!freeze.independentReviewer.trim()||freeze.protocolSha256!==manifest.protocol.sha256||freeze.heldoutSha256!==manifest.splits.heldout.sha256||freeze.modelManifestSha256!==modelManifestSha256||canonicalJson(freeze.runtimeIdentity)!==canonicalJson(runtime)||!freeze.sourceHashes||Object.keys(freeze.sourceHashes).length!==CANDIDATE_SOURCES.length||CANDIDATE_SOURCES.some(f=>freeze.sourceHashes[f]!==sources[f]))throw Error('candidate_not_frozen');
}
// Pure admission gate: caller supplies raw bytes. It never opens any corpus file.
// WeakMap binds reservations to validated, immutable tickets; no caller nonce/hash override.
const heldoutTickets=new WeakMap();
function deepFreeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(deepFreeze);Object.freeze(value);}return value;}
export async function validateHeldoutDispatch({freeze,context,corpus}){
 const frozen=copyPrivacyJson(freeze),actual=copyPrivacyJson(context);
 await assertCandidateFreeze(frozen,actual);
 const validated=validateManifestBytes(corpus);
 if(canonicalJson(corpus.manifest)!==canonicalJson(actual.manifest)||validated.status!=='corpus-valid'||validated.protocol.corpusRules.heldoutCaseCount!==300||validated.splits.heldout.length!==300)throw Error('heldout_corpus_not_valid');
 const identity={version:1,candidateId:CANDIDATE_ID,modelManifestSha256:actual.modelManifestSha256,
  protocolSha256:actual.manifest.protocol.sha256,annotationGuideSha256:actual.manifest.annotationGuide.sha256,
  devSha256:actual.manifest.splits.dev.sha256,heldoutSha256:actual.manifest.splits.heldout.sha256,
  sourceHashes:actual.sources,runtimeIdentity:actual.runtime};
 // Hashes include the model manifest/config and every executable candidate/evaluator source.
 // Reviewer name, timestamps, JSON presentation, output directory and arbitrary freeze metadata
 // are intentionally excluded: they cannot create another acceptance run of this candidate.
 const identityJson=canonicalJson(identity),executionId=sha(identityJson);
 const ticket=deepFreeze({executionId,protocol:validated.protocol,rows:validated.splits.heldout});
 heldoutTickets.set(ticket,{executionId,identityJson});return ticket;
}
export async function reserveHeldoutRun(ticket,directory){
 const binding=heldoutTickets.get(ticket);if(!binding)throw Error('invalid_heldout_ticket');
 const parent=await realpath(directory);
 await writeFile(path.join(parent,`single-heldout-${binding.executionId}.used`),binding.identityJson+'\n',{flag:'wx',mode:0o600});
 // Reservation is never removed on failure: partial dispatch must not permit automatic retry.
 return binding.executionId;
}
export async function dispatchReviewedHeldout(input,{reservationDirectory,dispatch}){
 if(typeof dispatch!=='function')throw Error('invalid_heldout_dispatch');
 const ticket=await validateHeldoutDispatch(input);
 await reserveHeldoutRun(ticket,reservationDirectory);
 return dispatch(ticket);
}
async function verifiedEval(reference){
 if(!reference||typeof reference.file!=='string'||path.basename(reference.file)!==reference.file)throw failure();
 const directory=await realpath(path.join(root,'eval/privacy-v2')),filename=await realpath(path.join(directory,reference.file));if(path.dirname(filename)!==directory)throw failure();const bytes=await readFile(filename);if(sha(bytes)!==reference.sha256)throw failure();return bytes;
}
export async function main(args=process.argv.slice(2)){
 if(!args.length||args.length===1&&args[0]==='--plan'){
  const model=JSON.parse(await readFile(path.join(root,'resources/privacy-detector-candidate-v2.json')));console.log(JSON.stringify({action:'plan',candidateId:CANDIDATE_ID,productionEnabled:false,modelBytes:model.files.reduce((n,f)=>n+f.bytes,0),explicitPreparation:'Python 3.12 scripts/prepare-privacy-onnx.py --prepare',evaluation:'--dev --out-dir artifacts/privacy/NEW_DIRECTORY; heldout requires reviewed matching freeze'}));return 0;
 }
 const split=args[0]==='--dev'?'dev':args[0]==='--heldout'?'heldout':null;if(!split)throw failure();
 const options={};for(let i=1;i<args.length;i+=2){if(!['--out-dir','--freeze'].includes(args[i])||options[args[i]]||!args[i+1])throw failure();options[args[i]]=args[i+1];}
 if(!options['--out-dir']||split==='heldout'&&!options['--freeze'])throw failure();
 const sources=await candidateSourceHashes(),runtime=await runtimeIdentity();
 const modelBytes=await readFile(path.join(root,'resources/privacy-detector-candidate-v2.json')),modelManifestSha256=sha(modelBytes);
 const manifest=JSON.parse(await readFile(path.join(root,'eval/privacy-v2/manifest.json')));
 let freeze;
 if(split==='heldout'){freeze=JSON.parse(await readFile(options['--freeze']));await assertCandidateFreeze(freeze,{sources,runtime,manifest,modelManifestSha256});}
 const artifacts=await realpath(path.join(root,'artifacts/privacy')),out=path.resolve(options['--out-dir']);if(path.dirname(out)!==artifacts||await realpath(path.dirname(out))!==artifacts)throw failure();await mkdir(out);
 let protocol,rows,worker,executionId=null;
 if(split==='heldout'){
  // Only this explicit, reviewed branch opens retained bytes. Validate ALL split/guide bytes
  // and cross-split constraints before reserving the canonical run and starting any backend.
  const [protocolBytes,annotationGuideBytes,devBytes,heldoutBytes]=await Promise.all([verifiedEval(manifest.protocol),verifiedEval(manifest.annotationGuide),verifiedEval(manifest.splits.dev),verifiedEval(manifest.splits.heldout)]);
  const admitted=await dispatchReviewedHeldout({freeze,context:{sources,runtime,manifest,modelManifestSha256},corpus:{manifest,protocolBytes,annotationGuideBytes,splits:{dev:devBytes,heldout:heldoutBytes}}},{reservationDirectory:artifacts,dispatch:async ticket=>({ticket,worker:await startCandidateWorker()})});
  ({protocol,rows,executionId}=admitted.ticket);worker=admitted.worker;
 }else{
  protocol=JSON.parse(await verifiedEval(manifest.protocol));const bytes=await verifiedEval(manifest.splits.dev);
  rows=bytes.toString('utf8').trimEnd().split('\n').map(s=>JSON.parse(s));validateCases(rows,{protocol,split});worker=await startCandidateWorker();
 }
 const batches=[];let metadata;
 try{metadata=await worker.ready;if(metadata.manifestSha256!==modelManifestSha256)throw failure();for(const row of rows)batches.push(await worker.request(projectPrivacyCase(row)));}finally{worker.close();}
 if(JSON.stringify(sources)!==JSON.stringify(await candidateSourceHashes())||JSON.stringify(runtime)!==JSON.stringify(await runtimeIdentity()))throw failure();
 const artifact={candidateId:CANDIDATE_ID,protocolSha256:manifest.protocol.sha256,corpusSha256:manifest.splits[split].sha256,predictions:rows.map((row,i)=>({id:row.id,...batches[i].result}))};
 const report=scorePredictions({protocol,cases:rows,split,artifact,protocolSha256:artifact.protocolSha256,corpusSha256:artifact.corpusSha256});
 const execution={candidateId:CANDIDATE_ID,split,executionId,sourceHashes:sources,runtimeIdentity:runtime,modelManifestSha256,metadata,cases:rows.length,goldPassedToCandidate:false,operationalFlagsFromGold:false,network:'macOS sandbox denies network and file writes',candidateReads:'eval directory and evaluator sources denied; not a general filesystem sandbox',latenciesMs:batches.map(b=>b.latencyMs),peakRssBytes:Math.max(...batches.map(b=>b.peakRssBytes)),limitations:['Experimental synthetic fixture, not production import provenance.','No egress grant; Spanish/privacy quality unvalidated.','Token/subtoken overflow blocks; no truncation or long-input coverage claim.','Incremental RSS bounded conservatively by summed absolute process peaks; not 8 GB hardware validation.']};
 for(const [name,data] of [['predictions',artifact],['score',report],['execution',execution]])await writeFile(path.join(out,`${name}.json`),JSON.stringify(data,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({candidateId:CANDIDATE_ID,split,cases:rows.length,status:report.experimentalGate.status}));return report.experimentalGate.status==='eligible-for-integration-evaluation'?0:3;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{process.exitCode=await main();}catch{console.error('privacy_candidate_failed');process.exitCode=2;}}
