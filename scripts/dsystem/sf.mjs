#!/usr/bin/env node
/**
 * dsystem SF (Software Factory): independent-viewpoint panel.
 *
 *   dsf panel --request sf-request.json [--from claude|codex] [--workers groq,gemma] [--out DIR]
 *   dsf seats                    # which seats exist and whether they are usable now
 *
 * The initiating agent (Claude or Codex) is the "elephant": it keeps the project
 * context and decides. The seats are "goldfish": fresh reviewers that see only
 * the reviewed packet and answer through one lens each. Seats the script cannot
 * call (Claude, Codex, Cursor) get a ready-to-paste handoff file instead.
 *
 * Rules: reviewed synthetic/public packets only (same gate as `dsystem ask`), no
 * file or repo access for any seat, no retries, no paid fallbacks, and a seat
 * failure never blocks the others. Output is advice for the elephant to weigh.
 */
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRequest, loadSettings, ask as remoteAsk, status as remoteStatus } from './remote.mjs';
import { askKimi } from '../distill/teacher.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Strengths are a working policy, not a benchmark. Change them in one place. */
export const SEATS = {
  gemini: { label: 'Gemini', kind: 'auto', tier: 'decision', lens: 'Contradice los supuestos del plan: qué está mal planteado, qué riesgo de producto, negocio o seguridad falta, qué alternativa más simple existe.' },
  kimi: { label: 'Kimi', kind: 'auto', tier: 'decision', lens: 'Lectura larga y alternativas de arquitectura: casos límite, fallos de integración, orden de implementación y una opción distinta a la propuesta.' },
  groq: { label: 'Groq (gpt-oss-120b, gratis)', kind: 'auto', tier: 'worker', lens: 'Tarea acotada: lista concreta de casos de prueba y criterios de aceptación medibles para el plan.' },
  openrouter: { label: 'OpenRouter (:free)', kind: 'auto', tier: 'worker', lens: 'Tarea acotada: resume y ordena los puntos más inciertos del plan.' },
  gemma: { label: 'Gemma local', kind: 'auto', tier: 'worker', lens: 'Tarea simple: lista las ambigüedades, términos sin definir y datos que faltan en el encargo. Sin opinar sobre el diseño.' },
  codex: { label: 'Codex', kind: 'manual', tier: 'decision', lens: 'Viabilidad de implementación, archivos afectados, plan de pruebas y riesgos al integrar. Es quien implementa y verifica.' },
  claude: { label: 'Claude', kind: 'manual', tier: 'decision', lens: 'Diseño de interacción y de interfaz, arquitectura ambigua y revisión difícil con otra perspectiva.' },
  cursor: { label: 'Cursor (Grok, misma cuenta que Grok Bot)', kind: 'manual', tier: 'decision', lens: 'Revisión de código de los archivos nombrados en el encargo y una implementación alternativa acotada.' },
};
export const OPENROUTER_MODEL = 'google/gemma-4-31b-it:free';
export const DECISION_SEATS = Object.keys(SEATS).filter(id => SEATS[id].tier === 'decision');
export const WORKER_SEATS = Object.keys(SEATS).filter(id => SEATS[id].tier === 'worker');
/** Decision makers vote; workers (free models) only support. The initiator never reviews itself. */
export const defaultSeats = (from) => DECISION_SEATS.filter(id => id !== from);
export const DEFAULT_SEATS = defaultSeats();

export function seatPrompt(seat, clean) {
  const s = SEATS[seat];
  const skills = clean.skills.map(k => `- ${k.source}: ${k.guidance}`).join('\n');
  const role = s.tier === 'worker' ? 'Eres un obrero de apoyo (modelo gratuito): tu respuesta se contrasta con la fuente y NO decide nada. Haz solo la tarea que se te pide, sin opinar sobre el diseño. ' : '';
  return `${role}Eres un revisor independiente ("pez dorado") del plan que sigue: no conoces el proyecto más allá de este texto y no tienes archivos, herramientas ni red. No afirmes haber ejecutado nada. Responde en español, directo, máximo 350 palabras.

TU LENTE: ${s.lens}

ENCARGO: ${clean.task}

CONTEXTO (datos sintéticos o públicos):
${clean.context}

CRITERIO DE ENTREGA: ${clean.acceptance}

REGLAS DEL ENCARGO:
${skills}

Formato: (1) lo más grave que ves, (2) por qué, (3) qué cambiarías, (4) qué NO está claro y no puedes juzgar.`;
}

