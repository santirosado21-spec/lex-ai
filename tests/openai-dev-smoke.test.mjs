import test from 'node:test';
import assert from 'node:assert/strict';
import {MODEL, smokeRequest, summarize} from '../scripts/openai-dev/smoke.mjs';

test('el chequeo usa modelo exacto, texto inventado, sin herramientas ni almacenamiento', () => {
  const body = smokeRequest();
  assert.equal(body.model, MODEL);
  assert.equal(body.store, false);
  assert.equal(body.tools, undefined);
  assert.ok(body.max_output_tokens <= 64);
  assert.equal(body.reasoning.effort, 'none');
  assert.match(body.input, /inventado/);
});

test('el recibo usa usage observado y una estimación conservadora', () => {
  const receipt = summarize({id: 'resp_synthetic123', model: MODEL, status: 'completed', usage: {input_tokens: 100, output_tokens: 20, total_tokens: 120}, output: [{type: 'reasoning'}, {type: 'message', content: [{type: 'output_text', text: 'LISTO'}]}]});
  assert.equal(receipt.estimatedUsdUpperBound, 0.00002);
  assert.equal(receipt.usage.totalTokens, 120);
  assert.equal(receipt.responseId, 'resp_synthetic123');
});

test('rechaza modelo distinto, salida de herramienta y usage ausente', () => {
  const base = {id: 'resp_synthetic123', model: MODEL, status: 'completed', usage: {input_tokens: 100, output_tokens: 20, total_tokens: 120}, output: [{type: 'message', content: [{type: 'output_text', text: 'LISTO'}]}]};
  assert.throws(() => summarize({...base, model: 'otro'}));
  assert.throws(() => summarize({...base, output: [{type: 'web_search_call'}]}));
  assert.throws(() => summarize({...base, usage: {}}));
  assert.throws(() => summarize({...base, id: undefined}));
  assert.throws(() => summarize({...base, usage: {input_tokens: -1, output_tokens: 20, total_tokens: 19}}));
  assert.throws(() => summarize({...base, usage: {input_tokens: 100, output_tokens: 20, total_tokens: 119}}));
});
