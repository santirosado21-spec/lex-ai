/** Real local inference; synthetic conversations only; no remote model calls. */
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createInference} from '../server/inference.mjs';
import {createService} from '../server/service.mjs';

const reportPath=path.resolve(process.argv[2]||'artifacts/conversation-native-20261103/recall-v2.json');
const runtime=path.resolve(process.env.LEX_QA_RUNTIME||'/Applications/LEX AI.app/Contents/Resources/app');
const dataDir=await mkdtemp(path.join(os.tmpdir(),'lex-conversation-modelqa-'));
const engine=createInference({dataDir,runtimePath:path.join(runtime,'resources/runtime/ollama'),bundledModelsDir:path.join(runtime,'resources/bundled-model'),allowDownload:false});
const report={startedAt:new Date().toISOString(),syntheticDataOnly:true,realLocalInference:true,turns:[],calls:[],status:'RUNNING'};
const inference={...engine,async *generate(messages,options){report.calls.push({messages,format:options.responseFormat});yield*engine.generate(messages,options);}};
let service;
try{
 await engine.initialize();const deadline=Date.now()+120000;
 while(true){const state=await engine.status();assert.notEqual(state.state,'error',state.message);if(state.state==='ready'){report.engine={modelId:state.modelId,hardware:state.hardware};break;}assert.ok(Date.now()<deadline,'startup timeout');await new Promise(resolve=>setTimeout(resolve,200));}
 service=await createService({dataDir,corpusPath:path.resolve('resources/legal-corpus.json'),inference});
 await service.dispatch('workspace.create',{name:'Evaluación sintética de conversación',practiceAreas:['Penal']});
 const matter=await service.dispatch('matter.create',{title:'Contrato sintético con saludo',client:'Parte ficticia',jurisdiction:'MX-CMX'});
 await service.dispatch('document.import',{matterId:matter.id,name:'prueba.txt',base64:Buffer.from('DOCUMENTO_CANARIO_NO_SOLICITADO. Hola, buenos días. Este contrato sintético no corresponde a clientes ni obligaciones reales. Las partes definen pagos y entregas únicamente para la evaluación.').toString('base64')});
 async function ask(question,threadId='profesion'){
  const started=Date.now(),callCount=report.calls.length;const answer=await service.analyze({mode:'auto',skillId:'legal-researcher',matterId:matter.id,threadId,question});
  report.turns.push({question,text:answer.text,threadId,elapsedMs:Date.now()-started,modelCalled:report.calls.length>callCount,contextLookup:answer.validation.checks.includes('scoped-user-context-lookup'),contextRecall:answer.validation.checks.includes('scoped-user-statement-recall')});
  assert.equal(answer.kind,'chat');assert.deepEqual(answer.citations,[]);assert.equal(report.calls.at(-1).format,'text');
  assert.doesNotMatch(JSON.stringify(report.calls.at(-1).messages),/DOCUMENTO_CANARIO_NO_SOLICITADO/);
  return answer.text;
 }
 await ask('Hola');await ask('¿Qué puedes hacer para mí? Soy abogado penal.');
 const profession=await ask('¿Recuerdas mi profesión?');assert.match(profession,/penal/i);assert.doesNotMatch(profession,/no (?:tengo|puedo|recuerdo)|sin (?:memoria|acceso)|cada sesi[oó]n es independiente/i);
 await ask('Mi nombre de prueba es Camila.');const name=await ask('¿Cómo me llamo?');assert.match(name,/Camila/i);
 const other=await ask('¿Recuerdas mi profesión?','otro-chat');assert.doesNotMatch(other,/penal|Camila|soy LEX AI/i);assert.match(other,/No encuentro/i);
 report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.stack;process.exitCode=1;}
finally{service?.close();await engine.stop();report.finishedAt=new Date().toISOString();await mkdir(path.dirname(reportPath),{recursive:true});await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,error:report.error,turns:report.turns},null,2));
