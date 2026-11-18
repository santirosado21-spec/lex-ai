// Synthetic checks with a FAKE backend. They prove composition logic and fail-closed behavior only,
// not the quality of any real model: no weights, no runtime, no eval split is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createModelAdditiveDetector, MODEL_ADDITIVE_VERSION} from '../server/privacy/detector-model-additive.mjs';
import {createProvenanceRegistry, privacyTextHash} from '../server/privacy/provenance.mjs';

const scope = {workspaceId:'W', matterId:'M', threadId:'T'};
async function run(backend, text, {timeoutMs, signal} = {}) {
 const provenance = createProvenanceRegistry(), detector = createModelAdditiveDetector({provenanceRegistry:provenance, backend, timeoutMs});
 const source = provenance.registerSource({objectId:'S', version:'v1', scope, classification:'private',
  extraction:{status:'complete', extractorVersion:'t', originalSha256:privacyTextHash(text)}, segments:[{id:'SEG', path:'content', text}]});
 return detector.detect({scope, segments:source.segments, signal});
}
const reply = (texts, spans) => ({status:'complete', reasonCategory:null, scannedSegments:texts.map(t => t.id), detections:spans.map(([start, end, kind]) => ({segmentId:texts[0].id, start, end, kind, score:0.9}))});
const fake = spans => ({detect:async ({segments}) => reply(segments, spans)});
const TEXT = 'El quejoso Zoilo Vargas acudió ayer. Contacto: zoilo@correo.example';

test('model spans are ADDED to rule spans, never replacing them', async () => {
 const start = TEXT.indexOf('Zoilo'), result = await run(fake([[start, start + 5, 'GIVEN_NAME']]), TEXT);
 assert.equal(result.status, 'complete');
 assert.ok(result.detections.some(d => TEXT.slice(d.start, d.end) === 'Zoilo' && d.category === 'person'));
 assert.ok(result.detections.some(d => TEXT.slice(d.start, d.end).includes('zoilo@correo.example')), 'rule email span must remain');
});

test('an empty model answer cannot remove a rule detection', async () => {
 const result = await run(fake([]), TEXT);
 assert.ok(result.detections.some(d => d.category === 'email'));
});

test('backend error, blocked answer, invalid contract and unmapped uncovered kind all block', async () => {
 const bad = [{detect:async () => { throw new Error('x'); }}, {detect:async () => ({status:'blocked', reasonCategory:'detector_failure', detections:[]})},
  {detect:async () => ({status:'complete', reasonCategory:null, scannedSegments:['WRONG'], detections:[]})},
  fake([[0, 2, 'CITY']])];
 for (const backend of bad) assert.equal((await run(backend, TEXT)).status, 'blocked');
});

test('timeout and abort fail closed, and a late answer is ignored', async () => {
 const slow = {detect:(input, {signal}) => new Promise(resolve => setTimeout(() => resolve(reply(input.segments, [])), 200))};
 assert.equal((await run(slow, TEXT, {timeoutMs:20})).status, 'blocked');
 const controller = new AbortController(); setTimeout(() => controller.abort(), 10);
 assert.equal((await run(slow, TEXT, {signal:controller.signal})).status, 'blocked');
 const aborted = new AbortController(); aborted.abort();
 assert.equal((await run(fake([]), TEXT, {signal:aborted.signal})).status, 'blocked');
});

test('rule-level blocks short-circuit before the backend is called', async () => {
 let called = false;
 const result = await run({detect:async input => { called = true; return reply(input.segments, []); }}, 'Contacto: foo@@bar.');
 assert.equal(result.status, 'blocked'); assert.equal(called, false);
});

test('the backend receives only ids and text, and the version differs from rules-only', async () => {
 let seen;
 await run({detect:async input => { seen = input; return reply(input.segments, []); }}, 'Texto ordinario sin datos.');
 assert.deepEqual(Object.keys(seen), ['segments']); assert.deepEqual(Object.keys(seen.segments[0]).sort(), ['id', 'text']);
 assert.match(MODEL_ADDITIVE_VERSION, /additive/);
});
