import {spawn} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {mkdir,readFile,writeFile,rename,rm,access,open} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {defaultMonitorDir} from '../server/public-monitor.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function json(file,fallback=null){try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
async function exists(file){try{await access(file);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
async function atomic(file,data){await writeFile(file+'.tmp',JSON.stringify(data,null,2)+'\n',{mode:0o600});await rename(file+'.tmp',file);}
export async function runCommand(command,args,{cwd=root,logFile,timeoutMs=600_000,signal}={}){
 const output=logFile?createWriteStream(logFile,{flags:'a',mode:0o600}):null;const startedAt=new Date().toISOString();let timedOut=false;
 return new Promise(resolve=>{
  const child=spawn(command,args,{cwd,env:{...process.env,LEX_TEST_MODE:'1'},stdio:['ignore','pipe','pipe'],detached:true});let settled=false;let killTimer;
  const stop=()=>{try{process.kill(-child.pid,'SIGTERM');}catch{}killTimer=setTimeout(()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}},3000);killTimer.unref();};
  const timer=setTimeout(()=>{timedOut=true;stop();},timeoutMs);timer.unref();const abort=()=>stop();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)stop();
  child.stdout.on('data',b=>output?.write(b));child.stderr.on('data',b=>output?.write(b));
  const finish=(code,error)=>{if(settled)return;settled=true;clearTimeout(timer);clearTimeout(killTimer);signal?.removeEventListener('abort',abort);if((timedOut||signal?.aborted)&&child.pid){try{process.kill(-child.pid,'SIGKILL');}catch{}}output?.end();resolve({command,args,startedAt,finishedAt:new Date().toISOString(),exitCode:code,timedOut,aborted:Boolean(signal?.aborted),error:error?.message||null,ok:code===0&&!timedOut&&!signal?.aborted});};
  child.once('error',e=>finish(null,e));child.once('close',code=>finish(code));
 });
}
export async function runNightWatch({hours=12,intervalMinutes=45,maxCycles=16,realInference=false,outputDir=path.join(root,'artifacts/night-watch'),monitorDir=defaultMonitorDir(),run=runCommand,gpuLockPath=path.join(root,'artifacts/training/gpu.lock'),pipelineLockPath=path.join(path.dirname(gpuLockPath),'pipeline.lock'),libraryStatusPath=path.join(root,'artifacts/legal-library/status.json'),now=Date.now,sleep=wait}={}){
 if(!Number.isFinite(hours)||hours<=0||hours>24||!Number.isFinite(intervalMinutes)||intervalMinutes<1||intervalMinutes>180||!Number.isInteger(maxCycles)||maxCycles<1||maxCycles>48)throw Error('Límites inválidos del monitor.');
 process.umask(0o077);await mkdir(outputDir,{recursive:true});await mkdir(monitorDir,{recursive:true});const lockDir=path.join(outputDir,'lock');const id=randomUUID();const priorWatch=await json(path.join(outputDir,'status.json'));
 try{await mkdir(lockDir);}catch(e){if(e.code==='EEXIST')throw Error('Ya existe un bloqueo del monitor. Comprueba status antes de recuperar un bloqueo obsoleto.');throw e;}
 try{await atomic(path.join(lockDir,'owner.json'),{id,pid:process.pid,startedAt:new Date().toISOString()});}catch(e){await rm(lockDir,{recursive:true});throw e;}
 const controller=new AbortController();const stop=()=>controller.abort();process.on('SIGTERM',stop);process.on('SIGINT',stop);
 const started=now(),deadline=started+hours*3600_000;
 const status={schemaVersion:1,id,pid:process.pid,state:'running',phase:'starting',startedAt:new Date(started).toISOString(),endsAt:new Date(deadline).toISOString(),heartbeatAt:new Date().toISOString(),nextRunAt:null,cyclesCompleted:0,consecutiveFailures:0,intervalMinutes,maxCycles,lastCycle:null,libraryLastAttemptAt:priorWatch?.libraryLastAttemptAt??null};
 let publishing=Promise.resolve();
 const publish=()=>{publishing=publishing.catch(()=>{}).then(async()=>{status.heartbeatAt=new Date().toISOString();await atomic(path.join(outputDir,'status.json'),status);const sync=await json(path.join(root,'artifacts/legal-sync/status.json'));const repositories=await json(path.join(root,'artifacts/legal-repositories/status.json'));await atomic(path.join(monitorDir,'status.json'),{monitor:status,sync,repositories});});return publishing;};
 const timer=setInterval(()=>{void (async()=>{try{await access(path.join(outputDir,'STOP'));controller.abort();}catch{}if(now()>=deadline)controller.abort();await publish();})().catch(e=>{console.error(e.message);controller.abort();});},5000);
 let lastInferenceHash=null;
 try{
  await publish();
  while(!controller.signal.aborted&&now()<deadline&&status.cyclesCompleted<maxCycles){
   const index=status.cyclesCompleted+1,dir=path.join(outputDir,'runs',id,`cycle-${String(index).padStart(2,'0')}`);await mkdir(dir,{recursive:true});
   const cycle={index,startedAt:new Date().toISOString(),steps:[],ok:true,warnings:[]};status.state='running';status.nextRunAt=null;status.lastCycle=cycle;
   const steps=[['legal-sync',process.execPath,['scripts/legal-sync.mjs','--once'],12*60_000],['library-ingest',process.execPath,['scripts/corpus-ingest.mjs','--limit','317','--max-gib','2'],45*60_000],['repositories',process.execPath,['scripts/discover-legal-repos.mjs'],90_000],['backend',process.execPath,['--test','tests/*.test.mjs'],180_000],['frontend-build','npm',['run','build'],180_000],['frontend-smoke',process.execPath,['scripts/ui-smoke.mjs'],180_000]];
   const corpusHash=createHash('sha256').update(await readFile(path.join(root,'resources/legal-corpus.json'))).digest('hex');
   if(realInference&&corpusHash!==lastInferenceHash)steps.push(['gemma-real',process.execPath,['scripts/e2e.mjs'],600_000]);
   for(const [name,command,args,timeoutMs] of steps){
    if(controller.signal.aborted||now()>=deadline)break;status.phase=name;await publish();
    if(name==='library-ingest'){
     const previous=await json(libraryStatusPath);const finished=previous&&['complete','partial','failed'].includes(previous.state)?Date.parse(previous.finishedAt):NaN;const attempted=Date.parse(status.libraryLastAttemptAt);const last=Math.max(Number.isFinite(finished)?finished:0,Number.isFinite(attempted)?attempted:0);
     if(last&&now()<last+6*3600_000){cycle.steps.push({name,ok:true,skipped:true,reason:'La biblioteca se revisa como máximo una vez cada seis horas.',nextCheckAfter:new Date(last+6*3600_000).toISOString()});if(previous?.state==='partial'||previous?.state==='failed')cycle.warnings.push('La última ingesta de biblioteca requiere revisión; las extracciones no se publican automáticamente.');continue;}
     if(previous?.state==='running'&&Date.parse(previous.startedAt)>now()-45*60_000){cycle.steps.push({name,ok:true,skipped:true,reason:'Ya hay una ingesta de biblioteca reciente en ejecución.'});continue;}
    }
    if(name==='legal-sync'||name==='repositories'){
     const previous=await json(path.join(root,name==='legal-sync'?'artifacts/legal-sync/status.json':'artifacts/legal-repositories/status.json'));
     if(previous?.nextCheckAfter&&Date.parse(previous.nextCheckAfter)>now()&&previous.state!=='failed'){
      cycle.steps.push({name,ok:true,skipped:true,reason:'La próxima consulta de la fuente todavía no vence.',nextCheckAfter:previous.nextCheckAfter});
      if(name==='legal-sync'&&previous.state==='partial')cycle.warnings.push('La última consulta de fuentes fue parcial; se conserva el error hasta la próxima comprobación.');
      continue;
     }
    }
    // A failed build must never be masked by a successful test against an old dist.
    if(name==='frontend-smoke'&&cycle.steps.some(s=>s.name==='frontend-build'&&!s.ok)){cycle.steps.push({name,ok:false,skipped:true,reason:'frontend-build failed'});cycle.ok=false;continue;}
    let gpuOwner=null;
    if(name==='gemma-real'){
     if(await exists(pipelineLockPath)){cycle.steps.push({name,ok:true,skipped:true,reason:'Pipeline de validación del modelo en ejecución; se reintentará en otro ciclo.'});continue;}
     await mkdir(path.dirname(gpuLockPath),{recursive:true});let handle;
     try{handle=await open(gpuLockPath,'wx',0o600);}catch(e){if(e.code==='EEXIST'){cycle.steps.push({name,ok:true,skipped:true,reason:'GPU ocupada por entrenamiento o evaluación; se reintentará en otro ciclo.'});continue;}throw e;}
     gpuOwner=randomUUID();try{await handle.writeFile(JSON.stringify({id:gpuOwner,pid:process.pid,startedAt:new Date(now()).toISOString(),mode:'night-watch-gemma',monitorId:id}));}finally{await handle.close();}
    }
    let result;
    try{
     // A pipeline may have claimed its lock after our first check. Recheck
     // after acquiring gpu.lock; finally releases only this monitor's claim.
     if(name==='gemma-real'&&await exists(pipelineLockPath)){cycle.steps.push({name,ok:true,skipped:true,reason:'El pipeline de validación adquirió su bloqueo durante la reserva de GPU; se reintentará en otro ciclo.'});continue;}
     if(controller.signal.aborted||now()>=deadline)break;
     if(name==='library-ingest'){status.libraryLastAttemptAt=new Date(now()).toISOString();await publish();}
     result=await run(command,args,{cwd:root,logFile:path.join(dir,name+'.log'),timeoutMs:Math.min(timeoutMs,Math.max(1,deadline-now())),signal:controller.signal});
    }finally{if(gpuOwner){const owner=await json(gpuLockPath);if(owner?.id===gpuOwner)await rm(gpuLockPath);}}
    cycle.steps.push({name,...result});if(!result.ok)cycle.ok=false;
    if(name==='gemma-real'&&result.ok)lastInferenceHash=corpusHash;
    if(name==='legal-sync'){const sync=await json(path.join(root,'artifacts/legal-sync/status.json'));if(sync?.state==='partial')cycle.warnings.push('Una o más fuentes públicas no pudieron comprobarse; consultar errores por fuente.');}
    await atomic(path.join(dir,'result.json'),cycle);
   }
   cycle.finishedAt=new Date().toISOString();cycle.aborted=controller.signal.aborted;if(cycle.aborted)cycle.ok=false;
   await atomic(path.join(dir,'result.json'),cycle);status.cyclesCompleted++;status.consecutiveFailures=cycle.ok?0:status.consecutiveFailures+1;
   if(controller.signal.aborted)break;
   const delay=intervalMinutes*60_000*Math.min(4,2**Math.min(status.consecutiveFailures,2));status.state='waiting';status.phase=cycle.ok?(cycle.warnings.length?'sources-partial':'healthy'):'degraded';status.nextRunAt=new Date(Math.min(now()+delay,deadline)).toISOString();await publish();
   if(status.cyclesCompleted>=maxCycles)break;
   while(!controller.signal.aborted&&now()<Date.parse(status.nextRunAt))await sleep(1000);
  }
  status.state=controller.signal.aborted&&now()<deadline?'stopped':'completed';status.phase='finished';status.finishedAt=new Date().toISOString();status.nextRunAt=null;await publish();
 }catch(e){status.state='failed';status.phase='error';status.error=e.message;status.finishedAt=new Date().toISOString();await publish();throw e;}
 finally{clearInterval(timer);process.off('SIGTERM',stop);process.off('SIGINT',stop);try{await publishing;}finally{const owner=await json(path.join(lockDir,'owner.json'));if(owner?.id===id)await rm(lockDir,{recursive:true});}}
 return status;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i>=0?Number(process.argv[i+1]):fallback;};
 try{const result=await runNightWatch({hours:arg('--hours',12),intervalMinutes:arg('--interval',45),maxCycles:arg('--cycles',16),realInference:process.argv.includes('--real-inference')});console.log(JSON.stringify(result));}catch(e){console.error(e.message);process.exitCode=1;}
}
