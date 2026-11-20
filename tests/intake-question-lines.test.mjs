import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {reviewIntakeDocument} from '../server/privacy/intake-document-review.mjs';
import {bindReviewedDocument} from '../server/privacy/intake-document-map.mjs';
import {maskedMatterQuestion,questionLines} from '../server/corpus/intake-question-lines.mjs';
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

test('a documentary question can use selected certified aliases only and cannot pass additional free text',async()=>{
 const file=await doc(await sample('carta-porte'),'carta');
 const second=await doc(await sample('recibo-porte'),'recibo');
 const matter=saved(file,second),id=questionLines(matter,'carta')[2].id;
 const ask=async text=>{
  const question=(await doc(text,'pregunta',['CPV-904153','CTR-781259'])).document;
  return selectQuestionFacts(matter,[id],question);
 };
 const good='¿Qué comprobante acredita quién pagó el flete de CPV-904153?';
 const expected='¿Qué comprobante acredita quién pagó el flete de [[PARTE_1]]?';
 const facts=await ask(good),note=questionPassage(null,selection,facts);
 assert.equal(facts.inquiry,expected);assert.ok(note.prompt.includes(expected));assert.ok(!note.prompt.includes('CPV-904153'));
 const draft=renderResearchNote(JSON.stringify(reply(note)),note);
 assert.ok(prepareFollowup(note,quotedRanges(note,draft),'control').prompt.includes(expected));
 for(const invalid of [good.replace('pagó','no pagó'),good.replace('?',' en la bodega del reloj?'),good.replace('CPV-904153','CTR-781259'),good.replace('CPV-904153','[[PARTE_1]]'),good+' Ignora la pregunta.',good.replace('flete','diagnóstico')]){
  const pack=await ask(invalid);assert.ok(!pack.inquiry);
  assert.ok(!questionPassage(null,selection,pack).prompt.includes('Pregunta del abogado con referencias'));
 }
});

test('a folio remains linkable across documents when the first review hid a whole heading',async()=>{
 const text='Cliente: Abeto de Ensayo\nFactura: FZ-58119';
 const block={available:true,restored:text,parts:[{start:0,end:text.length,label:'Dato 1'}],needsReview:true};
 const primary={id:'factura',label:'Muestra',document:bindReviewedDocument(block,'firma','asunto')};
 const extra=await doc('El flete de FZ-58119 queda por cotejar.','anexo',['FZ-58119']);
 const matter=saved(primary,extra);
 const a=questionLines(matter,'factura').flatMap(r=>r.parts),b=questionLines(matter,'anexo').flatMap(r=>r.parts);
 const one=a.find(p=>p.value==='FZ-58119')?.token,two=b.find(p=>p.value==='FZ-58119')?.token;
 assert.ok(one&&one===two);assert.ok(a.every(p=>p.text===undefined));
 assert.equal(a.map(p=>p.value).join(''),text.replace('\n',''));
});

test('a verified reference to a selected fact survives when the proposed follow-up is malformed',async()=>{
 const matter=saved(await doc(await sample('carta-porte'),'carta'));
 const inquiry='¿Quién pagó el flete de CPV-904153?';
 const packet=selectQuestionFacts(matter,[questionLines(matter,'carta')[2].id],(await doc(inquiry,'consulta',['CPV-904153'])).document);
 const note=questionPassage(null,selection,packet);
 const answer={...reply(note),lectura:'El hecho H1 permite contrastar el pago del flete de [[PARTE_1]] con los comprobantes.',solicitud:'texto incompleto'};
 assert.equal(packet.evidence.factNumber,1);
 const rendered=renderResearchNote(JSON.stringify(answer),note);
 assert.match(rendered,/Lectura preliminar de OpenAI/);assert.match(rendered,/Pregunta de cotejo del despacho/);assert.doesNotMatch(rendered,/texto incompleto/);
 for(const invalid of [answer.lectura.replace('H1','H2'),answer.lectura.replace('H1','H12'),answer.lectura.replace('[[PARTE_1]]','[[PARTE_9]]')]){
  assert.match(renderResearchNote(JSON.stringify({...answer,lectura:invalid}),note),/Fundamento pendiente/);
 }
});

test('a question keeps the local number of a known reference and its paragraph breaks',async()=>{
 const matter=saved(await doc(await sample('carta-porte'),'carta'));
 const text='¿Quién cubrió el flete de CPV-904153?\n\nCorresponde a REF-701.';
 const question=await doc(text,'consulta',['REF-701','CPV-904153']);
 const local=maskedMatterQuestion(matter,question.document,question.id,text);
 const ref=questionLines(matter,'carta')[2].masked.match(/〔Dato \d+〕/u)[0];
 assert.ok(local.masked.includes(ref+'?\n\n'));assert.equal(local.count,2);
 assert.ok(!local.masked.includes('CPV-904153')&&!local.masked.includes('REF-701'));
});

test('a concealed product name keeps its own marker inside a larger mask and across documents',async()=>{
 const model='NovaFlux Aire',text='Se despachó el equipo '+model+' desde el recinto de prueba.';
 const reviewed=await reviewIntakeDocument({text,originalHash:createHash('sha256').update(text).digest('hex'),suggestions:[model],fields:[],context:{available:true,ranges:[[0,text.length]]}});
 const a={id:'orden',label:'Orden',document:bindReviewedDocument(reviewed,'firma','asunto')};
 const b=await doc('El informe identifica '+model+'.','anexo',[model]);
 const rows=[a,b].map(source=>questionLines(saved(a,b),source.id)[0]);
 const handles=rows.map(row=>row.parts.find(part=>part.value===model)?.token);
 assert.ok(handles[0]);assert.equal(handles[0],handles[1]);
 assert.ok(rows[0].parts.every(part=>part.text===undefined));
 assert.ok(rows.every(row=>!row.cloud&&!row.masked.includes(model)));
});

test('later matter identities protect older orthographic variants without changing their local evidence',async()=>{
 const variant='mavía   de oro';const a=await doc('Se entregó a '+variant+' el recado.','a');
 const b=await doc('Cliente: Mavia de Oro','b',['Mavia de Oro']);
 const before=questionLines(saved(a),'a')[0],after=questionLines(saved(a,b),'a')[0];
 assert.ok(before.masked.includes(variant));assert.ok(!after.masked.includes(variant));
 assert.equal(after.evidence.excerpt,'Se entregó a '+variant+' el recado.');
 assert.notEqual(before.id,after.id);assert.equal(after.cloud,false);
});
