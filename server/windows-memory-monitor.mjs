import {spawn} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {windowsPowerShellPath,parseWindowsProcessTreeRss} from './windows-process-memory.mjs';
export const WINDOWS_MONITOR_COMMAND="$ErrorActionPreference='Stop'; [Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false); [Console]::InputEncoding=New-Object System.Text.UTF8Encoding($false); try { while ($null -ne ($line=[Console]::ReadLine())) { $request=$line | ConvertFrom-Json; $keys=@($request.PSObject.Properties.Name | Sort-Object); if (($keys -join ',') -ne 'id,pid' -or $request.id -is [bool] -or $request.pid -is [bool] -or $request.id -isnot [ValueType] -or $request.pid -isnot [ValueType] -or $request.id -lt 1 -or $request.id -gt 9007199254740991 -or $request.id -ne [Math]::Floor($request.id) -or $request.pid -lt 1 -or $request.pid -gt 4294967295 -or $request.pid -ne [Math]::Floor($request.pid)) { exit 21 }; $rows=@(Get-CimInstance -ClassName Win32_Process -Property ProcessId,ParentProcessId,WorkingSetSize -ErrorAction Stop | Select-Object -Property ProcessId,ParentProcessId,WorkingSetSize); [Console]::WriteLine((@{id=$request.id;rows=$rows} | ConvertTo-Json -Depth 4 -Compress)) } } catch { exit 22 }";
const MAX_OUTPUT=4*1024*1024;
const SIGNALS=new Set(['SIGTERM','SIGKILL','SIGINT','SIGBREAK','SIGHUP']);
export function createWindowsMemoryMonitor({rootPid,platform=process.platform,systemRoot=process.env.SystemRoot,spawnProcess=spawn,now=()=>performance.now(),schedule=setTimeout,cancel=clearTimeout}={}){
 if(!Number.isSafeInteger(rootPid)||rootPid<=0||rootPid>0xffffffff)throw Error('Invalid owned PID.');
 let child,pending,buffer=Buffer.alloc(0),state='new',nextId=0,exitObserved=false,exitWaiters=[];
 const diagnostic={category:null,killed:false,exitCode:null,signal:null,phase:null,elapsedMs:null};
 function failure(category){
  if(!diagnostic.category){diagnostic.category=category;diagnostic.phase=state==='starting'?'startup':state==='reading'?'request':state;if(pending){const elapsed=now()-pending.started;diagnostic.elapsedMs=Number.isFinite(elapsed)&&elapsed>=0?elapsed:null;}}
  state='failed';
  const error=Object.assign(Error('Windows memory collector failed.'),{category:diagnostic.category});
  if(pending){cancel(pending.timer);pending.reject(error);pending=null;}
  if(child&&!exitObserved){try{child.kill();diagnostic.killed=Boolean(child.killed);}catch{}}
  return error;
 }
 function receive(chunk){
  if(state==='failed'||state==='closed')return;
  if(!pending){failure('UNEXPECTED_OUTPUT');return;}
  buffer=Buffer.concat([buffer,chunk]);
  if(buffer.length>MAX_OUTPUT){failure('OUTPUT_LIMIT');return;}
  const end=buffer.indexOf(10);if(end<0)return;
  if(buffer.subarray(end+1).length){failure('MALFORMED_RESPONSE');return;}
  try{
   const text=new TextDecoder('utf-8',{fatal:true}).decode(buffer.subarray(0,end));
   const response=JSON.parse(text.replace(/^\uFEFF/,''));
   if(!response||typeof response!=='object'||Array.isArray(response)||Object.keys(response).sort().join(',')!=='id,rows'||response.id!==pending.id)throw Error();
   const rssBytes=parseWindowsProcessTreeRss(JSON.stringify(response.rows),rootPid);
   if(rssBytes<=0)throw Error();
   const elapsedMs=now()-pending.started;if(!Number.isFinite(elapsedMs)||elapsedMs<0)throw Error();
   if(elapsedMs>pending.limitMs){failure(pending.startup?'STARTUP_TIMEOUT':'REQUEST_TIMEOUT');return;}
   const done=pending;pending=null;buffer=Buffer.alloc(0);cancel(done.timer);state='ready';done.resolve({rssBytes,elapsedMs});
  }catch{failure('MALFORMED_RESPONSE');}
 }
 function request(startup){
  if(pending)return Promise.reject(failure('CONCURRENT_REQUEST'));
  if((startup&&state!=='starting')||(!startup&&state!=='ready'))return Promise.reject(failure('INVALID_STATE'));
  if(nextId>=Number.MAX_SAFE_INTEGER)return Promise.reject(failure('REQUEST_ID_LIMIT'));
  state=startup?'starting':'reading';
  return new Promise((resolve,reject)=>{
   const id=++nextId,started=now();
   const timer=schedule(()=>failure(startup?'STARTUP_TIMEOUT':'REQUEST_TIMEOUT'),startup?10000:2000);
   pending={id,started,timer,resolve,reject,startup,limitMs:startup?10000:2000};
   try{child.stdin.write(JSON.stringify({id,pid:rootPid})+'\n',error=>{if(error)failure('INPUT_ERROR');});}catch{failure('INPUT_ERROR');}
  });
 }
 function waitExit(ms){return new Promise(resolve=>{
  if(exitObserved)return resolve(true);
  let timer;const done=()=>{cancel(timer);exitWaiters=exitWaiters.filter(fn=>fn!==done);resolve(true);};
  timer=schedule(()=>{exitWaiters=exitWaiters.filter(fn=>fn!==done);resolve(false);},ms);exitWaiters.push(done);
 });}
 return {
  async start(){
   if(state!=='new')throw failure('INVALID_STATE');
   if(platform!=='win32')throw failure('UNSUPPORTED_PLATFORM');
   let executable;try{executable=windowsPowerShellPath(systemRoot);}catch{throw failure('INVALID_LAUNCHER');}
   state='starting';
   try{child=spawnProcess(executable,['-NoLogo','-NoProfile','-NonInteractive','-Command',WINDOWS_MONITOR_COMMAND],{stdio:['pipe','pipe','ignore'],windowsHide:true,shell:false,env:{SystemRoot:systemRoot,WINDIR:systemRoot}});}catch{throw failure('SPAWN_ERROR');}
   child.stdout.on('data',receive);child.stdin.on('error',()=>failure('INPUT_ERROR'));
   child.on('error',()=>failure('SPAWN_ERROR'));
   child.on('close',(code,signal)=>{exitObserved=true;diagnostic.exitCode=Number.isSafeInteger(code)?code:null;diagnostic.signal=SIGNALS.has(signal)?signal:null;for(const resolve of [...exitWaiters])resolve();if(state!=='closing'&&state!=='closed')failure('COLLECTOR_CLOSED');});
   return request(true);
  },
  readRss(){return request(false);},
  async close(){
   if(!child){state='closed';return {exitObserved:true,...diagnostic};}
   if(pending)failure('COLLECTOR_CLOSED');
   if(!exitObserved){state='closing';try{child.stdin.end();}catch{failure('INPUT_ERROR');}
    if(!await waitExit(3000)){try{child.kill();diagnostic.killed=Boolean(child.killed);}catch{}if(!await waitExit(3000)){failure('CLEANUP_TIMEOUT');return {exitObserved:false,...diagnostic};}}
   }
   state='closed';return {exitObserved,...diagnostic};
  },
  diagnostics(){return {...diagnostic,state,exitObserved};}
 };
}
