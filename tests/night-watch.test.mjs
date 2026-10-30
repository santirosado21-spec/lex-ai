import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {existsSync,writeFileSync} from 'node:fs';
import {runNightWatch,runCommand} from '../scripts/night-watch.mjs';
import {publicMonitorStatus} from '../server/public-monitor.mjs';
import {discoverLegalRepos} from '../scripts/discover-legal-repos.mjs';
test('night monitor refuses duplicate worker, reports failure, skips stale frontend after failed build and releases own lock',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'lex-watch-'));const monitorDir=path.join(dir,'published');const outputDir=path.join(dir,'watch');let duplicateChecked=false;
 const result=await runNightWatch({maxCycles:1,outputDir,monitorDir,run:async(command,args)=>{
  if(!duplicateChecked){duplicateChecked=true;await assert.rejects(runNightWatch({maxCycles:1,outputDir,monitorDir,run:()=>{throw Error('must not run');}}),/bloqueo/);}
  return {ok:args[1]!=='build',exitCode:args[1]==='build'?1:0};
 }});
 assert.equal(result.state,'completed');assert.equal(result.lastCycle.ok,false);assert.equal(result.lastCycle.steps.find(s=>s.name==='frontend-smoke').skipped,true);
 await assert.rejects(readFile(path.join(outputDir,'lock/owner.json')),e=>e.code==='ENOENT');
 const published=JSON.parse(await readFile(path.join(monitorDir,'status.json'),'utf8'));assert.equal(published.monitor.cyclesCompleted,1);
});
test('subprocess timeout is failure, successful command is success',async()=>{
 assert.equal((await runCommand(process.execPath,['-e','process.exit(0)'],{timeoutMs:2000})).ok,true);
 const r=await runCommand(process.execPath,['-e','setInterval(()=>{},1000)'],{timeoutMs:100});assert.equal(r.ok,false);assert.equal(r.timedOut,true);
});
test('public source monitor marks old heartbeat unresponsive and absent monitor unconfigured',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'lex-status-'));const resourceDir=path.join(dir,'resources');await mkdir(resourceDir);await writeFile(path.join(resourceDir,'legal-sources.json'),'[]');await writeFile(path.join(resourceDir,'legal-corpus.json'),'[]');
 assert.equal((await publicMonitorStatus({monitorDir:dir,resourceDir})).monitor,null);
 await writeFile(path.join(dir,'status.json'),JSON.stringify({monitor:{state:'waiting',heartbeatAt:'2020-01-01T00:00:00Z'}}));
 const r=await publicMonitorStatus({monitorDir:dir,resourceDir});assert.equal(r.monitor.state,'unresponsive');assert.equal(r.monitor.stale,true);
});
test('cancellation kills ready descendants even when group leader exits on TERM',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'lex-watch-child-'));const pidFile=path.join(dir,'child.pid');
 const descendant=`require('node:fs').writeFileSync(process.argv[1],String(process.pid));process.on('SIGTERM',()=>{});setInterval(()=>{},1000);`;
 const launcher=`require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(descendant)},${JSON.stringify(pidFile)}],{stdio:'ignore'});process.on('SIGTERM',()=>process.exit(0));setInterval(()=>{},1000);`;
 const controller=new AbortController();
 const running=runCommand(process.execPath,['-e',launcher],{timeoutMs:15000,signal:controller.signal});
 let pid;try{const deadline=Date.now()+10000;while(Date.now()<deadline){try{pid=Number(await readFile(pidFile,'utf8'));break;}catch(e){if(e.code!=='ENOENT')throw e;}await new Promise(r=>setTimeout(r,50));}assert.ok(pid,'owned descendant must report ready before cancellation');}finally{controller.abort();}
 const result=await running;assert.equal(result.aborted,true);let alive=true;
 for(let i=0;i<20;i++){try{process.kill(pid,0);}catch(e){if(e.code==='ESRCH'){alive=false;break;}throw e;}await new Promise(r=>setTimeout(r,50));}
 assert.equal(alive,false,'owned descendant must not survive timeout');
});
test('repository discovery accepts only public valid names, keeps prior evidence on outage',async()=>{
 const outputDir=await mkdtemp(path.join(os.tmpdir(),'lex-repos-'));const fetchImpl=async()=>new Response(JSON.stringify({items:[{full_name:'owner/laws',private:false},{full_name:'private/laws',private:true},{full_name:'evil/../../host'}]}));
 const r=await discoverLegalRepos({outputDir,fetchImpl,delay:async()=>{}});assert.equal(r.repositories.length,1);assert.equal(r.authority,'discovery-only-not-authoritative');
 for(let i=0;i<2;i++){const fail=await discoverLegalRepos({outputDir,fetchImpl:async()=>new Response('',{status:429}),delay:async()=>{}});assert.equal(fail.state,'failed');assert.equal(fail.previousRepositories[0].name,'owner/laws');}
 const huge=await discoverLegalRepos({outputDir,fetchImpl:async()=>new Response('x'.repeat(512_001)),delay:async()=>{}});assert.equal(huge.state,'failed');assert.match(huge.errors[0].message,/grande/);
});
async function watchFixture(t){const dir=await mkdtemp(path.join(os.tmpdir(),'lex-watch-isolated-'));const {rm}=await import('node:fs/promises');t.after(()=>rm(dir,{recursive:true,force:true}));return {outputDir:path.join(dir,'watch'),monitorDir:path.join(dir,'public'),gpuLockPath:path.join(dir,'gpu.lock'),libraryStatusPath:path.join(dir,'library-status.json'),maxCycles:1,run:async()=>({ok:true,exitCode:0})};}
test('recent final library ingest is skipped for six hours without executing corpus command',async t=>{const options=await watchFixture(t);await writeFile(options.libraryStatusPath,JSON.stringify({state:'partial',finishedAt:new Date().toISOString()}));const calls=[];const status=await runNightWatch({...options,run:async(c,a)=>{calls.push(a);return {ok:true,exitCode:0};}});const step=status.lastCycle.steps.find(s=>s.name==='library-ingest');assert.equal(step.skipped,true);assert.ok(step.nextCheckAfter);assert.ok(!calls.some(a=>a.includes('scripts/corpus-ingest.mjs')));assert.match(status.lastCycle.warnings.join(' '),/no se publican/);});
test('due library stage uses bounded317/2GiB CLI and honors earlier monitor deadline',async t=>{const options=await watchFixture(t);await writeFile(options.libraryStatusPath,JSON.stringify({state:'complete',finishedAt:new Date(Date.now()-7*3600_000).toISOString()}));let observed;await runNightWatch({...options,hours:0.01,run:async(c,a,o)=>{if(a[0]==='scripts/corpus-ingest.mjs')observed={a,o};return {ok:true,exitCode:0};}});assert.deepEqual(observed.a,['scripts/corpus-ingest.mjs','--limit','317','--max-gib','2']);assert.ok(observed.o.timeoutMs<=36_000);assert.ok(observed.o.signal instanceof AbortSignal);const persisted=JSON.parse(await readFile(path.join(options.outputDir,'status.json')));assert.ok(persisted.libraryLastAttemptAt);});
test('library attempt spacing survives monitor restart even when child wrote no final status',async t=>{const options=await watchFixture(t);let count=0;const run=async(c,a)=>{if(a[0]==='scripts/corpus-ingest.mjs')count++;return {ok:true,exitCode:0};};await runNightWatch({...options,run});await runNightWatch({...options,run});assert.equal(count,1);});
test('occupied GPU is a successful skip and does not suppress later real inference for same corpus',async t=>{const options=await watchFixture(t);await writeFile(options.gpuLockPath,JSON.stringify({pid:999,mode:'synthetic-training'}));let clock=Date.now(),gemmaCalls=0,advanced=false;const {rm}=await import('node:fs/promises');const status=await runNightWatch({...options,maxCycles:2,intervalMinutes:1,realInference:true,now:()=>clock,sleep:async()=>{if(!advanced){const saved=JSON.parse(await readFile(path.join(options.outputDir,'status.json')));const first=saved.lastCycle.steps.find(s=>s.name==='gemma-real');assert.equal(first.skipped,true);assert.equal(first.ok,true);assert.equal(saved.consecutiveFailures,0);await rm(options.gpuLockPath);advanced=true;}clock+=61_000;},run:async(c,a)=>{if(a[0]==='scripts/e2e.mjs'){gemmaCalls++;const owner=JSON.parse(await readFile(options.gpuLockPath));assert.equal(owner.mode,'night-watch-gemma');assert.equal(owner.pid,process.pid);assert.ok(owner.id);}return {ok:true,exitCode:0};}});assert.equal(gemmaCalls,1);assert.equal(status.lastCycle.ok,true);await assert.rejects(readFile(options.gpuLockPath),e=>e.code==='ENOENT');});
test('GPU lock remains untouched if ownership changes during command',async t=>{const options=await watchFixture(t);const replacement={id:'different-owner',pid:888};await runNightWatch({...options,realInference:true,run:async(c,a)=>{if(a[0]==='scripts/e2e.mjs')await writeFile(options.gpuLockPath,JSON.stringify(replacement));return {ok:true,exitCode:0};}});assert.deepEqual(JSON.parse(await readFile(options.gpuLockPath)),replacement);});
test('GPU lock owned by monitor is released when injected command throws',async t=>{const options=await watchFixture(t);await assert.rejects(runNightWatch({...options,realInference:true,run:async(c,a)=>{if(a[0]==='scripts/e2e.mjs')throw new Error('synthetic command failure');return {ok:true,exitCode:0};}}),/synthetic command failure/);await assert.rejects(readFile(options.gpuLockPath),e=>e.code==='ENOENT');await assert.rejects(readFile(path.join(options.outputDir,'lock/owner.json')),e=>e.code==='ENOENT');});
test('occupied pipeline skips GPU without consuming corpus hash or recording failure, then retries after release',async t=>{
 const options=await watchFixture(t);const pipelineLockPath=path.join(path.dirname(options.gpuLockPath),'pipeline.lock');
 const owner={id:'runtime-pipeline-owner',pid:777,mode:'runtime-pipeline'};await writeFile(pipelineLockPath,JSON.stringify(owner));
 let clock=Date.now(),gemmaCalls=0,advanced=false;const {rm}=await import('node:fs/promises');
 const status=await runNightWatch({...options,maxCycles:2,intervalMinutes:1,realInference:true,now:()=>clock,sleep:async()=>{
  if(!advanced){
   const saved=JSON.parse(await readFile(path.join(options.outputDir,'status.json')));const step=saved.lastCycle.steps.find(s=>s.name==='gemma-real');
   assert.equal(step.skipped,true);assert.equal(step.ok,true);assert.match(step.reason,/Pipeline/);assert.equal(saved.consecutiveFailures,0);
   assert.deepEqual(JSON.parse(await readFile(pipelineLockPath)),owner);await assert.rejects(readFile(options.gpuLockPath),e=>e.code==='ENOENT');
   await rm(pipelineLockPath);advanced=true;
  }
  clock+=61_000;
 },run:async(c,a)=>{if(a[0]==='scripts/e2e.mjs')gemmaCalls++;return {ok:true,exitCode:0};}});
 assert.equal(gemmaCalls,1);assert.equal(status.consecutiveFailures,0);assert.equal(status.lastCycle.ok,true);
 await assert.rejects(readFile(options.gpuLockPath),e=>e.code==='ENOENT');
});
test('pipeline arriving between precheck and GPU claim is detected and releases only the monitor GPU reservation',async t=>{
 const options=await watchFixture(t);const pipelineLockPath=path.join(path.dirname(options.gpuLockPath),'custom-pipeline.lock');
 const owner={id:'arriving-runtime-pipeline',pid:778,mode:'runtime-pipeline'};const clock=Date.now();let injected=false,gemmaCalls=0;
 // now() is called to stamp the owner after open('wx') created gpu.lock.
 // Create the competing pipeline synchronously at that deterministic boundary.
 const now=()=>{if(!injected&&existsSync(options.gpuLockPath)){writeFileSync(pipelineLockPath,JSON.stringify(owner),{mode:0o600});injected=true;}return clock;};
 const status=await runNightWatch({...options,pipelineLockPath,realInference:true,now,run:async(c,a)=>{if(a[0]==='scripts/e2e.mjs')gemmaCalls++;return {ok:true,exitCode:0};}});
 assert.equal(injected,true);assert.equal(gemmaCalls,0);const step=status.lastCycle.steps.find(s=>s.name==='gemma-real');
 assert.equal(step.skipped,true);assert.equal(step.ok,true);assert.match(step.reason,/durante la reserva/);
 assert.equal(status.lastCycle.ok,true);assert.equal(status.consecutiveFailures,0);
 assert.deepEqual(JSON.parse(await readFile(pipelineLockPath)),owner);
 await assert.rejects(readFile(options.gpuLockPath),e=>e.code==='ENOENT');
});
