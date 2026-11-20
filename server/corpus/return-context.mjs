// Match documentary references inside one open matter. Only line coordinates
// and a closed research topic leave this resolver. The source text stays local.
export const returnIdentityInquiry='¿Qué documentos permiten comprobar si regresó el mismo bien después de una intervención en el extranjero?';
const fold=s=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
const code=/\b[\p{L}\d]+(?:[-_/][\p{L}\d]+)+\b/gu;
const codes=s=>[...s.matchAll(code)].map(m=>m[0].toUpperCase()).filter(x=>/\d/u.test(x)&&/[A-Z]/u.test(x));
const label=/\b(orden (?:de (?:retorno|servicio|reparacion))|factura(?: comercial)?|folio (?:de servicio|de retorno))\s*(?:n[ºo.]?\s*)?[:#]?\s*([a-z\d]+(?:[-_/][a-z\d]+)+)\b/gu;
const identity=/\b(?:mism[oa]|original|identic[oa]|distint[oa]|reemplazo|sustituid[oa]|cambio de (?:una? |la )?(?:pieza|equipo))\b/u;
const equipment=/\b(?:equipo|aparato|medidor|instrumento|maquina|mercancia|componente|pieza|bomba|sensor|valvula|motor|bien|hardware)\b/u;
export function isReturnQuestion(text){
 const q=fold(text);
 return identity.test(q)&&equipment.test(q);
}
const direction=/\b(?:export(?:o|aron|ada|ado)\b|(?:consta|acredita|ampara|registra|indica) (?:la )?(?:salida|exportacion) temporal\b|(?:regimen|operacion)\s*:\s*exportacion temporal\b|salio del pais\b|(?:remitio|envio|enviaron|salio|salieron|remitieron|traslado)\b[^.!?;\n]{0,150}\b(?:extranjero|fuera del pais))\b/u;
const domestic=/\b(?:sin salir del pais|(?:no|nunca) (?:se )?(?:exporto|remitio|envio|salio)|(?:reparacion|servicio) (?:fue )?(?:nacional|domestic[oa]|en mexico)|(?:se reparo|se ajusto) en mexico)\b/u;
const hypothetical=/\b(?:si se|podrian?|pendiente|debera[n]?|programad[ao]|se propone|se desconoce si|falta (?:confirmar|acreditar) si)\b/u;
const work=/\b(?:reparacion|repar[oa]|repararon|ajust[o]|reemplazo|sustitucion|sustituyeron|sustituido|cambi[o] (?:una? |la |el )(?:pieza|componente|sensor|valvula))\b/u;
const noWork=/\b(?:sin reparacion|no (?:se )?(?:reparo|ajusto|reemplazo|cambio)|sin (?:intervencion|modificacion))\b/u;

function readSignals(lines){
 let outbound,service,contrary;
 for(const line of lines){
  for(const sentence of fold(line.text).split(/[.!?;\n]/u)){
   if(domestic.test(sentence)){contrary??=line;continue;}
   if(hypothetical.test(sentence))continue;
   if(direction.test(sentence))outbound??=line;
   // A negation later in the sentence can qualify a different action.
   const clauses=sentence.split(/,|\by (?=no\b)/u);
   if(clauses.some(clause=>work.test(clause)&&!noWork.test(clause))&&!/^\s*no\b/u.test(sentence))service??=line;
  }
 }
 if(contrary)return {state:'domestic',lines:[contrary]};
 if(!outbound)return {state:'direction',lines:service?[service]:[]};
 if(!service)return {state:'work',lines:[outbound]};
 return {state:'supported',lines:[...new Set([outbound,service])]};
}

export function returnContext(question,documents,chosen){
 if(!isReturnQuestion(question)||!documents.length)return null;
 const queried=new Set(codes(question));
 if(!queried.size&&!chosen)return {state:'unlinked',lines:[]};
 const orders=new Set(),known=new Set();
 const rows=documents.map(doc=>{
  const ids=new Set(codes(doc.original));
  for(const m of fold(doc.original).matchAll(label)){
   const id=m[2].toUpperCase();
   if(!/\d/u.test(id))continue;
   known.add(id);if(!m[1].startsWith('factura'))orders.add(id);
  }
  return {doc,ids};
 });
 const orderIds=rows=>new Set(rows.flatMap(r=>[...r.ids].filter(id=>orders.has(id))));
 const hits=rows.filter(row=>[...queried].some(id=>known.has(id)&&row.ids.has(id)));
 let group;
 if(chosen){
  group=rows.filter(row=>chosen.some(line=>line.sourceId===row.doc.id));
  if(!group.length||orderIds(group).size>1)return {state:'ambiguous',lines:[]};
  const anchors=orderIds(group);
  if(group.length>1&&!group.every(row=>[...row.ids].some(id=>known.has(id)&&group.every(other=>other.ids.has(id)))))return {state:'unlinked',lines:[]};
  const connected=anchors.size?rows.filter(row=>row.ids.has([...anchors][0])):group;
  if([...queried].some(id=>!known.has(id)||!connected.some(row=>row.ids.has(id))))return {state:'unlinked',lines:[]};
 }else{
  if(!hits.length||[...queried].some(id=>!hits.some(r=>r.ids.has(id))))return {state:'unlinked',lines:[]};
  const anchors=orderIds(hits);
  if(anchors.size>1)return {state:'ambiguous',lines:[]};
  group=anchors.size?rows.filter(r=>r.ids.has([...anchors][0])):hits;
  if(orderIds(group).size>1||hits.some(row=>!group.includes(row))||(!anchors.size&&queried.size>1))return {state:'ambiguous',lines:[]};
 }
 // Several distinct invoices in a single source can represent separate goods.
 const serials=new Set(),models=new Set();
 for(const {doc} of group){
  for(const m of fold(doc.original).matchAll(/\b(?:n[uú]mero de serie|serie|modelo)\s*[:#]\s*([a-z0-9][a-z0-9_/-]*)/gu)){
   (m[0].startsWith('modelo')?models:serials).add(m[1]);
  }
 }
 if(serials.size>1||models.size>1)return {state:'ambiguous',lines:[]};
 if(group.some(r=>[...r.ids].filter(id=>known.has(id)&&!orders.has(id)).length>1))return {state:'ambiguous',lines:[]};
 if(chosen)return readSignals(chosen);
 const lines=group.flatMap(({doc})=>doc.original.split('\n').map((text,i)=>({sourceId:doc.id,label:doc.label,line:i+1,text})));
 return readSignals(lines);
}
