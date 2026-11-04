import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {EventEmitter} from 'node:events';
import path from 'node:path';
import os from 'node:os';
import {createInference,modelPolicy} from '../server/inference.mjs';
import {generationOptions} from '../server/generation-options.mjs';
const catalog=JSON.parse(await readFile(new URL('../resources/model-catalog.json',import.meta.url)));
const hash=b=>createHash('sha256').update(b).digest('hex');
const json=x=>new Response(JSON.stringify(x));
const stream=items=>new Response(items.map(x=>JSON.stringify(x)).join('\n')+'\n');
async function settled(engine){for(let n=0;n<300;n++){const s=await engine.status();if(['ready','error','stopped'].includes(s.state))return s;await new Promise(r=>setTimeout(r,5));}throw Error('test timed out');}
async function fixture(t,{installed=true,fetch:override,hardware,freeMemory,disk,rss,manifestLayout}={}){
 const dataDir=await mkdtemp(path.join(os.tmpdir(),'lex-runtime-'));t.after(()=>rm(dataDir,{recursive:true,force:true}));
 const body=Buffer.from('synthetic weights');const layer={mediaType:'application/vnd.ollama.image.model',digest:`sha256:${hash(body)}`,size:body.length};
 const manifest=Buffer.from(JSON.stringify({schemaVersion:2,config:{...layer,mediaType:'application/vnd.docker.container.image.v1+json'},layers:[layer]}));
 const modelCatalog={...catalog,id:'synthetic:tiny',manifestDigest:hash(manifest),downloadBytes:body.length*2,...(manifestLayout?{manifestLayout,localOnly:true}:{})};
 const modelRoot=path.join(dataDir,'models');await mkdir(path.join(modelRoot,'blobs'),{recursive:true});
 const manifestPath=path.join(modelRoot,modelPolicy(modelCatalog).manifestPath);await mkdir(path.dirname(manifestPath),{recursive:true});
 const install=async()=>{await writeFile(manifestPath,manifest);await writeFile(path.join(modelRoot,'blobs',layer.digest.replace(':','-')),body);};
 if(installed)await install();
 const calls=[],children=[];
 const dependencies={rss:rss|| (async()=>100*1024**2),hardware:()=>hardware||{platform:'darwin',arch:'arm64',memoryGB:8},freeMemory:()=>freeMemory??4*1024**3,statfs:async()=>({bavail:disk??8*1024**3,bsize:1}),freePort:async()=>12345,
 spawn:(bin,args,options)=>{const child=new EventEmitter();child.exitCode=null;child.stderr=new EventEmitter();child.kills=[];child.kill=s=>{child.kills.push(s);child.exitCode=0;child.emit('exit',0);};children.push({child,options});return child;},
 fetch:async(url,opts={})=>{const body=opts.body?JSON.parse(opts.body):null;calls.push({url,opts,body});const custom=await override?.({url,opts,body,install,layer,manifest});if(custom)return custom;if(url.includes('registry.ollama.ai/v2/'))return new Response(manifest);if(url.endsWith('/api/version'))return json({version:'test'});if(url.endsWith('/api/tags'))return json({models:installed?[{name:modelCatalog.id}]:[]});if(url.endsWith('/api/pull')){await install();return stream([{digest:layer.digest,total:layer.size,completed:layer.size},{status:'success'}]);}if(url.endsWith('/api/chat'))return stream([{message:{content:'{"analysis":"synthetic"}'}},{done:true}]);if(url.endsWith('/api/generate'))return json({done:true});throw Error('Unexpected route');}};
 const engine=createInference({dataDir,runtimePath:process.execPath,modelCatalog,dependencies});t.after(()=>engine.stop());return {engine,calls,children,modelCatalog,manifestPath,modelRoot,layer};
}
test('catalog pins small official model and rejects heavy budgets/path injection',()=>{
 assert.equal(modelPolicy({...catalog,id:'qwen3.5:2b-q4_K_M'}).manifestPath,'manifests/registry.ollama.ai/library/qwen3.5/2b-q4_K_M');
 for(const id of ['qwen3.5:../tag','qwen3.5:tag/path','qwen3.5:tag?x=y','qwen3.5:tag\n'])assert.throws(()=>modelPolicy({...catalog,id}),/inválido/);
 assert.equal(modelPolicy({...catalog,id:'qwen2.5:1.5b'}).manifestPath,'manifests/registry.ollama.ai/library/qwen2.5/1.5b');assert.equal(catalog.id,'qwen3.5:2b-q4_K_M');assert.equal(catalog.downloadBytes,1945781358);assert.equal(catalog.memoryMeasured,false);assert.equal(catalog.minMemoryGB,8);
 assert.throws(()=>modelPolicy({...catalog,downloadBytes:16e9}),/2 GB/);assert.throws(()=>modelPolicy({...catalog,id:'../../bad:tag'}),/inválido/);assert.throws(()=>modelPolicy({...catalog,contextLength:8192}),/Presupuesto/);
});
test('no automatic startup; supported target is explicitly unmeasured',async t=>{const f=await fixture(t);assert.equal(f.children.length,0);const s=await f.engine.status();assert.equal(s.supported,true);assert.equal(s.memoryMeasured,false);await assert.rejects(async()=>{for await(const _ of f.engine.generate([])){}},/Prepara LEX AI/);});
test('Intel is supported by the catalog while incompatible targets remain blocked',async t=>{
 for(const hardware of [{platform:'darwin',arch:'x64',memoryGB:8},{platform:'darwin',arch:'x64',memoryGB:4},{platform:'linux',arch:'x64',memoryGB:8},{platform:'darwin',arch:'ia32',memoryGB:8}]){
  const f=await fixture(t,{hardware});const supported=hardware.platform==='darwin'&&hardware.arch==='x64'&&hardware.memoryGB>=8;
  assert.equal((await f.engine.status()).supported,supported);
  await f.engine.initialize();assert.equal((await settled(f.engine)).state,supported?'ready':'error');
  if(!supported){assert.equal(f.children.length,0);assert.equal(f.calls.length,0);}
 }
});
test('local imported v2 index is pinned and never fetched from a registry',async t=>{
 const f=await fixture(t,{manifestLayout:'v2'});assert.match(f.manifestPath,/manifests-v2\/ollama\.com/);await f.engine.initialize();assert.equal((await settled(f.engine)).state,'ready');assert(!f.calls.some(c=>c.url.includes('registry.ollama.ai')));
 const missing=await fixture(t,{manifestLayout:'v2',installed:false});await missing.engine.initialize();assert.equal((await settled(missing.engine)).state,'error');assert(!missing.calls.some(c=>c.url.includes('registry.ollama.ai')||c.url.endsWith('/api/pull')));
});
test('legacy index cannot hide changed executable weights in a migrated v2 index',async t=>{
 const f=await fixture(t);const original=JSON.parse(await readFile(f.manifestPath,'utf8'));
 const migrated={...original,runner:'llamacpp',format:'gguf',layers:original.layers.map(l=>({...l,digest:'sha256:'+'a'.repeat(64)}))};
 const target=path.join(f.modelRoot,modelPolicy(f.modelCatalog).modernManifestPath);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,JSON.stringify(migrated));
 await f.engine.initialize();assert.match((await settled(f.engine)).message,/modificada/);assert(!f.calls.some(c=>c.url.endsWith('/api/chat')));
});
test('legacy migration preserving approved GGUF configuration is accepted',async t=>{
 const f=await fixture(t),original=JSON.parse(await readFile(f.manifestPath,'utf8'));
 const target=path.join(f.modelRoot,modelPolicy(f.modelCatalog).modernManifestPath);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,JSON.stringify({...original,runner:'llamacpp',format:'gguf'}));
 await f.engine.initialize();assert.equal((await settled(f.engine)).state,'ready');
});
test('verified generic manifest and bounded context, one runner and explicit unload',async t=>{
 const f=await fixture(t);await f.engine.initialize();assert.equal((await settled(f.engine)).state,'ready');let output='';for await(const token of f.engine.generate([{role:'user',content:'Synthetic'}]))output+=token;assert.match(output,/synthetic/);
 const env=f.children[0].options.env;assert.equal(env.OLLAMA_CONTEXT_LENGTH,'4096');assert.equal(env.OLLAMA_MAX_LOADED_MODELS,'1');assert.equal(env.OLLAMA_KEEP_ALIVE,'0');
 const chat=f.calls.find(c=>c.url.endsWith('/api/chat')).body;assert.equal(chat.options.num_predict,512);assert.equal(chat.truncate,false);assert.equal(chat.shift,false);assert.equal(chat.think,false);assert.equal(chat.options.num_thread,2);assert.equal(chat.options.num_batch,64);assert.equal(chat.keep_alive,0);assert.equal(f.calls.at(-1).body.keep_alive,0);
 assert.deepEqual(chat.options,generationOptions());assert.equal(chat.options.presence_penalty,0);assert.equal(chat.options.frequency_penalty,0);assert.equal(chat.options.repeat_penalty,1);
 await assert.rejects(async()=>{for await(const _ of f.engine.generate([{role:'user',content:'x'.repeat(7001)}])){}},/presupuesto/);
});
test('disk and hardware preflight reject before spawning or networking',async t=>{for(const options of [{disk:1},{hardware:{platform:'darwin',arch:'arm64',memoryGB:4}}]){const f=await fixture(t,options);await f.engine.initialize();assert.equal((await settled(f.engine)).state,'error');assert.equal(f.children.length,0);assert.equal(f.calls.length,0);}});
test('low available memory does not block download and verification',async t=>{
 const f=await fixture(t,{installed:false,freeMemory:1});await f.engine.initialize();const status=await settled(f.engine);
 assert.equal(status.state,'ready');assert.match(status.memoryWarning,/Cierra otras aplicaciones antes de preguntar/);assert(f.calls.some(c=>c.url.endsWith('/api/pull')));assert.equal(status.progress,100);
});
test('low available memory still rejects generation before chat',async t=>{
 const f=await fixture(t,{freeMemory:1});await f.engine.initialize();assert.equal((await settled(f.engine)).state,'ready');
 await assert.rejects(async()=>{for await(const _ of f.engine.generate([{role:'user',content:'synthetic'}])){}},/Libera al menos 3 GB de RAM disponible/);
 assert(!f.calls.some(c=>c.url.endsWith('/api/chat')));
});
test('download checks official manifest pin before pull and verifies synthetic files',async t=>{const f=await fixture(t,{installed:false});await f.engine.initialize();assert.equal((await settled(f.engine)).state,'ready');assert(f.calls.find(c=>c.url.includes('registry.ollama.ai/v2/library/synthetic/manifests/tiny')));assert(f.calls.find(c=>c.url.endsWith('/api/pull')));});
test('changed registry manifest prevents pull',async t=>{const f=await fixture(t,{installed:false,fetch:({url})=>url.includes('registry.ollama.ai/v2/')?json({bad:true}):null});await f.engine.initialize();assert.match((await settled(f.engine)).message,/manifiesto/);assert(!f.calls.some(c=>c.url.endsWith('/api/pull')));assert.deepEqual(f.children[0].child.kills,['SIGTERM']);});
test('tampered local weights fail closed without pulling or generating',async t=>{const f=await fixture(t);await writeFile(path.join(f.modelRoot,'blobs',f.layer.digest.replace(':','-')),'broken');await f.engine.initialize();assert.match((await settled(f.engine)).message,/dañado/);assert(!f.calls.some(c=>/api\/(pull|chat)$/.test(c.url)));});
test('oversize or foreign pull layer cancels owned daemon',async t=>{const f=await fixture(t,{installed:false,fetch:({url,layer})=>url.endsWith('/api/pull')?stream([{digest:layer.digest,total:3e9}]):null});await f.engine.initialize();assert.equal((await settled(f.engine)).state,'error');assert.deepEqual(f.children[0].child.kills,['SIGTERM']);});
test('concurrent stop aborts an active pull and terminates owned process',async t=>{
 let pullSignal,entered;const started=new Promise(r=>entered=r);
 const f=await fixture(t,{installed:false,fetch:({url,opts})=>{if(url.endsWith('/api/pull')){pullSignal=opts.signal;entered();return new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true}));}}});
 await f.engine.initialize();await started;await Promise.all([f.engine.stop(),f.engine.stop()]);assert(pullSignal.aborted);assert.equal((await f.engine.status()).state,'stopped');assert(f.children[0].child.kills.includes('SIGTERM'));
});
test('cancelled generation explicitly unloads and keeps failures closed',async t=>{
 const abort=new AbortController();const f=await fixture(t,{fetch:({url,opts})=>{if(url.endsWith('/api/chat'))return new Promise((resolve,reject)=>{opts.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true});abort.abort();});}});
 await f.engine.initialize();assert.equal((await settled(f.engine)).state,'ready');await assert.rejects(async()=>{for await(const _ of f.engine.generate([{role:'user',content:'synthetic'}],{signal:abort.signal})){}},/cancelado/);assert(f.calls.some(c=>c.url.endsWith('/api/generate')));assert.equal((await f.engine.status()).busy,false);
});
test('unload failure terminates daemon instead of retaining model RAM',async t=>{
 const f=await fixture(t,{fetch:({url})=>url.endsWith('/api/generate')?json({done:false}):null});await f.engine.initialize();await settled(f.engine);for await(const _ of f.engine.generate([{role:'user',content:'synthetic'}])){}
 assert.equal((await f.engine.status()).state,'stopped');assert(f.children[0].child.kills.includes('SIGTERM'));
});
test('concurrent generation is rejected while first stream holds the runner',async t=>{
 const f=await fixture(t);await f.engine.initialize();await settled(f.engine);const first=f.engine.generate([{role:'user',content:'synthetic'}]);await first.next();assert.equal((await f.engine.status()).busy,true);
 await assert.rejects(async()=>{for await(const _ of f.engine.generate([{role:'user',content:'second'}])){}},/Ya hay un análisis/);await first.return();assert.equal((await f.engine.status()).busy,false);assert.equal(f.calls.filter(c=>c.url.endsWith('/api/chat')).length,1);
});
test('truncated model response is rejected and still unloaded',async t=>{
 const f=await fixture(t,{fetch:({url})=>url.endsWith('/api/chat')?stream([{done:true,done_reason:'length'}]):null});await f.engine.initialize();await settled(f.engine);
 await assert.rejects(async()=>{for await(const _ of f.engine.generate([{role:'user',content:'synthetic'}])){}},/excedió el límite/);assert(f.calls.some(c=>c.url.endsWith('/api/generate')));
});
test('plain conversation omits JSON format while grounded requests preserve their output schema',async t=>{
 const f=await fixture(t);await f.engine.initialize();await settled(f.engine);
 for await(const _ of f.engine.generate([{role:'user',content:'Conversación sintética'}],{responseFormat:'text'})){}
 const chat=f.calls.find(c=>c.url.endsWith('/api/chat')).body;assert.equal(Object.hasOwn(chat,'format'),false);
 assert.equal(chat.keep_alive,0);assert.equal(chat.think,false);
 const schema={type:'object',properties:{answer:{type:'string'}}};
 for await(const _ of f.engine.generate([{role:'user',content:'Evidencia sintética'}],{outputSchema:schema})){}
 assert.deepEqual(f.calls.filter(c=>c.url.endsWith('/api/chat')).at(-1).body.format,schema);
 await assert.rejects(async()=>{for await(const _ of f.engine.generate([{role:'user',content:'Hola'}],{responseFormat:'xml'})){}},/Formato/);
});
test('RSS over 3 GiB or unmeasurable fails closed before chat',async t=>{for(const rss of [async()=>3*1024**3+1,async()=>{throw Error('ps denied');}]){const f=await fixture(t,{rss});await f.engine.initialize();await settled(f.engine);await assert.rejects(async()=>{for await(const _ of f.engine.generate([{role:'user',content:'synthetic'}])){}},/memoria/);assert(!f.calls.some(c=>c.url.endsWith('/api/chat')));assert.equal((await f.engine.status()).state,'error');assert(f.children[0].child.kills.includes('SIGTERM'));}});
test('RSS is sampled during active generation and aborts on excessive growth',async t=>{let samples=0;const f=await fixture(t,{rss:async()=>++samples===1?100:4*1024**3,fetch:({url,opts})=>url.endsWith('/api/chat')?new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true})):null});await f.engine.initialize();await settled(f.engine);await assert.rejects(async()=>{for await(const _ of f.engine.generate([{role:'user',content:'synthetic'}])){}},/3 GiB/);assert(samples>=2);assert.equal((await f.engine.status()).state,'error');});
