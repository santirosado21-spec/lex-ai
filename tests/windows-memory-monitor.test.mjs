import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createWindowsMemoryMonitor,WINDOWS_MONITOR_COMMAND} from '../server/windows-memory-monitor.mjs';
function harness(){
 const child=new EventEmitter(),timers=[],requests=[];child.stdin=new EventEmitter();child.stdout=new EventEmitter();child.killed=false;let spawned=0,clock=0;
 child.kill=()=>{child.killed=true;child.emit('close',null,'SIGTERM');};child.stdin.end=()=>child.emit('close',0,null);
 child.stdin.write=(line,callback)=>{requests.push(JSON.parse(line));callback?.();};
 const monitor=createWindowsMemoryMonitor({rootPid:42,platform:'win32',systemRoot:'C:\\Windows',spawnProcess:(file,args,options)=>{
  spawned++;assert.equal(file,'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');assert.deepEqual(args,['-NoLogo','-NoProfile','-NonInteractive','-Command',WINDOWS_MONITOR_COMMAND]);assert.deepEqual(options,{stdio:['pipe','pipe','ignore'],windowsHide:true,shell:false,env:{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'}});return child;
 },schedule:(callback,ms)=>{const timer={callback,ms};timers.push(timer);return timer;},cancel:timer=>{timer.cancelled=true;},now:()=>clock+=10});
 const reply=(id=requests.at(-1).id,rows=[{ProcessId:42,ParentProcessId:1,WorkingSetSize:100}])=>child.stdout.emit('data',Buffer.from(JSON.stringify({id,rows})+'\n'));
 return {child,monitor,timers,requests,reply,spawned:()=>spawned,advance:ms=>{clock+=ms;}};
}
test('explicit startup first snapshot then fresh serial queries reuse one fixed collector',async()=>{
 const h=harness();assert.equal(h.spawned(),0);const startup=h.monitor.start();assert.equal(h.timers[0].ms,10000);assert.deepEqual(h.requests,[{id:1,pid:42}]);h.reply();assert.deepEqual(await startup,{rssBytes:100,elapsedMs:10});
 for(let i=0;i<4;i++){const reading=h.monitor.readRss();assert.equal(h.timers.at(-1).ms,2000);assert.deepEqual(h.requests.at(-1),{id:i+2,pid:42});h.reply(undefined,[{ProcessId:42,ParentProcessId:1,WorkingSetSize:200+i}]);assert.equal((await reading).rssBytes,200+i);}
 assert.equal(h.spawned(),1);assert.equal(h.requests.length,5);assert.equal((await h.monitor.close()).exitObserved,true);assert.equal(h.monitor.diagnostics().exitCode,0);
 assert.doesNotMatch(WINDOWS_MONITOR_COMMAND,/CommandLine|ExecutablePath|ComputerName|CimSession|Invoke-Expression|iex\b|ExecutionPolicy|Bypass/);assert.match(WINDOWS_MONITOR_COMMAND,/\[Console\]::ReadLine/);
});
test('startup and steady deadlines fail closed, preserve phase/elapsed and kill only owned collector',async()=>{
 for(const phase of ['startup','request']){const h=harness();const started=h.monitor.start();if(phase==='request'){h.reply();await started;}const pending=phase==='startup'?started:h.monitor.readRss();const rejected=assert.rejects(pending,e=>e.category===(phase==='startup'?'STARTUP_TIMEOUT':'REQUEST_TIMEOUT'));h.timers.at(-1).callback();await rejected;const d=h.monitor.diagnostics();assert.equal(d.phase,phase);assert.equal(d.killed,true);assert.equal(d.signal,'SIGTERM');assert.ok(d.elapsedMs>=0);assert.equal((await h.monitor.close()).exitObserved,true);}
});
test('malformed/missing root/wrong id/overflow/invalid UTF8 and unexpected output fail closed',async()=>{
 for(const kind of ['json','missing-root','id','oversize','utf8']){const h=harness(),pending=h.monitor.start(),rejected=assert.rejects(pending);if(kind==='json')h.child.stdout.emit('data',Buffer.from('bad\n'));if(kind==='missing-root')h.reply(1,[]);if(kind==='id')h.reply(2);if(kind==='oversize')h.child.stdout.emit('data',Buffer.alloc(4*1024*1024+1));if(kind==='utf8')h.child.stdout.emit('data',Buffer.from([255,10]));await rejected;assert.equal(h.monitor.diagnostics().killed,true);assert.equal(h.monitor.diagnostics().category,kind==='oversize'?'OUTPUT_LIMIT':'MALFORMED_RESPONSE');await h.monitor.close();}
 const h=harness(),startup=h.monitor.start();h.reply();await startup;h.child.stdout.emit('data',Buffer.from('{}\n'));assert.equal(h.monitor.diagnostics().category,'UNEXPECTED_OUTPUT');await h.monitor.close();
});
test('concurrent requests have no queue/retry; collector close/error retain safe numeric diagnostics',async()=>{
 const h=harness(),startup=h.monitor.start(),firstRejected=assert.rejects(startup);await assert.rejects(()=>h.monitor.readRss(),e=>e.category==='CONCURRENT_REQUEST');await firstRejected;assert.equal(h.requests.length,1);await h.monitor.close();
 for(const event of ['close','error']){const g=harness(),pending=g.monitor.start(),rejected=assert.rejects(pending);if(event==='close')g.child.emit('close',22,'raw private string');else g.child.emit('error',Error('private path stderr'));await rejected;const d=g.monitor.diagnostics();assert.equal(d.signal,event==='close'?null:'SIGTERM');assert.equal(d.exitCode,event==='close'?22:null);assert.doesNotMatch(JSON.stringify(d),/private/);await g.monitor.close();}
});
test('platform/launcher/owned PID invalid inputs never launch a collector',async()=>{
 assert.throws(()=>createWindowsMemoryMonitor({rootPid:0}));for(const input of [{platform:'darwin',systemRoot:'C:\\Windows'},{platform:'win32',systemRoot:'powershell.exe'}]){let spawned=false;const monitor=createWindowsMemoryMonitor({rootPid:42,...input,spawnProcess:()=>{spawned=true;}});await assert.rejects(()=>monitor.start());assert.equal(spawned,false);await monitor.close();}
});
test('closing an active request rejects it and confirms owned collector exit',async()=>{
 const h=harness(),pending=h.monitor.start(),rejected=assert.rejects(pending,e=>e.category==='COLLECTOR_CLOSED');const closed=await h.monitor.close();await rejected;assert.equal(closed.exitObserved,true);assert.equal(closed.killed,true);
});
test('a late response cannot pass merely because timer callback was delayed',async()=>{
 for(const phase of ['startup','request']){const h=harness(),startup=h.monitor.start();if(phase==='request'){h.reply();await startup;}const pending=phase==='startup'?startup:h.monitor.readRss(),rejected=assert.rejects(pending,e=>e.category===(phase==='startup'?'STARTUP_TIMEOUT':'REQUEST_TIMEOUT'));h.advance(phase==='startup'?10000:2000);h.reply();await rejected;assert.equal(h.monitor.diagnostics().killed,true);await h.monitor.close();}
});
test('ASCII-only numeric protocol requires no console encoding mutation or New-Object',async()=>{
 assert.doesNotMatch(WINDOWS_MONITOR_COMMAND,/OutputEncoding|InputEncoding|UTF8Encoding|New-Object/);
 assert.match(WINDOWS_MONITOR_COMMAND,/Get-CimInstance -ClassName Win32_Process -Property ProcessId,ParentProcessId,WorkingSetSize/);
 assert.ok([...WINDOWS_MONITOR_COMMAND].every(char=>char.charCodeAt(0)<=0x7f));
 const h=harness(),startup=h.monitor.start();
 assert.match(JSON.stringify(h.requests[0]),/^[\x00-\x7f]+$/);assert.deepEqual(h.requests[0],{id:1,pid:42});h.reply();assert.equal((await startup).rssBytes,100);await h.monitor.close();
});
test('literal non-ASCII bytes and escaped non-ASCII fields or string numeric data fail closed',async()=>{
 const samples=[
  '{"id":1,"rows":[{"ProcessId":42,"ParentProcessId":1,"WorkingSetSize":100}],"é":1}\n',
  '{"id":1,"rows":[{"ProcessId":42,"ParentProcessId":1,"WorkingSetSize":100}],"\\u00e9":1}\n',
  '{"id":1,"rows":[{"ProcessId":42,"ParentProcessId":1,"WorkingSetSize":"\\u0031"}]}\n'
 ];
 for(const sample of samples){const h=harness(),startup=h.monitor.start(),rejected=assert.rejects(startup,e=>e.category==='MALFORMED_RESPONSE');h.child.stdout.emit('data',Buffer.from(sample));await rejected;assert.equal(h.monitor.diagnostics().killed,true);await h.monitor.close();}
});
