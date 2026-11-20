// Use the material field only for a closed technical vocabulary in a grammatical
// material position. Known parties, explicit reservations and context still win.
const materialNoun = '(?:fibra de (?:algodón(?: pima)?|vidrio|carbono)|resina (?:ep[oó]xica|epoxi|acr[ií]lica|fen[oó]lica)|acero (?:inoxidable|galvanizado)|polietileno de (?:alta|baja) densidad|cartón corrugado)';
const material = new RegExp('(?:\\b(?:material|insumo|composición)[ \\t]*:[ \\t]*|\\b(?:origen|procedencia) de(?:l | la | las | los | ))('+materialNoun+')(?=[.,;:?!\\n]|$| (?:tipo|marca|modelo|grado|serie)\\b)','dgiu');
export function materialDescriptionRanges(text) {
 return Array.from(text.matchAll(material), match => match.indices[1]);
}

export function isMaterialField(text){
 const trimmed=text.trim();
 const ranges=materialDescriptionRanges(trimmed);
 return ranges.length===1 && /^(?:material|insumo|composición)\s*:/iu.test(trimmed) &&
  /^[.,;]?$/u.test(trimmed.slice(ranges[0][1]));
}

export function describesOriginEvidence(text) {
 return /\b(?:certificado de origen|declaraci[oó]n (?:de|del) proveedor|procedencia (?:del?|de la)|origen preferencial|material[ \t]*:|(?:registro|bitácora|informe) de (?:proceso|empaque|embalaje)|(?:embalaje|empaque|envase|precinto|sello) distintivo)/iu.test(text);
}

