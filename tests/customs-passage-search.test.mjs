import test from 'node:test';
import assert from 'node:assert/strict';
import {searchCustomsPassages} from '../server/corpus/customs-search.mjs';
import {customsDirectory,customsPassage} from '../server/corpus/customs-edition.mjs';
test('search uses pinned selected passages and preserves exact text, locator, page, condition and warning',()=>{
 const hits=searchCustomsPassages('REGALIAS');assert.ok(hits.some(h=>h.article==='65'));
 assert.deepEqual(hits,searchCustomsPassages('regalías'));
 for(const hit of hits){
  const row=customsDirectory().find(r=>r.article===hit.article),source=customsPassage(hit.article);
  assert.equal(hit.text,row.passages[hit.part].text);assert.equal(hit.page,row.passages[hit.part].page);
  assert.equal(hit.locator,source.passages[hit.part].locator);assert.equal(hit.warning,source.ref.summary);
  assert.ok(hit.localUrl.endsWith('#page='+hit.page));
 }
 const transport=searchCustomsPassages('gastos transporte').find(h=>h.article==='65');
 assert.ok(transport);assert.equal(transport.condition,customsPassage('65').passages[transport.part].condition);
});
test('every query word must appear in the same passage, with no nearest match or full-law claim',()=>{
 assert.deepEqual(searchCustomsPassages('zzzterminoinexistente'),[]);
 assert.deepEqual(searchCustomsPassages('regalías zzzterminoinexistente'),[]);
 assert.deepEqual(searchCustomsPassages('regal'),[]);
 assert.deepEqual(searchCustomsPassages('  '),[]);assert.throws(()=>searchCustomsPassages('x'.repeat(181)));
});
test('real service dispatch remains local and rejects undeclared fields',async t=>{
 const {startServer}=await import('../server/main.mjs');const {mkdtemp,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');const path=await import('node:path');
 const dir=await mkdtemp(path.join(tmpdir(),'rejon-customs-search-'));let generated=0;
 const app=await startServer({dataDir:dir,intakePilot:true,autoInitialize:false,intakeGenerate:()=>{generated++;throw Error('cloud forbidden');}});
 t.after(async()=>{await app.close();await rm(dir,{recursive:true,force:true});});
 t.mock.method(globalThis,'fetch',()=>assert.fail('no model or network request'));
 assert.deepEqual(await app.service.dispatch('intake.searchCustomsPassages',{text:'regalías'}),searchCustomsPassages('regalías'));
 await assert.rejects(app.service.dispatch('intake.searchCustomsPassages',{text:'regalías',matterId:'untrusted'}));assert.equal(generated,0);
});


test('a found article remains available to the existing question-source preparation without a general library',async()=>{
 const {questionCandidates}=await import('../server/corpus/intake-question.mjs');
 const {questionPassage}=await import('../server/corpus/intake-research.mjs');
 const hit=searchCustomsPassages('regalías')[0];
 const text='¿Qué documentos permiten comprobar los requisitos del artículo '+hit.article+' de la Ley Aduanera?';
 const rows=questionCandidates(null,text,[{text}]);
 const selected=rows.find(row=>row.source==='aduana-'+hit.article&&row.part===hit.part);assert.ok(selected);
 const note=questionPassage(null,{sourceId:selected.source,part:selected.part,angle:'documentos'});
 assert.equal(note.body,hit.text);assert.equal(note.ref.summary,hit.warning);
});
