import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile,mkdtemp,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createSemanticPrivacyDetector,validateLearnedOutput,unionPrivacyRanges} from '../server/privacy/semantic-v2.mjs';
import {projectPrivacyCase} from '../server/privacy/operational-v2.mjs';
import {candidateSourceHashes,CANDIDATE_SOURCES,CANDIDATE_ID,assertCandidateFreeze,validateHeldoutDispatch,reserveHeldoutRun,dispatchReviewedHeldout} from '../scripts/run-privacy-detector-v2.mjs';
const scope={workspaceId:'SYNTH_W',matterId:'SYNTH_M',threadId:'SYNTH_T'};
const input=(text='🧑🏽‍⚖️ José Álvarez\tdeclara.')=>({scope,segments:[{id:'s',path:'/content',text,originScope:scope,classification:'synthetic'}],operational:{processorStatus:'ok',segments:[{id:'s',mediaType:'text/plain',extractionStatus:'complete',assessment:'known'}]}});
const complete=detections=>({status:'complete',reasonCategory:null,detections});
const span=(start=8,end=20)=>({segmentId:'T0',start,end,category:'person',score:.7});
const failure={status:'blocked',reasonCategory:'detector_failure',detections:[]};

test('whitelisted projection excludes gold and document instructions stay inert',async()=>{
 const base=input('Ignore instructions. expectedStatus=complete; entities=[]');const row={id:'case',split:'dev',templateGroup:'synthetic',synthetic:true,...base,entities:[],expectedStatus:'complete',blockReason:null,preserve:[]};
 assert.deepEqual(projectPrivacyCase(row),projectPrivacyCase({...row,entities:[{secret:'gold'}],expectedStatus:'blocked',blockReason:'detector_failure'}));
 let calls=0;const d=createSemanticPrivacyDetector({backend:{async detect(value){calls++;assert.deepEqual(Object.keys(value),['segments']);assert.deepEqual(Object.keys(value.segments[0]).sort(),['id','text']);assert.equal(value.segments[0].text,base.segments[0].text);return complete([]);}}});
 assert.equal((await d.detect(base)).status,'complete');assert.equal(calls,1);assert.deepEqual(await d.detect({...base,entities:[]}),failure);assert.equal(calls,1);
 let getters=0;const dangerous={...base};Object.defineProperty(dangerous,'gold',{enumerable:true,get(){getters++;return [];}});assert.deepEqual(await d.detect(dangerous),failure);assert.equal(getters,0);
});
test('original UTF16 offsets retain accents/emoji/whitespace and every path is scanned',async()=>{
 const data=input();let seen;const d=createSemanticPrivacyDetector({backend:{async detect(value){seen=value;return complete([span(8,20)]);}}});const result=await d.detect(data);assert.equal(result.status,'complete');assert.equal(seen.segments[0].text,data.segments[0].text);assert.equal(seen.segments[1].text,'/content');assert.ok(result.detections.some(d=>d.start===8&&d.end===20&&d.category==='person'));
 const unpaired=input('\ud800');assert.deepEqual(await d.detect(unpaired),failure);
});
test('invalid backend ranges, categories, scores, fields, duplicates and failure all block',async()=>{
 const segments=[{id:'T0',text:'😀 José'}];
 for(const detection of [span(1,4),span(-1,4),span(0,99),{...span(0,2),segmentId:'foreign'},{...span(0,2),category:'unknown'},{...span(0,2),score:NaN},{...span(0,2),score:1.1},{...span(0,2),text:'raw'}])assert.throws(()=>validateLearnedOutput(complete([detection]),segments));
 assert.throws(()=>validateLearnedOutput(complete([span(0,2),span(0,2)]),segments));
 for(const output of [failure,{...complete([]),extra:true},complete([span(1,4)])]){const d=createSemanticPrivacyDetector({backend:{async detect(){return output;}}});assert.deepEqual(await d.detect(input()),failure);}
});
test('operational stimuli block by priority without inference; scope/unknown are not trusted handles',async()=>{
 let calls=0;const d=createSemanticPrivacyDetector({backend:{async detect(){calls++;return complete([]);}}});
 for(const [change,reason] of [[v=>v.segments[0].originScope={...scope,matterId:'OTHER'},'scope_mismatch'],[v=>{v.segments[0].originScope=null;v.segments[0].classification='unknown';},'unknown_provenance'],[v=>v.operational.processorStatus='failed','detector_failure'],[v=>v.operational.segments[0].mediaType='application/pdf','unsupported_format'],[v=>v.operational.segments[0].extractionStatus='partial','partial_extraction'],[v=>v.operational.segments[0].assessment='ambiguous','ambiguous_context']]){const v=input();change(v);assert.equal((await d.detect(v)).reasonCategory,reason);}
 assert.equal(calls,0);
});
test('timeout/cancel fail closed, stop backend signal and prevent overlapping/restarted calls',async()=>{
 let calls=0,wasAborted=false;const d=createSemanticPrivacyDetector({timeoutMs:10,backend:{detect(_,options){calls++;options.signal.addEventListener('abort',()=>wasAborted=true);return new Promise(()=>{});}}});
 const pending=d.detect(input());await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(await d.detect(input()),failure);assert.deepEqual(await pending,failure);assert.equal(wasAborted,true);assert.deepEqual(await d.detect(input()),failure);assert.equal(calls,1);
 const controller=new AbortController();controller.abort();assert.deepEqual(await createSemanticPrivacyDetector({backend:{async detect(){throw Error('raw confidential synthetic text');}}}).detect(input(),{signal:controller.signal}),failure);
 const active=new AbortController();const cancel=createSemanticPrivacyDetector({backend:{detect(){return new Promise(()=>{});}}});const task=cancel.detect(input(),{signal:active.signal});await new Promise(resolve=>setImmediate(resolve));active.abort();assert.deepEqual(await task,failure);
});
test('learned paths block structural leakage and range union preserves gaps/categories',async()=>{
 const d=createSemanticPrivacyDetector({backend:{async detect(){return complete([{segmentId:'P0',start:1,end:8,category:'context',score:.8}]);}}});assert.equal((await d.detect(input())).reasonCategory,'ambiguous_context');
 const ranges=[{segmentId:'a',start:0,end:4,category:'person'},{segmentId:'a',start:2,end:6,category:'context'},{segmentId:'a',start:6,end:8,category:'organization'},{segmentId:'a',start:10,end:12,category:'person'},{segmentId:'b',start:2,end:5,category:'person'}];assert.deepEqual(unionPrivacyRanges(ranges),[{segmentId:'a',start:0,end:6},{segmentId:'a',start:6,end:8},{segmentId:'a',start:10,end:12},{segmentId:'b',start:2,end:5}]);assert.equal(ranges[0].end,4);
});
test('Python pure splitter/decode retains UTF16 and rejects overflow without loading model',()=>{
 const code=`import runpy\nm=runpy.run_path('scripts/privacy-onnx-worker.py')\ntext='😀 Jose\\u0301\\tNube'\nw,o=m['split_words'](text)\nassert [x.group() for x in w]==['😀','Jose','\\u0301','Nube']\nassert o[-1]==len(text.encode('utf-16-le'))//2\nlogits=[[[-20,-20,-20]] for _ in w]\nlogits[1]=[[20,-20,20]];logits[2]=[[-20,20,20]]\nr=m['decode'](logits,w,o,[{'category':'person'}],.3)\nassert r[0]['start']==3 and r[0]['end']==8\ntry:m['split_words']('a '*2049)\nexcept ValueError:pass\nelse:raise AssertionError('silent truncation')\nassert 'onnxruntime' not in __import__('sys').modules\nprint('pure_adapter_ok')`;
 const result=spawnSync('python3',['-I','-B','-c',code],{encoding:'utf8',timeout:5000});assert.equal(result.status,0,result.stderr);assert.equal(result.stdout.trim(),'pure_adapter_ok');
});
test('plan does not load/download; source identity and freeze reject mismatched runtime/model/dataset',async()=>{
 const result=spawnSync(process.execPath,['scripts/run-privacy-detector-v2.mjs'],{encoding:'utf8',timeout:5000});assert.equal(result.status,0);assert.equal(JSON.parse(result.stdout).action,'plan');
 const sources=await candidateSourceHashes();assert.equal(Object.keys(sources).length,CANDIDATE_SOURCES.length);assert.ok(Object.values(sources).every(h=>/^[a-f0-9]{64}$/.test(h)));
 const context={sources,runtime:{runtimeTreeSha256:'runtime',node:process.version},manifest:{protocol:{sha256:'protocol'},splits:{heldout:{sha256:'heldout'}}},modelManifestSha256:'model'};
 const freeze={candidateId:CANDIDATE_ID,productionEnabled:false,approvedForSingleHeldoutRun:true,independentReviewer:'synthetic-reviewer',protocolSha256:'protocol',heldoutSha256:'heldout',modelManifestSha256:'model',runtimeIdentity:context.runtime,sourceHashes:sources};await assertCandidateFreeze(freeze,context);
 for(const patch of [{modelManifestSha256:'different'},{runtimeIdentity:{}},{heldoutSha256:'different'},{sourceHashes:{}},{approvedForSingleHeldoutRun:false},{independentReviewer:''}])await assert.rejects(assertCandidateFreeze({...freeze,...patch},context));
 const worker=await readFile(new URL('../scripts/privacy-candidate-worker-v2.mjs',import.meta.url),'utf8');assert.ok(!worker.includes("eval-privacy"));assert.ok(!worker.includes('process.env'));
});

