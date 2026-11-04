import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp, rm, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {buildFragmentIndex, hashFile} from '../server/retrieval/build.mjs';
import {openFragmentIndex, searchFragments, rewriteQuery} from '../server/retrieval/query.mjs';
import {sha256, verifyFragment} from '../server/retrieval/fragments.mjs';

function fixture(article = '47', lawId = 'MX-FED-LFT', extra = {}) {
  const jurisdiction = lawId.startsWith('MX-FED-') ? 'MX-FED' : 'MX-JAL';
  const text = `Artículo ${article}.- Supuestos exclusivamente sintéticos: I. Pago de salario. II. Indemnización por despido injustificado. a) Pago oportuno. b) Constancia del pago.`;
  return {id: 'PUB-' + sha256(lawId + article), lawId, article, jurisdiction, title: 'Ley de prueba sintética', text, textSha256: sha256(text), pdfSha256: 'a'.repeat(64),
    url: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/Synthetic.pdf', version: `${lawId}@2026-01-01+aaaaaaaaaaaaaaaa`, pages: [1, 2], retrievedAt: '2026-01-01T00:00:00Z', amendedAt: null, effectiveAt: null,
    authority: 'Fuente pública sintética', category: 'official-public-legislation', status: 'structurally-verified-currentness-unverified', ...extra};
}
async function setup(t, rows = [fixture(), fixture('47-BIS'), fixture('48'), fixture('47', 'MX-JAL-SYNTHETIC')]) {
  const dir = await mkdtemp(path.join(tmpdir(), 'lex-fragments-'));
  t.after(() => rm(dir, {recursive: true, force: true}));
  const inputFile = path.join(dir, 'public.sqlite'), outputFile = path.join(dir, 'fragments.sqlite');
  const db = new DatabaseSync(inputFile);
  db.exec('CREATE TABLE articles(id TEXT PRIMARY KEY,law_id TEXT,jurisdiction TEXT,payload TEXT)');
  for (const row of rows) db.prepare('INSERT INTO articles VALUES(?,?,?,?)').run(row.id, row.lawId, row.jurisdiction, JSON.stringify(row));
  db.close();
  return {inputFile, outputFile, lawAreas: {'MX-FED-LFT': ['laboral'], 'MX-JAL-SYNTHETIC': ['laboral']}};
}

test('FTS retrieves the relevant fraction with verifiable provenance and no cross-jurisdiction fallback', async t => {
  const options = await setup(t); const before = await hashFile(options.inputFile);
  const manifest = await buildFragmentIndex(options);
  assert.equal(manifest.articles, 4); assert.equal(manifest.fragments, 20);
  assert.equal(await hashFile(options.inputFile), before);
  const index = openFragmentIndex(options.outputFile); t.after(() => index.close());
  const sources = index.searchFragments({query: 'indemnización', areas: ['laboral'], jurisdiction: 'MX-FED'});
  assert.equal(sources.length, 3);
  assert.ok(sources.every(s => s.fraction === 'II.' && s.jurisdiction === 'MX-FED'));
  assert.ok(verifyFragment(sources.find(s => s.article === '47'), fixture()));
  assert.equal(sources[0].sourceIndexSha256, before);
  assert.deepEqual(sources[0].pages, [1, 2]);
  assert.equal(sources[0].effectiveAt, null);
  assert.equal(index.searchFragments({query: 'indemnización', jurisdiction: 'MX-JAL'}).length, 1);
  assert.deepEqual(index.searchFragments({query: 'indemnización', jurisdiction: 'MX-CMX'}), []);
  assert.deepEqual(index.searchFragments({query: 'artículo 47 de LFT', jurisdiction: 'MX-JAL'}), []);
  assert.deepEqual(index.searchFragments({query: 'indemnización', areas: ['familiar'], jurisdiction: 'MX-FED'}), []);
  assert.throws(() => index.searchFragments({query: 'indemnización'}), /jurisdiction/);
  assert.throws(() => index.searchFragments({query: 'indemnización', jurisdiction: "MX-FED' OR 1=1"}), /jurisdiction/);
  assert.throws(() => index.searchFragments({query: 'indemnización', jurisdiction: 'MX-FED', areas: ['invalid']}));
});

