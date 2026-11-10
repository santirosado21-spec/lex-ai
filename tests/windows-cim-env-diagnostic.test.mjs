import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {readFile} from 'node:fs/promises';
import {ENV_PROBE_COMMAND,diagnosticEnvironment,runEnvProbe,runWindowsEnvDiagnostic} from '../scripts/windows-cim-env-diagnostic.mjs';
function fake(variant='minimal',{unobserved=false}={}){
 let clock=0,spawns=0;const timers=[],writes=[];const child=new EventEmitter();child.stdout=new EventEmitter();child.stdin=new EventEmitter();child.killed=false;child.stdin.end=s=>writes.push(JSON.parse(s));child.kill=()=>{child.killed=true;if(!unobserved)child.emit('close',null);};
 const promise=runEnvProbe({variant,rootPid:42,systemRoot:'C:\\Windows',now:()=>clock,schedule:(fn,ms)=>{const t={fn,ms};timers.push(t);return t;},cancel:t=>{if(t)t.cancelled=true;},spawnProcess:(file,args,options)=>{spawns++;assert.equal(file,'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');assert.deepEqual(args,['-NoLogo','-NoProfile','-NonInteractive','-Command',ENV_PROBE_COMMAND]);assert.deepEqual(options,{stdio:['pipe','pipe','ignore'],windowsHide:true,shell:false,env:diagnosticEnvironment('C:\\Windows',variant)});return child;}});
 return {promise,child,timers,writes,spawns:()=>spawns,advance:ms=>clock+=ms,line:s=>child.stdout.emit('data',Buffer.from(s+'\r\n'))};
}
function success(f){for(const s of ['BOOT','ENV:3:1','LOOKUP_UTILITY','LOOKUP_CIM','READ_READY','JSON','CIM','RESULT:1:123456','DONE'])f.line('D1G_'+s);f.child.emit('close',0);}
test('both launches use identical fixed command; only trusted builtin PSModulePath differs',async()=>{
 const a=diagnosticEnvironment('C:\\Windows','minimal'),b=diagnosticEnvironment('C:\\Windows','builtin');assert.deepEqual({...b,PSModulePath:undefined},{...a,PSModulePath:undefined});assert.equal(b.PSModulePath,'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules');assert.throws(()=>diagnosticEnvironment('C:\\Windows;secret','builtin'));assert.throws(()=>diagnosticEnvironment('C:\\Windows','other'));
 for(const variant of ['minimal','builtin']){const f=fake(variant);assert.equal(f.writes.length,0);success(f);const r=await f.promise;assert.equal(r.category,null);assert.equal(r.ownedProcessCount,1);assert.equal(r.ownedRootRssBytes,123456);assert.equal(r.modulePathEntryCount,3);assert.equal(r.builtinPathPresent,true);assert.deepEqual(f.writes,[{id:1,pid:42}]);assert.equal(f.spawns(),1);assert.doesNotMatch(JSON.stringify(r),/Windows|PSModulePath|ProcessId|WorkingSetSize/);}
 assert.doesNotMatch(ENV_PROBE_COMMAND,/OutputEncoding|InputEncoding|CommandLine|ExecutablePath|ComputerName|CimSession|Invoke-Expression|ExecutionPolicy|Bypass/);
});
test('timeout reports executing lookup phase, kills only owned collector, never resets deadline',async()=>{
 const f=fake();f.line('D1G_BOOT');f.line('D1G_ENV:1:1');f.line('D1G_LOOKUP_UTILITY');f.advance(10001);f.line('D1G_LOOKUP_CIM');const r=await f.promise;assert.equal(r.category,'TIMEOUT_LOOKUP_UTILITY');assert.equal(r.exitObserved,true);assert.equal(r.killed,true);assert.equal(f.writes.length,0);assert.equal(f.spawns(),1);
 const late=fake();successBeforeExit(late);late.advance(10001);late.child.emit('close',0);assert.equal((await late.promise).category,'TIMEOUT_EXIT');
});
function successBeforeExit(f){for(const s of ['BOOT','ENV:1:1','LOOKUP_UTILITY','LOOKUP_CIM','READ_READY','JSON','CIM','RESULT:1:1','DONE'])f.line('D1G_'+s);}
test('finite command error, malformed/private output, oversized stdout and aggregate limits sanitize',async()=>{
 for(const value of ['D1G_ERROR','RAW_PRIVATE_SENTINEL','D1G_ENV:1:1']){const f=fake();f.line(value);const r=await f.promise;assert.ok(r.category);assert.doesNotMatch(JSON.stringify(r),/PRIVATE_SENTINEL/);}
 for(const value of ['D1G_ENV:999:1','D1G_ENV:1:2']){const f=fake();f.line('D1G_BOOT');f.line(value);assert.equal((await f.promise).category,'INVALID_AGGREGATE');}
 const big=fake();big.child.stdout.emit('data',Buffer.alloc(4097));assert.equal((await big.promise).category,'OUTPUT_LIMIT');
 const unicode=fake();unicode.child.stdout.emit('data',Buffer.from('é'));assert.equal((await unicode.promise).category,'INVALID_OUTPUT');
});
test('unobserved exit is bounded and global abort refuses launch',async()=>{
 const f=fake('minimal',{unobserved:true});f.timers[0].fn();f.timers.at(-1).fn();const r=await f.promise;assert.equal(r.exitObserved,false);assert.equal(r.cleanupCategory,'EXIT_NOT_OBSERVED');
 const c=new AbortController();c.abort();let spawned=false;const stopped=await runEnvProbe({variant:'minimal',rootPid:42,systemRoot:'C:\\Windows',signal:c.signal,spawnProcess:()=>{spawned=true;}});assert.equal(stopped.category,'GLOBAL_DEADLINE');assert.equal(spawned,false);
});
test('orchestration owns one fixture and runs at most two sequential environment probes',async()=>{
 const variants=[];let active=0;const report=await runWindowsEnvDiagnostic({platform:'win32',arch:'x64',nodeVersion:'v22.13.0',systemRoot:'C:\\Windows',probe:async({variant,rootPid,signal})=>{assert.equal(active++,0);assert.ok(rootPid>0&&rootPid!==process.pid);assert.equal(signal.aborted,false);variants.push(variant);await Promise.resolve();active--;return {variant,category:variant==='minimal'?'TIMEOUT_LOOKUP_UTILITY':null,exitObserved:true};}});
 assert.deepEqual(variants,['minimal','builtin']);assert.equal(report.diagnosticComplete,true);assert.equal(report.cleanup.expectedExitZero,true);assert.equal(report.performanceValidated,false);assert.equal(report.maximumConfiguredMs,27000);assert.equal(report.orderConfounding,true);
});
test('unknown exit stops comparison; non-Windows/invalid launcher never spawns',async()=>{
 let probes=0;const r=await runWindowsEnvDiagnostic({platform:'win32',arch:'x64',nodeVersion:'v22.13.0',systemRoot:'C:\\Windows',probe:async()=>{probes++;return {category:'TIMEOUT_BOOT',exitObserved:false};}});assert.equal(probes,1);assert.equal(r.diagnosticComplete,false);assert.equal(r.cleanup.expectedExitZero,true);
 for(const args of [{platform:'darwin'},{platform:'win32',arch:'x64',systemRoot:'bad'}]){let spawned=false;const result=await runWindowsEnvDiagnostic({...args,spawnProcess:()=>{spawned=true;}});assert.equal(spawned,false);assert.equal(result.diagnosticComplete,false);}
});
test('workflow prefix selects only D1g; old diagnostic preserved, unmarked returns RSS without paid surfaces',async()=>{
 const y=await readFile('.github/workflows/windows-memory-smoke.yml','utf8');assert.match(y,/startsWith\(github.event.head_commit.message, '\[windows-env-diagnostic\]'\)/);assert.equal((y.match(/!startsWith\(github.event.head_commit.message, '\[windows-env-diagnostic\]'\)/g)||[]).length,2);assert.equal((y.match(/github.event.repository.private == false/g)||[]).length,3);assert.equal((y.match(/runs-on: windows-2025/g)||[]).length,3);assert.equal((y.match(/timeout-minutes: 5/g)||[]).length,3);assert.match(y,/run: node scripts\/windows-cim-env-diagnostic.mjs/);assert.match(y,/run: node scripts\/windows-cim-diagnostic.mjs/);assert.doesNotMatch(y,/workflow_dispatch:|schedule:|upload-artifact|setup-node|secrets\.|run:.*head_commit/);
});

test('successful close rejects unterminated extra JSON/markers and terminated trailing output',async()=>{
 for(const extra of ['{"unexpected":1}','D1G_DONE','{"unexpected":1}\n','D1G_DONE\n']){
  const f=fake();successBeforeExit(f);f.child.stdout.emit('data',Buffer.from(extra));f.child.emit('close',0);
  const report=await f.promise;assert.equal(report.exitObserved,true);assert.equal(report.category,extra.endsWith('\n')?'UNEXPECTED_STAGE':'UNTERMINATED_OUTPUT');assert.equal(report.stages.length,9);assert.doesNotMatch(JSON.stringify(report),/unexpected/);
 }
});
