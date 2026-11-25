import test from 'node:test';import assert from 'node:assert/strict';import {PassThrough} from 'node:stream';import {mkdtemp,realpath,rm,readdir} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
import {createNativePilotSecretReader} from '../server/native-pilot-secret.mjs';import {runNativePilotPipe} from '../server/native-pilot-pipe.mjs';
const secret=()=>Buffer.from('frase sintetica para prueba de pipes');
async function setup(t,readSecret){const root=await realpath(await mkdtemp(path.join(tmpdir(),'native-pipe-')));t.after(()=>rm(root,{recursive:true,force:true}));const input=new PassThrough(),output=new PassThrough(),rows=[];let text='';output.on('data',b=>{text+=b;let i;while((i=text.indexOf('\n'))>=0){rows.push(JSON.parse(text.slice(0,i)));text=text.slice(i+1);}});const done=runNativePilotPipe({root,exercise:'case-a',input,output,readSecret});return {root,input,output,rows,done,send:op=>input.write(JSON.stringify({op})+'\n'),next:async(n=1)=>{const end=Date.now()+3000;while(rows.length<n&&Date.now()<end)await new Promise(r=>setTimeout(r,5));assert.ok(rows.length>=n);return rows[n-1];}};}
test('fixed hidden native dialog keeps secrets out of argv/env and clears captured buffers',async()=>{
 let captured,stderr,options,args;const reader=createNativePilotSecretReader({platform:'darwin',execFileImpl:(file,a,o,cb)=>{assert.equal(file,'/usr/bin/osascript');args=a;options=o;captured=Buffer.concat([secret(),Buffer.from('\n')]);stderr=Buffer.from('synthetic diagnostic');cb(null,captured,stderr);}});const answer=await reader('unlock');assert.deepEqual(answer,secret());assert.ok(captured.every(x=>x===0)&&stderr.every(x=>x===0));assert.deepEqual(options.env,{});assert.equal(options.encoding,'buffer');assert.equal(options.shell,false);assert.ok(!JSON.stringify(args).includes(secret().toString()));answer.fill(0);
 await assert.rejects(reader('arbitrary-script'));await assert.rejects(createNativePilotSecretReader({platform:'linux'})('unlock'));
 const invalid=createNativePilotSecretReader({platform:'darwin',execFileImpl:(_f,_a,_o,cb)=>cb(null,Buffer.from('short\n'),Buffer.alloc(0))});await assert.rejects(invalid('create'));
 const cancelled=createNativePilotSecretReader({platform:'darwin',execFileImpl:(_f,_a,_o,cb)=>cb(Error('cancelled'),secret(),Buffer.alloc(0))});await assert.rejects(cancelled('unlock'));
});
test('private pipe creates real encrypted session, rotates connection and confirms lock before replying',async t=>{
 const buffers=[],prompts=[];const p=await setup(t,async kind=>{prompts.push(kind);const b=secret();buffers.push(b);return b;});p.send('status');assert.equal((await p.next()).result.state,'locked');assert.deepEqual(await readdir(p.root),[]);
 p.send('create');const first=(await p.next(2)).result;assert.equal(first.state,'unlocked');assert.ok(buffers.every(b=>b.every(x=>x===0)));assert.deepEqual(prompts,['create','confirm']);assert.ok(!JSON.stringify(p.rows).includes(secret().toString()));
 p.send('unlock');assert.equal((await p.next(3)).ok,false);assert.deepEqual(prompts,['create','confirm']);
 p.send('lock');assert.equal((await p.next(4)).result.state,'locked');await assert.rejects(fetch(first.connection.url+'/api'));
 p.send('unlock');const second=(await p.next(5)).result;assert.notEqual(second.connection.token,first.connection.token);
 p.send('dispose');assert.equal((await p.next(6)).result.state,'disposed');assert.deepEqual(await p.done,{closed:true,failed:false});await assert.rejects(fetch(second.connection.url+'/api'));
});
test('protocol rejects malformed, extra, duplicate, unknown operations without invoking hidden input',async t=>{
 let calls=0;const p=await setup(t,async()=>{calls++;return secret();});
 for(const line of ['notjson','[]','{"op":"unlock","passphrase":"not allowed"}','{"op":"unlock","op":"status"}','{"op":"future"}'])p.input.write(line+'\n');
 await p.next(5);assert.ok(p.rows.every(r=>r.ok===false));assert.equal(calls,0);p.input.end();assert.deepEqual(await p.done,{closed:true,failed:false});
});
test('EOF cancels pending secret request and disposes without emitting a connection',async t=>{
 let aborted=false;const p=await setup(t,async(_kind,{signal})=>new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>{aborted=true;reject(Error('cancelled'));},{once:true});}));p.send('unlock');p.input.end();assert.deepEqual(await p.done,{closed:true,failed:false});assert.equal(aborted,true);assert.equal(p.rows.length,0);
});
test('overflow and truncated frames close cleanly, concurrent commands cannot interleave secrets',async t=>{
 const p=await setup(t,async()=>secret());p.input.write(Buffer.alloc(130,120));assert.deepEqual(await p.done,{closed:true,failed:true});
 let release;const wait=new Promise(r=>{release=r;});const q=await setup(t,async()=>{await wait;return secret();});q.send('create');q.send('unlock');assert.equal((await q.next()).ok,false);release();assert.equal((await q.next(2)).ok,true);q.input.end();assert.deepEqual(await q.done,{closed:true,failed:false});
 const r=await setup(t,async()=>secret());r.input.end('{"op":');assert.deepEqual(await r.done,{closed:true,failed:true});assert.equal(r.rows.length,0);
});

test('real child pipes have no stdout secret, and EOF removes its live HTTP listener',async t=>{
 const {spawn}=await import('node:child_process');const root=await realpath(await mkdtemp(path.join(tmpdir(),'native-child-')));t.after(()=>rm(root,{recursive:true,force:true}));
 const source=`import {runNativePilotPipe} from './server/native-pilot-pipe.mjs';await runNativePilotPipe({input:process.stdin,output:process.stdout,root:process.argv[1],exercise:'case-a',readSecret:async()=>Buffer.alloc(24,97)});`;
 const child=spawn(process.execPath,['--input-type=module','-e',source,root],{cwd:new URL('..',import.meta.url),stdio:['pipe','pipe','pipe'],env:{}});t.after(()=>{if(child.exitCode===null)child.kill('SIGKILL');});let stdout='',stderr='';child.stderr.on('data',b=>{stderr+=b;});child.stdout.on('data',b=>{stdout+=b;});const exit=new Promise(resolve=>child.once('exit',code=>resolve(code)));
 child.stdin.write('{"op":"create"}\n');const deadline=Date.now()+5000;while(!stdout.includes('\n')&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));const response=JSON.parse(stdout.trim());assert.equal(response.ok,true);assert.ok(!stdout.includes('a'.repeat(24)));assert.ok(!stderr.includes('a'.repeat(24)));child.stdin.end();assert.equal(await exit,0);await assert.rejects(fetch(response.result.connection.url+'/api'));
});

test('dialog refusal returns generic error and a subsequent operation works; output loss disposes live session',async t=>{
 let attempts=0;const p=await setup(t,async()=>{if(++attempts===1)throw Error('sensitive native error detail');return secret();});p.send('unlock');assert.deepEqual(await p.next(),{ok:false,error:'request_failed'});p.send('status');assert.equal((await p.next(2)).result.state,'locked');p.send('create');const connection=(await p.next(3)).result.connection;p.output.destroy();assert.deepEqual(await p.done,{closed:true,failed:false});await assert.rejects(fetch(connection.url+'/api'));
});
