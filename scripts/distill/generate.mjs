#!/usr/bin/env node
/**
 * Distillation examples: the real LEX AI service runs each seed conversation,
 * but its model is replaced by the teacher. The teacher receives exactly the
 * messages (and output schema) the small model gets in production; production
 * validators decide which outputs become training examples.
 *
 *   node scripts/distill/generate.mjs --seeds artifacts/distill/seeds-pilot.jsonl --out artifacts/distill/examples-pilot.jsonl
 *
 * An example is kept only if: the turn validated as source-checked with no
 * dropped paragraph (legal JSON) or as plain conversation (chat); and every
 * source in its prompt belongs to an allowed (train-split, non-sealed) law.
 */
import { mkdtemp, mkdir, readFile, writeFile, appendFile, rm } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { askKimi, unfence } from './teacher.mjs';
import { lawPolicy } from './laws.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const APP_LIBRARY = '/Applications/LEX AI.app/Contents/Resources/app/resources/public-library.sqlite';
const fold = s => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

const LEGAL_RULES = `Reglas de calidad para tu respuesta (el modelo pequeño aprenderá de ella):
- Elige la cita que de verdad responde la pregunta. Cada párrafo jurídico: sourceId de una fuente recibida y quote copiada EXACTAMENTE de su allowedQuotes.
- En text explica en español claro, para alguien sin formación jurídica, lo que dice esa cita aplicado a la pregunta (subsunción directa). No agregues plazos, sanciones, recursos ni consecuencias que la cita no diga. Si la consecuencia que preguntan no está en la cita, dilo: «La disposición citada no especifica…».
- Números, fechas y artículos: solo los que aparecen en la fuente citada.
- Si falta un dato que cambia la respuesta (estado, fechas, montos, tipo de contrato), añade un párrafo {"kind":"conversacion","text":"…"} que lo pregunte de forma concreta.
- Si ninguna fuente sirve para la pregunta, responde solo con un párrafo conversacional que lo diga con honestidad y pida la disposición o el dato; no fuerces una cita.
- De 1 a 3 párrafos; cada text de 40 a 350 caracteres; sin corchetes ni marcas de cita; no copies la cita literal en text.
- Devuelve SOLO el JSON, sin texto antes ni después.`;
const CHAT_RULES = `Reglas de calidad para tu respuesta (el modelo pequeño aprenderá de ella):
- Responde al último mensaje como una persona atenta, en español natural de México, breve salvo que pidan desarrollar.
- Cumple instrucciones exactas al pie de la letra (formato, idioma, «responde solo con…», número de ideas).
- Si solo quieren platicar o desahogarse, escucha; no des consejos ni listas no pedidas. No ofrezcas servicios ni cierres con «¿en qué puedo ayudarte?».
- Si piden contar algo (un dato curioso, una idea), cuéntalo directamente. No inventes datos: si no estás seguro de un hecho, elige otro que sí sea correcto.
- Sin afirmaciones jurídicas (no hay fuentes en este turno); si la pregunta es jurídica, di que necesitas la disposición.
- Devuelve SOLO el texto de la respuesta.`;

export function teacherPrompt(messages, { outputSchema } = {}) {
  const shown = messages.map(m => `### ${m.role}\n${m.content}`).join('\n\n');
  const json = Boolean(outputSchema);
  return `Vas a escribir la respuesta ideal del asistente LEX AI para estos mensajes, exactamente en el formato que pide su mensaje de sistema.\n\n${shown}\n\n${json ? `La respuesta debe ser JSON que cumpla este esquema:\n${JSON.stringify(outputSchema)}\n\n${LEGAL_RULES}` : CHAT_RULES}`;
}

