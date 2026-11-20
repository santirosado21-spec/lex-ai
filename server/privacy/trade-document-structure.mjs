// These are form captions and ordinary spelling variants. They are public text
// only at a parsed caption position. The same words can identify a party elsewhere.
const captions=[
 'aduana e/s.','aduana de despacho','cve. pedim.','cve. pedimento','clave del pedimento',
 'destino/origen','país de origen','unidad de medida','núm. pedimento','número de pedimento',
 'domicilio','fletes','incoterm','moneda fact.','peso bruto','régimen','seguros','tipo cambio',
 'tipo de cambio','t. oper.','tipo oper.','val. adu/val. usd.','valor aduana','valor en aduana',
 'valor dólares','nombre del proveedor','correo de contacto','razón social','descripción de la mercancía',
 'fracción arancelaria','código de identificación comercial','número de factura','medio de transporte',
];
const pattern=captions.sort((a,b)=>b.length-a.length).map(c=>c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replaceAll(' ','[ \\t]+')).join('|');
const captionLine=new RegExp('(?:^|[\\n;|])[ \\t]*('+pattern+')[ \\t]*(?=:)','dgiu');
const caption='(?:'+pattern+')';
const series=new RegExp('(?:^|[.!?\\n])[ \\t]*(?:(?:nombres de (?:los |las )?)?(?:campos|columnas|rótulos|encabezados))'+
 '(?:[ \\t]+(?:por|a|del|de|la|las|los|cotejar|revisar|verificar|formulario|pedimento|documento|factura)){0,5}[ \\t]*:[ \\t]*('+
 caption+'(?:(?:[ \\t]*[,;|][ \\t]*|[ \\t]+(?:y|e)[ \\t]+)'+caption+')*)[ \\t]*(?=[.!?\\n]|$)','dgiu');

export function formCaptionRanges(text) {
 return [...text.matchAll(captionLine),...text.matchAll(series)].map(match=>match.indices[1]);
}

// An abbreviation or an interior number can continue a postal address. Start a
// new detector segment only after a complete Mexican postal code (optionally an
// interior) and an explicit new documentary action. Re-scan both segments.
const postalSentence=/\b(?:C\.?\s*P\.?|código postal)\s*:?\s*\d{5}(?:\s*,\s*(?:interior|int\.?|departamento|depto\.?)\s+[\p{L}\d-]+)?[.]\s+(?=(?:se\s+(?:solicita|requiere|adjunta|acompaña)|para\s+(?:la\s+)?(?:revisión|verificación|comprobación)|adjunt(?:ar|e|amos)|remit(?:ir|a|imos)|solicit(?:ar|e|amos)|falta\s+(?:la|el))\b|se\s+(?:solicitan|requieren|adjuntan)\b)/giu;
export function detectorSegments(text) {
 const fieldLines=/\n(?=[ \t]*(?:cliente|asunto|proveedor|razón social|nombre del proveedor|correo de contacto|contacto|mercancía|operación|constancia|documentación|encargo|país de origen|unidad de medida|remitente|responsable|licenciante|licenciatari[oa]|carta (?:de )?porte|factura comercial|contrato(?: de (?:compraventa|licencia|transporte))?|orden de retorno)\s*:)/giu;
 const afterIdentity=/^(?:cliente|proveedor|importador|exportador|responsable|licenciante|licenciatari[oa]|remitente)[ \t]*:[^\n]{2,200}\n(?=(?:El|La) (?:retorno|flete|seguro|envío|pago|acuse|factura|entrega|certificación|regalía) (?:sigue |está |se |no |es |fue |corresponde |incluye ))/gimu;
 const starts=[...new Set([0,...Array.from(text.matchAll(postalSentence),m=>m.index+m[0].length),
  ...Array.from(text.matchAll(fieldLines),m=>m.index+1),...Array.from(text.matchAll(afterIdentity),m=>m.index+m[0].length)])].sort((a,b)=>a-b);
 return starts.map((start,i)=>({start,text:text.slice(start,starts[i+1]??text.length)}));
}

