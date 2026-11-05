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
