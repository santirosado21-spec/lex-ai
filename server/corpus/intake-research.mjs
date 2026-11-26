import {renderedRegulationReadingNotes} from './regulation-reading-notes.mjs';
import {productOriginId,productOriginRef} from './product-origin.mjs';
import {producerPrompt,producerNote} from './producer-comparison.mjs';
import {originAnnexId,originAnnexRef} from './origin-annex.mjs';
import {regulationFocusText} from './regulation-search.mjs';
import {returnIdentityInquiry} from './return-context.mjs';
import {remedyReference} from './remedy-index.mjs';
import {questionFactTexts} from './intake-question-facts.mjs';
import {selectedConcepts} from './question-concepts.mjs';
import {customsPassage,regulationPassage,customsEditionWarnings} from './customs-edition.mjs';
import {nicoRow,nicoReference} from './nico-index.mjs';
// The browser chooses a row and a passage. The local service reads every outbound
// character from the pinned public index. Search terms and matter fields stay local.
import {createHash} from 'node:crypto';
import {tariffReference,tariffResult} from './tariff-index.mjs';
import {getPinnedPublicSource} from '../public-library.mjs';
import {proposedQuestions} from './trade-pilot-grounding.mjs';

const indexHash = 'ec944a19d40be5faa0bd0ee081e906145038446aa8df394b706adc2daddd1588';
export const angles=Object.freeze({
 requisitos:'Requisitos para aplicar la disposición',
 excepciones:'Excepciones y condiciones de aplicación',
 documentos:'Documentos para acreditar los hechos',
});
const verified = new WeakSet();

export function loadResearchPassage(library, sourceId, part) {
  if (typeof sourceId !== 'string' || !/^PUB-[a-f0-9]{64}$/.test(sourceId) ||
      !Number.isInteger(part) || part < 0) throw Error('Selecciona un artículo de la edición verificada.');
  const row = getPinnedPublicSource(library,indexHash,sourceId);
  if (!row || row.sourceId !== sourceId || row.category !== 'official-public-legislation' ||
      createHash('sha256').update(row.text).digest('hex') !== row.textSha256) throw Error('Fuente pública no verificable.');
  // Each passage is an exact substring. Bound material sent without dropping the
  // rest of a long article: the reader can select any of its subsequent passages.
  const passages = [];
  for (let start = 0; start < row.text.length;) {
    let end = Math.min(start + 1600, row.text.length);
    if (end < row.text.length) {
      const stop = row.text.lastIndexOf('. ', end - 1);
      const space = row.text.lastIndexOf(' ', end - 1);
      if (stop >= start + 650) end = stop + 1;
      else if (space > start) end = space;
      else if (/[\uD800-\uDBFF]/u.test(row.text[end - 1])) end--;
    }
    passages.push(row.text.slice(start, end).trim());
    start = end;
  }
  if (part >= passages.length) throw Error('El pasaje solicitado no existe.');
  const text = passages[part];
  const title = row.title;
  const locator = 'Artículo ' + row.article + ' · pasaje ' + (part + 1) + ' de ' + passages.length + ' · pp. ' + row.pages.join(', ') + ' · edición ' + row.version;
  const ref = Object.freeze({id:row.lawId + '-' + row.article,sourceId,title,locator,article:row.article,url:row.url,text,textSha256:row.textSha256,pdfSha256:row.pdfSha256,
    checkedOn:row.retrievedAt.slice(0,10),summary:'Revisar vigencia, transitorios y aplicación a los hechos.'});
  const prompt = 'Examina este pasaje de legislación federal para preparar una nota de revisión documental. Selecciona una cita literal continua del pasaje de entre 24 y 420 caracteres que permita formular una pregunta útil. En solicitud escribe UNA pregunta documental breve en español de hasta 120 caracteres entre ¿ y ?. Pregunta por una prueba o un hecho concreto. Usa sólo letras y espacios dentro de la pregunta. Omite nombres, citas, cifras y referencias normativas. No emitas una conclusión sobre el cliente, tasas, plazos o vigencia. Devuelve sólo JSON con "cita" y "solicitud". Si falta fundamento, devuelve {"abstener":true}.\n' +
    title + '\n' + locator + '\n' + row.url + '\n' + text;
  const note = Object.freeze({task:'research-' + sourceId.slice(4) + '-' + part,
    title:'Art. ' + row.article + ' · ' + row.lawId.replace('MX-FED-', '') + (passages.length > 1 ? ' · pasaje ' + (part + 1) : ''),
    part, count:passages.length, ref, prompt});
  verified.add(note);
  return note;
}

