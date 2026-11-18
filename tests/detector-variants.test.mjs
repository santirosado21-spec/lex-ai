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

test('honorific plus lowercase name is detected', async () => {
 const {hits} = await variants('El señor don pedro ramirez soto firmó el contrato.');
 assert.ok(hits.some(h => h.includes('pedro ramirez soto')), hits.join('|'));
});

test('RFC with OCR digit/letter swaps and spaces is covered', async () => {
 const text = 'Su RFC es R0SJ 850 3O1 AB3 y vive aquí.';
 const {result} = await variants(text);
 assert.ok(result.detections.some(d => text.slice(d.start, d.end).startsWith('R0SJ 850 3O1') && d.end - d.start >= 'R0SJ 850 3O1 AB3'.length), 'RFC not fully covered');
});

test('malformed @ makes the detector abstain instead of passing the text', async () => {
 const {result} = await variants('Contacto: foo@@bar.');
 assert.equal(result.status, 'blocked');
});

test('a long digit run is either covered by a detection or blocks the text', async () => {
 const text = 'Folio interno 20260101234567 del expediente.';
 const {result} = await variants(text);
 const covered = result.detections.some(d => d.start <= text.indexOf('2026') && d.end >= text.indexOf('2026') + 14);
 assert.ok(covered || result.status === 'blocked', result.status);
});

test('ordinary legal prose and headings produce no detection and no block', async () => {
 for (const text of ['La parte actora presentó demanda conforme al artículo 123 de la Ley Federal del Trabajo el 5 de mayo de 2020 por 1500000 pesos.',
  'CAPÍTULO PRIMERO DISPOSICIONES GENERALES. El tribunal resolvió con base en jurisprudencia.']) {
  const {result, hits} = await variants(text);
  assert.equal(result.status, 'complete', text);
  assert.deepEqual(hits, [], text);
 }
});
