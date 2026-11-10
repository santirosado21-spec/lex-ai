import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,readdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createStt} from '../server/stt.mjs';

test('an incompatible bundled dictation engine never downloads or launches',async t=>{
 const root=await mkdtemp(path.join(tmpdir(),'lex-stt-arch-'));t.after(async()=>{const {rm}=await import('node:fs/promises');await rm(root,{recursive:true,force:true});});
 await writeFile(path.join(root,'whisper-cli'),'synthetic');await writeFile(path.join(root,'runtime.json'),JSON.stringify({supportedArchs:['arm64']}));
 const stt=createStt({dataDir:root,runtimeDir:root,dependencies:{arch:()=> 'x64',fetch:()=>assert.fail('no download'),spawn:()=>assert.fail('no launch')}});
 assert.equal((await stt.status()).runtimeAvailable,false);
 await assert.rejects(stt.initialize(),/conversar por escrito/);await assert.rejects(stt.transcribe({audioBase64:wav().toString('base64')}),/conversar por escrito/);
});

const digest=value=>createHash('sha256').update(value).digest('hex');
function wav(){const bytes=Buffer.alloc(46);bytes.write('RIFF');bytes.writeUInt32LE(38,4);bytes.write('WAVE',8);bytes.write('fmt ',12);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(16000,24);bytes.writeUInt32LE(32000,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(2,40);return bytes;}
async function fixture(t,{body=Buffer.from('modelo sintético'),spawnImpl,timeoutMs}={}){
 const root=await mkdtemp(path.join(tmpdir(),'lex-stt-test-')),runtime=path.join(root,'runtime'),models=path.join(root,'models');await mkdir(runtime,{recursive:true});await writeFile(path.join(runtime,'whisper-cli'),'fixture');const catalog={small:{file:'model.bin',bytes:body.length,sha256:digest(body),minFreeMemoryGB:1,default:true}};
 const calls=[];const defaultSpawn=(_bin,_args)=>{const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.kill=()=>{};queueMicrotask(()=>{child.stdout.emit('data',Buffer.from('\u001b[31mTexto\u0000 sintético\n'));child.emit('exit',0);});return child;};const spawn=(...args)=>{calls.push(args[1]);return (spawnImpl||defaultSpawn)(...args);};
 const stt=createStt({dataDir:root,runtimeDir:runtime,modelsDir:models,catalog,timeoutMs,dependencies:{spawn,fetch:async()=>({ok:true,status:200,headers:{get:()=>String(body.length)},body:(async function*(){yield body;})()}),memory:async()=>({availableBytes:2*1024**3,freeBytes:2*1024**3,method:'test'})}});
 t.after(async()=>{await import('node:fs/promises').then(({rm})=>rm(root,{recursive:true,force:true}));});return {root,models,stt,calls};
}
async function ready(stt){await stt.initialize();for(let n=0;n<30;n++){const status=await stt.status();if(status.state==='ready')return status;await new Promise(resolve=>setTimeout(resolve,2));}throw Error('dictado fixture no quedó listo');}

test('downloads only the approved bytes, verifies hash and constructs fixed whisper argv',async t=>{const f=await fixture(t);await ready(f.stt);const result=await f.stt.transcribe({audioBase64:wav().toString('base64')});assert.equal(result.text,'Texto sintético');assert.deepEqual(f.calls[0].slice(0,6),['-m',path.join(f.models,'model.bin'),'-l','es','-nt','-np']);assert.equal(f.calls[0][6],'-f');assert.match(f.calls[0][7],/dictation-tmp\/.+\.wav$/);});
test('refuses a model whose downloaded hash does not match the approved catalog',async t=>{const f=await fixture(t,{body:Buffer.from('esperado')});const bad=createStt({dataDir:f.root,runtimeDir:path.join(f.root,'runtime'),modelsDir:path.join(f.root,'bad-models'),catalog:{small:{file:'model.bin',bytes:8,sha256:digest('different'),minFreeMemoryGB:1,default:true}},dependencies:{fetch:async()=>({ok:true,status:200,headers:{get:()=>null},body:(async function*(){yield Buffer.from('esperado');})()}),memory:async()=>({availableBytes:2e9})}});await bad.initialize();for(let n=0;n<20;n++){const status=await bad.status();if(!status.busy){assert.equal(status.installed,false);assert.match(status.message,/integridad/);return;}await new Promise(resolve=>setTimeout(resolve,2));}assert.fail('la descarga dañada no terminó');});
test('rejects oversize audio and a concurrent job before spawning a second process',{timeout:5000},async t=>{
 let child,notifySpawn;
 const spawned=new Promise(resolve=>{notifySpawn=resolve;});
 const f=await fixture(t,{spawnImpl:()=>{
  child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.kill=()=>{};
  notifySpawn();return child;
 }});
 await ready(f.stt);
 await assert.rejects(f.stt.transcribe({audioBase64:Buffer.alloc(4*1024*1024+1).toString('base64')}),/hasta 4 MB/);
 const first=f.stt.transcribe({audioBase64:wav().toString('base64')});
 try{
  // Synchronize with the actual injected spawn, not an assumed filesystem latency.
  await Promise.race([spawned,first.then(()=>assert.fail('job ended before spawn'))]);
  await assert.rejects(f.stt.transcribe({audioBase64:wav().toString('base64')}),/operación de dictado/);
  assert.equal(f.calls.length,1);
  child.stdout.emit('data',Buffer.from('Una prueba'));child.emit('exit',0);
  await first;
 }finally{
  child?.emit('exit',0);
  await first.catch(()=>{});
 }
});
test('times out and deletes its owner-only temporary WAV in finally',async t=>{let killed=false;const f=await fixture(t,{timeoutMs:5,spawnImpl:()=>{const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.kill=()=>{killed=true;};return child;}});await ready(f.stt);await assert.rejects(f.stt.transcribe({audioBase64:wav().toString('base64')}),/60 segundos/);assert.equal(killed,true);const files=await readdir(path.join(f.root,'dictation-tmp'));assert.deepEqual(files,[]);});
