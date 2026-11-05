#!/usr/bin/env node
/**
 * Unattended distillation pipeline. It spends no Claude/Codex tokens: seeds come
 * from local Gemma 4, example answers from Kimi (when its 5-hour window is open),
 * and a sample review from Gemini. Deterministic checks decide what is kept.
 *
 *   node scripts/distill/pipeline.mjs [--max-hours 10]
 *
 * Stages, in order, resumable (state in artifacts/distill/pipeline-state.json):
 *   1 seeds   Gemma E4B writes the missing seed conversations (held-out filtered, deduplicated)
 *   2 examples  Kimi answers every seed through the real LEX AI service; production validators decide
 *   3 dataset build-dataset.mjs (train/valid + manifest)
 *   4 review  Gemini reads a sample of kept examples and flags unsupported claims
 * It never trains, never installs, never buys usage, never touches main. Stops on
 * its own after --max-hours. One instance at a time (lock file).
 */
import { spawn, execFileSync } from 'node:child_process';
import { appendFile, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { askGemma, askKimi, TeacherError } from './teacher.mjs';
import { CATEGORIES, seedPrompt, parseSeeds, leaksHeldOut } from './seeds.mjs';
import { lawPolicy } from './laws.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const D = p => path.join(ROOT, 'artifacts/distill', p);
const APP_LIBRARY = '/Applications/LEX AI.app/Contents/Resources/app/resources/public-library.sqlite';
const fold = s => String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));
export const TARGET = Object.fromEntries(CATEGORIES.map(c => [c.id, c.n]));

/** How many seeds each category still needs. */
export function missing(counts, target = TARGET) {
  return Object.fromEntries(Object.entries(target).map(([k, n]) => [k, Math.max(0, n - (counts[k] || 0))]).filter(([, n]) => n > 0));
}
export const memoryOk = (level, floor = 25) => Number.isFinite(level) && level >= floor;
const memoryLevel = () => { try { return Number(execFileSync('sysctl', ['-n', 'kern.memorystatus_level']).toString().trim()); } catch { return NaN; } };

const readJsonl = async f => (await readFile(f, 'utf8').catch(() => '')).trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
let started = Date.now();
const status = {};
async function note(msg) {
  const line = `${new Date().toISOString().slice(11, 19)} ${msg}`;
  await appendFile(D('pipeline.log'), line + '\n');
  await writeFile(D('pipeline-status.md'), `# Estado del pipeline de destilación\n\nÚltima actualización: ${new Date().toLocaleString('es-MX')}\n\n${Object.entries(status).map(([k, v]) => `- **${k}:** ${v}`).join('\n')}\n\nÚltimo evento: ${msg}\n\nRegistro completo: \`artifacts/distill/pipeline.log\`.\n`);
}

async function stageSeeds({ titles, held, deadline }) {
  const file = D('seeds-v1.jsonl');
  let seeds = await readJsonl(file);
  const seen = new Set(seeds.map(s => fold(s.turns.join(' '))));
  const run = Date.now().toString(36);
  for (const cat of CATEGORIES) {
    let empty = 0;
    for (;;) {
      const counts = {}; for (const s of seeds) counts[s.category] = (counts[s.category] || 0) + 1;
      const need = missing(counts)[cat.id] || 0;
      status.semillas = Object.entries(counts).map(([k, v]) => `${k} ${v}/${TARGET[k]}`).join(', ');
      if (!need || empty >= 4 || Date.now() > deadline) break;
      while (!memoryOk(memoryLevel())) { await note('memoria baja; pausa de 2 min'); await sleep(120000); }
      const sample = [...titles].sort(() => Math.random() - 0.5).slice(0, 25);
      try {
        const { answer } = await askGemma(seedPrompt(cat, sample, Math.min(10, need)));
        const fresh = parseSeeds(answer, cat.id).filter(it => !leaksHeldOut(it.turns.join(' '), held) && !seen.has(fold(it.turns.join(' '))));
        for (const it of fresh) { seen.add(fold(it.turns.join(' '))); seeds.push({ id: `${cat.id}-g${run}-${String(seeds.length + 1).padStart(4, '0')}`, ...it }); }
        await writeFile(file, seeds.map(s => JSON.stringify(s)).join('\n') + '\n');
        empty = fresh.length ? 0 : empty + 1;
        await note(`semillas ${cat.id}: +${fresh.length}`);
      } catch (e) { empty++; await note(`semillas ${cat.id}: error ${e.code || e.message}`); await sleep(5000); }
    }
  }
  return seeds.length;
}

async function kimiOpen() {
  try { await askKimi('Responde solo: ok', { model: 'kimi-code/k3.1-pro', timeoutMs: 150000 }); return true; }
  catch (e) { if (!(e instanceof TeacherError) || !['QUOTA_OR_RATE_LIMIT', 'EMPTY_RESPONSE', 'TIMEOUT'].includes(e.code)) await note(`Kimi: ${e.message}`); return false; }
}
const runChild = (args, log) => new Promise(res => { const c = spawn('node', args, { cwd: ROOT, stdio: ['ignore', 'ignore', 'ignore'] }); c.on('close', res); c.on('error', res); });

