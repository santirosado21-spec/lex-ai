import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {readFile} from 'node:fs/promises';
import {DIRECT_WMI_COMMAND,runDirectWmiProbe,runWindowsWmiDirectDiagnostic} from '../scripts/windows-wmi-direct-diagnostic.mjs';
const stages=['BOOT','TYPE_RESOLVE','TYPE_READY','READ_READY','QUERY_CONSTRUCT','QUERY_READY','WMI_GET','WMI_ENUMERATE','RESULT','DISPOSED','DONE'];
function fixture({observeKill=true,signal}={}){
 const child=new EventEmitter();child.stdin=new EventEmitter();child.stdout=new EventEmitter();child.killed=false;const requests=[],timers=[];let clock=0,spawns=0;
 child.stdin.end=input=>requests.push(input);child.kill=()=>{child.killed=true;if(observeKill)child.emit('close',null,'SIGTERM');};
 const report=runDirectWmiProbe({rootPid:42,systemRoot:'C:\\Windows',signal,now:()=>clock,schedule:(callback,ms)=>{const t={callback,ms};timers.push(t);return t;},cancel:t=>{if(t)t.cancelled=true;},spawnProcess:(file,args,options)=>{spawns++;assert.equal(file,'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');assert.deepEqual(args,['-NoLogo','-NoProfile','-NonInteractive','-Command',DIRECT_WMI_COMMAND]);assert.deepEqual(options,{stdio:['pipe','pipe','ignore'],windowsHide:true,shell:false,env:{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'}});return child;}});
 const line=text=>child.stdout.emit('data',Buffer.from(text+'\r\n'));
 const through=(last='DONE',result='1:42:1:1234')=>{for(const stage of stages){line('D1H_'+stage+(stage==='RESULT'?':'+result:''));if(stage===last)break;}};
 return {child,requests,timers,report,line,through,spawns:()=>spawns,advance:ms=>{clock+=ms;}};
}
test('fixed direct typed query has no cmdlet discovery, JSON conversion, encoding reset or remote scope',()=>{
 for(const forbidden of ['Get-Command','Import-Module','New-Object','Add-Type','ConvertFrom-Json','ConvertTo-Json','Select-Object','Sort-Object','Get-CimInstance','Get-WmiObject','Invoke-Expression','OutputEncoding','InputEncoding'])assert.equal(DIRECT_WMI_COMMAND.includes(forbidden),false,forbidden);
 assert.match(DIRECT_WMI_COMMAND,/\[wmisearcher\]::new\('root\\cimv2',\$query\)/);assert.equal(DIRECT_WMI_COMMAND.match(/\.Get\(\)/g).length,1);assert.match(DIRECT_WMI_COMMAND,/SELECT ProcessId,ParentProcessId,WorkingSetSize FROM Win32_Process WHERE ProcessId=/);assert.ok([...DIRECT_WMI_COMMAND].every(c=>c.charCodeAt(0)<128));assert.match(DIRECT_WMI_COMMAND,/TryParse/);assert.match(DIRECT_WMI_COMMAND,/\.Dispose\(\)/);
});
test('one local owned-PID request after readiness; strict result strips both PIDs before report',async()=>{
 const f=fixture();assert.equal(f.spawns(),1);f.through('TYPE_READY');assert.deepEqual(f.requests,[]);for(const s of stages.slice(3))f.line('D1H_'+s+(s==='RESULT'?':1:42:1:1234':''));f.child.emit('close',0,null);const r=await f.report;assert.equal(r.category,null);assert.deepEqual(f.requests,['42\n']);assert.equal(r.ownedProcessCount,1);assert.equal(r.ownedRootRssBytes,1234);assert.equal(r.exitObserved,true);assert.equal(r.exitCode,0);assert.doesNotMatch(JSON.stringify(r),/rootPid|ProcessId|ParentProcessId|D1H_RESULT/);
});
test('absolute deadline never renews; delayed BOOT, WMI enumeration, RESULT and close are rejected',async()=>{
 for(const phase of ['BOOT','WMI_ENUMERATE','RESULT','EXIT']){const f=fixture();if(phase==='WMI_ENUMERATE')f.through('WMI_ENUMERATE');if(phase==='RESULT')f.through('RESULT');if(phase==='EXIT')f.through();f.advance(10001);if(phase==='EXIT')f.child.emit('close',0,null);else f.line(phase==='BOOT'?'D1H_BOOT':'D1H_DISPOSED');const r=await f.report;assert.equal(r.category,'TIMEOUT_'+phase);if(phase!=='EXIT')assert.equal(r.killed,true);assert.equal(f.timers[0].ms,10000);}
});
test('row identity, duplicates, unsafe/zero numeric fields and stage jumps fail closed',async()=>{
 for(const result of ['1:43:1:1234','2:42:1:1234','1:42:4294967296:1234','1:42:1:9007199254740992','1:42:1:0','1:0:1:1234']){const f=fixture();f.through('RESULT',result);const r=await f.report;assert.equal(r.category,'INVALID_RESULT');assert.equal(r.killed,true);}
 const f=fixture();f.line('D1H_WMI_GET');assert.equal((await f.report).category,'UNEXPECTED_STAGE');
});
test('oversized/private/nonASCII output and all trailing buffers are protocol failures',async()=>{
 for(const mode of ['oversize','private','nonascii','unterminated','trailing']){const f=fixture();if(mode==='oversize')f.child.stdout.emit('data',Buffer.alloc(4097));if(mode==='private')f.line('private/path raw error');if(mode==='nonascii')f.line('é');if(mode==='unterminated'){f.through();f.child.stdout.emit('data',Buffer.from('D1H_DONE'));f.child.emit('close',0,null);}if(mode==='trailing'){f.through();f.line('D1H_DONE');}const r=await f.report;assert.ok(r.category);assert.doesNotMatch(JSON.stringify(r),/private\/path|raw error|é/);}
});
test('known command/dispose errors and numeric exit/signal remain sanitized',async()=>{
 for(const marker of ['D1H_ERROR','D1H_ERROR_DISPOSE']){const f=fixture();f.through('TYPE_RESOLVE');f.line(marker);const r=await f.report;assert.equal(r.category,marker==='D1H_ERROR'?'COMMAND_ERROR':'DISPOSE_ERROR');assert.equal(r.signal,'SIGTERM');}
 const f=fixture();f.through();f.child.emit('close',22,'private signal');const r=await f.report;assert.equal(r.category,'UNKNOWN_SIGNAL');assert.equal(r.exitCode,22);assert.equal(r.signal,null);assert.doesNotMatch(JSON.stringify(r),/private signal/);
});
test('unobserved exit and aborted/invalid requests are bounded and never spawn alternatives',async()=>{
 const f=fixture({observeKill:false});f.timers[0].callback();assert.equal(f.timers.at(-1).ms,250);f.timers.at(-1).callback();const r=await f.report;assert.equal(r.exitObserved,false);assert.equal(r.cleanupCategory,'EXIT_NOT_OBSERVED');assert.equal(f.spawns(),1);
 for(const rootPid of [0,process.pid,-1,2**32,'42']){let launched=false;const r=await runDirectWmiProbe({rootPid,systemRoot:'C:\\Windows',spawnProcess:()=>{launched=true;}});assert.equal(r.category,'INVALID_REQUEST');assert.equal(launched,false);}
 const controller=new AbortController();controller.abort();let launched=false;const aborted=await runDirectWmiProbe({rootPid:42,systemRoot:'C:\\Windows',signal:controller.signal,spawnProcess:()=>{launched=true;}});assert.equal(aborted.category,'GLOBAL_OR_FIXTURE_ABORT');assert.equal(launched,false);
});
test('orchestration owns one actual local fixture and exactly one mock probe; timeout is diagnosis only',async()=>{
 let calls=0;const r=await runWindowsWmiDirectDiagnostic({platform:'win32',arch:'x64',nodeVersion:'v22.13.0',systemRoot:'C:\\Windows',probe:async({rootPid})=>{calls++;assert.ok(Number.isSafeInteger(rootPid)&&rootPid!==process.pid);return {category:'TIMEOUT_WMI_GET',exitObserved:true};}});assert.equal(calls,1);assert.equal(r.diagnosticComplete,true);assert.equal(r.performanceValidated,false);assert.equal(r.status,'DIAGNOSTIC_ONLY');assert.equal(r.cleanup.expectedExitZero,true);
});
test('final-await fixture exit/error, unknown probe exit, global overrun and non-Windows do not complete',async()=>{
 for(const mode of ['exit','error','unknown-exit','overrun']){let child,clock=0;const r=await runWindowsWmiDirectDiagnostic({platform:'win32',arch:'x64',nodeVersion:'v22.13.0',systemRoot:'C:\\Windows',now:()=>clock,spawnProcess:()=>{child=new EventEmitter();Object.assign(child,{pid:123456,connected:true,exitCode:null,signalCode:null,disconnect(){this.connected=false;this.exitCode=0;queueMicrotask(()=>this.emit('exit',0,null));},kill(){this.exitCode=1;queueMicrotask(()=>this.emit('exit',1,null));}});queueMicrotask(()=>child.emit('message','ready'));return child;},probe:async()=>{if(mode==='exit'){child.exitCode=3;child.connected=false;child.emit('exit',3,null);}if(mode==='error')child.emit('error',Error('private'));if(mode==='overrun')clock=16000;return {category:null,exitObserved:mode!=='unknown-exit'};}});assert.equal(r.diagnosticComplete,false,mode);assert.doesNotMatch(JSON.stringify(r),/private/);}
 let launched=false;const r=await runWindowsWmiDirectDiagnostic({platform:'darwin',spawnProcess:()=>{launched=true;}});assert.equal(launched,false);assert.equal(r.diagnosticComplete,false);
});
test('D1h manifest and mutually exclusive workflow preserve historical diagnostics and no paid surfaces',async()=>{
 const protocol=JSON.parse(await readFile(new URL('../resources/windows-wmi-direct-diagnostic-v1.json',import.meta.url),'utf8'));assert.equal(protocol.maximumPowerShellProcesses,1);assert.equal(protocol.maximumWmiQueries,1);assert.equal(protocol.probeAbsoluteTimeoutMs,10000);assert.equal(protocol.maximumConfiguredMs,15000);assert.equal(protocol.performanceValidated,false);assert.equal(protocol.windowsExecuted,false);assert.equal(protocol.scopeLiteral,'root\\cimv2');
 const y=await readFile(new URL('../.github/workflows/windows-memory-smoke.yml',import.meta.url),'utf8');assert.equal((y.match(/!startsWith\(github.event.head_commit.message, '\[windows-wmi-diagnostic\]'\)/g)||[]).length,3);assert.match(y,/&& startsWith\(github.event.head_commit.message, '\[windows-wmi-diagnostic\]'\)/);assert.match(y,/run: node scripts\/windows-wmi-direct-diagnostic.mjs/);assert.doesNotMatch(y,/secrets\.|workflow_dispatch:|schedule:|setup-node|upload-artifact|npm ci|npm install/);
});