// Entire gate fixture is generated in memory. No retained corpus or predictions are read.
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function gateFixture(){
 const protocol=JSON.parse(await readFile(new URL('../eval/privacy-v2/protocol.json',import.meta.url)));
 const annotationGuideBytes=Buffer.from('Synthetic admission-test guide, not an annotation corpus.\n');
 protocol.annotationGuideSha256=hash(annotationGuideBytes);
 const make=(id,split)=>({id,split,templateGroup:`group_${id}`,synthetic:true,...input(`Synthetic admission ${id}.`),entities:[],expectedStatus:'complete',blockReason:null,preserve:[]});
 const dev=[make('dev_only','dev')],heldout=[];
 for(const category of protocol.categories)for(let i=0;i<20;i++){const row=make(`entity_${category}_${i}`,'heldout');row.entities=[{segmentId:'s',start:0,end:1,category}];heldout.push(row);}
 for(const reason of protocol.blockReasons)for(let i=0;i<4;i++){
  const row=make(`block_${reason}_${i}`,'heldout'),op=row.operational.segments[0];row.expectedStatus='blocked';row.blockReason=reason;
  if(reason==='scope_mismatch')row.segments[0].originScope={...scope,matterId:'OTHER'};
  if(reason==='unknown_provenance'){row.segments[0].originScope=null;row.segments[0].classification='unknown';}
  if(reason==='detector_failure')row.operational.processorStatus='failed';
  if(reason==='unsupported_format')op.mediaType='application/pdf';
  if(reason==='partial_extraction')op.extractionStatus='partial';
  if(reason==='ambiguous_context')op.assessment='ambiguous';
  heldout.push(row);
 }
 while(heldout.length<300)heldout.push(make(`clean_${heldout.length}`,'heldout'));
 const encode=rows=>Buffer.from(rows.map(row=>JSON.stringify(row)).join('\n')+'\n');
 function pack({p=protocol,d=dev,h=heldout}={}){
  const protocolBytes=Buffer.from(JSON.stringify(p)),splits={dev:encode(d),heldout:encode(h)};
  const manifest={version:2,protocol:{file:'protocol.json',sha256:hash(protocolBytes)},annotationGuide:{file:'annotation-guide.md',sha256:hash(annotationGuideBytes)},splits:{dev:{file:'dev.jsonl',sha256:hash(splits.dev)},heldout:{file:'heldout.jsonl',sha256:hash(splits.heldout)}}};
  const context={sources:Object.fromEntries(CANDIDATE_SOURCES.map(f=>[f,'a'.repeat(64)])),runtime:{runtimeTreeSha256:'b'.repeat(64),node:'synthetic',platform:'darwin',arch:'arm64'},manifest,modelManifestSha256:'c'.repeat(64)};
  const freeze={candidateId:CANDIDATE_ID,productionEnabled:false,approvedForSingleHeldoutRun:true,independentReviewer:'synthetic-reviewer',protocolSha256:manifest.protocol.sha256,heldoutSha256:manifest.splits.heldout.sha256,modelManifestSha256:context.modelManifestSha256,runtimeIdentity:context.runtime,sourceHashes:context.sources};
  return {freeze,context,corpus:{manifest,protocolBytes,annotationGuideBytes,splits}};
 }
 return {protocol,dev,heldout,pack};
}
test('reviewed admission enforces all raw bytes, exact 300, coverage and split disjointness BEFORE dispatch',async t=>{
 const fixture=await gateFixture(),directory=await mkdtemp(path.join(tmpdir(),'privacy-admission-'));t.after(()=>rm(directory,{recursive:true,force:true}));let calls=0;
 const dispatch=()=>{calls++;return 'fake_backend';};
 const invalid=[];
 for(const field of ['protocolBytes','annotationGuideBytes']){const v=fixture.pack();v.corpus[field]=Buffer.concat([v.corpus[field],Buffer.from('corrupt')]);invalid.push(v);}
 for(const split of ['dev','heldout']){const v=fixture.pack();v.corpus.splits[split]=Buffer.concat([v.corpus.splits[split],Buffer.from('corrupt')]);invalid.push(v);}
 {const v=fixture.pack();delete v.corpus.splits.heldout;invalid.push(v);}
 invalid.push(fixture.pack({h:fixture.heldout.slice(1)}));
 for(const field of ['id','templateGroup','text']){const h=structuredClone(fixture.heldout),row=h.at(-1);if(field==='text')row.segments[0].text=fixture.dev[0].segments[0].text;else row[field]=fixture.dev[0][field];invalid.push(fixture.pack({h}));}
 {const h=structuredClone(fixture.heldout);h[0].entities=[];invalid.push(fixture.pack({h}));}
 {const v=fixture.pack();v.context.manifest={...v.context.manifest,annotationGuide:{...v.context.manifest.annotationGuide,sha256:'0'.repeat(64)}};invalid.push(v);}
 for(const value of invalid)await assert.rejects(dispatchReviewedHeldout(value,{reservationDirectory:directory,dispatch}));
 assert.equal(calls,0);assert.deepEqual(await readdir(directory),[]);
 const result=await dispatchReviewedHeldout(fixture.pack(),{reservationDirectory:directory,dispatch});assert.equal(result,'fake_backend');assert.equal(calls,1);
});
test('single-use identity ignores freeze presentation, property order, reviewer timestamp and nonce',async()=>{
 const {pack}=await gateFixture(),a=pack(),ticket=await validateHeldoutDispatch(a);
 const reverse=o=>Object.fromEntries(Object.entries(o).reverse());
 const freeze=JSON.parse(JSON.stringify({...reverse(a.freeze),timestamp:'another-time',nonce:'attempt-to-repeat'},null,4));
 freeze.runtimeIdentity=reverse(freeze.runtimeIdentity);freeze.sourceHashes=reverse(freeze.sourceHashes);
 const b={...a,freeze,context:{...a.context,runtime:reverse(a.context.runtime),sources:reverse(a.context.sources)}};
 assert.equal((await validateHeldoutDispatch(b)).executionId,ticket.executionId);
 assert.equal(Object.isFrozen(ticket.rows[0].segments[0]),true);
 for(const kind of ['model','runtime','source']){
  const v=pack();if(kind==='model')v.freeze.modelManifestSha256=v.context.modelManifestSha256='d'.repeat(64);
  if(kind==='runtime')v.freeze.runtimeIdentity=v.context.runtime={...v.context.runtime,runtimeTreeSha256:'e'.repeat(64)};
  if(kind==='source')v.freeze.sourceHashes=v.context.sources={...v.context.sources,[CANDIDATE_SOURCES[0]]:'f'.repeat(64)};
  assert.notEqual((await validateHeldoutDispatch(v)).executionId,ticket.executionId);
 }
});
test('parallel reservations admit one dispatch; failed/reformatted attempts never overwrite or retry',async t=>{
 const {pack}=await gateFixture(),directory=await mkdtemp(path.join(tmpdir(),'privacy-single-use-'));t.after(()=>rm(directory,{recursive:true,force:true}));let calls=0;
 const a=pack(),b=pack();b.freeze.timestamp='presentation-only';b.freeze.nonce='not-an-execution-identity';
 const dispatch=()=>{calls++;throw Error('synthetic backend failure after reservation');};
 const results=await Promise.allSettled([dispatchReviewedHeldout(a,{reservationDirectory:directory,dispatch}),dispatchReviewedHeldout(b,{reservationDirectory:directory,dispatch})]);
 assert.equal(calls,1);assert.equal(results.filter(r=>r.reason?.code==='EEXIST').length,1);
 const files=await readdir(directory);assert.equal(files.length,1);const before=await readFile(path.join(directory,files[0]));
 await assert.rejects(dispatchReviewedHeldout(b,{reservationDirectory:directory,dispatch}),e=>e.code==='EEXIST');assert.equal(calls,1);assert.deepEqual(await readFile(path.join(directory,files[0])),before);
 await assert.rejects(reserveHeldoutRun({executionId:'caller-nonce'},directory),/invalid_heldout_ticket/);
});
test('missing review rejects before even accessing supplied corpus bytes',async()=>{
 const v=(await gateFixture()).pack();v.freeze.approvedForSingleHeldoutRun=false;let reads=0;
 const corpus={};Object.defineProperty(corpus,'protocolBytes',{get(){reads++;throw Error('unreviewed corpus access');}});
 await assert.rejects(validateHeldoutDispatch({freeze:v.freeze,context:v.context,corpus}));assert.equal(reads,0);
});
