// D1g: read-only two-process environment diagnosis; never a production RSS pass.
import {spawn} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {windowsPowerShellPath} from '../server/windows-process-memory.mjs';
import {SYNTHETIC_PROCESS,requireNodeVersion} from './windows-memory-smoke.mjs';
export const ENV_PROBE_COMMAND="$ErrorActionPreference='Stop'; [Console]::WriteLine('D1G_BOOT'); try { $moduleValue=[string]$env:PSModulePath; $entries=@($moduleValue.Split(';')); $builtin=[int]($entries -contains ($PSHOME+'\\Modules')); [Console]::WriteLine(('D1G_ENV:'+ $entries.Count + ':' + $builtin)); [Console]::WriteLine('D1G_LOOKUP_UTILITY'); $null=Get-Command -Name New-Object,ConvertFrom-Json,ConvertTo-Json,Select-Object,Sort-Object -CommandType Cmdlet -ErrorAction Stop; [Console]::WriteLine('D1G_LOOKUP_CIM'); $null=Get-Command -Name Get-CimInstance -CommandType Cmdlet -ErrorAction Stop; [Console]::WriteLine('D1G_READ_READY'); $line=[Console]::ReadLine(); [Console]::WriteLine('D1G_JSON'); $request=ConvertFrom-Json -InputObject $line -ErrorAction Stop; if ((($request.PSObject.Properties.Name | Sort-Object) -join ',') -ne 'id,pid' -or $request.id -is [bool] -or $request.id -ne 1 -or $request.pid -is [bool] -or $request.pid -isnot [ValueType] -or $request.pid -lt 1 -or $request.pid -gt 4294967295 -or $request.pid -ne [Math]::Floor($request.pid)) { exit 21 }; $round=ConvertFrom-Json -InputObject (ConvertTo-Json -InputObject @{ok=1} -Compress); if ($round.ok -ne 1) { exit 21 }; [Console]::WriteLine('D1G_CIM'); $rows=@(Get-CimInstance -ClassName Win32_Process -Filter ('ProcessId = '+[string]$request.pid) -Property ProcessId,WorkingSetSize -ErrorAction Stop | Select-Object -Property ProcessId,WorkingSetSize); if ($rows.Count -ne 1 -or $rows[0].ProcessId -ne $request.pid -or $rows[0].WorkingSetSize -le 0 -or $rows[0].WorkingSetSize -gt 9007199254740991) { exit 23 }; [Console]::WriteLine(('D1G_RESULT:1:'+[string]$rows[0].WorkingSetSize)); [Console]::WriteLine('D1G_DONE') } catch { [Console]::WriteLine('D1G_ERROR'); exit 22 }";
const sequence=['BOOT','ENV','LOOKUP_UTILITY','LOOKUP_CIM','READ_READY','JSON','CIM','RESULT','DONE'];
export function diagnosticEnvironment(systemRoot,variant){
 windowsPowerShellPath(systemRoot);if(!['minimal','builtin'].includes(variant))throw Error('INVALID_VARIANT');
 const env={SystemRoot:systemRoot,WINDIR:systemRoot};if(variant==='builtin')env.PSModulePath=path.win32.join(path.win32.dirname(windowsPowerShellPath(systemRoot)),'Modules');return env;
}
export async function runEnvProbe({variant,rootPid,systemRoot=process.env.SystemRoot,spawnProcess=spawn,signal,now=()=>performance.now(),schedule=setTimeout,cancel=clearTimeout}={}){
 const report={variant:['minimal','builtin'].includes(variant)?variant:null,diagnosticOnly:true,stages:[],category:null,exitObserved:false,killed:false,requestSent:false};
 let env,executable;try{env=diagnosticEnvironment(systemRoot,variant);executable=windowsPowerShellPath(systemRoot);if(!Number.isSafeInteger(rootPid)||rootPid<1||rootPid>0xffffffff)throw Error();}catch{report.category='INVALID_REQUEST';return report;}
 const started=now(),expires=started+10000;let child,timer,cleanupTimer,done=false,index=0,buffer='',bytes=0,phase='BOOT';
 return new Promise(resolve=>{
  const finish=()=>{if(done)return;done=true;cancel(timer);cancel(cleanupTimer);signal?.removeEventListener('abort',abort);report.elapsedMs=Math.max(0,now()-started);resolve(report);};
  const fail=category=>{if(done||report.category)return;report.category=category;cancel(timer);try{if(!report.exitObserved){child?.kill();report.killed=Boolean(child?.killed);}}catch{}if(report.exitObserved)return finish();cleanupTimer=schedule(()=>{report.cleanupCategory='EXIT_NOT_OBSERVED';finish();},250);};
  const expired=()=>{if(now()>=expires){fail('TIMEOUT_'+phase);return true;}return false;};
  const abort=()=>fail('GLOBAL_DEADLINE');
  if(signal?.aborted){report.category='GLOBAL_DEADLINE';finish();return;}
  signal?.addEventListener('abort',abort,{once:true});
  try{child=spawnProcess(executable,['-NoLogo','-NoProfile','-NonInteractive','-Command',ENV_PROBE_COMMAND],{stdio:['pipe','pipe','ignore'],windowsHide:true,shell:false,env});}catch{report.category='SPAWN_ERROR';finish();return;}
  timer=schedule(()=>fail('TIMEOUT_'+phase),10000);
  child.on('error',()=>fail('SPAWN_ERROR'));child.stdin.on('error',()=>fail('INPUT_ERROR'));
  child.on('close',(code)=>{report.exitObserved=true;report.exitCode=Number.isSafeInteger(code)&&code>=0&&code<=255?code:null;if(done)return;if(expired()||report.category)return finish();if(buffer.length)report.category='UNTERMINATED_OUTPUT';else if(index!==sequence.length||code!==0)report.category='EARLY_OR_FAILED_EXIT';finish();});
  child.stdout.on('data',chunk=>{
   if(done||report.category||expired())return;bytes+=chunk.length;if(bytes>4096)return fail('OUTPUT_LIMIT');
   if([...chunk].some(b=>b>127))return fail('INVALID_OUTPUT');buffer+=chunk.toString('ascii');
   let newline;while((newline=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,newline).replace(/\r$/,'');buffer=buffer.slice(newline+1);if(expired()||report.category)return;
    if(line==='D1G_ERROR')return fail('COMMAND_ERROR');
    const match=/^D1G_([A-Z_]+)(?::([0-9]+):([0-9]+))?$/.exec(line);if(!match||match[1]!==sequence[index])return fail('UNEXPECTED_STAGE');
    const stage=match[1];if(['ENV','RESULT'].includes(stage)){
     if(match[2]===undefined||match[3]===undefined)return fail('INVALID_AGGREGATE');const first=Number(match[2]),second=Number(match[3]);
     if(!Number.isSafeInteger(first)||!Number.isSafeInteger(second))return fail('INVALID_AGGREGATE');
     if(stage==='ENV'){if(first<1||first>128||![0,1].includes(second))return fail('INVALID_AGGREGATE');report.modulePathEntryCount=first;report.builtinPathPresent=Boolean(second);}
     else{if(first!==1||second<1)return fail('INVALID_AGGREGATE');report.ownedProcessCount=1;report.ownedRootRssBytes=second;}
    }else if(match[2]!==undefined)return fail('INVALID_AGGREGATE');
    index++;report.stages.push({stage,elapsedMs:Math.max(0,now()-started)});phase=({BOOT:'ENV',ENV:'LOOKUP_UTILITY',RESULT:'EXIT',DONE:'EXIT'})[stage]??stage;
    if(stage==='READ_READY'){report.requestSent=true;try{child.stdin.end(JSON.stringify({id:1,pid:rootPid})+'\n');}catch{return fail('INPUT_ERROR');}}
   }
  });
 });
}
async function waitExit(child,ms){
 if(child.exitCode!==null&&child.exitCode!==undefined||child.signalCode)return true;
 return new Promise(resolve=>{const finish=()=>{clearTimeout(timer);child.off('exit',finish);resolve(true);};const timer=setTimeout(()=>{child.off('exit',finish);resolve(false);},ms);child.once('exit',finish);});
}
export async function runWindowsEnvDiagnostic({platform=process.platform,arch=process.arch,nodeVersion=process.version,systemRoot=process.env.SystemRoot,spawnProcess=spawn,probe=runEnvProbe,now=()=>performance.now()}={}){
 const started=now(),controller=new AbortController();const report={status:'DIAGNOSTIC_ONLY',diagnosticOnly:true,performanceValidated:false,maximumPowerShellProcesses:2,maximumFixtureProcesses:1,maximumConfiguredMs:27000,orderConfounding:true,probes:[],diagnosticComplete:false};let fixture,fixtureFailed=false,fixtureExited=false,globalTimer;
 const live=()=>fixture&&!fixtureFailed&&!fixtureExited&&fixture.exitCode===null&&!fixture.signalCode&&fixture.connected;
 try{
  requireNodeVersion(nodeVersion);if(platform!=='win32'||arch!=='x64')throw Error();diagnosticEnvironment(systemRoot,'minimal');
  globalTimer=setTimeout(()=>{controller.abort();try{fixture?.kill();}catch{}},26000);
  fixture=spawnProcess(process.execPath,['--input-type=commonjs','-e',SYNTHETIC_PROCESS],{stdio:['ignore','ignore','ignore','ipc'],windowsHide:true,shell:false,env:{SystemRoot:systemRoot,WINDIR:systemRoot}});
  fixture.on('error',()=>{fixtureFailed=true;controller.abort();});fixture.on('exit',()=>{fixtureExited=true;controller.abort();});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error()),2000);const end=fn=>()=>{clearTimeout(timer);fn();};fixture.once('message',message=>{clearTimeout(timer);message==='ready'?resolve():reject(Error());});fixture.once('error',end(()=>reject(Error())));fixture.once('exit',end(()=>reject(Error())));});
  if(!Number.isSafeInteger(fixture.pid)||fixture.pid<1||fixture.pid===process.pid||!live())throw Error();
  for(const variant of ['minimal','builtin']){if(!live()||controller.signal.aborted||now()-started>=25000)throw Error();const result=await probe({variant,rootPid:fixture.pid,systemRoot,signal:controller.signal});report.probes.push(result);if(!result.exitObserved||!live())throw Error();}
 }catch{report.category=controller.signal.aborted?'GLOBAL_OR_FIXTURE_FAILURE':'SETUP_OR_CLEANUP_FAILURE';}
 finally{
  if(fixture){const wasLive=Boolean(live());try{if(fixture.connected)fixture.disconnect();if(!await waitExit(fixture,500)){fixture.kill();report.fixtureForced=true;}const observed=await waitExit(fixture,500);report.cleanup={exitObserved:observed,expectedExitZero:wasLive&&observed&&!report.fixtureForced&&fixture.exitCode===0&&!fixture.signalCode};}catch{report.cleanup={exitObserved:false,expectedExitZero:false};}}
  clearTimeout(globalTimer);
 }
 report.elapsedMs=Math.max(0,now()-started);report.withinConfiguredBound=report.elapsedMs<=27000;
 report.diagnosticComplete=report.withinConfiguredBound&&report.probes.length===2&&report.probes.every(p=>p.exitObserved&&(p.category===null||p.category==='COMMAND_ERROR'||/^TIMEOUT_(BOOT|ENV|LOOKUP_UTILITY|LOOKUP_CIM|READ_READY|JSON|CIM|EXIT)$/.test(p.category)))&&Boolean(report.cleanup?.expectedExitZero);
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const report=await runWindowsEnvDiagnostic();console.log(JSON.stringify(report,null,2));if(!report.diagnosticComplete)process.exitCode=1;}
