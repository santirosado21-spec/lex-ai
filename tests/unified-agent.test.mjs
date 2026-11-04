import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createService} from '../server/service.mjs';
import {createStore} from '../server/store.mjs';
import {openPublicLibrary} from '../server/public-library.mjs';
import {createThreadMemory,buildUnifiedContext,estimateTokens,CONTEXT_BUDGET} from '../server/thread-memory.mjs';
import {validateMixedOutput,MIXED_INSTRUCTIONS} from '../server/grounded-output-mixed.mjs';

const quote='Artículo 1. La entrega sintética debe documentarse mediante constancia escrita por las partes.';
const law={id:'SYNTHETIC-LAW-1',lawId:'SYNTHETIC-LAW',title:'Ley Sintética',article:'1',jurisdiction:'MX-FED',category:'legislation-snapshot',text:quote,sha256:createHash('sha256').update(quote).digest('hex'),url:'https://www.diputados.gob.mx/synthetic-test',version:'synthetic-test-only'};
const question='Explica el artículo 1 de la Ley Sintética.';
const conversational={kind:'conversacion',text:'¿Quieres que revisemos el documento del asunto?'};
const legal=source=>({sourceId:source.id,quote:source.allowedQuotes[0],text:'La entrega sintética debe documentarse mediante constancia escrita.'});
async function fixture(t,{sources=[law],response,publicLibrary,outputContract='paragraph-citations-v1'}={}){
 const dir=mkdtempSync(join(tmpdir(),'lex-unified-agent-')),corpusPath=join(dir,'corpus.json');
 writeFileSync(corpusPath,JSON.stringify(sources));
 const seen=[];
 const inference={outputContract,async *generate(messages,options){
  seen.push({messages,options});
  if(response){yield response(messages,options);return;}
  if(options.responseFormat==='text'){yield 'Hola, podemos organizar tus ideas. ¿Qué necesitas preparar?';return;}
  const source=JSON.parse(messages[1].content).sources[0];
  yield JSON.stringify({paragraphs:[legal(source),conversational]});
 }};
 let service=await createService({dataDir:dir,corpusPath,inference,publicLibrary});
 t.after(()=>{service.close();rmSync(dir,{recursive:true,force:true});});
 await service.dispatch('workspace.create',{name:'Despacho de prueba sintético',practiceAreas:['civil']});
 return {get service(){return service;},seen,dir,async reopen(){service.close();service=await createService({dataDir:dir,corpusPath,inference,publicLibrary});}};
}
const ask=(service,question,extra={},onToken)=>service.analyze({mode:'auto',question,...extra},onToken);

test('ordinary dialogue does not search public sources; a legal request still uses evidence',async t=>{
 let searches=0;
 const f=await fixture(t,{publicLibrary:{search(){searches++;return {sources:[]};}}});
 const answer=await ask(f.service,'Hola');
 assert.equal(searches,0);assert.equal(answer.kind,'chat');assert.deepEqual(answer.citations,[]);
 assert.match(answer.text,/Hola/);assert.equal(f.seen[0].options.responseFormat,'text');
 const sourced=await ask(f.service,question);assert.equal(sourced.kind,'grounded');assert.ok(sourced.citations.length);
});

test('auto returns conversational and legal paragraphs with validated L aliases and provenance',async t=>{
 const f=await fixture(t),stream=[];
 const answer=await ask(f.service,question,{},chunk=>stream.push(chunk));
 assert.match(answer.text,/\[L1\]\n\n¿Quieres/);assert.equal(answer.text,stream.join(''));
 assert.equal(answer.citations[0].id,'L1');assert.equal(answer.citations[0].canonicalId,law.id);
 assert.equal(answer.citations[0].url,law.url);assert.equal(answer.validation.citationIntegrity,true);
 assert.equal(answer.validation.groundedContract,'mixed-paragraph-citations-v1');
 assert.equal(answer.validation.legalAccuracy,'not-evaluated');
});

