#!/usr/bin/env node
/**
 * dmem — shared project memory in plain Markdown (free alternative to a hosted
 * memory service). Every agent (Claude, Codex, Gemini, Kimi, Cursor…) reads and
 * writes the same files, so they are versioned with the project and every
 * agent starts up to date.
 *
 *   dmem init                          create docs/agents/{STATE,LOG,DECISIONS}.md and register the project
 *   dmem read                          print STATE.md and the last log entries (run at session start)
 *   dmem log --agent claude --title "…" [--body "…"]    append a dated entry (body also from stdin)
 *   dmem decide --agent codex --title "…" --why "…"      append a decision with its reason
 *   dmem status                        every registered project: last update, who, where
 *
 * Project files live in <project>/docs/agents/. The cross-project index is
 * ~/.agents/memory/PROJECTS.md (override with DMEM_HOME). No secrets, client
 * data or credentials: writes containing key-like strings are refused.
 */
import { mkdir, readFile, writeFile, appendFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { parseArgs } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SECRET = /-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:xai-|hf_|gsk_|sk-or-v1-|sk_live_|sk-ant-)[A-Za-z0-9_-]{12,}|\bsk-[A-Za-z0-9_-]{20,}|\bghp_[A-Za-z0-9]{20,}|\beyJ[A-Za-z0-9_-]{30,}\./;
export const AGENTS = ['claude', 'codex', 'gemini', 'kimi', 'cursor', 'copilot', 'gemma', 'owner', 'other'];
export class MemError extends Error { constructor(code, message) { super(message); this.code = code; } }

