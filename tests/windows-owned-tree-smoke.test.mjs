import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {EventEmitter} from 'node:events';
import {fixtureCode,validateTree,validateSnapshot,runOwnedTreeSmoke,verifyFreeze} from '../scripts/windows-owned-tree-smoke.mjs';
const rows=[{pid:100,ppid:99,role:0},{pid:101,ppid:100,role:1},{pid:102,ppid:101,role:2}];
const frame=(extra='')=>'WMI2:1:100:'+(extra?5:4)+':100,99,10;101,100,20;102,101,30;200,99,40'+extra;
test('exact three-level ownership and closure positive RSS, outside excluded',()=>{assert.equal(validateTree(rows,100,99),rows);assert.equal(validateSnapshot(frame(),1,rows,200,99).rssBytes,60)});
test('reject foreign parent, duplicate PID, reordered role, extra fields',()=>{for(const patch of [{pid:100},{ppid:88},{role:0},{secret:1}]){const bad=structuredClone(rows);Object.assign(bad[1],patch);assert.throws(()=>validateTree(bad,100,99))}});
test('reject missing grandchild, zero RSS, collector descendant, extra owned descendant',()=>{for(const f of [frame().replace('102,101,30','102,99,30'),frame().replace('102,101,30','102,101,0'),frame().replace('200,99,40','200,100,40'),frame(';103,102,8')])assert.throws(()=>validateSnapshot(f,1,rows,200,99))});
test('wrong request id and malformed frame fail closed',()=>{assert.throws(()=>validateSnapshot(frame(),2,rows,200,99));assert.throws(()=>validateSnapshot(frame()+'garbage',1,rows,200,99))});
test('default CLI plan never starts a fixture',async()=>{const c=spawn(process.execPath,['scripts/windows-owned-tree-smoke.mjs'],{stdio:['ignore','pipe','pipe']});let out='';for await(const b of c.stdout)out+=b;assert.equal(JSON.parse(out).status,'PLAN')});
test('non-Windows execution rejected before spawn',async()=>{const r=await runOwnedTreeSmoke({platform:'darwin',spawnNode(){throw Error('must not spawn')}});assert.equal(r.status,'FAIL');assert.equal(r.samples.length,0)});
test('freeze missing approval/source inventory rejected',async()=>{await assert.rejects(verifyFreeze({}));await assert.rejects(verifyFreeze({scope:'windows-owned-tree-smoke-v1',approvedForSingleRun:true,sourceHashes:{}}))});
test('actual stdlib fixture three levels readiness and child-first exit, no WMI',async()=>{const child=spawn(process.execPath,['--input-type=commonjs','-e',fixtureCode(),'0'],{env:{},stdio:['ignore','ignore','ignore','ipc']});try{const ready=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('timeout')),5000);child.once('message',m=>{clearTimeout(t);resolve(m)})});assert.equal(ready.kind,'ready');validateTree(ready.rows,child.pid,process.pid);const receipt=new Promise(resolve=>child.once('message',resolve));const exit=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));child.send('stop');assert.deepEqual((await receipt).roles,[2,1]);assert.deepEqual(await exit,{code:0,signal:null});}finally{if(child.exitCode===null)child.kill()}});
function fakeRun({lateExit=false,badSnapshot=false,forced=false}={}){
 const child=new EventEmitter();Object.assign(child,{pid:100,exitCode:null,signalCode:null,connected:true,kill(){this.exitCode=9;this.emit('exit',9,null)},send(){queueMicrotask(()=>{this.emit('message',{kind:'reaped',roles:[2,1]});queueMicrotask(()=>{this.exitCode=forced?3:0;this.connected=false;this.emit('exit',this.exitCode,null)})})}});
 const collector=new EventEmitter();collector.pid=200;collector.stdout=new EventEmitter();let n=0;
 const sample=()=>{n++;collector.stdout.emit('data',Buffer.from(frame().replace('WMI2:1:',`WMI2:${n}:`).replace('100,99,10',`100,${process.pid},10`)+(badSnapshot?'x':'')+'\n'));if(lateExit&&n===5){child.exitCode=3;child.emit('exit',3,null)}return {rssBytes:60,elapsedMs:1}};
 return runOwnedTreeSmoke({platform:'win32',arch:'x64',nodeVersion:'22.13.0',systemRoot:'C:\\Windows',spawnNode(){queueMicrotask(()=>child.emit('message',{kind:'ready',rows:rows.map((r,i)=>i? r:{...r,ppid:process.pid})}));return child},spawnCollector(){return collector},makeMonitor(options){options.spawnProcess();return {async start(){return sample()},async readRss(){return sample()},async close(){return {exitObserved:true,killed:false,exitCode:0,signal:null,category:null}}}},killOwned(){}});
}
test('mock whole run requires bootstrap plus four snapshots and all cleanup',async()=>{const r=await fakeRun();assert.equal(r.status,'PASS');assert.equal(r.samples.length,4);assert.equal(r.fixtureCleanup.allThreeReaped,true)});
test('final awaited sample unexpected fixture exit cannot pass',async()=>{assert.equal((await fakeRun({lateExit:true})).status,'FAIL')});
test('malformed observed snapshot cannot pass',async()=>{assert.equal((await fakeRun({badSnapshot:true})).status,'FAIL')});
test('nonzero shutdown exit cannot pass',async()=>{assert.equal((await fakeRun({forced:true})).status,'FAIL')});