test('incidental overlap with a law does not turn an ambiguous conversation into legal output',async t=>{
 const f=await fixture(t);
 const answer=await ask(f.service,'entrega sintética');
 assert.equal(answer.kind,'chat');assert.deepEqual(answer.citations,[]);assert.equal(f.seen[0].options.responseFormat,'text');
});

test('invented citation fails closed without streaming or persisting output',async t=>{
 const f=await fixture(t,{response:()=>JSON.stringify({paragraphs:[{...legal({id:'L99',allowedQuotes:[quote]})},conversational]})}),stream=[];
 await assert.rejects(ask(f.service,question,{},chunk=>stream.push(chunk)),/aprobada/);
 assert.deepEqual(stream,[]);assert.deepEqual((await f.service.dispatch('state')).answers,[]);
});

test('no relevant evidence produces conversational abstention without inference',async t=>{
 const f=await fixture(t,{sources:[]});
 const answer=await ask(f.service,'¿Cuál es el plazo de caducidad?');
 assert.equal(answer.kind,'chat');assert.match(answer.text,/evidencia suficiente/);
 assert.equal(answer.validation.status,'abstained-no-relevant-sources');assert.equal(f.seen.length,0);
});

test('auto does not stream unsupported legal/numeric claims from text generation',async t=>{
 const f=await fixture(t,{sources:[],response:()=> 'El plazo es de 30 días.'}),stream=[];
 const answer=await ask(f.service,'Hola',{},s=>stream.push(s));
 assert.match(answer.text,/evidencia suficiente/);assert.doesNotMatch(stream.join(''),/30/);
});

test('unknown citation in a text response also rejects',async t=>{
 const f=await fixture(t,{sources:[],response:()=> 'Puedo ayudarte con el documento [L99].'});
 await assert.rejects(ask(f.service,'Hola'),/Referencia no autorizada/);
 assert.equal((await f.service.dispatch('state')).chatTurns.length,0);
});

test('mixed validator cannot hide legal claims in conversational paragraphs or borrow numbers',()=>{
 const evidence=[{...law,id:'L1',allowedQuotes:[quote]}];
 for(const text of ['El plazo es de treinta días.','El artículo IV dispone la entrega.','La entrega debe documentarse.','El despido es ilegal.','La apelación procede.','El pago es mensual.','Puedes reclamar dentro de una semana.']){
  assert.throws(()=>validateMixedOutput(JSON.stringify({paragraphs:[legal(evidence[0]),{kind:'conversacion',text}]}),evidence),{code:'UNGROUNDED_CLAIM'});
 }
 assert.throws(()=>validateMixedOutput(JSON.stringify({paragraphs:[{...legal(evidence[0]),text:'El artículo 99 impone la entrega mediante escrito.'}]}),evidence),/respaldo/);
 // An ungrounded conversation must not mask an invented source later in output.
 assert.throws(()=>validateMixedOutput(JSON.stringify({paragraphs:[{kind:'conversacion',text:'El plazo es de 30 días.'},{...legal(evidence[0]),sourceId:'L999'}]}),evidence),/aprobada/);
});

test('unsupported conversational paragraph in grounded generation becomes abstention',async t=>{
 const f=await fixture(t,{response:messages=>{
  const s=JSON.parse(messages[1].content).sources[0];
  return JSON.stringify({paragraphs:[legal(s),{kind:'conversacion',text:'El plazo es de veinte días.'}]});
 }});
 const answer=await ask(f.service,question);assert.equal(answer.validation.status,'abstained-no-relevant-sources');
 assert.deepEqual(answer.citations,[]);assert.doesNotMatch(answer.text,/veinte/);
});

