#!/usr/bin/env node
/**
 * dsystem SF (Software Factory): independent-viewpoint panel.
 *
 *   dsf panel --request sf-request.json [--seats gemini,kimi,groq,gemma] [--out DIR]
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
  gemini: { label: 'Gemini', kind: 'auto', lens: 'Contradice los supuestos del plan: qué está mal planteado, qué riesgo de producto, negocio o seguridad falta, qué alternativa más simple existe.' },
  kimi: { label: 'Kimi', kind: 'auto', lens: 'Lectura larga y alternativas de arquitectura: casos límite, fallos de integración, orden de implementación y una opción distinta a la propuesta.' },
  groq: { label: 'Groq (gpt-oss-120b)', kind: 'auto', lens: 'Casos de prueba y huecos verificables: lista concreta de pruebas que romperían el plan y criterios de aceptación medibles.' },
  openrouter: { label: 'OpenRouter (:free)', kind: 'auto', lens: 'Segunda opinión independiente sobre los puntos más inciertos del plan.' },
  gemma: { label: 'Gemma local', kind: 'auto', tier: 'worker', lens: 'Tarea simple: lista las ambigüedades, términos sin definir y datos que faltan en el encargo. Sin opinar sobre el diseño.' },
  codex: { label: 'Codex', kind: 'manual', lens: 'Viabilidad de implementación, archivos afectados, plan de pruebas y riesgos al integrar. Es quien implementa y verifica.' },
  claude: { label: 'Claude', kind: 'manual', lens: 'Diseño de interacción y de interfaz, arquitectura ambigua y revisión difícil con otra perspectiva.' },
  cursor: { label: 'Cursor (modelo explícito no Claude)', kind: 'manual', lens: 'Revisión de código de los archivos nombrados en el encargo y una implementación alternativa acotada.' },
};
export const DEFAULT_SEATS = ['gemini', 'kimi', 'groq', 'gemma'];

export function seatPrompt(seat, clean) {
  const s = SEATS[seat];
  const skills = clean.skills.map(k => `- ${k.source}: ${k.guidance}`).join('\n');
  return `Eres un revisor independiente ("pez dorado") del plan que sigue: no conoces el proyecto más allá de este texto y no tienes archivos, herramientas ni red. No afirmes haber ejecutado nada. Responde en español, directo, máximo 350 palabras.

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
  groq: async (prompt, { settings, request }) => (await remoteAsk('groq', 'openai/gpt-oss-120b', { ...request, task: prompt, context: '(ver encargo)', acceptance: 'Sigue el formato pedido.' }, settings, { maxTokens: 1500 })).answer,
};

export async function usable(settings) {
  const st = Object.fromEntries(remoteStatus(settings).map(p => [p.provider, p]));
  return {
    gemini: { ok: true, note: 'vía opinion (cuota Google AI Pro)' },
    gemma: { ok: true, note: 'local (Ollama)' },
    kimi: { ok: true, note: 'plan de pago; máximo 1 llamada a la vez' },
    groq: { ok: Boolean(st.groq?.freeAccountConfirmed), note: st.groq?.freeAccountConfirmed ? 'cuenta gratuita confirmada' : 'sin clave o sin confirmar cuenta gratuita' },
    openrouter: { ok: false, note: 'sin clave (dsystem key openrouter) y sin modelo :free elegido' },
    codex: { ok: false, note: 'manual: se prepara el encargo para pegarlo' },
    claude: { ok: false, note: 'manual: se prepara el encargo para pegarlo' },
    cursor: { ok: false, note: 'manual: sin CLI; elegir un modelo explícito que no sea Claude' },
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
  const body = entries.map(e => {
    const m = SEATS[e.seat];
    if (e.status === 'answered') return `## ${m.label} — ${m.lens.split(':')[0]}\n\n${e.answer}\n\n_(${Math.round(e.ms / 1000)} s)_`;
    if (e.status === 'handoff') return `## ${m.label} — encargo manual\n\nPegar \`handoffs/${e.seat}.md\` en ${m.label}. Pendiente.`;
    return `## ${m.label} — ${e.status}\n\n${e.reason || ''}`;
  }).join('\n\n');
  const answered = entries.filter(e => e.status === 'answered').length;
  return `${head}\n**Respondieron ${answered} de ${entries.length}.** Contrasta los puntos donde coincidan dos o más asientos; trata una objeción de un solo asiento como hipótesis.\n\n${body}\n`;
}

const slug = s => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'panel';

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { values } = parseArgs({ args: rest, options: { request: { type: 'string' }, seats: { type: 'string' }, out: { type: 'string' } } });
  const settings = await loadSettings();
  if (cmd === 'seats') {
    const can = await usable(settings);
    for (const [id, m] of Object.entries(SEATS)) console.log(`${id.padEnd(11)} ${m.kind.padEnd(7)} ${can[id].ok ? 'listo ' : 'no hay'} ${can[id].note}\n${' '.repeat(12)}${m.lens}`);
    return;
  }
  if (cmd !== 'panel' || !values.request) { console.log('Uso: dsf panel --request sf-request.json [--seats gemini,kimi,groq,gemma] [--out DIR]\n     dsf seats'); process.exitCode = cmd ? 1 : 0; return; }
  const request = JSON.parse(await readFile(path.resolve(values.request), 'utf8'));
  const seats = values.seats ? values.seats.split(',').map(s => s.trim()).filter(Boolean) : DEFAULT_SEATS;
  const entries = await runPanel(request, { seats, settings });
  const dir = path.resolve(values.out || path.join(ROOT, 'artifacts/sf', `${new Date().toISOString().replace(/[:.]/g, '-')}-${slug(request.task)}`));
  await mkdir(path.join(dir, 'handoffs'), { recursive: true });
  await writeFile(path.join(dir, 'report.md'), renderReport(request, entries));
  await writeFile(path.join(dir, 'seats.json'), JSON.stringify(entries.map(({ prompt, ...e }) => e), null, 2) + '\n');
  for (const e of entries) if (e.status === 'handoff') await writeFile(path.join(dir, 'handoffs', `${e.seat}.md`), e.prompt + '\n');
  console.log(JSON.stringify({ dir, seats: entries.map(e => ({ seat: e.seat, status: e.status, ...(e.reason ? { reason: e.reason } : {}) })) }, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(JSON.stringify({ error: e.code || 'LOCAL_ERROR', message: e.message })); process.exitCode = 2; });
