// Offline development diagnostic only: no retained acceptance route or product promotion.
import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {canonicalJson} from '../server/canonical-json.mjs';
import {copyPrivacyJson,exactFields,projectPrivacyCase} from '../server/privacy/operational-v2.mjs';
import {validateCases,validatePredictionArtifact} from './eval-privacy-v2.mjs';
import {runtimeIdentity,CANDIDATE_SOURCES} from './run-privacy-detector-v2.mjs';
import {TOKEN_NER_VERSION,startTokenNerWorker,validateTelemetry} from '../server/privacy/token-ner-trace-candidate.mjs';
export const BASELINE_SHA256='9481e358a4306955f398fb4f4f8a9b7e62a3f9b7d9440ea0eb81f9f456d6cca8';
const BASELINE_PATH='artifacts/privacy/rampart-dev-v1-20261110-first/predictions.json';
const root=fileURLToPath(new URL('../',import.meta.url));
export const DEV_PATH='eval/privacy-development-v3/cases.jsonl';
export const DEV_SHA256='511f2da926df75a84a9624147d61bbff189bfa72cd5c931f71f437d41a83552d';
export const SOURCES=Object.freeze([...new Set([...CANDIDATE_SOURCES,
 'scripts/run-privacy-ablation-v3.mjs', // sandbox explicitly denies this evaluator
 'scripts/privacy-token-ner-worker.py','server/privacy/token-ner-candidate.mjs',
 'resources/privacy-token-ner-candidate-v1.json','tests/privacy-token-ner.test.mjs',
 'scripts/run-privacy-token-ner-v1.mjs','tests/privacy-token-ner-runner.test.mjs',
 'scripts/privacy-token-ner-trace-worker.py','server/privacy/token-ner-trace-candidate.mjs','resources/privacy-token-ner-trace-v1.json','resources/privacy-token-ner-trace-protocol-v1.json','scripts/run-privacy-token-ner-trace-v1.mjs','tests/privacy-token-ner-trace.test.mjs'])].sort());
