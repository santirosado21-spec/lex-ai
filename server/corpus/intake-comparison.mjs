// Each public request covers all three hypotheses. The local selection and its
// supporting lines never enter the packet or the cloud account receipt.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {customsPassage} from './customs-edition.mjs';
import {proposedQuestions} from './trade-pilot-grounding.mjs';

const subjects={
 flete:{
  title:'Flete y precio pagado',article:'65',indices:[0,1,3],
  issues:['Determinar a quién corresponde el gasto y si ya está comprendido en el precio pagado.',
   'Identificar el tramo de transporte cubierto y cotejar el momento al que remite el inciso.',
   'Comprobar qué datos objetivos permiten cuantificar el gasto.'],
  trigger:/\bflete\b|gastos de transporte/u,
  variants:[
   ['incluido','El precio incluye el flete','Cotejar el desglose del precio y el comprobante del transporte para identificar el mismo gasto.'],
   ['excluido','El precio excluye el flete','Identificar quién cubrió el gasto, el tramo que ampara y el documento que permite cuantificarlo.'],
   ['pendiente','Inclusión del flete por aclarar','Conciliar factura, contrato de transporte y comprobante de pago antes de clasificar el gasto.'],
  ],
  yes:/^(?:(?:el )?flete\s*:?\s*(?:ya )?(?:esta |se encuentra )?incluido en el precio(?: pagado)?|el precio(?: pagado)? incluye el flete)$/u,
  no:/^(?:(?:el )?flete\s*:?\s*(?:no (?:esta |se encuentra )?incluido en|excluido de) el precio(?: pagado)?|(?:el )?flete\s*:?\s*(?:esta |se encuentra )?excluido del precio(?: pagado)?|el precio(?: pagado)? no incluye el flete)$/u,
 },
 regalias:{
  title:'Regalías y condición de venta',article:'65',indices:[2,3],
  issues:['Identificar el vínculo con la mercancía, la obligación de pago como condición de venta y su posible inclusión en el precio.',
   'Localizar información objetiva que permita cuantificar el cargo.'],
  trigger:/\b(?:regalias?|derechos de licencia|contrato de licencia)\b/u,
  variants:[
   ['pactada','El soporte describe una condición de venta','Localizar la cláusula de compraventa o licencia, identificar quién exige el pago y revisar la mercancía amparada.'],
   ['negada','El soporte niega que el pago condicione la venta','Contrastar la declaración con el contrato de venta, la licencia y los documentos relacionados.'],
   ['pendiente','Relación entre licencia y venta por aclarar','Pedir los contratos y comprobar si el comprador puede adquirir la mercancía sin el pago por licencia.'],
  ],
  yes:/^(?:el pago de (?:las )?regalias es (?:una )?condicion de venta|(?:regalias|derechos de licencia)\s*:\s*(?:pago exigido como )?condicion de venta)$/u,
  no:/^(?:el pago de (?:las )?regalias no es (?:una )?condicion de venta|la venta no (?:esta condicionada al|depende del) pago de (?:las )?regalias)$/u,
 },
 acuse:{
  title:'Acuse de los anexos del pedimento',article:'36-A',indices:[0,1,2],
  issues:['Vincular el acuse generado por el sistema con la información transmitida y revisar las excepciones aplicables.',
   'Cotejar el soporte de valor, el método de valoración y el acuse correspondiente.',
   'Identificar el documento de transporte y la referencia o acuse que corresponda.'],
  trigger:/\b(?:acuse|anexos? (?:al|del) pedimento)\b/u,
  variants:[
   ['presente','El soporte menciona un acuse de los anexos','Cotejar a qué anexo corresponde el acuse y vincularlo con el pedimento examinado.'],
   ['ausente','El soporte señala que falta el acuse','Localizar la constancia con quien transmitió los anexos y registrar qué documentación se revisó.'],
   ['pendiente','Correspondencia del acuse por aclarar','Distinguir el acuse de los anexos de otras constancias y precisar qué documento falta cotejar.'],
  ],
  yes:/^(?:(?:se adjunta|obra en el expediente|consta en el expediente) el acuse de los anexos(?: (?:al|del) pedimento)?|acuse de los anexos(?: (?:al|del) pedimento)?\s*:\s*(?:adjunto|recibido))$/u,
  no:/^(?:(?:falta|no obra en el expediente|no consta en el expediente) el acuse de los anexos(?: (?:al|del) pedimento)?|acuse de los anexos(?: (?:al|del) pedimento)?\s*:\s*(?:faltante|pendiente de recibir))$/u,
 },
};
const packets=new Map(),trusted=new WeakSet();
const normal=value=>value.toLowerCase().normalize('NFD').replace(/\p{M}/gu,'').trim();
const owned=(obj,key)=>obj&&Object.hasOwn(obj,key);
const variantsFor=subject=>subjects[subject].variants.map(([id,label,work])=>({id,label,work}));

