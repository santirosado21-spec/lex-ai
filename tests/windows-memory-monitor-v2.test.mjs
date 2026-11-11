import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter,getEventListeners} from 'node:events';
import {createWindowsMemoryMonitorV2,parseWindowsWmiFrame,WINDOWS_WMI_MONITOR_COMMAND as command,WINDOWS_WMI_MAX_ROWS} from '../server/windows-memory-monitor-v2.mjs';
const frame=(id=1,rows='0,0,0;42,1,100;43,42,20;99,1,999',count=rows.split(';').length)=>`WMI2:${id}:42:${count}:${rows}`;
function harness({spawnAdvance=0,ownerSignal,killExits=true,writeAdvance=0}={}){
 const child=new EventEmitter(),timers=[],requests=[];let clock=0,spawns=0,kills=0;
 child.stdin=new EventEmitter();child.stdout=new EventEmitter();child.killed=false;
 child.kill=()=>{kills++;child.killed=true;if(killExits)child.emit('close',null,'SIGTERM');};child.stdin.end=()=>{if(killExits)child.emit('close',0,null);};
 child.stdin.write=(line,callback)=>{requests.push(line);clock+=writeAdvance;callback?.();};
 const monitor=createWindowsMemoryMonitorV2({rootPid:42,platform:'win32',systemRoot:'C:\\Windows',signal:ownerSignal,spawnProcess:(file,args,options)=>{spawns++;clock+=spawnAdvance;assert.equal(file,'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');assert.deepEqual(args,['-NoLogo','-NoProfile','-NonInteractive','-Command',command]);assert.deepEqual(options,{stdio:['pipe','pipe','ignore'],windowsHide:true,shell:false,env:{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'}});return child;},now:()=>clock,schedule:(fn,ms)=>{const t={fn,ms,cancelled:false};timers.push(t);return t;},cancel:t=>{if(t)t.cancelled=true;}});
 return {child,monitor,timers,requests,advance:ms=>clock+=ms,spawns:()=>spawns,kills:()=>kills,reply:(value=frame(Number(requests.at(-1).split(':')[0])))=>child.stdout.emit('data',Buffer.from(value+'\r\n'))};
}
test('fixed cmdlet-free direct WMI command disposes all resources before numeric frame output',()=>{
 assert.doesNotMatch(command,/Get-Command|Import-Module|New-Object|ConvertFrom-Json|ConvertTo-Json|Select-Object|Sort-Object|Get-CimInstance|Get-WmiObject|Invoke-Expression|CommandLine|ExecutablePath|ComputerName|OutputEncoding|InputEncoding|\|/);
 assert.match(command,/\[wmisearcher\]::new\('root\\cimv2','SELECT ProcessId,ParentProcessId,WorkingSetSize FROM Win32_Process'\)/);
 assert.match(command,/\$item\.Dispose\(\)/);assert.match(command,/\$results\.Dispose\(\)/);assert.match(command,/\$searcher\.Dispose\(\)/);
 assert.ok(command.lastIndexOf('.Dispose()')<command.indexOf("[Console]::WriteLine(('WMI2:"));
 assert.match(command,/\$count -gt 4096/);assert.match(command,/\[Globalization.NumberStyles\]::None/);assert.match(command,/\[uint32\]/);assert.match(command,/\[uint64\]/);assert.match(command,/catch \{ exit 22 \}/);
 assert.ok([...command].every(c=>c.charCodeAt(0)<128));
});
test('strict numeric frame preserves root descendants only and PID zero special case',()=>{
 assert.equal(parseWindowsWmiFrame(frame(),{id:1,rootPid:42}),120);
 const rows=Array.from({length:WINDOWS_WMI_MAX_ROWS},(_,i)=>`${i+1},0,1`).join(';');assert.equal(parseWindowsWmiFrame(frame(1,rows),{id:1,rootPid:42}),1);
});
test('rejects noncanonical numbers, unsafe ranges, incorrect counts, duplicate IDs, all-tree cycles and extra fields',()=>{
 const bad=[frame().replace('WMI2:1:','WMI2:01:'),frame().replace(':42:',':042:'),frame().replace(':4:',':04:'),frame(1,'42,1,1e2'),frame(1,'42,1,01'),frame(1,'42,1,-1'),frame(1,'42,1,+1'),frame(1,'42,1,1.0'),frame(1,'42,1,9007199254740992'),frame(1,'4294967296,0,1'),frame(1,'42,4294967296,1'),frame(1,'42,1,1;42,2,2'),frame(1,'42,1,1;90,91,1;91,90,1'),frame(1,'0,1,0;42,1,1'),frame(1,'42,42,1'),frame(1,'42,1,0'),frame(1,'9,0,1'),frame(1,'42,1,1',2),frame(1,'42,1,1;43,42,1',1),frame(1,'42,1,1,3'),frame()+';','WMI2:1:42:4097:42,1,1','WMI2:1:42:1:'+'0;'.repeat(20000),frame()+'\n',frame()+'é',frame()+'\u0000'];
 for(const value of bad)assert.throws(()=>parseWindowsWmiFrame(value,{id:1,rootPid:42}),value.slice(0,50));
 assert.throws(()=>parseWindowsWmiFrame(frame(2),{id:1,rootPid:42}));
 assert.throws(()=>parseWindowsWmiFrame(frame(1,'42,1,9007199254740991;43,42,1'),{id:1,rootPid:42}));
});
test('startup snapshot and four serial fresh samples share one owned collector; fragmented ASCII accepted',async()=>{
 const h=harness(),start=h.monitor.start();assert.equal(h.timers[0].ms,10000);assert.deepEqual(h.requests,['1:42\n']);const value=frame()+'\n';h.child.stdout.emit('data',Buffer.from(value.slice(0,10)));h.child.stdout.emit('data',Buffer.from(value.slice(10)));assert.deepEqual(await start,{rssBytes:120,elapsedMs:0});
 for(let i=0;i<4;i++){const request=h.monitor.readRss();assert.equal(h.timers.at(-1).ms,2000);h.reply();assert.equal((await request).rssBytes,120);}
 assert.equal(h.spawns(),1);assert.equal(h.requests.length,5);assert.equal((await h.monitor.close()).exitObserved,true);assert.ok(h.timers.every(t=>t.cancelled));
});
test('absolute budget includes spawn and write; equality and late responses never pass',async()=>{
 for(const opts of [{spawnAdvance:10000},{writeAdvance:10000},{}]){const h=harness(opts),start=h.monitor.start(),rejected=assert.rejects(start,e=>e.category==='STARTUP_TIMEOUT');if(!opts.spawnAdvance&&!opts.writeAdvance){h.advance(10000);h.reply();}await rejected;assert.equal(h.kills(),1);await h.monitor.close();}
 const h=harness({spawnAdvance:4500}),start=h.monitor.start();assert.equal(h.timers[0].ms,5500);h.reply();assert.equal((await start).elapsedMs,4500);const request=h.monitor.readRss(),rejected=assert.rejects(request,e=>e.category==='REQUEST_TIMEOUT');h.advance(2000);h.reply();await rejected;await h.monitor.close();
});
test('timeout callbacks and malformed/oversized/trailing output fail closed without retry or raw output',async()=>{
 for(const kind of ['timeout','nonascii','oversize','extra','unterminated','wrong-id']){const h=harness(),start=h.monitor.start(),rejected=assert.rejects(start);
  if(kind==='timeout')h.timers[0].fn();if(kind==='nonascii')h.child.stdout.emit('data',Buffer.from([255,10]));if(kind==='oversize')h.child.stdout.emit('data',Buffer.alloc(4*1024*1024+1));if(kind==='extra')h.child.stdout.emit('data',Buffer.from(frame()+'\nPRIVATE'));if(kind==='unterminated'){h.child.stdout.emit('data',Buffer.from(frame()));h.child.emit('close',22,null);}if(kind==='wrong-id')h.reply(frame(2));
  await rejected;await assert.rejects(h.monitor.readRss());assert.equal(h.requests.length,1);assert.doesNotMatch(JSON.stringify(h.monitor.diagnostics()),/PRIVATE|WMI2|42/);await h.monitor.close();
 }
});
test('already-aborted owner/start/request and loading abort clean listeners and cannot send late',async()=>{
 const owner=new AbortController();owner.abort();const h=harness({ownerSignal:owner.signal});await assert.rejects(h.monitor.start(),e=>e.category==='ABORTED');assert.equal(h.spawns(),0);await h.monitor.close();
 for(const mode of ['before-start','during-start','ready-request','during-request']){const g=harness(),controller=new AbortController();let request;
  if(mode==='before-start'){controller.abort();request=g.monitor.start({signal:controller.signal});}
  else if(mode==='during-start')request=g.monitor.start({signal:controller.signal});
  else{const s=g.monitor.start();g.reply();await s;if(mode==='ready-request')controller.abort();request=g.monitor.readRss({signal:controller.signal});}
  const rejected=assert.rejects(request,e=>e.category==='ABORTED');controller.abort();await rejected;const count=g.requests.length;g.reply(frame());assert.equal(g.requests.length,count);assert.equal(getEventListeners(controller.signal,'abort').length,0);assert.ok(g.timers.every(t=>t.cancelled));if(mode!=='before-start')assert.equal(g.kills(),1);await g.monitor.close();
 }
 const c=new AbortController(),g=harness({ownerSignal:c.signal}),s=g.monitor.start();g.reply();await s;c.abort();assert.equal(g.kills(),1);assert.equal(getEventListeners(c.signal,'abort').length,0);await g.monitor.close();
});
test('concurrent requests, active close, child error and unexpected idle output reject pending safely',async()=>{
 for(const mode of ['concurrent','close','error','idle']){const h=harness(),s=h.monitor.start();if(mode==='idle'){h.reply();await s;h.reply();}else{const rejected=assert.rejects(s);if(mode==='concurrent')await assert.rejects(h.monitor.readRss());if(mode==='close')await h.monitor.close();if(mode==='error')h.child.emit('error',Error('private path'));await rejected;}assert.ok(h.monitor.diagnostics().category);assert.doesNotMatch(JSON.stringify(h.monitor.diagnostics()),/private path/);await h.monitor.close();}
});
test('cleanup remains bounded 3+3 seconds; unobserved exit cannot claim success',async()=>{
 const h=harness({killExits:false}),start=h.monitor.start();h.reply();await start;const closing=h.monitor.close();assert.equal(h.timers.at(-1).ms,3000);h.timers.at(-1).fn();await Promise.resolve();assert.equal(h.timers.at(-1).ms,3000);h.timers.at(-1).fn();const result=await closing;assert.equal(result.exitObserved,false);assert.equal(result.category,'CLEANUP_TIMEOUT');
});
test('invalid platform, launcher, PID and signals cannot launch',async()=>{
 for(const rootPid of [0,-1,NaN,1.1,4294967296,process.pid])assert.throws(()=>createWindowsMemoryMonitorV2({rootPid}));
 for(const opts of [{platform:'darwin',systemRoot:'C:\\Windows'},{platform:'win32',systemRoot:'powershell'}]){let spawned=false;const m=createWindowsMemoryMonitorV2({rootPid:42,...opts,spawnProcess:()=>{spawned=true;}});await assert.rejects(m.start());assert.equal(spawned,false);await m.close();}
});

test('caller cannot extend deadline; stale cancelled timer cannot affect subsequent fresh sample',async()=>{
 const h=harness(),start=h.monitor.start(),oldTimer=h.timers[0];h.reply();await start;
 const reading=h.monitor.readRss({started:Number.MAX_SAFE_INTEGER});assert.equal(h.timers.at(-1).ms,2000);oldTimer.fn();assert.equal(h.monitor.diagnostics().category,null);h.reply();await reading;await h.monitor.close();
});
test('successful startup and sample remove per-request abort listeners; later abort cannot kill completed work',async()=>{
 const h=harness(),startupController=new AbortController(),s=h.monitor.start({signal:startupController.signal});h.reply();await s;assert.equal(getEventListeners(startupController.signal,'abort').length,0);startupController.abort();assert.equal(h.kills(),0);
 const c=new AbortController(),r=h.monitor.readRss({signal:c.signal});h.reply();await r;assert.equal(getEventListeners(c.signal,'abort').length,0);c.abort();assert.equal(h.kills(),0);await h.monitor.close();
});
