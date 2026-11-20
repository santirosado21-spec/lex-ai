// The local reader may identify a clue by quoting a clause. It cannot supply
// an offset or change the text. If only the sentence ID is reliable, hide the
// whole cited sentence. A malformed or incomplete review fails upstream.
const cue = /\b(?:incidente|siniestro|percance|accidente|acontecimiento|rastro|residuo[s]?|vestigio[s]?|huella[s]?|seña[s]?|marca distintiva|fragmento|material orgánico|ceniza[s]?|sedimento[s]?|pátina|ubicaci[oó]n|localidad|región|instalación|sitio|alrededores|entorno|hito|ruta|cercan[oa]|vecindad|recinto|patio|muelle|ubicad[oa]|colindante|ruinas?|señal|aroma|olor|sonido|vibración|destello|punto de referencia)\b/iu;
const logistics = /\b(?:carga(?:mento)?|embarque|transporte|cajas?|envases?|embalajes?|contenedores?|lote|insumos?|despacho|instalación|almac[eé]n|operaci[oó]n|recepci[oó]n|exportaci[oó]n|importaci[oó]n|certifica\w*)\b/iu;

export function needsShipmentContext(text) {
 return cue.test(text) && logistics.test(text);
}
const groups=['lugares','huellas','sucesos'];
const prompt='Identifica indicios indirectos en un expediente de comercio exterior. Cada elemento tiene id y texto. Para lugares copia la descripción completa de un punto reconocible o su procedencia. Para huellas copia una seña observable de un cargamento o recinto, incluidos material, color, olor o forma cuando el relato los usa para reconocerlo. Para sucesos copia un acontecimiento particular y la referencia espacial o temporal asociada. En cada objeto devuelve el id existente y el fragmento literal completo que lo revela, con sus complementos. Si no existe tal indicio devuelve una lista vacía. Una operación ordinaria y una característica técnica de la mercancía por sí solas no identifican. Conserva aparte pagos, preguntas, clasificación, procesos y condiciones comerciales.';

export async function reviewShipmentContext(batch,ask) {
 // Restrict this additional pass to descriptive clauses. A small reader can
 // incorrectly label every input as a location when asked to fill several lists.
 const candidates=[];
 for(const segment of batch){
  for(const part of segment.text.matchAll(/[^,;\n]+/gu)){
   if(cue.test(part[0]))candidates.push({id:segment.id+part.index,text:part[0]});
  }
 }
 if(!candidates.length)return [];
 const ranges=[];
 for(let first=0;first<candidates.length;first+=16)ranges.push(...await reviewClues(candidates.slice(first,first+16),ask));
 return ranges;
}
async function reviewClues(candidates,ask){
 const byId=new Map(candidates.map(s=>[s.id,s.text]));
 const item={type:'object',additionalProperties:false,required:['id','fragmento'],properties:{
  id:{type:'integer',enum:[...byId.keys()]},fragmento:{type:'string',minLength:1,maxLength:1024}
 }};
 const list={type:'array',maxItems:24,items:item};
 const format={type:'object',additionalProperties:false,required:groups,properties:Object.fromEntries(groups.map(group=>[group,list]))};
 const answer=await ask(prompt,JSON.stringify(candidates),format,850);
 if(!answer||Object.keys(answer).length!==groups.length||!groups.every(group=>Array.isArray(answer[group])&&answer[group].length<=24))throw Error('Falta parte de la revisión local.');
 const ranges=[];
 for(const group of groups)for(const row of answer[group]){
  if(!row||Object.keys(row).length!==2||!byId.has(row.id)||typeof row.fragmento!=='string')throw Error('Indicio sin origen comprobable.');
  const source=byId.get(row.id),phrase=row.fragmento.trim();
  if(phrase.length<2||phrase.length>1024||!source.includes(phrase)){
   ranges.push([row.id,row.id+source.length]);continue;
  }
  for(let index=source.indexOf(phrase);index>=0;index=source.indexOf(phrase,index+1))
   ranges.push([row.id+index,row.id+index+phrase.length]);
 }
 return ranges;
}
