import test from 'node:test';
import assert from 'node:assert/strict';
import {access,mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {decodeOjnHtml,discoverOjnCatalog,parseOjnStatePage} from '../scripts/corpus-discovery-ojn.mjs';

const fixture=path.resolve('tests/fixtures/ojn-state-sample.html');
const captureDirectory=path.resolve('artifacts/legal-library/discovery-2026-11-02/ojn');

test('OJN state parser decodes entities and records GET query plans from the form',async()=>{
  const decoded=decodeOjnHtml(await readFile(fixture));
  assert.equal(decoded.encoding,'utf8');
  const page=parseOjnStatePage(decoded.text,{filename:'estatal-edo7.htm',sourceUrl:'https://www.ordenjuridico.gob.mx/estatal.php?liberado=si&edo=7'});
  assert.equal(page.edoId,7);assert.equal(page.stateName,'Estado Sintético');assert.deepEqual(page.practiceTypeCounts,{leyes:12,codigos:3,reglamentos:8});
  assert.deepEqual(page.typeCounts.map(type=>[type.label,type.count]),[['Ley',12],['Código',3],['Reglamento',8]]);
  assert.match(page.search.phrase.requestTemplate,/busqueda\.php\?frase=\{urlEncodedQuery\}&edo=7/);assert.match(page.search.byType.requestTemplate,/despliegaedo2\.php\?edo=7&ordenar=\{typeId\}&edo=7&idi=&catTipo=\{typeId\}/);
  assert.equal(page.pageUpdateDate,'02/11/2026');assert.deepEqual(page.parseAnomalies,[]);
});

test('OJN decoder handles declared latin-1 bytes as well as HTML entities',()=>{
  const decoded=decodeOjnHtml(Buffer.from('<meta charset="iso-8859-1"><p>C\xf3digo &aacute;</p>','latin1'));
  assert.equal(decoded.encoding,'latin1');assert.match(decoded.text,/Código/u);assert.match(decoded.text,/&aacute;/u);
});

test('OJN catalog sanity-checks saved captures when they are available',async t=>{
  try{await access(captureDirectory);}catch{t.skip('saved OJN captures are not present');return;}
  const temporary=await mkdtemp(path.join(tmpdir(),'lex-ojn-'));t.after(()=>rm(temporary,{recursive:true,force:true}));
  const catalog=await discoverOjnCatalog({inputDir:captureDirectory,catalogPath:path.join(temporary,'index.json'),generatedAt:'2026-11-02T00:00:00.000Z'});
  assert.equal(catalog.totals.states,32);assert.equal(catalog.states.length,32);assert.ok(catalog.states.every(state=>state.provenance.sha256.length===64));
  assert.ok(catalog.states.every(state=>state.stateName));assert.ok(catalog.states.some(state=>state.search.phrase.action?.endsWith('/busqueda.php')));assert.ok(catalog.states.some(state=>state.parseAnomalies.some(anomaly=>/iframe/u.test(anomaly))));assert.equal(catalog.auxiliary.length,4);
});
