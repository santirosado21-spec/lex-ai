// Offline development diagnostic only: no retained acceptance route or product promotion.
import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {canonicalJson} from '../server/canonical-json.mjs';
import {copyPrivacyJson,exactFields,projectPrivacyCase} from '../server/privacy/operational-v2.mjs';
import {validateCases,validatePredictionArtifact,scorePredictions} from './eval-privacy-v2.mjs';
import {runtimeIdentity,CANDIDATE_SOURCES} from './run-privacy-detector-v2.mjs';
import {TOKEN_NER_VERSION,startTokenNerWorker} from '../server/privacy/token-ner-candidate.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export const DEV_PATH='eval/privacy-development-v3/cases.jsonl';
export const DEV_SHA256='511f2da926df75a84a9624147d61bbff189bfa72cd5c931f71f437d41a83552d';
export const SOURCES=Object.freeze([...new Set([...CANDIDATE_SOURCES,
 'scripts/run-privacy-ablation-v3.mjs', // sandbox explicitly denies this evaluator
 'scripts/privacy-token-ner-worker.py','server/privacy/token-ner-candidate.mjs',
 'resources/privacy-token-ner-candidate-v1.json','tests/privacy-token-ner.test.mjs',
 'scripts/run-privacy-token-ner-v1.mjs','tests/privacy-token-ner-runner.test.mjs'])].sort());