export function labelledIdentityRanges(text) {
 return Array.from(text.matchAll(/^(?:cliente|asunto|proveedor|razón social|nombre del proveedor|correo de contacto|contacto|exportador|importador|remitente|licenciante|licenciatari[oa]|responsable)[ \t]*:[ \t]*([^\n;]{2,200})$/dgimu)).filter(m=>!/[.!?]\s+\p{Lu}\p{Ll}{2}/u.test(m[1])).map(m=>m.indices[1]);
}

// Only discount a model suggestion in a grammatical documentary position. A known
// party, explicit field, contextual redaction or independent detector still takes precedence.
export function documentaryObjectRanges(text){
 const noun='(?:constancia de retorno|certificaci[oó]n de origen|comprobante de pago|factura comercial|acuse(?: de transmisi[oó]n)?)';
 const object=new RegExp('\\b(?:incluye|adjunta|acompaña|falta|carece de) (?:el |la |un |una )?('+noun+')(?=[.,;:]|$)','dgiu');
 const subject=new RegExp('\\b(?:el|la) ('+noun+') (?:no )?coincide con (?:el|la) (?:pedimento|factura|recibo|contrato)\\b','dgiu');
 return [...text.matchAll(object),...text.matchAll(subject)].filter(m=>m[1]===m[1].toLocaleLowerCase('es')).map(m=>m.indices[1]);
}

// Match a technical expression only in its ordinary grammatical role. Never
// subtract it from a known identity, address, contextual clue or other detector.
const processSubject=/\b(?:el|la) (proveedor|importador|fabricante|transportista|exportador|comprador|vendedor) (?:declara|indica|acredita|confirma|entrega|adjunta)\b/dgiu;
const processObject=/\b(?:declara|incluye|documenta|acredita|describe) (?:un[ao]? |l[ao]s? )?(etapa de (?:fundición|extrusión|laminación|templado|ensamble|soldadura))(?=[.,;]|$)/dgu;
const proofObject=/\b(?:no se recibió|falta|se adjuntó|se verificó|se entregó) (?:el|la) (registro de (?:insumos|producción|ensayos)|ensayo de (?:dureza|tracción)|certificación de origen|acuse firmado)(?=[.,;]| para el lote[.]|$)/dgiu;
const batchNoun=/\b(?:certificación de origen|comprobante de pago|ficha técnica) para el (lote)(?=[.]|$)/dgu;
const workpiece=/\b(?:el|un) ((?:perfil|larguero|tramo) de (?:escalera|aluminio|acero)) (?:recibió|presenta|requiere|tiene) (?:tratamiento|templado|acabado)\b/dgiu;
const temper=/\b(?:tratamiento(?: térmico)?|templado|temple) (T[1-9](?:0)?)(?=[,. ;]|$)/dgu;
const incoterm=/\b(?:[Ii]ncoterm(?:s)?\s*[: ]|[Ff]actura (?:consigna|indica|establece) |[Cc]ondición de entrega\s*:\s*)\s*((?:EXW|FCA|FAS|FOB|CFR|CIF|CPT|CIP|DAP|DPU|DDP))(?=\s|[.,;]|$)/dgu;
// The noun must occupy the interrogative object or payment object. Field
// values, independent detections and longer overlapping spans still win.
const questionProof=/¿(?:[Qq]ué|[Cc]uál) (documento|prueba|comprobante|constancia|soporte) (?:pedirías|solicitarías|exigirías|acredita|demuestra|permite)\b/dgu;
const paymentObject=/\b(?:asumió|cubrió|pagó|liquidó|incluye) (?:el|la) (seguro|flete|transporte|prima|regalía)(?= (?:de|por|en)\b|[?.]|$)/dgu;
export function tradeTermRanges(text){
 const ranges=[];
 for(const pattern of [processSubject,processObject,proofObject,batchNoun,workpiece,temper,incoterm,questionProof,paymentObject]){
  for(const match of text.matchAll(pattern)){
   const [a,b]=match.indices[1];
   // A capitalised label may be a name. Temper and Incoterm codes are uppercase by convention.
   if(pattern!==temper&&pattern!==incoterm&&match[1]!==match[1].toLocaleLowerCase('es'))continue;
   ranges.push([a,b]);
  }
 }
 return ranges;
}

