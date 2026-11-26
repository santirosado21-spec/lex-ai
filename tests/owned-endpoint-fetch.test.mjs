import test from 'node:test';import assert from 'node:assert/strict';import {fork} from 'node:child_process';import {once} from 'node:events';import http from 'node:http';
import {createOwnedEndpointFetch,hasOwnedConnection} from '../server/owned-endpoint-fetch.mjs';
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
