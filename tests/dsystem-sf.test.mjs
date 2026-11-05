import test from 'node:test';
import assert from 'node:assert/strict';
import { runPanel, renderReport, seatPrompt, SEATS, DEFAULT_SEATS, usable } from '../scripts/dsystem/sf.mjs';

const settings = { dir: '/nonexistent', config: { providers: {} }, keys: {}, env: {} };
const request = {
  task: 'Diseñar el filtro de distractores para respuestas con fuentes.',
  context: 'Ejemplo sintético: una consulta recupera tres artículos y solo uno responde.',
  acceptance: 'Lista de riesgos y pruebas.', dataClass: 'synthetic', reviewedForExternal: true,
  skills: [{ source: 'AGENTS.md', guidance: 'Solo texto sintético; sin herramientas.' }],
};

test('panel runs automatic seats, hands off manual ones, skips unusable ones', async () => {
  const calls = [];
  const send = { gemini: async p => { calls.push('gemini'); return 'objeción A'; }, gemma: async () => { calls.push('gemma'); return 'ambigüedades'; }, kimi: async () => { calls.push('kimi'); return 'alternativa'; }, groq: async () => 'x' };
  const out = await runPanel(request, { seats: ['gemini', 'kimi', 'groq', 'gemma', 'codex', 'cursor'], settings, send });
  const by = Object.fromEntries(out.map(e => [e.seat, e]));
  assert.equal(by.gemini.status, 'answered'); assert.equal(by.kimi.status, 'answered'); assert.equal(by.gemma.status, 'answered');
  assert.equal(by.groq.status, 'skipped', 'groq without a confirmed free account is never called');
  assert.equal(by.codex.status, 'handoff'); assert.equal(by.cursor.status, 'handoff');
  assert.equal(calls.at(-1), 'kimi', 'Kimi goes alone, after the parallel seats');
  assert.deepEqual(out.map(e => e.seat), ['gemini', 'kimi', 'groq', 'gemma', 'codex', 'cursor'], 'order follows the request');
});

test('one failing seat never blocks the others, and nothing is retried', async () => {
  let n = 0;
  const send = { gemini: async () => { n++; throw Object.assign(Error('sin cuota'), { code: 'UNAVAILABLE' }); }, gemma: async () => 'ok' };
  const out = await runPanel(request, { seats: ['gemini', 'gemma'], settings, send });
  assert.equal(out[0].status, 'unavailable'); assert.equal(out[1].status, 'answered'); assert.equal(n, 1);
});

test('the gate refuses unreviewed packets, real-looking secrets and unknown seats', async () => {
  const send = { gemini: async () => 'x' };
  await assert.rejects(runPanel({ ...request, reviewedForExternal: false }, { settings, send }), { code: 'CONTEXT_NOT_REVIEWED' });
  await assert.rejects(runPanel({ ...request, dataClass: 'client' }, { settings, send }), { code: 'CONTEXT_NOT_REVIEWED' });
  await assert.rejects(runPanel({ ...request, context: 'clave gsk_ABCDEFGHIJKLMNOPQRSTUV' }, { settings, send }), { code: 'SUSPECTED_SECRET' });
  await assert.rejects(runPanel(request, { seats: ['gemini', 'pepe'], settings, send }), { code: 'UNKNOWN_SEAT' });
});

test('every seat gets its own lens and the same reviewed packet; reports mark dissent as hypothesis', async () => {
  const clean = { ...request, skills: request.skills };
  for (const id of Object.keys(SEATS)) { const p = seatPrompt(id, clean); assert.match(p, new RegExp(SEATS[id].lens.slice(0, 30).replace(/[()]/g, '.'))); assert.match(p, /pez dorado/); assert.match(p, /Ejemplo sintético/); }
  assert.notEqual(seatPrompt('gemini', clean), seatPrompt('groq', clean));
  const out = await runPanel(request, { seats: ['gemma', 'claude'], settings, send: { gemma: async () => 'faltan términos' } });
  const md = renderReport(request, out);
  assert.match(md, /Respondieron 1 de 2/); assert.match(md, /handoffs\/claude\.md/); assert.match(md, /hipótesis/);
  assert.ok(DEFAULT_SEATS.every(s => SEATS[s].kind === 'auto'), 'defaults never wait on a person');
});

test('seat status reports honestly what is usable', async () => {
  const can = await usable(settings);
  assert.equal(can.groq.ok, false); assert.equal(can.openrouter.ok, false); assert.equal(can.codex.ok, false);
  assert.equal(can.gemini.ok, true); assert.equal(can.gemma.ok, true);
});

test('API seats receive a packet that still passes the same review gate', async () => {
  const { credentialFingerprint, validateRequest } = await import('../scripts/dsystem/remote.mjs');
  const token = 'gsk_fake_token_for_tests_only_1234567890';
  const confirmed = { dir: '/x', config: { providers: { groq: { freeAccountConfirmed: true, credentialFingerprint: credentialFingerprint(token) } } }, keys: { groq: token }, env: {} };
  let seen;
  const out = await runPanel(request, { seats: ['groq'], settings: confirmed, send: { groq: async (_p, { request: r }) => { seen = r; validateRequest(r); return 'ok'; } } });
  assert.equal(out[0].status, 'answered'); assert.equal(seen.dataClass, 'synthetic'); assert.equal(seen.reviewedForExternal, true);
});
