import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {HANDSHAKE_PROBE,CIM_PROBE,runWindowsCimProbe,runWindowsCimDiagnostic} from '../scripts/windows-cim-diagnostic.mjs';
function fixture(kind){
 let clock=0;
 const child=new EventEmitter();child.stdout=new EventEmitter();child.stdin=kind==='handshake'?new EventEmitter():null;child.killed=false;const timers=[],writes=[];
 if(child.stdin){child.stdin.write=line=>writes.push(JSON.parse(line));child.stdin.end=()=>{};}
 child.kill=()=>{child.killed=true;child.emit('close',null,'SIGTERM');};
 const report=runWindowsCimProbe({kind,rootPid:42,now:()=>clock,systemRoot:'C:\\Windows',schedule:(callback,ms)=>{const timer={callback,ms};timers.push(timer);return timer;},cancel:timer=>{if(timer)timer.cancelled=true;},spawnProcess:(file,args,options)=>{assert.equal(file,'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');assert.deepEqual(args,['-NoLogo','-NoProfile','-NonInteractive','-Command',kind==='handshake'?HANDSHAKE_PROBE:CIM_PROBE]);assert.deepEqual(options,{stdio:[kind==='handshake'?'pipe':'ignore','pipe','ignore'],windowsHide:true,shell:false,env:{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'}});return child;}});
 return {child,timers,writes,report,advance:ms=>{clock+=ms;},line:text=>child.stdout.emit('data',Buffer.from(text+'\r\n'))};
}
test('handshake request is sent only after boot and encoding-ready markers',async()=>{
 const f=fixture('handshake');assert.equal(f.writes.length,0);f.line('D1E_BOOT');assert.equal(f.writes.length,0);f.line('D1E_READ_READY');assert.deepEqual(f.writes,[{id:1,pid:42}]);f.line('D1E_REQUEST_READ');f.child.emit('close',0,null);const report=await f.report;assert.equal(report.category,null);assert.equal(report.requestSentAfterReadReady,true);assert.deepEqual(report.stages.map(s=>s.stage),['BOOT','READ_READY','REQUEST_READ']);assert.equal(report.exitObserved,true);
});
test('direct CIM has no stdin and retains only count plus owned-root RSS',async()=>{
 const f=fixture('cim');for(const stage of ['BOOT','CIM_START','CIM_END'])f.line('D1E_'+stage);f.line(JSON.stringify([{ProcessId:42,ParentProcessId:1,WorkingSetSize:1234}]));f.child.emit('close',0,null);const report=await f.report;assert.equal(report.category,null);assert.equal(report.processCount,1);assert.equal(report.ownedRootRssBytes,1234);assert.doesNotMatch(JSON.stringify(report),/ProcessId|WorkingSetSize/);assert.doesNotMatch(CIM_PROBE,/ReadLine|InputEncoding|CommandLine|ExecutablePath|ComputerName|CimSession|Invoke-Expression|ExecutionPolicy|Bypass/);
});
test('finite phase timeout kills owned child, preserves stage and never retries',async()=>{
 for(const kind of ['handshake','cim']){const f=fixture(kind);f.line('D1E_BOOT');if(kind==='handshake')f.line('D1E_READ_READY');else f.line('D1E_CIM_START');f.timers.at(-1).callback();const report=await f.report;assert.equal(report.category,kind==='handshake'?'REQUEST_READ_TIMEOUT':'CIM_TIMEOUT');assert.equal(report.killed,true);assert.equal(report.signal,'SIGTERM');assert.equal(report.exitObserved,true);assert.equal(f.writes.length,kind==='handshake'?1:0);}
});
test('malformed output, unowned snapshot, overflow and unknown signal remain sanitized failures',async()=>{
 for(const mode of ['output','root','overflow','exit']){const f=fixture('cim');if(mode==='output')f.line('raw private command');if(mode==='root'){for(const s of ['BOOT','CIM_START','CIM_END'])f.line('D1E_'+s);f.line('[]');}if(mode==='overflow')f.child.stdout.emit('data',Buffer.alloc(4*1024*1024+1));if(mode==='exit')f.child.emit('close',22,'private signal');const report=await f.report;assert.ok(report.category);assert.doesNotMatch(JSON.stringify(report),/raw private|private signal/);if(mode==='exit'){assert.equal(report.exitCode,22);assert.equal(report.signal,null);}}
});
test('diagnostic orchestration runs exactly two sequential probes against an owned actual local fixture',async()=>{
 let active=0;const kinds=[];
 const report=await runWindowsCimDiagnostic({platform:'win32',arch:'x64',nodeVersion:'v22.13.0',spawnProcess:spawn,probe:async({kind,rootPid})=>{assert.ok(Number.isSafeInteger(rootPid)&&rootPid>0&&rootPid!==process.pid);assert.equal(active++,0);kinds.push(kind);await Promise.resolve();active--;return {kind,exitObserved:true,category:null,stages:[{stage:'BOOT',elapsedMs:1}]};}});
 assert.deepEqual(kinds,['handshake','cim']);assert.equal(report.diagnosticOnly,true);assert.equal(report.performanceValidated,false);assert.equal(report.protocol2StartupBoundPassed,false);assert.equal(report.diagnosticComplete,true);assert.equal(report.cleanup.expectedExitZero,true);assert.equal(report.status,'DIAGNOSTIC_ONLY');
});
test('unknown collector exit prevents second command and non-Windows never spawns',async()=>{
 let calls=0;const report=await runWindowsCimDiagnostic({platform:'win32',arch:'x64',nodeVersion:'v22.13.0',probe:async()=>{calls++;return {exitObserved:false,category:'BOOT_TIMEOUT',stages:[]};}});assert.equal(calls,1);assert.equal(report.diagnosticComplete,false);assert.equal(report.cleanup.expectedExitZero,true);
 const other=await runWindowsCimDiagnostic({platform:'darwin',spawnProcess:()=>{throw Error('must not spawn');}});assert.equal(other.diagnosticComplete,false);
});
test('workflow marker selects diagnosis without interpolating commit text into shell or rerunning RSS',async()=>{
 const yaml=await readFile(new URL('../.github/workflows/windows-memory-smoke.yml',import.meta.url),'utf8');assert.match(yaml,/!contains\(github.event.head_commit.message, '\[windows-cim-diagnostic\]'\)/);assert.match(yaml,/&& contains\(github.event.head_commit.message, '\[windows-cim-diagnostic\]'\)/);assert.match(yaml,/run: node scripts\/windows-cim-diagnostic.mjs/);assert.doesNotMatch(yaml,/run:.*head_commit|workflow_dispatch:|schedule:|secrets\.|upload-artifact|setup-node/);
});
test('late BOOT cannot reset an expired phase when timer callback is delayed',async()=>{
 const f=fixture('handshake');f.advance(4000);f.line('D1E_BOOT');f.line('D1E_READ_READY');f.line('D1E_REQUEST_READ');const report=await f.report;assert.equal(report.category,'BOOT_TIMEOUT');assert.equal(report.killed,true);assert.deepEqual(report.stages,[]);assert.equal(f.writes.length,0);
});
test('late CIM completion and snapshot preserve their original phase timeout',async()=>{
 for(const phase of ['cim','snapshot']){const f=fixture('cim');f.line('D1E_BOOT');f.line('D1E_CIM_START');if(phase==='snapshot')f.line('D1E_CIM_END');f.advance(phase==='cim'?6001:1001);if(phase==='cim')f.line('D1E_CIM_END');else f.line(JSON.stringify([{ProcessId:42,ParentProcessId:1,WorkingSetSize:1}]));const report=await f.report;assert.equal(report.category,phase==='cim'?'CIM_TIMEOUT':'SNAPSHOT_TIMEOUT');assert.equal(report.killed,true);}
});
test('late successful process close is still EXIT_TIMEOUT, not a clean diagnostic outcome',async()=>{
 const f=fixture('handshake');for(const stage of ['BOOT','READ_READY','REQUEST_READ'])f.line('D1E_'+stage);f.advance(1001);f.child.emit('close',0,null);const report=await f.report;assert.equal(report.category,'EXIT_TIMEOUT');assert.equal(report.exitObserved,true);assert.equal(report.exitCode,0);
});
