import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {validateConversationText,validateMixedOutput,EVIDENCE_ABSTENTION} from '../server/grounded-output-mixed.mjs';
import {createService} from '../server/service.mjs';
import {createHash} from 'node:crypto';

test('plain chat admits arithmetic and lists while mixed legal paragraphs stay strict',()=>{
 for(const text of ['2 + 2 = 4.','Puedes organizar tu escritorio en 3 pasos.','1. Reúne los papeles.\n2. Clasifica los pendientes.','Podemos revisar la agenda esta semana.','1. Organiza tus contratos.\n2. Prepara preguntas para la reunión.','Organiza 3 áreas para código, documentos y herramientas.','Puedes escribir 3 artículos para un blog.']){
  assert.equal(validateConversationText(text,{generalConversation:true}),text);
  assert.throws(()=>validateMixedOutput(JSON.stringify({paragraphs:[{kind:'conversacion',text}]}),[]),{code:'UNGROUNDED_CLAIM'});
 }
});

test('plain chat still rejects unsourced legal numbers, written deadlines, claims and source IDs',()=>{
 for(const text of ['El recurso tarda 15 días.','1. El recurso tarda 15 días.','Artículo 42.','El artículo IV dispone la entrega.','Código Civil: 15 días.','La indemnización es de 90 días.','IVA: 16%.','El plazo es de veinte días.','El recurso tarda una semana.','Puedes apelar sin documento.','Tienes derecho a rescindir.','La cláusula es válida.']){
  assert.throws(()=>validateConversationText(text,{generalConversation:true}),{code:'UNGROUNDED_CLAIM'},text);
 }
 assert.throws(()=>validateConversationText('Lee esta respuesta [L1].',{generalConversation:true}),/Referencia no autorizada/);
});

test('ordinary draft placeholders do not become citations or authorize arbitrary references',()=>{
 const text='Estimados [Nombre del destinatario], ¿tienen disponibilidad esta semana para hablar de [tema específico]?\nAtentamente, [Tu Nombre]';
 assert.equal(validateConversationText(text,{generalConversation:true}),text);
 assert.equal(validateConversationText('Nos vemos el próximo [día de la semana] a las [hora] para [mencionar el motivo general, ej: discutir el avance del proyecto X].',{generalConversation:true}),'Nos vemos el próximo [día de la semana] a las [hora] para [mencionar el motivo general, ej: discutir el avance del proyecto X].');
 assert.throws(()=>validateConversationText(text),/Referencia no autorizada/);
 for(const reference of ['[L1]','[D2]','[CCF]','[Código Civil]','[Artículo 42]','[Tu Nombre](https://example.test)','[Tu Nombre','[Tu Nombre]]']){
  assert.throws(()=>validateConversationText(`Consulta ${reference}.`,{generalConversation:true}),/Referencia no autorizada/,reference);
 }
});

test('automatic general chat preserves the actual model answer instead of replacing it with a source request',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'lex-numeric-chat-'));const corpusPath=path.join(dir,'corpus.json');
 const text='Artículo 333. El resultado sintético debe constar por escrito en la documentación del asunto.';
 await writeFile(corpusPath,JSON.stringify([{id:'SYNTHETIC-RESULTADO',lawId:'SYNTHETIC-RESULTADO',title:'Ley Sintética del Resultado',article:'333',jurisdiction:'MX-FED',category:'legislation-snapshot',text,sha256:createHash('sha256').update(text).digest('hex'),url:'https://www.diputados.gob.mx/synthetic-test',version:'synthetic-only'}]));let response='1. Reúne los papeles.\n2. Clasifica los pendientes.';const seen=[];
 const service=await createService({dataDir:path.join(dir,'data'),corpusPath,inference:{async *generate(messages,options){seen.push({messages,options});yield response;}}});
 t.after(async()=>{service.close();await rm(dir,{recursive:true,force:true});});
 await service.dispatch('workspace.create',{name:'Prueba sintética',practiceAreas:['civil']});
 const ask=question=>service.analyze({mode:'auto',question,threadId:'general'});
 const list=await ask('Dame dos ideas para organizar el escritorio.');assert.equal(list.text,response);assert.deepEqual(list.citations,[]);assert.equal(list.validation.status,'unverified-conversation');
 response='2 + 2 = 4.';const math=await ask('¿Cuánto es 2 + 2?');assert.equal(math.text,response);assert.equal(seen.at(-1).options.responseFormat,'text');
 response='El recurso tarda 15 días.';assert.equal((await ask('Dame una idea para organizar una reunión.')).text,EVIDENCE_ABSTENTION);
});
