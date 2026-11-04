import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {buildChatMessages,CHAT_INSTRUCTIONS} from '../server/conversation.mjs';
import {estimateTokens,CONTEXT_BUDGET} from '../server/thread-memory.mjs';
import {createService} from '../server/service.mjs';
import {validateConversationText} from '../server/grounded-output-mixed.mjs';

test('chat keeps complete turns beyond the legal passage budget and preserves native roles',()=>{
 const previous='Detalle narrativo sintético. '.repeat(30)+' FINAL_IMPORTANTE_DE_LA_HISTORIA';
 const messages=buildChatMessages({question:'Continúa desde el final.',history:[{question:'Imagina una historia.',text:previous}]});
 assert.deepEqual(messages.map(m=>m.role),['system','user','assistant','user']);assert.equal(messages[2].content,previous);
 assert.ok(messages.reduce((n,m)=>n+estimateTokens(m.content)+8,0)+CONTEXT_BUDGET.response<=4096);
 assert.ok(messages.reduce((n,m)=>n+m.content.length,0)<=7000);
 assert.equal(messages[0].content,CHAT_INSTRUCTIONS);
});

test('chat drops complete older turns when necessary and never trims the current request',()=>{
 const history=Array.from({length:4},(_,i)=>({question:`Pregunta ${i}`,text:'X'.repeat(2000)+` FINAL_${i}`}));
 const messages=buildChatMessages({question:'Y'.repeat(4000),history});
 assert.equal(messages.at(-1).content.length,4000);
 assert.ok(messages.reduce((n,m)=>n+m.content.length,0)<=7000);
 for(const message of messages.filter(m=>m.role==='assistant'))assert.match(message.content,/FINAL_\d$/);
 assert.throws(()=>buildChatMessages({question:'X'.repeat(15000)}),/contexto/);
});

test('everyday stories and instructions do not need legal citations, while legal claims still do',()=>{
 for(const text of ['Encontró una llave dentro de su bolsillo.','La historia debe empezar con un detalle cotidiano.','Podemos platicar durante una semana.'])assert.equal(validateConversationText(text,{generalConversation:true}),text);
 for(const text of ['El plazo del recurso vence en 15 días.','La ley permite apelar dentro de una semana.','El despido es ilegal.'])assert.throws(()=>validateConversationText(text,{generalConversation:true}),{code:'UNGROUNDED_CLAIM'});
});

test('creative and social turns avoid retrieval even inside a matter with matching documents',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'lex-dialogue-intent-'));const corpusPath=path.join(dir,'corpus.json');await writeFile(corpusPath,'[]');const seen=[];
 const service=await createService({dataDir:path.join(dir,'data'),corpusPath,publicLibrary:{search(){throw Error('Ordinary dialogue must not retrieve');}},inference:{async *generate(messages,options){seen.push({messages,options});yield 'La llave cayó del bolsillo cuando se sentó junto a la ventana.';}}});
 t.after(async()=>{service.close();await rm(dir,{recursive:true,force:true});});
 await service.dispatch('workspace.create',{name:'Prueba sintética',practiceAreas:['penal']});
 const matter=await service.dispatch('matter.create',{title:'Asunto sintético',client:'Parte ficticia',jurisdiction:'MX-FED'});
 await service.dispatch('document.import',{matterId:matter.id,name:'sintetico.txt',base64:Buffer.from('CANARIO_DOCUMENTAL. La llave del bolsillo y las reuniones corresponden al contrato sintético.').toString('base64')});
 for(const question of ['Hoy terminé agotado del trabajo.','Imagina cómo empieza una historia sobre una llave en un bolsillo vacío.','Soy abogado penal, pero ahora quiero hablar de historias de misterio. ¿Qué hace que una tenga buen suspenso?']){
  const answer=await service.analyze({mode:'auto',question,matterId:matter.id,threadId:'charla'});assert.equal(answer.kind,'chat');assert.deepEqual(answer.citations,[]);assert.equal(seen.at(-1).options.responseFormat,'text');assert.doesNotMatch(JSON.stringify(seen.at(-1).messages),/CANARIO_DOCUMENTAL/);
 }
});
