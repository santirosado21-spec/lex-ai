// Development tests for the variants layer. Synthetic strings written for these tests, not from any eval split.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalPrivacyDetector} from '../server/privacy/detector.mjs';
import {createVariantAwareDetector,VARIANT_DETECTOR_VERSION} from '../server/privacy/detector-variants.mjs';
import {createProvenanceRegistry,privacyTextHash} from '../server/privacy/provenance.mjs';

const scope = {workspaceId:'W', matterId:'M', threadId:'T'};
async function run(factory, text) {
 const provenance = createProvenanceRegistry(), detector = factory({provenanceRegistry:provenance});
 const source = provenance.registerSource({objectId:'S', version:'v1', scope, classification:'private',
  extraction:{status:'complete', extractorVersion:'t', originalSha256:privacyTextHash(text)}, segments:[{id:'SEG', path:'content', text}]});
 const result = await detector.detect({scope, segments:source.segments});
 return {result, hits:result.detections.map(d => text.slice(d.start, d.end))};
}
const variants = text => run(createVariantAwareDetector, text), base = text => run(createLocalPrivacyDetector, text);

test('version identity differs from the frozen baseline', () => {
 assert.match(VARIANT_DETECTOR_VERSION, /^local-rules-baseline-v5\+variants/);
});

test('ALL-CAPS personal names are detected, legal headings are not', async () => {
 const {hits} = await variants('Poderdante: JUAN CARLOS PEREZ LOPEZ. CONTRATO DE SERVICIOS. ARTÍCULO 5. LEY FEDERAL DEL TRABAJO.');
 assert.ok(hits.some(h => h.includes('JUAN CARLOS PEREZ')), hits.join('|'));
 assert.ok(!hits.some(h => /CONTRATO|ARTÍCULO|LEY FEDERAL/.test(h)), hits.join('|'));
});

test('identifiers split by spaces or hyphens, and O/0 I/1 swaps, are covered', async () => {
 for (const text of ['RFC ABCD 990101 XY2 vigente', 'RFC ABCD-990101-XY2 vigente', 'RFC ABCD99O1O1XY2 vigente', 'cuenta 1234 5678 9012 3456 abierta', 'expediente AB 123 456 abierto']) {
  const {hits} = await variants(text);
  assert.ok(hits.length > 0, text);
 }
 const {hits} = await variants('RFC ABCD99O1O1XY2 vigente');
 assert.ok(hits.some(h => h.includes('ABCD99O1O1XY2')), hits.join('|'));
});

test('everything the frozen baseline detects is still detected', async () => {
 const text = 'María Pérez, correo persona@demo.invalid, CURP ABCD990101HDFRRN09, expediente EXP-123/2026.';
 const a = await base(text), b = await variants(text);
 for (const d of a.result.detections) assert.ok(b.result.detections.some(x => x.start === d.start && x.end === d.end && x.category === d.category));
});

test('plain prose without identifiers produces no extra detections', async () => {
 const {hits} = await variants('El plazo para contestar la demanda es de nueve días hábiles según la ley aplicable.');
 assert.deepEqual(hits, []);
});

test('base blocked status is preserved, never upgraded to complete', async () => {
 const provenance = createProvenanceRegistry(), detector = createVariantAwareDetector({provenanceRegistry:provenance});
 const text = 'a '.repeat(3600);
 const source = provenance.registerSource({objectId:'S', version:'v1', scope, classification:'private', extraction:{status:'complete', extractorVersion:'t', originalSha256:privacyTextHash(text)}, segments:[{id:'SEG', path:'content', text}]});
 assert.equal((await detector.detect({scope, segments:source.segments})).status, 'blocked');
});
