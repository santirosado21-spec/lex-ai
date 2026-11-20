import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {originAnnexAttachment,originAnnexDirectory,originAnnexSuggestions} from '../server/corpus/origin-annex.mjs';
import {questionCandidates} from '../server/corpus/intake-question.mjs';
import {questionPassage,renderResearchNote} from '../server/corpus/intake-research.mjs';

test('nine T-MEC elements keep the full cited passage and its original physical page',()=>{
 const refs=originAnnexDirectory();
 assert.deepEqual(refs.map(row=>row.point),[1,2,3,4,5,6,7,8,9]);
 const study=refs[5];assert.match(study.locator,/17–18/);
 assert.ok(study.text.includes('(a)')&&study.text.includes('(b)')&&study.text.includes('de conocerse'));
 const pdf=originAnnexAttachment(study.localUrl.split('#')[0]);
 assert.equal(createHash('sha256').update(pdf.bytes).digest('hex'),study.pdfSha256);
 assert.equal(originAnnexAttachment('/fuentes/otro.pdf'),null);
 const q='¿Qué documentos respaldan el numeral 4 del Anexo 5-A del T-MEC para Tramas Río?';
 const choices=questionCandidates(null,q,[{text:q}]);
 assert.equal(choices.length,1);assert.equal(choices[0].citationId,'TMEC-5A-4');
 assert.deepEqual(originAnnexSuggestions('Anexo 5-A de otro tratado'),[]);
 assert.deepEqual(questionCandidates(null,q.replace('numeral 4','numeral 10'),[{text:q}]),[]);
 const note=questionPassage(null,{sourceId:choices[0].source,part:4,angle:'documentos'});
 assert.ok(!note.prompt.includes('Tramas Río')&&note.prompt.includes('Disponible a solicitud'));
 const answer=JSON.stringify({cita:note.ref.text.slice(0,70),lectura:'Conviene cotejar la identidad del productor y el lugar declarado en la certificación.',solicitud:'¿Qué registro acredita el lugar de producción?'});
 assert.ok(renderResearchNote(answer,note).includes(note.ref.text));
 assert.match(renderResearchNote(answer.replace(note.ref.text.slice(0,70),'Una oración sin fuente oficial verificable'),note),/Fundamento pendiente/);
});
