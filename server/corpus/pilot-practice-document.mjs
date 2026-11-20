import {randomBytes} from 'node:crypto';
import {openReviewedDocument} from '../privacy/intake-document-map.mjs';
const parties=['Cobre Ámbar','Mirto Jade','Olmo Índigo','Sauce Turquesa','Junco Azul','Arce Nácar','Lino Coral','Cedro Lila'];
const goods=['bombas de agua','piezas de cerámica','válvulas de riego','telas de algodón'];
const homes=['Canadá','Estados Unidos','México'];
const choose=(list,n)=>list[n%list.length];
export const newPracticeSeed=()=>randomBytes(12).toString('hex');
export function practiceDocument(seed) {
 if(typeof seed!=='string'||!/^[0-9a-f]{24}$/.test(seed))throw Error('Ejercicio de práctica no verificable.');
 const b=Buffer.from(seed,'hex'),origin=b[0]%2===0;
 const client='Comercial '+choose(parties,b[1])+' Ficticia';
 const supplier='Taller '+choose(parties,b[2])+' de Ensayo';
 const title=(origin?'Origen':'Cupo')+' de práctica '+b.subarray(3,6).toString('hex');
 const email='contacto.'+b.subarray(6,9).toString('hex')+'@example.test';
 const product=choose(goods,b[9]);
 const facts=origin?[
  'El ejercicio trata de la importación de '+product+' ensambladas en '+choose(homes,b[10])+'.',
  choose(['Falta la información sobre los insumos.','El expediente contiene una ficha sobre el proceso de fabricación.'],b[11]),
 ]:[
  'Se solicita revisar un cupo para importar '+product+'.',
  choose(['El expediente incluye una solicitud de asignación.','Falta la constancia de asignación.'],b[11]),
 ];
 const text=['Cliente: '+client,'Asunto: '+title,'Proveedor: '+supplier,'Contacto: '+email,'Operación: '+facts[0],'Constancia: '+facts[1]].join('\n');
 return {text,client,title,supplier,email,facts,article:origin?'9':'23'};
}

// The complete decoded text must reproduce a locally generated exercise. No
// uploaded file or browser assertion establishes this provenance. The marker
// coverage and retention checks are independent of Ollama's suggestions.
export function protectedPracticeFacts(seed,document,firmId,matterId) {
 const example=practiceDocument(seed);
 const verified=openReviewedDocument(document,firmId,matterId);
 if(verified.original!==example.text)throw Error('El soporte no coincide con el ejercicio generado.');
 const entries=document.snapshot.entries;
 let outbound=document.protectedText;
 const roles=new Map(),localTokens=[];
 for(const [index,entry] of entries.entries()){
  const publicToken='[[PARTE_'+(index+1)+']]';
  roles.set(entry.text,publicToken);
  localTokens.push(Object.freeze({publicToken,localToken:verified.tokens[index].token}));
  outbound=outbound.replaceAll(entry.marker,publicToken);
 }
 const lines=outbound.split('\n');
 for(const [index,[caption,original]] of [
  ['Cliente',example.client],['Asunto',example.title],['Proveedor',example.supplier],['Contacto',example.email],
 ].entries()){
  if(!roles.has(original)||lines[index]!==caption+': '+roles.get(original)||outbound.includes(original))
   throw Error('Quedó una identidad sin cubrir en el ejercicio.');
 }
 // Match the actual protected sentences against the locally generated originals.
 // A partial mask can cover more than a product or country. Keep it while
 // requiring enough visible information to discuss both the operation and its evidence.
 const captions=['Operación: ','Constancia: '];
 const cues=example.article==='9'?[/importación|ensambladas/u,/insumos|fabricación/u]:[/cupo|importar/u,/asignación/u];
 const byPublicToken=new Map(entries.map((entry,i)=>[localTokens[i].publicToken,entry.text]));
 if(lines.length!==6)throw Error('Faltan hechos de la operación después de la sustitución.');
 const facts=captions.map((caption,i)=>{
  const line=lines[4+i];
  if(!line.startsWith(caption))throw Error('Faltan hechos de la operación después de la sustitución.');
  const fact=line.slice(caption.length);
  const restored=fact.replace(/\[\[PARTE_\d+\]\]/g,token=>byPublicToken.get(token)??'');
  if(restored!==example.facts[i]||!cues[i].test(fact))throw Error('Faltan hechos de la operación después de la sustitución.');
  return fact;
 });
 return {example,outbound,provider:roles.get(example.supplier),facts,localTokens};
}
