import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,writeFileSync,rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createService } from '../server/service.mjs';
import { routeAssistantRequest } from '../server/assistant-router.mjs';
import {recallUserStatement} from '../server/conversation-recall.mjs';

// Synthetic data only. Matters work like projects; threads are chats inside them.
async function fixture(t,inference){
  const dir=mkdtempSync(join(tmpdir(),'lex-threads-test-'));const corpusPath=join(dir,'corpus.json');
  writeFileSync(corpusPath,JSON.stringify([]));
  const service=await createService({dataDir:join(dir,'firm'),corpusPath,inference});
  t.after(()=>{service.close();rmSync(dir,{recursive:true,force:true});});
  await service.dispatch('workspace.create',{name:'Despacho sintético',practiceAreas:['civil']});
  const matter=await service.dispatch('matter.create',{title:'Asunto sintético',client:'Cliente sintético',jurisdiction:'MX-FED'});
  return {service,matter};
}
function echoModel(seen){return {async *generate(messages){seen.push(messages);yield `Respuesta ${seen.length}.`;}};}

test('explicit personal recall uses user statements from this thread even if the model denies memory',async t=>{
 let calls=0;const {service,matter}=await fixture(t,{async *generate(){calls++;yield 'No tengo ese dato.';}});
 const ask=(question,threadId='uno',matterId=matter.id)=>service.analyze({mode:'auto',matterId,threadId,question});
 await ask('Mi nombre de prueba es Camila.');await ask('Soy abogado penal.');const before=calls;
 const name=await ask('¿Cómo me llamo?');assert.match(name.text,/Mi nombre de prueba es Camila/);assert.ok(name.validation.checks.includes('scoped-user-statement-recall'));
 assert.match((await ask('¿Recuerdas mi profesión?')).text,/Soy abogado penal/);assert.equal(calls,before,'exact user recall does not depend on a new model guess');
 const unknown=await ask('¿Cómo me llamo?','dos');assert.doesNotMatch(unknown.text,/Camila/);assert.match(unknown.text,/No encuentro/);assert.equal(calls,before,'unknown identity is not guessed by the model');
 const other=await service.dispatch('matter.create',{title:'Otro asunto sintético',client:'Parte ficticia',jurisdiction:'MX-FED'});
 assert.doesNotMatch((await ask('¿Recuerdas mi profesión?','uno',other.id)).text,/penal/);
});

test('personal recall never adopts assistant guesses, hypotheticals or negated identities',()=>{
 const q='¿Cómo me llamo?';
 for(const question of ['Hola','No me llamo Camila.','Si me llamo Camila, ¿qué pasa?','Supongamos que me llamo Camila.'])assert.doesNotMatch(recallUserStatement(q,[{question,text:'Te llamas Camila.'}]),/Camila/);
 assert.match(recallUserStatement(q,[{question:'Me llamo Lucía del Río.',text:'Te llamas Otra.'}]),/Lucía del Río/);
});

test('greetings and small talk stay conversational inside a populated matter',async t=>{
 const seen=[];const inference={async *generate(messages,options){seen.push({messages,options});yield 'Hola. ¿En qué puedo ayudarte hoy?';}};
 const {service,matter}=await fixture(t,inference);
 await service.dispatch('document.import',{matterId:matter.id,name:'contrato-sintetico.txt',base64:Buffer.from('DOCUMENTO_CANARIO_ASUNTO. Hola, buenos días. Gracias por los servicios de este contrato sintético. Ayúdame a organizar ideas para una reunión. Los documentos se entregan en el domicilio pactado.').toString('base64')});
 for(const question of ['Hola','Buenos días','Gracias','¿Cómo estás?','Ayúdame a organizar ideas para una reunión']){
  const answer=await service.analyze({mode:'auto',matterId:matter.id,skillId:'legal-researcher',threadId:'saludo-con-documento',question});
  assert.equal(answer.kind,'chat',question);assert.deepEqual(answer.citations,[]);
  assert.equal(seen.at(-1).options.responseFormat,'text');
  assert.doesNotMatch(JSON.stringify(seen.at(-1).messages),/DOCUMENTO_CANARIO_ASUNTO/,'unrequested documents do not enter conversational generation');
 }
});

test('a selected skill no longer blocks conversation',()=>{
  assert.equal(routeAssistantRequest({question:'¿Cuál es mi palabra de trabajo?'}).reason,'personal-context');
  assert.equal(routeAssistantRequest({question:'¿Cuál es mi plazo para impugnar el despido?'}).kind,'grounded');
  for(const skillId of ['contract-reviewer','document-analyzer','legal-drafter','legal-researcher']){
    assert.equal(routeAssistantRequest({question:'hola, ¿cómo estás?',skillId}).kind,'chat');
    assert.equal(routeAssistantRequest({question:'Ayúdame a organizar las ideas para una reunión.',skillId}).kind,'chat');
  }
  const focused=routeAssistantRequest({question:'Revisa las cláusulas del contrato.',skillId:'contract-reviewer',documentCount:1});
  assert.equal(focused.kind,'grounded');assert.equal(focused.skillId,'contract-reviewer');
});

test('threads inside one matter keep separate history and default thread stays unchanged',async t=>{
  const seen=[];const {service,matter}=await fixture(t,echoModel(seen));
  const ask=(question,threadId)=>service.analyze({mode:'auto',matterId:matter.id,question,skillId:'auto',...(threadId?{threadId}:{})});
  const first=await ask('Ayúdame a organizar las ideas para una reunión con el cliente.','hilo-a');
  assert.equal(first.threadId,'hilo-a');
  await ask('Prepara una agenda breve para una reunión interna.','hilo-b');
  const context=seen.at(-1).map(message=>message.content).join('\n');
  assert.doesNotMatch(context,/reunión con el cliente/,'thread B must not see thread A');
  await ask('Y ahora organiza las ideas de la reunión en tres puntos.','hilo-a');
  assert.match(seen.at(-1).map(message=>message.content).join('\n'),/reunión con el cliente/,'thread A keeps its own history');
  assert.deepEqual(seen.at(-1).map(message=>message.role),['system','user','assistant','user']);
  assert.equal(seen.at(-1).at(-1).content,'Y ahora organiza las ideas de la reunión en tres puntos.');
  const plain=await ask('Ayúdame a organizar las ideas de otra reunión.');
  assert.equal(plain.threadId,undefined);
  await assert.rejects(()=>ask('hola','../otro'),/Conversación inválida/);
});

test('a skill that needs a document answers conversationally instead of blocking',async t=>{
  const seen=[];const {service,matter}=await fixture(t,echoModel(seen));
  const answer=await service.analyze({mode:'auto',matterId:matter.id,question:'Revisa las cláusulas del contrato.',skillId:'contract-reviewer',threadId:'hilo-c'});
  assert.match(answer.text,/Adjunta el documento/);assert.equal(answer.threadId,'hilo-c');
});
