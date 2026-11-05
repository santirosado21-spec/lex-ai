#!/usr/bin/env node
/**
 * Blind dialogue evaluation for LEX AI. Synthetic prompts only.
 *
 *   node scripts/eval-dialogue.mjs run --label base
 *   node scripts/eval-dialogue.mjs judge --a RUN_A.json --b RUN_B.json [--resume OUT.json]
 *   node scripts/eval-dialogue.mjs judge --single RUN.json
 *
 * `run` mirrors the desktop app: real local model, full public library and the
 * service from this tree. `judge` sends transcripts (synthetic) to a free Groq
 * model through dsystem, hides which run is which, and never retries on quota
 * errors: it saves progress and stops, so `--resume` can continue later.
 * The cases in eval/dialogue/ are held out: never use them as training data.
 */
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { pathToFileURL, fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = '/Applications/LEX AI.app/Contents/Resources/app';
const OUT = path.join(ROOT, 'artifacts/eval-dialogue');
const JUDGE_MODEL = 'openai/gpt-oss-120b';
const sha = b => createHash('sha256').update(b).digest('hex');
const fold = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

export async function loadCases(file = path.join(ROOT, 'eval/dialogue/cases.jsonl')) {
  const raw = await readFile(file, 'utf8');
  return { cases: raw.trim().split('\n').map(l => JSON.parse(l)), sha256: sha(raw), file: path.relative(ROOT, file) };
}

// ---------- mechanical checks (cheap, deterministic, no judge needed) ----------
const words = t => String(t).trim().split(/\s+/).filter(Boolean).length;
const sentences = t => String(t).trim().split(/(?<=[.!?])\s+/).filter(s => s.trim()).length;
function looksEnglish(t) {
  const w = fold(t).match(/[a-z']+/g) || [];
  const en = w.filter(x => ['the', 'is', 'and', 'to', 'of', 'you', 'it', 'for', 'best', 'time', 'morning', 'your'].includes(x)).length;
  const es = w.filter(x => ['el', 'la', 'es', 'y', 'de', 'que', 'los', 'las', 'para', 'tu', 'mejor', 'hora'].includes(x)).length;
  return en > es;
}
export function mechanicalChecks(c, turns) {
  const out = [];
  const last = turns.at(-1)?.text ?? '';
  const cited = i => (turns[i]?.citations?.length ?? 0) > 0;
  const add = (name, pass) => out.push({ name, pass: Boolean(pass) });
  if (turns.some(t => t.error)) add('sin-error', false);
  if (c.mustNotCite) add('sin-citas', turns.every((_, i) => !cited(i)));
  if (c.mustCite) add('con-citas', cited(turns.length - 1));
  for (const i of c.mustCiteTurns ?? []) add(`con-citas-turno-${i + 1}`, cited(i));
  for (const i of c.mustNotCiteTurns ?? []) add(`sin-citas-turno-${i + 1}`, !cited(i));
  if (c.exact) add('exacto', c.exact.some(e => fold(last).replace(/[^\p{L}\p{N}]/gu, '') === fold(e).replace(/[^\p{L}\p{N}]/gu, '')));
  if (c.contains) add('contiene', c.contains.every(s => fold(last).includes(fold(s))));
  if (c.maxWords) add(`max-${c.maxWords}-palabras`, words(last) <= c.maxWords);
  if (c.maxSentences) add(`max-${c.maxSentences}-oraciones`, sentences(last) <= c.maxSentences);
  if (c.language === 'en') add('en-ingles', looksEnglish(last));
  return out;
}

// ---------- run: real local inference, same wiring as server/main.mjs ----------
async function readyInference(engine, timeoutMs = 180_000) {
  await engine.initialize();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const s = await engine.status();
    if (s.state === 'ready') return;
    if (s.state === 'error' || s.supported === false) throw Error(s.message || 'Motor local no disponible');
    await new Promise(r => setTimeout(r, 250));
  }
  throw Error('Tiempo de inicialización excedido');
}

export async function run({ label, servicePath = path.join(ROOT, 'server/service.mjs'), libraryPath = path.join(APP, 'resources/public-library.sqlite'), casesFile, only } = {}) {
  if (!label || !/^[\w.-]{1,40}$/.test(label)) throw Error('--label requerido (letras, números, . - _)');
  const { cases: all, sha256, file } = await loadCases(casesFile);
  const cases = only ? all.filter(c => only.split(',').includes(c.id)) : all;
  const { createService } = await import(pathToFileURL(servicePath));
  const { createInference } = await import(pathToFileURL(path.join(ROOT, 'server/inference.mjs')));
  const { openPublicLibrary } = await import(pathToFileURL(path.join(ROOT, 'server/public-library.mjs')));
  const dir = await mkdtemp(path.join(os.tmpdir(), 'lex-eval-dialogue-'));
  const engine = createInference({ dataDir: dir, runtimePath: path.join(APP, 'resources/runtime/ollama'), bundledModelsDir: path.join(APP, 'resources/bundled-model'), allowDownload: false });
  const serverDir = path.dirname(servicePath);
  const report = { schemaVersion: 1, label, startedAt: new Date().toISOString(), syntheticDataOnly: true, adapterActivated: false, dataset: { file, sha256, cases: cases.length }, implementation: {}, results: [], status: 'running' };
  for (const f of ['service.mjs', 'conversation.mjs', 'assistant-router.mjs', 'grounded-output.mjs', 'grounded-output-mixed.mjs', 'inference.mjs']) {
    try { report.implementation[f] = sha(await readFile(path.join(serverDir, f))); } catch { /* optional file */ }
  }
  const outFile = path.join(OUT, `${stamp()}-run-${label}.json`);
  await mkdir(OUT, { recursive: true });
  let library, service;
  try {
    library = await openPublicLibrary(libraryPath);
    report.library = { path: libraryPath, indexSha256: library.status().indexSha256 };
    await readyInference(engine);
    service = await createService({ dataDir: path.join(dir, 'workspace'), corpusPath: path.join(ROOT, 'resources/legal-corpus.json'), inference: engine, publicLibrary: library, schedulerEnabled: false });
    await service.dispatch('workspace.create', { name: 'Evaluación de diálogo sintética', practiceAreas: ['laboral', 'civil', 'constitucional', 'penal', 'fiscal'] });
    for (const c of cases) {
      const turns = [];
      for (const question of c.turns) {
        const t0 = Date.now();
        try {
          const a = await service.analyze({ mode: 'auto', question, threadId: `eval-${c.id}` });
          turns.push({ question, text: a.text, kind: a.kind, citations: (a.citations || []).map(x => ({ id: x.id, title: x.title, article: x.article, quote: typeof x.quote === 'string' ? x.quote.slice(0, 400) : undefined })), validation: a.validation?.status, elapsedMs: Date.now() - t0 });
        } catch (e) { turns.push({ question, error: e.message, elapsedMs: Date.now() - t0 }); }
      }
      const checks = mechanicalChecks(c, turns);
      report.results.push({ id: c.id, category: c.category, turns, checks });
      process.stderr.write(`${c.id}: ${checks.filter(x => x.pass).length}/${checks.length}\n`);
      await writeFile(outFile, JSON.stringify(report, null, 2) + '\n');
    }
    report.status = 'completed';
  } catch (e) { report.status = 'failed'; report.failure = e.message; process.exitCode = 1; }
  finally {
    service?.close();
    try { await engine.stop(); } finally { library?.close(); await rm(dir, { recursive: true, force: true }); }
  }
  report.finishedAt = new Date().toISOString();
  report.summary = summarizeChecks(report.results);
  await writeFile(outFile, JSON.stringify(report, null, 2) + '\n');
  return { report, outFile };
}

export function summarizeChecks(results) {
  const by = {};
  for (const r of results) {
    const g = (by[r.category] ??= { cases: 0, checks: 0, passed: 0 });
    g.cases++; g.checks += r.checks.length; g.passed += r.checks.filter(x => x.pass).length;
  }
  const total = Object.values(by).reduce((a, g) => ({ checks: a.checks + g.checks, passed: a.passed + g.passed }), { checks: 0, passed: 0 });
  const ms = results.flatMap(r => r.turns.map(t => t.elapsedMs)).sort((a, b) => a - b);
  return { byCategory: by, total, medianTurnMs: ms[Math.floor(ms.length / 2)] ?? null };
}

// ---------- judge: blind paired comparison with a free remote model ----------
const RUBRIC = `Califica cada respuesta del asistente de 1 a 5 en:
- naturalidad: suena como una persona atenta en español; responde a lo que se dijo, sin menús de tareas, ofertas no pedidas ni rigidez de "bot de documentos".
- instrucciones: cumple formato, longitud, idioma, correcciones y cambios de tema pedidos.
- fidelidad: no inventa artículos, tesis, cifras ni plazos; en preguntas jurídicas explica bien lo que dice la fuente citada (se muestra su cita; el artículo completo puede decir más) y pide datos cuando faltan; en temas no jurídicos es correcto y no mete derecho.
Usa toda la escala. Juzga el contenido, no la longitud.`;
const fmtTranscript = (turns) => turns.map((t, i) => `Usuario ${i + 1}: ${t.question}\nAsistente ${i + 1}: ${t.error ? `[ERROR: ${t.error}]` : t.text}${t.citations?.length ? `\n(Fuentes citadas: ${t.citations.map(c => `${c.title ?? ''} art. ${c.article ?? '?'}${c.quote ? ` — cita: «${c.quote.slice(0, 300)}»` : ''}`).join('; ')})` : ''}`).join('\n\n');
const clip = (s, n) => s.length > n ? s.slice(0, n) + '\n[...recortado]' : s;

function judgeRequest(c, transcripts) {
  const labels = Object.keys(transcripts);
  const context = `Conversación de prueba sintética (categoría: ${c.category}).\nComportamiento esperado: ${c.expect}\n\n` +
    labels.map(l => `=== Respuesta ${l} ===\n${clip(fmtTranscript(transcripts[l]), 6000)}`).join('\n\n');
  const schema = labels.length === 2
    ? '{"A":{"naturalidad":n,"instrucciones":n,"fidelidad":n},"B":{"naturalidad":n,"instrucciones":n,"fidelidad":n},"preferida":"A"|"B"|"empate","motivo":"máximo 30 palabras"}'
    : '{"A":{"naturalidad":n,"instrucciones":n,"fidelidad":n},"motivo":"máximo 30 palabras"}';
  return {
    task: `Eres un evaluador imparcial de un asistente conversacional jurídico en español. ${RUBRIC}`,
    context,
    acceptance: `Devuelve SOLO un objeto JSON válido, sin texto adicional ni bloques de código, con esta forma: ${schema}`,
    dataClass: 'synthetic', reviewedForExternal: true,
    skills: [{ source: 'eval/dialogue/cases.jsonl y docs/architecture/conversational-product-contract-2026-11-03.md de LEX AI', guidance: 'Evalúa solo el texto mostrado. No tienes herramientas. No supongas que una respuesta es mejor por ser más larga o por citar más.' }],
  };
}
export function parseJudge(answer) {
  const m = String(answer).match(/\{[\s\S]*\}/);
  if (!m) throw Error('Juez sin JSON');
  const j = JSON.parse(m[0]);
  const ok = s => s && ['naturalidad', 'instrucciones', 'fidelidad'].every(k => Number.isInteger(s[k]) && s[k] >= 1 && s[k] <= 5);
  if (!ok(j.A) || (j.B !== undefined && !ok(j.B))) throw Error('Juez con puntuaciones inválidas');
  if (j.B !== undefined && !['A', 'B', 'empate'].includes(j.preferida)) throw Error('Juez sin preferencia válida');
  return j;
}
// Deterministic blind assignment: which run appears as "A" depends on a hash of the case id.
export const swapFor = (id, seed) => parseInt(sha(`${seed}:${id}`).slice(0, 8), 16) % 2 === 1;

export async function judge({ a, b, single, resume, seed = 'lex-dialogue-v1', delayMs = 15000, ask, outDir = OUT, bothOrders = false } = {}) {
  ask ??= (await import(pathToFileURL(path.join(ROOT, 'scripts/dsystem/remote.mjs')))).ask;
  const { loadSettings } = await import(pathToFileURL(path.join(ROOT, 'scripts/dsystem/remote.mjs')));
  const settings = await loadSettings();
  const { cases } = await loadCases();
  const byId = new Map(cases.map(c => [c.id, c]));
  const runA = JSON.parse(await readFile(single ?? a, 'utf8'));
  const runB = single ? null : JSON.parse(await readFile(b, 'utf8'));
  const outFile = resume ?? path.join(outDir, `${stamp()}-judge-${single ? runA.label : `${runA.label}-vs-${runB.label}`}.json`);
  const report = resume ? JSON.parse(await readFile(resume, 'utf8')) : { schemaVersion: 1, startedAt: new Date().toISOString(), judgeModel: JUDGE_MODEL, seed, mode: single ? 'single' : 'paired', runs: single ? [single] : [a, b], labels: single ? [runA.label] : [runA.label, runB.label], judgements: [], status: 'running' };
  const done = new Set(report.judgements.map(j => j.id));
  const resB = runB ? new Map(runB.results.map(r => [r.id, r])) : null;
  await mkdir(outDir, { recursive: true });
  for (const r of runA.results) {
    if (done.has(r.id) || !byId.has(r.id) || (resB && !resB.has(r.id))) continue;
    const first = runB ? swapFor(r.id, seed) : false;
    const orders = runB && bothOrders ? [first, !first] : [first];
    try {
      const passes = [];
      for (const swap of orders) {
        const transcripts = runB ? (swap ? { A: resB.get(r.id).turns, B: r.turns } : { A: r.turns, B: resB.get(r.id).turns }) : { A: r.turns };
        // Temperature 0: the same pair must get the same verdict.
        const res = await ask('groq', JUDGE_MODEL, judgeRequest(byId.get(r.id), transcripts), settings, { maxTokens: 3000, timeoutMs: 120000, temperature: 0 });
        const j = parseJudge(res.answer);
        // Map blind labels back to run labels.
        const mapBack = l => !runB ? runA.label : (l === 'A') !== swap ? runA.label : runB.label;
        passes.push({ swap, scores: { [mapBack('A')]: j.A, ...(j.B ? { [mapBack('B')]: j.B } : {}) }, preferred: j.preferida === undefined ? null : j.preferida === 'empate' ? 'empate' : mapBack(j.preferida), reason: j.motivo, observedModel: res.observedModel, usage: res.usage });
        if (orders.length > 1 && swap === orders[0]) await new Promise(res2 => setTimeout(res2, delayMs));
      }
      // With both orders, a win counts only when both orders agree.
      const preferred = passes.length === 1 ? passes[0].preferred : passes[0].preferred === passes[1].preferred ? passes[0].preferred : 'empate';
      const avg = (label, k) => passes.reduce((n, p) => n + (p.scores[label]?.[k] ?? 0), 0) / passes.length;
      const scores = Object.fromEntries(Object.keys(passes[0].scores).map(l => [l, Object.fromEntries(['naturalidad', 'instrucciones', 'fidelidad'].map(k => [k, avg(l, k)]))]));
      report.judgements.push({ id: r.id, category: r.category, swapped: first, scores, preferred, ...(passes.length > 1 ? { orderAgreement: passes[0].preferred === passes[1].preferred, passes: passes.map(p => p.preferred) } : {}), reason: passes.map(p => p.reason).join(' / '), observedModel: passes[0].observedModel, usage: passes.map(p => p.usage) });
      process.stderr.write(`${r.id}: ${preferred ?? JSON.stringify(passes[0].scores)}${passes.length > 1 ? ` (${passes.map(p => p.preferred).join(' | ')})` : ''}\n`);
    } catch (e) {
      report.judgements.push({ id: r.id, category: r.category, error: e.code || 'ERROR', message: e.message });
      if (['QUOTA_OR_RATE_LIMIT', 'FREE_ACCESS_EXHAUSTED', 'AUTH_OR_ACCESS_REQUIRED', 'NETWORK_UNAVAILABLE'].includes(e.code)) {
        report.judgements.pop(); report.status = `stopped-${e.code}`;
        await writeFile(outFile, JSON.stringify(report, null, 2) + '\n');
        process.stderr.write(`Detenido por ${e.code}. Continúa después con --resume ${outFile}\n`);
        return { report, outFile };
      }
    }
    await writeFile(outFile, JSON.stringify(report, null, 2) + '\n');
    await new Promise(res => setTimeout(res, delayMs));
  }
  report.status = 'completed';
  report.summary = summarizeJudge(report);
  report.finishedAt = new Date().toISOString();
  await writeFile(outFile, JSON.stringify(report, null, 2) + '\n');
  return { report, outFile };
}

export function summarizeJudge(report) {
  const ok = report.judgements.filter(j => !j.error);
  const avg = (label, k) => { const v = ok.map(j => j.scores[label]?.[k]).filter(Number.isFinite); return v.length ? +(v.reduce((x, y) => x + y, 0) / v.length).toFixed(2) : null; };
  const scores = Object.fromEntries(report.labels.map(l => [l, Object.fromEntries(['naturalidad', 'instrucciones', 'fidelidad'].map(k => [k, avg(l, k)]))]));
  const wins = report.mode === 'paired' ? Object.fromEntries([...report.labels, 'empate'].map(l => [l, ok.filter(j => j.preferred === l).length])) : null;
  const byCategory = {};
  for (const j of ok) { const g = (byCategory[j.category] ??= {}); if (j.preferred) g[j.preferred] = (g[j.preferred] ?? 0) + 1; }
  const agreement = ok.filter(j => 'orderAgreement' in j);
  return { judged: ok.length, errors: report.judgements.length - ok.length, scores, wins, byCategory, ...(agreement.length ? { orderAgreement: `${agreement.filter(j => j.orderAgreement).length}/${agreement.length}` } : {}) };
}

async function main() {
  const [cmd] = process.argv.slice(2);
  const { values } = parseArgs({ args: process.argv.slice(3), options: { label: { type: 'string' }, service: { type: 'string' }, only: { type: 'string' }, a: { type: 'string' }, b: { type: 'string' }, single: { type: 'string' }, resume: { type: 'string' }, 'delay-ms': { type: 'string' }, 'both-orders': { type: 'boolean' } } });
  if (cmd === 'run') {
    const { report, outFile } = await run({ label: values.label, servicePath: values.service && path.resolve(values.service), only: values.only });
    console.log(JSON.stringify({ status: report.status, failure: report.failure, summary: report.summary, outFile }, null, 2));
  } else if (cmd === 'judge') {
    if (!values.single && !(values.a && values.b)) throw Error('Usa --a y --b, o --single');
    const { report, outFile } = await judge({ a: values.a, b: values.b, single: values.single, resume: values.resume, delayMs: values['delay-ms'] ? Number(values['delay-ms']) : undefined, bothOrders: Boolean(values['both-orders']) });
    console.log(JSON.stringify({ status: report.status, summary: report.summary, outFile }, null, 2));
  } else throw Error('Comando: run | judge');
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(e => { console.error(e.message); process.exitCode = 1; });
