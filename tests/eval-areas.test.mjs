import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openPublicLibrary } from '../server/public-library.mjs';
import { createService } from '../server/service.mjs';
import { AREAS, ROOT, loadCases, instrumentInference, scoreRetrieval, scoreAnswer, evaluateCases, summarize, markdownReport, runEvaluation } from '../scripts/eval-areas.mjs';
import { missingPrerequisite, fidelityGate } from './helpers/fidelity.mjs';

const LIBRARY_PATH = path.join(ROOT, 'resources/public-library.sqlite');
const libraryPrereq = await missingPrerequisite(LIBRARY_PATH, 'production public-library.sqlite unavailable');
let library, dataset;
before(async () => {
  if (libraryPrereq) return;
  library = await openPublicLibrary(LIBRARY_PATH);
  dataset = await loadCases({ library });
});
after(() => library?.close());

const gated = (name, fn) => test(name, (t) => {
  if (fidelityGate(t, libraryPrereq, 'corpus-fidelity assertion stays pending')) return;
  return fn(t);
});

gated('200 synthetic cases are pinned to real articles, fragments and whole-law exclusions', () => {
  assert.equal(dataset.cases.length, 200);
  assert.equal(dataset.manifest.heldOutLaws.length, 10);
  for (const area of AREAS) {
    const group = dataset.cases.filter(c => c.area === area);
    assert.equal(group.length, 20);
    assert.equal(group.filter(c => c.type === 'direct').length, 6);
    assert.equal(group.filter(c => c.type === 'colloquial').length, 6);
    assert.equal(group.filter(c => c.type === 'follow-up').length, 4);
    assert.equal(group.filter(c => c.expected.chatOnly).length, 2);
    for (const c of group.filter(c => c.type === 'colloquial')) {
      for (const p of c.provenance) assert.ok(!c.turns[0].content.toLowerCase().includes(library.getSource(p.article_id).title.toLowerCase()));
      assert.doesNotMatch(c.turns[0].content, /\b(?:CCF|CNPP|CPEUM|LFT|LSS|CFF)\b/);
    }
    for (const c of group.filter(c => c.type === 'follow-up')) {
      assert.ok([2, 3].includes(c.turns.length));
      assert.match(c.turns[1].content, /^¿Y si/);
    }
  }
  assert.ok(dataset.cases.filter(c => c.expected.chatOnly).every(c => c.provenance.length === 0));
});

gated('hit@3 requires the correct law/article pair, and fragment coverage is separate', () => {
  const expected = dataset.cases[0].expected, target = expected.articles[0];
  const right = { law_id: target.law_id, article: target.article, text: target.expectedFragment };
  const wrong = { ...right, law_id: 'MX-FED-WRONG' };
  assert.equal(scoreRetrieval(expected, [wrong]).articleHitAt3, false);
  assert.equal(scoreRetrieval(expected, [wrong, wrong, wrong, right]).articleHitAt3, false);
  assert.deepEqual(scoreRetrieval(expected, [right]), { lawHitAt3: true, articleHitAt3: true, fragmentHitAt3: true });
  assert.equal(scoreRetrieval(expected, [{ ...right, text: 'Otro pasaje del mismo artículo.' }]).fragmentHitAt3, false);
  assert.equal(scoreRetrieval({ chatOnly: true }, [right]).articleHitAt3, null);
});

function citationFixture() {
  const c = dataset.cases.find(c => c.area === 'civil' && c.type === 'direct');
  const source = library.getSource(c.provenance[0].article_id);
  const evidence = [{ sourceId: source.id, text: source.text }];
  const answer = { kind: 'grounded', text: `El pasaje describe un acuerdo. [${source.id}]`, citations: [{ ...source, quote: c.expected.articles[0].expectedFragment }] };
  return { expected: c.expected, evidence, answer, getSource: id => id === source.id ? source : null };
}

gated('citation fidelity rejects fabricated quotes, unprovided sources and unmapped references', () => {
  const f = citationFixture();
  assert.equal(scoreAnswer(f).mustCite, true);
  assert.equal(scoreAnswer({ ...f, evidence: [] }).mustCite, false);
  assert.equal(scoreAnswer({ ...f, answer: { ...f.answer, citations: [{ ...f.answer.citations[0], quote: 'Esta frase fue inventada y nunca estuvo en la fuente.' }] } }).mustCite, false);
  assert.equal(scoreAnswer({ ...f, answer: { ...f.answer, text: f.answer.text + ' [L999]' } }).mustCite, false);
  assert.equal(scoreAnswer({ ...f, answer: { ...f.answer, citations: [] } }).mustCite, false);
  assert.equal(scoreAnswer({ ...f, answer: { ...f.answer, citations: [] } }).citationFidelity, null);
});

