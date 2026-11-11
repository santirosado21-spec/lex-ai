// Experimental opt-in rules baseline. Complete means the bounded scan finished,
// NOT anonymous, authorized for egress, legally validated, or gate-eligible.
// No learned model, downloads, network, tools, persistence or production wiring.
import {canonicalJson} from '../canonical-json.mjs';
import {validPrivacyScope,validPrivacyRange} from './provenance.mjs';

export const DETECTOR_VERSION = 'local-rules-baseline-v2';
export const DETECTION_CATEGORIES = Object.freeze(['person','organization','rfc','curp','clabe','account','email','phone','address','case_id','context','sensitive_relation']);
const reasons = ['scope_mismatch','unknown_provenance','unsupported_format','partial_extraction','ambiguous_context','detector_failure'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const blocked = (reasonCategory,detections=[]) => ({status:'blocked',detections,reasonCategory});
const intersects = (a,b) => a.start < b.end && b.start < a.end;

// All regexes run on the original UTF-16 text. No case/Unicode normalization or
// transformed-string offsets. These are syntactic hypotheses, not checksum checks.
function scan(text,segmentId) {
 const found=[];
 const add=(start,end,category)=>{if(validPrivacyRange(text,start,end))found.push({segmentId,start,end,category});};
 const matches=(regex,category,group=0,predicate=()=>true)=>{
  for(const match of text.matchAll(regex)) {
   const [start,end]=match.indices[group] ?? [];
   if(predicate(match,{start,end}))add(start,end,category);
  }
 };
 matches(/(?<![\p{L}\p{N}])[A-ZÑ&]{4}[ -]?\d{6}[ -]?[HM][A-Z]{5}[A-Z\d]{2}(?![\p{L}\p{N}])/dgu,'curp');
 matches(/(?<![\p{L}\p{N}])[A-ZÑ&]{3,4}[ -]?\d{6}[ -]?[A-Z\d]{3}(?![\p{L}\p{N}])/dgu,'rfc');
 matches(/(?<!\d)\d(?:[ -]?\d){17}(?!\d)/dgu,'clabe',0,match=>!/^\d{4}-\d{2}-\d{2}/.test(match[0]));
 matches(/\b(?:cuenta|account|tarjeta)(?:\s+(?:bancaria|sintética|ficticia|número|numero))?\s*(?:n[úu]m(?:ero)?\.?\s*)?[:#]?\s*[«"'<(]?((?:[A-Z][A-Z\d/-]{2,48}\d[A-Z\d/-]*|\d(?:[ -]?\d){3,25}))/dgiu,'account',1,(match,range)=>/\d/.test(match[1]) && !found.some(item=>item.category==='clabe'&&intersects(item,range)));
 matches(/(?<![\p{L}\p{N}._%+\-])[\p{L}\p{N}._%+\-]+@[\p{L}\p{N}](?:[\p{L}\p{N}\-]*\.)+[\p{L}]{2,}(?![\p{L}\p{N}\-])/dgu,'email');
 matches(/(?<![\p{L}\p{N}])(?:\+\d{1,3}[ .-]?)?(?:\(\d{2,4}\)[ .-]?)?\d(?:[ .-]?\d){5,13}(?:\s*(?:ext\.?|extensión|extension|x)\s*\d{1,6})?(?![\p{L}\p{N}])/dgiu,'phone',0,(match,range)=>{
  const digits=match[0].replace(/\D/g,'').length;
  return digits>=10 && digits<=21 && !found.some(item=>['clabe','account','curp','rfc'].includes(item.category)&&intersects(item,range)) && !/^\d{4}[.-]\d{2}[.-]\d{2}/.test(match[0]);
 });
 matches(/\b(?:expediente|carpeta(?:\s+de\s+investigación)?|causa|juicio)(?:\s+(?:n[úu]mero|n[úu]m\.?|no\.?))?\s*[:#]?\s*[«"'<]?([A-Z\d][A-Z\d._/-]*\d[A-Z\d._/-]*)(?![\p{L}\p{N}])/dgiu,'case_id',1);
 matches(/(?<![\p{L}\p{N}])(?:EXP|CARPETA|CAUSA|NUC)[-./][A-Z\d][A-Z\d._/-]*(?![\p{L}\p{N}])/dgu,'case_id');
 matches(/\b((?:Calle|Avenida|Av\.|Calzada|Boulevard|Bulevar|Privada|Carretera)\s+[\p{L}\p{M}\d .#º°/-]*\d[\p{L}\p{M}\d ,.#º°/-]*)(?=[\n;«»"<>]|$)/dgu,'address',1);
 matches(/\b(?:domicilio|dirección)\s*:\s*[«"']?([^\n;«»"'<>]+)/dgiu,'address',1);
 // Organization prefixes and printed legal designators; generic roles alone do not match.
 matches(/\b((?:Cooperativa|Laboratorio|Corporativo|Comercializadora|Asociación|Fundación|Empresa|Universidad|Banco)\s+[\p{Lu}][\p{L}\p{M}'’\-]*(?:\s+(?:[\p{Lu}][\p{L}\p{M}'’\-]*|de|del|la|las|los|y)){1,8}(?:,?\s+S\.?\s*A\.?(?:\s+de\s+C\.?\s*V\.?)?)?)/dgu,'organization',1);
 matches(/(?<![\p{L}\p{N}])([\p{Lu}][\p{L}\p{M}'’\-]*(?:\s+(?:[\p{Lu}][\p{L}\p{M}'’\-]*|de|del|la|las|los|y)){0,8},?\s+(?:S\.A\.(?:\s+de\s+C\.V\.)?|S\.\s*de\s*R\.L\.(?:\s+de\s+C\.V\.)?|A\.C\.))/dgu,'organization',1);
 const roleWords=/^(?:Artículo|Constitución|Código|Ley|Suprema|Diario|Calle|Avenida|Colonia|Ciudad|Estado|Tribunal|Poder|Derechos|Buenas|Muchas|Lorem|Documento|Reporte|Informe|Consulta|Resumen|Datos|Sin|Solo|Fecha|Total|Monto|El|La|Los|Las|Un|Una|En|No|Por|Para|Se|Si|Cuando|Con)\b/u;
 matches(/(?<![\p{L}\p{N}])([\p{Lu}][\p{Ll}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*(?:\s+(?:(?:de|del|la|las|los|y)\s+)*[\p{Lu}][\p{Ll}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*){1,5})(?![\p{L}\p{N}])/dgu,'person',1,(match,range)=>!roleWords.test(match[1])&&!found.some(item=>['organization','address'].includes(item.category)&&intersects(item,range)));
 matches(/(?:^|[.!?;\n]\s*|:\s*[«"']?)([^.!?;\n«»"<>:]*(?:es\s+(?:hij[oa]|cónyuge|pareja|víctima|victima|paciente|testigo protegido)|padece\s+|vive\s+con\s+VIH|tiene\s+(?:VIH|cáncer)|está\s+embarazada|esta\s+embarazada)[^.!?;\n«»"<>]*)/dgiu,'sensitive_relation',1);
 matches(/(?:^|[.!?;\n]\s*|:\s*[«"']?|«\s*)([^.!?;\n«»"<>]*\b(?:la única persona|el único|la única|únic[oa]\s+(?:testigo|paciente|emplead[oa]|habitante))\b[^.!?;\n«»"<>]*)/dgiu,'context',1);
 const unique=new Map();
 for(const item of found) {
  // Regex clause captures can include label-adjacent blanks. Preserve every internal
  // code unit while dropping only the external whitespace specified by annotation v1.
  let {start,end}=item;
  while(start<end&&/\s/u.test(text[start]))start++;
  while(end>start&&/\s/u.test(text[end-1]))end--;
  if(!validPrivacyRange(text,start,end))continue;
  const detection={...item,start,end};
  unique.set(`${start}:${end}:${item.category}`,detection);
 }
 return [...unique.values()].sort((a,b)=>a.start-b.start||a.end-b.end||a.category.localeCompare(b.category));
}

/** Input is exactly {scope,segments,signal?}; handles must come from the trusted
 * provenance registry. Detector failures/limits/cancellation are fixed-code blocked
 * results, with no raw source text in errors. All surfaces are equally scanned.
 * Detection overlaps are retained; downstream H3 adapters must union only overlapping
 * ranges for literal protection and reject sensitive structural keys.
 * Envelope completeness is the trusted builder's responsibility. Use
 * segmentsFromEnvelope for final JSON: it includes history/schema/tool values AND keys.
 */
export function createLocalPrivacyDetector({provenanceRegistry}={}) {
 if(typeof provenanceRegistry?.resolve!=='function')throw new TypeError('Se requiere un registro local de procedencia.');
 const resolve=provenanceRegistry.resolve.bind(provenanceRegistry);
 return Object.freeze({
  version:DETECTOR_VERSION,
  async detect(input) {
   let request,signal;
   try {
    if(!object(input)||Object.getOwnPropertySymbols(input).length||Object.keys(input).some(key=>!['scope','segments','signal'].includes(key)))return blocked('detector_failure');
    const json={};
    for(const name of Object.keys(input)) {
     const descriptor=Object.getOwnPropertyDescriptor(input,name);
     if(!descriptor||!Object.hasOwn(descriptor,'value'))return blocked('detector_failure');
     if(name==='signal')signal=descriptor.value;else json[name]=descriptor.value;
    }
    if(signal!==undefined&&!(signal instanceof AbortSignal))return blocked('detector_failure');
    request=JSON.parse(canonicalJson(json));
   } catch {return blocked('detector_failure');}
   await Promise.resolve();
   if(signal?.aborted)return blocked('detector_failure');
   if(!validPrivacyScope(request.scope))return blocked('scope_mismatch');
   if(!Array.isArray(request.segments)||!request.segments.length||request.segments.length>256)return blocked('detector_failure');
   const ids=new Set();let units=0;
   const detections=[];let reason=null;
   for(const segment of request.segments) {
    if(signal?.aborted)return blocked('detector_failure',detections);
    if(!object(segment)||typeof segment.id!=='string'||ids.has(segment.id)||typeof segment.text!=='string'||typeof segment.path!=='string')return blocked('detector_failure',detections);
    ids.add(segment.id);units+=segment.text.length+segment.path.length;
    if(units>7000)return blocked('detector_failure',detections);
    try {
     const provenance=resolve({scope:request.scope,segment});
     const failure=provenance.extractionStatus==='unsupported'?'unsupported_format':provenance.extractionStatus==='partial'?'partial_extraction':
      provenance.extractionStatus==='failed'||provenance.assessment==='failed'?'detector_failure':provenance.assessment==='ambiguous'?'ambiguous_context':null;
     reason ??= failure;
     // Numeric metadata can encode identifiers with lost zeroes/precision. A
     // large/long numeric lexeme is unresolved, even if no string rule matches.
     if(segment.scalarType==='number' && (Math.abs(Number(segment.text))>=1e9 || segment.text.replace(/\D/g,'').length>=10))reason ??= 'ambiguous_context';
     const local=scan(segment.text,segment.id);
     detections.push(...local);
     if((segment.structural&&local.length)||scan(segment.path,segment.id).length)reason ??= 'ambiguous_context';
    } catch(error) {reason ??= error?.name==='PrivacyProvenanceError'&&reasons.includes(error.code)?error.code:'detector_failure';}
   }
   if(signal?.aborted)return blocked('detector_failure',detections);
   return reason?blocked(reason,detections):{status:'complete',detections,reasonCategory:null};
  },
 });
}