test('long-lived thread memory persists across restart and never crosses matters or threads',async t=>{
 const f=await fixture(t,{sources:[]});
 const a=await f.service.dispatch('matter.create',{title:'Asunto sintético A',client:'Parte ficticia',jurisdiction:'MX-FED'});
 const b=await f.service.dispatch('matter.create',{title:'Asunto sintético B',client:'Parte ficticia',jurisdiction:'MX-FED'});
 await ask(f.service,'Mi nombre de prueba es CANARIO_ALFA.',{matterId:a.id,threadId:'uno'});
 for(let i=0;i<7;i++)await ask(f.service,'Ayúdame a organizar las ideas de mi reunión.',{matterId:a.id,threadId:'uno'});
 await f.reopen();
 await ask(f.service,'¿Recuerdas mi presentación?',{matterId:a.id,threadId:'uno'});
 assert.equal(f.seen.at(-1).messages[1].role,'user');
 assert.match(JSON.parse(f.seen.at(-1).messages[1].content).untrustedHistoricalContext,/CANARIO_ALFA/);
 for(const scope of [{matterId:a.id,threadId:'dos'},{matterId:b.id,threadId:'uno'},{threadId:'uno'},{}]){
  await ask(f.service,'Hola',scope);assert.doesNotMatch(JSON.stringify(f.seen.at(-1).messages),/CANARIO_ALFA/);
 }
});

test('persisted memory key also isolates workspaces and rejects forged history scopes',t=>{
 const dir=mkdtempSync(join(tmpdir(),'lex-unified-agent-memory-')),store=createStore(dir);let workspaceId='firm-a';
 t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
 const memory=createThreadMemory({store,workspace:()=>({id:workspaceId}),matter:()=>{}});
 const turns=Array.from({length:8},()=>({workspaceId:'firm-a',matterId:'matter-a',threadId:'thread',question:'CANARIO_MEMORIA',text:'No promover esta afirmación'}));
 memory.update('matter-a','thread',turns);assert.match(memory.read('matter-a','thread'),/CANARIO_MEMORIA/);
 assert.equal(memory.read('matter-b','thread'),'');assert.equal(memory.read('matter-a','other'),'');
 workspaceId='firm-b';assert.equal(memory.read('matter-a','thread'),'');
 memory.update('matter-a','thread',turns);assert.equal(memory.read('matter-a','thread'),'');
});

test('context budget bounds memory, long history, passages, framing and response reserve',()=>{
 const history=Array.from({length:1000},()=>({question:'Pregunta sintética '.repeat(100),text:'Respuesta sintética '.repeat(100)}));
 const sources=Array.from({length:20},(_,i)=>({id:`L${i+1}`,text:quote.repeat(10),allowedQuotes:[quote]}));
 const context=buildUnifiedContext({instructions:MIXED_INSTRUCTIONS,question:'¿Qué información falta?',history,memory:'MEMORIA '.repeat(1000),sources});
 const prompt=JSON.parse(context.messages[1].content);
 assert.ok(prompt.conversation.length<=4);assert.ok(estimateTokens(prompt.memory)<=CONTEXT_BUDGET.memory);
 assert.ok(estimateTokens(JSON.stringify({question:prompt.question,conversation:prompt.conversation}))<=CONTEXT_BUDGET.turns);
 assert.ok(estimateTokens(JSON.stringify(prompt.sources))<=CONTEXT_BUDGET.passages);
 assert.ok(context.budget.inputTokens+CONTEXT_BUDGET.response<=4096);
 assert.ok(context.messages.reduce((n,m)=>n+m.content.length,0)<=7000);
 assert.throws(()=>buildUnifiedContext({instructions:MIXED_INSTRUCTIONS,question:'x'.repeat(4000)}),/Acótala/);
});

test('private document retrieval and D citations stay inside the selected matter',async t=>{
 const f=await fixture(t,{sources:[]});
 const a=await f.service.dispatch('matter.create',{title:'Asunto A sintético',client:'Parte ficticia',jurisdiction:'MX-FED'});
 const b=await f.service.dispatch('matter.create',{title:'Asunto B sintético',client:'Parte ficticia',jurisdiction:'MX-FED'});
 await f.service.dispatch('document.import',{matterId:a.id,name:'sintetico.txt',base64:Buffer.from('La entrega sintética debe documentarse mediante constancia escrita por las partes. CANARIO_DOCUMENTO.').toString('base64')});
 const answer=await ask(f.service,'Revisa la entrega sintética del documento.',{matterId:a.id,threadId:'uno'});
 assert.equal(answer.citations[0].id,'D1');assert.equal(answer.citations[0].matterId,a.id);
 await ask(f.service,'Hola',{matterId:b.id,threadId:'uno'});
 assert.doesNotMatch(JSON.stringify(f.seen.at(-1).messages),/CANARIO_DOCUMENTO/);
});

