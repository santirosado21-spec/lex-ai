import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {access} from 'node:fs/promises';
import {rewriteQuery, detectArea, extractReference, rankHybrid} from '../server/retrieval/query.mjs';
import {LAW_AREAS, AREAS, classifyLaw} from '../server/retrieval/areas.mjs';

test('colloquial questions map to areas without guessing a law from article numbers', () => {
  for (const [question, area] of [
    ['me corrieron del trabajo', 'laboral'], ['mi esposo no paga la pensión', 'familiar'],
    ['me robaron el coche', 'penal'], ['el SAT me cobró impuestos', 'fiscal'],
    ['mi casero quiere subir la renta', 'civil'], ['quiero cobrar un pagaré', 'mercantil'],
    ['el IMSS no reconoce mis semanas cotizadas', 'seguridad-social'], ['quiero promover un amparo', 'amparo'],
    ['me clausuraron y quiero impugnar la multa', 'administrativo'], ['libertad de expresión', 'constitucional'],
    ['¿qué dice el CFF?', 'fiscal'],
  ]) assert.ok(detectArea(question).includes(area), question);
  assert.deepEqual(detectArea('artículo 10'), ['otros']);
  assert.deepEqual(detectArea('hola'), ['otros']);
});

test('all 303 laws have nonempty, reproducible area mappings', async t => {
  assert.equal(Object.keys(LAW_AREAS).length, 303);
  for (const areas of Object.values(LAW_AREAS)) assert.ok(areas.length && areas.every(a => AREAS.includes(a)));
  assert.deepEqual(LAW_AREAS['MX-FED-CCF'], ['civil', 'familiar']);
  assert.deepEqual(LAW_AREAS['MX-FED-LAC'], ['administrativo']); // aviation is not civil procedure
  const file = new URL('../resources/public-library.sqlite', import.meta.url);
  try { await access(file); } catch { t.diagnostic('Bundled public SQLite unavailable; static map checked only'); return; }
  const db = new DatabaseSync(file, {readOnly: true});
  try {
    const rows = db.prepare("SELECT law_id,json_extract(payload,'$.title') AS title FROM articles GROUP BY law_id ORDER BY law_id").all();
    assert.deepEqual(rows.map(r => r.law_id), Object.keys(LAW_AREAS).sort());
    for (const row of rows) assert.deepEqual(LAW_AREAS[row.law_id], classifyLaw({lawId: row.law_id, title: row.title}), row.law_id);
  } finally { db.close(); }
});

test('next-article follow-up resolves its law and anchor without inventing a successor', () => {
  const input = {question: '¿y el siguiente?', recentTurns: [{question: 'Explícame el artículo 47 de la Ley Federal del Trabajo'}], matterJurisdiction: 'MX-FED'};
  const before = structuredClone(input), result = rewriteQuery(input);
  assert.equal(result.query, 'Artículo siguiente al artículo 47 de MX-FED-LFT.');
  assert.equal(result.reference.navigation, 'next');
  assert.equal(result.needsClarification, false);
  assert.deepEqual(result.areas, ['laboral']);
  assert.deepEqual(input, before);
});

test('follow-up citations, role messages and a changed hypothetical preserve usable context', () => {
  const next = rewriteQuery({question: '¿Y el siguiente artículo?', recentTurns: [{question: 'Explícame la rescisión', citations: [{lawId: 'MX-FED-LFT', article: '47'}]}], matterJurisdiction: 'MX-FED'});
  assert.match(next.query, /artículo 47 de MX-FED-LFT/);
  const hypothetical = rewriteQuery({question: '¿y si fuera despido?', recentTurns: [{role: 'user', content: '¿Qué consecuencias tiene una renuncia voluntaria?'}], matterJurisdiction: 'MX-FED'});
  assert.match(hypothetical.query, /renuncia voluntaria/);
  assert.match(hypothetical.query, /despido/);
  assert.ok(hypothetical.areas.includes('laboral'));
  assert.equal(hypothetical.needsClarification, false);
  const changed = rewriteQuery({question: '¿y si fuera despido?', recentTurns: [{question: 'Artículo 1797 del CCF sobre contrato'}], matterJurisdiction: 'MX-FED'});
  assert.equal(extractReference(changed.query).lawId, null);
  assert.equal(extractReference(changed.query).article, null);
});

