import {returnIdentityInquiry} from './return-context.mjs';
import {remedyReference} from './remedy-index.mjs';
import {questionFactTexts} from './intake-question-facts.mjs';
import {selectedConcepts} from './question-concepts.mjs';
import {customsPassage,regulationPassage} from './customs-edition.mjs';
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
 if(typeof sourceId==='string'&&sourceId.startsWith('ad29-')){
  ref=remedyReference(sourceId,part);body=ref.text;
 }else if(typeof sourceId==='string'&&/^(aduana|reg-aduana)-/.test(sourceId)){
  const source=sourceId.startsWith('reg-aduana-')?regulationPassage(sourceId.slice(11)):customsPassage(sourceId.slice(7));
  if(!Number.isInteger(part)||part<0||part>=source.passages.length)throw Error('Pasaje aduanero inválido.');
  const passage=source.passages[part];
  condition=passage.condition;body=passage.quote;
  ref=Object.freeze({...source.ref,text:passage.quote+(condition?'\n\n'+condition:''),locator:passage.locator+' · '+source.ref.locator});
 }else ref=loadResearchPassage(library,sourceId,part).ref;
 return Object.freeze({ref,body,condition});
}

export function questionPassage(library,{sourceId,part,angle,concepts=[],second,equipmentIdentity=false},caseFacts){
 if(!Object.hasOwn(angles,angle))throw Error('Selecciona el enfoque jurídico.');
 const first=questionSource(library,sourceId,part);
 const {ref,body,condition}=first;
 const other=second?questionSource(library,second.sourceId,second.part):null;
 if(other&&other.ref.id===ref.id)throw Error('Para relacionar fundamentos, elige dos disposiciones distintas.');
 const labels=selectedConcepts(concepts,other?ref.text+' '+other.ref.text:ref.text);
 const focus=labels.length?' · '+labels.join(', '):'';
 const title=angles[angle]+' · '+ref.title+(ref.remedy?'':' · art. '+ref.article);
 const facts=caseFacts?questionFactTexts(caseFacts):[];
 const identity=equipmentIdentity===true&&sourceId==='aduana-117';
 const identityPrompt=identity?' '+returnIdentityInquiry+' Examina la cuestión como hipótesis. Distingue cambiar una pieza de reemplazar el equipo completo. Propón cómo cotejar la identidad con documentos de salida y de retorno. La coincidencia de folios por sí sola no prueba identidad. No presupongas que hubo exportación ni reparación.':'';
 const responseSpec=identity?'En lectura explica qué evidencia permitiría distinguir esos supuestos en una o dos oraciones de 40 a 300 caracteres sin nombres, cifras ni conclusiones sobre el expediente. Devuelve JSON con lectura, cita':facts.length?'En lectura explica en una o dos oraciones qué permiten comprobar los hechos o qué contradicción requiere aclaración. Escribe de 40 a 300 caracteres sin cifras, nombres, nuevas citas o conclusiones de cumplimiento. Si los hechos no guardan relación con el pasaje, abstente. Devuelve JSON con lectura, cita':'Devuelve JSON con cita';
 const factBlock=facts.length?'\n\nHechos del ejercicio elegidos por el abogado\n'+facts.map((fact,i)=>'H'+(i+1)+' · '+fact).join('\n'):'';
 const inquiry=caseFacts?.inquiry?'\n\nPregunta del abogado con referencias sustituidas\n'+caseFacts.inquiry+'\nResponde a esa pregunta en la lectura, copia cada marcador de la pregunta y señala qué dato debe aclararse.':'';
 const markerRule=caseFacts?.aliases.length?' En la lectura vincula el pago o la comprobación con al menos una referencia de los hechos. Copia literalmente su marcador, incluidos los corchetes. Si no puedes vincularlos al pasaje, abstente.':'';
 const prompt='Resuelve esta consulta de investigación para un abogado mexicano: '+angles[angle]+focus+'.'+identityPrompt+' Identifica qué parte del pasaje atiende ese enfoque y qué hecho del expediente habría que comprobar. '+responseSpec+' (fragmento literal continuo de 24 a 420 caracteres) y solicitud (una pregunta documental concreta de hasta 120 caracteres entre signos de interrogación, sólo letras y espacios). Si el pasaje no fundamenta ese enfoque responde {"abstener":true}. Usa sólo esta fuente; no determines cumplimiento o vigencia.\n'+ref.title+' · '+ref.locator+'\n'+ref.url+'\n'+(body??ref.text)+(ref.remedy?'\nCotejo de alcance y vigencia: '+ref.summary:'')+(condition?'\nCondición del encabezado\n'+condition:'')+inquiry+factBlock+markerRule;
 if(other){
  const sources=Object.freeze([first,other]);
  const returnRegimes=sources.some(s=>s.ref.id==='MX-FED-LADUA-97')&&sources.some(s=>s.ref.id==='MX-FED-LADUA-117');
  const blocks=sources.map(({ref,body,condition})=>returnRegimes?
   ref.title+' · '+ref.locator+'\n'+ref.url+(condition?'\nContexto del párrafo primero\n'+condition:'')+'\nPasaje elegido para la cita literal\n'+body:
   ref.title+' · '+ref.locator+'\n'+ref.url+'\n'+ref.text+(ref.remedy?'\n'+ref.summary:''));
  const interpret=facts.length?' En la lectura explica si los hechos seleccionados se contradicen y qué documento permitiría aclararlo.':'';
  const taskFocus=returnRegimes?' Distingue la reparación en el extranjero y la sustitución de una importación definitiva por defecto. Para cada cita copia sólo texto del pasaje elegido.':'';
  const pairedPrompt='Relaciona dos fundamentos para un abogado mexicano.'+identityPrompt+taskFocus+' Enfoque: '+angles[angle]+focus+'. Explica cómo se complementan o qué diferencia debe comprobar el abogado. Si uno no sustenta la relación, responde {"abstener":true}. Devuelve sólo JSON con cita y segundaCita (una cita literal continua de 24 a 160 caracteres de cada pasaje, en ese orden), lectura (una o dos oraciones de 40 a 300 caracteres sin cifras, nombres ni conclusiones de cumplimiento) y solicitud (una pregunta documental breve entre signos de interrogación). Conserva condiciones y excepciones. No determines vigencia.'+interpret+'\n\n'+blocks.map((block,i)=>'Fuente '+(i+1)+'\n'+block).join('\n\n')+inquiry+factBlock+markerRule;
  const note=Object.freeze({title:'Cotejo · '+ref.id+' y '+other.ref.id,ref,body,condition,angle,...(identity?{equipmentIdentity:true}:{}),sources,refs:Object.freeze(sources.map(s=>s.ref)),prompt:pairedPrompt,...(caseFacts?{caseFacts}:{})});
  verified.add(note);return note;
 }
 const note=Object.freeze({title,ref,body,condition,angle,prompt,...(identity?{equipmentIdentity:true}:{}),...(caseFacts?{caseFacts}:{})});verified.add(note);return note;
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
  const quote = typeof result?.cita === 'string' ? result.cita.trim() : null;
  const observation=typeof result?.lectura==='string'?result.lectura.trim():'';
  const hasFacts=Boolean(note.caseFacts?.texts.length);
  const aliases=new Map((note.caseFacts?.aliases??[]).map(item=>[item.out,item.local]));
  const checked=observation.replace(/\[\[PARTE_[1-9]\d*\]\]/gu,key=>aliases.has(key)?'referencia':key)
    .replace(/\bH([1-4])\b/gu,(key,n)=>note.caseFacts?.inquiry&&Number(n)<=note.caseFacts.texts.length?'hecho':key);
  const localReading=observation.replace(/\[\[PARTE_[1-9]\d*\]\]/gu,key=>aliases.get(key)??key);
  const asked=note.caseFacts?.inquiry?.match(/\[\[PARTE_[1-9]\d*\]\]/gu);
  const hasRequiredReference=asked?asked.every(key=>observation.includes(key)):!aliases.size||[...aliases.keys()].some(key=>observation.includes(key));
  const goodObservation=hasRequiredReference&&observation.length>=40&&observation.length<=300&&/^[\p{L}\p{M} ,.:;¿?()«»“”–-]+$/u.test(checked);
  const proposed=proposedQuestions(result?.solicitud);
  const other=note.sources?.[1];
  const secondQuote=typeof result?.segundaCita==='string'?result.segundaCita.trim():'';
  // Prefer short extracts in the prompt. A complete literal sentence can exceed that target.
  const pairValid=!other||(secondQuote.length>=24&&secondQuote.length<=420&&
    !/\[\[|\]\]/u.test(secondQuote)&&(other.body??other.ref.text).includes(secondQuote));
  const keys=['cita','solicitud',...(hasFacts||other||note.equipmentIdentity?['lectura']:[]),...(other?['segundaCita']:[])];
  const valid = pairValid&&(!(hasFacts||other||note.equipmentIdentity)||(goodObservation&&(proposed||(!other&&(note.caseFacts?.inquiry||note.equipmentIdentity)))))&&typeof quote === 'string' && quote.length >= 24 && quote.length <= 420 &&
    !quote.includes('[[') && !quote.includes(']]') && (note.body??note.ref.text).includes(quote) &&
    Object.keys(result).every(key=>keys.includes(key));
  const question = valid ? proposed : '';
  // A verified substring can stop before a time limit or an exception. For
  // manually delimited customs provisions, print the entire selected provision.
  const fullQuote=note.body??quote;
  const basis = valid ? 'Cita documental [' + note.ref.id + ']\n' + fullQuote :
    result?.abstener===true?'Fundamento pendiente. OpenAI indicó que el pasaje no basta para responder. Puedes revisar otra fuente.':
    other?'Fundamento pendiente. Comprueba ambas citas y la relación propuesta antes de continuar.':
    hasFacts?'Fundamento pendiente. La respuesta necesita una lectura, una cita comprobable y una pregunta documental.':
    'Fundamento pendiente. El modelo no devolvió una cita verificable en el pasaje seleccionado.';
  return 'Nota para [[CLIENTE]] · [[ASUNTO]]\n\n' + (note.angle?'Consulta del abogado\n[[CONSULTA]]\n\n'+angles[note.angle]+'\n':'') + basis + (valid&&note.condition?'\nCondición del encabezado\n'+note.condition:'') +
    (note.caseFacts?.discrepancy?'\n\nDiscrepancia entre soportes\n'+note.caseFacts.discrepancy:'')+
    (valid&&other?'\n\nCita documental ['+other.ref.id+']\n'+(other.body??secondQuote)+(other.condition?'\nCondición del encabezado\n'+other.condition:''):'')+
    (valid&&(hasFacts||other||note.equipmentIdentity)?'\n\nLectura preliminar de OpenAI\n'+localReading:'')+
    (note.caseFacts?'\n\nSoportes elegidos en el expediente\n[[SOPORTE]]':'')+
    (question ? '\n\nPregunta para revisión\n' + question : '\n\nPregunta de cotejo del despacho\n¿Qué documento del expediente acredita los hechos descritos en este pasaje?') +
    (other?.ref.remedy?'\n\n'+other.ref.summary:'')+
    (note.ref.remedy?'\n\n'+note.ref.summary:'\n\nRevisar el artículo completo, los transitorios y la versión aplicable en la fecha de la operación.');
}
