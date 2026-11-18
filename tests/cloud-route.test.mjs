// Offline tests: the "network" is a fake fetch that records every outbound byte. No real OpenAI call, no real data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createOpenAiProvider} from '../server/providers/openai.mjs';
import {createCloudGrants, createPseudonymizedCloudRoute} from '../server/cloud-route.mjs';
import {createLocalPrivacyDetector} from '../server/privacy/detector.mjs';
import {createPseudonymStore} from '../server/privacy/pseudonyms.mjs';
import {verifyDetectorEligibility,CORE_SOURCES} from '../server/privacy/eligibility.mjs';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,readFileSync,appendFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import path from 'node:path';

const scope = {workspaceId:'FIRM_A', matterId:'MATTER_A', threadId:'THREAD_A'};
const KEY = 'sk-test-' + 'x'.repeat(30);
const name = 'María Pérez', email = 'persona@demo.invalid';
const text = `Revisar el contrato de ${name}, correo ${email}, plazo de 30 días.`;
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const REPO = new URL('..', import.meta.url).pathname;

// TEST-ONLY fixture: a temp tree holding real copies of the detector sources, the real protocol, and a SYNTHETIC
// manifest/heldout stand-in. The real heldout is never opened. The record below is hand-built to exercise the
// verifier's binding logic; nothing like it exists in the product.
function fixtureRoot(extra = []) {
 const root = mkdtempSync(path.join(tmpdir(), 'elig-'));
 mkdirSync(path.join(root, 'eval/privacy-v2'), {recursive:true});
 for (const file of [...CORE_SOURCES, ...extra, 'eval/privacy-v2/protocol.json']) { mkdirSync(path.dirname(path.join(root, file)), {recursive:true}); copyFileSync(path.join(REPO, file), path.join(root, file)); }
 writeFileSync(path.join(root, 'eval/privacy-v2/heldout-standin.jsonl'), 'synthetic stand-in\n');
 writeFileSync(path.join(root, 'eval/privacy-v2/manifest.json'), JSON.stringify({version:2, protocol:{file:'protocol.json', sha256:sha(path.join(root, 'eval/privacy-v2/protocol.json'))},
  splits:{heldout:{file:'heldout-standin.jsonl', sha256:sha(path.join(root, 'eval/privacy-v2/heldout-standin.jsonl'))}}}));
 return root;
}
function fixtureRecord(root, version, extra = [], change = {}) {
 const sourceHashes = Object.fromEntries([...CORE_SOURCES, ...extra].map(file => [file, sha(path.join(root, file))]));
 const record = {score:{version:2, split:'heldout', candidateId:version, correctBlockReason:{numerator:48, denominator:48, rate:1}, protocolSha256:sha(path.join(root, 'eval/privacy-v2/protocol.json')),
   corpusSha256:sha(path.join(root, 'eval/privacy-v2/heldout-standin.jsonl')), experimentalGate:{status:'eligible-for-integration-evaluation', failures:[], minimumFailures:[], minimumsApplied:true}},
  execution:{candidateVersion:version, sourceHashes}};
 return change.record ? change.record(record) : record;
}
const VERSION = createLocalPrivacyDetector({provenanceRegistry:{resolve(){}}}).version;

function setup({maxCalls = 5, reply, finish = 'stop', key = KEY, grant = true, eligible = true, status = 200, pseudonyms = createPseudonymStore(), tamper} = {}) {
 const sent = [];
 const root = fixtureRoot();
 const record = fixtureRecord(root, VERSION);
 tamper?.(root, record);
 const fetchImpl = async (url, init) => {
  const body = JSON.parse(init.body);
  sent.push({url, init, body, raw:init.body});
  const content = reply ? reply(body) : body.messages.at(-1).content;
  return new Response(JSON.stringify({model:'test-model', choices:[{finish_reason:finish, message:{content}}], usage:{prompt_tokens:10, completion_tokens:5}}), {status});
 };
 const provider = createOpenAiProvider({enabled:true, getApiKey:async () => key, model:'test-model', fetchImpl, maxCalls});
 const grants = createCloudGrants();
 if (grant) grants.grant(scope, 'openai');
 const route = createPseudonymizedCloudRoute({pseudonyms, provider, grants, evaluation:eligible ? {root, record} : null});
 const ask = async (options = {}) => { const out = []; for await (const chunk of route.ask({scope, messages:[{role:'user', content:text}], ...options})) out.push(chunk); return out; };
 return {sent, route, grants, provider, pseudonyms, ask, root, record};
}

