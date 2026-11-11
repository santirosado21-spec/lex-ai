import test from 'node:test';
import {fidelityGate} from './helpers/fidelity.mjs';
const IPC_PLATFORM_PREREQ=process.platform!=='darwin'?'macOS sandbox-exec platform':null;
import {EventEmitter} from 'node:events';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createCompositionDetector,validateCompositionOutput,TOKEN_NER_VERSION,startTokenNerWorker} from '../server/privacy/token-ner-composition-v2.mjs';
import {developmentBinding,runDevelopment,validateCompositionManifest} from '../scripts/run-privacy-token-ner-composition-v2.mjs';
const scope={workspaceId:'SYNTH_W',matterId:'SYNTH_M',threadId:'SYNTH_T'};
const input=(text='RFC ABCD900101AA1. nota')=>({scope,segments:[{id:'s',path:'/content',text,originScope:scope,classification:'synthetic'}],operational:{processorStatus:'ok',segments:[{id:'s',mediaType:'text/plain',extractionStatus:'complete',assessment:'known'}]}});
const native=(start=4,end=17,kind='TAX_ID',segmentId='T0')=>({segmentId,start,end,kind,score:.8});
const fake=(detections,change=x=>x)=>({async detect({segments}){return change({status:'complete',reasonCategory:null,detections,scannedSegments:segments.map(s=>s.id)});}});
async function detect(value,detections){return createCompositionDetector({backend:fake(detections)}).detect(value);}
test('one internal rule covers entire unmapped span with original source/hash/scope proof; never egress',async()=>{
 const value=input(),result=await detect(value,[native()]);assert.equal(result.result.status,'complete');assert.equal(result.egressEligible,false);assert.equal(result.diagnosticOnly,true);assert.equal(result.diagnostic.proofs.length,1);assert.equal(result.diagnostic.proofs[0].rule.category,'rfc');assert.equal(result.diagnostic.proofs[0].kind,'TAX_ID');assert.ok(result.protectionPlan.some(p=>p.start===4&&p.end===17));assert.deepEqual(await validateCompositionOutput(result,value),result);
 for(const mutate of [c=>c.protectionPlan[0].textSha256='0'.repeat(64),c=>c.protectionPlan[0].scope.matterId='OTHER',c=>c.protectionPlan[0].reference.version='old',c=>c.protectionPlan[0].reference.hash='0'.repeat(64),c=>c.protectionPlan=[],c=>c.egressEligible=true]){const c=structuredClone(result);mutate(c);await assert.rejects(validateCompositionOutput(c,value));}
});
test('uncovered tail, adjacent rule union, second segment and any path finding remain blocked',async()=>{
 for(const spans of [[native(3,17)],[native(),native(19,23,'CITY')],[native(1,8,'CITY','P0')]]){const r=await detect(input(),spans);assert.equal(r.result.status,'blocked');assert.equal(r.protectionPlan,null);assert.deepEqual(r.result.detections,[]);}
 const value=input('ana@example.com bob@example.com');const union=await detect(value,[native(0,value.segments[0].text.length,'URL')]);assert.equal(union.result.status,'blocked');assert.equal(union.diagnostic.ruleDetections.filter(d=>d.category==='email').length,2);
 const multi=input();multi.segments.push({...multi.segments[0],id:'other',text:'Uncovered'});multi.operational.segments.push({...multi.operational.segments[0],id:'other'});assert.equal((await detect(multi,[native(),native(0,9,'CITY','T1')])).result.status,'blocked');
});
test('same-category dedup retains whole rule; cross-category overlap blocks rather than silently preferring rule',async()=>{
 const value=input('Ana Robles');const r=await detect(value,[native(0,3,'GIVEN_NAME'),native(4,10,'SURNAME')]);assert.equal(r.result.status,'complete');assert.deepEqual(r.result.detections,[{segmentId:'s',start:0,end:10,category:'person'}]);assert.equal(r.protectionPlan[0].end,10);
 const conflict=await detect(input(),[native(4,8,'GIVEN_NAME')]);assert.equal(conflict.result.status,'blocked');assert.ok(conflict.diagnostic.causes.includes('CATEGORY_CONFLICT'));
});
test('hard errors retain only diagnostic rules; invalid backend completeness, ranges, Unicode never resolve',async()=>{
 for(const output of [{status:'blocked',reasonCategory:'detector_failure',detections:[]},{status:'blocked',reasonCategory:'ambiguous_context',detections:[]}]){const d=createCompositionDetector({backend:{async detect(){return output;}}});const r=await d.detect(input());assert.equal(r.result.status,'blocked');assert.ok(r.diagnostic.ruleDetections.some(d=>d.category==='rfc'));assert.deepEqual(r.result.detections,[]);assert.equal(r.protectionPlan,null);assert.equal(r.egressEligible,false);}
 for(const change of [x=>({...x,scannedSegments:['T0']}),x=>({...x,detections:[native(0,999)]}),x=>({...x,detections:[{...native(),score:.39}]}),x=>({...x,ruleClaims:[]})]){const r=await createCompositionDetector({backend:fake([native()],change)}).detect(input());assert.equal(r.result.status,'blocked');assert.equal(r.protectionPlan,null);}
 const emoji=await detect(input('😀 Ana Robles'),[native(1,2,'CITY')]);assert.equal(emoji.result.status,'blocked');
 const accent=await detect(input('Ana Ro\u0301bles'),[native(0,11,'GIVEN_NAME')]);assert.equal(accent.result.status,'complete');assert.equal(accent.result.detections[0].end,11);
});
test('no forged rules/provenance authority; operational failures never reach backend or reveal foreign detections',async()=>{
 let calls=0;const detector=createCompositionDetector({backend:{async detect(){calls++;throw Error('RAW');}}});
 for(const change of [v=>v.ruleDetections=[{segmentId:'s',start:0,end:99,category:'rfc'}],v=>v.segments[0].originScope={...scope,matterId:'OTHER'},v=>v.operational.segments[0].extractionStatus='partial',v=>v.operational.segments[0].assessment='ambiguous']){const v=input();change(v);const r=await detector.detect(v);assert.equal(r.result.status,'blocked');assert.equal(r.protectionPlan,null);assert.deepEqual(r.diagnostic.ruleDetections,[]);}
 assert.equal(calls,0);
});
test('immutable input snapshot survives asynchronous caller mutation; timeout stays blocked and no retry',async()=>{
 const v=input();let release;const d=createCompositionDetector({backend:{async detect({segments}){await new Promise(resolve=>release=resolve);return {status:'complete',reasonCategory:null,detections:[native()],scannedSegments:segments.map(s=>s.id)};}}});const pending=d.detect(v);await new Promise(resolve=>setImmediate(resolve));v.scope.matterId='OTHER';v.segments[0].text='changed';release();const r=await pending;assert.equal(r.result.status,'complete');assert.equal(r.diagnostic.proofs[0].scope.matterId,'SYNTH_M');
 let calls=0;const slow=createCompositionDetector({timeoutMs:5,backend:{async detect(){calls++;return new Promise(()=>{});}}});assert.equal((await slow.detect(input())).result.status,'blocked');assert.equal((await slow.detect(input())).protectionPlan,null);assert.equal(calls,1);
});
test('Python collects every native kind before resolution; later hard failures still fail closed without ONNX',()=>{
 const code=`import runpy,sys
m=runpy.run_path('scripts/privacy-token-ner-composition-v2-worker.py')
def rows(labels):return [[20.0 if i==label else -20.0 for i in range(35)] for label in labels]
args=('X Y',[(0,0),(0,1),(2,3),(0,0)],[1,0,0,1],[2,5,6,3])
r=m['decode'](*args,rows([0,9,11,0]));assert [s['kind'] for s in r]==['URL','TAX_ID'];assert len(r)==2
for logits in [rows([0,9,2,0]),[rows([0])[0],rows([9])[0],[0.0]*35,rows([0])[0]]]:
 try:m['decode'](*args,logits)
 except ValueError:pass
 else:raise AssertionError('later hard error dropped')
rt=m['Runtime'].__new__(m['Runtime']);rt.infer=lambda text:[{'start':0,'end':1,'kind':'CITY','score':.8}]
r=rt.request({'segments':[{'id':'T0','text':'X'},{'id':'P0','text':'Y'}]});assert r['scannedSegments']==['T0','P0'];assert len(r['detections'])==2
assert 'onnxruntime' not in sys.modules
`;
 const p=spawnSync('python3',['-I','-B','-c',code],{encoding:'utf8',timeout:5000});assert.equal(p.status,0,p.stderr);
});
async function fixture(){
 const [modelBytes,baselineModelBytes,compositionProtocolBytes,protocolBytes,guideBytes]=await Promise.all(['resources/privacy-token-ner-composition-v2.json','resources/privacy-token-ner-candidate-v1.json','resources/privacy-token-ner-composition-v2-protocol.json','eval/privacy-v2/protocol.json','eval/privacy-v2/annotation-guide.md'].map(f=>readFile(f)));
 const rows=Array.from({length:60},(_,i)=>({id:`synthetic_${i}`,split:'dev',templateGroup:`synthetic_group_${i}`,synthetic:true,...input('Texto genérico.'),entities:[],expectedStatus:'complete',blockReason:null,preserve:[]}));
 const f={identity:{sources:{synthetic:'hash'},runtime:{synthetic:'runtime'}},modelBytes,baselineModelBytes,compositionProtocolBytes,protocolBytes,guideBytes,devBytes:Buffer.from(rows.map(r=>JSON.stringify(r)).join('\n')),baselineBytes:Buffer.from('{}')};const b=developmentBinding(f);f.baselineBytes=Buffer.from(JSON.stringify({candidateId:'rampart-q4-token-ner-local-v1',protocolSha256:b.protocolSha256,corpusSha256:b.devSha256,predictions:rows.map(r=>({id:r.id,status:'complete',reasonCategory:null,detections:[]}))}));f.freeze={approvedForDevelopmentRun:true,independentReviewer:'synthetic reviewer',binding:developmentBinding(f)};return f;
}
test('runner plans without artifacts/model; manifest forbids inference-config drift',async()=>{
 const p=spawnSync(process.execPath,['scripts/run-privacy-token-ner-composition-v2.mjs'],{encoding:'utf8',timeout:5000});assert.equal(p.status,0,p.stderr);assert.equal(JSON.parse(p.stdout).action,'plan');
 const f=await fixture();validateCompositionManifest(f.modelBytes,f.baselineModelBytes,f.compositionProtocolBytes);const m=JSON.parse(f.modelBytes);m.runtime.confidenceFloor=.3;assert.throws(()=>validateCompositionManifest(Buffer.from(JSON.stringify(m)),f.baselineModelBytes,f.compositionProtocolBytes));
});
test('fake60 comparison only projects input, no score inflation; failed prefix exclusive and sanitized',async()=>{
 const f=await fixture();let calls=0;const worker=async()=>({ready:Promise.resolve({candidateId:TOKEN_NER_VERSION,manifestSha256:f.freeze.binding.modelManifestSha256,executionProvider:'CPUExecutionProvider',cpuThreads:1,peakRssBytes:100}),async request(v){calls++;assert.deepEqual(Object.keys(v).sort(),['operational','scope','segments']);return {composition:await detect(v,[]),telemetry:null,latencyMs:1,peakRssBytes:200};},close(){}});
 const success=await runDevelopment(f,{startWorker:worker});assert.equal(calls,60);assert.equal(success.execution.comparisonComplete,true);assert.equal(Object.hasOwn(success,'score'),false);
 const directory=await mkdtemp(path.join(tmpdir(),'composition-failure-'));let n=0;const bad=async()=>{const w=await worker();const request=w.request;w.request=async v=>{if(++n===3)throw Error('RAW_SENTINEL');return request(v);};return w;};try{await assert.rejects(runDevelopment(f,{startWorker:bad,failureDirectory:directory}));const bytes=await readFile(path.join(directory,'failure.json'),'utf8'),report=JSON.parse(bytes);assert.equal(report.completedCases,2);assert.equal(report.comparisonComplete,false);assert.ok(!bytes.includes('RAW_SENTINEL'));assert.deepEqual(await readdir(directory),['failure.json']);n=0;await assert.rejects(runDevelopment(f,{startWorker:bad,failureDirectory:directory}));assert.equal(await readFile(path.join(directory,'failure.json'),'utf8'),bytes);}finally{await rm(directory,{recursive:true,force:true});}
});

