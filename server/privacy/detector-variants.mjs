// Experimental development layer over the frozen v5 rules (v5 itself is untouched, its hashes stay valid).
// It adds recall for surface variants that scanned/OCR'd text produces: identifiers split by single spaces or
// hyphens, O/0 and I/1 swaps, and ALL-CAPS names. Over-detection is the safe direction for egress, so
// precision is deliberately traded away. NOT evaluated on any heldout; tuned on dev only.
import {createLocalPrivacyDetector,DETECTOR_VERSION} from './detector.mjs';
import {validPrivacyRange} from './provenance.mjs';

export const VARIANT_DETECTOR_VERSION = `${DETECTOR_VERSION}+variants-v1`;
const CAPS_STOP = /^(?:ARTÍCULO|ARTICULO|CONSTITUCIÓN|CONSTITUCION|CÓDIGO|CODIGO|LEY|CONTRATO|CLÁUSULA|CLAUSULA|SERVICIOS|PRIMERA|SEGUNDA|TERCERA|CUARTA|QUINTA|ESTADOS|UNIDOS|MEXICANOS|FEDERAL|CIVIL|PENAL|PÚBLICO|PUBLICO|PÚBLICA|PUBLICA|NACIONAL|GENERAL|SUPREMA|CORTE|JUSTICIA|DE|DEL|LA|LAS|LOS|Y|EL|EN|POR|PARA|CON|SIN|AL|TRABAJO|AMPARO|DEMANDA|SENTENCIA|RESOLUCIÓN|RESOLUCION|ANEXO|CAPÍTULO|CAPITULO|TÍTULO|TITULO|SECCIÓN|SECCION|FECHA|TOTAL|MONTO|FOLIO)$/u;

const RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/u, CURP = /^[A-ZÑ&]{4}\d{6}[HM][A-Z]{5}[A-Z\d]{2}$/u;

function words(text) {
 const found = [];
 for (const match of text.matchAll(/[\p{L}\p{N}&]+/gu)) found.push({start:match.index, end:match.index + match[0].length, text:match[0]});
 return found;
}

const SEP = /^[ \-/.]{1,3}$/;
const LETTER_FIX = {0:'O', 1:'I', 5:'S', 8:'B'}, DIGIT_FIX = {O:'0', I:'1', L:'1', S:'5', B:'8'};
// Per-position OCR normalization: letters sit in letter positions, digits in digit positions.
function shape(upper, letters, digitsFrom, digitsTo) {
 const chars = [...upper];
 if (chars.length < digitsTo) return null;
 for (let i = 0; i < letters; i++) chars[i] = LETTER_FIX[chars[i]] ?? chars[i];
 for (let i = digitsFrom; i < digitsTo; i++) chars[i] = DIGIT_FIX[chars[i]] ?? chars[i];
 return chars.join('');
}
const RFC12 = /^[A-ZÑ&]{3}\d{6}[A-Z\d]{3}$/u, RFC13 = /^[A-ZÑ&]{4}\d{6}[A-Z\d]{3}$/u;
const isCurp = upper => upper.length === 18 && CURP.test(shape(upper, 4, 4, 10) ?? '');
const isRfc = upper => upper.length === 13 ? RFC13.test(shape(upper, 4, 4, 10) ?? '') : upper.length === 12 && RFC12.test(shape(upper, 3, 3, 9) ?? '');
const MARKER_LIKE = /\[\[LEX_[a-f0-9]{32}_[a-f0-9]{32}\]\]/g;

function extraScan(text, segmentId) {
 const out = [], add = (start, end, category) => { if (validPrivacyRange(text, start, end)) out.push({segmentId, start, end, category}); };
 const tokens = words(text);
 for (let index = 0; index < tokens.length; index++) {
  // Windows of consecutive UPPERCASE/digit words joined only by short separators, squeezed to an identifier.
  let squeezed = '';
  for (let last = index; last < tokens.length && last < index + 12; last++) {
   if (!/^[A-Z0-9Ñ&]+$/u.test(tokens[last].text)) break;
   if (last > index && !SEP.test(text.slice(tokens[last - 1].end, tokens[last].start))) break;
   squeezed += tokens[last].text;
   if (squeezed.length > 18) break;
   if (squeezed.length < 10 || !/\d/.test(squeezed)) continue;
   const range = [tokens[index].start, tokens[last].end];
   if (/^\d{4}[ \-/.]\d{2}[ \-/.]\d{2}/.test(text.slice(range[0], range[1]))) continue;
   if (isCurp(squeezed)) add(range[0], range[1], 'curp');
   else if (isRfc(squeezed)) add(range[0], range[1], 'rfc');
   else if (/^\d{10,18}$/.test(squeezed)) add(range[0], range[1], squeezed.length === 18 ? 'clabe' : 'account');
   else if ((squeezed.match(/\d/g) ?? []).length >= 4 && /[A-Z]/.test(squeezed)) add(range[0], range[1], 'account');
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
 // Lowercase or mixed-case names after an honorific or title: the title is the evidence.
 for (const match of text.matchAll(/(?<![\p{L}\p{N}])(?:señor(?:a)?|sr\.|sra\.|lic\.|licenciad[oa]|ing\.|ingenier[oa]|dr\.|dra\.|doctor(?:a)?|c\.)\s+(\p{L}{3,}(?:\s+(?:de\s+(?:la\s+|los\s+|las\s+)?|del\s+)?\p{L}{3,}){0,3})/dgiu)) {
  const [start, end] = match.indices[1];
  add(start, end, 'person');
 }
 return out;
}

// Abstain (blocked) where the layer cannot tell whether an identifier is present: a long digit run that no
// detection covers, or an at-sign that is not a well-formed address. Blocked is the safe outcome for egress.
function ambiguity(text, detections) {
 const covered = new Array(text.length).fill(false);
 for (const d of detections) for (let i = d.start; i < d.end; i++) covered[i] = true;
 const clean = text.replace(MARKER_LIKE, found => ' '.repeat(found.length));
 for (const match of clean.matchAll(/\d(?:[ \-./]{0,2}\d){9,}/g)) {
  if (/^\d{4}[ \-/.]\d{2}[ \-/.]\d{2}/.test(match[0]) && match[0].replace(/\D/g, '').length < 12) continue;
  for (let i = match.index; i < match.index + match[0].length; i++) if (!covered[i] && /\d/.test(text[i])) return true;
 }
 for (const match of clean.matchAll(/\S*@\S*/g)) {
  const token = match[0];
  if (token === '@' || /^@[\p{L}\p{N}_]+$/u.test(token)) continue;
  let hit = false;
  for (let i = match.index; i < match.index + token.length; i++) if (covered[i]) hit = true;
  if (!hit) return true;
 }
 return false;
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
   const merged = [...unique.values()].sort((a, b) => a.segmentId.localeCompare(b.segmentId) || a.start - b.start || a.end - b.end);
   if (result.status === 'complete') {
    try {
     for (const segment of input?.segments ?? []) if (typeof segment?.text === 'string' && !segment.structural && ambiguity(segment.text, merged.filter(d => d.segmentId === segment.id)))
      return {status:'blocked', detections:merged, reasonCategory:'ambiguous_context'};
    } catch { return {status:'blocked', detections:merged, reasonCategory:'detector_failure'}; }
   }
   return {...result, detections:merged};
  },
 });
}
