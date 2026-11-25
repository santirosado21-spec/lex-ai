// Local work papers. No value from this module belongs to a provider envelope.
const schemas={
 'lectura-valoracion':{
  title:'Control de valoración',monetary:true,items:[
   ['precio','Precio pagado','Factura, moneda y comprobante de pago.','64'],
   ['transporte','Flete y transporte','Trayecto, momento del gasto y parte que lo cubrió.','65'],
   ['seguro','Seguro','Identificar la póliza, el tramo cubierto y la parte que pagó.','65'],
   ['conjunto','Flete y seguro sin desglose','Localizar el comprobante y revisar si procede un desglose.','65'],
   ['embalaje','Envases y embalaje','Desglose y comprobación de si ya forma parte del precio.','65'],
   ['comisiones','Comisiones','Concepto, beneficiario y condiciones del servicio.','65'],
   ['regalias','Regalías y licencias','Contrato, condición de venta y posible inclusión en el precio.','65'],
   ['otros','Otros conceptos por revisar','Identificar el documento y el fundamento que falta cotejar.','64'],
  ]},
 'lectura-pedimento':{
  title:'Control del pedimento',monetary:false,items:[
   ['declaracion','Pedimento','Copia o referencia de transmisión y operación que ampara.','36'],
   ['acuse','Acuse electrónico','Referencia local del acuse correspondiente.','36-A'],
   ['factura','Documento de valor','Identificar factura o documento equivalente y vínculo con la operación.','36-A'],
   ['transporte','Documento de transporte','Cotejar guía, conocimiento de embarque o lista de empaque.','36-A'],
   ['anexos','Otros anexos por revisar','Precisar los anexos relevantes para el régimen y la fecha.','36-A'],
  ]},
};
const statuses=['Por revisar','Solicitado','Recibido','Cotejado','No aplica'];
export const hasTradeWorksheet=task=>typeof task==='string'&&Object.hasOwn(schemas,task);
const blank={revision:0,status:'Por revisar',amount:'',currency:'',reference:'',note:''};

export function tradeWorksheet(task,stored={}){
 if(!hasTradeWorksheet(task))throw Error('Esta tarea no tiene un control documental.');
 const schema=schemas[task];
 const rows=schema.items.flatMap(([base,label,check,article])=>{
  const copies=Object.keys(stored).filter(id=>id.startsWith(base+'~'));
  return [base,...copies].map((id,i)=>({
   id,base,label:i?label+' ('+(i+1)+')':label,check,source:'LA '+article,...blank,...stored[id],
  }));
 });
 return {title:schema.title,monetary:schema.monetary,statuses:[...statuses],rows};
}

export function revisedWorksheetRow(sheet,id,input,revision){
 const current=sheet.rows.find(row=>row.id===id);
 if(!current||!Number.isSafeInteger(revision)||current.revision!==revision)
  throw Error('El renglón cambió. Vuelve a cargar el control y coteja tu edición.');
 const keys=['status','amount','currency','reference','note'];
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==keys.length||
    !keys.every(k=>Object.hasOwn(input,k)&&typeof input[k]==='string')||!statuses.includes(input.status))
  throw Error('Los campos del renglón son inválidos.');
 const {status,reference,note}=input;
 if(reference.length>140||note.length>300||/[\p{Cc}]/u.test(reference+note))
  throw Error('Usa una referencia de hasta 140 caracteres y una observación de hasta 300 en una línea.');
 const amount=input.amount.trim(),currency=input.currency.trim().toUpperCase();
 if((amount||currency)&&(!sheet.monetary||!/^\-?(?:0|[1-9]\d{0,9})(?:\.\d{1,4})?$/.test(amount)||!/^[A-Z]{3}$/.test(currency)))
  throw Error('Registra el importe con punto decimal y la moneda con tres letras, o deja ambos vacíos.');
 return {revision:revision+1,status,reference:reference.trim(),note:note.trim(),amount,currency};
}

export function worksheetSummary(sheet){
 const lines=[sheet.title];
 for(const row of sheet.rows.filter(row=>row.revision>0)){
  const values=[row.status,row.amount&&row.amount+' '+row.currency,row.reference,row.note].filter(Boolean);
  lines.push(row.label+' · '+values.join(' · '));
 }
 return lines.length>1?lines.join('\n'):'';
}

