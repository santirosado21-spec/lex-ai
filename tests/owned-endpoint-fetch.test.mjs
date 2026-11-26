import test from 'node:test';import assert from 'node:assert/strict';import {fork} from 'node:child_process';import {once} from 'node:events';import http from 'node:http';
import {createOwnedEndpointFetch,hasOwnedConnection} from '../server/owned-endpoint-fetch.mjs';
async function statusFixture(t){
 const child=fork(new URL('./fixtures/owned-endpoint/status.mjs',import.meta.url),[],{stdio:['ignore','ignore','ignore','ipc']});
 t.after(()=>{if(child.exitCode===null)child.kill();});
 let timer,onMessage,onExit,onError;
 try{const {port}=await new Promise((resolve,reject)=>{
  onMessage=resolve;onExit=()=>reject(Error('status fixture exited before ready'));onError=reject;
  child.once('message',onMessage);child.once('exit',onExit);child.once('error',onError);
  timer=setTimeout(()=>reject(Error('status fixture readiness deadline')),3000);
 });assert.ok(Number.isInteger(port)&&port>1023);return {child,port};}
 finally{clearTimeout(timer);child.off('message',onMessage);child.off('exit',onExit);child.off('error',onError);}
}
const tuple={localAddress:'127.0.0.1',localPort:30000,remoteAddress:'127.0.0.1',remotePort:40000};
test('descriptor parser requires exact owned PID, reverse connection tuple and established state',()=>{
 const text='p42\nf9\nn127.0.0.1:40000->127.0.0.1:30000\nTST=ESTABLISHED\n';assert.equal(hasOwnedConnection(text,42,tuple),true);
 for(const value of [text.replace('p42','p43'),text.replace('30000','30001'),text.replace('ESTABLISHED','LISTEN'),text.replace('127.0.0.1:40000->','*:40000->')])assert.equal(hasOwnedConnection(value,42,tuple),false);
 assert.equal(hasOwnedConnection(text,42,{...tuple,remotePort:11434}),false);
});
async function fixture(t){const child=fork(new URL('./fixtures/owned-endpoint/server.mjs',import.meta.url),[],{stdio:['ignore','ignore','ignore','ipc']});t.after(()=>{if(child.exitCode===null)child.kill();});const [{port}]=await once(child,'message');return {child,port};}
async function counts(child){const response=once(child,'message');child.send('counts');return (await response)[0];}
test('real owned connected socket receives body only after descriptor attestation; unrelated listener gets zero HTTP bytes',async t=>{
 const {child,port}=await fixture(t),fetch=await createOwnedEndpointFetch({child});
 const response=await fetch('http://127.0.0.1:'+port+'/api/chat',{method:'POST',body:'SYNTHETIC_ONLY'});assert.deepEqual(await response.json(),{requests:1,bytes:14});
 const other=await fixture(t);await assert.rejects(fetch('http://127.0.0.1:'+other.port+'/api/chat',{method:'POST',body:'NEVER_SEND'}));assert.deepEqual(await counts(other.child),{requests:0,bytes:0,wireBytes:0});
});
test('listener substituted during verification cannot receive HTTP headers or body',async t=>{
 const {child,port}=await fixture(t);let received=0;const foreign=http.createServer(()=>received++);t.after(()=>foreign.close());let swapped=false;
 const realExecute=(await import('node:util')).promisify((await import('node:child_process')).execFile);
 const fetch=await createOwnedEndpointFetch({child,executeImpl:async(file,args,options)=>{
  if(file.endsWith('lsof')&&!swapped){swapped=true;const exited=once(child,'exit');child.send('stop');await exited;await new Promise(r=>foreign.listen(port,'127.0.0.1',r));}
  return realExecute(file,args,options);
 }});
 await assert.rejects(fetch('http://127.0.0.1:'+port+'/api/chat',{method:'POST',body:'NEVER_SEND'}));assert.equal(received,0);
});
test('unsupported platform refuses before invoking process inventory',async()=>{await assert.rejects(createOwnedEndpointFetch({child:{pid:42},platform:'win32',executeImpl:()=>assert.fail()}));});
test('inventory failure and changed process identity refuse without HTTP bytes; abort is bounded',async t=>{
 const {child,port}=await fixture(t);const url='http://127.0.0.1:'+port+'/api/chat';
 const realExecute=(await import('node:util')).promisify((await import('node:child_process')).execFile);
 for(const mode of ['inventory','identity']){
  let reads=0;const fetch=await createOwnedEndpointFetch({child,executeImpl:async(file,args,options)=>{
   if(file.endsWith('lsof'))throw Error('unavailable');
   const result=await realExecute(file,args,options);if(mode==='identity'&&++reads>1)return {stdout:result.stdout+' altered'};return result;
  }});
  await assert.rejects(fetch(url,{method:'POST',body:'NEVER_SEND'}));assert.deepEqual(await counts(child),{requests:0,bytes:0,wireBytes:0});
 }
 const controller=new AbortController();controller.abort();const fetch=await createOwnedEndpointFetch({child});await assert.rejects(fetch(url,{method:'POST',body:'NEVER_SEND',signal:controller.signal}));assert.deepEqual(await counts(child),{requests:0,bytes:0,wireBytes:0});
});
test('identity changes only after valid socket inventory: no HTTP headers or body',async t=>{
 const {child,port}=await fixture(t);let identityReads=0,inventoryValidated=false;
 const realExecute=(await import('node:util')).promisify((await import('node:child_process')).execFile);
 const fetch=await createOwnedEndpointFetch({child,executeImpl:async(file,args,options)=>{
  const result=await realExecute(file,args,options);
  if(file.endsWith('lsof')){
   assert.match(result.stdout,/TST=ESTABLISHED/);inventoryValidated=true;
  }else if(file==='/bin/ps'){
   identityReads++;
   if(inventoryValidated)return {stdout:result.stdout+' changed-after-inventory'};
  }
  return result;
 }});
 await assert.rejects(fetch('http://127.0.0.1:'+port+'/api/chat',{method:'POST',body:'NEVER_SEND_AFTER_IDENTITY_CHANGE'}));
 assert.equal(inventoryValidated,true);assert.equal(identityReads,3);
 assert.deepEqual(await counts(child),{requests:0,bytes:0,wireBytes:0});
});
test('bodyless statuses and HEAD resolve; unsupported Response status rejects instead of escaping callback',async t=>{
 const {child,port}=await statusFixture(t);
 const fetch=await createOwnedEndpointFetch({child});const url='http://127.0.0.1:'+port;
 for(const status of [204,205,304]){const response=await fetch(url+'/'+status);assert.equal(response.status,status);assert.equal(response.body,null);assert.equal(await response.text(),'');}
 const complete205=await fetch(url+'/bodyless-complete');assert.equal(complete205.status,205);assert.equal(complete205.body,null);assert.equal(await complete205.text(),'');
 const head=await fetch(url+'/200',{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.body,null);
 await assert.rejects(fetch(url+'/700'),RangeError);
 const normal=await fetch(url+'/200');assert.equal(await normal.text(),'synthetic');
});

test('response body limit accepts exactly 262144 and rejects 262145 without poisoning next request',async t=>{
 const {child,port}=await statusFixture(t),fetch=await createOwnedEndpointFetch({child});const url='http://127.0.0.1:'+port;
 assert.equal((await (await fetch(url+'/bytes/262144')).arrayBuffer()).byteLength,262144);
 await assert.rejects(fetch(url+'/bytes/262145'),error=>error.code==='ERR_OWNED_RESPONSE_LIMIT');
 assert.equal(await (await fetch(url+'/200')).text(),'synthetic');
});
test('15 second request deadline covers incomplete full body and advertised bodyless content', {timeout:35000},async t=>{
 const {child,port}=await statusFixture(t),fetch=await createOwnedEndpointFetch({child});const url='http://127.0.0.1:'+port;
 const started=Date.now();
 await Promise.all(['/unfinished','/bodyless-open'].map(async route=>{
  await assert.rejects(fetch(url+route),error=>error.name==='TimeoutError');
 }));
 assert.ok(Date.now()-started>=14000);assert.ok(Date.now()-started<30000);
 assert.equal(await (await fetch(url+'/200')).text(),'synthetic');
});

test('production request deadline stays 15000ms despite test scheduling margin',async()=>{
 const source=await (await import('node:fs/promises')).readFile(new URL('../server/owned-endpoint-fetch.mjs',import.meta.url),'utf8');
 assert.match(source,/AbortSignal\.timeout\(15000\)/);
});
test('raw 205 has actual wire bytes and large body is bounded before bodyless conversion',async t=>{
 const {child,port}=await statusFixture(t),net=await import('node:net');
 const bytes=await new Promise((resolve,reject)=>{const socket=net.createConnection({host:'127.0.0.1',port});const parts=[];socket.setTimeout(3000,()=>socket.destroy(Error('wire probe deadline')));socket.once('connect',()=>socket.end('GET /bodyless-complete HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n'));socket.on('data',part=>parts.push(part));socket.once('error',reject);socket.once('end',()=>resolve(Buffer.concat(parts).toString()));});
 assert.match(bytes,/Content-Length: 5\r\n/);assert.ok(bytes.endsWith('\r\n\r\nextra'));
 const fetch=await createOwnedEndpointFetch({child}),url='http://127.0.0.1:'+port;
 const response=await fetch(url+'/bodyless-complete');assert.equal(response.body,null);assert.equal(await response.text(),'');
 await assert.rejects(fetch(url+'/bodyless-large'),error=>error.code==='ERR_OWNED_RESPONSE_LIMIT');
 assert.equal(await (await fetch(url+'/200')).text(),'synthetic');
});
test('only an actual refused connection is classified as not ready; inventory errors stay unverified',async t=>{
 const {child}=await fixture(t);const {EventEmitter}=await import('node:events');
 const fetch=await createOwnedEndpointFetch({child,connectImpl:()=>{const socket=new EventEmitter();socket.destroy=()=>socket;queueMicrotask(()=>socket.emit('error',Object.assign(Error('refused'),{code:'ECONNREFUSED'})));return socket;}});await assert.rejects(fetch('http://127.0.0.1:12345/api/version'),error=>error.code==='ERR_OWNED_ENDPOINT_NOT_READY');
 const realFetch=await createOwnedEndpointFetch({child});
 const other=await fixture(t);await assert.rejects(realFetch('http://127.0.0.1:'+other.port+'/api/version'),error=>error.code==='ERR_OWNED_ENDPOINT_UNVERIFIED');assert.deepEqual(await counts(other.child),{requests:0,bytes:0,wireBytes:0});
});
test('non-refused socket error remains unverified and is never retried by transport',async t=>{
 const {child,port}=await fixture(t);const {EventEmitter}=await import('node:events');let connections=0,destroyed=0;
 const fetch=await createOwnedEndpointFetch({child,connectImpl:()=>{
  connections++;const socket=new EventEmitter();socket.destroy=()=>{destroyed++;socket.destroyed=true;return socket;};
  queueMicrotask(()=>socket.emit('error',Object.assign(Error('synthetic socket denied'),{code:'EACCES'})));return socket;
 }});
 await assert.rejects(fetch('http://127.0.0.1:'+port+'/api/version'),error=>error.code==='ERR_OWNED_ENDPOINT_UNVERIFIED');
 assert.equal(connections,1);assert.ok(destroyed>=1);assert.deepEqual(await counts(child),{requests:0,bytes:0,wireBytes:0});
});
test('inventory failure retains private cause but exposes stable verification message',async t=>{
 const {child,port}=await fixture(t);const realExecute=(await import('node:util')).promisify((await import('node:child_process')).execFile);const diagnostic=Error('PRIVATE_SYNTHETIC_LSOF_DETAIL');
 const fetch=await createOwnedEndpointFetch({child,executeImpl:async(...args)=>{if(args[0].endsWith('lsof'))throw diagnostic;return realExecute(...args);}});
 await assert.rejects(fetch('http://127.0.0.1:'+port+'/api/version'),error=>error.code==='ERR_OWNED_ENDPOINT_UNVERIFIED'&&error.cause===diagnostic&&error.message==='No se pudo verificar la conexión del motor propio.');
 assert.deepEqual(await counts(child),{requests:0,bytes:0,wireBytes:0});
});
test('refused error after connect is unverified, not startup retryable',async t=>{
 const {child}=await fixture(t);const {EventEmitter}=await import('node:events');let reads=0;
 const fetch=await createOwnedEndpointFetch({child,executeImpl:async()=>{reads++;if(reads===1)return {stdout:child.pid+' synthetic start'};return new Promise(()=>{});},connectImpl:()=>{const socket=new EventEmitter();socket.destroy=()=>socket;queueMicrotask(()=>{socket.emit('connect');socket.emit('error',Object.assign(Error('post-connect refused'),{code:'ECONNREFUSED'}));});return socket;}});
 await assert.rejects(fetch('http://127.0.0.1:12345/api/version'),error=>error.code==='ERR_OWNED_ENDPOINT_UNVERIFIED');
});
