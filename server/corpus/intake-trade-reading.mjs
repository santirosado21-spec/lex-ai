// Research topics are public and identical for every matter. Text matching and
// documentary evidence stay in the local process. Only the two pinned passages
// and the chosen public topic are available to the cloud request builder.
import {customsLawId,customsPassage,customsEditionWarnings} from './customs-edition.mjs';
import {loadResearchPassage} from './intake-research.mjs';
import {proposedQuestions} from './trade-pilot-grounding.mjs';

const lce='MX-FED-LCE';
const topics=[
 {key:'valoracion',title:'Valoración en aduana',terms:['valor en aduana','valoración aduanera','valor de transacción','incrementables','precio pagado','regalías'],articles:[[customsLawId,'64'],[customsLawId,'65']]},
 {key:'pedimento',title:'Pedimento y anexos de importación',terms:['pedimento','pedimentos','anexos al pedimento','acuse de validación'],articles:[[customsLawId,'36'],[customsLawId,'36-A']]},
 {key:'origen',title:'Reglas de origen',terms:['regla de origen','reglas de origen','certificación de origen','certificado de origen','trato preferencial'],articles:[[lce,'9'],[lce,'10']]},
 {key:'cupos',title:'Cupos y asignación',terms:['cupo','cupos','arancel-cupo','constancia de asignación'],articles:[[lce,'23'],[lce,'24']]},
 {key:'restricciones',title:'Regulaciones y restricciones no arancelarias',terms:['regulación no arancelaria','restricciones no arancelarias','regulaciones no arancelarias','permiso previo','permisos previos'],articles:[[lce,'17'],[lce,'20']]},
 {key:'clasificacion',title:'Clasificación de mercancías',terms:['clasificación arancelaria','fracción arancelaria','fracciones arancelarias','nomenclatura arancelaria'],articles:[['MX-FED-LIGIE_2022','2'],[lce,'20']]},
 {key:'precios',title:'Discriminación de precios',terms:['dumping','discriminación de precios','valor normal'],articles:[[lce,'28'],[lce,'30']]},
 {key:'subvenciones',title:'Subvenciones',terms:['subvención','subvenciones'],articles:[[lce,'28'],[lce,'37']]},
 {key:'salvaguardas',title:'Medidas de salvaguarda',terms:['salvaguarda','salvaguardas'],articles:[[lce,'45'],[lce,'49']]},
];
const trusted=new WeakSet();
const normal=s=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
const matchers=topics.map(topic=>new RegExp('(?<![\\p{L}\\p{N}])(?:'+topic.terms.map(normal).join('|')+')(?![\\p{L}\\p{N}])','u'));
const identity=/^\s*(?:cliente|asunto|proveedor|exportador|importador|contacto|razon social|correo|domicilio)\s*:/u;

export function suggestTradeReadings(original) {
 const lines=original.split('\n');
 const suggestions=[];
 topics.forEach((topic,index)=>{
  for(const [lineNumber,line] of lines.entries()){
   const search=normal(line);
   if(identity.test(search))continue;
   const match=matchers[index].exec(search);
   if(!match)continue;
   // The excerpt always comes from the original. Bound it by Unicode code
   // points and find the match again on the original if normalization changes offsets.
   let center=0,length=0;
   for(const character of line){
    if(length>=match.index)break;
    length+=normal(character).length;
    center++;
   }
   const characters=Array.from(line);
   const start=Math.max(0,center-100);
   const excerpt=characters.slice(start,start+320).join('').trim();
   suggestions.push({id:'lectura-'+topic.key,title:topic.title,line:lineNumber+1,excerpt});
   break;
  }
 });
 return suggestions;
}

// Each choice is an exact substring of one pinned passage. Long sentences
// are split on punctuation or a word boundary, with the full passage in the UI.
function citationChoices(text,prefix){
 const choices=[];
 for(const {segment} of new Intl.Segmenter('es',{granularity:'sentence'}).segment(text)){
  let rest=segment.trim();
  while(rest.length>=24){
   let end=rest.length;
   if(end>300){
    const head=rest.slice(0,300);
    const punctuation=Math.max(head.lastIndexOf('; '),head.lastIndexOf(', '));
    end=punctuation>=100?punctuation+1:head.lastIndexOf(' ');
    if(end<=0)break;
   }
   const quote=rest.slice(0,end).trim();
   if(quote.length>=24)choices.push(Object.freeze({key:prefix+(choices.length+1),quote}));
   rest=rest.slice(end).trimStart();
  }
 }
 if(!choices.length)throw Error('El pasaje requiere una revisión de sus fragmentos.');
 return Object.freeze(choices);
}