function royaltyAuthority(){
 const bytes=readFileSync(new URL('../../resources/trade/criterio-regalias-2013396.json',import.meta.url));
 if(createHash('sha256').update(bytes).digest('hex')!=='64ec49f3c4834a3530707efa6fd836c0dae1726e7a59fe1ee57faf2cb114fccb')throw Error('La ficha del Semanario requiere cotejo.');
 const row=JSON.parse(bytes);
 return Object.freeze({id:'SJF-'+row.registroDigital,title:row.tituloEditorial,url:row.url,checkedOn:row.fechaConsulta,
  locator:row.tipo+' · '+row.tesis+' · '+row.organo+' · '+row.epoca+' · '+row.publicacion+' · '+row.fuente,
  summary:'Extracto de la ficha histórica. Revisar texto completo, notas posteriores y aplicación al asunto.',
  text:row.extracto});
}

function packetFor(subject){
 if(packets.has(subject))return packets.get(subject);
 const spec=subjects[subject],{ref,passages}=customsPassage(spec.article);
 const refs=[ref];
 const items=spec.indices.map((index,i)=>Object.freeze({...passages[index],source:ref.id,issue:spec.issues[i],key:'P'+(i+1)}));
 if(subject==='regalias'){
  const thesis=royaltyAuthority();refs.push(thesis);
  items.push(Object.freeze({key:'P3',source:thesis.id,quote:thesis.text,locator:thesis.locator,
   issue:'Comprobar si el vendedor impone el pago al comprador en la compraventa o en otro documento.'}));
 }
 const choices=Object.freeze(items);
 const variants=Object.freeze(variantsFor(subject).map(Object.freeze));
 const prompt='Prepara el cotejo documental de tres hipótesis independientes para un abogado mexicano. Para CADA hipótesis elige el pasaje más pertinente y redacta una pregunta específica de seguimiento sobre un documento. Usa sólo el texto suministrado. Evita dictaminar cumplimiento, importes, tasas, plazos o vigencia. Devuelve únicamente un objeto JSON con las tres claves de hipótesis. En cada una escribe {"pasaje":"clave P","pregunta":"¿pregunta entre signos con letras y espacios?"}.\n\n'+
  variants.map(v=>v.id+' | '+v.label).join('\n')+'\n\n'+refs.map(source=>
   source.title+' · '+source.locator+'\n'+source.url+'\n'+choices.filter(c=>c.source===source.id).map(c=>c.key+' | '+c.locator+' | '+c.quote).join('\n')).join('\n\n');
 const packet=Object.freeze({subject,title:spec.title,variants,choices,refs:Object.freeze(refs),prompt,digest:createHash('sha256').update(prompt).digest('hex')});
 packets.set(subject,packet);trusted.add(packet);return packet;
}

export function comparisonEnvelope(packet){
 if(!trusted.has(packet))throw Error('El contraste carece de una fuente cotejada.');
 return {version:1,responseFormat:'json',messages:[{role:'user',content:packet.prompt}]};
}

