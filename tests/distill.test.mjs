import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import { leaksHeldOut, parseSeeds } from '../scripts/distill/seeds.mjs';
import { askKimi, unfence } from '../scripts/distill/teacher.mjs';
import { teacherPrompt } from '../scripts/distill/generate.mjs';
import { lawPolicy } from '../scripts/distill/laws.mjs';

const held = readFileSync('eval/dialogue/cases.jsonl', 'utf8').trim().split('\n').map(l => JSON.parse(l).turns.join(' '));

test('seeds that copy a held-out dialogue case are detected; unrelated ones pass', () => {
  assert.equal(leaksHeldOut('Dame un dato curioso sobre pulpos, en serio.', held), true);
  assert.equal(leaksHeldOut('¿Cuántos días de vacaciones corresponden al primer año?', held), true);
  assert.equal(leaksHeldOut('¿Qué establece el artículo 83 del Código Penal Federal sobre dolo y culpa?', held), false);
  assert.equal(leaksHeldOut('Mi abuelo tenía un seguro de vida y la aseguradora no paga', held), false);
});

test('seed parsing keeps only well-formed short conversations', () => {
  const items = parseSeeds('```json\n{"items":[{"turns":["Hola"]},{"turns":[]},{"turns":["a","b","c","d"]},{"turns":["¿Qué dice el artículo 5?"]}]}\n```', 'x');
  assert.deepEqual(items.map(i => i.turns), [['Hola'], ['¿Qué dice el artículo 5?']]);
});

test('teacher prompt carries the exact production messages and the right rules', () => {
  const msgs = [{ role: 'system', content: 'SISTEMA-X' }, { role: 'user', content: '{"question":"q","sources":[]}' }];
  const json = teacherPrompt(msgs, { outputSchema: { type: 'object' } });
  assert.match(json, /SISTEMA-X/); assert.match(json, /esquema/); assert.match(json, /no especifica/);
  const chat = teacherPrompt(msgs, {});
  assert.doesNotMatch(chat, /esquema/); assert.match(chat, /desahogarse/);
});

test('teacher runs kimi with the tool-less profile, refuses secrets and parses stream-json', async () => {
  await assert.rejects(askKimi('clave gsk_ABCDEFGHIJKLMNOPQRSTUV'), { code: 'SUSPECTED_SECRET' });
  let seenArgs;
  const spawnImpl = (cmd, args) => {
    seenArgs = [cmd, ...args];
    const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.kill = () => {};
    setImmediate(() => { child.stdout.emit('data', '{"role":"meta","type":"system.version"}\n{"role":"assistant","content":"```json\\n{\\"ok\\":1}\\n```"}\n'); child.emit('close', 0); });
    return child;
  };
  const { answer } = await askKimi('hola', { spawnImpl });
  assert.equal(unfence(answer), '{"ok":1}');
  assert.equal(seenArgs[0], 'kimi'); assert.ok(seenArgs.includes('--agent-file')); assert.match(seenArgs[seenArgs.indexOf('--agent-file') + 1], /kimi-textonly\.md$/);
  assert.match(readFileSync('scripts/distill/kimi-textonly.md', 'utf8'), /^tools: \[\]$/m);
});

test('law policy excludes the ten sealed laws and every non-train split', async t => {
  const file = '/Applications/LEX AI.app/Contents/Resources/app/resources/public-library.sqlite';
  if (!existsSync(file)) return t.skip('installed public library not present');
  const { openPublicLibrary } = await import('../server/public-library.mjs');
  const library = await openPublicLibrary(file);
  try {
    const p = await lawPolicy(library);
    for (const id of ['MX-FED-CPEUM', 'MX-FED-LFT', 'MX-FED-CCF', 'MX-FED-LSS', 'MX-FED-LGTOC', 'MX-FED-LFTSE']) assert.equal(p.isAllowed(id), false, id);
    assert.equal(p.isAllowed('MX-FED-CPF'), true);
    assert.ok(p.allowed.every(l => l.split === 'train'));
  } finally { library.close(); }
});

test('dataset builder drops sealed laws, held-out look-alikes and duplicates; keeps seeds in one split', async () => {
  const { buildDataset } = await import('../scripts/distill/build-dataset.mjs');
  const msg = q => [{ role: 'system', content: 'S' }, { role: 'user', content: q }];
  const ex = [
    { seed: 'a', category: 'articulo', kind: 'json', lawIds: ['MX-FED-CPF'], messages: msg('¿Qué dice el artículo 83 del Código Penal Federal?'), output: '{"paragraphs":[]}' },
    { seed: 'a', category: 'articulo', kind: 'json', lawIds: ['MX-FED-CPF'], messages: msg('¿Qué dice el artículo 83 del Código Penal Federal?'), output: '{"paragraphs":[]}' },
    { seed: 'b', category: 'articulo', kind: 'json', lawIds: ['MX-FED-LFT'], messages: msg('¿Qué dice el artículo 47 de la LFT?'), output: 'x' },
    { seed: 'c', category: 'charla', kind: 'text', lawIds: [], messages: msg('Cuéntame un dato curioso sobre los pulpos, en serio'), output: 'x' },
    { seed: 'd', category: 'charla', kind: 'text', lawIds: [], messages: msg('Hola, ¿cómo va tu tarde?'), output: 'Bien, gracias.' },
  ];
  const ds = buildDataset(ex, { heldOut: held });
  assert.deepEqual(ds.dropped, { duplicate: 1, 'sealed-law': 1, 'held-out-similar': 1 });
  assert.equal(ds.train.length + ds.valid.length, 2);
  for (const r of [...ds.train, ...ds.valid]) assert.equal(r.messages.at(-1).role, 'assistant');
});

test('pipeline planning: what is missing, memory gate, Gemma helper refuses secrets', async () => {
  const { missing, memoryOk, TARGET } = await import('../scripts/distill/pipeline.mjs');
  const { askGemma } = await import('../scripts/distill/teacher.mjs');
  assert.deepEqual(missing({ articulo: 440, situacion: 244 }, { articulo: 440, situacion: 480, charla: 160 }), { situacion: 236, charla: 160 });
  assert.equal(Object.keys(TARGET).length, 6);
  assert.equal(memoryOk(30), true); assert.equal(memoryOk(12), false); assert.equal(memoryOk(NaN), false);
  await assert.rejects(askGemma('clave gsk_ABCDEFGHIJKLMNOPQRSTUV'), { code: 'SUSPECTED_SECRET' });
  const fakeFetch = async (_u, init) => { const b = JSON.parse(init.body); assert.equal(b.format, 'json'); assert.equal(b.think, false); return { ok: true, json: async () => ({ message: { content: ' {"items":[]} ' } }) }; };
  assert.equal((await askGemma('hola', { fetchImpl: fakeFetch })).answer, '{"items":[]}');
  await assert.rejects(askGemma('hola', { fetchImpl: async () => ({ ok: false, status: 500 }) }), { code: 'UNAVAILABLE' });
});
