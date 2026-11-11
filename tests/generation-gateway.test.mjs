import test from 'node:test';
import assert from 'node:assert/strict';
import {createGenerationGateway} from '../server/generation-gateway.mjs';
import {createMockInference} from '../server/inference-mock.mjs';
import {canonicalJson} from '../server/canonical-json.mjs';

const scope = {workspaceId:'FIRM_A', matterId:'MATTER_A', threadId:'THREAD_A'};
const policy = {version:'v1', grants:[{scope, destination:'mock-remote', allowedCategories:['synthetic']}]};
const messages = [{role:'user', content:'Resume el informe sintético.'}];

function captureProvider(chunks = ['respuesta remota']) {
  const sent = [];
  return {sent, async *generate(msgs, options = {}) {
    sent.push(structuredClone({messages: msgs, options: {...options, signal: undefined}}));
    for (const chunk of chunks) yield chunk;
  }};
}
const classifier = input => ({serialized: input.serialized, scope: input.scope, destination: input.destination,
  policyVersion: input.policyVersion, reliable: true, scopeVerified: true, category: 'synthetic'});

test('default gateway is a pure local passthrough: policy and classifier never run', async () => {
  const local = createMockInference({responses: [['hola ', 'local']]});
  await local.initialize();
  let policyReads = 0, classifications = 0;
  const gateway = createGenerationGateway({local, destinations: {'mock-remote': captureProvider()},
    getPolicy: () => { policyReads++; return policy; }, classify: () => { classifications++; }});
  let out = '';
  for await (const chunk of gateway.generate(messages, {responseFormat: 'text'})) out += chunk;
  assert.equal(out, 'hola local');
  assert.equal(policyReads, 0);
  assert.equal(classifications, 0);
  assert.equal(gateway.outputContract, 'paragraph-citations-v1');
  assert.deepEqual(gateway.routeStatus(), {local: true, remoteEnabled: false, destinations: []});
});

test('lifecycle methods delegate to the local route; partial doubles keep current behavior', async () => {
  const local = createMockInference({responses: ['ok']});
  const gateway = createGenerationGateway({local});
  assert.equal((await gateway.status()).state, 'stopped');
  await gateway.initialize();
  assert.equal((await gateway.status()).state, 'ready');
  await gateway.stop();
  const bare = createGenerationGateway({local: {async *generate() { yield 'x'; }}});
  assert.equal(bare.status, undefined);
  assert.equal(bare.initialize, undefined);
  assert.equal(bare.stop, undefined);
});

test('remoteEnabled without scope/destination still routes local and reads no policy', async () => {
  const local = createMockInference({responses: ['solo local']});
  await local.initialize();
  let policyReads = 0;
  const gateway = createGenerationGateway({local, remoteEnabled: true, destinations: {'mock-remote': captureProvider()},
    getPolicy: () => { policyReads++; return policy; }, classify: classifier});
  let out = '';
  for await (const chunk of gateway.generate(messages, {responseFormat: 'text'})) out += chunk;
  assert.equal(out, 'solo local');
  assert.equal(policyReads, 0);
});

test('scope+destination with the default disabled gateway fails closed and never calls local', async () => {
  const local = createMockInference({responses: ['no debe usarse']});
  await local.initialize();
  const gateway = createGenerationGateway({local});
  await assert.rejects(gateway.generate(messages, {scope, destination: 'mock-remote'}).next(),
    error => error.name === 'GenerationGatewayError' && error.code === 'remote_disabled');
  assert.deepEqual(local.sent, []);
});

test('granted synthetic scope streams the remote chunks through the egress gate with audit', async () => {
  const local = createMockInference({responses: ['no debe usarse']});
  await local.initialize();
  const remote = captureProvider(['remota ', 'verificada']);
  const gateway = createGenerationGateway({local, remoteEnabled: true,
    destinations: {'mock-remote': remote}, getPolicy: () => policy, classify: classifier});
  let out = '';
  for await (const chunk of gateway.generate(messages, {scope, destination: 'mock-remote', responseFormat: 'text'})) out += chunk;
  assert.equal(out, 'remota verificada');
  assert.equal(remote.sent.length, 1);
  assert.deepEqual(remote.sent[0].messages, messages);
  assert.equal(remote.sent[0].options.responseFormat, 'text');
  assert.deepEqual(local.sent, []);
});