// Read only explicit field lines. A quoted cost is a candidate for review;
// its presence does not establish payment, customs value or tax treatment.
const headings={
 'lectura-valoracion':{precio:['precio pagado'],transporte:['flete','transporte'],seguro:['seguro'],conjunto:['flete y seguro'],embalaje:['embalaje','envases'],comisiones:['comision','comisiones'],regalias:['regalia','regalias']},
 'lectura-pedimento':{declaracion:['pedimento','numero de pedimento'],acuse:['acuse','acuse de validacion'],factura:['factura','factura comercial','documento equivalente'],transporte:['conocimiento de embarque','guia aerea','lista de empaque']},
};
const currencies=new Set(Intl.supportedValuesOf('currency'));
function amountPair(value){
 const match=/^(?:([A-Z]{3})\s+(-?[\d.,]+)|(-?[\d.,]+)\s+([A-Z]{3}))$/u.exec(value);
 if(!match)return null;
 const currency=match[1]??match[4];
 if(!currencies.has(currency))return null;
 let amount=match[2]??match[3];
 if(/^-?\d{1,3}(?:,\d{3})+\.\d{1,4}$/.test(amount))amount=amount.replaceAll(',','');
 else if(/^-?\d{1,3}(?:\.\d{3})+,\d{1,4}$/.test(amount))amount=amount.replaceAll('.','').replace(',','.');
 else if(/^-?\d+(?:[.,](?:\d{1,2}|\d{4}))?$/.test(amount))amount=amount.replace(',','.');
 else return null;
 return /^-?(?:0|[1-9]\d{0,9})(?:\.\d{1,4})?$/.test(amount)?{amount,currency}:null;
}

export function worksheetProposals(task,original){
 const proposals={};
 for(const [index,line] of original.split('\n').entries()){
  const field=/^\s*([^:]{2,45}):\s*(\S.{0,310})$/u.exec(line);
  if(!field)continue;
  const caption=field[1].trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu,'');
  const entry=Object.entries(headings[task]??{}).find(([,labels])=>labels.includes(caption));
  if(!entry)continue;
  const [id]=entry;
  const money=task==='lectura-valoracion'?amountPair(field[2].trim()):null;
  if(task==='lectura-valoracion'&&!money)continue;
  const source='Línea '+(index+1)+' · '+line.trim();
  const reference=source.slice(0,140).replace(/[\uD800-\uDBFF]$/u,'');
  (proposals[id]??=[]).push({line:index+1,reference,excerpt:line.trim(),...money});
 }
 return proposals;
}

// A work list from saved manual states, not a legal opinion or client letter.
export function worksheetPendingNote(sheet){
 const groups=[
  ['Por revisar: definir el siguiente paso','Por revisar'],
  ['Solicitado: dar seguimiento','Solicitado'],
  ['Recibido: cotejo pendiente','Recibido'],
 ];
 if(sheet.rows.some(row=>!statuses.includes(row.status)))throw Error('Revisa los estados no reconocidos antes de preparar los pendientes.');
 const lines=['# Pendientes del control documental',sheet.title,
  'Lista interna preparada en este equipo a partir de los estados guardados por el usuario. No acredita cumplimiento jurídico ni suficiencia de los documentos. No es una solicitud al cliente.',
  'Los estados Cotejado y No aplica se omiten. Un documento Recibido conserva el cotejo pendiente.'];
 let count=0;
 for(const [title,status] of groups){
  const rows=sheet.rows.filter(row=>row.status===status);
  if(!rows.length)continue;
  lines.push('## '+title);
  for(const row of rows){
   count++;
   lines.push('- '+row.label+' · '+row.status,'Qué cotejar: '+row.check,
    ...(row.reference?['Referencia local: '+row.reference]:[]),
    ...(row.note?['Observación del usuario: '+row.note]:[]));
  }
 }
 if(!count)lines.push('Sin pendientes según los estados guardados. Esto no equivale a una conclusión de cumplimiento.');
 return lines.join('\n\n');
}
