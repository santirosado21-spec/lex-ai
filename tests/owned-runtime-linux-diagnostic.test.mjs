// Diagnostic only: real Linux synthetic processes, never model/product activation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {once} from 'node:events';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {processTreeRss} from '../server/runtime-memory.mjs';
const fixture=fileURLToPath(new URL('./fixtures/owned-runtime-process.py',import.meta.url));
const linux=process.platform==='linux';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function state(pid){try{const stat=await readFile(`/proc/${pid}/stat`,'utf8');return stat.slice(stat.lastIndexOf(')')+2).split(' ')[0];}catch(e){if(['ENOENT','ESRCH'].includes(e.code))return null;throw e;}}
async function alive(pid){const s=await state(pid);return s!==null&&s!=='Z'&&s!=='X';}
async function until(check,ms=3000){const end=Date.now()+ms;do{if(await check())return;await sleep(20);}while(Date.now()<end);throw Error('process diagnostic deadline exceeded');}
function signal(pid,value,group=false){try{return process.kill(group?-pid:pid,value);}catch(e){if(e.code==='ESRCH')return false;throw e;}}
async function tree(t,mode){
 const child=spawn('python3',[fixture,mode],{detached:true,stdio:['ignore','pipe','pipe']});
 let info;let deadline;
 t.after(async()=>{if(info)signal(info.leaf.pid,'SIGKILL');signal(child.pid,'SIGKILL',true);await until(async()=>!(await alive(child.pid))&&(!info||!(await alive(info.leaf.pid))));});
 const lines=createInterface({input:child.stdout});const line=await Promise.race([once(lines,'line').then(([s])=>s),once(child,'error').then(([e])=>{throw e;}),new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('fixture failed to start')),3000);})]).finally(()=>clearTimeout(deadline));
 lines.close();info=JSON.parse(line);assert.equal(info.pid,child.pid);assert.notEqual(info.pid,process.pid);return {child,...info};
}
test('Linux real tree RSS sees both synthetic allocations, not only leader', {skip:!linux,timeout:8000},async t=>{
 const p=await tree(t,'normal');assert.equal(p.pgid,p.pid);assert.equal(p.leaf.pgid,p.pid);
 const treeRss=await processTreeRss(p.pid),leafRss=await processTreeRss(p.leaf.pid);
 assert.ok(treeRss>leafRss+16*1024**2,JSON.stringify({treeRss,leafRss}));assert.ok(treeRss>=48*1024**2);assert.ok(treeRss<256*1024**2);t.diagnostic(JSON.stringify({platform:process.platform,treeRssBytes:treeRss,leafRssBytes:leafRss}));
});
test('Linux group TERM stops leader and same-group descendant', {skip:!linux,timeout:8000},async t=>{
 const p=await tree(t,'normal');assert.equal(signal(p.pid,'SIGTERM',true),true);
 await until(async()=>!(await alive(p.pid))&&!(await alive(p.leaf.pid)));
});
test('Linux TERM-ignoring tree survives TERM and stops on group KILL', {skip:!linux,timeout:8000},async t=>{
 const p=await tree(t,'stubborn');signal(p.pid,'SIGTERM',true);await sleep(100);assert.ok(await alive(p.pid));assert.ok(await alive(p.leaf.pid));
 signal(p.pid,'SIGKILL',true);await until(async()=>!(await alive(p.pid))&&!(await alive(p.leaf.pid)));
});
test('Linux escaped descendant survives leader group kill: negative control, not tree isolation', {skip:!linux,timeout:8000},async t=>{
 const p=await tree(t,'escaped');assert.notEqual(p.leaf.pgid,p.pgid);signal(p.pid,'SIGKILL',true);
 await until(async()=>!(await alive(p.pid)));assert.ok(await alive(p.leaf.pid));
 await assert.rejects(processTreeRss(p.pid),/motor no aparece/);
 signal(p.leaf.pid,'SIGKILL');await until(async()=>!(await alive(p.leaf.pid)));
});
test('Linux kernel address-space cap allows 16MiB but rejects 160MiB allocation', {skip:!linux,timeout:8000},async()=>{
 for(const [megabytes,blocked] of [[16,false],[160,true]]){
  const child=spawn('python3',[fixture,'memory',String(megabytes)],{stdio:['ignore','pipe','pipe']});let out='',err='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);const timer=setTimeout(()=>child.kill('SIGKILL'),5000);const [code,signal]=await once(child,'exit').finally(()=>clearTimeout(timer));assert.equal(code,0,err);assert.equal(signal,null);const value=JSON.parse(out);assert.equal(value.limitKind,'RLIMIT_AS');assert.equal(value.blocked===true,blocked);if(!blocked)assert.equal(value.allocated,16*1024**2);
 }
});
test('Linux per-process address-space cap does not cap aggregate tree memory', {skip:!linux,timeout:8000},async()=>{
 const child=spawn('python3',[fixture,'memory-tree'],{detached:true,stdio:['ignore','pipe','pipe']});let out='',err='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);
 const timer=setTimeout(()=>signal(child.pid,'SIGKILL',true),5000);
 try{const [code,signal]=await once(child,'exit');assert.equal(code,0,err);assert.equal(signal,null);const value=JSON.parse(out);assert.ok(value.allocatedTotal>value.perProcessLimit);assert.equal(value.allocatedTotal,128*1024**2);}finally{clearTimeout(timer);signal(child.pid,'SIGKILL',true);}
});
