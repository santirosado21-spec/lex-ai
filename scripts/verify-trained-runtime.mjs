/** Import and verify an experimental checkpoint in an owned, isolated local runtime. */
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {readFile,writeFile,mkdir,mkdtemp,access,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createService} from '../server/service.mjs';
import {openPublicLibrary} from '../server/public-library.mjs';
import {sha256} from '../server/inference.mjs';

const root=path.resolve('.');
const candidate=path.resolve(process.argv[2]||'artifacts/training/lex-gemma4-candidate-v2');
const adapter=path.resolve(process.argv[3]||'artifacts/training/lex-gemma4-lora-v2');
const runtime=path.resolve('src-tauri/target/release/bundle/macos/LEX AI.app/Contents/Resources/app/resources/runtime/ollama');
const model=process.argv[4]||'lex-gemma4-experimental:v2';
const probeOnly=process.argv.includes('--probe');
const e2eOnly=process.argv.includes('--e2e-only');
const unconstrained=process.argv.includes('--unconstrained');
assert.match(model,/^lex-gemma4-experimental:v[0-9]+(?:-r[0-9]+)?$/);
const runDir=path.resolve('artifacts/training/runtime-'+model.split(':')[1]);await mkdir(runDir,{recursive:true});
const store=path.join(runDir,'models');await mkdir(store,{recursive:true});
const dataDir=await mkdtemp(path.join(os.tmpdir(),'lex-trained-runtime-'));
await access(runtime);await access(path.join(candidate,'export-manifest.json'));
const exportManifest=JSON.parse(await readFile(path.join(candidate,'export-manifest.json'),'utf8'));
const exportDigest=(await readFile(path.join(candidate,'export-manifest.sha256'),'utf8')).split(/\s+/)[0];
assert.equal(await sha256(path.join(candidate,'export-manifest.json')),exportDigest,'Export manifest integrity');
for(const entry of exportManifest.files){
 assert.equal(path.basename(entry.file),entry.file,'Export path must be a direct child');
 assert.equal(await sha256(path.join(candidate,entry.file)),entry.sha256,`Export integrity: ${entry.file}`);
}
const portServer=createServer();await new Promise((resolve,reject)=>{portServer.once('error',reject);portServer.listen(0,'127.0.0.1',resolve);});
const port=portServer.address().port;await new Promise(resolve=>portServer.close(resolve));
const endpoint=`http://127.0.0.1:${port}`;
const env={PATH:'/usr/bin:/bin',HOME:dataDir,TMPDIR:os.tmpdir(),OLLAMA_HOST:`127.0.0.1:${port}`,OLLAMA_MODELS:store,OLLAMA_NO_CLOUD:'1',OLLAMA_MAX_LOADED_MODELS:'1',OLLAMA_NUM_PARALLEL:'1',OLLAMA_CONTEXT_LENGTH:'8192',OLLAMA_KEEP_ALIVE:'0',DYLD_LIBRARY_PATH:path.dirname(runtime)};
const report={startedAt:new Date().toISOString(),mode:'real-trained-imported-local-runtime',experimental:true,privateData:false,model,exportManifestSha256:exportDigest,runtimeSha256:await sha256(runtime),memoryPolicy:'Unload after every request; avoid accumulating MLX prefix-cache snapshots on 24 GB hardware.',checks:['export manifest and every exported file SHA256 verified']};
report.applicationDecoding={schemaConstrained:!unconstrained,maxOutputTokens:unconstrained?512:1600,postGenerationCitationValidation:true};
let library,service;
const pipelineLock=path.resolve('artifacts/training/pipeline.lock'),pipelineId=randomUUID();
await writeFile(pipelineLock,JSON.stringify({id:pipelineId,pid:process.pid,mode:'runtime-pipeline',startedAt:new Date().toISOString()}),{flag:'wx',mode:0o600});
try{await access(path.resolve('artifacts/training/gpu.lock'));await unlink(pipelineLock);throw Error('GPU is occupied; retry after its owner finishes.');}catch(error){if(error.code!=='ENOENT'){try{const owner=JSON.parse(await readFile(pipelineLock,'utf8'));if(owner.id===pipelineId)await unlink(pipelineLock);}catch{}throw error;}}
const owned=spawn(runtime,['serve'],{env,stdio:['ignore','ignore','pipe']});
let spawnError;owned.on('error',error=>{spawnError=error;});
let runtimeErrors='',runtimePending='';
report.runtimeMemory={source:'Ollama MLX runtime log; not whole-system memory',peakGiB:null,samples:0,unloadEvents:0};
owned.stderr.on('data',chunk=>{
 const text=chunk.toString();runtimeErrors=(runtimeErrors+text).slice(-12000);runtimePending+=text;
 let end;while((end=runtimePending.indexOf('\n'))>=0){const line=runtimePending.slice(0,end);runtimePending=runtimePending.slice(end+1);const peak=line.match(/memory peak="([0-9.]+) GiB"/);if(peak){report.runtimeMemory.samples++;report.runtimeMemory.peakGiB=Math.max(report.runtimeMemory.peakGiB??0,Number(peak[1]));}if(line.includes('stopping mlx runner subprocess'))report.runtimeMemory.unloadEvents++;}
});
const run=async(command,args,childEnv,timeout)=>new Promise((resolve,reject)=>{
 const child=spawn(command,args,{cwd:root,env:childEnv,stdio:['ignore','pipe','pipe']});let output='';
 child.stdout.on('data',b=>{output+=b;});child.stderr.on('data',b=>{output+=b;});
 const timer=setTimeout(()=>{child.kill('SIGTERM');setTimeout(()=>child.kill('SIGKILL'),3000).unref();},timeout);
 child.once('error',error=>{clearTimeout(timer);reject(error);});
 child.once('close',code=>{clearTimeout(timer);resolve({code,output});});
});
const request=async(route,body,timeout=300000)=>{
 const response=await fetch(endpoint+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(timeout)});
 if(!response.ok)throw Error(`Runtime ${route}: ${response.status} ${(await response.text()).slice(0,500)}`);
 return response;
};
try{
 let ready=false;
 for(let i=0;i<100;i++){if(spawnError)throw spawnError;if(owned.exitCode!==null)throw Error('Owned runtime exited at startup');try{report.runtime=await(await request('/api/version',null,1000)).json();ready=true;break;}catch{await new Promise(r=>setTimeout(r,200));}}
 assert.ok(ready,'Runtime startup timeout');
 const imported=await run(runtime,['create',model,'-f',path.join(candidate,'Modelfile')],env,600000);
 await writeFile(path.join(runDir,'import.log'),imported.output);assert.equal(imported.code,0,'Model import failed; see import.log');
 report.checks.push('exported fused checkpoint imported in isolated model store');
 const shown=await(await request('/api/show',{model})).json();
 report.modelDetails=shown.details;report.modelInfo=shown.model_info;
 if(probeOnly){
  const reference=JSON.parse(await readFile(path.join(adapter,'behavior-candidate.json'),'utf8')).cases[0];
  const row=(await readFile(path.join(adapter,'effective-test.jsonl'),'utf8')).trim().split('\n').map(line=>JSON.parse(line)).find(row=>row.metadata.id===reference.id);
  const response=await(await request('/api/chat',{model,messages:row.messages.slice(0,-1),think:false,stream:false,options:{temperature:0,num_predict:384}})).json();
  report.probe={caseId:reference.id,raw:response.message?.content,promptTokens:response.prompt_eval_count};
  const parsed=JSON.parse(report.probe.raw);report.probe.identicalToAdapter=JSON.stringify(parsed)===JSON.stringify(JSON.parse(reference.raw));
  report.status='PROBE_COMPLETED';
 }else{
 if(!e2eOnly){
  const evaluation=await run(path.resolve('.venv-training/bin/python'),['-u','scripts/evaluate-legal-adapter.py','--adapter',adapter,'--mode','imported','--endpoint',endpoint,'--model-name',model,'--per-task','8'],{...env,HF_HUB_OFFLINE:'1',HF_HUB_DISABLE_TELEMETRY:'1'},1800000);
  await writeFile(path.join(runDir,'behavior-imported.log'),evaluation.output);assert.equal(evaluation.code,0,'Imported behavioral evaluation failed; see behavior-imported.log');
 }
 const behavior=JSON.parse(await readFile(path.join(adapter,'behavior-imported.json'),'utf8'));report.behavior=behavior.gate||behavior.gates;
 report.importedBehaviorSha256=await sha256(path.join(adapter,'behavior-imported.json'));
 report.importedModelDigest=behavior.runtime?.modelDigest;
 const currentTag=(await(await request('/api/tags')).json()).models.find(entry=>entry.name===model);
 assert.equal(currentTag?.digest,report.importedModelDigest,'Behavioral report must match the exact installed model digest');
 report.behavioralEvidenceReused=e2eOnly;
 report.technicalGatePassed=report.behavior?.passed===true;
 const inference={async *generate(messages,{outputSchema,signal}={}){
  const response=await request('/api/chat',{model,messages,think:false,stream:false,...(unconstrained?{}:{format:outputSchema}),options:{temperature:0,num_ctx:8192,num_predict:unconstrained?512:1600}});
  const result=await response.json();if(result.error)throw Error(result.error);
  await writeFile(path.join(runDir,'candidate-synthetic-trace.json'),JSON.stringify({messages,outputSchema,raw:result.message?.content,doneReason:result.done_reason},null,2)+'\n');
  if(result.done_reason==='length')throw Error('Candidate response exceeded token budget');
  if(signal?.aborted)throw Error('Aborted');yield result.message.content;
 }};
 library=await openPublicLibrary(path.resolve('resources/public-library.sqlite'));
 service=await createService({dataDir,corpusPath:path.resolve('resources/legal-corpus.json'),inference,publicLibrary:library});
 await service.dispatch('workspace.create',{name:'Despacho sintético de evaluación del candidato',practiceAreas:['Civil','Comercial']});
 const matter=await service.dispatch('matter.create',{title:'Contrato sintético del candidato',client:'Cliente sintético',jurisdiction:'MX-FED'});
 await service.dispatch('document.import',{matterId:matter.id,name:'contrato-sintetico.txt',base64:(await readFile('fixtures/contrato-servicios.txt')).toString('base64')});
 const answer=await service.analyze({matterId:matter.id,skillId:'contract-reviewer',question:'Contrasta la cláusula de modificación unilateral del contrato con el artículo 1797 del Código Civil Federal. Cita un pasaje del contrato y un pasaje de la ley aportada, sin afirmar vigencia actual.'});
 assert.ok(answer.validation.citationIntegrity);assert.ok(answer.citations.some(c=>c.url));assert.ok(answer.citations.some(c=>c.category==='internal-firm-document'));
 const exported=await service.dispatch('answer.export',{matterId:matter.id,answerId:answer.id});const bytes=Buffer.from(exported.base64,'base64');assert.equal(bytes.subarray(0,2).toString(),'PK');
 await writeFile(path.join(runDir,'candidate-synthetic-analysis.docx'),bytes);
 report.answer={elapsedMs:answer.elapsedMs,citations:answer.citations,validation:answer.validation};
 report.checks.push('real candidate contract + federal library retrieval + citation validation + DOCX');report.status=report.technicalGatePassed?'PASS':'COMPATIBLE_BUT_REJECTED';
 if(!report.technicalGatePassed)process.exitCode=1;
 }
}catch(error){report.status='FAIL';report.error=error.message;process.exitCode=1;}
finally{
 service?.close();library?.close();
 try{await request('/api/generate',{model,keep_alive:0},10000);}catch{}
 if(owned.exitCode===null){owned.kill('SIGTERM');await Promise.race([new Promise(resolve=>owned.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,3000))]);if(owned.exitCode===null)owned.kill('SIGKILL');}
 report.finishedAt=new Date().toISOString();await writeFile(path.join(runDir,probeOnly?'probe.json':'verification.json'),JSON.stringify(report,null,2)+'\n');
 if(report.status!=='PASS')await writeFile(path.join(runDir,'runtime-error.log'),runtimeErrors);
 try{const owner=JSON.parse(await readFile(pipelineLock,'utf8'));if(owner.id===pipelineId)await unlink(pipelineLock);}catch(error){if(error.code!=='ENOENT')throw error;}
 console.log(JSON.stringify(report,null,2));
}