const sha=b=>createHash('sha256').update(b).digest('hex');
const failure=()=>Error('privacy_token_ner_run_failed');
export async function executionIdentity(){
 const sources=Object.fromEntries(await Promise.all(SOURCES.map(async f=>[f,sha(await readFile(path.join(root,f)))])));
 return {sourceHashes:sources,runtime:await runtimeIdentity()};
}
export function developmentBinding({identity,modelBytes,protocolBytes,guideBytes,devBytes,baselineBytes,baselineModelBytes,traceProtocolBytes}){
 return {version:1,candidateId:TOKEN_NER_VERSION,identity,modelManifestSha256:sha(modelBytes),protocolSha256:sha(protocolBytes),guideSha256:sha(guideBytes),devSha256:sha(devBytes),baselinePredictionsSha256:sha(baselineBytes),baselineModelSha256:sha(baselineModelBytes),traceProtocolSha256:sha(traceProtocolBytes),caseCount:60,maximumRequests:60,timeoutMs:15000,rssLimitBytes:1073741824,productionEnabled:false};
}
// Pure gate for injected test bytes. The real CLI additionally pins the independently
// authored DEV SHA and fixed paths; no caller can select a heldout corpus or model path.
export function validateDevelopmentRun(input){
 if(input?.freeze?.approvedForDevelopmentRun!==true||typeof input.freeze.independentReviewer!=='string'||!input.freeze.independentReviewer.trim())throw failure();
 const binding=developmentBinding(input);
 if(canonicalJson(input.freeze.binding)!==canonicalJson(binding))throw failure();
 const model=JSON.parse(input.modelBytes),protocol=JSON.parse(input.protocolBytes);
 validateInstrumentationManifest(input.modelBytes,input.baselineModelBytes,input.traceProtocolBytes);
 const baseline=JSON.parse(input.baselineBytes);
 validatePredictionArtifact(baseline,{protocol,cases:input.devBytes.toString('utf8').trimEnd().split('\n').map(JSON.parse),split:'dev',protocolSha256:binding.protocolSha256,corpusSha256:binding.devSha256});
 if(model.id!==TOKEN_NER_VERSION||model.productionEnabled!==false||model.automaticDownload!==false||protocol.annotationGuideSha256!==sha(input.guideBytes))throw failure();
 const rows=input.devBytes.toString('utf8').trimEnd().split('\n').map(line=>JSON.parse(line));
 if(rows.length!==60)throw failure();validateCases(rows,{protocol,split:'dev'});
 return {binding,protocol,rows,baseline};
}
export async function reserveOutput(directory,parent){
 const allowed=await realpath(parent),out=path.resolve(directory);
 if(path.dirname(out)!==allowed||await realpath(path.dirname(out))!==allowed)throw failure();
 await mkdir(out);return out; // Atomic exclusive reservation, retained on any failure.
}
const FAILURE_CODES=new Set(['BACKEND_FAILURE','WORKER_METADATA','INVALID_OUTPUT','INVARIANCE_MISMATCH','IDENTITY_CHANGED','PUBLICATION_FAILED','UNKNOWN']);
async function writeFailure(directory,binding,caseResults,failureCode){
 if(!FAILURE_CODES.has(failureCode))throw failure();
 const artifact={candidateId:TOKEN_NER_VERSION,binding,diagnosticOnly:true,productionEnabled:false,invariancePassed:false,failureCode,completedCases:caseResults.length,predictions:caseResults.map(({id,result})=>({id,...result})),caseResults};
 await writeFile(path.join(directory,'failure.json'),JSON.stringify(artifact,null,2)+'\n',{flag:'wx',mode:0o600});
}
export async function runDevelopment(input,{startWorker=startTokenNerWorker,failureDirectory}={}){
 const admitted=validateDevelopmentRun(input);
 const batches=[];let metadata,worker,failureCode='BACKEND_FAILURE';
 try{
  worker=await startWorker({reviewedManifestSha256:admitted.binding.modelManifestSha256});
  const ready=await worker.ready;failureCode='WORKER_METADATA';metadata=copyPrivacyJson(ready);
  if(metadata.candidateId!==TOKEN_NER_VERSION||metadata.manifestSha256!==admitted.binding.modelManifestSha256||metadata.executionProvider!=='CPUExecutionProvider'||metadata.cpuThreads!==1||!Number.isInteger(metadata.peakRssBytes)||metadata.peakRssBytes<0||metadata.peakRssBytes>1073741824)throw failure();
  for(const row of admitted.rows){
   failureCode='BACKEND_FAILURE';const output=await worker.request(projectPrivacyCase(row));
   failureCode='INVALID_OUTPUT';const batch=copyPrivacyJson(output);
   exactFields(batch,['result','telemetry','latencyMs','peakRssBytes']);validateTelemetry(batch.telemetry);
   exactFields(batch.result,['status','reasonCategory','detections']);
   if(!Number.isFinite(batch.latencyMs)||batch.latencyMs<0||!Number.isInteger(batch.peakRssBytes)||batch.peakRssBytes<0||batch.peakRssBytes>1073741824)throw failure();
   validatePredictionArtifact({candidateId:TOKEN_NER_VERSION,protocolSha256:admitted.binding.protocolSha256,corpusSha256:admitted.binding.devSha256,predictions:[{id:row.id,...batch.result}]},{protocol:admitted.protocol,cases:[row],split:'dev',protocolSha256:admitted.binding.protocolSha256,corpusSha256:admitted.binding.devSha256});
   batches.push(batch);
  }
 const artifact={candidateId:TOKEN_NER_VERSION,protocolSha256:admitted.binding.protocolSha256,corpusSha256:admitted.binding.devSha256,predictions:admitted.rows.map((row,i)=>({id:row.id,...batches[i].result}))};
 failureCode='INVARIANCE_MISMATCH';assertResultInvariance(admitted.baseline.predictions,artifact.predictions);
 const statuses={complete:0,blocked:0,reasons:{}};
 for(const prediction of artifact.predictions){statuses[prediction.status]++;if(prediction.reasonCategory)statuses.reasons[prediction.reasonCategory]=(statuses.reasons[prediction.reasonCategory]??0)+1;}
 return {artifact,execution:{binding:admitted.binding,metadata,diagnosticOnly:true,invariancePassed:true,productionEnabled:false,cases:60,statuses,goldPassedToCandidate:false,operationalFlagsFromGold:false,latenciesMs:batches.map(b=>b.latencyMs),peakRssBytes:Math.max(metadata.peakRssBytes,...batches.map(b=>b.peakRssBytes)),caseResults:admitted.rows.map((row,i)=>({id:row.id,...batches[i]})),limitations:['Exit zero means completed diagnostic, not privacy eligibility.','No product route, egress grant or 8 GB acceptance.','macOS network/file-write/eval denial is not a general filesystem sandbox.','No retries or automatic download; overflow and unsupported mappings block.']}};
 }catch{
  if(failureDirectory)await writeFailure(failureDirectory,admitted.binding,batches.map((batch,i)=>({id:admitted.rows[i].id,...batch})),failureCode);
  throw failureCode==='INVARIANCE_MISMATCH'?Error('instrumentation_invariance_failed'):failure();
 }finally{try{worker?.close();}catch{/* No raw backend exception is serialized. */}}
}
export async function main(args=process.argv.slice(2)){
 if(!args.length||args.length===1&&args[0]==='--plan'){console.log(JSON.stringify({action:'plan',candidateId:TOKEN_NER_VERSION,productionEnabled:false,cases:60,maximumRequests:60,requires:'--dev --freeze REVIEWED_FILE --out-dir NEW_ARTIFACT_DIRECTORY',downloads:false}));return 0;}
 if(args.length!==5||args[0]!=='--dev'||args[1]!=='--freeze'||args[3]!=='--out-dir')throw failure();
 const freeze=JSON.parse(await readFile(args[2]));
 if(freeze.approvedForDevelopmentRun!==true||typeof freeze.independentReviewer!=='string'||!freeze.independentReviewer.trim())throw failure();
 const [identity,modelBytes,protocolBytes,guideBytes,devBytes,baselineBytes,baselineModelBytes,traceProtocolBytes]=await Promise.all([
  executionIdentity(),readFile(path.join(root,'resources/privacy-token-ner-trace-v1.json')),
  readFile(path.join(root,'eval/privacy-v2/protocol.json')),readFile(path.join(root,'eval/privacy-v2/annotation-guide.md')),readFile(path.join(root,DEV_PATH)),readFile(path.join(root,BASELINE_PATH)),readFile(path.join(root,'resources/privacy-token-ner-candidate-v1.json')),readFile(path.join(root,'resources/privacy-token-ner-trace-protocol-v1.json'))]);
 if(sha(devBytes)!==DEV_SHA256||sha(baselineBytes)!==BASELINE_SHA256)throw failure();
 const input={freeze,identity,modelBytes,protocolBytes,guideBytes,devBytes,baselineBytes,baselineModelBytes,traceProtocolBytes};validateDevelopmentRun(input);
 const out=await reserveOutput(args[4],path.join(root,'artifacts/privacy'));
 const result=await runDevelopment(input,{failureDirectory:out});
 let publicationCode='IDENTITY_CHANGED';
 try{
 if(canonicalJson(identity)!==canonicalJson(await executionIdentity()))throw failure();
 for(const [file,bytes] of [['resources/privacy-token-ner-trace-v1.json',modelBytes],[BASELINE_PATH,baselineBytes],['resources/privacy-token-ner-candidate-v1.json',baselineModelBytes],['resources/privacy-token-ner-trace-protocol-v1.json',traceProtocolBytes],['eval/privacy-v2/protocol.json',protocolBytes],['eval/privacy-v2/annotation-guide.md',guideBytes],[DEV_PATH,devBytes]])if(sha(await readFile(path.join(root,file)))!==sha(bytes))throw failure();
 publicationCode='PUBLICATION_FAILED';
 for(const [name,data] of [['predictions',result.artifact],['execution',result.execution]])await writeFile(path.join(out,`${name}.json`),JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});
 }catch{await writeFailure(out,result.execution.binding,result.execution.caseResults,publicationCode);throw failure();}
 console.log(JSON.stringify({candidateId:TOKEN_NER_VERSION,diagnosticOnly:true,cases:60,statuses:result.execution.statuses}));return 0;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{process.exitCode=await main();}catch{console.error('privacy_token_ner_run_failed');process.exitCode=2;}}