test('late synchronous backend fulfillment cannot outrun an unfired timeout callback',async()=>{
 let calls=0;const d=createCompositionDetector({timeoutMs:5,backend:{async detect({segments}){calls++;const deadline=performance.now()+12;while(performance.now()<deadline){}return {status:'complete',reasonCategory:null,detections:[native()],scannedSegments:segments.map(s=>s.id)};}}});
 const result=await d.detect(input());assert.equal(result.result.status,'blocked');assert.equal(result.protectionPlan,null);assert.deepEqual(result.result.detections,[]);assert.ok(result.diagnostic.ruleDetections.some(d=>d.category==='rfc'));assert.ok(result.diagnostic.causes.includes('CANCEL_OR_TIMEOUT'));assert.equal((await d.detect(input())).result.status,'blocked');assert.equal(calls,1);
});

test('parent reconstructs every complete result and refuses dropped or forged native/rule associations',async()=>{
 const v=input(),original=await detect(v,[native()]);
 const mutations=[
  c=>{c.result.detections=[];c.protectionPlan=[];c.diagnostic.proofs=[];},
  c=>{c.diagnostic.proofs=[];},
  c=>{c.diagnostic.ruleDetections=[];},
  c=>{c.diagnostic.nativeSpans[0].kind='CITY';},
  c=>{c.diagnostic.proofs[0].kind='CITY';},
  c=>{c.result.detections[0].category='account';},
  c=>{c.diagnostic.ruleDetections[0].category='account';c.diagnostic.proofs[0].rule.category='account';c.result.detections[0].category='account';},
 ];
 for(const mutate of mutations){const c=structuredClone(original);mutate(c);await assert.rejects(validateCompositionOutput(c,v));}
 const failed=structuredClone(v);failed.operational.processorStatus='failed';await assert.rejects(validateCompositionOutput(original,failed));
 const mappedInput=input('xylophone'),mapped=await detect(mappedInput,[native(0,9,'GIVEN_NAME')]);assert.equal(mapped.result.status,'complete');mapped.result.detections=[];mapped.protectionPlan=[];await assert.rejects(validateCompositionOutput(mapped,mappedInput));
 for(const [value,spans] of [[input(),[native(),native(19,23,'CITY')]],[failed,[]]]){const blocked=await detect(value,spans);assert.equal(blocked.result.status,'blocked');assert.deepEqual(await validateCompositionOutput(blocked,value),blocked);}
 const hard=await createCompositionDetector({backend:{async detect(){return {status:'blocked',reasonCategory:'ambiguous_context',detections:[]};}}}).detect(v);assert.deepEqual(await validateCompositionOutput(hard,v),hard);
});