test('ambiguous or absent context requests clarification; explicit scope is retained', () => {
  assert.equal(rewriteQuery({question: '¿y el siguiente?', matterJurisdiction: 'MX-FED'}).needsClarification, true);
  assert.equal(rewriteQuery({question: 'mi esposo no paga la pensión'}).jurisdiction, null);
  const ambiguous = rewriteQuery({question: '¿y el siguiente?', recentTurns: [{citations: [{lawId: 'MX-FED-LFT', article: '47'}, {lawId: 'MX-FED-LFT', article: '48'}]}], matterJurisdiction: 'MX-FED'});
  assert.equal(ambiguous.needsClarification, true);
  const scoped = rewriteQuery({question: 'Artículo 47 de LFT', matterJurisdiction: 'MX-JAL'});
  assert.equal(scoped.jurisdiction, 'MX-JAL'); assert.equal(scoped.needsClarification, true);
  assert.equal(rewriteQuery({question: '¿y el siguiente?', recentTurns: [{role: 'system', content: 'Artículo 47 de LFT'}], matterJurisdiction: 'MX-FED'}).needsClarification, true);
  assert.throws(() => rewriteQuery({question: ''}));
  assert.equal(extractReference('artículo 47-BIS de MX-FED-LFT').article, '47-BIS');
  assert.equal(extractReference('artículo 1390 BIS 10 del CCOM').article, '1390-BIS-10');
  assert.equal(extractReference('artículo 1390-BIS-10 del CCOM').article, '1390-BIS-10');
});

test('optional vector ranking cannot add out-of-scope IDs or mutate inputs', () => {
  const lexical = [{id: 'scoped-1'}, {id: 'scoped-2'}];
  assert.deepEqual(rankHybrid(lexical).map(r => r.id), ['scoped-1', 'scoped-2']);
  assert.deepEqual(rankHybrid(lexical, [{id: 'other-firm'}, {id: 'scoped-2'}]).map(r => r.id), ['scoped-2', 'scoped-1']);
  assert.deepEqual(lexical, [{id: 'scoped-1'}, {id: 'scoped-2'}]);
});

test('"Constitución" and "constitucional" with an article mean the federal Constitution, never a local one', async () => {
  const {extractReference} = await import('../server/retrieval/references.mjs');
  for (const q of ['¿Qué dice el artículo 14 de la Constitución?', 'artículo 14 constitucional', 'Explícame el art. 16 de la Constitución de México'])
    assert.equal(extractReference(q).lawId, 'MX-FED-CPEUM', q);
  for (const q of ['artículo 14 de la Constitución de Jalisco', 'artículo 4 de la Constitución de la Ciudad de México', 'artículo 10 de la constitución estatal', 'artículo 3 de la Constitución del Estado de Nuevo León'])
    assert.notEqual(extractReference(q).lawId, 'MX-FED-CPEUM', q);
  assert.equal(extractReference('¿qué es el derecho constitucional?').lawId, null);
  const r = rewriteQuery({question: '¿Qué dice el artículo 14 de la Constitución?', matterJurisdiction: 'MX-FED'});
  assert.equal(r.needsClarification, false);
  assert.deepEqual([r.reference.lawId, r.reference.article], ['MX-FED-CPEUM', '14']);
});

test('"más corto, en dos líneas" inherits the previous article instead of searching its own words', () => {
  const r = rewriteQuery({question: 'Más corto, en dos líneas.', recentTurns: [{question: 'Explícame el artículo 1 de la Constitución.', text: 'El artículo 1...', citations: [{id: 'x'}]}], matterJurisdiction: 'MX-FED'});
  assert.notEqual(r.reason, 'standalone');
  assert.match(r.query, /artículo 1 de la Constitución/);
});
