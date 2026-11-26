import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {reviewIntakeDocument,addReviewSelection} from '../server/privacy/intake-document-review.mjs';
import {bindReviewedDocument} from '../server/privacy/intake-document-map.mjs';
import {availableQuestionFacts,selectQuestionFacts} from '../server/corpus/intake-question-facts.mjs';
import {questionPassage,researchEnvelope,renderResearchNote} from '../server/corpus/intake-research.mjs';
import {quotedRanges,prepareFollowup} from '../server/corpus/intake-followup.mjs';
import {practiceDocument} from '../server/corpus/pilot-protected-case.mjs';

const firm={id:'firm-r16'},entry={id:'matter-r16'};
const withDocument=async(text,hide,extra)=>{
 let review=await reviewIntakeDocument({text,originalHash:createHash('sha256').update(text).digest('hex'),fields:[],suggestions:[]});
 if(hide){const start=text.indexOf(hide);review=addReviewSelection(review,start,start+hide.length);}
 return {firm,entry,intake:{...extra,document:bindReviewedDocument(review,firm.id,entry.id)}};
};
const selection={sourceId:'aduana-65',part:1,angle:'documentos',concepts:['transporte']};
test('a checked complete synthetic source authorizes individual retained clauses, never user prose or a masked clause',async()=>{
 const text=(await readFile('piloto/contraste-ficticio.txt','utf8')).trim();
 const saved=await withDocument(text);
 const offered=availableQuestionFacts(saved);assert.equal(offered.length,3);
 const facts=selectQuestionFacts(saved,[offered[1].id]);
 const source=questionPassage(null,selection,facts),prompt=researchEnvelope(source).messages[0].content;
 assert.ok(prompt.includes('H1 · El precio pagado no incluye el flete.'));
 assert.ok(!prompt.includes('Falta el acuse de los anexos del pedimento.')&&!prompt.includes('TR-ENSAYO')&&!prompt.includes('Importadora Lirio'));
 assert.throws(()=>questionPassage(null,selection,{...facts,texts:['Un hecho inventado']}));
 assert.throws(()=>selectQuestionFacts(saved,[offered[1].id,offered[1].id]));
 const changed=await withDocument(text.replace('480.00','481.00'));
 assert.deepEqual(availableQuestionFacts(changed),[]);assert.throws(()=>selectQuestionFacts(changed,[offered[1].id]));
 const hidden=await withDocument(text,'no incluye el flete');
 assert.ok(!availableQuestionFacts(hidden).some(f=>f.text.includes('flete')));
 const reply={lectura:'El soporte indica que el precio pagado excluye el flete y se requiere cotejar el gasto con su comprobante.',cita:source.body,solicitud:'¿Qué comprobante acredita el gasto de transporte?'};
 const rendered=renderResearchNote(JSON.stringify(reply),source);
 for(const term of ['Lectura preliminar para revisión',reply.lectura,'[[SOPORTE]]',source.condition])assert.ok(rendered.includes(term));
 for(const defective of [{...reply,cita:'Un texto distinto al artículo.'},{...reply,lectura:{trim:'incorrecto'}},{...reply,lectura:'[[CLIENTE]]'},{abstener:true}]){
  const draft=renderResearchNote(JSON.stringify(defective),source);assert.ok(draft.includes('Fundamento pendiente')&&!draft.includes('Lectura preliminar para revisión'));
  assert.deepEqual(quotedRanges(source,draft),[]);
 }
 const follow=prepareFollowup(source,quotedRanges(source,rendered),'control',['pago'],{form:'carta',focus:['factura']});
 assert.ok(follow.synthetic&&follow.prompt.includes('no incluye el flete.')&&follow.prompt.includes(source.condition));
 assert.ok(follow.prompt.includes('Turno anterior\nSolicitud al cliente · factura comercial.')&&!follow.prompt.includes(reply.lectura));
 assert.throws(()=>prepareFollowup(source,quotedRanges(source,rendered),'control',[],{form:'carta',focus:['Nombre local']}));
});

test('a generated exercise projects protected facts while restored source evidence stays local',async()=>{
 // aduana-65 resolves its pinned public passage without the optional SQLite library.
 const lib=new Proxy({},{get(){throw Error('This exercise must not read the optional public library.');}});
 const seed='00'.repeat(12),sample=practiceDocument(seed);
 const text=sample.text;
 const fields=[sample.client,sample.title,sample.supplier,sample.email].map(value=>({value}));
 let review=await reviewIntakeDocument({text,originalHash:createHash('sha256').update(text).digest('hex'),fields:[],suggestions:[...fields.map(x=>x.value),'Canadá']});
 const saved={firm,entry,intake:{practiceSeed:seed,document:bindReviewedDocument(review,firm.id,entry.id)}};
 const offered=availableQuestionFacts(saved);assert.equal(offered.length,2);assert.ok(offered[0].text.includes('[dato protegido]'));
 const fact=selectQuestionFacts(saved,[offered[0].id]),source=questionPassage(lib,selection,fact);
 for(const secret of ['Canadá',sample.email,sample.supplier,sample.title,sample.client,saved.intake.document.snapshot.namespace])assert.ok(!source.prompt.includes(secret));
 assert.ok(fact.evidence.excerpt.includes('Canadá'));assert.ok(!source.prompt.includes(sample.facts[1]));
 review=addReviewSelection(review,text.indexOf('Falta la información'),text.indexOf('Falta la información')+5);
 saved.intake.document=bindReviewedDocument(review,firm.id,entry.id);
 assert.equal(availableQuestionFacts(saved).length,1);
});
