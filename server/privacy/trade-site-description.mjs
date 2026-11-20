// A private address can be expressed entirely as a description of an identifiable
// place. Protect its complement in the original UTF-16 string.
const physicalTransfer=/\b(?:recogi[oó]|retir[oó]|recibi[oó]|entreg[oó]|dej[oó]|descarg[oó]|carg[oó]|pas[oó]|cruz[oó]|lleg[oó]|entr[oó]|sali[oó]|llev[oó]|transport[oó]|fue entregad[oa]|se (?:hizo|efectu[oó]|realiz[oó]) la entrega)(?![\p{L}\p{N}])/iu;
const where=/\b(?:donde|en donde|(?:al|el|un) (?:sitio|lugar|punto) en (?:el )?que)\b/igu;
const site=/\b(?:galer[ií]a|pasillo|corredor|taller|almac[eé]n|bodega|patio|rampa|muelle|garita|caseta|puesto|and[eé]n|port[oó]n|entrada|fachada|edificio|nave|esquina|callej[oó]n|tinglado|pabell[oó]n)\b/igu;
const feature=/^\s+(?:cuy[oa]s?\s+|(?:se (?:reconoce|distingue)|(?:f[aá]cilmente )?(?:identificable|reconocible)) por\s+|que (?:se (?:reconoce|distingue)|destaca) por\s+)/iu;
const records=/\b(?:factura|informe|recibo|documento|contrato|registro|pedimento|certificado|gu[ií]a)\s*$/iu;
export function describedSiteRanges(sentence){
 const ranges=[];
 for(const match of sentence.matchAll(site)){
  if(feature.test(sentence.slice(match.index+match[0].length)))ranges.push([match.index,sentence.length]);
 }
 for(const match of sentence.matchAll(where)){
  const prefix=sentence.slice(0,match.index);
  const tail=sentence.slice(match.index+match[0].length).trimStart();
  const describesRecord=records.test(prefix)&&/^(?:consta|figura|aparece|se (?:indica|señala|registra|describe|consigna|acredita))\b/iu.test(tail);
  if(physicalTransfer.test(prefix)&&!describesRecord)ranges.push([match.index,sentence.length]);
 }
 return ranges;
}