// Absence of the optional general index is distinct from a corrupt or wrong
// source. This only describes dependencies; loadTradeReading still verifies them.
export function tradeReadingNeedsLibrary(task){
 const topic=topics.find(item=>'lectura-'+item.key===task);
 if(!topic)throw Error('Tema de revisión desconocido.');
 return topic.articles.some(([lawId])=>lawId!==customsLawId);
}

export function loadTradeReading(library,task) {
 const topic=topics.find(item=>'lectura-'+item.key===task);
 if(!topic)throw Error('Tema de revisión desconocido.');
 const sources=topic.articles.map(([lawId,articleId],index)=>{
  const prefix=index?'B':'A';
  if(lawId===customsLawId){
   const {ref,passages}=customsPassage(articleId);
   return {ref,choices:Object.freeze(passages.map((p,i)=>Object.freeze({...p,key:prefix+(i+1)})))};
  }
  const source=library?.lookupArticle({lawId,articleId});
  const ref=loadResearchPassage(library,source?.sourceId,0).ref;
  if(ref.id!==lawId+'-'+articleId)throw Error('La referencia no coincide con la selección.');
  return {ref,choices:citationChoices(ref.text,prefix)};
 });
 const refs=sources.map(source=>source.ref);
 const choices=Object.freeze(sources.map(source=>source.choices));
 const prompt='Prepara dos preguntas de revisión documental sobre '+topic.title+'. Selecciona el fragmento más pertinente de cada fuente. En pasaje escribe su clave exacta, por ejemplo A1 o B1. En solicitud formula una pregunta breve sobre una prueba documental, entre ¿ y ?, con letras y espacios. Evita conclusiones sobre el cliente, la vigencia, los plazos o las cuotas. Devuelve sólo JSON con claves A y B. Cada valor contiene pasaje y solicitud. Si la fuente es insuficiente, usa null para esa clave.\n\n'+refs.map((ref,i)=>(i?'B':'A')+' · '+ref.id+' · '+ref.title+'\n'+ref.locator+'\n'+ref.url+'\n'+choices[i].map(item=>item.key+' | '+(item.locator?item.locator+' | ':'')+item.quote).join('\n')).join('\n\n');
 const reading=Object.freeze({task,title:topic.title,prompt,refs:Object.freeze(refs),choices});
 trusted.add(reading);
 return reading;
}

export function tradeReadingEnvelope(reading){
 if(!trusted.has(reading))throw Error('Lectura sin procedencia verificada.');
 return {version:1,responseFormat:'json',messages:[{role:'user',content:reading.prompt}]};
}

export function renderTradeReading(raw,reading){
 let result;
 try{result=JSON.parse(raw);}catch{result=null;}
 const sections=reading.refs.map((ref,i)=>{
  const pair=result?.[i?'B':'A'];
  const choice=reading.choices[i].find(item=>item.key===pair?.pasaje);
  const quote=choice?.quote;
  const title='['+ref.id+']';
  if(!quote||Object.keys(pair).some(key=>!['pasaje','solicitud'].includes(key))||!ref.text.includes(quote)||/\[\[|\]\]/u.test(quote))
   return title+'\nFundamento pendiente de cotejo.';
  const question=proposedQuestions(pair.solicitud);
  return title+(choice.locator?' · '+choice.locator:'')+'\n'+quote+(choice.condition?'\nCondición de la fracción I\n'+choice.condition:'')+(question?'\n'+(choice.locator?question.split('\n')[0]:question):'');
 });
 return reading.title+' para [[CLIENTE]] · [[ASUNTO]]\n\nSoporte del expediente\n[[SOPORTE]]\n\n'+sections.join('\n\n')+customsEditionWarnings(reading.refs).map(text=>'\n\nAdvertencia de la copia consultada\n'+text).join('')+'\n\nRevisar la edición aplicable y los transitorios a la fecha de la operación.';
}
