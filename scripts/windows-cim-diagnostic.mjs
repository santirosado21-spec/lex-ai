import {spawn} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {windowsPowerShellPath,parseWindowsProcessTreeRss} from '../server/windows-process-memory.mjs';
import {SYNTHETIC_PROCESS,requireNodeVersion,stopSyntheticProcess} from './windows-memory-smoke.mjs';
const PREFIX='D1E_';
export const HANDSHAKE_PROBE="$ErrorActionPreference='Stop'; [Console]::WriteLine('D1E_BOOT'); [Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false); [Console]::InputEncoding=New-Object System.Text.UTF8Encoding($false); [Console]::WriteLine('D1E_READ_READY'); try { $request=[Console]::ReadLine() | ConvertFrom-Json; if ((($request.PSObject.Properties.Name | Sort-Object) -join ',') -ne 'id,pid' -or $request.id -is [bool] -or $request.id -ne 1 -or $request.pid -is [bool] -or $request.pid -isnot [ValueType] -or $request.pid -lt 1 -or $request.pid -gt 4294967295 -or $request.pid -ne [Math]::Floor($request.pid)) { exit 21 }; [Console]::WriteLine('D1E_REQUEST_READ') } catch { exit 22 }";
export const CIM_PROBE="$ErrorActionPreference='Stop'; [Console]::WriteLine('D1E_BOOT'); [Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false); [Console]::WriteLine('D1E_CIM_START'); try { $rows=@(Get-CimInstance -ClassName Win32_Process -Property ProcessId,ParentProcessId,WorkingSetSize -ErrorAction Stop | Select-Object -Property ProcessId,ParentProcessId,WorkingSetSize); [Console]::WriteLine('D1E_CIM_END'); [Console]::WriteLine((ConvertTo-Json -InputObject $rows -Compress)) } catch { [Console]::WriteLine('D1E_CIM_ERROR'); exit 22 }";
const signals=new Set(['SIGTERM','SIGKILL','SIGINT','SIGBREAK','SIGHUP']);
export async function runWindowsCimProbe({kind,rootPid,systemRoot=process.env.SystemRoot,spawnProcess=spawn,now=()=>performance.now(),schedule=setTimeout,cancel=clearTimeout}={}){
 if(!['handshake','cim'].includes(kind)||!Number.isSafeInteger(rootPid)||rootPid<=0||rootPid>0xffffffff)throw Error('Invalid diagnostic request.');
 const report={kind,stages:[],requestSentAfterReadReady:false,category:null,killed:false,exitCode:null,signal:null,exitObserved:false,performanceValidated:false};
 let executable;try{executable=windowsPowerShellPath(systemRoot);}catch{report.category='INVALID_LAUNCHER';return report;}
 const started=now();let child,timer,buffer=Buffer.alloc(0),bytes=0,index=0,complete=false,done=false,phaseExpires=Infinity,phaseCategory=null;
 const sequence=kind==='handshake'?['BOOT','READ_READY','REQUEST_READ']:['BOOT','CIM_START','CIM_END'];
 return new Promise(resolve=>{
  function finish(){if(done)return;done=true;cancel(timer);report.elapsedMs=Math.max(0,now()-started);resolve(report);}
  function deadline(ms,category){cancel(timer);phaseExpires=now()+ms;phaseCategory=category;timer=schedule(()=>fail(category),ms);}
  function expired(){if(!report.category&&now()>phaseExpires){fail(phaseCategory);return true;}return Boolean(report.category);}
  function fail(category){if(!report.category)report.category=category;try{if(!report.exitObserved){child?.kill();report.killed=Boolean(child?.killed);}}catch{}if(done)return;cancel(timer);timer=schedule(()=>{report.cleanupCategory=report.exitObserved?null:'EXIT_NOT_OBSERVED';finish();},250);if(report.exitObserved)finish();}
  function line(text){
   if(report.category||expired())return;
   const marker=text.startsWith(PREFIX)?text.slice(PREFIX.length):null;
   if(marker==='CIM_ERROR'&&kind==='cim'){report.stages.push({stage:marker,elapsedMs:now()-started});report.category='CIM_COMMAND_ERROR';return;}
   if(index<sequence.length){
    if(marker!==sequence[index++])return fail('UNEXPECTED_STAGE');
    report.stages.push({stage:marker,elapsedMs:now()-started});
    if(marker==='BOOT')deadline(1000,kind==='handshake'?'READ_READY_TIMEOUT':'CIM_START_TIMEOUT');
    if(marker==='READ_READY'){
     report.requestSentAfterReadReady=true;deadline(2000,'REQUEST_READ_TIMEOUT');
     try{child.stdin.write(JSON.stringify({id:1,pid:rootPid})+'\n');}catch{return fail('INPUT_ERROR');}
    }
    if(marker==='CIM_START')deadline(6000,'CIM_TIMEOUT');
    if(marker==='REQUEST_READ'){complete=true;child.stdin.end();deadline(1000,'EXIT_TIMEOUT');}
    if(marker==='CIM_END')deadline(1000,'SNAPSHOT_TIMEOUT');
    return;
   }
   if(kind!=='cim'||complete)return fail('UNEXPECTED_OUTPUT');
   try{const rows=JSON.parse(text);report.processCount=Array.isArray(rows)?rows.length:1;report.ownedRootRssBytes=parseWindowsProcessTreeRss(text,rootPid);if(report.ownedRootRssBytes<=0)throw Error();if(expired())return;complete=true;deadline(1000,'EXIT_TIMEOUT');}catch{fail('INVALID_SNAPSHOT');}
  }
  try{child=spawnProcess(executable,['-NoLogo','-NoProfile','-NonInteractive','-Command',kind==='handshake'?HANDSHAKE_PROBE:CIM_PROBE],{stdio:[kind==='handshake'?'pipe':'ignore','pipe','ignore'],windowsHide:true,shell:false,env:{SystemRoot:systemRoot,WINDIR:systemRoot}});}catch{report.category='SPAWN_ERROR';finish();return;}
  deadline(3000,'BOOT_TIMEOUT');
  child.stdin?.on('error',()=>fail('INPUT_ERROR'));
  child.on('error',()=>fail('SPAWN_ERROR'));
  child.on('close',(code,signal)=>{report.exitObserved=true;report.exitCode=Number.isSafeInteger(code)?code:null;report.signal=signals.has(signal)?signal:null;if(expired())return finish();if(!report.category&&(!complete||code!==0||signal))report.category='EARLY_OR_FAILED_EXIT';finish();});
  child.stdout.on('data',chunk=>{
   if(done)return;bytes+=chunk.length;if(bytes>4*1024*1024)return fail('OUTPUT_LIMIT');buffer=Buffer.concat([buffer,chunk]);
   let newline;while((newline=buffer.indexOf(10))>=0){const raw=buffer.subarray(0,newline);buffer=buffer.subarray(newline+1);try{line(new TextDecoder('utf-8',{fatal:true}).decode(raw).replace(/^\uFEFF/,'').trimEnd());}catch{return fail('INVALID_UTF8');}}
  });
 });
}
export async function runWindowsCimDiagnostic({platform=process.platform,arch=process.arch,nodeVersion=process.version,spawnProcess=spawn,probe=runWindowsCimProbe}={}){
 const report={status:'DIAGNOSTIC_ONLY',diagnosticOnly:true,performanceValidated:false,protocol1ColdStartBoundPassed:false,protocol2StartupBoundPassed:false,platform,arch,nodeVersion,probes:[],maximumProbeCommands:2,diagnosticScope:'finite stage localization, not a definitive root cause or performance pass',maximumConfiguredDiagnosticMs:28500,syntheticLifetimeMs:30000,physical8GBValidation:false,installerValidation:false,inferenceValidation:false};let child,fixtureError=false,fixtureExited=false,shutdown=false;
 const fixtureLive=()=>child&&!fixtureError&&!fixtureExited&&child.exitCode===null&&!child.signalCode&&child.connected;
 try{
  requireNodeVersion(nodeVersion);if(platform!=='win32'||arch!=='x64')throw Error();
  child=spawnProcess(process.execPath,['--input-type=commonjs','-e',SYNTHETIC_PROCESS],{stdio:['ignore','ignore','ignore','ipc'],windowsHide:true,shell:false});child.on('error',()=>{fixtureError=true;});child.on('exit',()=>{if(!shutdown)fixtureExited=true;});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error()),3000);child.once('message',m=>{clearTimeout(timer);m==='ready'?resolve():reject(Error());});child.once('error',()=>{clearTimeout(timer);reject(Error());});child.once('exit',()=>{clearTimeout(timer);reject(Error());});});
  if(!Number.isSafeInteger(child.pid)||child.pid<=0||child.pid===process.pid)throw Error();
  report.probes.push(await probe({kind:'handshake',rootPid:child.pid}));
  if(!report.probes[0].exitObserved||!fixtureLive())throw Error();
  report.probes.push(await probe({kind:'cim',rootPid:child.pid}));
  if(!fixtureLive())throw Error();
 }catch{report.category='DIAGNOSTIC_SETUP_FAILURE';}
 finally{if(child&&Number.isSafeInteger(child.pid)&&child.pid>0){const live=Boolean(fixtureLive());shutdown=true;try{report.cleanup=await stopSyntheticProcess(child);report.cleanup.expectedExitZero=Boolean(live&&!fixtureError&&!report.cleanup.forced&&child.exitCode===0&&!child.signalCode);}catch{report.cleanup={exitObserved:false,expectedExitZero:false};}}}
 report.diagnosticComplete=report.probes.length===2&&report.probes.every(p=>p.exitObserved&&(p.category===null||['READ_READY_TIMEOUT','REQUEST_READ_TIMEOUT','CIM_START_TIMEOUT','CIM_TIMEOUT','CIM_COMMAND_ERROR'].includes(p.category)))&&Boolean(report.cleanup?.expectedExitZero);
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const report=await runWindowsCimDiagnostic();console.log(JSON.stringify(report,null,2));if(!report.diagnosticComplete)process.exitCode=1;}
