import { readFile, writeFile, mkdir, mkdtemp, rm, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { performance } from 'node:perf_hooks';
import { createService } from '../server/service.mjs';
import { openPublicLibrary } from '../server/public-library.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const AREAS = ['constitucional', 'civil', 'familiar', 'penal', 'laboral', 'mercantil', 'fiscal', 'amparo', 'administrativo', 'seguridad-social'];
const FLAGS = ['mustCite', 'mustAbstain', 'mustAskJurisdiction', 'chatOnly'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const normalize = text => String(text ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
const folded = text => normalize(text).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const metric = (passed, total) => ({ passed, total, rate: total ? passed / total : null });

export async function loadCases({ casesPath = path.join(ROOT, 'eval/areas/cases.jsonl'), manifestPath = path.join(ROOT, 'eval/areas/manifest.json'), library } = {}) {
  const bytes = await readFile(casesPath);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (sha(bytes) !== manifest.casesSha256) throw Error('Dataset hash mismatch');
  const cases = bytes.toString('utf8').trim().split('\n').map(line => JSON.parse(line));
  if (cases.length !== manifest.cases) throw Error('Dataset count mismatch');
  const ids = new Set(), retained = new Set(manifest.heldOutLaws.map(law => law.law_id));
  for (const c of cases) {
    if (!/^[a-z0-9-]{1,64}$/.test(c.id) || ids.has(c.id) || !AREAS.includes(c.area) || c.synthetic !== true) throw Error('Invalid case identity');
    ids.add(c.id);
    if (!Array.isArray(c.turns) || c.turns.length < 1 || c.turns.length > 3 || c.turns.some(t => t.role !== 'user' || typeof t.content !== 'string' || !t.content.trim() || t.content.length > 4000)) throw Error(`Invalid turns: ${c.id}`);
    if (FLAGS.filter(flag => c.expected?.[flag] === true).length !== 1 || !Array.isArray(c.expected.laws) || !Array.isArray(c.expected.articles)) throw Error(`Invalid expectation: ${c.id}`);
    if (c.expected.mustCite ? !c.expected.articles.length || !c.expected.laws.length : c.expected.articles.length || c.expected.laws.length) throw Error(`Invalid citation targets: ${c.id}`);
    for (const target of c.expected.articles) {
      if (!retained.has(target.law_id) || !c.expected.laws.includes(target.law_id) || !c.provenance.some(p => p.role === 'support' && p.article_id === target.article_id && p.law_id === target.law_id && p.article === target.article && p.expectedFragment === target.expectedFragment)) throw Error(`Unanchored target: ${c.id}`);
    }
    for (const p of c.provenance) {
      if (!retained.has(p.law_id) || typeof p.expectedFragment !== 'string' || p.expectedFragment.length < 30) throw Error(`Invalid provenance: ${c.id}`);
      if (library) {
        const source = library.getSource(p.article_id);
        if (!source || source.lawId !== p.law_id || source.article !== p.article || source.originalId !== p.originalId || source.version !== p.version || source.textSha256 !== p.textSha256 || source.pdfSha256 !== p.pdfSha256 || source.url !== p.sourceUrl || !source.text.includes(p.expectedFragment) || sha(source.text) !== p.textSha256) throw Error(`Source/fragment mismatch: ${c.id}`);
      }
    }
    if (library && c.unavailableTarget && library.lookupArticle({ lawId: c.unavailableTarget.law_id, articleId: c.unavailableTarget.article })) throw Error(`Abstention target now exists: ${c.id}`);
  }
  if (library && library.status().indexSha256 !== manifest.libraryIndexSha256) throw Error('Library snapshot differs from dataset; review and rebuild explicitly');
  return { cases, manifest };
}

// Observe the dependency-injection boundary, not a duplicate implementation of
// research/ranking. The wrapper neither filters nor reorders sources.
export function instrumentInference({ delegate = null, resolveSource, observe }) {
  return {
    outputContract: delegate?.outputContract ?? 'paragraph-citations-v1',
    async *generate(messages, options = {}) {
      const prompt = options.responseFormat === 'text' ? null : JSON.parse(messages.at(-1).content);
      const sources = (prompt?.sources ?? []).map(s => {
        const canonical = resolveSource(s);
        return { modelId: s.id, sourceId: canonical?.id ?? null, law_id: canonical?.lawId ?? canonical?.law ?? null, article: String(canonical?.article ?? s.article ?? '').replace(/^Artículo\s+/i, ''), title: s.title, text: s.text, allowedQuotes: s.allowedQuotes ?? [], resolved: Boolean(canonical) };
      });
      observe({ sources, contract: options.responseFormat === 'text' ? 'chat' : 'grounded' });
      if (delegate) { yield* delegate.generate(messages, options); return; }
      if (!prompt) { yield 'Hola. Podemos organizar las ideas y preparar una agenda de trabajo.'; return; }
      // This is a deterministic transport fixture, NEVER a quality score. It
      // persists a valid turn so the real service can build follow-up context.
      if (this.outputContract === 'paragraph-citations-v1') {
        const allowed = options.outputSchema?.properties?.paragraphs?.items?.anyOf ?? [];
        const citeable = prompt.sources.filter(s => allowed.some(branch => branch.properties?.sourceId?.const === s.id));
        yield JSON.stringify({ paragraphs: citeable.slice(0, 3).map(s => ({ sourceId: s.id, quote: allowed.find(branch => branch.properties?.sourceId?.const === s.id).properties.quote.enum[0], text: 'El pasaje citado se conserva como evidencia para esta consulta.', kind: 'observacion' })) });
      } else {
        yield JSON.stringify({ analysis: prompt.sources.map(s => `El pasaje citado se conserva como evidencia para esta consulta. [${s.id}]`).join('\n\n'), citations: prompt.sources.map(s => ({ sourceId: s.id, quote: s.allowedQuotes[0] })) });
      }
    },
  };
}

export function scoreRetrieval(expected, evidence) {
  if (!expected.mustCite) return { lawHitAt3: null, articleHitAt3: null, fragmentHitAt3: null };
  const top = evidence.slice(0, 3);
  const matches = (s, t) => s.law_id === t.law_id && s.article === t.article;
  return {
    lawHitAt3: top.some(s => expected.laws.includes(s.law_id)),
    articleHitAt3: top.some(s => expected.articles.some(t => matches(s, t))),
    fragmentHitAt3: top.some(s => expected.articles.some(t => matches(s, t) && normalize(s.text).includes(normalize(t.expectedFragment)))),
  };
}

export function scoreAnswer({ expected, answer, evidence = [], getSource, error = null }) {
  const text = answer?.text ?? '', citations = answer?.citations ?? [];
  const references = [...text.matchAll(/\[([^\]\n]+)\]/g)].map(m => m[1]);
  const citationChecks = citations.map(c => {
    const referenceId = c.id ?? c.sourceId, id = c.canonicalId ?? referenceId;
    const source = getSource(id);
    const quote = normalize(c.quote);
    const supplied = evidence.find(s => s.sourceId === id && (referenceId === id || s.modelId === referenceId));
    const valid = Boolean(source && supplied && quote.length >= 12 && normalize(source.text).includes(quote) && normalize(supplied.text).includes(quote) && references.includes(referenceId) && (!c.article || String(c.article) === String(source.article)) && (!c.lawId || c.lawId === source.lawId));
    return { sourceId: id, referenceId, valid, expectedTarget: valid && expected.articles.some(t => t.law_id === (source.lawId ?? source.law) && t.article === String(source.article)) };
  });
  const allReferencesValid = references.every(id => citationChecks.some(c => c.referenceId === id && c.valid));
  const noCitations = citations.length === 0 && references.length === 0 && !/\bart[ií]culos?\s+\d|https?:\/\//i.test(text);
  const successful = !error && Boolean(text.trim());
  const status = answer?.validation?.status ?? '';
  const asksState = /(?:¿[^?]*(?:en que|cual|que)\s+(?:estado|entidad federativa|jurisdiccion)|(?:indica|precisa|dime|necesito saber)\b[^.?!]{0,70}\b(?:estado|entidad federativa|jurisdiccion))/.test(folded(text));
  // Conservative behavioral proxy: a question mark alone is not abstention,
  // and a thrown inference error never counts as a correct refusal.
  const refuses = /^(?:abstained-|needs-jurisdiction-source)/.test(status) || /(?:no (?:tengo|encontre|dispongo de|cuento con|puedo verificar|puedo fundamentar))[^.!?]{0,150}(?:fuente|articulo|disposicion|biblioteca|texto)/.test(folded(text));
  const requestSource = /(?:comparte|proporciona|facilita|necesito|indica|precisa)[^.!?]{0,160}(?:fuente|texto|articulo|disposicion)/.test(folded(text));
  return {
    citationChecks,
    validCitations: citationChecks.filter(c => c.valid).length,
    citationCount: citations.length,
    citationFidelity: citations.length ? citationChecks.every(c => c.valid) && allReferencesValid && !error : null,
    mustCite: expected.mustCite ? successful && citations.length > 0 && citationChecks.every(c => c.valid) && allReferencesValid && citationChecks.some(c => c.expectedTarget) : null,
    mustAbstain: expected.mustAbstain ? successful && noCitations && refuses && requestSource : null,
    mustAskJurisdiction: expected.mustAskJurisdiction ? successful && noCitations && asksState : null,
    chatOnly: expected.chatOnly ? successful && answer.kind === 'chat' && noCitations : null,
    reviewRequired: true,
  };
}

export async function evaluateCases({ cases, service, captured, clearCapture, getSource, mode, onProgress = () => {} }) {
  const results = [];
  for (const c of cases) {
    const turns = [], caseStarted = performance.now();
    for (const [index, turn] of c.turns.entries()) {
      clearCapture();
      const started = performance.now();
      let answer = null, error = null;
      try { answer = await service.analyze({ mode: 'auto', skillId: 'auto', question: turn.content, threadId: c.id }); }
      catch (e) { error = e.message; }
      const elapsedMs = performance.now() - started;
      const observations = captured();
      const evidence = observations.flatMap(o => o.sources).slice(0, 3);
      turns.push({ index, question: turn.content, elapsedMs, inferenceCalls: observations.length, evidence, retrieval: scoreRetrieval(c.expected, evidence), answer: answer ? { kind: answer.kind, text: answer.text, citations: answer.citations, validation: answer.validation } : null, error, behavior: mode === 'live' ? scoreAnswer({ expected: c.expected, answer, evidence, getSource, error }) : null });
      // Do not fabricate history after an error. The case still fails and keeps
      // the evidence captured before the failure for retrieval diagnostics.
      if (error) break;
    }
    results.push({ id: c.id, area: c.area, type: c.type, expected: c.expected, complete: turns.length === c.turns.length && turns.every(t => !t.error), elapsedMs: performance.now() - caseStarted, turns });
    onProgress(results.at(-1), results.length, cases.length);
  }
  return results;
}

export function summarize(results, mode) {
  return AREAS.filter(area => results.some(c => c.area === area)).map(area => {
    const group = results.filter(c => c.area === area), positives = group.filter(c => c.expected.mustCite);
    const hit = key => metric(positives.filter(c => c.complete && c.turns.at(-1).retrieval[key]).length, positives.length);
    const behavior = flag => {
      const relevant = group.filter(c => c.expected[flag]);
      return mode === 'live' ? metric(relevant.filter(c => c.complete && c.turns.every(t => t.behavior?.[flag])).length, relevant.length) : null;
    };
    const turns = group.flatMap(c => c.turns), times = turns.map(t => t.elapsedMs).sort((a, b) => a - b);
    const byType = Object.fromEntries(['direct', 'colloquial', 'follow-up'].map(type => {
      const subset = positives.filter(c => c.type === type);
      return [type, metric(subset.filter(c => c.complete && c.turns.at(-1).retrieval.articleHitAt3).length, subset.length)];
    }));
    return { area, cases: group.length, turns: turns.length, errors: turns.filter(t => t.error).length, lawHitAt3: hit('lawHitAt3'), articleHitAt3: hit('articleHitAt3'), fragmentHitAt3: hit('fragmentHitAt3'), articleHitAt3ByType: byType, citationFidelity: mode === 'live' ? metric(turns.reduce((n, t) => n + t.behavior.validCitations, 0), turns.reduce((n, t) => n + t.behavior.citationCount, 0)) : null, mustCite: behavior('mustCite'), mustAbstain: behavior('mustAbstain'), mustAskJurisdiction: behavior('mustAskJurisdiction'), chatOnly: behavior('chatOnly'), latencyMs: { mean: times.reduce((a, b) => a + b, 0) / times.length, p50: times[Math.ceil(times.length * .5) - 1], p95: times[Math.ceil(times.length * .95) - 1] } };
  });
}

const fmt = m => !m || m.rate === null ? '—' : `${m.passed}/${m.total} (${(100 * m.rate).toFixed(1)}%)`;
export function markdownReport(report) {
  const rows = report.summary.map(s => `| ${s.area} | ${s.cases} | ${fmt(s.lawHitAt3)} | ${fmt(s.articleHitAt3)} | ${fmt(s.fragmentHitAt3)} | ${fmt(s.citationFidelity)} | ${fmt(s.mustCite)} | ${fmt(s.mustAbstain)} | ${fmt(s.mustAskJurisdiction)} | ${fmt(s.chatOnly)} | ${s.latencyMs.p95.toFixed(1)} | ${s.errors} |`);
  return `# Evaluación por área — ${report.mode}\n\nFecha UTC: ${report.startedAt}. Estado: ${report.status}.\n\n${report.failure ? `Error de ejecución: ${report.failure}\n\n` : ''}Casos: ${report.dataset.cases}. SHA-256: \`${report.dataset.casesSha256}\`.\n\n| Área | Casos | Ley hit@3 | Artículo hit@3 | Fragmento hit@3 | Citas válidas | Debe citar | Abstención | Pide estado | Charla sin citas | p95 ms/turno | Errores |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n${rows.join('\n')}\n\nHit@3 usa el último turno de cada caso positivo completo; los negativos no inflan el denominador. JSON conserva cada turno, pasaje, respuesta, error y desglose directa/coloquial/seguimiento. Un fallo de ejecución cuenta como fallo del caso, nunca como abstención correcta.\n\n${report.mode === 'retrieval' ? 'Inferencia simulada: fidelidad, abstención, jurisdicción y charla NO se califican. La latencia corresponde al servicio con simulación, no al motor real. Los seguimientos usan respuestas deterministas con las fuentes recuperadas.\n\n' : 'Las métricas conductuales son comprobaciones automáticas conservadoras; las respuestas requieren revisión humana. La fidelidad comprueba procedencia y literalidad, no corrección jurídica ni respaldo semántico de cada afirmación.\n\n'}La retención por ley es prospectiva: las leyes figuraban como train en el snapshot. No se acredita ausencia de exposición previa, vigencia, validación profesional ni funcionamiento en 8 GB.\n`;
}

async function readyInference(inference, timeoutMs) {
  await inference.initialize();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await inference.status();
    if (status.state === 'ready') return;
    if (status.state === 'error' || status.supported === false) throw Error(status.message || 'Motor local no disponible');
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw Error('Tiempo de inicialización excedido');
}

async function implementationFiles(dir = 'server') {
  const files = [];
  for (const entry of await readdir(path.join(ROOT, dir), { withFileTypes: true })) {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await implementationFiles(relative));
    else if (entry.isFile() && entry.name.endsWith('.mjs')) files.push(relative);
  }
  return files.sort();
}

export async function runEvaluation({ mode, libraryPath = path.join(ROOT, 'resources/public-library.sqlite'), modelsDir, runtimePath, catalogPath, outputDir = path.join(ROOT, 'artifacts/eval-areas'), onProgress = () => {} } = {}) {
  if (!['retrieval', 'live'].includes(mode)) throw Error('Choose retrieval or live');
  const startedAt = new Date().toISOString();
  const runDir = await mkdtemp(path.join(tmpdir(), 'lex-eval-areas-'));
  let library, service, delegate, report;
  try {
    library = await openPublicLibrary(libraryPath);
    const { cases, manifest } = await loadCases({ library });
    const corpusPath = path.join(ROOT, 'resources/legal-corpus.json');
    const corpusBytes = await readFile(corpusPath), corpus = JSON.parse(corpusBytes);
    const originalSources = new Map(corpus.map(s => [s.id, s]));
    let hydrated = [], observations = [];
    const observedLibrary = { ...library, getSource(id) { const source = library.getSource(id); if (source) hydrated.push(source); return source; } };
    const getSource = id => typeof id === 'string' && /^PUB-[a-f0-9]{64}$/.test(id) ? library.getSource(id) : originalSources.get(id);
    report = { schemaVersion: 1, startedAt, mode, status: 'running', dataset: manifest, corpusSha256: sha(corpusBytes), library: { indexSha256: library.status().indexSha256, corpusSha256: library.status().corpusSha256 }, implementationSha256: {}, results: [], summary: [] };
    const serverFiles = await implementationFiles();
    for (const file of ['scripts/eval-areas.mjs', ...serverFiles, 'resources/state-library.jsonl', 'resources/state-library-catalog.json']) report.implementationSha256[file] = sha(await readFile(path.join(ROOT, file)));
    if (mode === 'live') {
      // Explicitly use an existing local model store. Never use the user's
      // workspace DB, download, or copy bundled multi-GB assets automatically.
      if (!modelsDir) throw Error('--live requires --models-dir pointing to an existing local model store');
      const modelCatalog = JSON.parse(await readFile(catalogPath ?? path.join(ROOT, 'resources/model-catalog.json'), 'utf8'));
      report.runtime = { catalogSha256: sha(JSON.stringify(modelCatalog)), manifestDigest: modelCatalog.manifestDigest, outputContract: 'paragraph-citations-v1' };
      const { createInference } = await import('../server/inference.mjs');
      delegate = createInference({ dataDir: path.join(runDir, 'runtime'), modelsDir: path.resolve(modelsDir), runtimePath, modelCatalog: { ...modelCatalog, localOnly: true }, allowDownload: false });
      await readyInference(delegate, 180_000);
    }
    const inference = instrumentInference({ delegate, resolveSource: s => [...hydrated, ...originalSources.values()].find(x => x.title === s.title && String(x.article) === String(s.article) && normalize(x.text).includes(normalize(s.text))), observe: observation => observations.push(observation) });
    service = await createService({ dataDir: path.join(runDir, 'synthetic-workspace'), corpusPath, inference, publicLibrary: observedLibrary, schedulerEnabled: false });
    await service.dispatch('workspace.create', { name: 'Evaluación sintética por área', practiceAreas: AREAS });
    report.results = await evaluateCases({ cases, service, captured: () => observations, clearCapture: () => { observations = []; hydrated = []; }, getSource, mode, onProgress });
    report.summary = summarize(report.results, mode);
    report.status = report.results.some(c => !c.complete) ? 'completed-with-errors' : 'completed';
    report.implementationChangedDuringRun = [];
    for (const [file, hash] of Object.entries(report.implementationSha256)) if (sha(await readFile(path.join(ROOT, file))) !== hash) report.implementationChangedDuringRun.push(file);
    for (const file of await implementationFiles()) if (!serverFiles.includes(file)) report.implementationChangedDuringRun.push(file);
    if (report.implementationChangedDuringRun.length) report.status = 'invalidated-source-changed';
  } catch (e) {
    report ??= { schemaVersion: 1, startedAt, mode, dataset: { cases: 0, casesSha256: 'unavailable' }, results: [], summary: [] };
    report.status = 'failed'; report.failure = e.message;
  } finally {
    service?.close();
    try { await delegate?.stop(); } finally { library?.close(); await rm(runDir, { recursive: true, force: true }); }
  }
  report.finishedAt = new Date().toISOString();
  await mkdir(outputDir, { recursive: true });
  const stem = `${startedAt.replace(/[:.]/g, '-')}-${mode}`;
  const jsonPath = path.join(outputDir, `${stem}.json`), markdownPath = path.join(outputDir, `${stem}.md`);
  await writeFile(jsonPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  await writeFile(markdownPath, markdownReport(report), { flag: 'wx' });
  return { report, jsonPath, markdownPath };
}

async function main() {
  const { values } = parseArgs({ options: { retrieval: { type: 'boolean' }, live: { type: 'boolean' }, 'models-dir': { type: 'string' }, 'runtime-path': { type: 'string' }, catalog: { type: 'string' }, 'library-path': { type: 'string' }, 'output-dir': { type: 'string' } } });
  if (Boolean(values.retrieval) === Boolean(values.live)) throw Error('Use exactly one of --retrieval or --live');
  const { report, jsonPath, markdownPath } = await runEvaluation({ mode: values.live ? 'live' : 'retrieval', modelsDir: values['models-dir'], runtimePath: values['runtime-path'], catalogPath: values.catalog, libraryPath: values['library-path'], outputDir: values['output-dir'], onProgress: (c, done, total) => { if (done % 20 === 0) console.error(`${done}/${total}: ${c.area}`); } });
  console.log(markdownReport(report));
  console.log(`JSON: ${jsonPath}\nMarkdown: ${markdownPath}`);
  if (report.status !== 'completed') process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(e => { console.error(e.message); process.exitCode = 1; });
