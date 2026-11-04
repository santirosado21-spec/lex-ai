import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createService} from '../server/service.mjs';

async function fixture(t,inference){
 const dir=await mkdtemp(path.join(os.tmpdir(),'lex-general-chat-'));
 const service=await createService({dataDir:dir,corpusPath:path.resolve('resources/legal-corpus.json'),inference,publicLibrary:{status(){throw Error('Chat must not retrieve public sources');},search(){throw Error('Chat must not search public sources');}}});
 t.after(()=>{service.close();return rm(dir,{recursive:true,force:true});});
 await service.dispatch('workspace.create',{name:'Despacho sintético de conversación',practiceAreas:['penal']});
 return service;
}
test('model conversation handles compound introductions without a matter, documents or retrieval',async t=>{
 const calls=[],tokens=[];const service=await fixture(t,{async *generate(messages,options){calls.push({messages,options});yield 'Puedo ayudarte a organizar ';yield 'tu trabajo y preparar preguntas. ¿En qué estás trabajando?';}});
 const answer=await service.analyze({mode:'chat',question:'hola que puedes hacer para mi soy abogado penal'},text=>tokens.push(text));
 assert.equal(calls.length,1);assert.equal(calls[0].options.responseFormat,'text');assert.equal(calls[0].options.outputSchema,undefined);
 assert.equal(calls[0].messages.at(-1).role,'user');assert.match(calls[0].messages.at(-1).content,/abogado penal/);
 assert.equal(answer.text,tokens.join(''));assert.equal(answer.kind,'chat');assert.equal(answer.matterId,'');assert.deepEqual(answer.citations,[]);
 assert.equal(answer.validation.citationIntegrity,false);assert.equal(answer.validation.requiresLawyerReview,true);
 const state=await service.dispatch('state');assert.equal(state.answers.length,0);assert.equal(state.chatTurns.length,1);
});
test('general history keeps prior user and model turns in chronological roles',async t=>{
 let seen;const service=await fixture(t,{async *generate(messages){seen=messages;yield 'Respuesta local sintética.';}});
 await service.analyze({mode:'chat',question:'Mi nombre sintético es Elena.'});
 await service.analyze({mode:'chat',question:'¿Cuál es mi nombre?'});
 assert.deepEqual(seen.slice(1).map(m=>m.role),['user','assistant','user']);assert.match(seen[1].content,/Elena/);
});
test('chat memory cannot include another matter, private imported text, or general workspace turns',async t=>{
 let seen;const service=await fixture(t,{async *generate(messages){seen=messages;yield 'Respuesta sintética sin acceso documental.';}});
 const first=await service.dispatch('matter.create',{title:'Asunto A',client:'Parte ficticia A',jurisdiction:'MX-CMX'});
 const second=await service.dispatch('matter.create',{title:'Asunto B',client:'Parte ficticia B',jurisdiction:'MX-FED'});
 await service.dispatch('document.import',{matterId:first.id,name:'sintetico.txt',base64:Buffer.from('CANARY-DOCUMENTO-PRIVADO, texto sintético para prueba de aislamiento.').toString('base64')});
 await service.analyze({mode:'chat',matterId:first.id,question:'CANARY-OTRO-ASUNTO'});
 await service.analyze({mode:'chat',question:'CANARY-GENERAL'});
 await service.analyze({mode:'chat',matterId:second.id,question:'Ayúdame a organizar mi día.'});
 assert.doesNotMatch(JSON.stringify(seen),/CANARY/);assert.equal(seen.length,2);
 await assert.rejects(service.analyze({mode:'chat',matterId:'foreign-matter',question:'Hola'}),/no encontrado/);
});
test('cancellation and broken streams do not save a partial chat turn',async t=>{
 const controller=new AbortController();const service=await fixture(t,{async *generate(){yield 'Parcial';controller.abort();yield 'nunca se guarda';}});
 await assert.rejects(service.analyze({mode:'chat',question:'Prueba sintética'},()=>{},{signal:controller.signal}),/abort/i);
 assert.equal((await service.dispatch('state')).chatTurns.length,0);
});
test('chat context stays under budget and malformed inputs fail before model generation',async t=>{
 let seen,calls=0;const service=await fixture(t,{async *generate(messages){calls++;seen=messages;yield 'Salida sintética '.repeat(50);}});
 for(let i=0;i<6;i++)await service.analyze({mode:'chat',question:'Consulta sintética '.repeat(70)});
 await service.analyze({mode:'chat',question:'x'.repeat(4000)});
 assert.ok(seen.reduce((n,m)=>n+m.content.length,0)<=7000);assert.equal(seen.at(-1).content.length,4000);
 const before=calls;
 for(const payload of [{mode:'chat',question:'hola',sources:['injected']},{mode:'chat',question:' '},{mode:'chat',question:'x'.repeat(4001)},{mode:'chat',question:'hola',matterId:42},{mode:'bad',question:'hola'}])await assert.rejects(service.analyze(payload));
 assert.equal(calls,before);
});
