import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {extractDocument} from '../server/extraction.mjs';
import {reviewIntakeDocument} from '../server/privacy/intake-document-review.mjs';
import {bindReviewedDocument} from '../server/privacy/intake-document-map.mjs';
import {sourceSummary} from '../server/intake-sources.mjs';
import {questionLines} from '../server/corpus/intake-question-lines.mjs';
import {selectQuestionFacts} from '../server/corpus/intake-question-facts.mjs';
import {questionPassage,renderResearchNote} from '../server/corpus/intake-research.mjs';
import {originAnnexId} from '../server/corpus/origin-annex.mjs';
import {producerResult} from '../server/corpus/producer-comparison.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const choice={sourceId:originAnnexId,part:4,angle:'documentos'};
async function document(text,fields=[]){
 const review=await reviewIntakeDocument({text,originalHash:hash(text),suggestions:[],fields});
 return bindReviewedDocument(review,'despacho','expediente');
}
function matter(source){
 return {firm:{id:'despacho',name:'Despacho ficticio'},entry:{id:'expediente',client:'Ensayo',title:'Asunto de origen'},
  intake:{document:source.document,primarySource:source,supports:[]}};
}

test('an approved workbook binds both byte and text fingerprints, privacy review and lawyer-selected cells',async()=>{
 const bytes=await readFile('piloto/certificacion-discrepancia-ficticia.xlsx');
 const {text}=await extractDocument('soporte.xlsx',bytes.toString('base64'),{spreadsheet:true});
 const folio='OCE-41857';
 const source={id:'doc-1',label:'Archivo de ensayo',byteHash:hash(bytes),extension:'xlsx',contextComplete:true,document:await document(text,[folio])};
 const saved=matter(source);
 const question=sourceSummary(source).practiceQuestion;
 assert.ok(question.includes(folio));
 const picks=questionLines(saved,source.id).filter(row=>row.cloud);
 assert.equal(picks.length,2);
 const ids=picks.map(row=>row.id);
 const protectedQuestion=await document(question,[folio,'T-MEC','Anexo 5-A']);
 const pack=selectQuestionFacts(saved,ids,protectedQuestion);
 assert.equal(pack.aliases.length,1);assert.deepEqual(pack.evidence.additional.map(e=>e.factNumber),[2]);
 const research=questionPassage(null,choice,pack);
 for(const term of [folio,'Hoja 1','Archivo de ensayo'])assert.ok(!research.prompt.includes(term));
 assert.ok(research.prompt.includes('folio [[PARTE_1]] declara varios productores.'));
 assert.equal(pack.inquiry,'¿Qué debe aclararse sobre los productores del folio [[PARTE_1]]?');
 for(const altered of [{...source,byteHash:'0'.repeat(64)},{...source,contextComplete:false},{...source,document:await document(text+' Nota distinta.',[folio])}]){
  assert.equal(sourceSummary(altered).practiceQuestion,undefined);
  assert.ok(questionLines(matter(altered),source.id).every(row=>!row.cloud));
 }
 const edited=await document(question.replace('productores','productores del norte'),[folio]);
 assert.equal(selectQuestionFacts(saved,ids,edited).inquiry,undefined);
 saved.intake.reservations=[{text:'declara varios'}];
 assert.ok(!questionLines(saved,source.id).some(row=>row.id===ids[0]));
 assert.throws(()=>selectQuestionFacts(saved,ids,protectedQuestion));
 const response={lectura:'H1 y H2 describen cantidades diferentes para [[PARTE_1]] que requieren cotejo con la lista.',cita:research.ref.text.slice(0,50),solicitud:'¿Qué lista identifica a los productores?'};
 assert.ok(!renderResearchNote(JSON.stringify(response),research).includes('Fundamento pendiente'));
 assert.match(renderResearchNote(JSON.stringify({...response,lectura:response.lectura.replace(' y H2','')}),research),/Fundamento pendiente/);
});

test('private comparisons use only the two declared roles and the same public request for all outcomes',async()=>{
 let prompt;
 for(const [a,b,result] of [['13','24','difieren'],['31','31','coinciden'],['varios','2','pendiente'],
  ['El registro del folio OP-797 menciona dos productores.','La certificación del folio OP-796 indica un productor.','pendiente'],
  ['El registro identifica un productor.','La certificación declara un productor.','pendiente'],['No hay cuatro productores','4','pendiente'],['02/11/2026','1','pendiente'],['2.5','1','pendiente'],
  ['Resultado guardado de fórmula · 4','4','pendiente'],['La certificación del folio Q-55 declara un solo productor.','El registro del folio Q-55 indica múltiples productores.','difieren']]){
  assert.equal(producerResult(a,b).key,result);
  const text='Hoja 1 · A1 | '+a+'\nHoja 1 · B3 | '+b;
  const source={id:'doc',label:'Soporte local',document:await document(text)};
  const saved=matter(source),ids=questionLines(saved,'doc').map(row=>row.id);
  const pack=selectQuestionFacts(saved,ids,null,{localOnly:true});
  const reversed=selectQuestionFacts(saved,[...ids].reverse(),null,{localOnly:true});
  assert.ok(reversed.evidence.excerpt.endsWith(b));assert.ok(pack.evidence.excerpt.endsWith(a));assert.deepEqual(pack.texts,[]);
  const note=questionPassage(null,{...choice,compareProducers:true},pack);
  if(prompt)assert.equal(note.prompt,prompt);prompt=note.prompt;
  const reply={cita:note.body.slice(0,72),coinciden:'Comprueba la identidad y el lugar de producción.',difieren:'Concilia los soportes con la lista de productores.',pendiente:'Solicita la documentación que indique la cantidad de productores.'};
  const draft=renderResearchNote(JSON.stringify(reply),note);
  assert.ok(draft.includes(reply[result]));assert.ok(draft.includes('[[SOPORTE]]'));
  assert.match(renderResearchNote(JSON.stringify({...reply,cita:'Cita ficticia que no figura en el tratado consultado.'}),note),/Fundamento pendiente/);
  assert.throws(()=>questionPassage(null,{...choice,part:3,compareProducers:true},pack));
 }
});