test('optional fragment modules retain exact source offsets and hashes in an automatic answer',async t=>{
 let module;try{module=await import('../server/retrieval/fragments.mjs');}catch(e){if(e.code==='ERR_MODULE_NOT_FOUND')return t.skip('Optional fragment worker not present');throw e;}
 const text='Encabezado sintético sin relación con la consulta.\nII. La entrega sintética debe documentarse mediante constancia escrita por las partes.';
 const source={...law,text,sha256:createHash('sha256').update(text).digest('hex')};
 const f=await fixture(t,{sources:[source]});
 const answer=await ask(f.service,'Explica el artículo 1 de la Ley Sintética sobre la entrega.');
 const cited=answer.citations[0];assert.ok(module.verifyFragment(cited.preferredPassage,source));
 assert.equal(cited.passageStart,cited.preferredPassage.start);assert.equal(cited.text,text.slice(cited.passageStart,cited.passageEnd));
 assert.equal(cited.fullTextSha256,source.sha256);assert.equal(cited.canonicalId,source.id);
});

test('cancellation while emitting validated mixed output persists neither answer nor memory',async t=>{
 const f=await fixture(t),c=new AbortController();
 await assert.rejects(f.service.analyze({mode:'auto',question},()=>c.abort(),{signal:c.signal}),/abort/i);
 assert.equal((await f.service.dispatch('state')).answers.length,0);
 const store=createStore(f.dir);try{assert.equal(store.list('thread-memory').length,0);}finally{store.close();}
});

const legacyOutput=p=>({analysis:`${p.text} [${p.sourceId}]`,citations:[{sourceId:p.sourceId,quote:p.quote}]});
for(const smoke of [
 {name:'ui-smoke',document:'CONTRATO SINTÉTICO DE SERVICIOS. Las partes acuerdan obligaciones de pago por servicios. El precio podrá cambiar por acuerdo escrito de ambas partes. El contrato se perfecciona por consentimiento. Documento exclusivamente de prueba.',text:'El contrato sintético requiere revisión de sus obligaciones y condiciones.',withLaw:true},
 {name:'ui-chat-smoke',document:'CONTRATO SINTÉTICO A. Las partes acuerdan obligaciones de pago por servicios. El consentimiento exige acuerdo de ambas partes. Solo prueba de interfaz.',text:'Las obligaciones del contrato sintético requieren revisión.'},
 {name:'ui-avatar-smoke',document:'CONTRATO SINTÉTICO. Las partes acuerdan obligaciones de pago por servicios. El contrato se perfecciona por consentimiento. Solo prueba.',text:'El contrato sintético requiere revisión de sus obligaciones.'},
])test(`${smoke.name} legacy wire contract saves a grounded answer for DOCX rendering`,async t=>{
 const sourceText='El contrato sintético recoge el consentimiento para las obligaciones de pago por servicios. Las condiciones del acuerdo requieren revisión profesional.';
 const f=await fixture(t,{sources:smoke.withLaw?[{...law,text:sourceText,sha256:createHash('sha256').update(sourceText).digest('hex')}]:[],outputContract:null,response:messages=>{
  // These doubles deliberately use the last message and a source-text excerpt,
  // just like the UI smokes, rather than the newer paragraph quote enum.
  assert.equal(messages.at(-1).role,'user');
  const {sources}=JSON.parse(messages.at(-1).content);
  assert.ok(Array.isArray(sources));
  const document=sources.find(s=>s.category==='internal-firm-document');
  assert.ok(document);assert.equal(typeof document.id,'string');
  assert.equal(document.text,smoke.document);assert.ok(document.allowedQuotes.length);
  assert.ok(document.allowedQuotes.every(q=>document.text.includes(q)));
  assert.ok(!document.allowedQuotes.includes(document.text.slice(0,100)));
  const cited=[document],paragraphs=[`${smoke.text} [${document.id}]`];
  if(smoke.withLaw){
   const legal=sources.find(s=>s.category==='legislation-snapshot');assert.ok(legal);
   cited.push(legal);paragraphs.push(`La fuente oficial recuperada ofrece un pasaje para contrastar las condiciones del acuerdo; su vigencia y aplicación deben revisarse profesionalmente. [${legal.id}]`);
  }
  return JSON.stringify({analysis:paragraphs.join('\n\n'),citations:cited.map(s=>({sourceId:s.id,quote:s.text.slice(0,100)}))});
 }});
 const matter=await f.service.dispatch('matter.create',{title:'Contrato sintético',client:'Cliente ficticio',jurisdiction:'MX-FED'});
 await f.service.dispatch('document.import',{matterId:matter.id,name:'contrato.txt',base64:Buffer.from(smoke.document).toString('base64')});
 const stream=[],answer=await ask(f.service,'¿Qué obligaciones y condiciones establece el contrato por consentimiento?',{matterId:matter.id,skillId:'contract-reviewer',threadId:'smoke'},s=>stream.push(s));
 assert.equal(f.seen.length,1);assert.equal(answer.kind,'grounded');
 assert.equal(answer.validation.citationIntegrity,true);assert.equal(answer.validation.status,'source-checked');
 assert.equal(answer.citations.length,smoke.withLaw?2:1);assert.equal(answer.citations[0].quote,smoke.document.slice(0,100));
 assert.equal(answer.matterId,matter.id);assert.equal(answer.threadId,'smoke');assert.equal(answer.text,stream.join(''));
 await f.reopen();
 const state=await f.service.dispatch('state');
 assert.equal(state.answers.length,1);assert.deepEqual(state.answers[0],answer);assert.deepEqual(state.chatTurns,[]);
});

