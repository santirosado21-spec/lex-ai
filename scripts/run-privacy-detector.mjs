// Offline public/synthetic experiment. Labels stay in this evaluator, outside candidate IPC.
import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {validateCases,scorePredictions} from './eval-privacy.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
export const CANDIDATE_ID='local-rules-baseline-v1';
export const CANDIDATE_SOURCES=['server/privacy/detector.mjs','server/privacy/provenance.mjs','server/canonical-json.mjs','scripts/privacy-candidate-worker.mjs','scripts/run-privacy-detector.mjs','scripts/eval-privacy.mjs'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

// Deliberate whitelist: never derive operational flags from expectedStatus/blockReason/entities.
export function projectPrivacyCase(row) {
  const scope=value=>value===null?null:{workspaceId:value.workspaceId,matterId:value.matterId,threadId:value.threadId};
  return {scope:scope(row.scope),segments:row.segments.map(segment=>({
    id:segment.id,path:segment.path,text:segment.text,
    originScope:scope(segment.originScope),classification:segment.classification,
  }))};
}

export function startCandidateWorker({timeoutMs=15000}={}) {
  const child=fork(new URL('./privacy-candidate-worker.mjs',import.meta.url),[],{
    stdio:['ignore','ignore','ignore','ipc'],execArgv:[],env:{PATH:'/usr/bin:/bin',LANG:'C'},serialization:'json',
  });
  let pending=false,dead=false;
  child.on('error',()=>{dead=true;});child.on('exit',()=>{dead=true;});
  return {pid:child.pid,
    request(inputs){
      if(pending||dead)return Promise.reject(Error('candidate_unavailable'));
      pending=true;
      return new Promise((resolve,reject)=>{
        let settled=false;
        const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);child.off('message',message);child.off('error',failed);child.off('exit',failed);pending=false;error?reject(error):resolve(result);};
        const failed=()=>finish(Error('candidate_process_failed'));
        const message=result=>result?.errorCategory||!Array.isArray(result?.results)||result.results.length!==inputs.length?finish(Error('candidate_failed')):finish(null,result);
        const timer=setTimeout(()=>{dead=true;child.kill();finish(Error('candidate_timeout'));},timeoutMs);
        child.once('message',message);child.once('error',failed);child.once('exit',failed);
        child.send({inputs},error=>{if(error)finish(Error('candidate_input_failed'));});
      });
    },
    async close(){if(dead)return;await new Promise(resolve=>{child.once('exit',resolve);if(child.connected)child.disconnect();child.kill();});},
  };
}

export async function runCandidateBatch(inputs,options) {
  const worker=startCandidateWorker(options);
  try{return await worker.request(inputs);}finally{await worker.close();}
}

export async function candidateSourceHashes() {
  return Object.fromEntries(await Promise.all(CANDIDATE_SOURCES.map(async file=>[file,sha(await readFile(path.join(root,file)))])));
}

export async function assertCandidateFreeze(freeze) {
  const hashes=await candidateSourceHashes();
  const manifest=JSON.parse(await readFile(path.join(root,'eval/privacy/manifest.json'),'utf8'));
  if(freeze?.candidateId!==CANDIDATE_ID||freeze?.approvedForSingleHeldoutRun!==true||freeze?.productionEnabled!==false||
    freeze.protocolSha256!==manifest.protocol.sha256||freeze.heldoutSha256!==manifest.splits.heldout.sha256||
    !freeze.sourceHashes||Object.keys(freeze.sourceHashes).length!==CANDIDATE_SOURCES.length||
    CANDIDATE_SOURCES.some(file=>freeze.sourceHashes[file]!==hashes[file]))throw Error('candidate_not_frozen');
  return hashes;
}

async function confinedEvalFile(reference) {
  if(typeof reference?.file!=='string'||path.basename(reference.file)!==reference.file)throw Error('invalid_eval_reference');
  const directory=await realpath(path.join(root,'eval/privacy'));
  const filename=await realpath(path.join(directory,reference.file));
  if(path.dirname(filename)!==directory)throw Error('eval_reference_escaped');
  const bytes=await readFile(filename);if(sha(bytes)!==reference.sha256)throw Error('eval_hash_mismatch');
  return bytes;
}

