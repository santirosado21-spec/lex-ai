/** Inspectable qualitative dialogue comparison; synthetic prompts only. */
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import os from 'node:os';
import path from 'node:path';
import {createInference} from '../server/inference.mjs';

const reportPath=path.resolve(process.argv[2]);
const serviceFile=path.resolve(process.env.LEX_DIALOGUE_SERVICE||'server/service.mjs');
const runtime=path.resolve('/Applications/LEX AI.app/Contents/Resources/app');
const {createService}=await import(pathToFileURL(serviceFile));
const dir=await mkdtemp(path.join(os.tmpdir(),'lex-dialogue-style-'));
const experimentalSampling=process.env.LEX_DIALOGUE_SAMPLING==='official-text'?{temperature:1,top_p:1,top_k:20,min_p:0,presence_penalty:2,repeat_penalty:1}:null;
const dependencies=experimentalSampling?{fetch:async(url,init={})=>{
 if(String(url).endsWith('/api/chat')&&init.body){const body=JSON.parse(init.body);if(!body.format){body.options={...body.options,...experimentalSampling};init={...init,body:JSON.stringify(body)};}}
 return fetch(url,init);
}}:{};
const engine=createInference({dataDir:dir,runtimePath:path.join(runtime,'resources/runtime/ollama'),bundledModelsDir:path.join(runtime,'resources/bundled-model'),allowDownload:false,dependencies});
const report={startedAt:new Date().toISOString(),serviceFile,realLocalInference:true,syntheticDataOnly:true,adapterActivated:false,turns:[],calls:[],directModel:[],quality:'QUALITATIVE_REVIEW_REQUIRED',status:'RUNNING'};
report.experimentalSampling=experimentalSampling;
const inference={...engine,async *generate(messages,options){const call={messages,format:options.responseFormat,raw:''};report.calls.push(call);for await(const token of engine.generate(messages,options)){call.raw+=token;yield token;}}};
const scenarios=[
 {id:'small-talk',questions:['Hoy terminé agotado del trabajo.','Solo quiero platicar un rato, sin organizar tareas.','Tuve muchas reuniones y casi no pude avanzar.']},
 {id:'creative',questions:['Se me ocurrió una historia sobre una llave que aparece en un bolsillo vacío. Ayúdame a imaginar cómo empieza.','Que sea más cotidiana y menos dramática.']},
 {id:'instruction',questions:['Responde exactamente: entendido.','Ahora responde exactamente: seguimos.']},
 {id:'context',questions:['Soy abogado penal, pero ahora quiero hablar de historias de misterio. ¿Qué hace que una tenga buen suspenso?']},
];
let service;
try{
 await mkdir(path.dirname(reportPath),{recursive:true});
 report.serviceSha256=createHash('sha256').update(await readFile(serviceFile)).digest('hex');
 report.implementationHashes={};for(const name of ['service.mjs','conversation.mjs','grounded-output-mixed.mjs','assistant-router.mjs'])report.implementationHashes[name]=createHash('sha256').update(await readFile(path.join(path.dirname(serviceFile),name))).digest('hex');
 await engine.initialize();const deadline=Date.now()+120000;
 while(true){const state=await engine.status();assert.notEqual(state.state,'error',state.message);if(state.state==='ready')break;assert.ok(Date.now()<deadline,'startup timeout');await new Promise(r=>setTimeout(r,200));}
 service=await createService({dataDir:path.join(dir,'workspace'),corpusPath:path.join(runtime,'resources/legal-corpus.json'),inference});
 await service.dispatch('workspace.create',{name:'Conversación sintética',practiceAreas:['penal']});
 for(const scenario of scenarios)for(const question of scenario.questions){
  try{
   const answer=await service.analyze({mode:'auto',question,threadId:scenario.id});
   report.turns.push({scenario:scenario.id,question,text:answer.text,kind:answer.kind,citations:answer.citations.map(c=>c.id),validation:answer.validation.status});
  }catch(e){report.turns.push({scenario:scenario.id,question,error:e.message});}
  await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
 }
 for(const question of [scenarios[0].questions[0],scenarios[3].questions[0]]){
  let text='';for await(const token of engine.generate([{role:'system',content:'Eres LEX AI. Conversa en español con naturalidad y responde directamente a lo que te diga el usuario.'},{role:'user',content:question}],{responseFormat:'text'}))text+=token;
  report.directModel.push({question,text});
 }
 report.status='CAPTURED_FOR_QUALITATIVE_REVIEW';
}catch(e){report.status='FAILED';report.error=e.stack;process.exitCode=1;}
finally{service?.close();await engine.stop();report.finishedAt=new Date().toISOString();await mkdir(path.dirname(reportPath),{recursive:true});await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,error:report.error,turns:report.turns,directModel:report.directModel},null,2));
