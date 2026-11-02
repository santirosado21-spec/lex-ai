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
function numericClaims(text){
 const value=normalize(text).toLocaleLowerCase('es');
 const claims=[...(value.match(/\p{N}+(?:[.,:/-]\p{N}+)*(?:\s*%)?/gu)||[])];
 for(const token of value.match(/[\p{L}]+/gu)||[])if(numberWords.has(token))claims.push(token);
 // Article identifiers are checked as a full phrase too (including Roman numerals/suffixes).
 for(const match of value.matchAll(/\bart[ií]culos?\s+(?:[ivxlcdm]+\b|\d+)(?:\s+(?:bis|ter|qu[aá]ter))?/gu))claims.push(match[0]);
 // A complete written date must occur, not just its independently scattered numbers.
 for(const match of value.matchAll(/\b(?:\d{1,2}|primero)\s+de\s+[a-záéíóú]+(?:\s+de(?:l)?\s+\d{2,4})?/gu))claims.push(match[0]);
 return claims;
}
function isObject(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
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
  if(p.text.length<40||p.text.length>350||/[\[\]\u0000-\u001f]/.test(p.text))throw Error('Texto fuera de límites o con corchetes/controles.');
  const quoteClaims=new Set(numericClaims(p.quote));
  if(numericClaims(p.text).some(claim=>!quoteClaims.has(claim)))throw Error('Número, artículo o fecha sin respaldo en la cita del párrafo.');
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
