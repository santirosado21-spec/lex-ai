import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, chmod, readFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PROVIDERS, ask, handoff, status, models, validateRequest, loadSettings, readPrivateJson, assertModel, credentialFingerprint } from '../scripts/dsystem/remote.mjs';

const request = {
  task: 'Revisar el aislamiento entre chats ficticios.', context: 'A conoce a Ana; B está vacío.',
  acceptance: 'Tres casos propuestos; no afirmar ejecución.', dataClass: 'synthetic', reviewedForExternal: true,
  skills: [{ source: 'dsystem', guidance: 'Solo crítica; Codex verifica; sin herramientas.' }],
};
const settings = () => ({ config: { providers: Object.fromEntries(Object.keys(PROVIDERS).map(p => [p, { freeAccountConfirmed: true, credentialFingerprint: credentialFingerprint(`test-token-${p}`) }])) }, keys: Object.fromEntries(Object.keys(PROVIDERS).map(p => [p, `test-token-${p}`])), env: {} });
const ids = { grok: 'grok-explicit-test', groq: 'vendor/reviewer', openrouter: 'vendor/reviewer:free', huggingface: 'vendor/reviewer:testprovider', mistral: 'reviewer-2026' };
function mockProvider(name, overrides = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    assert.equal(options.redirect, 'error');
    if (url.endsWith('/models')) return Response.json({ data: [{ id: name === 'huggingface' ? 'vendor/reviewer' : ids[name], pricing: { prompt: '0', completion: '0' }, providers: [{ provider: 'testprovider', status: 'live' }], ...overrides.catalog }] });
    if (overrides.status) return new Response('private body test-token-groq', { status: overrides.status });
    return Response.json({ model: ids[name], choices: [{ message: { content: 'Propuesta de prueba; no ejecutada.', ...overrides.message }, finish_reason: overrides.finish || 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 12, total_tokens: 22, private: 'omit' }, ...overrides.result });
  };
  return { calls, fetchImpl };
}

test('all five providers expose setup state without printing credentials or making requests', () => {
  const s = settings();
  const out = status(s);
  assert.equal(out.length, 5);
  assert.ok(out.filter(p => p.provider !== 'grok').every(p => p.inference === 'configured_not_verified'));
  assert.equal(out.find(p => p.provider === 'grok').inference, 'blocked_billing_not_authorized');
  assert.equal(out.find(p => p.provider === 'grok').freeAccountConfirmed, false);
  assert.ok(!JSON.stringify(out).includes('test-token'));
  assert.ok(status({ config: { providers: {} }, keys: {}, env: {} }).every(p => p.inference === 'blocked_setup_required'));
});

for (const name of Object.keys(PROVIDERS).filter(p => !PROVIDERS[p].inferenceBlocked)) {
  test(`${name}: synthetic request reaches only the fixed API with bounded text and records actual response`, async () => {
    const mock = mockProvider(name);
    const out = await ask(name, ids[name], request, settings(), mock);
    assert.equal(mock.calls.length, 2);
    assert.equal(mock.calls[1].url, `${PROVIDERS[name].base}/chat/completions`);
    const body = JSON.parse(mock.calls[1].options.body);
    assert.equal(body.model, ids[name]);
    assert.equal(body.max_tokens, 800);
    assert.equal(body.stream, false);
    assert.equal(body.tools, undefined);
    assert.equal(body.messages.length, 1);
    assert.match(body.messages[0].content, /Codex coordina/);
    assert.equal(out.observedModel, ids[name]);
    assert.equal(out.usage.total_tokens, 22);
    assert.equal(out.usage.private, undefined);
    assert.equal(out.reviewRequired, true);
    if (name === 'openrouter') assert.deepEqual(body.provider, { allow_fallbacks: false, max_price: { prompt: 0, completion: 0 } });
  });
  test(`${name}: missing key, unverified account and dry-run never contact the provider`, async () => {
    const mock = mockProvider(name);
    await assert.rejects(ask(name, ids[name], request, { config: { providers: {} }, keys: {}, env: {} }, mock), { code: 'MISSING_CREDENTIAL' });
    const s = settings(); s.config.providers[name].freeAccountConfirmed = false;
    await assert.rejects(ask(name, ids[name], request, s, mock), { code: 'FREE_ACCOUNT_NOT_CONFIRMED' });
    const dry = await ask(name, ids[name], request, s, { ...mock, dryRun: true });
    assert.equal(dry.sent, false);
    assert.equal(mock.calls.length, 0);
    const hand = handoff(name, request);
    assert.equal(hand.sent, false);
    assert.equal(hand.webUrl, PROVIDERS[name].web);
  });
}