test('legacy source-text excerpts remain scoped and numeric-checked without widening the paragraph enum',()=>{
 const excerpt='Las partes acuerdan documentar la entrega mediante constancia escrita y firmada.';
 const evidence=[{...law,id:'D1',text:`${excerpt} ${quote} Otro apartado menciona 99 días.`,allowedQuotes:[quote]}];
 const before=structuredClone(evidence),p={sourceId:'D1',quote:excerpt,text:'Las partes acuerdan documentar la entrega mediante constancia escrita.'};
 assert.equal(validateMixedOutput(JSON.stringify(legacyOutput(p)),evidence).validation.citationIntegrity,true);
 assert.throws(()=>validateMixedOutput(JSON.stringify({paragraphs:[p]}),evidence),/aprobada/);
 for(const change of [{quote:excerpt+' Inventado.'},{sourceId:'D2'},{quote:'Texto ajeno a la fuente recibida que no puede verificarse.'}]){
  assert.throws(()=>validateMixedOutput(JSON.stringify(legacyOutput({...p,...change})),evidence),/aprobada/);
 }
 assert.throws(()=>validateMixedOutput(JSON.stringify(legacyOutput({...p,text:'Las partes deben documentar la entrega en 99 días.'})),evidence),/respaldo/);
 assert.deepEqual(evidence,before);
});

