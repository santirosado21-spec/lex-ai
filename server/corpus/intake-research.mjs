// The browser chooses a row and a passage. The local service reads every outbound
// character from the pinned public index. Search terms and matter fields stay local.
import {createHash} from 'node:crypto';
import {tariffReference,tariffResult} from './tariff-index.mjs';
import {getPinnedPublicSource} from '../public-library.mjs';
import {proposedQuestions} from './trade-pilot-grounding.mjs';

const indexHash = 'ec944a19d40be5faa0bd0ee081e906145038446aa8df394b706adc2daddd1588';
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

// A follow-up receives only an independently extracted description with a checked source location.
export function tariffResearch(code,page){
 const hit=tariffResult(code,page);
 if(!hit.canFollow)throw Error('El renglón requiere cotejo antes de usarlo en la nube.');
 const note=Object.freeze({ref:tariffReference(code,page)});
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
  const valid = typeof quote === 'string' && quote.length >= 24 && quote.length <= 420 &&
    !quote.includes('[[') && !quote.includes(']]') && note.ref.text.includes(quote) &&
    Object.keys(result).every(key=>['cita','solicitud'].includes(key));
  const question = valid ? proposedQuestions(result.solicitud) : '';
  const basis = valid ? 'Cita documental [' + note.ref.id + ']\n' + quote :
    'Fundamento pendiente. El modelo no devolvió una cita verificable en el pasaje seleccionado.';
  return 'Nota para [[CLIENTE]] · [[ASUNTO]]\n\n' + basis +
    (question ? '\n\nPregunta para revisión\n' + question : '\n\nPregunta de cotejo del despacho\n¿Qué documento del expediente acredita los hechos descritos en este pasaje?') +
    '\n\nRevisar el artículo completo, los transitorios y la versión aplicable en la fecha de la operación.';
}
