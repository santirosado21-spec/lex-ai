import {needsShipmentContext,reviewShipmentContext} from './shipment-context.mjs';
import {describesOriginEvidence,originReviewUnits,isMaterialField} from './origin-evidence.mjs';
import {describesEquipmentReturn} from './trade-document-structure.mjs';
// Local model sees numbered sentences. It can add protection only by selecting
// an existing sentence, never by supplying replacement text or guessed offsets.
const contextTask='Audita exclusivamente la identificación indirecta en un extracto ficticio de comercio. Recibes oraciones numeradas. Selecciona los números de oraciones en que alguien podría reconocer un embarque, parte, recinto o persona por su entorno: función exclusiva o turno distintivo, ubicación relativa o hito local, cita o momento preciso de la operación, combinación poco común o vínculo con un acontecimiento identificable. No marques una oración sólo por datos directos como nombre, folio, lote, buque o un número de serie: ya se procesaron. ';
const generalScope='Una fecha normativa o un hecho genérico no basta. ';
const returnScope='Una referencia temporal puede ser indirecta: un embarque que llega al oír una señal local distintiva o durante un acto reconocible. La medición del ruido de una pieza es un hecho técnico. Distingue una ubicación o evento singular de una descripción ordinaria del régimen, una operación de mantenimiento o una solicitud de evidencia. ';
const responseFormat='Responde JSON {"oraciones":[...]} con identificadores de la lista, sin texto literal.';

// A model can mistake an already hidden transport reference for evidence of a
// distinctive event. Only complete, routine documentary constructions qualify.
const marker='〔Dato [1-9]\\d*〕';
const routine=new RegExp('^(?:(?:carta de porte|contrato de transporte|factura comercial): '+marker+'|'+
 '(?:(?:para|según) (?:la carta de porte|la factura|el contrato) '+marker+'[,]? )?(?:el comprador|el vendedor|el importador) (?:pagó|cubrió|asumió) (?:el flete|el transporte|el seguro)(?: por separado)?|'+
 '(?:el recibo|la factura|el contrato) atribuye al (?:comprador|vendedor|importador) el pago del (?:flete|transporte|seguro) relacionado con '+marker+'|'+
 'se adjunta (?:la carta de porte|la factura|el contrato) '+marker+')[.]?$','iu');

// These complete unqualified statements contain only documentary terms. An
// added location, date or distinctive detail still goes through context review.
const routineDescription=/^(?:(?:las etiquetas|el informe|la constancia|el pedimento|los documentos) (?:indican?|describen?|acreditan?|mencionan?) (?:la )?(?:salida|exportación|importación) temporal para (?:reparación|transformación|elaboración)|(?:la prueba|el ensayo) (?:acústic[oa]|de ruido) (?:detectó|registró|indicó) (?:una vibración|ruido|una falla) en (?:el motor|la pieza|el equipo))[.]?$/iu;

// The whole sentence must describe only the direction and purpose of a
// shipment. Independently detected names, references and addresses stay masked.
const equipmentShipment=/^se (?:remitió|envió|mandó|trasladó)(?: al (?:fabricante|proveedor|taller))? (?:un|una|el|la) (?:medidor|equipo|aparato|instrumento|máquina|motor|bomba|válvula) para (?:su )?(?:inspección|calibración|reparación|revisión|ajuste) en el extranjero[.]?$/iu;

// Preserve a generic test description before a location. The selected context
// still covers the complete spatial clause. A leading folio must already be masked.
const testAtPlace=/^\s*(?:folio\s+([\p{L}\d./_-]+)\s*:\s*)?(?:el|la) (?:control de (?:rectitud|dureza|calidad)|ensayo de (?:dureza|tracción|composición)|prueba de (?:dureza|resistencia)) se (?:realizó|practicó|efectuó)\s+(?=(?:frente al?|junto al?|detrás del?|al lado del?|en (?:el|la))\b)/diu;
function contextStart(segment,protectedSpans){
 const match=testAtPlace.exec(segment.text);
 if(!match)return segment.id;
 if(match[1]){
  const [a,b]=match.indices[1];
  if(!protectedSpans.some(p=>p.start<=segment.id+a&&p.end>=segment.id+b))return segment.id;
 }
 return segment.id+match[0].length;
}

export async function reviewContextLocally(text,ask,signal,parts=[]){
 const origin=describesOriginEvidence(text),shipment=needsShipmentContext(text);
 const originScope='En certificados o consultas de origen distingue cada indicio reconocible de la composición ordinaria. Una huella física, un dibujo distintivo del envase, una referencia ambiental o un hito permiten reconocer el sitio. Una fibra, una resina, un proceso industrial o la pregunta sobre los documentos de origen por sí solos no son indicios. ';
 const instruction=contextTask+(describesEquipmentReturn(text)?returnScope:origin?originScope:generalScope)+responseFormat;
 const segments=Array.from(new Intl.Segmenter('es',{granularity:'sentence'}).segment(text),
  s=>({id:s.index,text:s.segment.trimEnd()})).filter(s=>s.text.trim()).flatMap(s=>origin?originReviewUnits(s):[s]);
 const protectedSpans=parts.filter(part=>part.label);
 const routineIds=new Set();
 const ends=new Map(segments.map(s=>[s.id,s.id+s.text.length]));
 for(const segment of segments){
  const end=ends.get(segment.id);
  let cursor=segment.id,masked='';
  for(const part of protectedSpans){
   if(part.start>=end)break;
   if(part.end<=cursor)continue;
   masked+=text.slice(cursor,Math.max(cursor,part.start))+'〔'+part.label+'〕';cursor=Math.min(end,part.end);
  }
  if(isMaterialField(segment.text)||routineDescription.test(segment.text.trim())||equipmentShipment.test(segment.text.trim())||protectedSpans.length&&routine.test((masked+text.slice(cursor,end)).trim()))routineIds.add(segment.id);
 }
 const ranges=[];
 let batch=[],size=0;
 async function classify(){
  const allowed=new Map(batch.map(s=>[s.id,s]));
  const format={type:'object',additionalProperties:false,required:['oraciones'],properties:{
   oraciones:{type:'array',items:{type:'integer',enum:[...allowed.keys()]},maxItems:batch.length},
  }};
  const result=await ask(instruction,JSON.stringify(batch),format,256);
  if(!result||Object.keys(result).length!==1||!Array.isArray(result.oraciones)||result.oraciones.length>batch.length||
     new Set(result.oraciones).size!==result.oraciones.length||!result.oraciones.every(id=>allowed.has(id)))throw Error('Resultado ambiguo.');
  for(const id of result.oraciones)if(!routineIds.has(id))ranges.push([contextStart(allowed.get(id),protectedSpans),ends.get(id)]);
  if(shipment)ranges.push(...await reviewShipmentContext(batch,ask));
 }
 try{
  for(const sentence of segments){
   if(sentence.text.length>3800)throw Error('Oración demasiado larga.');
   if(batch.length&&(batch.length>=24||size+sentence.text.length>3800)){
    await classify();batch=[];size=0;
   }
   batch.push(sentence);size+=sentence.text.length;
  }
  if(batch.length)await classify();
  return {ranges,available:true};
 }catch{
  signal?.throwIfAborted();
  return {ranges,available:false};
 }
}