for(const contract of ['legacy','paragraph-citations-v1']){
 const encode=p=>JSON.stringify(contract==='legacy'?legacyOutput(p):{paragraphs:[p]});
 test(`auto accepts ${contract} while keeping the base runtime paragraph schema`,async t=>{
  const f=await fixture(t,{outputContract:contract==='legacy'?null:contract,response:messages=>encode(legal(JSON.parse(messages[1].content).sources[0]))});
  const stream=[],answer=await ask(f.service,question,{},s=>stream.push(s));
  assert.equal(answer.text,stream.join(''));assert.equal(answer.citations[0].id,'L1');
  assert.equal(answer.validation.citationIntegrity,true);assert.equal(answer.validation.legalAccuracy,'not-evaluated');
  const {messages,options}=f.seen[0];
  assert.equal(messages[0].content,MIXED_INSTRUCTIONS);
  assert.match(messages[0].content,/Devuelve JSON \{"paragraphs":\[\.\.\.\]\}/);
  assert.equal(options.responseFormat,undefined); // inference.mjs defaults to JSON.
  assert.deepEqual(options.outputSchema.required,['paragraphs']);
  assert.deepEqual(options.outputSchema.properties.paragraphs.items.anyOf[0].required,['sourceId','quote','text']);
 });
 for(const [name,alter,pattern] of [
  ['unknown source',p=>({...p,sourceId:'L999'}),/aprobada/],
  ['altered quote',p=>({...p,quote:p.quote+' texto inventado'}),/aprobada/],
  ['unsupported number',p=>({...p,text:'El artículo 99 exige la entrega mediante constancia escrita.'}),/respaldo/],
 ])test(`${contract} rejects ${name} before streaming or saving`,async t=>{
  const f=await fixture(t,{response:messages=>encode(alter(legal(JSON.parse(messages[1].content).sources[0])))}),stream=[];
  await assert.rejects(ask(f.service,question,{},s=>stream.push(s)),pattern);
  assert.deepEqual(stream,[]);assert.equal((await f.service.dispatch('state')).answers.length,0);
  const store=createStore(f.dir);try{assert.equal(store.list('thread-memory').length,0);}finally{store.close();}
 });
}

test('legacy presentation normalization keeps all mixed evidence gates and rejects malformed JSON',()=>{
 const evidence=[{...law,id:'L1',allowedQuotes:[quote]}],p=legal(evidence[0]);
 const output=legacyOutput(p);output.analysis+=`\n\n${conversational.text}`;
 // The old runtime sometimes returned literal newlines inside analysis.
 const raw='```json\n'+JSON.stringify(output).replaceAll('\\n','\n')+'\n```';
 const checked=validateMixedOutput(raw,evidence);
 assert.equal(checked.validation.formatNormalization.count,2);
 assert.equal(checked.citations[0].id,'L1');assert.match(checked.text,/¿Quieres/);
 assert.throws(()=>validateMixedOutput(raw.replace(p.text,'El artículo 99 exige la entrega mediante constancia escrita.'),evidence),/respaldo/);
 assert.throws(()=>validateMixedOutput(raw.replace(conversational.text,'El plazo es de treinta días.'),evidence),{code:'UNGROUNDED_CLAIM'});
 for(const invalid of ['Borrador sintético de la reunión.',JSON.stringify(output).slice(0,-1),JSON.stringify({paragraphs:[p]}).replace('"paragraphs":','"paragraphs" '),JSON.stringify({...output,extra:true})]){
  assert.throws(()=>validateMixedOutput(invalid,evidence),/JSON mixto inválido|Contrato mixto inválido/);
 }
});

for(const literalControls of [false,true])test(`legacy wrapped paragraphs retain evidence gates (literal controls: ${literalControls})`,async t=>{
 const response=messages=>{
  const p=legal(JSON.parse(messages[1].content).sources[0]);
  const output=legacyOutput({...p,text:p.text.replace('debe documentarse','debe\ndocumentarse\t')});
  const raw=JSON.stringify(output);
  return literalControls?raw.replaceAll('\\n','\n').replaceAll('\\t','\t'):raw;
 };
 const f=await fixture(t,{outputContract:null,response}),stream=[];
 const answer=await ask(f.service,question,{},s=>stream.push(s));
 assert.equal(answer.text,stream.join(''));assert.equal(answer.citations[0].id,'L1');
 assert.equal(answer.validation.citationIntegrity,true);
 assert.equal(answer.validation.formatNormalization.count,literalControls?2:0);
 assert.doesNotMatch(answer.text,/[\t\r\n]/);
 const evidence=[{...law,id:'L1',allowedQuotes:[quote]}];
 const raw=response([{},{content:JSON.stringify({sources:evidence})}]);
 assert.throws(()=>validateMixedOutput(raw.replace('constancia escrita','constancia escrita en 99 días'),evidence),/respaldo/);
 assert.throws(()=>validateMixedOutput(raw.replace('[L1]','[L999]'),evidence),/Referencia no autorizada/);
 assert.throws(()=>validateMixedOutput(raw.replace('La entrega sintética', 'La entrega\\u0001sintética'),evidence),/controles/);
});

