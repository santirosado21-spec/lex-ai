import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {requireNodeVersion,runWindowsMemorySmoke,SYNTHETIC_PROCESS} from '../scripts/windows-memory-smoke.mjs';
function fixture(){
 const child=new EventEmitter();Object.assign(child,{pid:123456,connected:true,exitCode:null,signalCode:null,disconnect(){this.connected=false;this.exitCode=0;queueMicrotask(()=>this.emit('exit',0,null));},kill(){throw Error('Graceful cleanup should suffice.');}});
 return {child,spawnNode:(file,args,options)=>{assert.equal(file,process.execPath);assert.deepEqual(args,['--input-type=commonjs','-e',SYNTHETIC_PROCESS]);assert.deepEqual(options,{stdio:['ignore','ignore','ignore','ipc'],windowsHide:true,shell:false});queueMicrotask(()=>child.emit('message','ready'));return child;}};
}
const windows={platform:'win32',arch:'x64',nodeVersion:'v22.13.0'};
test('preinstalled Node version gate never installs or silently accepts old versions',()=>{
 for(const v of ['v22.13.0','v22.99.1','v24.0.0'])assert.doesNotThrow(()=>requireNodeVersion(v));
 for(const v of ['v22.12.9','v20.19.0','latest','v22.13.0-rc.1'])assert.throws(()=>requireNodeVersion(v));
});
test('Windows smoke measures only owned PID in four serial samples and observes cleanup',async()=>{
 const f=fixture();let calls=0,active=0,clock=0;
 const report=await runWindowsMemorySmoke({...windows,spawnNode:f.spawnNode,measure:async pid=>{assert.equal(pid,f.child.pid);assert.equal(active++,0);await Promise.resolve();active--;calls++;return 20*1024*1024;},now:()=>clock+=5});
 assert.equal(report.status,'PASS');assert.equal(calls,4);assert.equal(report.samples.length,4);assert.deepEqual(report.samples[0],{sample:1,rssBytes:20971520,elapsedMs:5});assert.deepEqual(report.cleanup,{exitObserved:true,forced:false});assert.equal(report.physical8GBValidation,false);assert.equal(report.installerValidation,false);assert.equal(report.inferenceValidation,false);
});
test('measurement failure stops without retries, zero fallback, raw stderr or orphan',async()=>{
 const f=fixture();let calls=0;
 const report=await runWindowsMemorySmoke({...windows,spawnNode:f.spawnNode,measure:async()=>{calls++;throw Error('private/path/raw PowerShell command');}});
 assert.equal(report.status,'FAIL');assert.equal(calls,1);assert.deepEqual(report.samples,[]);assert.equal(report.cleanup.exitObserved,true);assert.doesNotMatch(JSON.stringify(report),/private\/path|raw PowerShell/);assert.match(report.failure,/no retry or fallback/);
});
test('invalid/zero measurements fail and still clean up; non-Windows never spawns',async()=>{
 for(const rss of [0,-1,NaN,Infinity,1.5]){const f=fixture();const report=await runWindowsMemorySmoke({...windows,spawnNode:f.spawnNode,measure:async()=>rss});assert.equal(report.status,'FAIL');assert.equal(report.cleanup.exitObserved,true);}
 let spawned=false;const report=await runWindowsMemorySmoke({...windows,platform:'darwin',spawnNode:()=>{spawned=true;}});assert.equal(spawned,false);assert.equal(report.status,'FAIL');
});
test('fixed fixture exits on IPC disconnect and has its own lifetime bound',async()=>{
 assert.match(SYNTHETIC_PROCESS,/process\.on\('disconnect'/);assert.match(SYNTHETIC_PROCESS,/30000/);assert.doesNotMatch(SYNTHETIC_PROCESS,/spawn|exec|fetch|process\.env/);
 // This is an actual local process-lifecycle check with mock RSS, not CIM or
 // Windows acceptance on a non-Windows development host.
 const children=[];
 const report=await runWindowsMemorySmoke({...windows,spawnNode:(...args)=>{const child=spawn(...args);children.push(child);return child;},measure:async()=>1024});
 assert.equal(report.status,'PASS');assert.equal(children.length,1);assert.equal(children[0].exitCode,0);assert.equal(children[0].connected,false);assert.equal(report.cleanup.exitObserved,true);
});
test('workflow is narrowly scoped, public-only, read-only and pinned without installation or uploads',async()=>{
 const workflow=await readFile(new URL('../.github/workflows/windows-memory-smoke.yml',import.meta.url),'utf8');
 assert.match(workflow,/branches: \[docs\/hybrid-psf-development-loop\]/);assert.match(workflow,/github\.event\.repository\.private == false/);assert.match(workflow,/runs-on: windows-2025/);assert.match(workflow,/timeout-minutes: 5/);assert.match(workflow,/contents: read/);assert.match(workflow,/actions\/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5/);assert.match(workflow,/persist-credentials: false/);
 assert.doesNotMatch(workflow,/pull_request:|workflow_dispatch:|schedule:|upload-artifact|setup-node|secrets\.|npm ci|npm install|release:|deployment:|services:|cache:/);
});
test('early child exit and forced cleanup cannot produce a pass',async()=>{
 const f=fixture();f.child.disconnect=function(){this.connected=false;};f.child.kill=function(){this.exitCode=1;queueMicrotask(()=>this.emit('exit',1,null));};
 const forced=await runWindowsMemorySmoke({...windows,spawnNode:f.spawnNode,measure:async()=>1024});
 assert.equal(forced.status,'FAIL');assert.deepEqual(forced.cleanup,{exitObserved:true,forced:true});assert.match(forced.failure,/forced cleanup/);
 const g=fixture();let measured=0;
 const early=await runWindowsMemorySmoke({...windows,spawnNode:(...args)=>{const child=g.spawnNode(...args);queueMicrotask(()=>{child.exitCode=3;child.emit('exit',3,null);});return child;},measure:async()=>{measured++;return 1024;}});
 assert.equal(early.status,'FAIL');assert.equal(early.cleanup.exitObserved,true);assert.equal(measured,0);
});
