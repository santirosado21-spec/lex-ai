import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { init, log, decide, read, status, register, normalizeArgs } from '../scripts/dsystem/dmem.mjs';

const fresh = async () => { const base = await mkdtemp(path.join(os.tmpdir(), 'dmem-')); const root = path.join(base, 'proyecto-uno'); const env = { DMEM_HOME: path.join(base, 'home') }; return { base, root, env }; };

test('init creates the three shared files once and registers the project', async () => {
  const { root, env } = await fresh();
  const first = await init(root, { env });
  assert.deepEqual(first.created.sort(), ['docs/agents/DECISIONS.md', 'docs/agents/LOG.md', 'docs/agents/STATE.md']);
  await writeFile(path.join(root, 'docs/agents/STATE.md'), 'EDITADO A MANO\n');
  assert.deepEqual((await init(root, { env })).created, [], 'init never overwrites existing memory');
  assert.equal(await readFile(path.join(root, 'docs/agents/STATE.md'), 'utf8'), 'EDITADO A MANO\n');
  assert.match(await status(env), /proyecto-uno/);
});

test('log appends, stamps STATE and updates the cross-project index', async () => {
  const { root, env } = await fresh();
  await init(root, { env });
  const when = new Date(2026, 10, 4, 22, 55);
  await log(root, { agent: 'claude', title: 'Destilación pausada', body: '- Kimi llegó a su límite de 5 horas.' }, { env, now: when });
  await log(root, { agent: 'codex', title: 'Pruebas verdes' }, { env, now: new Date(2026, 10, 4, 23, 10) });
  const logText = await readFile(path.join(root, 'docs/agents/LOG.md'), 'utf8');
  assert.match(logText, /## 2026-11-04 22:55 — claude — Destilación pausada\n\n- Kimi llegó/);
  assert.ok(logText.indexOf('Destilación pausada') < logText.indexOf('Pruebas verdes'), 'append-only, oldest first');
  assert.match(await readFile(path.join(root, 'docs/agents/STATE.md'), 'utf8'), /\*\*Última actualización:\*\* 2026-11-04 23:10 por codex: Pruebas verdes/);
  const idx = await status(env);
  assert.match(idx, /proyecto-uno \| 2026-11-04 23:10 \| codex \| Pruebas verdes/);
});

test('decisions keep their reason; read returns state plus the latest entries', async () => {
  const { root, env } = await fresh();
  await decide(root, { agent: 'claude', title: 'Groq es obrero', why: 'Es gratis: va en el nivel bajo y no vota.' }, { env });
  assert.match(await readFile(path.join(root, 'docs/agents/DECISIONS.md'), 'utf8'), /Groq es obrero\n\n\*\*Por qué:\*\* Es gratis/);
  for (let i = 1; i <= 7; i++) await log(root, { agent: 'gemini', title: `nota ${i}` }, { env });
  const out = await read(root, { entries: 3 });
  assert.match(out, /Estado del proyecto/); assert.match(out, /nota 7/); assert.match(out, /nota 5/); assert.doesNotMatch(out, /nota 4/);
});

test('refuses key-like strings, unknown agents and oversize text; never writes them', async () => {
  const { root, env } = await fresh();
  await init(root, { env });
  const before = await readFile(path.join(root, 'docs/agents/LOG.md'), 'utf8');
  await assert.rejects(log(root, { agent: 'claude', title: 'x', body: 'clave gsk_ABCDEFGHIJKLMNOPQRSTUV' }, { env }), { code: 'SUSPECTED_SECRET' });
  await assert.rejects(log(root, { agent: 'claude', title: 'ghp_' + 'a'.repeat(30) }, { env }), { code: 'SUSPECTED_SECRET' });
  await assert.rejects(log(root, { agent: 'pepe', title: 'x' }, { env }), { code: 'UNKNOWN_AGENT' });
  await assert.rejects(log(root, { title: 'x' }, { env }), { code: 'AGENT_REQUIRED' });
  await assert.rejects(log(root, { agent: 'claude', title: 'x', body: 'a'.repeat(6001) }, { env }), { code: 'TOO_LONG' });
  assert.equal(await readFile(path.join(root, 'docs/agents/LOG.md'), 'utf8'), before);
});

test('the index lists several projects, newest first', async () => {
  const { base, env } = await fresh();
  const a = path.join(base, 'a'), b = path.join(base, 'b');
  await init(a, { env }); await init(b, { env });
  await log(a, { agent: 'claude', title: 'vieja' }, { env, now: new Date(2026, 0, 1, 9, 0) });
  await log(b, { agent: 'codex', title: 'nueva' }, { env, now: new Date(2026, 5, 1, 9, 0) });
  const idx = await status(env);
  assert.ok(idx.indexOf('| b |') < idx.indexOf('| a |'));
  assert.equal(await register(a, { env }), 2);
});

test('option values that start with a dash (bullet lists) are accepted', () => {
  assert.deepEqual(normalizeArgs(['log', '--agent', 'claude', '--body', '- uno\n- dos', '--title', 'x']), ['log', '--agent=claude', '--body=- uno\n- dos', '--title=x']);
});
