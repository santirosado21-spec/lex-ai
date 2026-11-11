import {spawn} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {createWindowsMemoryMonitor} from '../server/windows-memory-monitor.mjs';
import {createWindowsMemoryMonitorV2} from '../server/windows-memory-monitor-v2.mjs';
import {windowsProcessTreeRss} from '../server/windows-process-memory.mjs';
// A direct child only: no grandchildren, shell, documents, network or model.
// IPC disconnection and a fixed lifetime bound both terminate the fixture if
// the coordinator dies. The buffer is synthetic and retained for measurement.
export const SYNTHETIC_PROCESS="const bytes=Buffer.alloc(8*1024*1024,1); const timer=setInterval(()=>{if(bytes[0]!==1)process.exit(2);},1000); process.on('disconnect',()=>{clearInterval(timer);process.exit(0);}); setTimeout(()=>process.exit(3),30000); process.send('ready');";
export function requireNodeVersion(version){
 const m=/^v?(\d+)\.(\d+)\.(\d+)$/.exec(version);
 if(!m||Number(m[1])<22||(Number(m[1])===22&&Number(m[2])<13))throw Error('Node >=22.13 required; no installation is performed.');
}
function nextExit(child,timeoutMs){return new Promise(resolve=>{
 if((child.exitCode!==null&&child.exitCode!==undefined)||child.signalCode)return resolve(true);
 const done=()=>{clearTimeout(timer);child.off('exit',done);resolve(true);};
 const timer=setTimeout(()=>{child.off('exit',done);resolve(false);},timeoutMs);child.once('exit',done);
});}
export async function stopSyntheticProcess(child){
 if((child.exitCode!==null&&child.exitCode!==undefined)||child.signalCode)return {exitObserved:true,forced:false};
 const exited=nextExit(child,3000);
 if(child.connected)child.disconnect();
 if(await exited)return {exitObserved:true,forced:false};
 const forcedExit=nextExit(child,3000);child.kill();
 if(!await forcedExit)throw Error('Synthetic process cleanup failed.');
 return {exitObserved:true,forced:true};
}
export async function runWindowsMemorySmoke({platform=process.platform,arch=process.arch,nodeVersion=process.version,spawnNode=spawn,measure=windowsProcessTreeRss,now=()=>performance.now()}={}){
 const report={scope:'owned synthetic Node RSS smoke only',platform,arch,nodeVersion,samples:[],requestTimeoutMs:2000,requestOutputLimitBytes:4*1024*1024,physical8GBValidation:false,installerValidation:false,inferenceValidation:false};
 let child,childError=false;
 try{
  requireNodeVersion(nodeVersion);
  if(platform!=='win32'||arch!=='x64')throw Error('Windows x64 required; no platform fallback.');
  try{child=spawnNode(process.execPath,['--input-type=commonjs','-e',SYNTHETIC_PROCESS],{stdio:['ignore','ignore','ignore','ipc'],windowsHide:true,shell:false});}catch{throw Error('Synthetic process could not start.');}
  child.on('error',()=>{childError=true;}); // Never expose raw spawn/IPC diagnostics.
  await new Promise((resolve,reject)=>{
   const finish=(error)=>{clearTimeout(timer);child.off('message',ready);child.off('error',failed);child.off('exit',earlyExit);error?reject(error):resolve();};
   const ready=message=>{if(message==='ready')finish();else finish(Error('Unexpected synthetic fixture handshake.'));};
   const failed=()=>finish(Error('Synthetic process could not start.'));
   const earlyExit=()=>finish(Error('Synthetic process exited before readiness.'));
   const timer=setTimeout(()=>finish(Error('Synthetic process readiness timeout.')),5000);
   child.once('message',ready);child.once('error',failed);child.once('exit',earlyExit);
  });
  if(!Number.isSafeInteger(child.pid)||child.pid<=0||child.pid===process.pid)throw Error('Invalid owned synthetic process PID.');
  // Four serial first-attempt samples; errors stop immediately. No warmup,
  // retry, zero substitution or relaxation of production measurement limits.
  for(let i=0;i<4;i++){
   if(childError||child.exitCode!==null||child.signalCode)throw Error('Synthetic process exited or failed during measurement.');
   const started=now();let rss;
   try{rss=await measure(child.pid);}catch{report.failedSample={sample:i+1,elapsedMs:Math.round((now()-started)*100)/100};throw Error('CIM RSS measurement failed; no retry or fallback.');}
   const elapsedMs=now()-started;
   if(!Number.isSafeInteger(rss)||rss<=0||!Number.isFinite(elapsedMs)||elapsedMs<0)throw Error('Invalid CIM RSS measurement.');
   report.samples.push({sample:i+1,rssBytes:rss,elapsedMs:Math.round(elapsedMs*100)/100});
  }
  if(childError||child.exitCode!==null||child.signalCode)throw Error('Synthetic process exited or failed during measurement.');
  report.status='PASS';
 }catch(error){report.status='FAIL';report.failure=error.message;
 }finally{
  if(child&&Number.isSafeInteger(child.pid)&&child.pid>0){try{report.cleanup=await stopSyntheticProcess(child);if(report.cleanup.forced){report.status='FAIL';report.failure='Synthetic process required forced cleanup.';}}catch{report.status='FAIL';report.failure='Synthetic process cleanup failed; exit not observed.';report.cleanup={exitObserved:false};}}
 }
 return report;
}
// Protocol 2 preserves the failed protocol-1 two-second cold-start result.
// Its explicit ten-second bootstrap measures the FIRST actual CIM snapshot;
// steady-state requests retain the original two-second deadline.
export async function runPersistentWindowsMemorySmoke({platform=process.platform,arch=process.arch,nodeVersion=process.version,spawnNode=spawn,makeMonitor=createWindowsMemoryMonitor}={}){
 const report={protocol:2,scope:'owned synthetic Node persistent collector diagnostic only',platform,arch,nodeVersion,startupLimitMs:10000,requestTimeoutMs:2000,requestOutputLimitBytes:4*1024*1024,syntheticLifetimeLimitMs:60000,samples:[],physical8GBValidation:false,installerValidation:false,inferenceValidation:false,protocol1ColdStartBoundPassed:false,collectorMemoryOverheadBytes:null};
 let child,monitor,fixtureError=false,fixtureExited=false,intentionalShutdown=false;
 const fixtureLive=()=>child&&!fixtureError&&!fixtureExited&&child.exitCode===null&&!child.signalCode&&child.connected;
 try{
  requireNodeVersion(nodeVersion);
  if(platform!=='win32'||arch!=='x64')throw Error('Windows x64 required; no platform fallback.');
  try{child=spawnNode(process.execPath,['--input-type=commonjs','-e',SYNTHETIC_PROCESS.replace('30000','60000')],{stdio:['ignore','ignore','ignore','ipc'],windowsHide:true,shell:false});}catch{throw Error('Synthetic process could not start.');}
  child.on('error',()=>{fixtureError=true;});
  child.on('exit',()=>{if(!intentionalShutdown)fixtureExited=true;});
  await new Promise((resolve,reject)=>{
   const finish=error=>{clearTimeout(timer);child.off('message',ready);child.off('error',failed);child.off('exit',early);error?reject(error):resolve();};
   const ready=message=>finish(message==='ready'?null:Error('Unexpected synthetic fixture handshake.'));
   const failed=()=>finish(Error('Synthetic process could not start.'));
   const early=()=>finish(Error('Synthetic process exited before readiness.'));
   const timer=setTimeout(()=>finish(Error('Synthetic process readiness timeout.')),5000);
   child.once('message',ready);child.once('error',failed);child.once('exit',early);
  });
  if(!Number.isSafeInteger(child.pid)||child.pid<=0||child.pid===process.pid)throw Error('Invalid owned synthetic process PID.');
  monitor=makeMonitor({rootPid:child.pid});
  report.stage='startup';report.startup=await monitor.start();
  if(!fixtureLive())throw Error('Synthetic process failed during startup snapshot.');
  report.startup.includesFirstActualCimSnapshot=true;
  for(let i=0;i<4;i++){
   report.stage='steady-request';
   if(!fixtureLive())throw Error('Synthetic process exited during measurement.');
   const sample=await monitor.readRss();
   if(!fixtureLive())throw Error('Synthetic process failed during measurement.');
   report.samples.push({sample:i+1,...sample});
  }
  if(!fixtureLive())throw Error('Synthetic process failed before completion.');
  report.stage='complete';report.status='PASS';
 }catch{report.status='FAIL';report.failure='Persistent collector diagnostic failed; see sanitized category.';
 }finally{
  if(monitor){try{report.collectorCleanup=await monitor.close();report.diagnostic=monitor.diagnostics();if(!report.collectorCleanup.exitObserved||report.diagnostic.category)report.status='FAIL';}catch{report.collectorCleanup={exitObserved:false};report.diagnostic={category:'CLEANUP_ERROR'};report.status='FAIL';}}
  if(child&&Number.isSafeInteger(child.pid)&&child.pid>0){
   // Collector shutdown is asynchronous too: verify the fixture remained alive
   // through it before declaring our own IPC disconnect intentional.
   intentionalShutdown=Boolean(fixtureLive());if(!intentionalShutdown)report.status='FAIL';
   try{report.cleanup=await stopSyntheticProcess(child);report.cleanup.intentionalShutdown=intentionalShutdown;report.cleanup.expectedExitZero=intentionalShutdown&&!fixtureError&&child.exitCode===0&&!child.signalCode;if(report.cleanup.forced||!report.cleanup.expectedExitZero)report.status='FAIL';}catch{report.cleanup={exitObserved:false,intentionalShutdown,expectedExitZero:false};report.status='FAIL';}
   const signals=new Set(['SIGTERM','SIGKILL','SIGINT','SIGBREAK','SIGHUP']);
   report.fixtureDiagnostic={unexpectedError:fixtureError,unexpectedExit:fixtureExited,exitCode:Number.isSafeInteger(child.exitCode)?child.exitCode:null,signal:signals.has(child.signalCode)?child.signalCode:null};
  }
 }
 return report;
}
// Explicit opt-in WMI route; existing default and --persistent remain unchanged.
export async function runWmiWindowsMemorySmoke(options={}){
 const report=await runPersistentWindowsMemorySmoke({...options,makeMonitor:options.makeMonitor??createWindowsMemoryMonitorV2});
 report.protocol=3;report.scope='owned synthetic Node direct WMI collector only';report.collector='direct-wmi-v2';
 report.collectorMeasurementBudgetMs=10000+4*2000;
 report.collectorCleanupLimitMs=6000;
 report.fixtureReadinessLimitMs=5000;
 report.fixtureCleanupLimitMs=6000;
 // Configured phase bounds, not an observed scheduler/OS wall-clock guarantee.
 report.configuredPhaseBudgetMs=35000;
 if(report.startup){delete report.startup.includesFirstActualCimSnapshot;report.startup.includesFirstActualWmiSnapshot=true;}
 return report;
}
export function windowsMemorySmokeRoute(args){
 if(!Array.isArray(args)||args.length>1||args.length===1&&!['--persistent','--wmi'].includes(args[0]))throw Error('Invalid smoke arguments.');
 return args[0]==='--wmi'?runWmiWindowsMemorySmoke:args[0]==='--persistent'?runPersistentWindowsMemorySmoke:runWindowsMemorySmoke;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{const report=await windowsMemorySmokeRoute(process.argv.slice(2))();console.log(JSON.stringify(report,null,2));if(report.status!=='PASS')process.exitCode=1;}
 catch{console.log(JSON.stringify({status:'FAIL',failure:'Invalid smoke arguments.'}));process.exitCode=1;}
}