function run(cmd, args, { input, timeoutMs = 180000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], cwd: '/tmp' });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(Object.assign(Error('tiempo agotado'), { code: 'TIMEOUT' })); }, timeoutMs);
    child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { err += d; });
    child.on('error', e => { clearTimeout(timer); reject(Object.assign(Error(e.message), { code: 'UNAVAILABLE' })); });
    child.on('close', code => { clearTimeout(timer); code === 0 && out.trim() ? resolve(out.trim()) : reject(Object.assign(Error(`salida ${code}`), { code: code === 2 ? 'UNAVAILABLE' : 'FAILED', detail: err.slice(0, 200) })); });
    child.stdin.end(input ?? '');
  });
}

/** Real transports. Tests inject their own. */
export const transports = {
  gemini: prompt => run('opinion', [prompt]),
  gemma: prompt => run('localllm', [prompt], { timeoutMs: 240000 }),
  kimi: async prompt => (await askKimi(prompt, { model: 'kimi-code/k3.1-pro' })).answer,
  // Free models only: dsystem ask refuses anything not ':free' with zero prices and sends max_price 0, no fallbacks.
  openrouter: async (prompt, { settings, request }) => (await remoteAsk('openrouter', OPENROUTER_MODEL, { ...request, task: prompt, context: '(ver encargo)', acceptance: 'Sigue el formato pedido.' }, settings, { maxTokens: 1500 })).answer,
  groq: async (prompt, { settings, request }) => (await remoteAsk('groq', 'openai/gpt-oss-120b', { ...request, task: prompt, context: '(ver encargo)', acceptance: 'Sigue el formato pedido.' }, settings, { maxTokens: 1500 })).answer,
};

export async function usable(settings) {
  const st = Object.fromEntries(remoteStatus(settings).map(p => [p.provider, p]));
  return {
    gemini: { ok: true, note: 'vía opinion (cuota Google AI Pro)' },
    gemma: { ok: true, note: 'local (Ollama)' },
    kimi: { ok: true, note: 'plan de pago; máximo 1 llamada a la vez' },
    groq: { ok: Boolean(st.groq?.freeAccountConfirmed), note: st.groq?.freeAccountConfirmed ? 'cuenta gratuita confirmada' : 'sin clave o sin confirmar cuenta gratuita' },
    openrouter: { ok: Boolean(st.openrouter?.freeAccountConfirmed), note: st.openrouter?.freeAccountConfirmed ? `solo modelos :free de precio cero (${OPENROUTER_MODEL})` : 'sin clave o sin activar (dsystem key openrouter; dsystem enable openrouter --free-account-confirmed)' },
    codex: { ok: false, note: 'manual: se prepara el encargo para pegarlo' },
    claude: { ok: false, note: 'manual: se prepara el encargo para pegarlo' },
    cursor: { ok: false, note: 'manual: sin CLI; usa la cuenta de Cursor con Grok (misma facturación que Grok Bot)' },
  };
}

/**
 * Runs the panel. Automatic seats run in parallel except Kimi, which is
 * throttled by its provider and therefore goes alone. Returns one entry per seat.
 */
export async function runPanel(request, { seats = DEFAULT_SEATS, settings, send = transports } = {}) {
  const clean = validateRequest({ ...request, skills: [...(request.skills || []), { source: 'dsystem SF (scripts/dsystem/sf.mjs)', guidance: 'Opinión sobre texto revisado; sin archivos, herramientas ni datos de clientes. El elefante decide.' }] });
  const unknown = seats.filter(s => !SEATS[s]);
  if (unknown.length) throw Object.assign(Error(`Asientos desconocidos: ${unknown.join(', ')}`), { code: 'UNKNOWN_SEAT' });
  const can = await usable(settings);
  const entries = {};
  const one = async seat => {
    const meta = SEATS[seat], prompt = seatPrompt(seat, clean);
    if (meta.kind === 'manual') return (entries[seat] = { seat, status: 'handoff', prompt });
    if (!can[seat]?.ok || !send[seat]) return (entries[seat] = { seat, status: 'skipped', reason: can[seat]?.note || 'sin transporte' });
    const t0 = Date.now();
    try { entries[seat] = { seat, status: 'answered', answer: await send[seat](prompt, { settings, request: { ...clean, dataClass: request.dataClass, reviewedForExternal: true } }), ms: Date.now() - t0 }; }
    catch (e) { entries[seat] = { seat, status: e.code === 'UNAVAILABLE' ? 'unavailable' : 'failed', reason: `${e.code || 'ERROR'}: ${e.message}`, ms: Date.now() - t0 }; }
    return entries[seat];
  };
  const auto = seats.filter(s => SEATS[s].kind === 'auto' && s !== 'kimi'), manual = seats.filter(s => SEATS[s].kind === 'manual');
  await Promise.all([...auto, ...manual].map(one));
  if (seats.includes('kimi')) await one('kimi');
  return seats.map(s => entries[s]);
}

