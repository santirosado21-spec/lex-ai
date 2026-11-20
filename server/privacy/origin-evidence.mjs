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
export function originContextRanges(text) {
 const ranges=[];
 for(const match of text.matchAll(/[^.!?;\n]+/gu)){
  const clause=match[0];
  const place=spatial.exec(clause);
  if(place){
   const tail=clause.slice(place.index);
   const end=tail.search(/,\s*(?:utilizando|empleando|con fecha|según|mediante)\b/iu);
   ranges.push([match.index+place.index,match.index+place.index+(end<0?tail.length:end)]);
  }
  const physical=physicalStart(clause);
  if(physical!==undefined)ranges.push([match.index+physical,match.index+clause.trimEnd().length]);
  const residue=trace.exec(clause);
  if(residue && associated.test(clause))ranges.push([match.index+residue.index,match.index+clause.trimEnd().length]);
 }
 return ranges;
}

export function originReviewUnits(segment){
 const units=[];
 const physical=physicalStart(segment.text);
 const cuts=[0,...Array.from(segment.text.matchAll(/,\s*(?=(?:considerando|tomando en cuenta|utilizando|mediante|con fecha)\b)|\s+(?=en (?:la región|instalaciones cercanas)\b)|\s+(?=(?:tipo|marca|modelo)\s+['"«])/giu),m=>m.index+m[0].length)];
 if(physical>0&&!cuts.includes(physical)){cuts.push(physical);cuts.sort((a,b)=>a-b);}
 for(const [i,start] of cuts.entries()){
  const text=segment.text.slice(start,cuts[i+1]).trimEnd();
  if(text.trim())units.push({id:segment.id+start,text});
 }
 return units;
}