test('Grok catalogs use xAI, while generation remains blocked even with a free-account attestation', async () => {
  const mock = mockProvider('grok');
  assert.notEqual(PROVIDERS.grok.base, PROVIDERS.groq.base);
  assert.equal(PROVIDERS.grok.env, 'XAI_API_KEY');
  assert.deepEqual(await models('grok', settings(), mock.fetchImpl), [{ id: ids.grok }]);
  assert.equal(mock.calls.length, 1);
  assert.equal(mock.calls[0].url, 'https://api.x.ai/v1/models');
  assert.equal(mock.calls[0].options.method, 'GET');
  await assert.rejects(ask('grok', ids.grok, request, settings(), mock), { code: 'BILLING_NOT_AUTHORIZED' });
  assert.equal(mock.calls.length, 1);
  const dry = await ask('grok', ids.grok, request, settings(), { ...mock, dryRun: true });
  assert.equal(dry.sent, false);
  assert.equal(handoff('grok', request).sent, false);
  assert.equal(mock.calls.length, 1);
});

test('review gates reject unreviewed material and common secrets before any network access', async () => {
  const mock = mockProvider('groq');
  for (const delta of [{ reviewedForExternal: false }, { dataClass: 'private' }, { skills: [] }, { context: 'x'.repeat(16001) }, { context: 'hf_ABCDEFGHIJKLMNOP12345' }, { context: 'xai-ABCDEFGHIJKLMNOP12345' }]) {
    await assert.rejects(ask('groq', ids.groq, { ...request, ...delta }, settings(), mock));
  }
  assert.equal(mock.calls.length, 0);
  assert.throws(() => validateRequest({ ...request, skills: [{ source: 'dsystem' }] }));
});

test('switching credentials invalidates the account attestation before any network call', async () => {
  const mock = mockProvider('groq');
  const s = settings(); s.env.GROQ_API_KEY = 'test-token-other-account';
  assert.equal(status(s).find(p => p.provider === 'groq').freeAccountConfirmed, false);
  await assert.rejects(ask('groq', ids.groq, request, s, mock), { code: 'FREE_ACCOUNT_NOT_CONFIRMED' });
  assert.equal(mock.calls.length, 0);
});

test('Claude and auto-router IDs cannot be selected or smuggled through catalog', async () => {
  for (const id of ['anthropic/claude:free', 'claude-opus', 'openrouter/auto', 'openrouter/free', 'org/model:cheapest', 'https://evil.invalid/model?x=1', '']) assert.throws(() => assertModel(id));
  const mock = mockProvider('openrouter', { catalog: { id: 'anthropic/claude:free' } });
  assert.deepEqual(await models('openrouter', settings(), mock.fetchImpl), []);
});

test('paid or unknown OpenRouter prices and absent HF routes block inference without fallback', async () => {
  for (const pricing of [{ prompt: '0.001', completion: '0' }, { prompt: '0', completion: '0', request: '0.2' }, {}, { prompt: null, completion: '0' }]) {
    const mock = mockProvider('openrouter', { catalog: { pricing } });
    await assert.rejects(ask('openrouter', ids.openrouter, request, settings(), mock), { code: 'MODEL_UNAVAILABLE' });
    assert.equal(mock.calls.length, 1);
  }
  const mock = mockProvider('openrouter');
  await assert.rejects(ask('openrouter', 'vendor/paid-model', request, settings(), mock), { code: 'PAID_MODEL_BLOCKED' });
  assert.equal(mock.calls.length, 0);
  await assert.rejects(ask('huggingface', 'vendor/reviewer', request, settings(), mock), { code: 'EXPLICIT_ROUTE_REQUIRED' });
  const hf = mockProvider('huggingface', { catalog: { providers: [] } });
  await assert.rejects(ask('huggingface', ids.huggingface, request, settings(), hf), { code: 'MODEL_UNAVAILABLE' });
  assert.equal(hf.calls.length, 1);
});

