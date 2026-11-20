import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {productOriginLookup,productOriginSuggestions,productOriginId,productOriginRef,productOriginAttachment} from '../server/corpus/product-origin.mjs';
import {questionCandidates} from '../server/corpus/intake-question.mjs';
import {questionPassage,renderResearchNote} from '../server/corpus/intake-research.mjs';

test('printed chapters, ranges, national subdivisions and footnotes keep the original edition and page',()=>{
  const chapters=productOriginLookup('').groups;
  assert.equal(chapters.length,96);
  assert.equal(productOriginLookup('capítulo 77').groups.length,0);
  assert.equal(productOriginLookup('CAFE').groups[0].number,9);
  assert.deepEqual(productOriginLookup('0902300000').groups[0].rows.map(x=>x.label),['0902.10-0902.40']);
  assert.equal(productOriginLookup('1806.10.01').groups[0].rows.length,2);
  const rows=chapters.flatMap(c=>productOriginLookup(String(c.number)).groups[0].rows);
  assert.equal(rows.length,1032);assert.equal(rows.filter(r=>r.quote).length,507);
  for(const r of rows)assert.ok(r.page>=86&&r.page<=187&&r.localUrl.endsWith('#page='+r.page));
  for(const [q,n] of [['4009.11',1],['4009.21',3],['8414.30',20]]){
    const [r]=productOriginLookup(q).groups[0].rows;
    assert.equal(r.footnote,n);assert.equal(r.quote,undefined);
  }
  assert.throws(()=>productOriginRef(productOriginId,0));
  const cocoa=productOriginLookup('cacao').cocoa;
  assert.match(cocoa.text,/1806\.10\.01 · Con un contenido/);assert.match(cocoa.text,/no se aplicará a:/);
  assert.equal(createHash('sha256').update(productOriginAttachment(cocoa.localUrl.split('#')[0]).bytes).digest('hex'),cocoa.pdfSha256);
});

test('private inquiry selects only verified public text, with a literal citation and local source notes',()=>{
  const q='¿Qué documento de Taller Noche explica la subpartida 0902.30 según el Anexo 4-B del T-MEC?';
  const [choice]=questionCandidates(null,q,[{text:q}]);
  const note=questionPassage(null,{sourceId:choice.source,part:choice.part,angle:'documentos'});
  assert.match(note.prompt,/otra subpartida dentro de ese grupo/);assert.match(note.prompt,/mercancías agrícolas y hortícolas/);
  assert.ok(!note.prompt.includes('Taller Noche'));assert.match(note.prompt,/notas de la sección/);
  const resp={cita:note.ref.quote,lectura:'Conviene verificar la clasificación de los insumos y la de la mercancía terminada.',solicitud:'¿Qué documento acredita el cambio de clasificación?'};
  assert.match(renderResearchNote(JSON.stringify(resp),note),/TMEC-4B-0902\.10-0902\.40/);
  assert.match(renderResearchNote(JSON.stringify({...resp,cita:'Un supuesto criterio que no aparece en el Diario Oficial'}),note),/Fundamento pendiente/);
  for(const s of ['Renglón 09.01 de la página 88','Renglón 8414.30 de la página 139','subpartida 9999.10']){
    assert.deepEqual(productOriginSuggestions(s+' del Anexo 4-B del T-MEC'),[]);
  }
  const abstention=renderResearchNote('{"abstener":true}',note);
  assert.match(abstention,/Fundamento pendiente/);assert.ok(abstention.includes(note.ref.text));assert.ok(!abstention.includes('Lectura preliminar de OpenAI'));
  assert.deepEqual(productOriginSuggestions('partida 09.01 del Anexo 4-B de otro acuerdo'),[]);
});

test('cocoa review accepts an extended source-backed reading and rejects an invented quote',()=>{
  const ref=productOriginRef(productOriginId,1);
  const note=questionPassage(null,{sourceId:productOriginId,part:1,angle:'documentos'});
  const reading='La regla de la fracción mexicana específica exige un cambio desde cualquier otra partida; la regla general de la subpartida añade límites de composición para azúcar y cacao en polvo no originarios. La tabla identifica la fracción por su contenido de azúcar, pero falta acreditar la clasificación, composición, peso y origen de los insumos.';
  const result={lectura:reading,cita:'Un cambio a la fracción arancelaria 1806.10.aa de cualquier otra partida.',solicitud:'¿Qué ficha técnica o análisis acredita la composición y clasificación del producto?'};
  assert.ok(renderResearchNote(JSON.stringify(result),note).includes(reading));
  assert.ok(!renderResearchNote(JSON.stringify({...result,cita:'Cualquier origen es suficiente para la preferencia solicitada.'}),note).includes(reading));
  assert.ok(note.prompt.includes(ref.text));
});