function findEvidence(original,spec){
 const lines=[];
 original.split('\n').forEach((line,index)=>{
  const norm=normal(line);
  if(!spec.trigger.test(norm)||/^(?:cliente|proveedor|asunto|domicilio|razon social|contacto)\s*:/u.test(norm))return;
  // Only complete, explicit statements determine the suggestion. A question,
  // conditional clause or conflict stays open for the lawyer.
  const clauses=line.split(/[.;]/u).map(s=>s.trim()).filter(Boolean);
  const uncertain=/[¿?]|\b(?:si|quizas|posible|borrador|aparentemente|condicional)\b|por confirmar|sin verificar|no se (?:ha )?confirm|informaci[oó]n incorrecta|lo anterior es incorrecto/u.test(norm);
  const relevant=clauses.filter(c=>spec.yes.test(normal(c))||spec.no.test(normal(c)));
  const yes=!uncertain&&relevant.some(c=>spec.yes.test(normal(c)));
  const no=!uncertain&&relevant.some(c=>spec.no.test(normal(c)));
  const excerpt=line.trim().length<=360?line.trim():relevant.length?relevant.join('. '):clauses.find(c=>spec.trigger.test(normal(c)))??line;
  lines.push({line:index+1,excerpt:[...excerpt].slice(0,360).join(''),yes,no,uncertain});
 });
 if(!lines.length)return null;
 const positive=lines.find(l=>l.yes),negative=lines.find(l=>l.no),ambiguous=lines.find(l=>l.uncertain);
 const conflicting=Boolean(positive&&negative);
 const variant=conflicting||ambiguous?2:positive?0:negative?1:2;
 const selected=[...new Set([positive,negative,ambiguous].filter(Boolean))];
 if(!selected.length)selected.push(lines[0]);
 const evidence=selected.slice(0,3).sort((a,b)=>a.line-b.line).map(({line,excerpt})=>({line,excerpt}));
 return {variant,conflicting,evidence};
}

export function comparisonsFor(original){
 const notes=[];
 for(const [subject,spec] of Object.entries(subjects)){
  const match=findEvidence(original,spec);
  if(!match)continue;
  let packet;
  try{packet=packetFor(subject);}catch{continue;} // Other local work stays available when the pinned edition is missing.
  for(const variant of packet.variants){
   const suggested=packet.variants[match.variant].id;
   const title=packet.title+' · '+variant.label;
   const source=match.evidence[0];
   notes.push({id:'contraste-'+subject+'-'+variant.id,title,subject,variant,packet,
    suggested:variant.id===suggested,suggestedLabel:packet.variants[match.variant].label,conflicting:match.conflicting,
    evidence:{...source,additional:match.evidence.slice(1)}});
  }
 }
 return notes;
}

export function readComparisonReply(raw,packet){
 let value;
 try{value=JSON.parse(raw);}catch{throw Error('La respuesta de contraste no pudo cotejarse.');}
 if(!value||Array.isArray(value)||Object.keys(value).length!==packet.variants.length)throw Error('Faltan hipótesis del contraste.');
 const answers={};
 for(const {id} of packet.variants){
  const pair=owned(value,id)&&value[id];
  const question=proposedQuestions(pair?.pregunta);
  if(!pair||typeof pair!=='object'||Object.keys(pair).length!==2||!question||question.includes('\n')||
     !packet.choices.some(c=>c.key===pair.pasaje))throw Error('El contraste requiere una pregunta y una referencia cotejables por hipótesis.');
  answers[id]={pasaje:pair.pasaje,pregunta:question};
 }
 return {digest:packet.digest,answers};
}

export function renderComparison(note,matrix){
 const {packet,variant}=note;
 if(matrix?.digest!==packet.digest)throw Error('La edición del contraste cambió.');
 const answer=matrix.answers?.[variant.id];
 if(!answer||proposedQuestions(answer.pregunta)!==answer.pregunta||!answer.pregunta)throw Error('La pregunta guardada requiere cotejo.');
 const choice=packet.choices.find(c=>c.key===answer.pasaje);
 const selectedSource=packet.refs.find(ref=>ref.id===choice?.source);
 if(!selectedSource||!selectedSource.text.includes(choice.quote))throw Error('Falta la cita del contraste.');
 const context=packet.subject==='flete'?packet.choices.slice(0,2):packet.choices.slice(0,1);
 const companion=context.filter(item=>item.key!==choice.key).map(item=>'['+item.source+'] · '+item.locator+'\n'+item.quote);
 return ['Cotejo para [[CLIENTE]] · [[ASUNTO]]','Hipótesis de trabajo\n'+variant.label,
  'Indicios del soporte\n'+(note.conflicting?'El soporte contiene afirmaciones incompatibles.':note.suggestedLabel)+
   '\n[[SOPORTE]]','Punto que requiere cotejo\n'+choice.issue,'Documentos y seguimiento\n'+variant.work+'\n'+answer.pregunta,
  '['+selectedSource.id+'] · '+choice.locator+'\n'+choice.quote+
   (companion.length?'\n'+companion.join('\n'):''),
  'Revisar los documentos y la edición aplicable a la fecha de la operación.'].join('\n\n');
}
