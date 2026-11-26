// Local editorial display only. Never change the pinned quote or provider prompt.
const pdfSha256='bcdfcd9073014aec4aefbacc01c9dd5b1f97f0da0c4556f0f506d20f12d77812';
const id='MX-FED-REG-LADUA-117';
const literal='36- A';
const message='En la página 42 del PDF, la referencia 36-A está partida entre dos líneas: 36- al final y A al inicio de la siguiente. La cita conserva el texto extraído 36- A. Esta nota de lectura no modifica la fuente ni verifica su vigencia.';
export function regulationReadingNotes(article,text){
 if(article!=='117')return undefined;
 const start=text.indexOf(literal);
 if(start<0||start!==text.lastIndexOf(literal))throw Error('La referencia partida del Reglamento requiere cotejo.');
 return Object.freeze([Object.freeze({kind:'line-break-reading',pdfSha256,page:42,start,end:start+literal.length,literal,reading:'36-A',message})]);
}
export function renderedRegulationReadingNotes(refs){
 const found=new Set();
 for(const ref of refs){
  if(ref?.id!==id||ref.pdfSha256!==pdfSha256)continue;
  for(const note of ref.readingNotes??[]){
   if(note.kind==='line-break-reading'&&note.pdfSha256===pdfSha256&&note.page===42&&note.literal===literal&&note.reading==='36-A'&&note.message===message&&ref.text.slice(note.start,note.end)===literal)found.add(message);
  }
 }
 return [...found].map(text=>'Nota editorial de lectura · Reglamento, artículo 117\n'+text);
}