const sha=b=>createHash('sha256').update(b).digest('hex');
const failure=()=>Error('privacy_token_ner_run_failed');
export async function executionIdentity(){
 const sources=Object.fromEntries(await Promise.all(SOURCES.map(async f=>[f,sha(await readFile(path.join(root,f)))])));
 return {sourceHashes:sources,runtime:await runtimeIdentity()};
}
export function developmentBinding({identity,modelBytes,protocolBytes,guideBytes,devBytes}){
 return {version:1,candidateId:TOKEN_NER_VERSION,identity,modelManifestSha256:sha(modelBytes),protocolSha256:sha(protocolBytes),guideSha256:sha(guideBytes),devSha256:sha(devBytes),caseCount:60,maximumRequests:60,timeoutMs:15000,rssLimitBytes:1073741824,productionEnabled:false};
}
// Pure gate for injected test bytes. The real CLI additionally pins the independently
// authored DEV SHA and fixed paths; no caller can select a heldout corpus or model path.
export function validateDevelopmentRun(input){
 if(input?.freeze?.approvedForDevelopmentRun!==true||typeof input.freeze.independentReviewer!=='string'||!input.freeze.independentReviewer.trim())throw failure();
 const binding=developmentBinding(input);
 if(canonicalJson(input.freeze.binding)!==canonicalJson(binding))throw failure();
 const model=JSON.parse(input.modelBytes),protocol=JSON.parse(input.protocolBytes);
 if(model.id!==TOKEN_NER_VERSION||model.productionEnabled!==false||model.automaticDownload!==false||protocol.annotationGuideSha256!==sha(input.guideBytes))throw failure();
 const rows=input.devBytes.toString('utf8').trimEnd().split('\n').map(line=>JSON.parse(line));
 if(rows.length!==60)throw failure();validateCases(rows,{protocol,split:'dev'});
 return {binding,protocol,rows};
}
export async function reserveOutput(directory,parent){
 const allowed=await realpath(parent),out=path.resolve(directory);
 if(path.dirname(out)!==allowed||await realpath(path.dirname(out))!==allowed)throw failure();
 await mkdir(out);return out; // Atomic exclusive reservation, retained on any failure.
}
export async function runDevelopment(input,{startWorker=startTokenNerWorker}={}){
 const admitted=validateDevelopmentRun(input),worker=await startWorker({reviewedManifestSha256:admitted.binding.modelManifestSha256});
 const batches=[];let metadata;
 try{
  metadata=copyPrivacyJson(await worker.ready);
  if(metadata.candidateId!==TOKEN_NER_VERSION||metadata.manifestSha256!==admitted.binding.modelManifestSha256||metadata.executionProvider!=='CPUExecutionProvider'||metadata.cpuThreads!==1||!Number.isInteger(metadata.peakRssBytes)||metadata.peakRssBytes<0||metadata.peakRssBytes>1073741824)throw failure();
  for(const row of admitted.rows){
   const batch=copyPrivacyJson(await worker.request(projectPrivacyCase(row)));
   exactFields(batch,['result','latencyMs','peakRssBytes']);
   exactFields(batch.result,['status','reasonCategory','detections']);
   if(!Number.isFinite(batch.latencyMs)||batch.latencyMs<0||!Number.isInteger(batch.peakRssBytes)||batch.peakRssBytes<0||batch.peakRssBytes>1073741824)throw failure();
   validatePredictionArtifact({candidateId:TOKEN_NER_VERSION,protocolSha256:admitted.binding.protocolSha256,corpusSha256:admitted.binding.devSha256,predictions:[{id:row.id,...batch.result}]},{protocol:admitted.protocol,cases:[row],split:'dev',protocolSha256:admitted.binding.protocolSha256,corpusSha256:admitted.binding.devSha256});
   batches.push(batch);
  }
 }finally{worker.close();}
 const artifact={candidateId:TOKEN_NER_VERSION,protocolSha256:admitted.binding.protocolSha256,corpusSha256:admitted.binding.devSha256,predictions:admitted.rows.map((row,i)=>({id:row.id,...batches[i].result}))};
 const score=scorePredictions({protocol:admitted.protocol,cases:admitted.rows,split:'dev',artifact,protocolSha256:artifact.protocolSha256,corpusSha256:artifact.corpusSha256});
 const statuses={complete:0,blocked:0,reasons:{}};
 for(const prediction of artifact.predictions){statuses[prediction.status]++;if(prediction.reasonCategory)statuses.reasons[prediction.reasonCategory]=(statuses.reasons[prediction.reasonCategory]??0)+1;}
 return {artifact,score,execution:{binding:admitted.binding,metadata,diagnosticOnly:true,productionEnabled:false,cases:60,statuses,goldPassedToCandidate:false,operationalFlagsFromGold:false,latenciesMs:batches.map(b=>b.latencyMs),peakRssBytes:Math.max(metadata.peakRssBytes,...batches.map(b=>b.peakRssBytes)),caseResults:admitted.rows.map((row,i)=>({id:row.id,...batches[i]})),limitations:['Exit zero means completed diagnostic, not privacy eligibility.','No product route, egress grant or 8 GB acceptance.','macOS network/file-write/eval denial is not a general filesystem sandbox.','No retries or automatic download; overflow and unsupported mappings block.']}};
}
export async function main(args=process.argv.slice(2)){
 if(!args.length||args.length===1&&args[0]==='--plan'){console.log(JSON.stringify({action:'plan',candidateId:TOKEN_NER_VERSION,productionEnabled:false,cases:60,maximumRequests:60,requires:'--dev --freeze REVIEWED_FILE --out-dir NEW_ARTIFACT_DIRECTORY',downloads:false}));return 0;}
 if(args.length!==5||args[0]!=='--dev'||args[1]!=='--freeze'||args[3]!=='--out-dir')throw failure();
 const freeze=JSON.parse(await readFile(args[2]));
 if(freeze.approvedForDevelopmentRun!==true||typeof freeze.independentReviewer!=='string'||!freeze.independentReviewer.trim())throw failure();
 const [identity,modelBytes,protocolBytes,guideBytes,devBytes]=await Promise.all([
  executionIdentity(),readFile(path.join(root,'resources/privacy-token-ner-candidate-v1.json')),
  readFile(path.join(root,'eval/privacy-v2/protocol.json')),readFile(path.join(root,'eval/privacy-v2/annotation-guide.md')),readFile(path.join(root,DEV_PATH))]);
 if(sha(devBytes)!==DEV_SHA256)throw failure();
 const input={freeze,identity,modelBytes,protocolBytes,guideBytes,devBytes};validateDevelopmentRun(input);
 const out=await reserveOutput(args[4],path.join(root,'artifacts/privacy'));
 const result=await runDevelopment(input);
 if(canonicalJson(identity)!==canonicalJson(await executionIdentity()))throw failure();
 for(const [file,bytes] of [['resources/privacy-token-ner-candidate-v1.json',modelBytes],['eval/privacy-v2/protocol.json',protocolBytes],['eval/privacy-v2/annotation-guide.md',guideBytes],[DEV_PATH,devBytes]])if(sha(await readFile(path.join(root,file)))!==sha(bytes))throw failure();
 for(const [name,data] of [['predictions',result.artifact],['score',result.score],['execution',result.execution]])await writeFile(path.join(out,`${name}.json`),JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log(JSON.stringify({candidateId:TOKEN_NER_VERSION,diagnosticOnly:true,cases:60,statuses:result.execution.statuses}));return 0;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{process.exitCode=await main();}catch{console.error('privacy_token_ner_run_failed');process.exitCode=2;}}