gated('a literal citation to an unrelated law is not a correct expected answer', () => {
  const f = citationFixture();
  const score = scoreAnswer({ ...f, expected: dataset.cases[0].expected });
  assert.equal(score.citationFidelity, true);
  assert.equal(score.mustCite, false);
});

gated('live aliases must map to the captured canonical source, not just a declared canonicalId', () => {
  const f = citationFixture(), original = f.answer.citations[0];
  const aliased = { ...f, evidence: [{ ...f.evidence[0], modelId: 'L1' }], answer: { ...f.answer, text: 'El pasaje describe un acuerdo. [L1]', citations: [{ ...original, id: 'L1', canonicalId: original.id }] } };
  assert.equal(scoreAnswer(aliased).mustCite, true);
  assert.equal(scoreAnswer({ ...aliased, evidence: [{ ...f.evidence[0], modelId: 'L2' }] }).mustCite, false);
});

gated('retrieval simulator cites only source/quote pairs allowed by the actual output schema', async () => {
  const inference = instrumentInference({ resolveSource: () => null, observe() {} });
  const quote = 'Este pasaje público tiene longitud suficiente para una cita.';
  const sources = [{ id: 'L1', text: 'Corto', allowedQuotes: ['Corto'] }, { id: 'L2', text: quote, allowedQuotes: [quote] }];
  const outputSchema = { properties: { paragraphs: { items: { anyOf: [{ properties: { sourceId: { const: 'L2' }, quote: { enum: [quote] } } }] } } } };
  let raw = ''; for await (const chunk of inference.generate([{ content: JSON.stringify({ sources }) }], { outputSchema })) raw += chunk;
  assert.deepEqual(JSON.parse(raw).paragraphs.map(p => p.sourceId), ['L2']);
});

gated('abstention and state clarification require the requested behavior, not an exception or generic question', () => {
  const expected = { laws: [], articles: [], mustAbstain: true };
  const answer = { kind: 'chat', text: 'No tengo fuentes locales de Oaxaca. Comparte la disposición y su fuente oficial.', citations: [], validation: { status: 'needs-jurisdiction-source' } };
  const input = { expected, answer, getSource: () => null };
  assert.equal(scoreAnswer(input).mustAbstain, true);
  assert.equal(scoreAnswer({ ...input, error: 'inference failed' }).mustAbstain, false);
  assert.equal(scoreAnswer({ ...input, answer: null }).mustAbstain, false);
  assert.equal(scoreAnswer({ ...input, answer: { ...answer, text: '¿En qué puedo ayudarte?', validation: {} } }).mustAbstain, false);
  const jurisdiction = { ...input, expected: { laws: [], articles: [], mustAskJurisdiction: true } };
  assert.equal(scoreAnswer({ ...jurisdiction, answer: { ...answer, text: '¿En qué estado se tramita el asunto?' } }).mustAskJurisdiction, true);
  assert.equal(scoreAnswer({ ...jurisdiction, answer: { ...answer, text: '¿Quieres que te explique el estado del proceso?' } }).mustAskJurisdiction, false);
});

gated('chat-only rejects inline citations and statutory references even with empty citation metadata', () => {
  const input = { expected: { laws: [], articles: [], chatOnly: true }, answer: { kind: 'chat', text: 'Hola, organicemos una agenda.', citations: [] }, getSource: () => null };
  assert.equal(scoreAnswer(input).chatOnly, true);
  for (const text of ['Según el artículo 17.', 'Hola [L1]', 'Consulta https://example.org']) assert.equal(scoreAnswer({ ...input, answer: { ...input.answer, text } }).chatOnly, false);
});

gated('inference instrumentation forwards live messages/options unchanged and captures actual supplied passages', async () => {
  const captured = [], seen = [];
  const messages = [{ role: 'user', content: JSON.stringify({ sources: [{ id: 'L1', title: 'Ley pública', article: '7', text: 'Pasaje auténtico entregado.', allowedQuotes: [] }] }) }];
  const options = { outputSchema: { type: 'object' } };
  const delegate = { outputContract: 'paragraph-citations-v1', async *generate(m, o) { seen.push([m, o]); yield 'unchanged'; } };
  const inference = instrumentInference({ delegate, resolveSource: () => ({ id: 'public-source', lawId: 'MX-FED-TEST', article: '7' }), observe: o => captured.push(o) });
  let result = ''; for await (const chunk of inference.generate(messages, options)) result += chunk;
  assert.equal(result, 'unchanged'); assert.equal(seen[0][0], messages); assert.equal(seen[0][1], options);
  assert.equal(captured[0].sources[0].sourceId, 'public-source');
  assert.equal(captured[0].sources[0].text, 'Pasaje auténtico entregado.');
});