test('exact references rank a matching fraction; navigation uses actual Bis ordering', async t => {
  const options = await setup(t); await buildFragmentIndex(options);
  const index = openFragmentIndex(options.outputFile); t.after(() => index.close());
  const result = index.searchFragments({query: 'Artículo 47 LFT indemnización', jurisdiction: 'MX-FED', limit: 1});
  assert.equal(result[0].fraction, 'II.'); assert.equal(result[0].article, '47');
  const fraction = index.searchFragments({query: 'Artículo 47 LFT fracción II', jurisdiction: 'MX-FED'});
  assert.ok(fraction.length); assert.ok(fraction.every(s => s.fraction === 'II.'));
  const inciso = index.searchFragments({query: 'Artículo 47 LFT fracción II inciso a)', jurisdiction: 'MX-FED'});
  assert.equal(inciso.length, 1); assert.equal(inciso[0].inciso, 'a)');
  assert.deepEqual(index.searchFragments({query: 'Artículo 47 LFT fracción IX', jurisdiction: 'MX-FED'}), []);
  const rewritten = rewriteQuery({question: '¿y el siguiente?', recentTurns: [{question: 'Artículo 47 LFT'}], matterJurisdiction: 'MX-FED'});
  const next = index.searchFragments(rewritten);
  assert.ok(next.length); assert.ok(next.every(s => s.article === '47-BIS'));
  const previous = index.searchFragments({query: 'Artículo anterior al artículo 48 de MX-FED-LFT', jurisdiction: 'MX-FED'});
  assert.ok(previous.every(s => s.article === '47-BIS'));
  assert.deepEqual(index.searchFragments({query: 'Artículo siguiente al artículo 48 de MX-FED-LFT', jurisdiction: 'MX-FED'}), []);
  assert.deepEqual(index.searchFragments({query: 'Artículo 999 de MX-FED-LFT', jurisdiction: 'MX-FED'}), []);
  assert.ok(searchFragments({indexPath: options.outputFile, query: 'me corrieron del trabajo', jurisdiction: 'MX-FED'}).some(s => s.fraction === 'II.'));
});

test('query operators are treated as text, and hostile article payloads never publish', async t => {
  const options = await setup(t); await buildFragmentIndex(options);
  for (const query of ['" OR * --', 'NEAR(indemnización,1)', 'text:salario NOT obligaciones', "indemnización'; DROP TABLE articles; --"]) assert.doesNotThrow(() => searchFragments({indexPath: options.outputFile, query, jurisdiction: 'MX-FED'}));
  for (const extra of [{textSha256: '0'.repeat(64)}, {matterId: 'synthetic-private-marker'}, {url: 'https://example.test/not-official'}, {jurisdiction: 'MX-CMX'}]) {
    const invalid = await setup(t, [fixture('47', 'MX-FED-LFT', extra)]);
    await assert.rejects(buildFragmentIndex(invalid));
    await assert.rejects(readFile(invalid.outputFile), {code: 'ENOENT'});
  }
});

test('build is reproducible and failed replacement preserves the existing index', async t => {
  const options = await setup(t); const first = await buildFragmentIndex(options);
  const second = await buildFragmentIndex(options);
  assert.equal(first.indexSha256, second.indexSha256);
  const db = new DatabaseSync(options.inputFile);
  db.prepare('UPDATE articles SET payload=? WHERE id=?').run(JSON.stringify(fixture('47', 'MX-FED-LFT', {textSha256: '0'.repeat(64)})), fixture().id); db.close();
  await assert.rejects(buildFragmentIndex(options), /Invalid public article/);
  assert.equal(await hashFile(options.outputFile), first.indexSha256);
});

test('changed fragment text is refused at read time', async t => {
  const options = await setup(t); await buildFragmentIndex(options);
  const db = new DatabaseSync(options.outputFile);
  db.exec("UPDATE fragments SET text='tampered' WHERE ordinal=0"); db.close();
  assert.throws(() => searchFragments({indexPath: options.outputFile, query: 'Artículo 47 de MX-FED-LFT', jurisdiction: 'MX-FED'}), /provenance/);
});

test('accented article suffixes and latest stored versions remain distinguishable', async t => {
  const current = fixture('47-QUÁTER');
  const old = fixture('47-QUÁTER', 'MX-FED-LFT', {id: 'PUB-' + sha256('old'), retrievedAt: '2025-01-01T00:00:00Z', version: 'MX-FED-LFT@2025-01-01+aaaaaaaaaaaaaaaa'});
  const options = await setup(t, [current, old]); await buildFragmentIndex(options);
  const hits = searchFragments({indexPath: options.outputFile, query: 'Artículo 47 QUÁTER de LFT', jurisdiction: 'MX-FED'});
  assert.equal(hits.length, 5);
  assert.ok(hits.every(hit => hit.article === '47-QUÁTER' && hit.articleSourceId === current.id));
});