test('a scope without grant is denied by the gate and never falls back to local', async () => {
  const local = createMockInference({responses: ['no debe usarse']});
  await local.initialize();
  const remote = captureProvider();
  const gateway = createGenerationGateway({local, remoteEnabled: true,
    destinations: {'mock-remote': remote}, getPolicy: () => policy, classify: classifier});
  const other = {workspaceId:'FIRM_A', matterId:'MATTER_B', threadId:'THREAD_B'};
  await assert.rejects(gateway.generate(messages, {scope: other, destination: 'mock-remote'}).next(),
    error => error.name === 'EgressPolicyError' && error.code === 'scope_denied');
  assert.deepEqual(local.sent, []);
  assert.deepEqual(remote.sent, []);
});

test('remoteEnabled without policy/classifier ports is unavailable, local unaffected', async () => {
  const local = createMockInference({responses: ['local bien']});
  await local.initialize();
  const gateway = createGenerationGateway({local, remoteEnabled: true, destinations: {'mock-remote': captureProvider()}});
  await assert.rejects(gateway.generate(messages, {scope, destination: 'mock-remote'}).next(),
    error => error.name === 'GenerationGatewayError' && error.code === 'remote_unavailable');
  let out = '';
  for await (const chunk of gateway.generate(messages, {responseFormat: 'text'})) out += chunk;
  assert.equal(out, 'local bien');
});

test('remote provider failure propagates without retry or local fallback of the same content', async () => {
  const local = createMockInference({responses: ['no debe usarse']});
  await local.initialize();
  const failing = {async *generate() { yield 'parcial'; throw Object.assign(new Error('caído'), {name: 'Boom'}); }};
  const gateway = createGenerationGateway({local, remoteEnabled: true,
    destinations: {'mock-remote': failing}, getPolicy: () => policy, classify: classifier});
  const seen = [];
  await assert.rejects(async () => { for await (const chunk of gateway.generate(messages, {scope, destination: 'mock-remote'})) seen.push(chunk); },
    error => error.name === 'EgressPolicyError');
  assert.deepEqual(seen, ['parcial']);
  assert.deepEqual(local.sent, []);
});

test('invalid scope or destination on a remote request is rejected before any provider runs', async () => {
  const local = createMockInference({responses: ['no debe usarse']});
  await local.initialize();
  const gateway = createGenerationGateway({local, remoteEnabled: true,
    destinations: {'mock-remote': captureProvider()}, getPolicy: () => policy, classify: classifier});
  await assert.rejects(gateway.generate(messages, {scope: {workspaceId:'X'}, destination: 'mock-remote'}).next(),
    error => error.name === 'GenerationGatewayError' && error.code === 'invalid_request');
  await assert.rejects(gateway.generate(messages, {scope, destination: '../otro'}).next(),
    error => error.name === 'GenerationGatewayError' && error.code === 'invalid_request');
  assert.deepEqual(local.sent, []);
});

test('canonical envelope classification sees exactly what the gate dispatches', async () => {
  const local = createMockInference({responses: []});
  await local.initialize();
  const remote = captureProvider(['ok']);
  const seen = [];
  const gateway = createGenerationGateway({local, remoteEnabled: true,
    destinations: {'mock-remote': remote}, getPolicy: () => policy,
    classify: input => { seen.push(input.serialized); return classifier(input); }});
  for await (const chunk of gateway.generate(messages, {scope, destination: 'mock-remote', responseFormat: 'text'})) void chunk;
  assert.equal(seen.length, 1);
  assert.equal(seen[0], canonicalJson({version: 1, messages, responseFormat: 'text'}));
});
