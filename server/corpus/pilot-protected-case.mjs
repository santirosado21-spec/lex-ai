import {loadResearchPassage} from './intake-research.mjs';
import {proposedQuestions} from './trade-pilot-grounding.mjs';

import {protectedPracticeFacts} from './pilot-practice-document.mjs';
export {practiceDocument,newPracticeSeed} from './pilot-practice-document.mjs';

const trusted=new WeakSet();
export function prepareProtectedCase(seed,document,firmId,matterId,library) {
 const {example,outbound,provider,facts,localTokens}=protectedPracticeFacts(seed,document,firmId,matterId);
 const source=library?.lookupArticle({lawId:'MX-FED-LCE',articleId:example.article});
 const passage=loadResearchPassage(library,source?.sourceId,0);
 const prompt='Prepara una primera nota documental para un abogado mexicano a partir del expediente de práctica protegido y del pasaje oficial. Devuelve sólo JSON con proveedor, hecho, cita y solicitud. En proveedor copia exactamente el marcador que figura en la línea Proveedor. En hecho copia literalmente una oración completa de Operación o Constancia, sin la etiqueta. En cita copia un fragmento continuo de 24 a 320 caracteres del artículo. En solicitud escribe una pregunta documental breve, entre ¿ y ?, con letras y espacios, que ayude a revisar el hecho. Evita conclusiones sobre vigencia, trato o tasas.\n\n'+outbound+'\n\n'+passage.ref.title+' · '+passage.ref.locator+'\n'+passage.ref.url+'\n'+passage.ref.text;
 const note=Object.freeze({prompt,title:'Nota del expediente protegido',ref:passage.ref,provider,
  facts:Object.freeze(facts),localTokens:Object.freeze(localTokens)});
 trusted.add(note);
 return note;
}

export function protectedCaseEnvelope(note) {
 if(!trusted.has(note))throw Error('Origen del expediente de práctica no comprobado.');
 return {version:1,responseFormat:'json',messages:[{role:'user',content:note.prompt}]};
}

export function renderProtectedCase(raw,note) {
 let result;
 try{result=JSON.parse(raw);}catch{result=null;}
 const lead='Nota de revisión para [[CLIENTE]] · [[ASUNTO]]';
 if(!result||Object.keys(result).sort().join(',')!=='cita,hecho,proveedor,solicitud'||result.proveedor!==note.provider||
    !note.facts.includes(result.hecho)||typeof result.cita!=='string'||result.cita.length<24||result.cita.length>320||
    !note.ref.text.includes(result.cita))return lead+'\n\nFundamento pendiente. No se pudo cotejar la parte, el hecho y la cita con la fuente seleccionada.';
 const item=note.localTokens.find(entry=>entry.publicToken===result.proveedor);
 const localFact=result.hecho.replace(/\[\[PARTE_\d+\]\]/g,marker=>note.localTokens.find(entry=>entry.publicToken===marker).localToken);
 const q=proposedQuestions(result.solicitud);
 return lead+'\n\nProveedor: '+item.localToken+'\n\nHecho documental\n'+localFact+'\n\nFundamento ['+note.ref.id+']\n'+result.cita+
  (q?'\n\nPregunta para revisión\n'+q:'')+'\n\nRevisar la versión aplicable en la fecha de la operación.';
}