export function renderReport(request, entries) {
  const head = `# Panel SF — ${request.task.slice(0, 120)}\n\nGenerado ${new Date().toISOString()}. Los asientos son opiniones sobre un texto revisado: el elefante (quien inicia) decide y verifica.\n`;
  const section = e => {
    const m = SEATS[e.seat];
    if (e.status === 'answered') return `### ${m.label} — ${m.lens.split(':')[0]}\n\n${e.answer}\n\n_(${Math.round(e.ms / 1000)} s)_`;
    if (e.status === 'handoff') return `### ${m.label} — encargo manual\n\nPegar \`handoffs/${e.seat}.md\` en ${m.label}. Pendiente.`;
    return `### ${m.label} — ${e.status}\n\n${e.reason || ''}`;
  };
  const dec = entries.filter(e => SEATS[e.seat].tier === 'decision'), wrk = entries.filter(e => SEATS[e.seat].tier === 'worker');
  const answered = list => list.filter(e => e.status === 'answered').length;
  return `${head}\n**Decisores: respondieron ${answered(dec)} de ${dec.length}.** Contrasta los puntos donde coincidan dos o más; una objeción de un solo decisor es una hipótesis.\n\n## Decisores\n\n${dec.map(section).join('\n\n') || '_Ninguno._'}\n${wrk.length ? `\n## Obreros (modelos gratuitos: apoyo, no votan; contrastar con la fuente)\n\n${wrk.map(section).join('\n\n')}\n` : ''}`;
}

const slug = s => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'panel';

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { values } = parseArgs({ args: rest, options: { request: { type: 'string' }, seats: { type: 'string' }, workers: { type: 'string' }, from: { type: 'string' }, out: { type: 'string' } } });
  const settings = await loadSettings();
  if (cmd === 'seats') {
    const can = await usable(settings);
    for (const tier of ['decision', 'worker']) { console.log(`\n== ${tier === 'decision' ? 'DECISORES (votan)' : 'OBREROS (modelos gratuitos, apoyo)'}`); for (const [id, m] of Object.entries(SEATS).filter(([, x]) => x.tier === tier)) console.log(`${id.padEnd(11)} ${m.kind.padEnd(7)} ${can[id].ok ? 'listo ' : 'no hay'} ${can[id].note}\n${' '.repeat(12)}${m.lens}`); }
    return;
  }
  if (cmd !== 'panel' || !values.request) { console.log('Uso: dsf panel --request sf-request.json [--from claude|codex] [--workers groq,gemma] [--seats lista] [--out DIR]\n     dsf seats'); process.exitCode = cmd ? 1 : 0; return; }
  const request = JSON.parse(await readFile(path.resolve(values.request), 'utf8'));
  const list = v => v.split(',').map(x => x.trim()).filter(Boolean);
  if (values.from && !['claude', 'codex'].includes(values.from)) throw Object.assign(Error('--from debe ser claude o codex'), { code: 'INVALID_OPTION' });
  const seats = values.seats ? list(values.seats) : [...defaultSeats(values.from), ...(values.workers ? list(values.workers) : [])];
  const entries = await runPanel(request, { seats, settings });
  const dir = path.resolve(values.out || path.join(ROOT, 'artifacts/sf', `${new Date().toISOString().replace(/[:.]/g, '-')}-${slug(request.task)}`));
  await mkdir(path.join(dir, 'handoffs'), { recursive: true });
  await writeFile(path.join(dir, 'report.md'), renderReport(request, entries));
  await writeFile(path.join(dir, 'seats.json'), JSON.stringify(entries.map(({ prompt, ...e }) => e), null, 2) + '\n');
  for (const e of entries) if (e.status === 'handoff') await writeFile(path.join(dir, 'handoffs', `${e.seat}.md`), e.prompt + '\n');
  console.log(JSON.stringify({ dir, seats: entries.map(e => ({ seat: e.seat, status: e.status, ...(e.reason ? { reason: e.reason } : {}) })) }, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(JSON.stringify({ error: e.code || 'LOCAL_ERROR', message: e.message })); process.exitCode = 2; });
