import {validateModelOutput} from './skills.mjs';
const KINDS=['observacion','inferencia','pendiente','borrador'];
const normalize=text=>text.normalize('NFC').replace(/\s+/g,' ').trim();
function citeableEvidence(evidence){
 if(!Array.isArray(evidence)||evidence.length>20)throw Error('Evidencia fuera del presupuesto.');
 const seen=new Set();
 return evidence.flatMap(source=>{
  if(!source||typeof source.id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(source.id)||seen.has(source.id)||typeof source.text!=='string')throw Error('Identidad de evidencia inválida.');
  seen.add(source.id);
  const quotes=[...new Set((Array.isArray(source.allowedQuotes)?source.allowedQuotes:[]).filter(q=>typeof q==='string'&&q.length>=40&&q.length<=1600&&!/[\u0000-\u001f]/.test(q)&&normalize(source.text).includes(normalize(q))))];
  return quotes.length?[{source,quotes}]:[];
 });
}
export function buildGroundedSchema(evidence){
 const sources=citeableEvidence(evidence);if(!sources.length)throw Error('No hay citas aprobadas suficientes para generar.');
 return {type:'object',additionalProperties:false,required:['paragraphs'],properties:{paragraphs:{type:'array',minItems:Math.min(2,sources.length),maxItems:3,items:{anyOf:sources.map(({source,quotes})=>({type:'object',additionalProperties:false,required:['sourceId','quote','text'],properties:{sourceId:{type:'string',const:source.id},quote:{type:'string',enum:quotes},text:{type:'string',minLength:40,maxLength:350},kind:{type:'string',enum:[...KINDS]}}}))}}}};
}
const numberWords=new Set('cero uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciséis dieciseis diecisiete dieciocho diecinueve veinte veintiuno veintidós veintidos veintitrés veintitres veinticuatro veinticinco veintiséis veintiseis veintisiete veintiocho veintinueve treinta cuarenta cincuenta sesenta setenta ochenta noventa cien ciento doscientos trescientos cuatrocientos quinientos seiscientos setecientos ochocientos novecientos mil millón millon millones primero segundo tercero cuarto quinto sexto séptimo septimo octavo noveno décimo decimo enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre'.split(' '));
// "veinte" in the law and "20" in the explanation are the same claim.
const CARDINALS=Object.entries({cero:0,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,once:11,doce:12,trece:13,catorce:14,quince:15,'dieciséis':16,dieciseis:16,diecisiete:17,dieciocho:18,diecinueve:19,veinte:20,veintiuno:21,'veintidós':22,veintidos:22,'veintitrés':23,veintitres:23,veinticuatro:24,veinticinco:25,'veintiséis':26,veintiseis:26,veintisiete:27,veintiocho:28,veintinueve:29,treinta:30,cuarenta:40,cincuenta:50,sesenta:60,setenta:70,ochenta:80,noventa:90,cien:100});
const CARDINAL_RE=new RegExp(`(?<![\\p{L}])(?:${CARDINALS.map(([w])=>w).sort((a,b)=>b.length-a.length).join('|')})(?![\\p{L}])`,'gu');
const CARDINAL_MAP=new Map(CARDINALS);
export function numericClaims(text){
 const value=normalize(text).toLocaleLowerCase('es').replace(CARDINAL_RE,word=>String(CARDINAL_MAP.get(word)));
 const claims=[...(value.match(/\p{N}+(?:[.,:/-]\p{N}+)*(?:\s*%)?/gu)||[])];
 for(const token of value.match(/[\p{L}]+/gu)||[])if(numberWords.has(token))claims.push(token);
 // Article identifiers are checked as a full phrase too (including Roman numerals/suffixes).
 for(const match of value.matchAll(/\bart[ií]culos?\s+(?:[ivxlcdm]+\b|\d+)(?:\s+(?:bis|ter|qu[aá]ter))?/gu))claims.push(match[0]);
 // A complete written date must occur, not just its independently scattered numbers.
 for(const match of value.matchAll(/\b(?:\d{1,2}|primero)\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de(?:l)?\s+\d{2,4})?/gu))claims.push(match[0]);
 return claims;
}
function isObject(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
// A paragraph whose wording is not backed by its own quote. Callers may drop
// that paragraph; an unknown source or quote is a different, fatal error.
function unsupported(message){const error=Error(message);error.code='UNSUPPORTED_PARAGRAPH';return error;}
export function validateGroundedOutput(raw,evidence){
 if(typeof raw!=='string'||raw.length>16000)throw Error('Salida vinculada fuera del presupuesto.');
 let output;try{output=JSON.parse(raw);}catch{throw Error('JSON vinculado inválido; no se reparó la respuesta.');}
 if(!isObject(output)||Object.keys(output).length!==1||!Array.isArray(output.paragraphs))throw Error('Se requiere exclusivamente paragraphs; contrato anterior no admitido.');
 const sources=citeableEvidence(evidence);if(!sources.length)throw Error('No hay citas aprobadas suficientes para generar.');
 const minSources=Math.min(2,sources.length),allowed=new Map(sources.map(s=>[s.source.id,s]));
 if(output.paragraphs.length<minSources||output.paragraphs.length>3)throw Error('Cantidad de párrafos fuera del esquema.');
 const used=new Set(),paragraphs=[];
 for(const p of output.paragraphs){
  if(!isObject(p)||Object.keys(p).some(k=>!['sourceId','quote','text','kind'].includes(k))||!['sourceId','quote','text'].every(k=>typeof p[k]==='string')||p.kind!==undefined&&!KINDS.includes(p.kind))throw Error('Párrafo fuera del esquema.');
  const entry=allowed.get(p.sourceId);
  if(!entry||!entry.quotes.includes(p.quote))throw Error('Fuente o cita no aprobada para este párrafo.');
  // Control characters are a format integrity failure; a paragraph that is too
  // short/long or carries an inline [ID] is only unusable, so callers may drop it.
  if(/[\u0000-\u001f]/.test(p.text))throw Error('Texto con caracteres de controles no admitidos.');
  if(p.text.length<40||p.text.length>350||/[\[\]]/.test(p.text))throw unsupported('Texto fuera de límites o con corchetes.');
  // Naming the cited article itself ("el artículo 47") is backed by the
  // source's own metadata, not an invented reference.
  // For public law, numbers may come from the cited article passage shown to
  // the model (stored with the citation), not only from the quoted sentence.
  // Private documents (D*) stay strict: the number must be in the quote.
  const privateDocument=/^D\d+$/.test(entry.source.id);
  const quoteClaims=new Set([...numericClaims(p.quote),...(privateDocument?[]:numericClaims(entry.source.text))]);
  // Naming the cited article itself ("el artículo 47") is backed by the source's own
  // metadata, but only that exact phrase: its bare digit must not back an invented
  // quantity ("dentro de 47 días"). Remove the phrase, then check what is left.
  const own=!privateDocument&&entry.source.article?String(entry.source.article).replace(/^art[ií]culo\s+/i,'').trim():'';
  const checked=own?p.text.replace(new RegExp(`\\bart[ií]culos?\\s+${own.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?![\\p{L}\\p{N}])`,'giu'),' '):p.text;
  if(numericClaims(checked).some(claim=>!quoteClaims.has(claim)))throw unsupported('Número, artículo o fecha sin respaldo en la cita del párrafo.');
  used.add(p.sourceId);paragraphs.push({...p});
 }
 if(used.size<minSources)throw Error('Faltan fuentes distintas requeridas.');
 const analysis=paragraphs.map(p=>`${p.kind==='inferencia'?'Posible inferencia: ':''}${p.text} [${p.sourceId}]`).join('\n\n');
 const citations=paragraphs.map(p=>({sourceId:p.sourceId,quote:p.quote}));
 const legacyJSON=JSON.stringify({analysis,citations});
 const validated=validateModelOutput(legacyJSON,evidence);
 validated.validation.groundedContract='paragraph-citations-v1';
 validated.validation.legalAccuracy='not-evaluated';
 return {legacyJSON,paragraphs,validated};
}
