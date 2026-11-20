// Local model sees numbered sentences. It can add protection only by selecting
// an existing sentence, never by supplying replacement text or guessed offsets.
const instructions='Audita exclusivamente la identificación indirecta en un extracto ficticio de comercio. Recibes oraciones numeradas. Selecciona los números de oraciones en que alguien podría reconocer un embarque, parte, recinto o persona por su entorno: función exclusiva o turno distintivo, ubicación relativa o hito local, cita o momento preciso de la operación, combinación poco común o vínculo con un acontecimiento identificable. No marques una oración sólo por datos directos como nombre, folio, lote, buque o un número de serie: ya se procesaron. Una fecha normativa o un hecho genérico no basta. Responde JSON {"oraciones":[...]} con identificadores de la lista, sin texto literal.';

export async function reviewContextLocally(text,ask,signal){
 const segments=Array.from(new Intl.Segmenter('es',{granularity:'sentence'}).segment(text),
  s=>({id:s.index,text:s.segment.trimEnd()})).filter(s=>s.text.trim());
 const ranges=[];
 let batch=[],size=0;
 async function classify(){
  const allowed=new Map(batch.map(s=>[s.id,s]));
  const format={type:'object',additionalProperties:false,required:['oraciones'],properties:{
   oraciones:{type:'array',items:{type:'integer',enum:[...allowed.keys()]},maxItems:batch.length},
  }};
  const result=await ask(instructions,JSON.stringify(batch),format,256);
  if(!result||Object.keys(result).length!==1||!Array.isArray(result.oraciones)||result.oraciones.length>batch.length||
     new Set(result.oraciones).size!==result.oraciones.length||!result.oraciones.every(id=>allowed.has(id)))throw Error('Resultado ambiguo.');
  for(const id of result.oraciones)ranges.push([id,id+allowed.get(id).text.length]);
 }
 try{
  for(const sentence of segments){
   if(sentence.text.length>3800)throw Error('Oración demasiado larga.');
   if(batch.length&&(batch.length>=24||size+sentence.text.length>3800)){
    await classify();batch=[];size=0;
   }
   batch.push(sentence);size+=sentence.text.length;
  }
  if(batch.length)await classify();
  return {ranges,available:true};
 }catch{
  signal?.throwIfAborted();
  return {ranges,available:false};
 }
}
