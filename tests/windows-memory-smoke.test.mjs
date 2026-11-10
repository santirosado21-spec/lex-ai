import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {requireNodeVersion,runWindowsMemorySmoke,runPersistentWindowsMemorySmoke,SYNTHETIC_PROCESS} from '../scripts/windows-memory-smoke.mjs';
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
test('protocol 2 reports cold first snapshot separately from four fresh steady requests',async()=>{
 const f=fixture();let readings=0,closed=false;
 const report=await runPersistentWindowsMemorySmoke({...windows,spawnNode:(_file,args)=>{assert.equal(args[2],SYNTHETIC_PROCESS.replace('30000','60000'));queueMicrotask(()=>f.child.emit('message','ready'));return f.child;},makeMonitor:({rootPid})=>{assert.equal(rootPid,f.child.pid);return {start:async()=>({rssBytes:4096,elapsedMs:4500}),readRss:async()=>{readings++;return {rssBytes:8192,elapsedMs:25};},close:async()=>{closed=true;return {exitObserved:true};},diagnostics:()=>({category:null,killed:false,exitCode:0,signal:null})};}});
 assert.equal(report.status,'PASS');assert.equal(report.startup.elapsedMs,4500);assert.equal(report.startup.includesFirstActualCimSnapshot,true);assert.equal(readings,4);assert.equal(report.samples.length,4);assert.equal(report.requestTimeoutMs,2000);assert.equal(report.protocol1ColdStartBoundPassed,false);assert.equal(report.collectorMemoryOverheadBytes,null);assert.equal(closed,true);assert.equal(report.cleanup.exitObserved,true);
});
test('protocol 2 preserves safe startup failure diagnostics and cleans fixture even when monitor cleanup throws',async()=>{
 for(const cleanupThrows of [false,true]){const f=fixture();let reads=0;const report=await runPersistentWindowsMemorySmoke({...windows,spawnNode:()=>{queueMicrotask(()=>f.child.emit('message','ready'));return f.child;},makeMonitor:()=>({start:async()=>{throw Error('raw private collector path');},readRss:async()=>{reads++;},close:async()=>{if(cleanupThrows)throw Error('raw cleanup path');return {exitObserved:true};},diagnostics:()=>({category:'STARTUP_TIMEOUT',killed:true,exitCode:1,signal:null,phase:'startup',elapsedMs:10000})})});assert.equal(report.status,'FAIL');assert.equal(reads,0);assert.equal(report.samples.length,0);assert.equal(report.cleanup.exitObserved,true);assert.equal(report.diagnostic.category,cleanupThrows?'CLEANUP_ERROR':'STARTUP_TIMEOUT');assert.doesNotMatch(JSON.stringify(report),/raw|private.*path/);}
});
test('protocol 2 final awaited snapshot exit/error and pre-cleanup nonzero exit fail closed',async()=>{
 for(const mode of ['final-exit','final-error','cleanup-exit','normal']){
  const f=fixture();let count=0;
  const report=await runPersistentWindowsMemorySmoke({...windows,spawnNode:()=>{queueMicrotask(()=>f.child.emit('message','ready'));return f.child;},makeMonitor:()=>({
   start:async()=>({rssBytes:1024,elapsedMs:100}),
   readRss:async()=>{if(++count===4){if(mode==='final-exit'){f.child.exitCode=3;f.child.emit('exit',3,null);}if(mode==='final-error')f.child.emit('error',Error('private fixture diagnostic'));}return {rssBytes:1024,elapsedMs:1};},
   close:async()=>{if(mode==='cleanup-exit'){f.child.exitCode=3;f.child.emit('exit',3,null);}return {exitObserved:true};},
   diagnostics:()=>({category:null,killed:false,exitCode:0,signal:null})
  })});
  assert.equal(report.status,mode==='normal'?'PASS':'FAIL');
  assert.equal(report.cleanup.expectedExitZero,mode==='normal');
  assert.equal(report.cleanup.intentionalShutdown,mode==='normal');
  assert.equal(report.samples.length,mode.startsWith('final-')?3:4);
  if(mode==='cleanup-exit'||mode==='final-exit')assert.equal(report.fixtureDiagnostic.exitCode,3);
  if(mode==='final-error')assert.equal(report.fixtureDiagnostic.unexpectedError,true);
  assert.doesNotMatch(JSON.stringify(report),/private fixture/);
 }
});

test('explicit WMI route preserves old routes, rejects unknown flags, uses protocol 3 and same four-sample lifecycle',async()=>{
 const {windowsMemorySmokeRoute,runWmiWindowsMemorySmoke}=await import('../scripts/windows-memory-smoke.mjs');
 assert.equal(windowsMemorySmokeRoute([]),runWindowsMemorySmoke);assert.equal(windowsMemorySmokeRoute(['--persistent']),runPersistentWindowsMemorySmoke);assert.equal(windowsMemorySmokeRoute(['--wmi']),runWmiWindowsMemorySmoke);
 for(const args of [['--unknown'],['--wmi','--persistent'],['--wmi','123'],['--persistent','--wmi']])assert.throws(()=>windowsMemorySmokeRoute(args));
 const f=fixture();let reads=0,closed=false;
 const report=await runWmiWindowsMemorySmoke({...windows,spawnNode:(_file,args)=>{assert.equal(args[2],SYNTHETIC_PROCESS.replace('30000','60000'));queueMicrotask(()=>f.child.emit('message','ready'));return f.child;},makeMonitor:({rootPid})=>{assert.equal(rootPid,f.child.pid);return {start:async()=>({rssBytes:4096,elapsedMs:5000}),readRss:async()=>{reads++;return {rssBytes:8192,elapsedMs:10};},close:async()=>{closed=true;return {exitObserved:true};},diagnostics:()=>({category:null})};}});
 assert.equal(report.status,'PASS');assert.equal(report.protocol,3);assert.equal(reads,4);assert.equal(closed,true);assert.equal(report.startup.includesFirstActualWmiSnapshot,true);assert.equal(Object.hasOwn(report.startup,'includesFirstActualCimSnapshot'),false);assert.equal(report.collectorMeasurementBudgetMs,18000);assert.equal(report.collectorCleanupLimitMs,6000);assert.equal(report.configuredPhaseBudgetMs,35000);assert.equal(report.physical8GBValidation,false);assert.equal(report.cleanup.expectedExitZero,true);
 const workflow=await readFile(new URL('../.github/workflows/windows-memory-smoke.yml',import.meta.url),'utf8');assert.match(workflow,/run: node scripts\/windows-memory-smoke\.mjs --wmi/);assert.doesNotMatch(workflow,/run: node scripts\/windows-memory-smoke\.mjs --persistent/);
});
test('WMI smoke monitor failure stays finite and preserves cleanup without retry',async()=>{
 const {runWmiWindowsMemorySmoke}=await import('../scripts/windows-memory-smoke.mjs');const f=fixture();let reads=0;
 const report=await runWmiWindowsMemorySmoke({...windows,spawnNode:()=>{queueMicrotask(()=>f.child.emit('message','ready'));return f.child;},makeMonitor:()=>({start:async()=>({rssBytes:1,elapsedMs:1}),readRss:async()=>{reads++;throw Error('PRIVATE_ROWS');},close:async()=>({exitObserved:true}),diagnostics:()=>({category:'REQUEST_TIMEOUT'})})});
 assert.equal(report.status,'FAIL');assert.equal(reads,1);assert.equal(report.cleanup.exitObserved,true);assert.equal(report.diagnostic.category,'REQUEST_TIMEOUT');assert.doesNotMatch(JSON.stringify(report),/PRIVATE_ROWS/);
});