test('quota, auth and payment failures do not retry, leak the remote body or switch provider', async () => {
  for (const [http, code] of [[429, 'QUOTA_OR_RATE_LIMIT'], [401, 'AUTH_OR_ACCESS_REQUIRED'], [402, 'FREE_ACCESS_EXHAUSTED'], [500, 'PROVIDER_ERROR']]) {
    const mock = mockProvider('groq', { status: http });
    await assert.rejects(ask('groq', ids.groq, request, settings(), mock), error => error.code === code && !error.message.includes('test-token'));
    assert.equal(mock.calls.length, 2);
  }
});

test('network errors redact diagnostics and stop after one attempt', async () => {
  let count = 0;
  await assert.rejects(ask('groq', ids.groq, request, settings(), { fetchImpl: async () => { count++; throw new Error('Authorization: test-token-groq'); } }), error => error.code === 'NETWORK_UNAVAILABLE' && !error.message.includes('test-token'));
  assert.equal(count, 1);
});

test('tool requests, truncated answers, empty replies and forbidden observed models are not accepted', async () => {
  for (const overrides of [{ message: { tool_calls: [{ id: 'run-shell' }] } }, { finish: 'length' }, { message: { content: '' } }, { result: { model: 'anthropic/claude' } }]) {
    const mock = mockProvider('groq', overrides);
    await assert.rejects(ask('groq', ids.groq, request, settings(), mock));
    assert.equal(mock.calls.length, 2);
  }
  const mock = mockProvider('groq', { message: { content: 'echo test-token-groq' } });
  const out = await ask('groq', ids.groq, request, settings(), mock);
  assert.equal(out.answer, 'echo [REDACTED]');
});

test('private config rejects permissive permissions, symlinks and malformed JSON', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsystem-test-'));
  try {
    const path = join(dir, 'credentials.json');
    await writeFile(path, '{"groq":"test-token"}', { mode: 0o600 });
    assert.equal((await readPrivateJson(path, {})).groq, 'test-token');
    const link = join(dir, 'link.json'); await symlink(path, link);
    await assert.rejects(readPrivateJson(link, {}), { code: 'PRIVATE_FILE_PERMISSIONS' });
    await chmod(path, 0o644);
    await assert.rejects(readPrivateJson(path, {}), { code: 'PRIVATE_FILE_PERMISSIONS' });
    await chmod(path, 0o600); await writeFile(path, '{bad');
    await assert.rejects(readPrivateJson(path, {}), { code: 'INVALID_CONFIG' });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('CLI initializes a private inactive configuration and runs without any provider account', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsystem-cli-'));
  try {
    const env = { ...process.env, DSYSTEM_CONFIG_DIR: dir };
    for (const p of Object.values(PROVIDERS)) delete env[p.env];
    const run = args => spawnSync(process.execPath, ['scripts/dsystem/remote.mjs', ...args], { env, encoding: 'utf8' });
    assert.equal(run(['init']).status, 0);
    assert.deepEqual(JSON.parse(await readFile(join(dir, 'credentials.json'), 'utf8')), {});
    const s = await loadSettings(env);
    assert.ok(status(s).every(p => p.inference === 'blocked_setup_required'));
    const res = run(['ask', 'groq', '--model', ids.groq, '--request', 'docs/orchestration/remote-request.example.json', '--dry-run']);
    assert.equal(res.status, 0, res.stderr);
    assert.equal(JSON.parse(res.stdout).sent, false);
    const missing = run(['ask', 'groq', '--model', ids.groq, '--request', 'docs/orchestration/remote-request.example.json']);
    assert.equal(missing.status, 2);
    assert.equal(JSON.parse(missing.stderr).error, 'MISSING_CREDENTIAL');
    assert.equal(run(['enable', 'groq']).status, 2);
    assert.equal(run(['enable', 'groq', '--free-account-confirmed']).status, 2);
    await writeFile(join(dir, 'credentials.json'), JSON.stringify({ groq: 'test-token-groq' }), { mode: 0o600 });
    assert.equal(run(['enable', 'groq', '--free-account-confirmed']).status, 0);
    assert.equal(run(['disable', 'groq']).status, 0);
    await writeFile(join(dir, 'credentials.json'), JSON.stringify({ grok: 'test-token-grok' }), { mode: 0o600 });
    const blocked = run(['enable', 'grok', '--free-account-confirmed']);
    assert.equal(blocked.status, 2);
    assert.equal(JSON.parse(blocked.stderr).error, 'BILLING_NOT_AUTHORIZED');
    assert.equal(run(['disable', 'grok']).status, 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