gated('conversation runner isolates threads, preserves turn order, and does not count errors as abstention', async () => {
  const calls = [];
  const cases = [{ ...dataset.cases[0], id: 'a', turns: [{ role: 'user', content: 'primero' }, { role: 'user', content: 'segundo' }] }, { ...dataset.cases[16], id: 'b' }];
  const service = { async analyze(p) { calls.push(p); if (p.threadId === 'b') throw Error('blocked'); return { text: 'Respuesta sin citas.', citations: [], kind: 'chat' }; } };
  const results = await evaluateCases({ cases, service, captured: () => [], clearCapture() {}, getSource: () => null, mode: 'live' });
  assert.deepEqual(calls.map(c => [c.threadId, c.mode]), [['a', 'auto'], ['a', 'auto'], ['b', 'auto']]);
  assert.equal(results[1].complete, false);
  assert.equal(results[1].turns[0].behavior.mustAbstain, false);
  const summary = summarize(results, 'live')[0];
  assert.equal(summary.mustAbstain.passed, 0); assert.equal(summary.errors, 1);
});

gated('failed follow-up cannot reuse the first-turn hit or disappear from the denominator', async () => {
  const c = dataset.cases.find(c => c.type === 'follow-up');
  const t = c.expected.articles[0];
  let n = 0;
  const results = await evaluateCases({ cases: [c], service: { async analyze() { if (n++) throw Error('blocked'); return { text: 'ok' }; } }, captured: () => [{ sources: [{ law_id: t.law_id, article: t.article, text: t.expectedFragment }] }], clearCapture() {}, getSource: () => null, mode: 'retrieval' });
  const summary = summarize(results, 'retrieval')[0];
  assert.equal(summary.articleHitAt3.total, 1); assert.equal(summary.articleHitAt3.passed, 0);
  assert.equal(summary.citationFidelity, null); assert.equal(summary.mustAbstain, null);
});

gated('real createService retrieval observes exact article and follow-up evidence without loopback or a model', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'lex-areas-test-'));
  let hydrated = [], observations = [];
  const wrappedLibrary = { ...library, getSource(id) { const s = library.getSource(id); if (s) hydrated.push(s); return s; } };
  const inference = instrumentInference({ resolveSource: s => hydrated.find(x => x.title === s.title && x.article === s.article), observe: o => observations.push(o) });
  const service = await createService({ dataDir: dir, corpusPath: path.join(ROOT, 'resources/legal-corpus.json'), publicLibrary: wrappedLibrary, inference, schedulerEnabled: false });
  t.after(() => { service.close(); return rm(dir, { recursive: true, force: true }); });
  await service.dispatch('workspace.create', { name: 'Prueba sintética de evaluación', practiceAreas: ['civil'] });
  const c = dataset.cases.find(c => c.area === 'civil' && c.type === 'follow-up');
  const results = await evaluateCases({ cases: [c], service, captured: () => observations, clearCapture: () => { hydrated = []; observations = []; }, getSource: id => library.getSource(id), mode: 'retrieval' });
  assert.equal(results[0].complete, true, JSON.stringify(results[0].turns.map(t => t.error)));
  assert.ok(results[0].turns.every(t => t.retrieval.articleHitAt3));
  assert.ok(results[0].turns.every(t => t.behavior === null));
  assert.equal((await service.dispatch('state')).documents.length, 0);
});

gated('markdown distinguishes simulation and missing denominators from perfect scores', () => {
  const md = markdownReport({ mode: 'retrieval', status: 'completed', startedAt: 'synthetic', dataset: dataset.manifest, summary: [] });
  assert.match(md, /NO se califican/);
  assert.match(md, /prospectiva/);
  assert.doesNotMatch(md, /100\.0%/);
});

gated('live without an explicit model store fails with reviewable JSON/Markdown and no fabricated metrics', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'lex-areas-preflight-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const result = await runEvaluation({ mode: 'live', outputDir: dir });
  assert.equal(result.report.status, 'failed');
  assert.match(result.report.failure, /requires --models-dir/);
  assert.deepEqual(result.report.summary, []);
  assert.deepEqual(result.report.results, []);
  assert.equal(JSON.parse(await readFile(result.jsonPath, 'utf8')).status, 'failed');
  assert.match(await readFile(result.markdownPath, 'utf8'), /Error de ejecución/);
});
