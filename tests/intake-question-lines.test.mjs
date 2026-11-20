import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {reviewIntakeDocument} from '../server/privacy/intake-document-review.mjs';
import {bindReviewedDocument} from '../server/privacy/intake-document-map.mjs';
import {questionLines} from '../server/corpus/intake-question-lines.mjs';
import {selectQuestionFacts} from '../server/corpus/intake-question-facts.mjs';
import {questionPassage,renderResearchNote} from '../server/corpus/intake-research.mjs';
import {prepareFollowup,quotedRanges} from '../server/corpus/intake-followup.mjs';
const selection={sourceId:'aduana-65',part:1,angle:'documentos',concepts:['transporte']};
const reply=source=>({lectura:'El pago vinculado con [[PARTE_1]] merece cotejo con el recibo del transportista.',cita:source.body,solicitud:'¿Qué recibo comprueba el pago del flete?'});
async function doc(text,id,suggestions=[]){
 const review=await reviewIntakeDocument({text,originalHash:createHash('sha256').update(text).digest('hex'),fields:[],suggestions});
 return {id,label:'Título reservado '+id,document:bindReviewedDocument(review,'firma','asunto')};
}
const saved=(a,...b)=>({firm:{id:'firma',name:'Firma de ensayo'},entry:{id:'asunto',client:'Importador de prueba',title:'Caso de prueba'},intake:{document:a.document,primarySource:a,supports:b}});
const sample=async name=>(await readFile('piloto/'+name+'-practica.txt','utf8')).trim();

test('new synthetic document lines share reversible temporary references while ordinary documents remain local',async()=>{
 const a=await doc(await sample('carta-porte'),'carta'),b=await doc(await sample('recibo-porte'),'recibo');
 const extra=await doc('Texto ficticio original. Sólo consta el escrito JAS-71928.','propio',['JAS-71928']);
 const matter=saved(a,b,extra);
 const rows=[a,b,extra].map(x=>questionLines(matter,x.id));
 const picks=[rows[0][2],rows[1][2],rows[2][0]];
 assert.deepEqual(picks.map(r=>r.cloud),[true,true,false]);assert.ok(picks.every(r=>!r.masked.includes('CPV-904153')));
 const facts=selectQuestionFacts(matter,picks.map(r=>r.id)),source=questionPassage(null,selection,facts);
 assert.equal(facts.texts.length,2);assert.equal(facts.aliases.length,1);assert.equal(facts.localCount,1);
 for(const text of facts.texts)assert.match(text,/\[\[PARTE_1\]\]/);
 for(const literal of ['JAS','Sólo consta','CPV-904153','CTR-781259','Título reservado','[[DATO_'])assert.ok(!source.prompt.includes(literal));
 const draft=renderResearchNote(JSON.stringify(reply(source)),source);
 assert.ok(draft.includes(facts.aliases[0].local)&&!draft.includes('[[PARTE_1]]')&&draft.includes('[[SOPORTE]]'));
 for(const wrong of ['[[PARTE_2]]','[[CLIENTE]]','[[PARTE_01]]']){
  const bad=renderResearchNote(JSON.stringify({...reply(source),lectura:reply(source).lectura.replace('[[PARTE_1]]',wrong)}),source);
  assert.match(bad,/Fundamento pendiente/);assert.doesNotMatch(bad,/Lectura preliminar de OpenAI/);
 }
 const follow=prepareFollowup(source,quotedRanges(source,draft),'control');
 assert.ok(follow.prompt.includes('[[PARTE_1]]')&&!follow.prompt.includes('JAS-71928'));
 const onlyPrivate=selectQuestionFacts(matter,[picks[2].id]),publicSource=questionPassage(null,selection,onlyPrivate);
 assert.equal(publicSource.prompt,questionPassage(null,selection).prompt);
 const publicNote=renderResearchNote(JSON.stringify({cita:source.body,solicitud:reply(source).solicitud}),publicSource);
 assert.ok(publicNote.includes('[[SOPORTE]]')&&!publicNote.includes('Lectura preliminar de OpenAI'));
 assert.ok(!prepareFollowup(publicSource,quotedRanges(publicSource,publicNote),'control').synthetic);
 const modified=saved(await doc((await sample('carta-porte')).replace('por separado','en la venta'),'carta'));
 assert.ok(questionLines(modified,'carta').every(r=>!r.cloud));assert.throws(()=>selectQuestionFacts(modified,[picks[0].id]));
 assert.throws(()=>questionLines(matter,'otro-asunto'));
});
test('a later document can supply an exact identity missed on the first import and invalidate the old projection',async()=>{
 const a=await doc('El código maviquero consta en el anexo de pago.','a');
 const b=await doc('Se comentó maviquero en el expediente.','b',['maviquero']);
 const prior=questionLines(saved(a),'a')[0],updated=questionLines(saved(a,b),'a')[0];
 assert.ok(prior.masked.includes('maviquero'));assert.ok(!updated.masked.includes('maviquero'));assert.notEqual(prior.id,updated.id);
 assert.throws(()=>selectQuestionFacts(saved(a,b),[prior.id]));
});

test('an invalid attached map cannot contribute a token from another matter',async()=>{
 const source=await doc('Se recibió la factura.','a'),other=await doc('Se agregó el recibo NARA-11298.','b',['NARA-11298']);
 const original='Texto de otro asunto.';
 const review=await reviewIntakeDocument({text:original,originalHash:createHash('sha256').update(original).digest('hex'),fields:[],suggestions:[]});
 other.document=bindReviewedDocument(review,'firma','otro-asunto');
 assert.throws(()=>questionLines(saved(source,other),'a'));
});
