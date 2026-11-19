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
 const fieldLines=/\n(?=[ \t]*(?:cliente|asunto|proveedor|razón social|nombre del proveedor|correo de contacto|contacto|mercancía|operación|constancia|documentación|encargo|país de origen|unidad de medida)\s*:)/giu;
 const starts=[...new Set([0,...Array.from(text.matchAll(postalSentence),m=>m.index+m[0].length),
  ...Array.from(text.matchAll(fieldLines),m=>m.index+1)])].sort((a,b)=>a-b);
 return starts.map((start,i)=>({start,text:text.slice(start,starts[i+1]??text.length)}));
}

export function labelledIdentityRanges(text) {
 return Array.from(text.matchAll(/^(?:cliente|asunto|proveedor|razón social|nombre del proveedor|correo de contacto|contacto|exportador|importador)[ \t]*:[ \t]*([^\n;]{2,200})$/dgimu)).filter(m=>!/[.!?]\s+\p{Lu}\p{Ll}{2}/u.test(m[1])).map(m=>m.indices[1]);
}

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