// Language that singles out one physical source is itself an indirect identifier.
const distinctiveOrigin=/\b(?:exclusiv[oa]s? del?|privativ[oa]s? del?|reservad[oa]s? (?:al?|para)|(?:asociad[oa]s?|vinculad[oa]s?) (?:única|exclusiva)mente (?:al?|con))\s+(?:la |el |las |los )?(?:mina|cantera|yacimiento|muelle|embarcadero|terminal|planta|fábrica|taller|laboratorio|estación|recinto|aduana|bodega|caseta)\b/giu;

// Commercial address fields can continue over several PDF lines. Require an
// address field or a street-and-number pattern, plus a nearby postal code
// for an unlabelled block. Keep offsets in the extracted UTF-16 string.
const addressField=/^[ \t]*(?:seller|shipper|consignee|verk[aä]ufer|verkaeufer|vendor address|registered address|ship (?:to|from)|bill to|address|domicilio(?: fiscal)?|direcci[oó]n(?: de entrega)?|endere[cç]o)[ \t]*:[ \t]*/iu;
const proseAddress=/\b(?:ubicad[oa] en|con domicilio en|enviad[oa] desde|con sede (?:en|in)|located at|registered at)\s+/iu;
const street=/\b(?:calle|avenida|av\.|calzada|carretera|boulevard|via|corso|rua|rue|building|street|lane|blvd|road|avenue|ave|drive|row|yard)\b|\p{L}{3,}(?:weg|gasse|strasse|straße|allee|laan)\b/iu;
const postal=/\b(?:\d{4,6}(?:[- ]\d{3,4})?|[A-Z]\d[A-Z][ -]?\d[A-Z]\d|[A-Z]{1,2}\d[A-Z\d]?\s+\d[A-Z]{2}|\d{3}-\d{4})\b/iu;
const newField=/^\s*[\p{L}][\p{L} .\/]{0,45}:|^\s*$/u;
const continuation=/^[ \t]*(?:col\.|colonia\b|int\.|interior\b|dept\.|suite\b|edif\.|C\.?\s*P\.?\s*\d|[\p{L}. -]{1,38}[ ,]+(?:[A-Z]{2}\s+)?\d{4,6}\b|\d{4,6}\s+\p{L})/iu;
const subsequentAction=/(?:\.\s+|,\s+|\s+)(?=(?:se\s+(?:solicita[n]?|requiere[n]?|adjunta[n]?|acompaña[n]?)|para\s+(?:la\s+)?(?:revisión|verificación)|remit(?:ir|a|imos)|solicitamos|adjunt(?:ar|e|amos)|confirm[oó]|confirmed|spedisce|por el proveedor)\b)/iu;
export function postalBlockRanges(text) {
 const lines=Array.from(text.matchAll(/[^\n]+/g),match=>({text:match[0],offset:match.index}));
 const ranges=[];
 for(let i=0;i<lines.length;i++){
  const line=lines[i],label=addressField.exec(line.text),prose=proseAddress.exec(line.text);
  const cue=label??prose;
  const start=cue?cue.index+cue[0].length:line.text.search(/\S/u);
  if(start<0)continue;
  const tail=line.text.slice(start);
  if(!label&&(!street.test(tail)||!/[0-9]/u.test(tail)||(!prose&&newField.test(line.text))))continue;
  let value=tail,limit=i;
  while(limit+1<lines.length&&limit<i+3) {
   const next=lines[limit+1];
   if(next.offset!==lines[limit].offset+lines[limit].text.length+1||newField.test(next.text)||!continuation.test(next.text))break;
   value+='\n'+next.text;
   limit++;
  }
  const action=subsequentAction.exec(value);
  const end=action? action.index:value.length;
  const block=value.slice(0,end).trimEnd();
  if(block&&!block.includes(';')&&(label||postal.test(block))) ranges.push([line.offset+start,line.offset+start+block.length]);
 }
 return ranges;
}

