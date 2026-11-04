import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {createService} from '../server/service.mjs';
async function fixture(t){
 const dir=await mkdtemp(path.join(os.tmpdir(),'lex-unified-'));const calls=[];
 const inference={async *generate(messages,options){calls.push({messages,options});if(options.responseFormat==='text'){yield 'Podemos organizar tu trabajo. ¿Qué necesitas preparar?';return;}const prompt=JSON.parse(messages[1].content),s=prompt.sources[0];yield JSON.stringify({analysis:`El fragmento disponible requiere revisión antes de una conclusión jurídica [${s.id}].`,citations:[{sourceId:s.id,quote:s.allowedQuotes[0]}]});}};
 const service=await createService({dataDir:dir,corpusPath:path.resolve('resources/legal-corpus.json'),inference});
 t.after(()=>{service.close();return rm(dir,{recursive:true,force:true});});
 await service.dispatch('workspace.create',{name:'Despacho sintético unificado',practiceAreas:['penal']});return {service,calls};
}
test('single automatic conversation switches to public legal evidence without a matter or manual mode',async t=>{
 const {service,calls}=await fixture(t);
 const chat=await service.analyze({mode:'auto',skillId:'auto',question:'Hola, soy abogado penal. ¿Cómo puedes ayudarme?'});assert.equal(chat.kind,'chat');
 const answer=await service.analyze({mode:'auto',skillId:'auto',question:'Explica el artículo 1797 del Código Civil Federal.'});assert.equal(answer.kind,'grounded');assert.equal(answer.matterId,'');assert.ok(answer.validation.citationIntegrity);assert.equal(answer.citations[0].jurisdiction,'MX-FED');assert.match(answer.citations[0].article,/1797/);
 const follow=await service.analyze({mode:'auto',skillId:'auto',question:'Hazlo más breve.'});assert.ok(follow.validation.citationIntegrity);assert.match(follow.citations[0].article,/1797/);
 await service.analyze({mode:'auto',skillId:'auto',question:'Redacta un correo de reunión.'});assert.equal(calls.at(-1).options.responseFormat,'text');assert.ok(calls.at(-1).messages.some(m=>m.content.includes('1797')));
 const state=await service.dispatch('state');assert.equal(state.chatTurns.length,2);assert.equal(state.answers.length,2);assert.equal(state.documents.length,0);assert.equal(state.matters.length,0);
});
test('document intent requests missing context and does not read another matter or run the model',async t=>{
 const {service,calls}=await fixture(t);
 const matter=await service.dispatch('matter.create',{title:'Asunto privado sintético',client:'Parte ficticia',jurisdiction:'MX-CMX'});
 await service.dispatch('document.import',{matterId:matter.id,name:'contrato.txt',base64:Buffer.from('CANARIO_AJENO Contrato sintético de otro asunto con obligaciones de pago y entrega.').toString('base64')});
 const reply=await service.analyze({mode:'auto',skillId:'auto',question:'Analiza mi contrato.'});assert.equal(reply.validation.status,'needs-document');assert.equal(calls.length,0);
 await service.analyze({mode:'auto',skillId:'auto',question:'Explica el artículo 1797 del CCF.'});assert.doesNotMatch(JSON.stringify(calls),/CANARIO_AJENO/);
 await assert.rejects(service.analyze({mode:'auto',skillId:'auto',matterId:'other-firm-matter',question:'Hola'}),/no encontrado/);
 await assert.rejects(service.analyze({mode:'auto',skillId:'unknown',question:'Hola'}),/Skill/);
});
test('aborted automatic clarification never persists a turn',async t=>{
 const {service}=await fixture(t);const c=new AbortController();
 await assert.rejects(service.analyze({mode:'auto',question:'Analiza mi contrato.'},()=>c.abort(),{signal:c.signal}),/abort/i);
 assert.equal((await service.dispatch('state')).chatTurns.length,0);
});
test('automatic legal conversation asks for missing local scope instead of substituting federal law',async t=>{
 const {service,calls}=await fixture(t);
 const local=await service.analyze({mode:'auto',question:'¿Cómo puedo tramitar mi divorcio?'});assert.equal(local.validation.status,'needs-jurisdiction');assert.match(local.text,/estado/);
 const unsupported=await service.analyze({mode:'auto',question:'¿Cómo puedo tramitar mi divorcio en Jalisco?'});assert.equal(unsupported.validation.status,'needs-jurisdiction-source');assert.equal(calls.length,0);
 const lookup=await service.analyze({mode:'auto',question:'Busca el Código Civil de Jalisco.'});assert.equal(lookup.validation.status,'needs-jurisdiction-source');assert.equal(calls.length,0);
 const explicit=await service.analyze({mode:'auto',question:'Explica el artículo 1797 del Código Civil para el Distrito Federal en CDMX.'});assert.equal(explicit.citations[0].jurisdiction,'MX-CMX');
 await service.analyze({mode:'auto',question:'¿Qué dice el Código Civil para el Distrito Federal sobre el consentimiento?'});
 const follow=await service.analyze({mode:'auto',question:'¿Y qué significa eso?'});assert.ok(follow.citations.length);assert.ok(follow.citations.every(c=>c.jurisdiction==='MX-CMX'));
});