async function parentHarness(onSend,{timeoutMs=100}={}){
 const hash=createHash('sha256').update(await readFile('resources/privacy-token-ner-composition-v2.json')).digest('hex');
 const child=new EventEmitter();child.pid=777777;let sent=0,killed=0;
 child.send=(message,callback)=>{sent++;onSend(child,message);callback?.();};
 const worker=await startTokenNerWorker({reviewedManifestSha256:hash,timeoutMs},{spawnChild(command,args,options){assert.equal(command,'/usr/bin/sandbox-exec');assert.ok(args.includes('-p'));assert.deepEqual(options.env,{PATH:'/usr/bin:/bin',LANG:'en_US.UTF-8'});return child;},killGroup(pid){assert.equal(pid,child.pid);killed++;}});
 const ready=()=>child.emit('message',{ready:{candidateId:TOKEN_NER_VERSION,manifestSha256:hash}});
 return {worker,ready,child,get sent(){return sent;},get killed(){return killed;}};
}
const packet=composition=>({composition,telemetry:null,latencyMs:1,peakRssBytes:100});
test('real parent IPC protocol waits for ready, sends whitelist and receives response without a model',async(t)=>{if(fidelityGate(t,IPC_PLATFORM_PREREQ,'requires macOS sandbox-exec profile'))return;
 const composition=await detect(input(),[native()]);const h=await parentHarness((child,message)=>{assert.deepEqual(message,{input:input()});queueMicrotask(()=>child.emit('message',packet(composition)));});
 try{const request=h.worker.request(input());await new Promise(r=>setImmediate(r));assert.equal(h.sent,0);h.ready();await h.worker.ready;assert.deepEqual((await request).composition,composition);assert.equal(h.sent,1);}finally{h.worker.close();}assert.equal(h.killed,1);
});
test('real parent IPC abort closes once and prohibits retry',async(t)=>{if(fidelityGate(t,IPC_PLATFORM_PREREQ,'requires macOS sandbox-exec profile'))return;
 const h=await parentHarness(()=>{});h.ready();await h.worker.ready;const controller=new AbortController();const request=h.worker.request(input(),{signal:controller.signal});await new Promise(r=>setImmediate(r));controller.abort();await assert.rejects(request);assert.equal(h.sent,1);assert.equal(h.killed,1);await assert.rejects(h.worker.request(input()));assert.equal(h.sent,1);
});
test('real parent IPC enforces both timer expiry and absolute deadline before late fulfillment',async(t)=>{if(fidelityGate(t,IPC_PLATFORM_PREREQ,'requires macOS sandbox-exec profile'))return;
 const composition=await detect(input(),[native()]);
 for(const late of [false,true]){const h=await parentHarness(child=>{if(late){const until=performance.now()+15;while(performance.now()<until){}child.emit('message',packet(composition));}},{timeoutMs:5});h.ready();await h.worker.ready;await assert.rejects(h.worker.request(input()));assert.equal(h.killed,1);assert.equal(h.sent,1);await assert.rejects(h.worker.request(input()));}
});

