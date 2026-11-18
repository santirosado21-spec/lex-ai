import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';
import {createService} from '../server/service.mjs';
import {INCOMPLETE_MESSAGE,RETRY_INSTRUCTION} from '../server/bounded-generation.mjs';

const article='Artículo 333. El resultado sintético debe constar por escrito en la documentación del asunto.';
const fixture=async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'lex-incomplete-'));const corpusPath=path.join(dir,'corpus.json');
 await writeFile(corpusPath,JSON.stringify([{id:'SYNTHETIC-RESULTADO',lawId:'SYNTHETIC-RESULTADO',title:'Ley Sintética del Resultado',article:'333',jurisdiction:'MX-FED',category:'legislation-snapshot',text:article,sha256:createHash('sha256').update(article).digest('hex'),url:'https://www.diputados.gob.mx/synthetic-test',version:'synthetic-only'}]));
 return {dir,corpusPath};
};
// The engine double reads the source the service actually sent (id and approved quote) and answers in the grounded contract.
const reply=(messages,text)=>{const sources=JSON.parse(messages[1].content).sources;const s=sources[0];return JSON.stringify({paragraphs:[{sourceId:s.id,quote:s.allowedQuotes[0],text}]});};
const good='El artículo 333 exige que el resultado conste por escrito, salvo pacto distinto.';
const cutText=('El resultado debe constar por escrito en la documentación del asunto. Además la regla protege a las partes y evita disputas sobre lo acordado, de modo que la ley impone un equilibrio entre quienes firman y por eso el documento '+'sigue siendo necesario para probar el acuerdo y sus condiciones, salvo que el deudor demuestre el pago previo ante notario y el acreedor lo hubiera aceptado por escrito en los términos que fija la ley ').slice(0,350);

async function run(t,generate){
 const {dir,corpusPath}=await fixture();const calls=[];
 const service=await createService({dataDir:path.join(dir,'data'),corpusPath,inference:{async status(){return {state:'ready'};},async *generate(messages,options){calls.push({messages,options});yield* generate(messages,options,calls.length);}}});
 t.after(async()=>{service.close();await rm(dir,{recursive:true,force:true});});
 await service.dispatch('workspace.create',{name:'Prueba sintética',practiceAreas:['civil']});
 return {service,calls,ask:q=>service.analyze({mode:'auto',question:q,threadId:'general'})};
}
const Q='¿Qué dice el artículo 333 de la Ley Sintética del Resultado?';

test('service: cut output, then valid output after exactly one retry that carries the brief instruction',async t=>{
 const {ask,calls}=await run(t,async function*(messages,options,n){yield reply(messages,n===1?cutText:good);});
 const answer=await ask(Q);
 assert.equal(calls.length,2);assert.equal(calls[1].messages.at(-1).content,RETRY_INSTRUCTION);assert.equal(calls[0].messages.length+1,calls[1].messages.length);
 assert.match(answer.text,/salvo pacto distinto/);assert.ok(answer.citations.length>=1);
});
test('service: persistent cut output surfaces an explicit incomplete-response error and no answer text',async t=>{
 const {ask,calls}=await run(t,async function*(messages){yield reply(messages,cutText);});
 await assert.rejects(ask(Q),err=>err.code==='INCOMPLETE_RESPONSE'&&err.message===INCOMPLETE_MESSAGE);
 assert.equal(calls.length,2);
});
test('service: a valid first answer makes exactly one engine call',async t=>{
 const ok=await run(t,async function*(messages){yield reply(messages,good);});
 await ok.ask(Q);assert.equal(ok.calls.length,1);
});
