// Experimental development layer over the frozen v5 rules (v5 itself is untouched, its hashes stay valid).
// It adds recall for surface variants that scanned/OCR'd text produces: identifiers split by single spaces or
// hyphens, O/0 and I/1 swaps, and ALL-CAPS names. Over-detection is the safe direction for egress, so
// precision is deliberately traded away. NOT evaluated on any heldout; tuned on dev only.
import {createLocalPrivacyDetector,DETECTOR_VERSION} from './detector.mjs';
import {validPrivacyRange} from './provenance.mjs';

export const VARIANT_DETECTOR_VERSION = `${DETECTOR_VERSION}+variants-v1`;
const CAPS_STOP = /^(?:ARTÍCULO|ARTICULO|CONSTITUCIÓN|CONSTITUCION|CÓDIGO|CODIGO|LEY|CONTRATO|CLÁUSULA|CLAUSULA|SERVICIOS|PRIMERA|SEGUNDA|TERCERA|CUARTA|QUINTA|ESTADOS|UNIDOS|MEXICANOS|FEDERAL|CIVIL|PENAL|PÚBLICO|PUBLICO|PÚBLICA|PUBLICA|NACIONAL|GENERAL|SUPREMA|CORTE|JUSTICIA|DE|DEL|LA|LAS|LOS|Y|EL|EN|POR|PARA|CON|SIN|AL|TRABAJO|AMPARO|DEMANDA|SENTENCIA|RESOLUCIÓN|RESOLUCION|ANEXO|CAPÍTULO|CAPITULO|TÍTULO|TITULO|SECCIÓN|SECCION|FECHA|TOTAL|MONTO|FOLIO)$/u;
const normalizeId = text => text.replace(/[Oo]/g, '0').replace(/[Il]/g, '1');
const RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/u, CURP = /^[A-ZÑ&]{4}\d{6}[HM][A-Z]{5}[A-Z\d]{2}$/u;

function words(text) {
 const found = [];
 for (const match of text.matchAll(/[\p{L}\p{N}&]+/gu)) found.push({start:match.index, end:match.index + match[0].length, text:match[0]});
 return found;
}

function extraScan(text, segmentId) {
 const out = [], add = (start, end, category) => { if (validPrivacyRange(text, start, end)) out.push({segmentId, start, end, category}); };
 const tokens = words(text);
 for (let index = 0; index < tokens.length; index++) {
  // Windows of consecutive words joined only by one space or hyphen, squeezed to an identifier.
  let squeezed = '';
  for (let last = index; last < tokens.length && last < index + 10; last++) {
   if (last > index && !/^[ -]$/.test(text.slice(tokens[last - 1].end, tokens[last].start))) break;
   squeezed += tokens[last].text;
   if (squeezed.length > 18) break;
   if (squeezed.length < 10 || last === index && !/\d/.test(squeezed)) continue;
   const upper = squeezed.toUpperCase(), range = [tokens[index].start, tokens[last].end];
   // OCR swaps only count where the letters sit in digit positions, so test the normalized form too.
   const shapes = [upper, normalizeId(upper).replace(/[^A-Z\d&Ñ]/gu, c => c)];
   if (shapes.some(s => CURP.test(s) || CURP.test(upper.slice(0, 4) + normalizeId(upper.slice(4, 10)) + upper.slice(10)))) add(range[0], range[1], 'curp');
   else if (shapes.some(s => RFC.test(s)) || RFC.test(upper.slice(0, upper.length > 12 && /^[A-ZÑ&]{4}/u.test(upper) ? 4 : 3) + normalizeId(upper.slice(upper.length > 12 && /^[A-ZÑ&]{4}/u.test(upper) ? 4 : 3, (upper.length > 12 ? 4 : 3) + 6)) + upper.slice((upper.length > 12 ? 4 : 3) + 6))) add(range[0], range[1], 'rfc');
   else if (/^\d{10,18}$/.test(squeezed)) add(range[0], range[1], squeezed.length === 18 ? 'clabe' : 'account');
  }
 }
 // Labelled identifiers keep their spaces: label followed by up to 6 short alphanumeric groups.
 for (const match of text.matchAll(/\b(?:expediente|carpeta|causa|juicio|cuenta|account|tarjeta|rfc|curp|clabe|tel[eé]fono|tel\.?)\s*(?:n[úu]m(?:ero)?\.?\s*)?[:#]?\s*[«"'<(]?((?=[^\n;«»"'<>]*\d)[A-Z\d][A-Z\d./-]{0,11}(?:[ -][A-Z\d./-]{1,12}){0,6})/dgiu)) {
  const [start, end] = match.indices[1];
  add(start, end, /exp|carp|caus|jui/i.test(match[0]) ? 'case_id' : /tel/i.test(match[0]) ? 'phone' : 'account');
 }
 // ALL-CAPS name runs: two to five uppercase words, none a legal-structure word. Over-detects headings by design.
 for (const match of text.matchAll(/(?<![\p{L}\p{N}])((?:[\p{Lu}]{3,}(?:[-'’][\p{Lu}]+)*)(?:\s+(?:(?:DE|DEL|LA|LAS|LOS|Y)\s+)*[\p{Lu}]{2,}(?:[-'’][\p{Lu}]+)*){1,4})(?![\p{L}\p{N}])/dgu)) {
  const [start, end] = match.indices[1], parts = match[1].split(/\s+/);
  if (!parts.some(part => CAPS_STOP.test(part))) add(start, end, 'person');
 }
 return out;
}

export function createVariantAwareDetector({provenanceRegistry} = {}) {
 const base = createLocalPrivacyDetector({provenanceRegistry});
 return Object.freeze({
  version: VARIANT_DETECTOR_VERSION,
  async detect(input) {
   const result = await base.detect(input);
   // Extra scan runs on whatever the base accepted as a well-formed request; failures stay blocked.
   const detections = [...result.detections];
   try { for (const segment of input?.segments ?? []) if (typeof segment?.text === 'string') detections.push(...extraScan(segment.text, segment.id)); } catch { return {status:'blocked', detections, reasonCategory:'detector_failure'}; }
   const unique = new Map(detections.map(item => [`${item.segmentId}:${item.start}:${item.end}:${item.category}`, item]));
   return {...result, detections:[...unique.values()].sort((a, b) => a.segmentId.localeCompare(b.segmentId) || a.start - b.start || a.end - b.end)};
  },
 });
}