export async function main(args=process.argv.slice(2)) {
  const options={};
  for(let i=0;i<args.length;i+=2){if(!['--split','--out-dir','--freeze'].includes(args[i])||options[args[i]]||!args[i+1])throw Error('invalid_arguments');options[args[i]]=args[i+1];}
  const split=options['--split'];if(!['dev','heldout'].includes(split)||!options['--out-dir'])throw Error('split_and_new_output_directory_required');
  let sourceHashes=await candidateSourceHashes();
  if(split==='heldout'){
    if(!options['--freeze'])throw Error('heldout_requires_reviewed_freeze');
    sourceHashes=await assertCandidateFreeze(JSON.parse(await readFile(options['--freeze'],'utf8')));
  }
  const out=path.resolve(options['--out-dir']),artifacts=path.join(root,'artifacts/privacy');
  if(path.dirname(out)!==artifacts)throw Error('output_must_be_a_new_direct_child_of_artifacts_privacy');
  await mkdir(artifacts,{recursive:true});
  const canonicalArtifacts=await realpath(artifacts);
  const parent=await realpath(path.dirname(out));
  if(parent!==canonicalArtifacts)throw Error('output_must_be_in_artifacts_privacy');
  await mkdir(out); // Never overwrite a previous experiment or evaluation input.
  const manifest=JSON.parse(await readFile(path.join(root,'eval/privacy/manifest.json'),'utf8'));
  const protocol=JSON.parse(await confinedEvalFile(manifest.protocol));
  const bytes=await confinedEvalFile(manifest.splits[split]);
  const rows=bytes.toString('utf8').trimEnd().split('\n').map(line=>JSON.parse(line));
  validateCases(rows,{protocol,split});
  const batch=await runCandidateBatch(rows.map(projectPrivacyCase));
  const artifact={candidateId:CANDIDATE_ID,protocolSha256:manifest.protocol.sha256,corpusSha256:manifest.splits[split].sha256,
    predictions:rows.map((row,index)=>({id:row.id,status:batch.results[index].status,detections:batch.results[index].detections}))};
  if(JSON.stringify(sourceHashes)!==JSON.stringify(await candidateSourceHashes()))throw Error('candidate_changed_during_run');
  const report=scorePredictions({protocol,cases:rows,split,artifact,protocolSha256:artifact.protocolSha256,corpusSha256:artifact.corpusSha256});
  const execution={candidateId:CANDIDATE_ID,split,measuredAt:new Date().toISOString(),node:process.version,sourceHashes,
    candidateVersion:batch.version,cases:rows.length,candidateInputFields:['scope','segments.id','segments.path','segments.text','segments.originScope','segments.classification'],
    goldPassedToCandidate:false,operationalFlagsFromGold:false,latenciesMs:batch.latenciesMs,peakRssBytes:batch.peakRssBytes,
    limitations:['Rules-only baseline, no entity/context model evaluated.','Corpus v1 lacks explicit format/extraction/ambiguity/failure stimuli; gold flags are not injected.','Trusted fixture registration is not production data-import integration.','Routing and restoration require separate integration tests; this score grants no egress.']};
  await writeFile(path.join(out,'predictions.json'),JSON.stringify(artifact,null,2)+'\n',{flag:'wx'});
  await writeFile(path.join(out,'score.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  await writeFile(path.join(out,'execution.json'),JSON.stringify(execution,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({candidateId:CANDIDATE_ID,split,cases:rows.length,status:report.experimentalGate.status,failures:report.experimentalGate.failures}));
  return report.experimentalGate.status==='eligible-for-integration-evaluation'?0:split==='dev'?3:1;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{process.exitCode=await main();}catch{console.error('Detector experiment failed; no approval recorded.');process.exitCode=2;}
}
