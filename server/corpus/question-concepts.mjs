// Public concepts for focusing source retrieval. These labels never carry a
// positive or negative factual finding about an individual matter.
const concepts=[
 ['transporte','Gastos de transporte',/\b(?:fletes?|transporte)\b/u,'valoracion'],
 ['seguro','Seguro de la mercancía',/\bseguros?\b/u,'valoracion'],
 ['precio','Precio pagado',/\bprecio pagado\b/u,'valoracion'],
 ['regalias','Regalías y derechos de licencia',/\b(?:regalias?|derechos de licencia)\b/u,'valoracion'],
 ['insumos','Insumos y materiales',/\b(?:insumos?|materiales)\b/u,'origen'],
 ['origen','Origen de las mercancías',/\borigen\b/u,'origen'],
 ['cupo','Asignación de cupos',/\b(?:cupos?|asignacion de cupo)\b/u,'cupos'],
 ['acuse','Acuse de transmisión',/\bacuses?\b/u,'pedimento'],
 ['pedimento','Anexos del pedimento',/\bpedimentos?\b/u,'pedimento'],
 ['permiso','Permiso previo',/\bpermisos? previos?\b/u,'restricciones'],
 ['clasificacion','Clasificación arancelaria',/\b(?:clasificacion arancelaria|fraccion(?:es)? arancelaria(?:s)?)\b/u,'clasificacion'],
];
const plain=s=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
export function mentionedConcepts(text){
 const value=plain(text);
 return concepts.filter(([, ,pattern])=>pattern.test(value)).map(([id,,,topic])=>({id,topic}));
}
export function selectedConcepts(ids,source){
 if(!Array.isArray(ids)||ids.length>concepts.length||ids.some(id=>!concepts.some(item=>item[0]===id)))
  throw Error('Concepto jurídico desconocido.');
 const value=plain(source);
 return concepts.filter(([id,,pattern])=>ids.includes(id)&&pattern.test(value)).map(([,label])=>label);
}
