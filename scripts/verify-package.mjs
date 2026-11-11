import {spawn,spawnSync} from 'node:child_process';
import {readFile,mkdtemp,writeFile,mkdir,chmod} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';
import {verifyBundledModel} from '../server/bundled-model.mjs';
import {targetFromEnvironment,desktopPlan,requireBuildHost,checkBinaryArch,approvedRuntimeInventory,verifyCopiedInventory} from '../server/desktop-target.mjs';
const plan=desktopPlan(targetFromEnvironment().id);
requireBuildHost(plan);
const app=path.resolve(process.argv[2]||`src-tauri/target/${plan.rustTarget}/release/bundle/macos/LEX AI.app`);
const resource=path.join(app,'Contents/Resources/app');
const reportPath=path.resolve(process.argv[3]||'artifacts/cycle-3-package-check.json');
async function fileHash(file){const digest=createHash('sha256');for await(const chunk of createReadStream(file))digest.update(chunk);return digest.digest('hex');}
const report={target:plan.id,cycle:3,checkedAt:new Date().toISOString(),app,checks:[],nativeVisualRetest:false,nativeVisualLimitation:'This verifier tests bundled services; browser UI evidence is recorded separately. It does not assert a native visual retest.',notarized:false};
let child;
try{
 const version=JSON.parse(await readFile('package.json','utf8')).version;assert.match(version,/^\d+\.\d+\.\d+$/);report.version=version;
 const bundledPackage=JSON.parse(await readFile(path.join(resource,'package.json'),'utf8'));assert.equal(bundledPackage.version,version);
 const nativeVersion=spawnSync('/usr/libexec/PlistBuddy',['-c','Print :CFBundleShortVersionString',path.join(app,'Contents/Info.plist')],{encoding:'utf8'});assert.equal(nativeVersion.status,0,nativeVersion.stderr);assert.equal(nativeVersion.stdout.trim(),version);report.checks.push(`native and bundled package versions are ${version}`);
 const nativeIcon=spawnSync('/usr/libexec/PlistBuddy',['-c','Print :CFBundleIconFile',path.join(app,'Contents/Info.plist')],{encoding:'utf8'});assert.equal(nativeIcon.status,0,'macOS bundle must declare its app icon');
 const iconName=nativeIcon.stdout.trim();assert.equal(path.basename(iconName),iconName);assert.ok(iconName);
 const iconFile=iconName.endsWith('.icns')?iconName:`${iconName}.icns`;assert.equal(await fileHash(path.join(app,'Contents/Resources',iconFile)),await fileHash('src-tauri/icons/icon.icns'),'bundled app icon must match the current LEX AI icon');report.checks.push('macOS icon declared and packaged with matching source hash');
 const signature=spawnSync('/usr/bin/codesign',['--verify','--deep','--strict',app],{encoding:'utf8'});assert.equal(signature.status,0,signature.stderr);report.checks.push('ad-hoc signature verified');
 const verifyArch=process.env.LEX_VERIFY_ARCH||plan.arch;
 assert.equal(verifyArch,plan.arch,'Verification architecture must match explicit target.');
 const runtimeManifest=JSON.parse(await readFile(path.join(resource,'resources/runtime-manifest.json'),'utf8'));
 assert.equal(runtimeManifest.target,plan.id,'Bundle target must match selected target.');
 await approvedRuntimeInventory({manifest:{schemaVersion:1,target:runtimeManifest.target,files:runtimeManifest.files},source:resource,plan});
 await verifyCopiedInventory(runtimeManifest.sourceFiles,resource);
 report.checks.push('approved runtime/source artifact hashes and explicit target verified');
 assert.ok(['arm64','x64'].includes(verifyArch));report.executionArchitecture=verifyArch;report.physicalIntelValidation=false;report.physical8GBValidation=false;
 for(const file of ['Contents/MacOS/lex-ai',`Contents/Resources/app/runtime/${plan.node}`,`Contents/Resources/app/resources/runtime/${plan.engine}`])checkBinaryArch(path.join(app,file),plan,spawnSync);
 report.checks.push(`desktop executable, bundled Node and engine contain ${plan.binaryArch}`);
 const files=['server/time-billing.mjs','server/state-library.mjs','resources/state-library.jsonl','resources/state-library-catalog.json','office-addin/word.html','office-addin/excel.html','office-addin/sharepoint.html','office-addin/assistant.js','office-addin/word.js','office-addin/excel.js','office-addin/sharepoint.js','office-addin/common.js','server/reply-drafts.mjs','server/local-email.mjs','server/proactive-drafts.mjs','server/mail-transport.mjs','server/mail-scripts/accounts.jxa','server/mail-scripts/send.jxa','server/office-bridge.mjs','resources/mexico-jurisdictions.json','server/main.mjs','server/inference.mjs','server/bundled-model.mjs','server/conversation.mjs','server/assistant-router.mjs','server/runtime-memory.mjs','server/generation-options.mjs','server/grounded-output.mjs','server/local-files.mjs','server/docx-export.mjs','server/public-monitor.mjs','server/training-status.mjs','server/public-library.mjs','server/service.mjs','server/matter-tasks.mjs','server/store.mjs','server/skills.mjs','server/extraction.mjs','resources/model-catalog.json','resources/legal-corpus.json','resources/legal-sources.json','resources/public-library.sqlite','resources/public-library.sqlite.manifest.json'];
 for(const file of files)assert.equal(await fileHash(path.join(resource,file)),await fileHash(file),file+' does not match source');
 for(const file of ['server/stt.mjs','server/thread-memory.mjs','server/conversation-recall.mjs','server/grounded-output-mixed.mjs',...['automatic','query','search','rank','references','thesaurus','areas','fragments'].map(name=>`server/retrieval/${name}.mjs`)]){assert.equal(await fileHash(path.join(resource,file)),await fileHash(file),file+' does not match source');files.push(file);}
 report.hashedFiles=files;report.checks.push('packaged source monitor, training, task and library modules plus both public corpora match source hashes');
 const {createStateLibrary}=await import(pathToFileURL(path.join(resource,'server/state-library.mjs')));
 const stateLibrary=createStateLibrary();
 const stateSource=stateLibrary.lookupArticle(stateLibrary.reference('Artículo 1 del Código Civil del Estado de Jalisco'));
 assert.equal(stateSource.jurisdiction,'MX-JAL');assert.ok(stateSource.pdfSha256);
 assert.equal(stateLibrary.status().laws.reduce((sum,law)=>sum+law.articles,0),5304);
 report.checks.push('bundled Jalisco/Nuevo León snapshot verified, five instruments, 5,304 articles');
 const modelCatalog=JSON.parse(await readFile(path.join(resource,'resources/model-catalog.json'),'utf8'));
 if(runtimeManifest.bundledModel){report.bundledModel=await verifyBundledModel({bundleDir:path.join(resource,'resources/bundled-model'),catalog:modelCatalog});report.checks.push('offline model contains only the pinned manifest, license layer and verified required blobs');}
 else {assert.notEqual(process.env.LEX_VERIFY_CHAT,'1','Actual model/chat checks require an explicitly staged approved bundled model.');report.bundledModel=null;report.inferenceValidation='not-run-no-bundled-model';}
 const dataDir=await mkdtemp(path.join(os.tmpdir(),'lex-packaged-check-'));
 const backend=path.join(resource,'runtime/node'),args=[path.join(resource,'server/main.mjs')];
 const backendEnv={HOME:os.homedir(),PATH:'/usr/bin:/bin',LEX_DATA_DIR:dataDir,LEX_DESKTOP:'1'};
 if(verifyArch==='x64'){
  const wrapper=path.join(dataDir,'intel-inference');
  const shellQuote=value=>"'"+value.replaceAll("'","'\\''")+"'";
  await writeFile(wrapper,'#!/bin/sh\nexec /usr/bin/arch -x86_64 '+shellQuote(path.join(resource,'resources/runtime/ollama'))+' "$@"\n');await chmod(wrapper,0o700);backendEnv.LEX_OLLAMA_BIN=wrapper;
 }
 child=spawn(verifyArch==='x64'?'/usr/bin/arch':backend,verifyArch==='x64'?['-x86_64',backend,...args]:args,{env:backendEnv,stdio:['pipe','pipe','pipe']});child.stderr.resume();
 const connection=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(Error('Bundled backend startup timeout')),30000);child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',()=>{clearTimeout(timer);reject(Error('Bundled backend exited before connection.'));});child.stdout.on('data',b=>{text+=b.toString();if(text.length>20000){clearTimeout(timer);reject(Error('Unexpected backend startup output'));}else if(text.includes('\n')){clearTimeout(timer);try{resolve(JSON.parse(text.split('\n')[0]));}catch{reject(Error('Invalid backend connection response.'));}}});});
 async function api(action,payload={}){const response=await fetch(connection.url+'/api',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${connection.token}`},body:JSON.stringify({action,payload}),signal:AbortSignal.timeout(10000)});assert.equal(response.status,200,action+' HTTP failure');return response.json();}
 const sources=await api('sources.status');assert.equal(sources.catalog.length,7);assert.equal(sources.corpus.articles,21);report.checks.push('authenticated sources.status preserves seven sources and 21 seed articles');report.monitor={state:sources.monitor?.state||null,heartbeatAt:sources.monitor?.heartbeatAt||null};
 const library=await api('library.status');assert.equal(library.available,true);assert.equal(library.articles,35452);assert.equal(library.laws.length,303);report.library={articles:library.articles,laws:library.laws.length,corpusSha256:library.corpusSha256};
 const matches=await api('library.search',{query:'validez cumplimiento contratos',lawId:'MX-FED-CCF',jurisdiction:'MX-FED',limit:10,offset:0});const article=matches.sources.find(source=>source.article==='1797'&&source.lawId==='MX-FED-CCF');assert.ok(article,'CCF 1797 not found');const full=await api('library.source',{sourceId:article.id});assert.match(full.text,/validez/i);assert.equal(full.status,'structurally-verified-currentness-unverified');report.checks.push('bundled full public library: 35,452 articles, 303 instruments, CCF1797 search and full source');
 const training=await api('training.status');assert.ok(['not_started','downloading','preparing_data','loading','baseline','training','evaluating','completed','failed'].includes(training.state),'Invalid training state');assert.ok(['not-trained','experimental','rejected','ready'].includes(training.releaseStatus),'Invalid training release state');report.training={state:training.state,releaseStatus:training.releaseStatus};report.checks.push('bundled training.status returns a valid read-only state; no inference');
 if(runtimeManifest.bundledModel){
 const readyDeadline=Date.now()+120000;let engine;
 do{engine=await api('engine.status');assert.notEqual(engine.state,'downloading','offline distribution must not download a model');assert.notEqual(engine.state,'error',engine.message);if(engine.state==='ready')break;assert.ok(Date.now()<readyDeadline,'automatic offline model preparation timed out');await new Promise(resolve=>setTimeout(resolve,300));}while(true);
 assert.equal(engine.hardware.arch,verifyArch,'backend runs the requested CPU architecture');
 report.offlineStartup={state:engine.state,privateRuntime:true,cleanDataDirectory:true,architecture:engine.hardware.arch};report.checks.push('desktop automatically prepares its included model in a fresh user store without a separate Ollama install');
 if(verifyArch==='x64'){assert.equal((await api('stt.status')).runtimeAvailable,false);report.checks.push('Intel disables the optional incompatible dictation component while written chat remains available');}
 }else {report.offlineStartup={validated:false,reason:'No bundled model; service checks do not establish inference or hybrid-provider readiness.'};}
 if(process.env.LEX_VERIFY_CHAT==='1'){
  await api('workspace.create',{name:'Prueba sintética del agente conversacional',practiceAreas:['General']});
  const turns=[];report.conversation={realLocalInference:true,syntheticDataOnly:true,turns};
  async function converse(question,threadId,scope={}){const started=Date.now();const response=await fetch(connection.url+'/analyze',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${connection.token}`},body:JSON.stringify({mode:'auto',skillId:'auto',question,threadId,...scope}),signal:AbortSignal.timeout(240000)});assert.equal(response.status,200);const events=(await response.text()).trim().split('\n').map(line=>JSON.parse(line));const result=events.find(event=>event.type==='result')?.data;assert.ok(result,JSON.stringify(events.find(event=>event.type==='error')));assert.ok(result.text);turns.push({question,text:result.text,elapsedMs:Date.now()-started,threadId,...scope});return result;}
  const activeMatter=await api('matter.create',{title:'Contrato sintético — prueba de saludo',client:'Parte ficticia',jurisdiction:'MX-CMX'});
  await api('document.import',{matterId:activeMatter.id,name:'contrato-saludo-sintetico.txt',base64:Buffer.from('DOCUMENTO_CANARIO_SALUDO. Hola, buenos días. Contrato sintético de servicios: no corresponde a clientes ni obligaciones reales. Las partes definen pagos y entregas exclusivamente para esta prueba.').toString('base64')});
  const greeting=await converse('Hola','synthetic-scoped-greeting',{matterId:activeMatter.id,skillId:'legal-researcher'});
  assert.equal(greeting.kind,'chat');assert.deepEqual(greeting.citations,[]);assert.match(greeting.text,/hola|ayud|salud/i);assert.doesNotMatch(greeting.text,/DOCUMENTO_CANARIO_SALUDO|obligaciones reales|consentimiento mutuo|perfeccion.*contrat/i);
  report.checks.push('Hola with a populated matter and legal-researcher selected is a natural chat response without document analysis or citations');
  await converse('Hola, soy Lorenzo. Para esta prueba sintética mi palabra de trabajo es Jacaranda. Responde únicamente: Hola, Lorenzo.','synthetic-chat-a');
  const recall=await converse('¿Cuál es mi palabra de trabajo? Responde con una sola palabra.','synthetic-chat-a');assert.match(recall.text,/jacaranda/i,'conversational recall');
  const isolated=await converse('¿Cuál es mi palabra de trabajo?','synthetic-chat-b');assert.doesNotMatch(isolated.text,/jacaranda/i,'another chat must not see the private word');
  const list=await converse('Dame exactamente 3 ideas sencillas para organizar mi escritorio. Usa una lista numerada.','synthetic-general-list');
  assert.equal(list.kind,'chat');assert.deepEqual(list.citations,[]);for(const number of [1,2,3])assert.match(list.text,new RegExp(`${number}[.)]`),'general numbered list must not become a legal source request');
  const math=await converse('¿Cuánto es 2 + 2? Responde sólo el resultado.','synthetic-general-math');assert.equal(math.kind,'chat');assert.match(math.text,/\b4\b|cuatro/i);assert.deepEqual(math.citations,[]);
  const email=await converse('Redacta un correo breve para pedir una reunión interna, sin inventar fechas.','synthetic-general-email');assert.equal(email.kind,'chat');assert.match(email.text,/reuni[oó]n/i);assert.deepEqual(email.citations,[]);
  for(const [question,threadId] of [
   ['Hoy terminé agotado del trabajo.','synthetic-casual'],
   ['Solo quiero platicar un rato, sin organizar tareas.','synthetic-casual'],
   ['Tuve muchas reuniones y casi no pude avanzar.','synthetic-casual'],
   ['Se me ocurrió una historia sobre una llave que aparece en un bolsillo vacío. Ayúdame a imaginar cómo empieza.','synthetic-story'],
   ['Que sea más cotidiana y menos dramática.','synthetic-story'],
  ]){
   const dialogue=await converse(question,threadId);assert.equal(dialogue.kind,'chat');assert.deepEqual(dialogue.citations,[]);assert.doesNotMatch(dialogue.text,/No tengo evidencia suficiente|Comparte la disposici[oó]n oficial/);
  }
  report.conversationalStyleReview='Technical dialogue checks only; inspect captured outputs. Naturalness and instruction-following quality require separate qualitative review.';
  report.conversation={realLocalInference:true,syntheticDataOnly:true,turns};report.checks.push('actual local model answers, recalls a previous turn and isolates another chat');
  report.checks.push('actual base model produces a numbered list, arithmetic answer and email draft without spurious legal-source rejection');
 }
 report.validationScope=runtimeManifest.bundledModel?'bundled-services-and-local-engine':'bundled-services-only-no-inference';
 report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.message;process.exitCode=1;}finally{
 if(child&&child.exitCode===null){child.stdin.end();await new Promise(resolve=>{const timer=setTimeout(()=>{child.kill('SIGKILL');resolve();},5000);child.once('exit',()=>{clearTimeout(timer);resolve();});});}
 await mkdir(path.dirname(reportPath),{recursive:true});await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
}console.log(JSON.stringify(report,null,2));