// Require a spatial relation to a concrete site or a physical trace attached to
// the shipment. Preserve a preceding production step or documentary question.
const spatial = /\b(?:en (?:la |una )?(?:región|comarca|localidad) (?:de|del) |(?:instalaci[oó]n(?:es)?|plantas?|fábricas?|talleres?) (?:cercan[oa]s? a|próxim[oa]s? a|colindantes? con|ubicad[oa]s? (?:en|junto a)))/iu;
const trace = /\b(?:(?:indicio|rastro|señal) del? (?:la )?)?(?:residuo|pátina|mancha|sedimento|polvo|huella|incrustación)\b/iu;
const associated = /\b(?:sello|precinto|embalaje|empaque|envase|clima[s]?|región|recinto)\b/iu;
const siteNoun=/\b(?:planta|taller|instalación|fábrica|terminal|recinto|bodega|almacén)\b/iu;
const recognizableBy=/\b(?:reconocid[oa]|conocid[oa]|identificable|inconfundible) (?:por|debido a)\b/iu;
const distinctiveMark=/\b(?:sello|precinto|grabado|emblema|dibujo|estampado|relieve|patrón|motivo)(?: de [\p{L}-]+){0,2} (?:distintivo|inconfundible|singular|característico)\b/iu;
const depicted=/\b(?:grabado|emblema|dibujo|estampado|relieve) (?:de (?:la|el|los|las|un|una)|que (?:representa|muestra)|en forma de)\s+[\p{L}]/iu;
function physicalStart(clause){
 const signature=distinctiveMark.exec(clause)??depicted.exec(clause);
 const site=siteNoun.test(clause)?recognizableBy.exec(clause):null;
 if(!signature)return site?.index;
 return site?Math.min(signature.index,site.index):signature.index;
}
// Transport documents may identify a place by what remained on the load or
// by an incident on the route. A generic tariff question can use the very
// same terms for a product. Require an observation, a location or provenance.
const provenance = /\b(?:proveniente[s]? de(?:l| la| los| las)?|(?:origen|procedencia) (?:en|de) (?:la |el |los |las )?(?:región|comarca|localidad|valle|puerto|municipio)\b)/iu;
const observedTrace = /\b(?:(?:presencia|rastro|restos|señales|vestigios?) de (?:un[ao]? |los |las )?(?:residuos?|sedimentos?|polvo|cenizas?|partículas|fibras?)|(?:(?:leve|liger[ao]|delgad[ao]|fin[ao]|tenue) )?(?:capa|película|depósito) de (?:residuos?|sedimentos?|polvo|cenizas?|hollín|óxido|salitre))\b/iu;
const incident = /\b(?:caída|derrumbe|colapso|incendio|inundación|choque|volcadura|rotura|desbordamiento) (?:de|del|en|junto a)\b/iu;
const route = /\b(?:avenida|carretera|vialidad|muelle|aduana|puerto|patio|andén|acceso|terminal|vía|carretero)\b/iu;
const productSource = /^(?:l | la | los | las | )?(?:cualquier |otr[oa] |un[ao]? |el |la )?(?:capítulo|partida|subpartida|fracción|material|producto|insumo|mercancía|proveedor|documento|expediente)\b/iu;
export function describesShipmentNarrative(text){
 return /\b(?:lote|embarque|remesa|embalaje|envase|arancelari[oa]|subpartida|insumo|patio de (?:carga|descarga)|exportación|importación)\b/iu.test(text);
}
function narrativeCues(clause){
 const cues=[];
 const from=provenance.exec(clause);
 if(from&&!productSource.test(clause.slice(from.index+from[0].length)))cues.push(from.index);
 const trace=observedTrace.exec(clause);
 if(trace)cues.push(trace.index);
 const namedSite=/\b(?:[Ii]nstalaci[oó]n|[Pp]lanta|[Rr]ecinto|[Tt]erminal) de (?:[Ll]a |[Ee]l )?\p{Lu}\p{Ll}/u.exec(clause);
 if(namedSite)cues.push(namedSite.index);
 const event=incident.exec(clause);
 if(event&&route.test(clause))cues.push(event.index);
 return cues;
}
// Bound an identifying adjunct at the next independent documentary action.
// Keep complements and adjectives inside the protected region.
const nextAction=/,\s*(?=(?:según|mientras|utilizando|mediante|considerando|con fecha|sujeto a|salvo que|con (?:la|el) (?:declaración|factura|contrato|registro)|cumpl(?:e|en) con|acredita(?:n)? |el (?:comprador|proveedor|vendedor)|la (?:factura|certificación)))|\s+(?=y (?:se (?:emitió|comprobó|registró|pagó)|(?:el|la) (?:comprador|proveedor|vendedor|factura|certificación))\b)/iu;
export function originContextRanges(text) {
 const ranges=[];
 const narrative=describesShipmentNarrative(text);
 for(const match of text.matchAll(/[^.!?;\n]+/gu)){
  const clause=match[0];
  if(narrative)for(const start of narrativeCues(clause)){
   const tail=clause.slice(start),stop=tail.search(nextAction);
   ranges.push([match.index+start,match.index+start+(stop<0?tail.trimEnd().length:stop)]);
  }
  const place=spatial.exec(clause);
  if(place){
   const tail=clause.slice(place.index);
   const end=tail.search(/,\s*(?:utilizando|empleando|con fecha|según|mediante)\b/iu);
   ranges.push([match.index+place.index,match.index+place.index+(end<0?tail.length:end)]);
  }
  const physical=physicalStart(clause);
  if(physical!==undefined)ranges.push([match.index+physical,match.index+clause.trimEnd().length]);
  const residue=trace.exec(clause);
  if(residue && associated.test(clause)){
   const tail=clause.slice(residue.index),stop=tail.search(nextAction);
   ranges.push([match.index+residue.index,match.index+residue.index+(stop<0?tail.trimEnd().length:stop)]);
  }
 }
 return ranges;
}

export function originReviewUnits(segment){
 const units=[];
 const physical=physicalStart(segment.text);
 const cuts=[0,...Array.from(segment.text.matchAll(/,\s*(?=(?:considerando|tomando en cuenta|utilizando|mediante|con fecha|exhibiendo|presentando|observándose|mostrando|específicamente|mientras|con (?:la|el) (?:declaración|factura|contrato)|sujeto a|y se (?:observó|verificó))(?=[^\p{L}]|$))|\s+(?=en (?:la región|instalaciones cercanas)\b)|\s+(?=(?:tipo|marca|modelo)\s+['"«])/giu),m=>m.index+m[0].length)];
 if(physical>0&&!cuts.includes(physical)){cuts.push(physical);cuts.sort((a,b)=>a-b);}
 for(const [i,start] of cuts.entries()){
  const text=segment.text.slice(start,cuts[i+1]).trimEnd();
  if(text.trim())units.push({id:segment.id+start,text});
 }
 return units;
}