function questionSource(library,sourceId,part){
 let ref,condition,body;
 if(sourceId===productOriginId){
  ref=productOriginRef(sourceId,part);body=ref.text;
 }else if(sourceId===originAnnexId){
  ref=originAnnexRef(sourceId,part);body=ref.text;
 }else if(typeof sourceId==='string'&&sourceId.startsWith('ad29-')){
  ref=remedyReference(sourceId,part);body=ref.text;
 }else if(typeof sourceId==='string'&&/^(aduana|reg-aduana)-/.test(sourceId)){
  const source=sourceId.startsWith('reg-aduana-')?regulationPassage(sourceId.slice(11)):customsPassage(sourceId.slice(7));
  if(!Number.isInteger(part)||part<0||part>=source.passages.length)throw Error('Pasaje aduanero inválido.');
  const passage=source.passages[part];
  condition=passage.condition;body=passage.full?undefined:passage.quote;
  const exact=passage.reference??source.ref;
  ref=Object.freeze({...exact,text:passage.quote+(condition?'\n\n'+condition:''),locator:passage.locator+' · '+exact.locator});
 }else ref=loadResearchPassage(library,sourceId,part).ref;
 return Object.freeze({ref,body,condition});
}

export function questionPassage(library,{sourceId,part,angle,concepts=[],second,equipmentIdentity=false,regulationFocus,compareProducers=false},caseFacts){
 if(!Object.hasOwn(angles,angle))throw Error('Selecciona el enfoque jurídico.');
 const first=questionSource(library,sourceId,part);
 const {ref,body,condition}=first;
 const other=second?questionSource(library,second.sourceId,second.part):null;
 if(other&&other.ref.id===ref.id)throw Error('Para relacionar fundamentos, elige dos disposiciones distintas.');
 const labels=selectedConcepts(concepts,other?ref.text+' '+other.ref.text:ref.text);
 const focus=labels.length?' · '+labels.join(', '):'';
 const title=angles[angle]+' · '+ref.title+(ref.article?' · art. '+ref.article:'');
 const facts=caseFacts?questionFactTexts(caseFacts):[];
 if(compareProducers){
  if(sourceId!==originAnnexId||part!==4||other||facts.length||caseFacts?.localCount!==2||caseFacts.evidence.additional.length!==1)throw Error('Selecciona una línea de la certificación y otra del registro.');
  const note=Object.freeze({title:'Cotejo de productores · T-MEC',ref,body,caseFacts,compareProducers:true,prompt:producerPrompt(ref)});
  verified.add(note);return note;
 }
 const identity=equipmentIdentity===true&&sourceId==='aduana-117';
 const identityPrompt=identity?' '+returnIdentityInquiry+' Examina la cuestión como hipótesis. Distingue cambiar una pieza de reemplazar el equipo completo. Propón cómo cotejar la identidad con documentos de salida y de retorno. La coincidencia de folios por sí sola no prueba identidad. No presupongas que hubo exportación ni reparación.':'';
 const regulationReading=sourceId.startsWith('reg-aduana-')&&!body;
 const annexReading=sourceId===originAnnexId||sourceId===productOriginId;
 const selectedText=regulationReading?regulationFocusText(ref.text,regulationFocus):ref.quote??'';
 const publicFocus=selectedText?'\n\nPasaje público relacionado con la pregunta. Copia la cita de este fragmento. Explica qué dato o acto específico exige y cómo comprobarlo. Conserva las condiciones del artículo completo.\n'+selectedText:'';
 const regulationInstruction='En lectura explica en una o dos oraciones de 40 a 300 caracteres qué permite comprobar la disposición y qué falta acreditar. Respeta sujetos, excepciones y condiciones. Si el artículo figura derogado, indica esa situación y pide verificar la fecha de la operación. Escribe sin cifras ni nombres de partes. Devuelve JSON con lectura, cita';
 const productInstruction=sourceId===productOriginId&&part===1?' Distingue la fracción específica mexicana de la regla general de la subpartida. Indica qué soporte de composición o clasificación permite decidir cuál examinar. No extiendas los umbrales de la regla general a la fracción específica. La tabla corresponde al SA de la edición publicada.':sourceId===productOriginId?' Trabaja sólo con el renglón citado de la edición de dos mil veinte. Pide las clasificaciones y los soportes para cotejar el cambio descrito. La aplicación de notas, excepciones y reformas queda pendiente.':'';
 const responseSpec=identity?'En lectura explica qué evidencia permitiría distinguir esos supuestos en una o dos oraciones de 40 a 300 caracteres sin nombres, cifras ni conclusiones sobre el expediente. Devuelve JSON con lectura, cita':facts.length?'En lectura explica en una o dos oraciones qué permiten comprobar los hechos o qué contradicción requiere aclaración. Escribe de 40 a 300 caracteres sin cifras, nombres, nuevas citas o conclusiones de cumplimiento. Si los hechos no guardan relación con el pasaje, abstente. Devuelve JSON con lectura, cita':(regulationReading||annexReading)?regulationInstruction:'Devuelve JSON con cita';
 const factBlock=facts.length?'\n\nHechos del ejercicio elegidos por el abogado\n'+facts.map((fact,i)=>'H'+(i+1)+' · '+fact).join('\n'):'';
 const matrixReading=annexReading&&ref.point===4&&caseFacts?.producerComparison;
 const inquiry=caseFacts?.inquiry?'\n\nPregunta del abogado con referencias sustituidas\n'+caseFacts.inquiry+(matrixReading?'\nResponde a la pregunta y usa su marcador para identificar el asunto.':'\nResponde a esa pregunta en la lectura, copia cada marcador de la pregunta y señala qué dato debe aclararse.'):'';
 const matrixAdvice=matrixReading?'\n\nEn lectura relaciona cada afirmación con su identificador ('+facts.map((_,i)=>'H'+(i+1)).join(', ')+'). '+(facts.length===1?'Indica qué acredita el soporte y qué otro documento permitiría contrastarlo.':'Compara el número de productores que declara cada soporte. Una coincidencia de cantidades deja pendiente comprobar la identidad o el lugar de producción. Una discrepancia requiere cotejar la lista de productores.')+' El folio identifica el asunto y no constituye por sí mismo una deficiencia.':'';
 const markerRule=matrixReading&&caseFacts?.aliases.length?' Cita el folio mediante su marcador literal en la lectura.':caseFacts?.aliases.length?' En la lectura vincula el pago o la comprobación con al menos una referencia de los hechos. Copia literalmente su marcador, incluidos los corchetes. Si no puedes vincularlos al pasaje, abstente.':'';
 const rowPrompt=ref.quote&&sourceId===productOriginId&&!facts.length?
  'Prepara una lectura de un renglón arancelario del T-MEC para un abogado. Enfoque elegido: '+angles[angle]+'. Distingue la condición que consta en el texto de una propuesta para comprobarla. Para el enfoque documental, explica qué clasificación del insumo no originario y de la mercancía terminada habría que comparar. Formula una pregunta para conseguir ese dato. Puedes proponer consultar una ficha técnica o un registro de insumos como evidencia, sin afirmar que el tratado exige ese documento. Ten en cuenta las notas adjuntas. Para excepciones, abstente si las notas y el renglón no ofrecen una condición pertinente. No decidas si una operación cumple ni la vigencia actual. Devuelve un objeto JSON con cita (copia el renglón literal, o de 24 a 420 caracteres continuos si es largo), lectura (una o dos frases breves en español, sólo letras y puntuación, sin números) y solicitud (una pregunta entre signos de interrogación, sólo letras y espacios). Si el texto no basta para el enfoque, devuelve {"abstener":true}.\n'+ref.title+' · '+ref.locator+'\n'+ref.url+'\n'+ref.text+'\n'+ref.summary:null;
 const prompt=rowPrompt??'Resuelve esta consulta de investigación para un abogado mexicano: '+angles[angle]+focus+'.'+identityPrompt+productInstruction+' Identifica qué parte del pasaje atiende ese enfoque y qué hecho del expediente habría que comprobar. '+responseSpec+' (fragmento literal continuo de 24 a 420 caracteres) y solicitud (una pregunta documental concreta de hasta 120 caracteres entre signos de interrogación, sólo letras y espacios). Si el pasaje no fundamenta ese enfoque responde {"abstener":true}. Usa sólo esta fuente; no determines cumplimiento o vigencia.\n'+ref.title+' · '+ref.locator+'\n'+ref.url+'\n'+(body??ref.text)+(ref.remedy||sourceId===productOriginId?'\nCotejo de alcance y vigencia: '+ref.summary:'')+(condition?'\nCondición del encabezado\n'+condition:'')+publicFocus+inquiry+factBlock+matrixAdvice+markerRule;
 if(other){
  const sources=Object.freeze([first,other]);
  const returnRegimes=sources.some(s=>s.ref.id==='MX-FED-LADUA-97')&&sources.some(s=>s.ref.id==='MX-FED-LADUA-117');
  const blocks=sources.map(({ref,body,condition})=>returnRegimes?
   ref.title+' · '+ref.locator+'\n'+ref.url+(condition?'\nContexto del párrafo primero\n'+condition:'')+'\nPasaje elegido para la cita literal\n'+body:
   ref.title+' · '+ref.locator+'\n'+ref.url+'\n'+ref.text+(ref.remedy||ref.sourceId===productOriginId?'\n'+ref.summary:''));
  const interpret=facts.length?' En la lectura explica si los hechos seleccionados se contradicen y qué documento permitiría aclararlo.':'';
  const taskFocus=returnRegimes?' Distingue la reparación en el extranjero y la sustitución de una importación definitiva por defecto. Para cada cita copia sólo texto del pasaje elegido.':'';
  const pairedPrompt='Relaciona dos fundamentos para un abogado mexicano.'+identityPrompt+taskFocus+' Enfoque: '+angles[angle]+focus+'. Explica cómo se complementan o qué diferencia debe comprobar el abogado. Si uno no sustenta la relación, responde {"abstener":true}. Devuelve sólo JSON con cita y segundaCita (una cita literal continua de 24 a 160 caracteres de cada pasaje, en ese orden), lectura (una o dos oraciones de 40 a 300 caracteres sin cifras, nombres ni conclusiones de cumplimiento) y solicitud (una pregunta documental breve entre signos de interrogación). Conserva condiciones y excepciones. No determines vigencia.'+interpret+'\n\n'+blocks.map((block,i)=>'Fuente '+(i+1)+'\n'+block).join('\n\n')+publicFocus+inquiry+factBlock+matrixAdvice+markerRule;
  const note=Object.freeze({title:'Cotejo · '+ref.id+' y '+other.ref.id,ref,body,condition,angle,...(identity?{equipmentIdentity:true}:{}),sources,refs:Object.freeze(sources.map(s=>s.ref)),prompt:pairedPrompt,...(matrixReading?{matrixReading:true}:{}),...(caseFacts?{caseFacts}:{})});
  verified.add(note);return note;
 }
 const note=Object.freeze({title,ref,body,condition,angle,prompt,...(regulationReading?{regulationReading:true,selectedText}:{}),...(annexReading?{annexReading:true,selectedText}:{}),...(matrixReading?{matrixReading:true}:{}),...(identity?{equipmentIdentity:true}:{}),...(caseFacts?{caseFacts}:{})});verified.add(note);return note;
}

