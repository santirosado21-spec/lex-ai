import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {EventEmitter} from 'node:events';
import path from 'node:path';
import os from 'node:os';
import {createOwnedIntakeRuntime,modelPolicy} from '../server/inference.mjs';
import {CONTRACTUAL_OLLAMA_OPTIONS} from '../server/privacy/intake-contractual-options.mjs';
import {createOwnedIntakeContractualOllama} from '../server/privacy/intake-contractual-owned.mjs';
import {createIntakeContractualOllama} from '../server/privacy/intake-contractual-ollama.mjs';
import {createMockInference} from '../server/inference-mock.mjs';
const catalog=JSON.parse(await readFile(new URL('../resources/model-catalog.json',import.meta.url)));
const hash=b=>createHash('sha256').update(b).digest('hex');
const json=x=>new Response(JSON.stringify(x));
const stream=items=>new Response(items.map(x=>JSON.stringify(x)).join('\n')+'\n');
async function settled(engine){for(let n=0;n<300;n++){const s=await engine.status();if(['ready','error','stopped'].includes(s.state))return s;await new Promise(r=>setTimeout(r,5));}throw Error('test timed out');}
async function fixture(t,{installed=true,fetch:override,hardware,freeMemory,disk,rss,manifestLayout,port=12345,stubborn=false,dependencyOverrides={},factory=createOwnedIntakeRuntime}={}){
 const dataDir=await mkdtemp(path.join(os.tmpdir(),'lex-runtime-'));t.after(()=>rm(dataDir,{recursive:true,force:true}));
 const body=Buffer.from('synthetic weights');const layer={mediaType:'application/vnd.ollama.image.model',digest:`sha256:${hash(body)}`,size:body.length};
 const manifest=Buffer.from(JSON.stringify({schemaVersion:2,config:{...layer,mediaType:'application/vnd.docker.container.image.v1+json'},layers:[layer]}));
 const modelCatalog={...catalog,manifestDigest:hash(manifest),downloadBytes:body.length*2,...(manifestLayout?{manifestLayout,localOnly:true}:{})};
 const modelRoot=path.join(dataDir,'models');await mkdir(path.join(modelRoot,'blobs'),{recursive:true});
 const manifestPath=path.join(modelRoot,modelPolicy(modelCatalog).manifestPath);await mkdir(path.dirname(manifestPath),{recursive:true});
 const install=async()=>{await writeFile(manifestPath,manifest);await writeFile(path.join(modelRoot,'blobs',layer.digest.replace(':','-')),body);};
 if(installed)await install();
 const calls=[],children=[];
 const dependencies={rss:rss|| (async()=>100*1024**2),hardware:()=>hardware||{platform:'darwin',arch:'arm64',memoryGB:8},freeMemory:()=>freeMemory??4*1024**3,statfs:async()=>({bavail:disk??8*1024**3,bsize:1}),freePort:async()=>port,
 spawn:(bin,args,options)=>{const child=new EventEmitter();child.exitCode=null;child.stderr=new EventEmitter();child.kills=[];child.kill=s=>{child.kills.push(s);if(!stubborn){child.exitCode=0;child.emit('exit',0);}return true;};children.push({child,options});return child;},
 fetch:async(url,opts={})=>{const body=opts.body?JSON.parse(opts.body):null;calls.push({url,opts,body});const custom=await override?.({url,opts,body,install,layer,manifest});if(custom)return custom;if(url.includes('registry.ollama.ai/v2/'))return new Response(manifest);if(url.endsWith('/api/version'))return json({version:'test'});if(url.endsWith('/api/tags'))return json({models:installed?[{name:modelCatalog.id}]:[]});if(url.endsWith('/api/pull')){await install();return stream([{digest:layer.digest,total:layer.size,completed:layer.size},{status:'success'}]);}if(url.endsWith('/api/chat'))return stream([{message:{content:'{"analysis":"synthetic"}'}},{done:true}]);if(url.endsWith('/api/generate'))return json({done:true});throw Error('Unexpected route');}};
 dependencies.createOwnedEndpointFetch=async()=>dependencies.fetch;
 Object.assign(dependencies,dependencyOverrides);
 const engine=factory({dataDir,runtimePath:process.execPath,dependencies:{...dependencies,testModelCatalog:modelCatalog}});t.after(()=>engine.stop().catch(()=>{}));return {engine,calls,children,modelCatalog,manifestPath,modelRoot,layer};
}
const body=()=>({model:catalog.id,stream:false,think:false,format:{type:'object'},keep_alive:'30s',options:{...CONTRACTUAL_OLLAMA_OPTIONS,num_predict:4096},messages:[{role:'system',content:'Synthetic privacy test'},{role:'user',content:'Synthetic input'}]});
test('owned reader stays off, verifies files before spawn, fixes endpoint and refuses generation',async t=>{
 const f=await fixture(t);assert.equal(f.calls.length,0);assert.equal(f.children.length,0);
 await assert.rejects(f.engine.readerRequest(body()),/disponible/);await f.engine.initialize();assert.equal((await settled(f.engine)).state,'ready');
 await f.engine.readerRequest(body());assert.ok(f.calls.every(c=>c.url.startsWith('http://127.0.0.1:12345/')));assert.ok(!f.calls.some(c=>c.url.includes('11434')||/pull|generate/.test(c.url)));
 assert.equal(f.children[0].options.env.OLLAMA_MODELS,f.modelRoot);assert.equal(f.children[0].options.env.OLLAMA_NO_CLOUD,'1');
 await assert.rejects(async()=>{for await(const _ of f.engine.generate([])){}},/privacidad/);
 const n=f.calls.length;for(const change of [{model:'foreign'},{stream:true},{options:{...body().options,num_ctx:99999}},{url:'http://foreign'},{keep_alive:0}])await assert.rejects(f.engine.readerRequest({...body(),...change}));assert.equal(f.calls.length,n);
 await f.engine.stop();await assert.rejects(f.engine.initialize(),/terminal/);await assert.rejects(f.engine.readerRequest(body()));assert.equal(f.calls.length,n);
});
test('missing or corrupt files and shared port reject before any spawn or request',async t=>{
 for(const options of [{installed:false},{port:11434},{port:80},{port:NaN},{corrupt:true}]){const f=await fixture(t,options);if(options.corrupt)await writeFile(path.join(f.modelRoot,'blobs',f.layer.digest.replace(':','-')),'bad');await f.engine.initialize();assert.equal((await settled(f.engine)).state,'error');assert.equal(f.children.length,0);assert.equal(f.calls.length,0);}
});
test('caller cancellation closes owned child even when fetch ignores abort; later requests denied',async t=>{
 let entered;const started=new Promise(r=>entered=r);let late;
 const f=await fixture(t,{fetch:({url})=>url.endsWith('/api/chat')?(entered(),new Promise(r=>late=r)):null});await f.engine.initialize();await settled(f.engine);
 const cancel=new AbortController(),request=f.engine.readerRequest(body(),{signal:cancel.signal});await started;cancel.abort();await assert.rejects(request);assert.deepEqual(f.children[0].child.kills,['SIGTERM']);
 const n=f.calls.length;await assert.rejects(f.engine.readerRequest(body()));await assert.rejects(f.engine.initialize());late(json({done:true}));await new Promise(r=>setTimeout(r,5));assert.equal(f.calls.length,n);assert.equal((await f.engine.status()).state,'stopped');
});
test('stop aborts response-body consumption and blocks concurrent or later calls',async t=>{
 let entered;const started=new Promise(r=>entered=r);
 const f=await fixture(t,{fetch:({url,opts})=>url.endsWith('/api/chat')?new Response(new ReadableStream({start(controller){entered();opts.signal.addEventListener('abort',()=>controller.error(Error('aborted')),{once:true});}})):null});await f.engine.initialize();await settled(f.engine);
 const request=f.engine.readerRequest(body());await started;await assert.rejects(f.engine.readerRequest(body()));await Promise.all([f.engine.stop(),f.engine.stop()]);await assert.rejects(request);const n=f.calls.length;await assert.rejects(f.engine.readerRequest(body()));assert.equal(f.calls.length,n);assert.equal((await f.engine.status()).state,'stopped');
});
test('unconfirmed child exit is retained as terminal cleanup failure, not successful stop',async t=>{
 const f=await fixture(t,{stubborn:true});await f.engine.initialize();await settled(f.engine);await assert.rejects(f.engine.stop(),/confirmó/);assert.deepEqual(f.children[0].child.kills,['SIGTERM','SIGKILL']);assert.equal((await f.engine.status()).cleanup,'unconfirmed');await assert.rejects(f.engine.initialize(),/terminal/);await assert.rejects(f.engine.readerRequest(body()));assert.equal(f.children.length,1);
 // Late exit permits cleanup confirmation, but never reuse of this reader instance.
 f.children[0].child.exitCode=0;f.children[0].child.emit('exit',0);await f.engine.stop();assert.equal((await f.engine.status()).cleanup,'confirmed-child-exit');await assert.rejects(f.engine.initialize());
});
test('contractual candidate composes with owned capability, not shared loopback fetch',async t=>{
 const f=await fixture(t,{fetch:({url,body})=>url.endsWith('/api/chat')?json({model:catalog.id,done:true,done_reason:'stop',message:{role:'assistant',content:JSON.stringify(body.format.properties.oraciones?{oraciones:[]}:{status:'complete',reasonCategory:null,detections:[]})}}):null});
 const candidate=createIntakeContractualOllama({requestImpl:f.engine.readerRequest,fetchImpl:()=>{throw Error('shared transport forbidden');}});await f.engine.initialize();await settled(f.engine);
 const scope={workspaceId:'W',matterId:'M',threadId:'T'};const result=await candidate.detect({scope,segments:[{id:'S0',path:'comment',text:'Cláusula sintética de prueba.',originScope:scope,classification:'synthetic'}],operational:{processorStatus:'ok',segments:[{id:'S0',mediaType:'text/plain',extractionStatus:'complete',assessment:'known'}]}});assert.equal(result.status,'complete');assert.ok(f.calls.some(c=>c.url.endsWith('/api/chat')));assert.ok(f.calls.every(c=>!c.url.includes('11434')));
});
test('stop during uncooperative startup headers prevents all subsequent requests and respawn',async t=>{
 let entered,late;const started=new Promise(r=>entered=r);
 const f=await fixture(t,{fetch:({url})=>url.endsWith('/api/version')?(entered(),new Promise(r=>late=r)):null});await f.engine.initialize();await started;await f.engine.stop();assert.equal((await f.engine.status()).state,'stopped');const n=f.calls.length;late(json({version:'late'}));await new Promise(r=>setTimeout(r,10));assert.equal(f.calls.length,n);assert.equal(n,1);await assert.rejects(f.engine.initialize());
});
test('stop during an uncooperative startup body does not hang or reach tags/chat',async t=>{
 let entered,release;const started=new Promise(r=>entered=r);
 const f=await fixture(t,{fetch:({url})=>url.endsWith('/api/version')?new Response(new ReadableStream({start(controller){release=()=>{try{controller.close();}catch{}};entered();}})):null});await f.engine.initialize();await started;await f.engine.stop();const n=f.calls.length;release();await new Promise(r=>setTimeout(r,10));assert.equal(f.calls.length,n);assert.equal(n,1);assert.equal((await f.engine.status()).state,'stopped');
});
test('oversized reader response is terminal and kills only the simulated owned child',async t=>{
 const f=await fixture(t,{fetch:({url})=>url.endsWith('/api/chat')?new Response('x'.repeat(262145)):null});await f.engine.initialize();await settled(f.engine);await assert.rejects(f.engine.readerRequest(body()),/límite/);assert.deepEqual(f.children[0].child.kills,['SIGTERM']);await assert.rejects(f.engine.readerRequest(body()));
});
test('stop cancels hanging statfs preflight; its late result cannot spawn',async t=>{
 let entered,release;const started=new Promise(r=>entered=r);
 const f=await fixture(t,{dependencyOverrides:{statfs:()=>{entered();return new Promise(r=>release=r);}}});await f.engine.initialize();await started;
 await Promise.race([f.engine.stop(),new Promise((_,reject)=>setTimeout(()=>reject(Error('stop hung')),250))]);release({bavail:8*1024**3,bsize:1});await new Promise(r=>setTimeout(r,10));assert.equal(f.children.length,0);assert.equal(f.calls.length,0);assert.equal((await f.engine.status()).state,'stopped');
});
test('child exit while initialization awaits memory cannot publish ready',async t=>{
 let entered,release;const started=new Promise(r=>entered=r);
 const f=await fixture(t,{dependencyOverrides:{memory:()=>{entered();return new Promise(r=>release=r);}}});await f.engine.initialize();await started;f.children[0].child.exitCode=1;f.children[0].child.emit('exit',1);release({freeBytes:4*1024**3,availableBytes:4*1024**3});await new Promise(r=>setTimeout(r,10));assert.equal((await f.engine.status()).state,'error');await assert.rejects(f.engine.initialize());await assert.rejects(f.engine.readerRequest(body()));
});
test('caller abort cancels the locked body reader itself, not only its Response',async t=>{
 let entered,cancelled=0;const started=new Promise(r=>entered=r);
 const f=await fixture(t,{fetch:({url})=>url.endsWith('/api/chat')?new Response(new ReadableStream({pull(){entered();},cancel(){cancelled++;}})):null});await f.engine.initialize();await settled(f.engine);const abort=new AbortController();const request=f.engine.readerRequest(body(),{signal:abort.signal});await started;await new Promise(r=>setImmediate(r));abort.abort();await assert.rejects(request);assert.equal(cancelled,1);assert.deepEqual(f.children[0].child.kills,['SIGTERM']);
});
test('owned composition lifetime reaches candidate even without transport activity',async t=>{
 const f=await fixture(t,{factory:createOwnedIntakeContractualOllama});await f.engine.initialize();await settled(f.engine);
 const scope={workspaceId:'W',matterId:'M',threadId:'T'};const input={scope,segments:[{id:'S0',path:'comment',text:'Cláusula sintética de prueba.',originScope:scope,classification:'synthetic'}],operational:{processorStatus:'ok',segments:[{id:'S0',mediaType:'text/plain',extractionStatus:'complete',assessment:'known'}]}};
 const any=AbortSignal.any;let candidateSignal;AbortSignal.any=function(signals){const value=any(signals);candidateSignal??=value;return value;};let result;try{result=f.engine.detect(input);}finally{AbortSignal.any=any;}await f.engine.stop();assert.equal(candidateSignal.aborted,true);assert.equal((await result).status,'blocked');assert.equal((await f.engine.detect(input)).status,'blocked');assert.ok(!f.calls.some(c=>c.url.endsWith('/api/chat')));
});
test('caller abort during memory preflight prevents late chat and makes reader terminal',async t=>{
 let entered,release,hold=false;const started=new Promise(r=>entered=r);
 const f=await fixture(t,{dependencyOverrides:{memory:async()=>{if(hold){entered();await new Promise(r=>release=r);}return {freeBytes:4*1024**3,availableBytes:4*1024**3};}}});await f.engine.initialize();await settled(f.engine);hold=true;const abort=new AbortController();const request=f.engine.readerRequest(body(),{signal:abort.signal});await started;abort.abort();await assert.rejects(request);release();await new Promise(r=>setTimeout(r,10));assert.ok(!f.calls.some(c=>c.url.endsWith('/api/chat')));await assert.rejects(f.engine.initialize());
});
test('already dead leader cannot certify auxiliary closure or successful stop',async t=>{
 const f=await fixture(t);await f.engine.initialize();await settled(f.engine);const owned=f.children[0].child;owned.signalCode='SIGTERM';owned.emit('exit',null,'SIGTERM');await assert.rejects(f.engine.stop(),/confirmó/);assert.equal((await f.engine.status()).state,'error');assert.equal((await f.engine.status()).cleanup,'unconfirmed-tree');assert.deepEqual(owned.kills,[]);
});
test('failed repeated close does not accumulate exit listeners',async t=>{
 const f=await fixture(t,{stubborn:true});await f.engine.initialize();await settled(f.engine);const child=f.children[0].child,n=child.listenerCount('exit');await assert.rejects(f.engine.stop());assert.equal(child.listenerCount('exit'),n);await assert.rejects(f.engine.stop());assert.equal(child.listenerCount('exit'),n);child.exitCode=0;child.emit('exit',0);await f.engine.stop();
});
test('concurrent initialize before spawn has one preflight and one probe sequence',async t=>{
 let entered,release;const started=new Promise(r=>entered=r);let calls=0;
 const f=await fixture(t,{dependencyOverrides:{statfs:()=>{calls++;entered();return new Promise(r=>release=r);}}});await f.engine.initialize();await started;await Promise.all([f.engine.initialize(),f.engine.initialize()]);assert.equal(calls,1);assert.equal(f.children.length,0);release({bavail:8*1024**3,bsize:1});await settled(f.engine);assert.equal(f.children.length,1);assert.equal(f.calls.filter(c=>c.url.endsWith('/api/version')).length,1);
});
test('occupied port with bind-failed child cannot ready or receive reader payload',async t=>{
 const f=await fixture(t,{dependencyOverrides:{spawn:()=>{const c=new EventEmitter();c.stderr=new EventEmitter();c.exitCode=1;c.signalCode=null;c.kill=()=>{};return c;}}});await f.engine.initialize();await settled(f.engine);assert.equal((await f.engine.status()).state,'error');await assert.rejects(f.engine.readerRequest(body()));assert.equal(f.calls.length,0);
});
test('kill false followed by spontaneous exit cannot count as signalled cleanup',async t=>{
 const f=await fixture(t);await f.engine.initialize();await settled(f.engine);const child=f.children[0].child;child.kill=()=>{queueMicrotask(()=>{child.exitCode=0;child.emit('exit',0);});return false;};await assert.rejects(f.engine.stop());assert.equal((await f.engine.status()).cleanup,'unconfirmed-tree');
});

