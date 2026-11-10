// D1h: one typed local WMI query, no cmdlet discovery or production changes.
import {spawn} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {windowsPowerShellPath} from '../server/windows-process-memory.mjs';
import {SYNTHETIC_PROCESS,requireNodeVersion} from './windows-memory-smoke.mjs';
export const DIRECT_WMI_COMMAND="$ErrorActionPreference='Stop'; [Console]::WriteLine('D1H_BOOT'); $searcher=$null; $results=$null; $failed=$false; $disposeFailed=$false; try { [Console]::WriteLine('D1H_TYPE_RESOLVE'); [type]$searchType=[wmisearcher]; [Console]::WriteLine('D1H_TYPE_READY'); [Console]::WriteLine('D1H_READ_READY'); $ownedText=[Console]::ReadLine(); [uint32]$ownedPid=0; if (-not [uint32]::TryParse($ownedText,[Globalization.NumberStyles]::None,[Globalization.CultureInfo]::InvariantCulture,[ref]$ownedPid) -or $ownedPid -eq 0 -or $ownedPid -eq $PID) { throw 'input' }; [Console]::WriteLine('D1H_QUERY_CONSTRUCT'); $query='SELECT ProcessId,ParentProcessId,WorkingSetSize FROM Win32_Process WHERE ProcessId='+$ownedPid.ToString([Globalization.CultureInfo]::InvariantCulture); $searcher=[wmisearcher]::new('root\\cimv2',$query); [Console]::WriteLine('D1H_QUERY_READY'); [Console]::WriteLine('D1H_WMI_GET'); $results=$searcher.Get(); [Console]::WriteLine('D1H_WMI_ENUMERATE'); $count=0; foreach ($item in $results) { try { $count++; if ($count -ne 1) { throw 'count' }; $rowPid=$item.GetPropertyValue('ProcessId'); $parent=$item.GetPropertyValue('ParentProcessId'); $rss=$item.GetPropertyValue('WorkingSetSize'); if ($rowPid -isnot [uint32] -or $parent -isnot [uint32] -or $rss -isnot [uint64] -or $rowPid -ne $ownedPid -or $rss -eq 0 -or $rss -gt 9007199254740991) { throw 'row' } } finally { $item.Dispose() } }; if ($count -ne 1) { throw 'count' }; [Console]::WriteLine(('D1H_RESULT:1:'+$rowPid.ToString([Globalization.CultureInfo]::InvariantCulture)+':'+$parent.ToString([Globalization.CultureInfo]::InvariantCulture)+':'+$rss.ToString([Globalization.CultureInfo]::InvariantCulture))) } catch { $failed=$true; [Console]::WriteLine('D1H_ERROR') } finally { if ($null -ne $results) { try { $results.Dispose() } catch { $disposeFailed=$true } }; if ($null -ne $searcher) { try { $searcher.Dispose() } catch { $disposeFailed=$true } } }; if ($disposeFailed) { [Console]::WriteLine('D1H_ERROR_DISPOSE'); exit 24 }; if ($failed) { exit 22 }; [Console]::WriteLine('D1H_DISPOSED'); [Console]::WriteLine('D1H_DONE')";
const STAGES=['BOOT','TYPE_RESOLVE','TYPE_READY','READ_READY','QUERY_CONSTRUCT','QUERY_READY','WMI_GET','WMI_ENUMERATE','RESULT','DISPOSED','DONE'];
const SIGNALS=new Set(['SIGTERM','SIGKILL','SIGINT','SIGBREAK','SIGHUP']);
export async function runDirectWmiProbe({rootPid,systemRoot=process.env.SystemRoot,spawnProcess=spawn,signal,now=()=>performance.now(),schedule=setTimeout,cancel=clearTimeout}={}){
 const report={diagnosticOnly:true,performanceValidated:false,stages:[],category:null,requestSent:false,killed:false,exitObserved:false,exitCode:null,signal:null};
 let executable;try{executable=windowsPowerShellPath(systemRoot);if(!Number.isSafeInteger(rootPid)||rootPid<=0||rootPid>0xffffffff||rootPid===process.pid)throw Error();}catch{report.category='INVALID_REQUEST';return report;}
 const started=now(),expires=started+10000;let child,timer,cleanupTimer,buffer='',bytes=0,index=0,done=false,phase='BOOT';
 return new Promise(resolve=>{
  function finish(){if(done)return;done=true;cancel(timer);cancel(cleanupTimer);signal?.removeEventListener('abort',abort);report.elapsedMs=Math.max(0,now()-started);resolve(report);}
  function fail(category){if(done||report.category)return;report.category=category;cancel(timer);try{if(!report.exitObserved){child?.kill();report.killed=Boolean(child?.killed);}}catch{}if(done)return;if(report.exitObserved)return finish();cleanupTimer=schedule(()=>{report.cleanupCategory='EXIT_NOT_OBSERVED';finish();},250);}
  function expired(){if(!report.category&&now()>=expires){fail('TIMEOUT_'+phase);return true;}return Boolean(report.category);}
  function abort(){fail('GLOBAL_OR_FIXTURE_ABORT');}
  if(signal?.aborted){report.category='GLOBAL_OR_FIXTURE_ABORT';finish();return;}
  signal?.addEventListener('abort',abort,{once:true});
  try{child=spawnProcess(executable,['-NoLogo','-NoProfile','-NonInteractive','-Command',DIRECT_WMI_COMMAND],{stdio:['pipe','pipe','ignore'],windowsHide:true,shell:false,env:{SystemRoot:systemRoot,WINDIR:systemRoot}});}catch{report.category='SPAWN_ERROR';finish();return;}
  timer=schedule(()=>fail('TIMEOUT_'+phase),Math.max(0,expires-now()));
  child.on('error',()=>fail('SPAWN_ERROR'));child.stdin.on('error',()=>fail('INPUT_ERROR'));
  child.on('close',(code,signalName)=>{
   report.exitObserved=true;report.exitCode=Number.isSafeInteger(code)&&code>=0&&code<=255?code:null;report.signal=SIGNALS.has(signalName)?signalName:null;
   if(done)return;if(expired())return finish();
   if(signalName&&!SIGNALS.has(signalName))report.category='UNKNOWN_SIGNAL';
   else if(buffer.length)report.category='UNTERMINATED_OUTPUT';
   else if(index!==STAGES.length||code!==0||signalName)report.category='EARLY_OR_FAILED_EXIT';finish();
  });
  child.stdout.on('data',chunk=>{
   if(done||report.category||expired())return;bytes+=chunk.length;if(bytes>4096)return fail('OUTPUT_LIMIT');if(chunk.some(b=>b>127))return fail('INVALID_OUTPUT');buffer+=chunk.toString('ascii');
   let newline;while((newline=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,newline).replace(/\r$/,'');buffer=buffer.slice(newline+1);if(expired())return;
    if(line==='D1H_ERROR'||line==='D1H_ERROR_DISPOSE'){if(index<2)return fail('UNEXPECTED_STAGE');return fail(line==='D1H_ERROR'?'COMMAND_ERROR':'DISPOSE_ERROR');}
    const match=/^D1H_([A-Z_]+)(?::([0-9]+):([0-9]+):([0-9]+):([0-9]+))?$/.exec(line);
    if(!match||match[1]!==STAGES[index])return fail('UNEXPECTED_STAGE');
    const stage=match[1];
    if(stage==='RESULT'){
     const values=match.slice(2).map(Number);if(values.length!==4||!values.every(n=>Number.isSafeInteger(n)&&n>=0)||values[0]!==1||values[1]!==rootPid||values[2]>0xffffffff||values[3]<=0)return fail('INVALID_RESULT');
     report.ownedProcessCount=1;report.ownedRootRssBytes=values[3];
    }else if(match[2]!==undefined)return fail('INVALID_AGGREGATE');
    index++;phase=stage==='DONE'?'EXIT':stage;report.stages.push({stage,elapsedMs:Math.max(0,now()-started)});
    if(stage==='READ_READY'){report.requestSent=true;try{child.stdin.end(String(rootPid)+'\n');}catch{return fail('INPUT_ERROR');}}
   }
  });
 });
}
async function waitExit(child,ms){if(child.exitCode!==null&&child.exitCode!==undefined||child.signalCode)return true;return new Promise(resolve=>{const done=()=>{clearTimeout(timer);child.off('exit',done);resolve(true);};const timer=setTimeout(()=>{child.off('exit',done);resolve(false);},ms);child.once('exit',done);});}
export async function runWindowsWmiDirectDiagnostic({platform=process.platform,arch=process.arch,nodeVersion=process.version,systemRoot=process.env.SystemRoot,spawnProcess=spawn,probe=runDirectWmiProbe,now=()=>performance.now()}={}){
 const started=now(),controller=new AbortController();let fixture,fixtureError=false,unexpectedExit=false,intentional=false,watchdog;
 const report={status:'DIAGNOSTIC_ONLY',diagnosticOnly:true,performanceValidated:false,maximumPowerShellProcesses:1,maximumFixtureProcesses:1,maximumWmiQueries:1,maximumConfiguredMs:15000,diagnosticComplete:false,physical8GBValidation:false,inferenceValidation:false};
 const live=()=>fixture&&!fixtureError&&!unexpectedExit&&fixture.exitCode===null&&!fixture.signalCode&&fixture.connected;
 try{
  requireNodeVersion(nodeVersion);if(platform!=='win32'||arch!=='x64')throw Error();windowsPowerShellPath(systemRoot);
  watchdog=setTimeout(()=>{controller.abort();try{fixture?.kill();}catch{}},14000);
  fixture=spawnProcess(process.execPath,['--input-type=commonjs','-e',SYNTHETIC_PROCESS],{stdio:['ignore','ignore','ignore','ipc'],windowsHide:true,shell:false,env:{SystemRoot:systemRoot,WINDIR:systemRoot}});
  fixture.on('error',()=>{fixtureError=true;controller.abort();});fixture.on('exit',()=>{if(!intentional){unexpectedExit=true;controller.abort();}});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error()),2000);fixture.once('message',m=>{clearTimeout(timer);m==='ready'?resolve():reject(Error());});fixture.once('error',()=>{clearTimeout(timer);reject(Error());});fixture.once('exit',()=>{clearTimeout(timer);reject(Error());});});
  if(!Number.isSafeInteger(fixture.pid)||fixture.pid<=0||fixture.pid>0xffffffff||fixture.pid===process.pid||!live()||controller.signal.aborted||now()-started>=14000)throw Error();
  report.probe=await probe({rootPid:fixture.pid,systemRoot,signal:controller.signal});if(!live())throw Error();
 }catch{report.category=controller.signal.aborted?'GLOBAL_OR_FIXTURE_FAILURE':'SETUP_OR_CLEANUP_FAILURE';}
 finally{
  if(fixture){intentional=Boolean(live());try{if(fixture.connected)fixture.disconnect();if(!await waitExit(fixture,500)){fixture.kill();report.fixtureForced=true;}const observed=await waitExit(fixture,500);report.cleanup={exitObserved:observed,expectedExitZero:intentional&&!fixtureError&&observed&&!report.fixtureForced&&fixture.exitCode===0&&!fixture.signalCode};}catch{report.cleanup={exitObserved:false,expectedExitZero:false};}}
  clearTimeout(watchdog);
 }
 report.elapsedMs=Math.max(0,now()-started);report.withinConfiguredBound=report.elapsedMs<=15000;
 const p=report.probe,knownOutcome=p&&(p.category===null||['COMMAND_ERROR','DISPOSE_ERROR'].includes(p.category)||/^TIMEOUT_(BOOT|TYPE_RESOLVE|TYPE_READY|READ_READY|QUERY_CONSTRUCT|QUERY_READY|WMI_GET|WMI_ENUMERATE|RESULT|DISPOSED|EXIT)$/.test(p.category));
 report.diagnosticComplete=Boolean(!report.category&&report.withinConfiguredBound&&knownOutcome&&p.exitObserved&&report.cleanup?.expectedExitZero);
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const report=await runWindowsWmiDirectDiagnostic();console.log(JSON.stringify(report,null,2));if(!report.diagnosticComplete)process.exitCode=1;}
