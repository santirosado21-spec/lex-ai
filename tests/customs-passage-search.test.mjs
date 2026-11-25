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
  assert.equal(hit.locator,source.passages[hit.part].locator);assert.equal(hit.warning,source.ref.summary);assert.equal(row.warning,source.ref.summary);assert.equal(row.passages[hit.part].condition,source.passages[hit.part].condition??null);
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

test('valuation articles66 and67 retain all controlling context in local search and explicit preparation',async()=>{
 const {questionCandidates}=await import('../server/corpus/intake-question.mjs');
 const {questionPassage}=await import('../server/corpus/intake-research.mjs');
 for(const article of ['66','67']){
  const source=customsPassage(article),row=customsDirectory().find(r=>r.article===article);
  assert.equal(row.passages.length,article==='66'?8:6);
  assert.equal(source.ref.pdfSha256,'43927095d22ff7bc7780e78132d2160b5050b5f76026b539daec32be09d7341d');
  for(const [part,p] of source.passages.entries()){
   assert.ok(p.condition.includes(row.passages[0].text));assert.ok(p.condition.includes(row.passages.at(-1).text));
   if(article==='66'&&p.locator.startsWith('fracción II, inciso'))assert.ok(p.condition.includes('siempre que se distingan del precio pagado'));
   const text='Artículo '+article+' de la Ley Aduanera';
   const candidates=questionCandidates(null,text,[{text}]);assert.ok(candidates.some(r=>r.source==='aduana-'+article&&r.part===part));
   const prepared=questionPassage(null,{sourceId:'aduana-'+article,part,angle:'documentos'});
   assert.equal(prepared.body,p.quote);assert.equal(prepared.condition,p.condition);
   assert.match(prepared.ref.locator,/edición impresa 19-11-2025/);assert.match(prepared.ref.summary,/reforma posterior/);
  }
 }
 assert.ok(searchCustomsPassages('posterioridad').some(r=>r.article==='66'));
 assert.ok(searchCustomsPassages('vinculación').some(r=>r.article==='67'));
});

test('adding explicit valuation sources leaves automatic valuation reading restricted to64 and65',async()=>{
 const {loadTradeReading}=await import('../server/corpus/intake-trade-reading.mjs');
 assert.deepEqual(loadTradeReading(null,'lectura-valoracion').refs.map(r=>r.article),['64','65']);
});

test('every direct directory passage carries its exact condition and edition warning, not only search hits',()=>{
 let withCondition=0,withPassages=0;
 for(const row of customsDirectory()){
  if(!row.passages.length){assert.equal(row.warning,null);continue;}
  withPassages++;const source=customsPassage(row.article);assert.equal(row.warning,source.ref.summary);
  assert.equal(row.passages.length,source.passages.length);
  for(const [part,p] of row.passages.entries()){
   assert.equal(p.text,source.passages[part].quote);assert.equal(p.condition,source.passages[part].condition??null);
   if(p.condition)withCondition++;
  }
 }
 assert.equal(withPassages,12);assert.ok(withCondition>=14);
});


test('linkage68–70 selections preserve complete controlling context and exact page for manual preparation',async()=>{
 const {questionCandidates}=await import('../server/corpus/intake-question.mjs');
 const {questionPassage}=await import('../server/corpus/intake-research.mjs');
 for(const article of ['68','69','70']){
  const source=customsPassage(article),row=customsDirectory().find(r=>r.article===article);
  assert.equal(row.passages.length,{'68':8,'69':4,'70':6}[article]);
  assert.equal(source.ref.pdfSha256,'43927095d22ff7bc7780e78132d2160b5050b5f76026b539daec32be09d7341d');
  assert.match(source.ref.summary,/reforma posterior/);
  const text='Artículo '+article+' de la Ley Aduanera',rows=questionCandidates(null,text,[{text}]);
  for(const [part,p] of source.passages.entries()){
   assert.ok(rows.some(r=>r.source==='aduana-'+article&&r.part===part));
   const prepared=questionPassage(null,{sourceId:'aduana-'+article,part,angle:'documentos'});
   assert.equal(prepared.body,p.quote);assert.equal(prepared.condition,p.condition);
   assert.ok(p.condition.includes(article==='68'?row.passages[0].text.slice(0,row.passages[0].text.indexOf(':')+1):row.passages[0].text));
   if(article==='69')assert.ok(p.condition.includes(row.passages[1].text));
   if(article==='70')for(const tail of row.passages.slice(-2))assert.ok(p.condition.includes(tail.text));
   assert.equal(row.passages[part].page,article==='68'||article==='69'&&part===0?48:49);
  }
 }
 assert.match(customsPassage('68').passages[3].quote,/5% o más/);
 assert.match(customsPassage('68').passages[7].quote,/misma familia/);
 assert.match(customsPassage('70').passages[0].quote,/artículo 81/);
 const hits=searchCustomsPassages('costos beneficio');assert.equal(hits.length,1);assert.equal(hits[0].article,'69');assert.equal(hits[0].page,49);
 assert.match(hits[0].condition,/cuando se demuestre/);
 assert.ok(searchCustomsPassages('valores criterio').some(h=>h.article==='70'));
});