test('accepted signal from prior failed attempt cannot certify false-signal retry',async t=>{
 const f=await fixture(t,{stubborn:true});await f.engine.initialize();await settled(f.engine);const child=f.children[0].child;
 let firstSignals=0;child.kill=()=>{firstSignals++;return true;};await assert.rejects(f.engine.stop());assert.equal(firstSignals,2);assert.equal((await f.engine.status()).cleanup,'unconfirmed');
 let retrySignals=0;child.kill=()=>{retrySignals++;queueMicrotask(()=>{child.exitCode=0;child.emit('exit',0);});return false;};
 await assert.rejects(f.engine.stop());assert.equal(retrySignals,1);assert.equal((await f.engine.status()).cleanup,'unconfirmed-tree');assert.equal((await f.engine.status()).state,'error');
 // Further retry observes an already-exited child. It can confirm only that fact.
 await f.engine.stop();assert.equal((await f.engine.status()).cleanup,'confirmed-child-exit');await assert.rejects(f.engine.initialize());
});
test('startup fails promptly with original attestation cause and no repeated HTTP attempts',async t=>{
 let attempts=0;const f=await fixture(t,{dependencyOverrides:{createOwnedEndpointFetch:async()=>async()=>{attempts++;throw Object.assign(Error('No se pudo verificar la conexión del motor propio.'),{code:'ERR_OWNED_ENDPOINT_UNVERIFIED'});}}});
 await f.engine.initialize();const state=await settled(f.engine);assert.equal(attempts,1);assert.equal(state.state,'error');assert.equal(state.message,'No se pudo verificar la conexión del motor propio.');assert.deepEqual(f.children[0].child.kills,['SIGTERM']);assert.equal(f.calls.length,0);
});
test('startup retries only connection not ready, then succeeds on the same verified factory',async t=>{
 let attempts=0;const f=await fixture(t,{dependencyOverrides:{createOwnedEndpointFetch:async()=>async(url)=>{attempts++;if(attempts<3)throw Object.assign(Error('not listening'),{code:'ERR_OWNED_ENDPOINT_NOT_READY'});return url.endsWith('/api/version')?json({version:'synthetic'}):json({models:[{name:catalog.id}]});}}});
 await f.engine.initialize();assert.equal((await settled(f.engine)).state,'ready');assert.equal(attempts,4);
});
test('owned startup budget permits verification above one second without retrying it',async t=>{
 let attempts=0;const f=await fixture(t,{dependencyOverrides:{createOwnedEndpointFetch:async()=>async(url,{signal})=>{attempts++;if(url.endsWith('/api/version')){await new Promise(r=>setTimeout(r,1150));signal.throwIfAborted();return json({version:'synthetic'});}return json({models:[{name:catalog.id}]});}}});
 await f.engine.initialize();assert.equal((await settled(f.engine)).state,'ready');assert.equal(attempts,2);
});
test('persistent connection refusal exhausts finite startup attempts with no reader request',{timeout:14000},async t=>{
 let attempts=0;const f=await fixture(t,{dependencyOverrides:{createOwnedEndpointFetch:async()=>async()=>{attempts++;throw Object.assign(Error('not listening'),{code:'ERR_OWNED_ENDPOINT_NOT_READY'});}}});
 await f.engine.initialize();const end=Date.now()+12500;let state;
 do{state=await f.engine.status();if(state.state==='error')break;await new Promise(r=>setTimeout(r,25));}while(Date.now()<end);
 assert.equal(attempts,100);assert.equal(state.state,'error');assert.equal(state.message,'El motor no respondió al iniciar.');assert.deepEqual(f.children[0].child.kills,['SIGTERM']);assert.equal(f.calls.length,0);
});
test('production startup budgets pin 15000ms attempt and 30000ms overall',async()=>{
 const source=await readFile(new URL('../server/inference.mjs',import.meta.url),'utf8');assert.match(source,/readerOnly\?15000:1000/);assert.match(source,/readerOnly\?AbortSignal\.timeout\(30000\):null/);
});
test('actual transport inventory failure reaches startup stable user message with no HTTP',async t=>{
 const {fork}=await import('node:child_process'),{once}=await import('node:events');
 const child=fork(new URL('./fixtures/owned-endpoint/server.mjs',import.meta.url),[],{stdio:['ignore','ignore','pipe','ipc']});const [{port}]=await once(child,'message');t.after(()=>{if(child.exitCode===null)child.kill('SIGKILL');});
 const realExecute=(await import('node:util')).promisify((await import('node:child_process')).execFile);
 const {createOwnedEndpointFetch}=await import('../server/owned-endpoint-fetch.mjs');
 const f=await fixture(t,{dependencyOverrides:{spawn:()=>child,freePort:async()=>port,createOwnedEndpointFetch:options=>createOwnedEndpointFetch({...options,executeImpl:async(...args)=>{if(args[0].endsWith('lsof'))throw Error('PRIVATE_LSOF_PATH');return realExecute(...args);}})}});
 await f.engine.initialize();const state=await settled(f.engine);assert.equal(state.state,'error');assert.equal(state.message,'No se pudo verificar la conexión del motor propio.');assert.ok(!JSON.stringify(state).includes('PRIVATE_LSOF_PATH'));assert.equal(child.signalCode,'SIGTERM');
});
test('slow not-ready attempts cannot extend startup beyond overall 30 second deadline',{timeout:36000},async t=>{
 let attempts=0;const f=await fixture(t,{dependencyOverrides:{createOwnedEndpointFetch:async()=>async()=>{attempts++;await new Promise(r=>setTimeout(r,5000));throw Object.assign(Error('not ready'),{code:'ERR_OWNED_ENDPOINT_NOT_READY'});}}});
 const started=Date.now();await f.engine.initialize();let state;
 do{state=await f.engine.status();if(state.state==='error')break;await new Promise(r=>setTimeout(r,25));}while(Date.now()-started<34000);
 assert.equal(state.state,'error');assert.equal(state.message,'El motor propio agotó el plazo de arranque.');assert.ok(attempts<=6);assert.ok(Date.now()-started<34000);
});
