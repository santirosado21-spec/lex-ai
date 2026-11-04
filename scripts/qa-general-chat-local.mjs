/** Real bundled base model; isolated synthetic workspace, no private documents. */
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createInference} from '../server/inference.mjs';
import {createService} from '../server/service.mjs';
import {validateConversationText,EVIDENCE_ABSTENTION} from '../server/grounded-output-mixed.mjs';

const output=path.resolve(process.argv[2]||'artifacts/chat-general-20261104/real-model.json');
const runtime=path.resolve(process.env.LEX_QA_RUNTIME||'/Applications/LEX AI.app/Contents/Resources/app');
const dataDir=await mkdtemp(path.join(os.tmpdir(),'lex-general-real-'));
const report={startedAt:new Date().toISOString(),realLocalInference:true,syntheticDataOnly:true,adapterActivated:false,runtime,turns:[],calls:[],status:'RUNNING'};
const engine=createInference({dataDir,runtimePath:path.join(runtime,'resources/runtime/ollama'),bundledModelsDir:path.join(runtime,'resources/bundled-model'),allowDownload:false});
const inference={...engine,async *generate(messages,options){const call={messages,format:options.responseFormat,raw:''};report.calls.push(call);for await(const token of engine.generate(messages,options)){call.raw+=token;yield token;}}};
let service;
try{
 await engine.initialize();const deadline=Date.now()+120000;
 while(true){const state=await engine.status();assert.notEqual(state.state,'error',state.message);if(state.state==='ready'){report.engine={modelId:state.modelId,hardware:state.hardware};break;}assert.ok(Date.now()<deadline,'startup timeout');await new Promise(resolve=>setTimeout(resolve,200));}
 const corpusPath=path.join(dataDir,'empty-synthetic-corpus.json');await writeFile(corpusPath,'[]');
 service=await createService({dataDir:path.join(dataDir,'workspace'),corpusPath,inference});
 await service.dispatch('workspace.create',{name:'Prueba sintética de conversación general',practiceAreas:['civil']});
 async function ask(question,threadId,check){
  const before=report.calls.length;const answer=await service.analyze({mode:'auto',question,threadId});
  const call=report.calls.length>before?report.calls.at(-1):null;
  let previousStrictGuardRejected=null;
  if(call?.format==='text'){try{validateConversationText(call.raw);}catch(e){previousStrictGuardRejected=e.code||e.message;}}
  const turn={question,threadId,text:answer.text,kind:answer.kind,validation:answer.validation,modelCalled:Boolean(call),previousStrictGuardRejected};report.turns.push(turn);
  assert.equal(answer.kind,'chat');assert.deepEqual(answer.citations,[]);assert.notEqual(answer.text,EVIDENCE_ABSTENTION);if(call)assert.equal(call.format,'text');
  check?.(answer.text,answer);return answer;
 }
 await ask('Hola.','greeting',text=>assert.match(text,/hola|buen|ayud/i));
 await ask('Dame exactamente 3 ideas sencillas para organizar mi escritorio. Usa una lista numerada.','desk',text=>{assert.match(text,/1[.)]/);assert.match(text,/2[.)]/);assert.match(text,/3[.)]/);});
 await ask('¿Cuánto es 2 + 2? Responde sólo el resultado.','math',text=>assert.match(text,/\b4\b|cuatro/i));
 await ask('Redacta un correo breve para pedir una reunión interna, sin inventar fechas.','email',text=>assert.match(text,/reuni[oó]n/i));
 await ask('Me llamo Camila Sol y soy arquitecta.','identity');
 await ask('¿Cómo me llamo?','identity',text=>assert.match(text,/Camila Sol/));
 await ask('¿Cómo me llamo?','fresh',text=>{assert.doesNotMatch(text,/Camila/);assert.match(text,/No encuentro/);});
 await ask('Analiza mi contrato.','missing-document',(text,answer)=>assert.equal(answer.validation.status,'needs-document'));
 assert.ok(report.turns.some(t=>t.previousStrictGuardRejected==='UNGROUNDED_CLAIM'),'real generated numeric answer reproduces old source gate rejection');
 report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.stack;process.exitCode=1;}
finally{service?.close();await engine.stop();report.finishedAt=new Date().toISOString();await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,error:report.error,turns:report.turns},null,2));