async function main() {
  const { values } = parseArgs({ options: { seeds: { type: 'string' }, out: { type: 'string' }, model: { type: 'string' }, limit: { type: 'string' }, resume: { type: 'boolean' }, shard: { type: 'string' } } });
  const seeds = (await readFile(path.resolve(values.seeds), 'utf8')).trim().split('\n').map(l => JSON.parse(l)).slice(0, values.limit ? Number(values.limit) : undefined);
  const out = path.resolve(values.out);
  const rejectedFile = out.replace(/\.jsonl$/, '.rejected.jsonl');
  const doneFile = out.replace(/\.jsonl$/, '.done.txt');
  await mkdir(path.dirname(out), { recursive: true });
  // --shard i/n: this worker takes every n-th seed starting at i.
  if (values.shard) { const [i, n] = values.shard.split('/').map(Number); seeds.splice(0, seeds.length, ...seeds.filter((_, k) => k % n === i)); }
  // --resume: keep previous output and skip seeds already finished.
  const done = new Set(values.resume ? (await readFile(doneFile, 'utf8').catch(() => '')).split('\n').filter(Boolean) : []);
  if (!values.resume) { await writeFile(out, ''); await writeFile(rejectedFile, ''); await writeFile(doneFile, ''); }
  const { createService } = await import(pathToFileURL(path.join(ROOT, 'server/service.mjs')));
  const { openPublicLibrary } = await import(pathToFileURL(path.join(ROOT, 'server/public-library.mjs')));
  const library = await openPublicLibrary(APP_LIBRARY);
  const policy = await lawPolicy(library);
  const lawByTitle = new Map(library.status().laws.map(l => [fold(l.title), l.id]));
  const dir = await mkdtemp(path.join(os.tmpdir(), 'lex-distill-'));
  let calls = [];
  const inference = {
    async status() { return { state: 'ready' }; },
    async initialize() {}, async stop() {},
    async *generate(messages, options = {}) {
      const call = { messages, json: Boolean(options.outputSchema), raw: '', error: null };
      calls.push(call);
      try { call.raw = unfence((await askKimi(teacherPrompt(messages, options), { model: values.model })).answer); }
      catch (e) { call.error = e.code || 'ERROR'; throw e; }
      yield call.raw;
    },
  };
  const service = await createService({ dataDir: path.join(dir, 'w'), corpusPath: path.join(ROOT, 'resources/legal-corpus.json'), inference, publicLibrary: library, schedulerEnabled: false });
  await service.dispatch('workspace.create', { name: 'Destilación sintética', practiceAreas: ['civil', 'penal', 'mercantil', 'fiscal', 'administrativo', 'laboral', 'familiar', 'constitucional'] });
  const stats = { seeds: 0, turns: 0, kept: 0, rejected: {}, startedAt: new Date().toISOString() };
  const reject = async (reason, extra) => { stats.rejected[reason] = (stats.rejected[reason] || 0) + 1; await appendFile(rejectedFile, JSON.stringify({ reason, ...extra }) + '\n'); };
  try {
    for (const seed of seeds) {
      if (done.has(seed.id)) continue;
      stats.seeds++;
      for (const [t, question] of seed.turns.entries()) {
        stats.turns++; calls = [];
        let answer;
        try { answer = await service.analyze({ mode: 'auto', question, threadId: `d-${seed.id}`.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 64) }); }
        catch (e) {
          const call = calls.at(-1);
          await reject(call?.error || 'SERVICE_ERROR', { seed: seed.id, question, message: e.message, raw: call?.raw });
          if (call?.error === 'QUOTA_OR_RATE_LIMIT') { stats.stoppedBy = 'QUOTA_OR_RATE_LIMIT'; throw e; }
          continue;
        }
        if (!calls.length) { await reject('NO_MODEL_CALL', { seed: seed.id, question, status: answer.validation?.status }); continue; }
        const call = calls.at(-1);
        const status = answer.validation?.status;
        const dropped = (answer.validation?.checks || []).some(c => /^dropped-/.test(c));
        let sources = [];
        if (call.json) { try { sources = JSON.parse(call.messages.at(-1).content).sources || []; } catch { /* chat */ } }
        const lawIds = sources.map(s => lawByTitle.get(fold(s.title)) || 'UNKNOWN');
        const okStatus = call.json ? status === 'source-checked' && !dropped : status === 'unverified-conversation';
        const okLaws = lawIds.every(id => id !== 'UNKNOWN' && policy.isAllowed(id));
        if (!okStatus || !okLaws) { await reject(!okLaws ? 'HELD_OUT_OR_UNKNOWN_LAW' : `VALIDATION_${status}${dropped ? '_DROPPED' : ''}`, { seed: seed.id, question, lawIds, raw: call.raw }); continue; }
        stats.kept++;
        await appendFile(out, JSON.stringify({ id: `${seed.id}-t${t + 1}`, seed: seed.id, category: seed.category, kind: call.json ? 'json' : 'text', lawIds, messages: call.messages, output: call.raw, teacher: values.model || 'kimi-code/k3', synthetic: true }) + '\n');
      }
      await appendFile(doneFile, seed.id + '\n');
      process.stderr.write(`${seed.id}: kept ${stats.kept}/${stats.turns}\n`);
    }
  } finally {
    service.close(); library.close(); await rm(dir, { recursive: true, force: true });
    stats.finishedAt = new Date().toISOString();
    await writeFile(out.replace(/\.jsonl$/, `.stats-${Date.now()}.json`), JSON.stringify(stats, null, 2) + '\n');
    console.log(JSON.stringify(stats, null, 2));
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e.message); process.exitCode = 1; });