// Transport and invoice references can identify an operation even when they
// contain no personal name. Protect the value on later, unlabelled mentions too.
const referenceLabel=/(?<![\p{L}\p{N}])(?:contrato(?: de (?:transporte|compraventa|licencia))?|carta (?:de )?porte|orden de retorno|factura(?: comercial)?|invoice|conocimiento de embarque|bill of lading|b\/l|air waybill|booking(?: reference)?|reserva de embarque|contenedor|container|sello(?: de seguridad)?|seal)(?:[ \t]+(?:n[úu]m(?:ero)?\.?|no\.?|number|id))?[ \t]*[:#][ \t]*([a-z0-9]+(?:[./_-][a-z0-9]+)*)/dgiu;
// Headings such as “Guía de transporte N° 730-K:” identify an individual record.
// Require a documentary heading, a final code containing a digit, and the colon.
const documentHeading=/^(?:conocimiento de embarque|carta de porte|factura|p[oó]liza|declaraci[oó]n|manifiesto|gu[ií]a|certificado|albar[aá]n|contrato)(?:[ \t]+[\p{L}]{1,24}){0,6}?[ \t]+(?:n(?:[°.º]|[uú]m(?:ero)?[.]?)?[ \t]+)?([a-z\d][a-z\d._/-]{2,39})[ \t]*:/dgimu;
const entryNumber=/(?<![\p{L}\p{N}])(?:n[úu]m(?:ero)?\.?[ \t]+(?:de[ \t]+)?)?pedimento[ \t]*[:#][ \t]*(\d{2}[ \t-]+\d{2}[ \t-]+\d{4}[ \t-]+\d{7}|\d{15})(?!\d)/dgiu;
const containerNumber=/(?<![a-z\d])[a-z]{3}[ujz]\d{7}(?![a-z\d])/giu;

// In prose the cue and code often have no separating colon. Require a digit
// and a whole bounded token, so an ordinary request for a document stays readable.
const tradeCode=/(?<![\p{L}\p{N}])(?:carta (?:de )?porte|orden de retorno|contrato de transporte|lote|batch|lot|precinto|folio|viaje|voyage|orden de compra|purchase order|n[uú]mero de serie|serial number|IMO)(?:[ 	]+(?:n[úu]m(?:ero)?\.?|no\.?|number))?[ 	:#]+([a-z0-9]+(?:[-_/.][a-z0-9]+)*)(?![\p{L}\p{N}_/-])/dgiu;
const nameWord=String.raw`[\p{Lu}][\p{L}'’]*(?:-[\p{Lu}][\p{L}'’]*)*`;
const vesselName=new RegExp('(?:^|[^\\p{L}])(?:[Bb]uque|[Nn]ave|[Vv]essel|[Nn]avío)[ \t]+('+nameWord+'(?:[ \t]+(?:(?:de(?: la|l)?|of(?: the)?)[ \t]+)?'+nameWord+'){0,6})','dgu');
const datePart=String.raw`(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})`;
const timePart=String.raw`(?:[01]?\d|2[0-3]):[0-5]\d`;
const appointment=new RegExp(String.raw`(?:cita de (?:carga|descarga|entrega)|delivery appointment|(?:la )?(?:descarga|carga|entrega) se (?:program[oó]|realiz[oó]|confirm[oó]))[^.!?\n]{0,130}?(${datePart}[ \t]+(?:a las|at)[ \t]+${timePart}|${timePart}[ \t]+(?:del?|on)[ \t]+${datePart})`,'dgiu');

export function logisticsReferenceRanges(text){
 const values=new Set();
 for(const match of text.matchAll(documentHeading))if(/\d/u.test(match[1]))values.add(match[1]);
 for(const match of text.matchAll(referenceLabel)){
  const value=match[1];
  if(value.length>=4&&value.length<=80&&/\d/u.test(value))values.add(value);
 }
 for(const match of text.matchAll(tradeCode)){
  if(match[1].length>=3&&match[1].length<=80&&/\d/u.test(match[1]))values.add(match[1]);
 }
 for(const match of text.matchAll(vesselName))values.add(match[1]);
 for(const match of text.matchAll(appointment))values.add(match[1]);
 for(const match of text.matchAll(entryNumber))values.add(match[1]);
 const ranges=Array.from(text.matchAll(containerNumber),match=>[match.index,match.index+match[0].length]);
 for(const value of values){
  const literal=value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const repeated=new RegExp('(?<![a-z0-9])'+literal+'(?![a-z0-9])','giu');
  for(const match of text.matchAll(repeated))ranges.push([match.index,match.index+match[0].length]);
 }
 return ranges;
}

// A person, company or facility can be identifiable through an exclusive role
// or a spatial description. Keep the full clause together for local review.
const exclusiveParty=/(?<![\p{L}\p{N}])(?:[úu]nic[oa]|sol[oa]|only|sole)[ \t]+(?:persona|emplead[oa]|operador[a]?|representante|responsable|titular|agente|importador[a]?|exportador[a]?|proveedor[a]?|distribuidor[a]?|taller|f[aá]brica|planta|laboratorio|empresa|concesionari[oa]|operator|agent|supplier|plant|laboratory|distributor)\b/giu;
const facility=/(?<![\p{L}\p{N}])(?:(?:primer[oa]?|segund[oa]|tercer[oa]?|cuart[oa]|quint[oa]|last|first|second|third)[ \t]+)?(?:m[oó]dulo|bodega|muelle|almac[eé]n|nave|patio|caseta|dock|warehouse|shed)[ \t]+(?:detr[aá]s de|al lado de|junto a|frente a|colindante con|behind|next to|beside)\b/giu;
const specificPlace=new RegExp(String.raw`(?:^|[^\p{L}])(?:en|desde|hacia|hasta|por) (?:el |la )?((?:[Pp]uerto|[Tt]erminal|[Rr]ecinto|[Ss]ector|[Mm]uelle|[Cc]iudad) de(?:l | la | las | los | )`+nameWord+'(?:[ \t]+'+nameWord+'){0,4})','dgu');
const movement=/\b(?:carga|envío|embarque|mercancía|tránsito|remesa|entrega|recepción|despachad[oa]|descarga)\b/iu;
// A building can identify a shipment by appearance alone, even with no
// proper name. Require a spatial construction and an architectural modifier.
const landmark=/\b(?:frente a|junto a|detrás de|al lado de|a espaldas de|a la (?:salida|entrada) de|por|desde|hasta|en)\s*(?:l\b|\s+(?:la|el|los|las)\b)\s+((?:nave|pabellón|caseta|garita|bodega|puente|torre|chimenea|mirador|portón|patio|andén|muelle|almacén|cobertizo|aljibe|arco|embarcadero)\s+(?:del?\s+|con\s+|en forma de\s+|pintad[oa]\s+)[^.!?;\n]{1,180})/dgiu;
const event=/\b(?:durante|tras|después de|antes de|al (?:terminar|concluir|comenzar)|coincidió con)(?:\s+(?:el paso|la clausura|el cierre|la apertura) de)?\s+(?:la|el|las|los)\s+((?:fiesta|feria|festival|desfile|velada|procesión|romería|verbena|carnaval|ceremonia)\s+(?:(?:anual|local|patronal)\s+)?de(?:l| la| las| los)?\s+[^.!?;\n]{1,180})/dgiu;
// An observable signal can date an operation without giving a clock time.
const audibleEvent=/\b(?:cuando|mientras|en cuanto|justo (?:antes|después) de(?:l)?|al oír(?:se)?)\s+((?:(?:se )?(?:oyó|oyeron|escuchó|escucharon|sonó|sonaron|repicó|repicaron)\b|(?:el |la |los |las )?(?:(?:primer|primera|último|última) )?(?:repique|campanada|tañido|silbido|toque|sirena|carillón)\b)[^.!?;\n]*)/dgiu;
// A restrictive clause can identify a site through a local practice even if
// the facility has no proper name. Require both exclusivity and a specific site.
const sitePractice=/\bque (?:s[oó]lo |[uú]nicamente |exclusivamente )?se (?:usa|emplea|utiliza|practica|fabrica|realiza)(?:n)? (?:s[oó]lo |[uú]nicamente |exclusivamente )?en (?:es[ae]|aquel(?:la)?) (?:rampa|muelle|bodega|planta|taller|estaci[oó]n|terminal|recinto|almac[eé]n|patio)\b/iu;
const exclusive=/\b(?:s[oó]lo|[uú]nicamente|exclusivamente)\b/iu;
export function contextualIdentityRanges(text){
 const ranges=[];
 for(const cue of [landmark,event,audibleEvent]){
  for(const match of text.matchAll(cue)){
   const [start]=match.indices[1];
   const stop=text.slice(start).search(/[.!?;\n]/u);
   ranges.push([start,stop<0?text.length:start+stop]);
  }
 }
 for(const sentence of new Intl.Segmenter('es',{granularity:'sentence'}).segment(text)){
  const practice=sitePractice.exec(sentence.segment);
  if(practice&&exclusive.test(practice[0])){
   const clause=sentence.segment.trimEnd();
   ranges.push([sentence.index,sentence.index+clause.length]);
  }
  if(!movement.test(sentence.segment))continue;
  for(const m of sentence.segment.matchAll(specificPlace))ranges.push(m.indices[1].map(n=>sentence.index+n));
 }
 for(const cue of [exclusiveParty,facility,distinctiveOrigin]){
  for(const match of text.matchAll(cue)){
   const start=match.index;
   const tail=text.slice(start+match[0].length);
   const boundary=tail.search(/[.!?;\n]/u);
   const end=start+match[0].length+(boundary<0?tail.length:boundary);
   ranges.push([start,end]);
  }
 }
 return ranges;
}

// Preserve a directly labelled value as an independent reference when a
// contextual mask also covers the surrounding sentence.
export function tradeDocumentAnchorValues(text){
 const ranges=[...labelledIdentityRanges(text),...logisticsReferenceRanges(text)];
 return [...new Set(ranges.map(([start,end])=>text.slice(start,end)))];
}

// Select the vocabulary for the local reader only. This is not a determination of regime.
export function describesEquipmentReturn(text){
 return /\b(?:reparaci[oó]n|reparad[oa]s?|sustituci[oó]n|reemplazo|retorno de|cambi[oó] (?:una|la) (?:pieza|v[aá]lvula)|volvi[oó] (?:la misma|el mismo))\b/iu.test(text);
}

// Keep an already concealed branded model name addressable inside a larger
// mask. A mixed-case word such as a manufacturer's coined name is distinctive.
export function isProductAlias(value){
 return typeof value==='string'&&value.length<=90&&/^\p{Lu}[\p{L}\p{N}-]*(?: [\p{L}\p{N}-]+){0,3}$/u.test(value)&&/\p{Ll}\p{Lu}/u.test(value);
}
