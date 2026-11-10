import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm,readdir,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {developmentBinding,validateDevelopmentRun,runDevelopment,reserveOutput,main,SOURCES} from '../scripts/run-privacy-token-ner-v1.mjs';
import {TOKEN_NER_VERSION} from '../server/privacy/token-ner-candidate.mjs';
async function fixture(){
 const [modelBytes,protocolBytes,guideBytes]=await Promise.all(['resources/privacy-token-ner-candidate-v1.json','eval/privacy-v2/protocol.json','eval/privacy-v2/annotation-guide.md'].map(f=>readFile(f)));
 const scope={workspaceId:'SYNTH_W',matterId:'SYNTH_M',threadId:'SYNTH_T'};
 const rows=Array.from({length:60},(_,i)=>({id:`synthetic_${i}`,split:'dev',templateGroup:`fixture_group_${i}`,synthetic:true,scope,segments:[{id:'s',path:'/content',text:'Texto genérico.',originScope:scope,classification:'synthetic'}],entities:[],expectedStatus:'complete',blockReason:null,preserve:[],operational:{processorStatus:'ok',segments:[{id:'s',mediaType:'text/plain',extractionStatus:'complete',assessment:'known'}]}}));
 const value={modelBytes,protocolBytes,guideBytes,devBytes:Buffer.from(rows.map(r=>JSON.stringify(r)).join('\n')+'\n'),identity:{sourceHashes:{synthetic:'hash'},runtime:{synthetic:'runtime'}}};
 value.freeze={approvedForDevelopmentRun:true,independentReviewer:'synthetic reviewer',binding:developmentBinding(value)};return value;
}
function backend(f,{result={status:'complete',reasonCategory:null,detections:[]},metadataPatch={},batchPatch={},onRequest=()=>{},onClose=()=>{}}={}){
 return async({reviewedManifestSha256})=>{assert.equal(reviewedManifestSha256,f.freeze.binding.modelManifestSha256);return {ready:Promise.resolve({candidateId:TOKEN_NER_VERSION,manifestSha256:reviewedManifestSha256,executionProvider:'CPUExecutionProvider',cpuThreads:1,peakRssBytes:100,...metadataPatch}),async request(input){onRequest(input);return {result,latencyMs:1,peakRssBytes:200,...batchPatch};},close:onClose};};
}
test('plan defaults do not load; heldout, arbitrary paths/options fail',async()=>{
 const p=spawnSync(process.execPath,['scripts/run-privacy-token-ner-v1.mjs'],{encoding:'utf8',timeout:5000});assert.equal(p.status,0,p.stderr);assert.equal(JSON.parse(p.stdout).action,'plan');assert.equal(JSON.parse(p.stdout).downloads,false);
 for(const args of [['--heldout'],['--dev'],['--dev','--dataset','/tmp/gold'],['--dev','--freeze','x','--out-dir','x','--retry']])await assert.rejects(main(args));
 for(const file of ['scripts/run-privacy-token-ner-v1.mjs','scripts/privacy-token-ner-worker.py','server/privacy/token-ner-candidate.mjs','resources/privacy-token-ner-candidate-v1.json','tests/privacy-token-ner.test.mjs','server/privacy/detector.mjs','scripts/eval-privacy-v2.mjs','scripts/run-privacy-detector-v2.mjs'])assert.ok(SOURCES.includes(file));
});
test('review and exact identity corruption denied before any backend',async()=>{
 const f=await fixture();assert.equal(validateDevelopmentRun(f).rows.length,60);let calls=0;
 for(const patch of [{freeze:{...f.freeze,approvedForDevelopmentRun:false}},{freeze:{...f.freeze,independentReviewer:''}},{identity:{changed:true}},...['modelBytes','protocolBytes','guideBytes','devBytes'].map(key=>({[key]:Buffer.from('corrupt')}))])await assert.rejects(runDevelopment({...f,...patch},{startWorker:async()=>{calls++;}}));
 assert.equal(calls,0);
});
test('60 cases and valid operational corpus are required even with matching bytes',async()=>{
 const f=await fixture();for(const change of [rows=>rows.pop(),rows=>rows.push(rows[0]),rows=>rows[1].id=rows[0].id,rows=>rows[0].split='heldout',rows=>rows[0].segments[0].classification='public']){
  const rows=f.devBytes.toString().trimEnd().split('\n').map(JSON.parse);change(rows);const changed={...f,devBytes:Buffer.from(rows.map(r=>JSON.stringify(r)).join('\n'))};changed.freeze={...f.freeze,binding:developmentBinding(changed)};
  // Public classification alone is valid only with compatible corpus semantics; use invalid operational field too.
  if(rows[0].segments[0].classification==='public'){rows[0].operational.extra=true;changed.devBytes=Buffer.from(rows.map(r=>JSON.stringify(r)).join('\n'));changed.freeze.binding=developmentBinding(changed);}
  assert.throws(()=>validateDevelopmentRun(changed));
 }
});
test('sequential 60 requests receive only operational input; blocked results remain diagnostic',async()=>{
 const f=await fixture();let calls=0,closed=0;
 const result=await runDevelopment(f,{startWorker:backend(f,{result:{status:'blocked',reasonCategory:'ambiguous_context',detections:[]},onRequest(input){calls++;assert.deepEqual(Object.keys(input).sort(),['operational','scope','segments']);assert.equal(Object.hasOwn(input,'entities'),false);},onClose(){closed++;}})});
 assert.equal(calls,60);assert.equal(closed,1);assert.equal(result.execution.statuses.blocked,60);assert.equal(result.execution.statuses.reasons.ambiguous_context,60);assert.equal(result.execution.productionEnabled,false);assert.equal(result.execution.diagnosticOnly,true);assert.equal(result.execution.caseResults.length,60);
});
test('bad readiness, memory, status or ranges close once without continuing/retrying',async()=>{
 const f=await fixture();for(const patch of [{metadataPatch:{manifestSha256:'bad'}},{metadataPatch:{cpuThreads:2}},{batchPatch:{peakRssBytes:1073741825}},{batchPatch:{latencyMs:NaN}},{result:{status:'unknown',reasonCategory:null,detections:[]}},{result:{status:'complete',reasonCategory:null,detections:[{segmentId:'s',start:0,end:9999,category:'person'}]}},{result:{status:'complete',reasonCategory:null,detections:[],raw:'extra'}}]){
  let calls=0,closed=0;await assert.rejects(runDevelopment(f,{startWorker:backend(f,{...patch,onRequest(){calls++;},onClose(){closed++;}})}));assert.ok(calls<=1);assert.equal(closed,1);
 }
 let starts=0,closed=0;await assert.rejects(runDevelopment(f,{startWorker:async()=>{starts++;return {ready:Promise.reject(Error('synthetic timeout')),close(){closed++;}};}}));assert.equal(starts,1);assert.equal(closed,1);
});
test('parallel output reservations have exactly one winner and never overwrite/retry',async()=>{
 const parent=await realpath(await mkdtemp(path.join(tmpdir(),'token-ner-run-')));try{
  const target=path.join(parent,'new');const results=await Promise.allSettled([reserveOutput(target,parent),reserveOutput(target,parent)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);await assert.rejects(reserveOutput(target,parent));assert.deepEqual(await readdir(parent),['new']);await assert.rejects(reserveOutput(path.join(parent,'nested','out'),parent));
 }finally{await rm(parent,{recursive:true,force:true});}
});
