import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createTokenNerDetector as baselineDetector} from '../server/privacy/token-ner-candidate.mjs';
import {createTokenNerDetector,validateTelemetry,TOKEN_NER_VERSION} from '../server/privacy/token-ner-trace-candidate.mjs';
import {developmentBinding,runDevelopment,assertResultInvariance,validateInstrumentationManifest,main} from '../scripts/run-privacy-token-ner-trace-v1.mjs';
const scope={workspaceId:'SYNTH_W',matterId:'SYNTH_M',threadId:'SYNTH_T'};
const input=()=>({scope,segments:[{id:'s',path:'/content',text:'Texto genérico.',originScope:scope,classification:'synthetic'}],operational:{processorStatus:'ok',segments:[{id:'s',mediaType:'text/plain',extractionStatus:'complete',assessment:'known'}]}});
const complete={status:'complete',reasonCategory:null,detections:[]};
const telemetry={composition:'COMPLETE',backend:{code:'COMPLETE',streamIndex:0,streamKind:'path',entityKind:null}};
test('pure Python instrumentation preserves values/exceptions and exposes only finite causes',()=>{
 const code=`import runpy,sys
b=runpy.run_path('scripts/privacy-token-ner-worker.py');t=runpy.run_path('scripts/privacy-token-ner-trace-worker.py')
def rows(label):return [[20.0 if i==j else -20.0 for i in range(35)] for j in [0,label,0]]
def run(m,args):
 try:return ('ok',m['decode'](*args))
 except Exception as e:
  if m is t:m['terminal_diagnostic'](e)
  return (type(e).__name__,str(e))
base=('X',[(0,0),(0,1),(0,0)],[1,0,1],[2,5,3])
for label,expected in [(0,'UNKNOWN'),(1,'UNKNOWN'),(2,'BIO_ORPHAN'),(9,'UNMAPPED')]:
 t['TRACE'].update(code='UNKNOWN',entityKind=None)
 assert run(b,(*base,rows(label)))==run(t,(*base,rows(label)))
 assert t['TRACE']['code']==expected
 if expected=='UNMAPPED':assert t['TRACE']['entityKind']=='URL'
for args,expected in [((*base,[[0.0]*35]*3),'LOW_CONFIDENCE'),((*base,[[float('nan')]*35]*3),'SHAPE'),(('X',base[1],base[2],[2,1,3],rows(0)),'UNK'),(('XY',base[1],base[2],base[3],rows(0)),'COVERAGE')]:
 t['TRACE'].update(code='UNKNOWN',entityKind=None)
 assert run(b,args)==run(t,args);assert t['TRACE']['code']==expected
t['TRACE'].update(code='UNKNOWN',entityKind=None)
compound=('X Y',[(0,0),(0,1),(2,3),(0,0)],[1,0,0,1],[2,5,6,3],[[20.0 if i==j else -20.0 for i in range(35)] for j in [0,1,8,0]])
assert run(b,compound)==run(t,compound);assert t['TRACE']['code']=='BIO_INVALID'
t['TRACE'].update(code='UNKNOWN',entityKind=None)
overflow=('X',[(0,0)]*513,[1]*513,[2]*513,[[0.0]*35]*513)
assert run(b,overflow)==run(t,overflow);assert t['TRACE']['code']=='OVERFLOW'
assert 'onnxruntime' not in sys.modules
`;
 const p=spawnSync('python3',['-I','-B','-c',code],{encoding:'utf8',timeout:5000});assert.equal(p.status,0,p.stderr);
});
test('Node composition result invariance for complete, path, unsupported, invalid and operational',async()=>{
 for(const output of [complete,{status:'blocked',reasonCategory:'ambiguous_context',detections:[]},{status:'blocked',reasonCategory:'detector_failure',detections:[]},{...complete,detections:[{segmentId:'P0',start:1,end:8,category:'person',score:.9}]},{...complete,detections:[{segmentId:'T0',start:0,end:999,category:'person',score:.9}]}]){
  const baseline=baselineDetector({backend:{async detect(){return output;}}}),trace=createTokenNerDetector({backend:{async detect(){return output;}}});assert.deepEqual(await trace.detect(input()),await baseline.detect(input()));
 }
 const value=input();value.operational.processorStatus='failed';let calls=0;const traced=createTokenNerDetector({backend:{async detect(){calls++;return complete;}}});const base=baselineDetector({backend:{async detect(){throw Error('should not call');}}});assert.deepEqual(await traced.detect(value),await base.detect(value));assert.equal(traced.diagnostic,'OPERATIONAL');assert.equal(calls,0);
});
test('telemetry whitelist refuses raw text, token IDs, arbitrary categories/codes and out-of-bound indices',()=>{
 assert.deepEqual(validateTelemetry(telemetry),telemetry);
 for(const value of [{...telemetry,text:'forbidden'},{...telemetry,composition:'arbitrary'},{...telemetry,backend:{...telemetry.backend,tokenIds:[1]}},{...telemetry,backend:{...telemetry.backend,code:'raw text'}},{...telemetry,backend:{...telemetry.backend,entityKind:'arbitrary'}},{...telemetry,backend:{...telemetry.backend,streamIndex:256}}])assert.throws(()=>validateTelemetry(value));
});
async function fixture(){
 const [modelBytes,baselineModelBytes,traceProtocolBytes,protocolBytes,guideBytes]=await Promise.all(['resources/privacy-token-ner-trace-v1.json','resources/privacy-token-ner-candidate-v1.json','resources/privacy-token-ner-trace-protocol-v1.json','eval/privacy-v2/protocol.json','eval/privacy-v2/annotation-guide.md'].map(f=>readFile(f)));
 const rows=Array.from({length:60},(_,i)=>({id:`synthetic_${i}`,split:'dev',templateGroup:`synthetic_group_${i}`,synthetic:true,...input(),entities:[],expectedStatus:'complete',blockReason:null,preserve:[]}));
 const devBytes=Buffer.from(rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
 const f={identity:{sources:{synthetic:'hash'},runtime:{synthetic:'runtime'}},modelBytes,baselineModelBytes,traceProtocolBytes,protocolBytes,guideBytes,devBytes,baselineBytes:Buffer.from('{}')};
 let binding=developmentBinding(f);f.baselineBytes=Buffer.from(JSON.stringify({candidateId:'rampart-q4-token-ner-local-v1',protocolSha256:binding.protocolSha256,corpusSha256:binding.devSha256,predictions:rows.map(row=>({id:row.id,...complete}))}));f.freeze={approvedForDevelopmentRun:true,independentReviewer:'synthetic reviewer',binding:developmentBinding(f)};return f;
}
test('instrumentation manifest cannot change weights, mapping, threshold or other behavior config',async()=>{
 const f=await fixture();validateInstrumentationManifest(f.modelBytes,f.baselineModelBytes,f.traceProtocolBytes);
 for(const change of [m=>m.runtime.confidenceFloor=.3,m=>m.runtime.mapping.TAX_ID='rfc',m=>m.files[0].sha256='changed',m=>m.productionEnabled=true,m=>m.limitations[0]='arbitrary',m=>m.instrumentation.noAdditionalDownloads=false]){const m=JSON.parse(f.modelBytes);change(m);assert.throws(()=>validateInstrumentationManifest(Buffer.from(JSON.stringify(m)),f.baselineModelBytes,f.traceProtocolBytes));}
});
test('60 result invariant compares status, reason, order and detections; no metric selection',()=>{
 const rows=Array.from({length:60},(_,i)=>({id:`c${i}`,...complete}));assertResultInvariance(rows,structuredClone(rows));
 for(const change of [r=>r.pop(),r=>r.reverse(),r=>r[0].status='blocked',r=>r[0].reasonCategory='ambiguous_context',r=>r[0].detections=[{segmentId:'s',start:0,end:1,category:'person'}]]){const altered=structuredClone(rows);change(altered);assert.throws(()=>assertResultInvariance(rows,altered));}
});
test('fake60 run sends whitelist, retains telemetry and rejects behavioral divergence without scoring',async()=>{
 const f=await fixture();let calls=0,closed=0;
 const startWorker=async()=>({ready:Promise.resolve({candidateId:TOKEN_NER_VERSION,manifestSha256:f.freeze.binding.modelManifestSha256,executionProvider:'CPUExecutionProvider',cpuThreads:1,peakRssBytes:100}),async request(v){calls++;assert.deepEqual(Object.keys(v).sort(),['operational','scope','segments']);return {result:complete,telemetry,latencyMs:1,peakRssBytes:200};},close(){closed++;}});
 const result=await runDevelopment(f,{startWorker});assert.equal(calls,60);assert.equal(closed,1);assert.equal(result.execution.invariancePassed,true);assert.equal(Object.hasOwn(result,'score'),false);assert.deepEqual(result.execution.caseResults[0].telemetry,telemetry);
 const divergent=async()=>{const worker=await startWorker();worker.request=async()=>({result:{status:'blocked',reasonCategory:'ambiguous_context',detections:[]},telemetry,latencyMs:1,peakRssBytes:200});return worker;};await assert.rejects(runDevelopment(f,{startWorker:divergent}),/invariance/);
 let started=false;await assert.rejects(runDevelopment({...f,freeze:{...f.freeze,approvedForDevelopmentRun:false}},{startWorker:async()=>{started=true;}}));assert.equal(started,false);
});
test('plan is no-load; no heldout mode and sandbox denies trace runner/diagnosis docs',async()=>{
 const p=spawnSync(process.execPath,['scripts/run-privacy-token-ner-trace-v1.mjs'],{encoding:'utf8',timeout:5000});assert.equal(p.status,0,p.stderr);assert.equal(JSON.parse(p.stdout).downloads,false);await assert.rejects(main(['--heldout']));
 const s=await readFile('server/privacy/token-ner-trace-candidate.mjs','utf8');assert.ok(s.includes("../../scripts/run-privacy-token-ner-trace-v1.mjs"));assert.ok(s.includes("new URL('../../docs'"));assert.ok(!s.includes("from './token-ner-candidate.mjs'"));
});
test('divergence persists bound 60-result failure evidence without score, overwrite or raw data',async()=>{
 const f=await fixture(),directory=await mkdtemp(path.join(tmpdir(),'ner-trace-failure-'));let closed=0;
 const startWorker=async()=>({ready:Promise.resolve({candidateId:TOKEN_NER_VERSION,manifestSha256:f.freeze.binding.modelManifestSha256,executionProvider:'CPUExecutionProvider',cpuThreads:1,peakRssBytes:100}),async request(){return {result:{status:'blocked',reasonCategory:'ambiguous_context',detections:[]},telemetry,latencyMs:1,peakRssBytes:200};},close(){closed++;throw Error('RAW_CLOSE_SENTINEL');}});
 try{
  await assert.rejects(runDevelopment(f,{startWorker,failureDirectory:directory}),/invariance/);
  const bytes=await readFile(path.join(directory,'failure.json'),'utf8'),artifact=JSON.parse(bytes);
  assert.equal(artifact.failureCode,'INVARIANCE_MISMATCH');assert.equal(artifact.invariancePassed,false);assert.equal(artifact.diagnosticOnly,true);assert.equal(artifact.productionEnabled,false);assert.equal(artifact.completedCases,60);assert.deepEqual(artifact.binding,f.freeze.binding);assert.equal(artifact.predictions.length,60);assert.deepEqual(artifact.caseResults[0].telemetry,telemetry);assert.deepEqual(await readdir(directory),['failure.json']);assert.ok(!bytes.includes('RAW_CLOSE_SENTINEL'));assert.equal(Object.hasOwn(artifact,'score'),false);assert.ok(artifact.predictions.every(p=>/^synthetic_\d+$/.test(p.id)));
  await assert.rejects(runDevelopment(f,{startWorker,failureDirectory:directory}));assert.equal(await readFile(path.join(directory,'failure.json'),'utf8'),bytes);assert.equal(closed,2);
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('partial backend and invalid-output failures preserve only validated prefix; no retry/exception leakage',async()=>{
 const f=await fixture();for(const invalid of [false,true]){
  const directory=await mkdtemp(path.join(tmpdir(),'ner-trace-prefix-'));let calls=0,closed=0;
  const startWorker=async()=>({ready:Promise.resolve({candidateId:TOKEN_NER_VERSION,manifestSha256:f.freeze.binding.modelManifestSha256,executionProvider:'CPUExecutionProvider',cpuThreads:1,peakRssBytes:100}),async request(){calls++;if(calls===3){if(invalid)return {result:complete,telemetry:{...telemetry,raw:'RAW_MODEL_SENTINEL'},latencyMs:1,peakRssBytes:200};throw Error('RAW_EXCEPTION_SENTINEL');}return {result:complete,telemetry,latencyMs:1,peakRssBytes:200};},close(){closed++;}});
  try{
   await assert.rejects(runDevelopment(f,{startWorker,failureDirectory:directory}));const bytes=await readFile(path.join(directory,'failure.json'),'utf8'),artifact=JSON.parse(bytes);
   assert.equal(calls,3);assert.equal(closed,1);assert.equal(artifact.failureCode,invalid?'INVALID_OUTPUT':'BACKEND_FAILURE');assert.equal(artifact.completedCases,2);assert.equal(artifact.invariancePassed,false);assert.deepEqual(artifact.predictions.map(p=>p.id),['synthetic_0','synthetic_1']);assert.deepEqual(artifact.binding,f.freeze.binding);assert.ok(!bytes.includes('SENTINEL'));assert.deepEqual(await readdir(directory),['failure.json']);
  }finally{await rm(directory,{recursive:true,force:true});}
 }
});