export const memHome = (env = process.env) => env.DMEM_HOME || path.join(homedir(), '.agents', 'memory');
const stamp = (d = new Date()) => {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function projectRoot(cwd = process.cwd()) {
  try { return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return path.resolve(cwd); }
}
const dirs = root => ({ dir: path.join(root, 'docs', 'agents'), state: path.join(root, 'docs', 'agents', 'STATE.md'), log: path.join(root, 'docs', 'agents', 'LOG.md'), decisions: path.join(root, 'docs', 'agents', 'DECISIONS.md') });
const exists = f => access(f).then(() => true, () => false);

function clean(text, what) {
  const t = String(text ?? '').trim();
  if (SECRET.test(t)) throw new MemError('SUSPECTED_SECRET', `${what} parece contener una credencial; no se escribió.`);
  if (t.length > 6000) throw new MemError('TOO_LONG', `${what} supera 6.000 caracteres: resume y enlaza al informe.`);
  return t;
}
function agentName(a) {
  const v = String(a || '').toLowerCase().trim();
  if (!v) throw new MemError('AGENT_REQUIRED', 'Indica --agent (claude, codex, gemini, kimi, cursor, copilot, gemma, owner, other).');
  return AGENTS.includes(v) ? v : (() => { throw new MemError('UNKNOWN_AGENT', `Agente desconocido: ${v}. Usa uno de: ${AGENTS.join(', ')}.`); })();
}

const STATE_TEMPLATE = name => `# Estado del proyecto — ${name}

> Memoria compartida entre agentes (Claude, Codex, Gemini, Kimi, Cursor…). Lee esto al empezar; al terminar, actualiza "Ahora" y "Siguiente" y deja una entrada en LOG.md con \`dmem log\`. Reglas del proyecto: AGENTS.md. Sin claves, sin datos de clientes.

**Última actualización:** (sin registrar)

## Objetivo
(una o dos frases)

## Ahora
(qué está hecho y qué está en curso; qué se midió y qué no)

## Siguiente
1. (próximo paso concreto)

## Bloqueos y decisiones pendientes del dueño
- (ninguno)

## Dónde está cada cosa
- (rutas a informes, scripts y comandos de prueba)
`;
const LOG_TEMPLATE = name => `# Bitácora de agentes — ${name}\n\nSolo se añade al final. Formato: \`## fecha — agente — título\` y viñetas con hechos verificados. Usa \`dmem log\`.\n`;
const DECISIONS_TEMPLATE = name => `# Decisiones — ${name}\n\nSolo se añade al final. Cada decisión lleva su motivo para que otro agente no la deshaga sin saber por qué. Usa \`dmem decide\`.\n`;

export async function init(root, { env = process.env } = {}) {
  const f = dirs(root), name = path.basename(root);
  await mkdir(f.dir, { recursive: true });
  const made = [];
  for (const [file, text] of [[f.state, STATE_TEMPLATE(name)], [f.log, LOG_TEMPLATE(name)], [f.decisions, DECISIONS_TEMPLATE(name)]]) {
    if (!(await exists(file))) { await writeFile(file, text); made.push(path.relative(root, file)); }
  }
  await register(root, { env });
  return { root, created: made };
}

export async function log(root, { agent, title, body = '' }, { env = process.env, now = new Date() } = {}) {
  const a = agentName(agent), t = clean(title, 'El título');
  if (!t) throw new MemError('TITLE_REQUIRED', 'Falta --title.');
  const b = clean(body, 'El texto');
  const f = dirs(root);
  if (!(await exists(f.log))) await init(root, { env });
  const entry = `\n## ${stamp(now)} — ${a} — ${t.replace(/\n+/g, ' ')}\n${b ? `\n${b}\n` : ''}`;
  await appendFile(f.log, entry);
  await touchState(root, `${stamp(now)} por ${a}: ${t.replace(/\n+/g, ' ').slice(0, 100)}`);
  await register(root, { env, last: { at: stamp(now), agent: a, title: t.slice(0, 100) } });
  return { file: path.relative(root, f.log) };
}

export async function decide(root, { agent, title, why }, { env = process.env, now = new Date() } = {}) {
  const a = agentName(agent), t = clean(title, 'El título'), w = clean(why, 'El motivo');
  if (!t || !w) throw new MemError('FIELDS_REQUIRED', 'Faltan --title y --why.');
  const f = dirs(root);
  if (!(await exists(f.decisions))) await init(root, { env });
  await appendFile(f.decisions, `\n## ${stamp(now)} — ${a} — ${t.replace(/\n+/g, ' ')}\n\n**Por qué:** ${w}\n`);
  await touchState(root, `${stamp(now)} por ${a}: decisión — ${t.replace(/\n+/g, ' ').slice(0, 90)}`);
  await register(root, { env, last: { at: stamp(now), agent: a, title: `decisión: ${t.slice(0, 90)}` } });
  return { file: path.relative(root, f.decisions) };
}

async function touchState(root, line) {
  const f = dirs(root);
  if (!(await exists(f.state))) return;
  const text = await readFile(f.state, 'utf8');
  const next = /^\*\*Última actualización:\*\*.*$/m.test(text) ? text.replace(/^\*\*Última actualización:\*\*.*$/m, `**Última actualización:** ${line}`) : text;
  if (next !== text) await writeFile(f.state, next);
}

export async function read(root, { entries = 5 } = {}) {
  const f = dirs(root);
  if (!(await exists(f.state))) return `No hay memoria en ${root}. Ejecuta \`dmem init\`.`;
  const state = await readFile(f.state, 'utf8');
  const logText = (await exists(f.log)) ? await readFile(f.log, 'utf8') : '';
  const parts = logText.split(/\n(?=## )/).slice(1).slice(-entries);
  return `${state.trim()}\n\n---\n## Últimas ${parts.length} entradas de la bitácora\n\n${parts.join('\n').trim() || '(vacía)'}\n`;
}

/** Cross-project index: one row per project, newest first. */
export async function register(root, { env = process.env, last } = {}) {
  const home = memHome(env);
  await mkdir(home, { recursive: true });
  const indexFile = path.join(home, 'index.json');
  let index = {};
  try { index = JSON.parse(await readFile(indexFile, 'utf8')); } catch { /* first run */ }
  const prev = index[root] || {};
  index[root] = { name: path.basename(root), root, state: path.join(root, 'docs', 'agents', 'STATE.md'), last: last || prev.last || null, registeredAt: prev.registeredAt || stamp() };
  await writeFile(indexFile, JSON.stringify(index, null, 2) + '\n');
  const rows = Object.values(index).sort((a, b) => (b.last?.at || '').localeCompare(a.last?.at || ''));
  const md = `# Proyectos con memoria compartida\n\nGenerado por \`dmem\`. Cada agente lee primero el STATE.md de su proyecto. No edites a mano.\n\n| Proyecto | Última actualización | Agente | Qué | Estado |\n|---|---|---|---|---|\n${rows.map(r => `| ${r.name} | ${r.last?.at || '—'} | ${r.last?.agent || '—'} | ${(r.last?.title || '—').replace(/\|/g, '/')} | \`${r.state}\` |`).join('\n')}\n`;
  await writeFile(path.join(home, 'PROJECTS.md'), md);
  return rows.length;
}

export async function status(env = process.env) {
  try { return await readFile(path.join(memHome(env), 'PROJECTS.md'), 'utf8'); } catch { return 'Aún no hay proyectos registrados. Ejecuta `dmem init` en uno.\n'; }
}

/** Option values may start with "-" (bullet lists): turn `--body "- x"` into `--body=- x`. */
export function normalizeArgs(argv) {
  const text = new Set(['--body', '--title', '--why', '--agent', '--project', '--entries']);
  const out = [];
  for (let i = 0; i < argv.length; i++) {
    if (text.has(argv[i]) && i + 1 < argv.length) { out.push(`${argv[i]}=${argv[i + 1]}`); i++; } else out.push(argv[i]);
  }
  return out;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { values } = parseArgs({ args: normalizeArgs(rest), options: { agent: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' }, why: { type: 'string' }, project: { type: 'string' }, entries: { type: 'string' } } });
  const root = values.project ? path.resolve(values.project) : projectRoot();
  if (cmd === 'init') console.log(JSON.stringify(await init(root), null, 2));
  else if (cmd === 'read') console.log(await read(root, { entries: values.entries ? Number(values.entries) : 5 }));
  else if (cmd === 'log') {
    let body = values.body ?? '';
    if (!body && !process.stdin.isTTY) body = await new Promise(r => { let s = ''; process.stdin.on('data', d => s += d).on('end', () => r(s)); });
    console.log(JSON.stringify(await log(root, { agent: values.agent, title: values.title, body }), null, 2));
  } else if (cmd === 'decide') console.log(JSON.stringify(await decide(root, values), null, 2));
  else if (cmd === 'status') console.log(await status());
  else console.log('Uso: dmem init | read | log --agent A --title T [--body B] | decide --agent A --title T --why W | status   (--project RUTA)');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(JSON.stringify({ error: e.code || 'LOCAL_ERROR', message: e.message })); process.exitCode = 2; });