async function stageExamples({ deadline }) {
  let stuck = 0;
  for (;;) {
    const seeds = await readJsonl(D('seeds-v1.jsonl'));
    const done = new Set([...(await readFile(D('examples-v1-s0.done.txt'), 'utf8').catch(() => '')).split('\n'), ...(await readFile(D('examples-v1-s1.done.txt'), 'utf8').catch(() => '')).split('\n')].filter(Boolean));
    const pending = seeds.filter(s => !done.has(s.id)).length;
    const kept = (await readJsonl(D('examples-v1-s0.jsonl'))).length + (await readJsonl(D('examples-v1-s1.jsonl'))).length;
    status.ejemplos = `${done.size}/${seeds.length} semillas procesadas, ${kept} ejemplos aceptados`;
    if (!pending) return true;
    if (Date.now() > deadline) return false;
    if (!(await kimiOpen())) { await note('Kimi en su límite de 5 horas; espero 15 min'); await sleep(900000); continue; }
    await note(`Kimi disponible; generando (${pending} semillas pendientes)`);
    const before = done.size;
    await Promise.all([0, 1].map(n => runChild(['scripts/distill/generate.mjs', '--seeds', 'artifacts/distill/seeds-v1.jsonl', '--out', `artifacts/distill/examples-v1-s${n}.jsonl`, '--shard', `${n}/2`, '--model', 'kimi-code/k3.1-pro', '--resume'])));
    const after = new Set([...(await readFile(D('examples-v1-s0.done.txt'), 'utf8').catch(() => '')).split('\n'), ...(await readFile(D('examples-v1-s1.done.txt'), 'utf8').catch(() => '')).split('\n')].filter(Boolean)).size;
    stuck = after > before ? 0 : stuck + 1;
    if (stuck >= 3) { await note('sin progreso en 3 rondas; me detengo'); return false; }
  }
}

async function main() {
  const { values } = parseArgs({ options: { 'max-hours': { type: 'string' } } });
  await mkdir(D('.'), { recursive: true });
  const lock = D('pipeline.lock');
  try { await writeFile(lock, String(process.pid), { flag: 'wx' }); }
  catch { const pid = Number(await readFile(lock, 'utf8').catch(() => 0)); try { process.kill(pid, 0); console.error(`Ya hay un pipeline en marcha (PID ${pid}).`); process.exit(1); } catch { await writeFile(lock, String(process.pid)); } }
  const deadline = started + Number(values['max-hours'] || 10) * 3600000;
  try {
    const { openPublicLibrary } = await import(path.join(ROOT, 'server/public-library.mjs'));
    const library = await openPublicLibrary(APP_LIBRARY);
    const { allowed } = await lawPolicy(library); library.close();
    const titles = allowed.filter(l => l.articles >= 40).sort((a, b) => b.articles - a.articles).slice(0, 60).map(l => l.title.replace(/\s+/g, ' ').trim());
    const held = (await readFile(path.join(ROOT, 'eval/dialogue/cases.jsonl'), 'utf8')).trim().split('\n').map(l => JSON.parse(l).turns.join(' '));
    status.etapa = '1/4 semillas con Gemma 4 local'; await note('inicio'); await stageSeeds({ titles, held, deadline });
    status.etapa = '2/4 ejemplos con Kimi'; await note('semillas completas; sigo con ejemplos');
    const complete = await stageExamples({ deadline });
    if (!complete) { status.etapa = 'DETENIDO (tiempo o sin progreso); se puede relanzar'; await note('detenido antes de terminar los ejemplos'); return; }
    status.etapa = '3/4 conjunto de datos';
    await runChild(['scripts/distill/build-dataset.mjs', '--in', 'artifacts/distill/examples-v1-s0.jsonl,artifacts/distill/examples-v1-s1.jsonl', '--out', 'artifacts/distill/dataset-v1']);
    const manifest = JSON.parse(await readFile(D('dataset-v1/manifest.json'), 'utf8').catch(() => 'null'));
    status.conjunto = manifest ? `${manifest.train} de entrenamiento, ${manifest.valid} de validación` : 'no se pudo construir';
    status.etapa = '4/4 revisión de muestra con Gemini'; await review();
    status.etapa = 'LISTO PARA ENTRENAR (el entrenamiento no es automático)'; await note('terminado');
  } finally { await rm(lock, { force: true }); }
}

async function review() {
  const ex = [...(await readJsonl(D('examples-v1-s0.jsonl'))), ...(await readJsonl(D('examples-v1-s1.jsonl')))].filter(e => e.kind === 'json');
  const sample = ex.sort(() => Math.random() - 0.5).slice(0, 8).map(e => { const u = JSON.parse(e.messages.at(-1).content); return `PREGUNTA: ${u.question}\nFUENTES: ${(u.sources || []).map(s => `${s.id} art.${s.article}: ${(s.allowedQuotes || []).join(' | ').slice(0, 500)}`).join(' // ')}\nRESPUESTA: ${e.output.slice(0, 900)}`; }).join('\n\n---\n\n');
  if (!sample) return;
  const prompt = `Revisa estas respuestas de un asistente jurídico sintético. Para cada una di en una línea si TODAS las afirmaciones están respaldadas por la cita y las fuentes mostradas (sí/no) y, si no, qué afirmación no lo está. Solo texto mostrado; sin herramientas. Datos sintéticos y legislación pública.\n\n${sample}`.slice(0, 15000);
  try {
    const out = await new Promise((res, rej) => { const c = spawn('opinion', [prompt], { cwd: '/tmp' }); let o = ''; c.stdout.on('data', d => o += d); c.on('close', code => code === 0 && o.trim() ? res(o.trim()) : rej(new Error(`opinion salió con ${code}`))); c.on('error', rej); });
    await writeFile(D('gemini-review.md'), `# Revisión de muestra por Gemini\n\n${out}\n`);
    await note('revisión de Gemini guardada en gemini-review.md');
  } catch (e) { await note(`revisión de Gemini no disponible: ${e.message}`); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(async e => { await note(`ERROR: ${e.message}`).catch(() => {}); console.error(e.message); process.exitCode = 1; });