test('late invalid complete output is excluded from failure receipt validated prefix',async()=>{
 const f=await fixture(),directory=await mkdtemp(path.join(tmpdir(),'composition-invalid-'));let count=0;
 const worker=async()=>({ready:Promise.resolve({candidateId:TOKEN_NER_VERSION,manifestSha256:f.freeze.binding.modelManifestSha256,executionProvider:'CPUExecutionProvider',cpuThreads:1,peakRssBytes:100}),async request(v){const composition=await detect(v,[]);if(++count===3)composition.diagnostic.nativeSpans=[native(0,5,'TAX_ID')];return packet(composition);},close(){}});
 try{await assert.rejects(runDevelopment(f,{startWorker:worker,failureDirectory:directory}));const receipt=JSON.parse(await readFile(path.join(directory,'failure.json')));assert.equal(receipt.completedCases,2);assert.equal(receipt.comparisonComplete,false);assert.equal(receipt.failureCode,'INVALID_OUTPUT');}finally{await rm(directory,{recursive:true,force:true});}
});
test('parent IPC rejects wrong readiness identity before any request',async(t)=>{if(fidelityGate(t,IPC_PLATFORM_PREREQ,'requires macOS sandbox-exec profile'))return;
 const h=await parentHarness(()=>{});const rejected=assert.rejects(h.worker.ready);h.child.emit('message',{ready:{candidateId:'wrong',manifestSha256:'0'.repeat(64)}});await rejected;assert.equal(h.sent,0);assert.equal(h.killed,1);
});

