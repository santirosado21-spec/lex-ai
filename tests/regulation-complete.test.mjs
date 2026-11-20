import assert from 'node:assert/strict';
import test from 'node:test';
import {regulationDirectory,regulationPassage} from '../server/corpus/customs-edition.mjs';
import {regulationSearch} from '../server/corpus/regulation-search.mjs';
import {questionCandidates} from '../server/corpus/intake-question.mjs';
import {questionPassage,renderResearchNote} from '../server/corpus/intake-research.mjs';
import {prepareFollowup,quotedRanges} from '../server/corpus/intake-followup.mjs';

test('the complete edition keeps article boundaries, repeals, legacy locators and verified excerpts across pages',()=>{
 const dir=regulationDirectory();assert.equal(dir.length,282);assert.equal(dir.filter(r=>r.repealed).length,10);
 for(const row of dir)assert.ok(row.passages.at(-1).text.trim()&&regulationPassage(row.article).passages.length);
 assert.equal(regulationPassage('150').passages.length,2);
 const main=questionPassage(null,{sourceId:'reg-aduana-6-A',part:0,angle:'documentos'});
 assert.match(main.ref.locator,/pp\. 3–4/);assert.match(main.prompt,/firma electrónica avanzada/);assert.match(main.prompt,/se deberá efectuar un nuevo registro/);
 assert.ok(!main.prompt.includes('La referida información y documentación, así como el acuse')); // Next article
 const quote='Cuando con motivo del cambio de nombre, denominación o razón social se modifique la clave del registro federal de contribuyentes del usuario, se deberá efectuar un nuevo registro ante el Sistema Electrónico Aduanero, en un plazo no mayor a diez días siguientes a la respectiva modificación.';
 assert.ok(main.ref.text.includes(quote));
 const answer={cita:quote,lectura:'Ante un cambio de razón social conviene cotejar si se modificó la clave fiscal y si se tramitó el nuevo registro correspondiente.',solicitud:'¿Qué documento permite verificar el nuevo registro?'};
 const draft=renderResearchNote(JSON.stringify(answer),main);assert.ok(draft.includes(answer.lectura)&&draft.includes(quote));
 const ranges=quotedRanges(main,draft);assert.equal(ranges.length,1);assert.ok(prepareFollowup(main,ranges,'control').prompt.includes(quote));
 assert.match(renderResearchNote(JSON.stringify({...answer,cita:'Otro texto que corresponde al artículo siguiente.'}),main),/Fundamento pendiente/);
 assert.match(regulationPassage('78').ref.text,/Derogado/);
});
test('regulation lookup by topic and by article never substitutes the statute or a different state',()=>{
 const terms='sello digital correo electrónico avisos de disponibilidad';
 assert.equal(regulationSearch(terms)[0],'6-A');assert.deepEqual(regulationSearch('ARTÍCULO 174'),['174']);assert.deepEqual(regulationSearch('xyzzzyyyy'),[]);
 const subject='¿Dónde se revisan los avisos de disponibilidad y el correo electrónico en el Reglamento de la Ley Aduanera?';
 const found=questionCandidates(null,subject,[{text:subject}]);assert.ok(found.some(row=>row.source==='reg-aduana-6-A'));
 assert.ok(found.every(row=>row.source.startsWith('reg-aduana-')));
 const hit=found.find(row=>row.source==='reg-aduana-6-A');
 const publicPrompt=questionPassage(null,{sourceId:hit.source,part:hit.part,regulationFocus:hit.regulationFocus,angle:'documentos'}).prompt;
 assert.match(publicPrompt,/Pasaje público relacionado/);assert.ok(!publicPrompt.includes(subject));
 assert.throws(()=>questionPassage(null,{sourceId:hit.source,part:0,regulationFocus:'texto libre',angle:'documentos'}));
 const named='Artículo 6-A del Reglamento de la Ley Aduanera';
 assert.deepEqual(questionCandidates(null,named,[{text:named}]).map(r=>r.key),['reg-aduana-6-A/0']);
 assert.deepEqual(questionCandidates(null,named,[],{state:true}),[]);
 for(const [question,expected] of [
  ['¿Cómo se relaciona el artículo 117 de la Ley Aduanera con el Reglamento de la Ley Aduanera?','aduana-117'],
  ['Según la Ley Aduanera, ¿qué aporta el artículo 117 del Reglamento de la Ley Aduanera?','reg-aduana-117'],
  ['Compara la Ley Aduanera y el Reglamento de la Ley Aduanera respecto al artículo 117.',null],
 ]){
  const sources=new Set(questionCandidates(null,question,[]).map(r=>r.source));
  assert.deepEqual(sources,new Set(expected?[expected]:[]));
 }
});