// A follow-up receives only an independently extracted description with a checked source location.
export function tariffResearch(code,page){
 const hit=tariffResult(code,page);
 if(!hit.canFollow)throw Error('El renglón requiere cotejo antes de usarlo en la nube.');
 const note=Object.freeze({ref:tariffReference(code,page)});
 verified.add(note);
 return note;
}

export function nicoResearch(code,nico){
 const row=nicoRow(code,nico);
 if(!row.literal)throw Error('La descripción NICO requiere cotejo antes del seguimiento.');
 const note=Object.freeze({ref:nicoReference(row)});
 verified.add(note);
 return note;
}

export function remedyResearch(source,point){
 const note=Object.freeze({ref:remedyReference(source,point)});
 verified.add(note);
 return note;
}
export function checkedResearchReference(note) {
  if (!verified.has(note)) throw Error('Pasaje sin procedencia verificada.');
  return note.ref;
}
export function researchEnvelope(note) {
  checkedResearchReference(note);
  if(typeof note.prompt!=='string')throw Error('La ficha local admite consultas de seguimiento.');
  return {version:1,responseFormat:'json',messages:[{role:'user',content:note.prompt}]};
}

export function renderResearchNote(raw, note) {
  let result;
  try { result = JSON.parse(raw); } catch { result = null; }
  if(note.compareProducers)return producerNote(note,result);
  const quote = typeof result?.cita === 'string' ? result.cita.trim() : null;
  const observation=typeof result?.lectura==='string'?result.lectura.trim():'';
  const hasFacts=Boolean(note.caseFacts?.texts.length);
  const aliases=new Map((note.caseFacts?.aliases??[]).map(item=>[item.out,item.local]));
  const checked=observation.replace(/\[\[PARTE_[1-9]\d*\]\]/gu,key=>aliases.has(key)?'referencia':key)
    .replace(/\bH([1-4])\b/gu,(key,n)=>(note.caseFacts?.inquiry||note.matrixReading)&&Number(n)<=note.caseFacts.texts.length?'hecho':key);
  const localReading=observation.replace(/\[\[PARTE_[1-9]\d*\]\]/gu,key=>aliases.get(key)??key);
  const asked=note.caseFacts?.inquiry?.match(/\[\[PARTE_[1-9]\d*\]\]/gu);
  const hasRequiredReference=asked?asked.every(key=>observation.includes(key)):!aliases.size||[...aliases.keys()].some(key=>observation.includes(key));
  const citedFacts=new Set(observation.match(/\bH[1-4]\b/gu)??[]);
  const coversMatrix=!note.matrixReading||note.caseFacts.texts.every((_,i)=>citedFacts.has('H'+(i+1)));
  const goodObservation=coversMatrix&&hasRequiredReference&&observation.length>=40&&observation.length<=(note.ref.sourceId===productOriginId?500:300)&&/^[\p{L}\p{M} ,.:;¿?()«»“”–-]+$/u.test(checked);
  const proposed=proposedQuestions(result?.solicitud);
  const other=note.sources?.[1];
  const secondQuote=typeof result?.segundaCita==='string'?result.segundaCita.trim():'';
  // Prefer short extracts in the prompt. A complete literal sentence can exceed that target.
  const pairValid=!other||(secondQuote.length>=24&&secondQuote.length<=420&&
    !/\[\[|\]\]/u.test(secondQuote)&&(other.body??other.ref.text).includes(secondQuote));
  const withReading=hasFacts||other||note.equipmentIdentity||note.regulationReading||note.annexReading;
  const keys=['cita','solicitud',...(withReading?['lectura']:[]),...(other?['segundaCita']:[])];
  const valid = pairValid&&(!withReading||(goodObservation&&(proposed||(!other&&(note.caseFacts?.inquiry||note.equipmentIdentity||note.regulationReading||note.annexReading)))))&&typeof quote === 'string' && quote.length >= 24 && quote.length <= 420 &&
    !quote.includes('[[') && !quote.includes(']]') && (note.selectedText||note.body||note.ref.text).includes(quote) &&
    Object.keys(result).every(key=>keys.includes(key));
  const question = valid ? proposed : '';
  // A verified substring can stop before a time limit or an exception. For
  // manually delimited customs provisions, print the entire selected provision.
  const fullQuote=note.body??quote;
  const basis = valid ? 'Cita documental [' + note.ref.id + ']\n' + fullQuote :
    result?.abstener===true?'Fundamento pendiente. La respuesta indicó que el pasaje no basta para responder. Puedes revisar otra fuente.':
    other?'Fundamento pendiente. Comprueba ambas citas y la relación propuesta antes de continuar.':
    note.ref.sourceId===productOriginId&&quote&&(note.body??note.ref.text).includes(quote)?'Fundamento pendiente. La cita aparece en la edición, pero el formato de la lectura o de la pregunta requiere revisión.':
    hasFacts?'Fundamento pendiente. La respuesta necesita una lectura, una cita comprobable y una pregunta documental.':
    'Fundamento pendiente. El modelo no devolvió una cita verificable en el pasaje seleccionado.';
  return 'Nota para [[CLIENTE]] · [[ASUNTO]]\n\n' + (note.angle?'Consulta del abogado\n[[CONSULTA]]\n\n'+angles[note.angle]+'\n':'') + basis + (!valid&&note.ref.sourceId===productOriginId?'\n\nFuente elegida en este equipo ['+note.ref.id+']\n'+note.ref.text:'') + (valid&&note.condition?'\nCondición del encabezado\n'+note.condition:'') +
    (note.caseFacts?.discrepancy?'\n\nDiscrepancia entre soportes\n'+note.caseFacts.discrepancy:'')+
    (valid&&other?'\n\nCita documental ['+other.ref.id+']\n'+(other.body??secondQuote)+(other.condition?'\nCondición del encabezado\n'+other.condition:''):'')+
    (valid&&withReading?'\n\nLectura preliminar para revisión\n'+localReading:'')+
    (note.caseFacts?'\n\nSoportes elegidos en el expediente\n[[SOPORTE]]':'')+
    (question ? '\n\nPregunta para revisión\n' + question : '\n\nPregunta de cotejo del despacho\n¿Qué documento del expediente acredita los hechos descritos en este pasaje?') +
    (other?.ref.remedy?'\n\n'+other.ref.summary:'')+
    renderedRegulationReadingNotes(other?[note.ref,other.ref]:[note.ref]).map(text=>'\n\n'+text).join('')+
    customsEditionWarnings(other?[note.ref,other.ref]:[note.ref]).map(text=>'\n\nAdvertencia de la copia consultada\n'+text).join('')+
    (note.ref.remedy||note.ref.sourceId===originAnnexId||note.ref.sourceId===productOriginId?'\n\n'+note.ref.summary:'\n\nRevisar el artículo completo, los transitorios y la versión aplicable en la fecha de la operación.');
}