test('parent IPC cancellation before readiness settles immediately and removes listener on every path',async(t)=>{if(fidelityGate(t,IPC_PLATFORM_PREREQ,'requires macOS sandbox-exec profile'))return;
 const {getEventListeners}=await import('node:events');
 const composition=await detect(input(),[native()]);
 for(const mode of ['already-aborted','loading','ready-abort-race']){
  const h=await parentHarness(()=>{}),controller=new AbortController();
  if(mode==='already-aborted')controller.abort();
  const request=h.worker.request(input(),{signal:controller.signal});const rejected=assert.rejects(request);
  if(mode==='ready-abort-race')h.ready();
  if(mode!=='already-aborted')controller.abort();
  await rejected;await new Promise(r=>setImmediate(r));
  assert.equal(h.killed,1,mode);assert.equal(h.sent,0,mode);assert.equal(getEventListeners(controller.signal,'abort').length,0,mode);
  h.ready();h.child.emit('message',packet(composition));await new Promise(r=>setImmediate(r));assert.equal(h.sent,0);assert.equal(h.killed,1);
 }
 const h=await parentHarness((child)=>queueMicrotask(()=>child.emit('message',packet(composition)))),controller=new AbortController();h.ready();await h.worker.request(input(),{signal:controller.signal});assert.equal(getEventListeners(controller.signal,'abort').length,0);controller.abort();assert.equal(h.killed,0);h.worker.close();
});
test('parent IPC request absolute budget includes readiness and rejects late ready before IPC',async(t)=>{if(fidelityGate(t,IPC_PLATFORM_PREREQ,'requires macOS sandbox-exec profile'))return;
 const {getEventListeners}=await import('node:events');
 for(const lateReady of [false,true]){
  const h=await parentHarness(()=>{},{timeoutMs:5}),controller=new AbortController();
  const request=h.worker.request(input(),{signal:controller.signal});const rejected=assert.rejects(request);
  if(lateReady){const until=performance.now()+12;while(performance.now()<until){}h.ready();}
  await rejected;assert.equal(h.sent,0);assert.equal(h.killed,1);assert.equal(getEventListeners(controller.signal,'abort').length,0);
 }
});