test('legacy and paragraph contracts preserve multiple sources and enforce each paragraph quote',()=>{
 const otherQuote='La recepción sintética debe registrarse en el expediente mediante un acuse firmado.';
 const evidence=[{...law,id:'L1',allowedQuotes:[quote]},{...law,id:'D1',text:otherQuote,allowedQuotes:[otherQuote]}];
 const paragraphs=[{...legal(evidence[0]),kind:'observacion'},{sourceId:'D1',quote:otherQuote,text:'La recepción sintética debe registrarse mediante un acuse firmado.',kind:'inferencia'}];
 for(const format of ['legacy','paragraph-citations-v1']){
  const encode=ps=>JSON.stringify(format==='legacy'?{analysis:ps.map(p=>`${p.text} [${p.sourceId}]`).join('\n\n'),citations:ps.map(({sourceId,quote})=>({sourceId,quote}))}:{paragraphs:ps});
  const checked=validateMixedOutput(encode(paragraphs),evidence);
  assert.deepEqual(checked.citations.map(c=>c.id),['L1','D1']);
  assert.equal(checked.validation.citationIntegrity,true);
  if(format==='paragraph-citations-v1')assert.match(checked.text,/Posible inferencia:/);
  assert.throws(()=>validateMixedOutput(encode([paragraphs[0],{...paragraphs[1],quote}]),evidence),/aprobada/);
  // Article 1 exists in L1, but cannot substantiate a number in D1's paragraph.
  assert.throws(()=>validateMixedOutput(encode([paragraphs[0],{...paragraphs[1],text:'El artículo 1 exige registrar la recepción mediante un acuse firmado.'}]),evidence),/respaldo/);
 }
});

test('Office greeting and agenda remain text with the installed public fragment index and isolated matters',async t=>{
 const libraryPath=join(process.cwd(),'resources/public-library.sqlite');
 if(!existsSync(libraryPath))return t.skip('Optional installed public library is absent');
 const library=await openPublicLibrary(libraryPath);t.after(()=>library.close());
 const f=await fixture(t,{sources:[],publicLibrary:library,outputContract:null,response:()=> 'Borrador sintético de la reunión.'});
 const a=await f.service.dispatch('matter.create',{title:'Uno',client:'Persona ficticia',jurisdiction:'MX-FED'});
 const b=await f.service.dispatch('matter.create',{title:'Dos',client:'Cliente ficticio',jurisdiction:'MX-FED'});
 await ask(f.service,'Hola, soy NOMBRE_RESERVADO.',{matterId:b.id});
 await f.service.dispatch('document.import',{matterId:a.id,name:'Word - selección.txt',base64:Buffer.from('Convenio sintético de revisión.').toString('base64')});
 const answer=await ask(f.service,'Hola, prepara una agenda.',{matterId:a.id});
 assert.equal(answer.kind,'chat');assert.equal(answer.text,'Borrador sintético de la reunión.');
 assert.deepEqual(answer.citations,[]);assert.ok(f.seen.every(call=>call.options.responseFormat==='text'));
 assert.doesNotMatch(JSON.stringify(f.seen.at(-1).messages),/NOMBRE_RESERVADO/);
 const history=await f.service.dispatch('office.history',{matterId:a.id});
 assert.equal(history.length,1);assert.equal(history[0].id,answer.id);
 const draft=await f.service.dispatch('draft.get',{matterId:a.id,replyId:answer.id});
 const edited=await f.service.dispatch('draft.save',{matterId:a.id,draftId:draft.id,expectedVersion:draft.version,title:'Agenda',text:'Texto editado de prueba.'});
 assert.equal(edited.version,2);
});