test('identifiers never leave: outbound bytes carry markers only, the answer is restored locally', async () => {
 const h = setup();
 const [answer] = await h.ask();
 assert.equal(answer, text);
 assert.equal(h.sent.length, 1);
 const raw = h.sent[0].raw;
 for (const secret of [name, email, 'FIRM_A', 'MATTER_A', 'THREAD_A', KEY]) assert.ok(!raw.includes(secret), secret);
 assert.match(raw, /\[\[LEX_/);
 assert.ok(raw.includes('30 días'));
 assert.equal(h.sent[0].body.store, false);
 assert.equal(h.sent[0].body.tools, undefined);
 assert.equal(h.sent[0].url, 'https://api.openai.com/v1/chat/completions');
 assert.equal(h.sent[0].init.headers.Authorization, `Bearer ${KEY}`);
 assert.equal(h.route.audit.at(-1).result, 'completed');
 assert.equal(h.route.audit.at(-1).category, 'pseudonymized');
});

test('fail closed before any network call: budget 0, no grant, no attestation, bad key', async () => {
 for (const [options, code] of [[{maxCalls:0}, 'provider_failed'], [{grant:false}, 'cloud_not_granted'], [{eligible:false}, 'detector_not_validated'], [{key:'not-a-key'}, 'provider_failed']]) {
  const h = setup(options);
  await assert.rejects(h.ask(), {code});
  assert.equal(h.sent.length, 0, JSON.stringify(options));
 }
});

test('a grant for one thread does not cover another thread or matter', async () => {
 const h = setup();
 for (const other of [{...scope, threadId:'THREAD_B'}, {...scope, matterId:'MATTER_B'}, {...scope, workspaceId:'FIRM_B'}]) {
  await assert.rejects((async () => { for await (const _ of h.route.ask({scope:other, messages:[{role:'user', content:text}]})); })(), {code:'cloud_not_granted'});
 }
 assert.equal(h.sent.length, 0);
});

test('detector blocked or a residual identifier after protection stops the send', async () => {
 // Over the 7000-unit detector limit the detector blocks: nothing is sent.
 const big = setup();
 await assert.rejects(big.ask({messages:[{role:'user', content:'a '.repeat(3600)}]}), {code:'blocked_detector_failure'});
 assert.equal(big.sent.length, 0);
 // A protection step that leaves the identifier in place is caught by the final scan of the outbound bytes.
 const leaky = setup({pseudonyms:{protect:({messages}) => ({messages, mappingVersion:'a'.repeat(32)}), exportSnapshot:() => ({entries:[]}), restore:({text}) => text}});
 await assert.rejects(leaky.ask(), {code:'classification_denied'});
 assert.equal(leaky.sent.length, 0);
});

test('eligibility record must bind to the running detector, protocol, thresholds and corpus; any change fails closed', async () => {
 const cases = {
  protocol_changed:(root) => appendFileSync(path.join(root, 'eval/privacy-v2/protocol.json'), ' '),
  detector_changed:(root) => appendFileSync(path.join(root, 'server/privacy/detector.mjs'), '\n// edited'),
  corpus_changed:(root) => appendFileSync(path.join(root, 'eval/privacy-v2/heldout-standin.jsonl'), 'x'),
  candidate_mismatch:(root, record) => { record.score.candidateId = 'other-detector'; },
  gate_not_passed:(root, record) => { record.score.experimentalGate.status = 'failed'; },
  record_retired:(root, record) => { record.retiredForFutureTuning = true; },
  record_not_v2:(root, record) => { record.score.version = 1; },
  block_reason_rate:(root, record) => { record.score.correctBlockReason.rate = 0.9; },
  gates_weakened:(root) => { const file = path.join(root, 'eval/privacy-v2/protocol.json'); const p = JSON.parse(readFileSync(file, 'utf8')); p.experimentalGates.mandatoryExactRecall = 0.5; writeFileSync(file, JSON.stringify(p)); },
  sources_not_recorded:(root, record) => { delete record.execution.sourceHashes['server/canonical-json.mjs']; },
 };
 for (const [reason, tamper] of Object.entries(cases)) {
  const root = fixtureRoot(), record = fixtureRecord(root, VERSION);
  assert.equal(verifyDetectorEligibility({root, detectorVersion:VERSION, record}).eligible, true);
  tamper(root, record);
  assert.deepEqual(verifyDetectorEligibility({root, detectorVersion:VERSION, record}).reason, reason, reason);
  const h = setup({tamper});
  await assert.rejects(h.ask(), {code:'detector_not_validated'});
  assert.equal(h.sent.length, 0, reason);
 }
});

test('the shipped rules-baseline heldout record is not eligible and the route stays closed', async () => {
 const record = JSON.parse(readFileSync(path.join(REPO, 'docs/qa/privacy-detector-heldout-2026-11-09.json'), 'utf8'));
 const result = verifyDetectorEligibility({root:REPO, detectorVersion:VERSION, record});
 assert.equal(result.eligible, false);
 const h = setup({eligible:false});
 assert.equal(h.route.status().cloud, false);
 assert.throws(() => createPseudonymizedCloudRoute({detector:'caller-supplied', pseudonyms:createPseudonymStore(), provider:h.provider, grants:h.grants}), {code:'invalid_configuration'});
});

test('provider reserves budget and busy before any await: concurrent calls cannot exceed the cap', async () => {
 let release; const gate = new Promise(resolve => { release = resolve; });
 const sent = [];
 const provider = createOpenAiProvider({enabled:true, getApiKey:async () => { await gate; return KEY; }, model:'test-model', maxCalls:1,
  fetchImpl:async (url, init) => { sent.push(init.body); return new Response(JSON.stringify({model:'test-model', choices:[{finish_reason:'stop', message:{content:'ok'}}]})); }});
 const run = async () => { const out = []; for await (const chunk of provider.generate([{role:'user', content:'hola'}], {responseFormat:'text'})) out.push(chunk); return out; };
 const results = [run(), run(), run()].map(promise => promise.then(() => 'ok', error => error.code));
 await new Promise(resolve => setTimeout(resolve, 20));
 release();
 const settled = await Promise.all(results);
 assert.equal(sent.length, 1);
 assert.deepEqual(settled.filter(code => code === 'ok').length, 1);
 assert.ok(settled.every(code => ['ok', 'busy', 'budget_exhausted'].includes(code)), settled.join());
});

test('a call that never dispatched (bad key, abort during key read) gives its reservation back', async () => {
 const sent = [];
 const keys = [Promise.reject(new Error('keychain locked')), KEY];
 const controller = new AbortController();
 const provider = createOpenAiProvider({enabled:true, getApiKey:() => keys.shift() ?? KEY, model:'test-model', maxCalls:1,
  fetchImpl:async (url, init) => { sent.push(init.body); return new Response(JSON.stringify({model:'test-model', choices:[{finish_reason:'stop', message:{content:'ok'}}]})); }});
 const run = async options => { for await (const _ of provider.generate([{role:'user', content:'hola'}], {responseFormat:'text', ...options})); };
 await assert.rejects(run(), {code:'missing_credential'});
 assert.equal(provider.status().callsRemaining, 1);
 controller.abort();
 await assert.rejects(run({signal:controller.signal}), {code:'cancelled'});
 assert.equal(provider.status().callsRemaining, 1);
 await run();
 assert.equal(sent.length, 1);
 assert.equal(provider.status().callsRemaining, 0);
});

test('token cap reserves prompt estimate plus the full output allowance before dispatch', async () => {
 const sent = [];
 const provider = createOpenAiProvider({enabled:true, getApiKey:async () => KEY, model:'test-model', maxCalls:10, maxOutputTokens:512, maxTotalTokens:600,
  fetchImpl:async (url, init) => { sent.push(init.body); return new Response(JSON.stringify({model:'test-model', choices:[{finish_reason:'stop', message:{content:'ok'}}]})); }});
 await assert.rejects((async () => { for await (const _ of provider.generate([{role:'user', content:'x'.repeat(400)}], {responseFormat:'text'})); })(), {code:'budget_exhausted'});
 assert.equal(sent.length, 0);
});

test('revoking the grant during the call suppresses the answer', async () => {
 const h = setup({reply:body => { h.grants.revoke(scope, 'openai'); return body.messages.at(-1).content; }});
 await assert.rejects(h.ask());
 assert.equal(h.route.audit.at(-1).result, 'policy_changed');
});

test('a fabricated or foreign marker in the answer is rejected, never shown', async () => {
 const fake = `[[LEX_${'a'.repeat(32)}_${'b'.repeat(32)}]]`;
 const h = setup({reply:() => `Resultado para ${fake}`});
 await assert.rejects(h.ask(), {code:'unknown_marker'});
 assert.equal(h.sent.length, 1);
 const h2 = setup();
 await h2.ask();
 const foreign = h2.pseudonyms.exportSnapshot({scope}).entries[0].marker;
 const other = {...scope, matterId:'MATTER_B'};
 h2.grants.grant(other, 'openai');
 const h3 = setup({reply:() => `Ref ${foreign}`});
 h3.grants.grant(other, 'openai');
 await assert.rejects((async () => { for await (const _ of h3.route.ask({scope:other, messages:[{role:'user', content:text}]})); })());
});

test('a literal reserved marker in the input is refused before sending', async () => {
 const h = setup();
 await assert.rejects(h.ask({messages:[{role:'user', content:`Texto [[LEX_${'a'.repeat(32)}_${'b'.repeat(32)}]] de ${name}`}]}));
 assert.equal(h.sent.length, 0);
});

test('truncated model output is an explicit error, not a complete answer', async () => {
 const h = setup({finish:'length'});
 await assert.rejects(h.ask(), {code:'provider_failed'});
 assert.equal(h.provider.lastReceipt.requestedModel, 'test-model');
});

test('owner call cap counts dispatched calls and then blocks without touching the network', async () => {
 const h = setup({maxCalls:1});
 await h.ask();
 await assert.rejects(h.ask());
 assert.equal(h.sent.length, 1);
 assert.equal(h.provider.status().callsRemaining, 0);
});

test('quota, auth and server errors map to fixed codes without provider text', async () => {
 for (const status of [401, 429, 500]) {
  const h = setup({status});
  await assert.rejects(h.ask(), error => { assert.doesNotMatch(error.message, /sk-|María/); return true; });
 }
});

test('status exposes grants and cap without secrets', async () => {
 const h = setup();
 const status = h.route.status();
 assert.equal(status.cloud, true);
 assert.equal(status.detectorValidated, true);
 assert.deepEqual(status.grants[0].allowedCategories, ['pseudonymized']);
 assert.ok(!JSON.stringify(status).includes(KEY));
});

test('fixed-tariff USD estimate caps worst-case spend before dispatch and sends reasoning_effort when configured', async () => {
 const sent = [];
 const make = maxUsd => createOpenAiProvider({enabled:true, getApiKey:async () => KEY, model:'test-model', maxCalls:10, maxOutputTokens:512, reasoningEffort:'none',
  pricing:{inputPerMillion:0.1, outputPerMillion:0.5}, maxUsd,
  fetchImpl:async (url, init) => { sent.push(JSON.parse(init.body)); return new Response(JSON.stringify({model:'test-model', choices:[{finish_reason:'stop', message:{content:'ok'}}], usage:{prompt_tokens:20, completion_tokens:3}})); }});
 const run = async provider => { for await (const _ of provider.generate([{role:'user', content:'hola'}], {responseFormat:'text'})); };
 const tight = make(0.0001);
 await assert.rejects(run(tight), {code:'budget_exhausted'});
 assert.equal(sent.length, 0);
 const roomy = make(0.01);
 await run(roomy);
 assert.equal(sent[0].reasoning_effort, 'none');
 const status = roomy.status();
 assert.equal(status.usdIsEstimate, true);
 assert.ok(status.estimatedSpentUsd > 0 && status.estimatedSpentUsd < 0.00001, String(status.estimatedSpentUsd));
 assert.throws(() => createOpenAiProvider({enabled:true, getApiKey:async () => KEY, model:'m', maxUsd:1}), {code:'invalid_configuration'});
});

test('missing or partial usage keeps the conservative reservation charged, so the aggregate cap cannot be exceeded', async () => {
 for (const usage of [undefined, {prompt_tokens:5}]) {
  const sent = [];
  const provider = createOpenAiProvider({enabled:true, getApiKey:async () => KEY, model:'test-model', maxCalls:10, maxOutputTokens:100, maxTotalTokens:400,
   pricing:{inputPerMillion:1, outputPerMillion:1}, maxUsd:1,
   fetchImpl:async (url, init) => { sent.push(init.body); return new Response(JSON.stringify({model:'test-model', choices:[{finish_reason:'stop', message:{content:'ok'}}], ...(usage ? {usage} : {})})); }});
  const run = async () => { for await (const _ of provider.generate([{role:'user', content:'x'.repeat(100)}], {responseFormat:'text'})); };
  let ok = 0, blocked = 0;
  for (let i = 0; i < 6; i++) { try { await run(); ok++; } catch (error) { assert.equal(error.code, 'budget_exhausted'); blocked++; } }
  assert.ok(ok <= 2 && blocked >= 4, `${ok}/${blocked} ${JSON.stringify(usage)}`);
  assert.equal(sent.length, ok);
 }
});