export function validateInstrumentationManifest(modelBytes,baselineModelBytes,traceProtocolBytes){
 const model=JSON.parse(modelBytes),baseline=JSON.parse(baselineModelBytes),trace=JSON.parse(traceProtocolBytes);
 if(model.id!==TOKEN_NER_VERSION||baseline.id!=='rampart-q4-token-ner-local-v1'||model.instrumentation?.baselineManifestSha256!==sha(baselineModelBytes)||model.instrumentation?.protocolSha256!==sha(traceProtocolBytes)||trace.baselinePredictionsSha256!==BASELINE_SHA256)throw failure();
 exactFields(model.instrumentation,['protocol','protocolSha256','baselineManifestSha256','historicalBaselineMetadata','alreadyPrepared','noAdditionalDownloads']);
 if(model.instrumentation.protocol!=='resources/privacy-token-ner-trace-protocol-v1.json'||model.instrumentation.historicalBaselineMetadata!==true||model.instrumentation.alreadyPrepared!==true||model.instrumentation.noAdditionalDownloads!==true||model.status!=='instrumented-diagnostic-not-run'||model.limitations?.[0]!=='Baseline ONNX load was measured; instrumented tensor/operator compatibility and telemetry invariance remain unmeasured.'||model.limitations?.at(-1)!=='Reuses previously prepared and measured v1 weights; this instrumented version has not run inference. No additional download.')throw failure();
 model.status=baseline.status;model.limitations[0]=baseline.limitations[0];model.limitations[model.limitations.length-1]=baseline.limitations.at(-1);
 delete model.instrumentation;model.id=baseline.id;if(canonicalJson(model)!==canonicalJson(baseline))throw failure();
}
export function assertResultInvariance(baseline,predictions){
 if(!Array.isArray(baseline)||!Array.isArray(predictions)||baseline.length!==60||predictions.length!==60||canonicalJson(baseline)!==canonicalJson(predictions))throw Error('instrumentation_invariance_failed');
}
