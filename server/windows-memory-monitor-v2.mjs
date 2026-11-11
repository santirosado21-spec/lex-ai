import {spawn} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {windowsPowerShellPath,parseWindowsProcessTreeRss} from './windows-process-memory.mjs';
export const WINDOWS_WMI_MAX_ROWS=4096;
export const WINDOWS_WMI_MAX_OUTPUT=4*1024*1024;
// Fixed local read-only query. No cmdlet discovery, remote scope or received code.
// A response is emitted only after all WMI resources were disposed successfully.
export const WINDOWS_WMI_MONITOR_COMMAND=String.raw`$ErrorActionPreference='Stop'; try {
 $culture=[Globalization.CultureInfo]::InvariantCulture;
 [uint64]$lastId=0; [uint32]$boundRoot=0;
 while ($null -ne ($line=[Console]::ReadLine())) {
  if ($line.Length -gt 27) { throw 'input' };
  $match=[regex]::Match($line,'\A([1-9][0-9]{0,15}):([1-9][0-9]{0,9})\z');
  [uint64]$requestId=0; [uint32]$rootId=0;
  if (-not $match.Success -or -not [uint64]::TryParse($match.Groups[1].Value,[Globalization.NumberStyles]::None,$culture,[ref]$requestId) -or -not [uint32]::TryParse($match.Groups[2].Value,[Globalization.NumberStyles]::None,$culture,[ref]$rootId) -or $requestId -gt 9007199254740991 -or $requestId -ne ($lastId+1) -or $rootId -eq 0 -or $rootId -eq $PID -or ($boundRoot -ne 0 -and $rootId -ne $boundRoot)) { throw 'input' };
  $lastId=$requestId; $boundRoot=$rootId;
  $searcher=$null; $results=$null; $rows=[Text.StringBuilder]::new(); $count=0;
  try {
   $searcher=[wmisearcher]::new('root\cimv2','SELECT ProcessId,ParentProcessId,WorkingSetSize FROM Win32_Process');
   $results=$searcher.Get();
   foreach ($item in $results) {
    try {
     $count++; if ($count -gt 4096) { throw 'count' };
     $rowId=$item.GetPropertyValue('ProcessId'); $parentId=$item.GetPropertyValue('ParentProcessId'); $rss=$item.GetPropertyValue('WorkingSetSize');
     if ($rowId -isnot [uint32] -or $parentId -isnot [uint32] -or $rss -isnot [uint64] -or $rss -gt 9007199254740991) { throw 'row' };
     if ($count -gt 1) { [void]$rows.Append(';') };
     [void]$rows.Append($rowId.ToString($culture)); [void]$rows.Append(','); [void]$rows.Append($parentId.ToString($culture)); [void]$rows.Append(','); [void]$rows.Append($rss.ToString($culture));
     if ($rows.Length -gt 4194200) { throw 'bytes' }
    } finally { $item.Dispose() }
   }
  } finally { try { if ($null -ne $results) { $results.Dispose() } } finally { if ($null -ne $searcher) { $searcher.Dispose() } } };
  if ($count -eq 0) { throw 'count' };
  [Console]::WriteLine(('WMI2:'+$requestId.ToString($culture)+':'+$rootId.ToString($culture)+':'+$count.ToString($culture)+':'+$rows.ToString()))
 }
} catch { exit 22 }`;
const invalid=()=>Error('Invalid WMI frame.');
export function parseWindowsWmiFrame(frame,{id,rootPid}){
 if(typeof frame!=='string'||frame.length>WINDOWS_WMI_MAX_OUTPUT||!/^[\x20-\x7e]+$/.test(frame))throw invalid();
 const header=/^WMI2:([1-9][0-9]{0,15}):([1-9][0-9]{0,9}):([1-9][0-9]{0,3}):/.exec(frame);
 if(!header||Number(header[1])!==id||Number(header[2])!==rootPid||!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(rootPid)||rootPid<1||rootPid>0xffffffff)throw invalid();
 const count=Number(header[3]);if(count>WINDOWS_WMI_MAX_ROWS)throw invalid();
 // Count delimiters before split/objects/JSON: the old parser has a byte cap,
 // not a row cap. 4096 rows is an explicitly stricter, bounded subset.
 const body=frame.slice(header[0].length);let actual=1;
 for(let i=0;i<body.length;i++)if(body.charCodeAt(i)===59&&++actual>count)throw invalid();
 if(actual!==count)throw invalid();
 const rows=body.split(';').map(row=>{
  if(!/^(0|[1-9][0-9]{0,9}),(0|[1-9][0-9]{0,9}),(0|[1-9][0-9]{0,15})$/.test(row))throw invalid();
  const [ProcessId,ParentProcessId,WorkingSetSize]=row.split(',').map(Number);
  if(ProcessId>0xffffffff||ParentProcessId>0xffffffff||!Number.isSafeInteger(WorkingSetSize))throw invalid();
  return {ProcessId,ParentProcessId,WorkingSetSize};
 });
 // <=4096 objects of three numeric fields; maximum serialized size <512 KiB.
 const rssBytes=parseWindowsProcessTreeRss(JSON.stringify(rows),rootPid);
 if(rssBytes<=0)throw invalid();return rssBytes;
}
const SIGNALS=new Set(['SIGTERM','SIGKILL','SIGINT','SIGBREAK','SIGHUP']);
export function createWindowsMemoryMonitorV2({rootPid,platform=process.platform,systemRoot=process.env.SystemRoot,spawnProcess=spawn,now=()=>performance.now(),schedule=setTimeout,cancel=clearTimeout,signal:ownerSignal}={}){
 if(!Number.isSafeInteger(rootPid)||rootPid<=0||rootPid>0xffffffff||rootPid===process.pid)throw Error('Invalid owned PID.');
 if(ownerSignal!==undefined&&!(ownerSignal instanceof AbortSignal))throw Error('Invalid signal.');
 let child,pending,buffer=Buffer.alloc(0),state='new',nextId=0,exitObserved=false,exitWaiters=[],ownerAbort;
 const diagnostic={category:null,killed:false,exitCode:null,signal:null,phase:null,elapsedMs:null};
 const detachOwner=()=>ownerSignal?.removeEventListener('abort',ownerAbort);
 function settle(error,value){if(!pending)return;const p=pending;pending=null;cancel(p.timer);p.signal?.removeEventListener('abort',p.abort);error?p.reject(error):p.resolve(value);}
 function failure(category){
  if(!diagnostic.category){diagnostic.category=category;diagnostic.phase=state==='starting'?'startup':state==='reading'?'request':state;const elapsed=pending?now()-pending.started:null;diagnostic.elapsedMs=Number.isFinite(elapsed)&&elapsed>=0?elapsed:null;}
  state='failed';detachOwner();const error=Object.assign(Error('Windows WMI collector failed.'),{category:diagnostic.category});settle(error);
  if(child&&!exitObserved&&!diagnostic.killed){try{child.kill();diagnostic.killed=Boolean(child.killed);}catch{}}
  return error;
 }
 function expired(){if(!pending)return true;const time=now();if(!Number.isFinite(time)||time<pending.started){failure('INVALID_CLOCK');return true;}if(time>=pending.deadline){failure(pending.startup?'STARTUP_TIMEOUT':'REQUEST_TIMEOUT');return true;}return false;}
 function receive(chunk){
  if(state==='failed'||state==='closed')return;if(!pending){failure('UNEXPECTED_OUTPUT');return;}if(expired())return;
  if(!Buffer.isBuffer(chunk)||chunk.length>WINDOWS_WMI_MAX_OUTPUT-buffer.length){failure('OUTPUT_LIMIT');return;}
  if(chunk.some(b=>b>127)){failure('MALFORMED_RESPONSE');return;}buffer=Buffer.concat([buffer,chunk]);
  const end=buffer.indexOf(10);if(end<0)return;
  if(buffer.length!==end+1){failure('MALFORMED_RESPONSE');return;}
  try{
   const frame=buffer.subarray(0,end).toString('ascii').replace(/\r$/,'');
   const rssBytes=parseWindowsWmiFrame(frame,{id:pending.id,rootPid});
   if(expired())return;const elapsedMs=now()-pending.started;if(!Number.isFinite(elapsedMs)||elapsedMs<0||elapsedMs>=pending.limitMs){failure(pending.startup?'STARTUP_TIMEOUT':'REQUEST_TIMEOUT');return;}
   buffer=Buffer.alloc(0);state='ready';settle(null,{rssBytes,elapsedMs});
  }catch{failure('MALFORMED_RESPONSE');}
 }
 function request(startup,{signal,started=now()}={}){
  if(signal!==undefined&&!(signal instanceof AbortSignal))return Promise.reject(failure('INVALID_SIGNAL'));
  if(pending)return Promise.reject(failure('CONCURRENT_REQUEST'));
  if((startup&&state!=='starting')||(!startup&&state!=='ready'))return Promise.reject(failure('INVALID_STATE'));
  if(signal?.aborted||ownerSignal?.aborted)return Promise.reject(failure('ABORTED'));
  if(nextId>=Number.MAX_SAFE_INTEGER)return Promise.reject(failure('REQUEST_ID_LIMIT'));
  state=startup?'starting':'reading';
  return new Promise((resolve,reject)=>{
   const id=++nextId,limitMs=startup?10000:2000,deadline=started+limitMs,abort=()=>failure('ABORTED');
   pending={id,started,deadline,limitMs,startup,signal,abort,resolve,reject,timer:null};
   signal?.addEventListener('abort',abort,{once:true});
   pending.timer=schedule(()=>{if(pending?.id===id)failure(startup?'STARTUP_TIMEOUT':'REQUEST_TIMEOUT');},Math.max(0,deadline-now()));
   if(signal?.aborted||ownerSignal?.aborted){failure('ABORTED');return;}if(expired())return;
   try{child.stdin.write(`${id}:${rootPid}\n`,error=>{if(error)failure('INPUT_ERROR');});if(pending)expired();}catch{failure('INPUT_ERROR');}
  });
 }
 function waitExit(ms){return new Promise(resolve=>{
  if(exitObserved)return resolve(true);let timer;
  const done=()=>{cancel(timer);exitWaiters=exitWaiters.filter(fn=>fn!==done);resolve(true);};
  timer=schedule(()=>{exitWaiters=exitWaiters.filter(fn=>fn!==done);resolve(false);},ms);exitWaiters.push(done);
 });}
 return {
  async start({signal}={}){
   const started=now();if(state!=='new')throw failure('INVALID_STATE');
   if(signal!==undefined&&!(signal instanceof AbortSignal))throw failure('INVALID_SIGNAL');
   if(ownerSignal?.aborted||signal?.aborted)throw failure('ABORTED');
   if(platform!=='win32')throw failure('UNSUPPORTED_PLATFORM');
   let executable;try{executable=windowsPowerShellPath(systemRoot);}catch{throw failure('INVALID_LAUNCHER');}
   state='starting';ownerAbort=()=>failure('ABORTED');ownerSignal?.addEventListener('abort',ownerAbort,{once:true});
   try{child=spawnProcess(executable,['-NoLogo','-NoProfile','-NonInteractive','-Command',WINDOWS_WMI_MONITOR_COMMAND],{stdio:['pipe','pipe','ignore'],windowsHide:true,shell:false,env:{SystemRoot:systemRoot,WINDIR:systemRoot}});}catch{throw failure('SPAWN_ERROR');}
   child.stdout.on('data',receive);child.stdin.on('error',()=>failure('INPUT_ERROR'));child.on('error',()=>failure('SPAWN_ERROR'));
   child.on('close',(code,signalName)=>{exitObserved=true;diagnostic.exitCode=Number.isSafeInteger(code)?code:null;diagnostic.signal=SIGNALS.has(signalName)?signalName:null;for(const resolve of [...exitWaiters])resolve();detachOwner();if(state!=='closing'&&state!=='closed'&&state!=='failed')failure('COLLECTOR_CLOSED');});
   if(state==='failed'||ownerSignal?.aborted||signal?.aborted)throw failure('ABORTED');
   return request(true,{signal,started});
  },
  readRss({signal}={}){return request(false,{signal});},
  async close(){
   detachOwner();if(!child){state='closed';return {exitObserved:true,...diagnostic};}
   if(pending)failure('COLLECTOR_CLOSED');
   if(!exitObserved){state='closing';try{child.stdin.end();}catch{failure('INPUT_ERROR');}
    if(!await waitExit(3000)){try{child.kill();diagnostic.killed=Boolean(child.killed);}catch{}if(!await waitExit(3000)){failure('CLEANUP_TIMEOUT');return {exitObserved:false,...diagnostic};}}
   }
   state='closed';return {exitObserved,...diagnostic};
  },
  diagnostics(){return {...diagnostic,state,exitObserved};}
 };
}
