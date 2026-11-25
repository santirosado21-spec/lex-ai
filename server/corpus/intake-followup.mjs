import {customsEditionWarnings} from './customs-edition.mjs';
import {returnIdentityInquiry} from './return-context.mjs';
import {permitReferences} from './pedimento-index.mjs';
import {questionFactTexts} from './intake-question-facts.mjs';
import {comparisonEnvelope} from './intake-comparison.mjs';
// Build the next turn from sources checked again on this machine. User edits,
// supporting lines, client names, and original filenames stay out of the request.
import {createHash} from 'node:crypto';
import {checkedResearchReference} from './intake-research.mjs';
import {tradeReadingEnvelope} from './intake-trade-reading.mjs';
import {protectedCaseEnvelope} from './pilot-protected-case.mjs';

const trusted=new WeakSet();
const digest=text=>createHash('sha256').update(text).digest('hex');
const forms={
 carta:{title:'Solicitud al cliente',instruction:'Redacta dos peticiones distintas y corteses al cliente para obtener documentación concreta. Inicia cada petición con «Solicitamos» o «Por favor». Vincula cada petición con lo que permite comprobar.',intro:'Para continuar con la revisión, agradeceremos su apoyo con lo siguiente.'},
 control:{title:'Lista de cotejo interna',instruction:'Redacta dos acciones distintas para el abogado que cotejará el expediente. Inicia cada acción con «Cotejar», «Verificar», «Comparar», «Revisar» o «Identificar». Indica el documento y qué se debe comprobar.',intro:'Comprobaciones pendientes del despacho'},
};
export const isFollowupForm=value=>typeof value==='string'&&Object.hasOwn(forms,value);

const documentTypes=[
 ['factura','factura comercial',/\bfacturas?\b/u],
 ['contrato','contrato',/\bcontratos?\b/u],
 ['pedimento','pedimento',/\bpedimentos?\b/u],
 ['transporte','documento de transporte',/\b(?:fletes?|cartas? de porte|guias? aereas?|conocimientos? de embarque|documentos? de transporte)\b/u],
 ['pago','comprobante de pago',/\b(?:comprobantes?|constancias?|justificantes?) de pago\b/u],
 ['origen','certificación de origen',/\b(?:certificados?|certificacion(?:es)?) de origen\b/u],
 ['acuse','acuse de transmisión',/\bacuses?\b/u],
 ['tecnica','ficha técnica',/\bfichas? tecnicas?\b/u],
 ['licencia','licencia',/\blicencias?\b/u],
];
export function focusFromInstruction(text){
 if(typeof text!=='string'||text.length>400)throw Error('Escribe una indicación de hasta 400 caracteres.');
 const clean=text.trim().normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
 if(!clean)return [];
 const topics=documentTypes.filter(([, ,pattern])=>pattern.test(clean)).map(([id])=>id);
 if(!topics.length||topics.length>2||/\b(?:sin|excepto|evita|exclu\w*|omite|descarta|menos|no)\b/u.test(clean))
  throw Error('Especifica uno o dos documentos que sí quieras revisar, por ejemplo la factura y el comprobante de pago.');
 return topics;
}
function focusNames(focus){
 if(!Array.isArray(focus)||focus.length>2||new Set(focus).size!==focus.length)throw Error('Selección documental inválida.');
 return focus.map(id=>{
  const type=documentTypes.find(([key])=>id===key);
  if(!type)throw Error('Selección documental inválida.');
  return type[1];
 });
}

function sourceContext(source){
 if(source?.selection&&source?.references)return {refs:permitReferences(source),facts:[]};
 if(source?.localTokens){
  protectedCaseEnvelope(source);
  return {refs:[source.ref],facts:source.facts};
 }
 if(source?.variants){
  comparisonEnvelope(source);return {refs:source.refs,facts:[]};
 }
 if(source?.choices){
  tradeReadingEnvelope(source);
  return {refs:source.refs,facts:[]};
 }
 const ref=checkedResearchReference(source);
 return {refs:source.refs??[ref],facts:source.caseFacts?questionFactTexts(source.caseFacts):[]};
}

// Some provisions must travel with the complete paragraph selected in the note.
function requiredQuote(source,ref,index){
 if(source.sources)return source.sources[index]?.body;
 if(source.selection&&source.references||ref.remedy)return ref.text;
 return source.body;
}

// Recover only whole quotation lines present in a fresh, model-generated note.
// Reconstruct outbound text from the pinned source, never from the draft string.
export function quotedRanges(source,draft){
 const {refs}=sourceContext(source);
 const lines=draft.split('\n');
 const ranges=[];
 for(const [index,ref] of refs.entries()){
  const heading=lines.findIndex(line=>line.includes('['+ref.id+']'));
  if(heading<0)continue;
  const full=requiredQuote(source,ref,index);
  const after=lines.slice(heading+1).join('\n');
  const quote=full??lines[heading+1];
  if(!quote||full&&after!==full&&!after.startsWith(full+'\n'))continue;
  if(!full&&(quote.length<24||quote.length>420))continue;
  const start=ref.text.indexOf(quote);
  if(start>=0)ranges.push({index,start,length:quote.length,sha:digest(quote)});

 }
 return source?.sources&&ranges.length!==refs.length?[]:ranges;
}

export function prepareFollowup(source,ranges,form,focus=[],prior){
 if(!isFollowupForm(form))throw Error('Selecciona el documento de seguimiento.');
 const {refs,facts}=sourceContext(source);
 if(!Array.isArray(ranges)||!ranges.length||ranges.length>refs.length||source?.sources&&(ranges.length!==refs.length||ranges.some((r,i)=>r.index!==i)))throw Error('La nota necesita una cita cotejada antes del seguimiento.');
 const quotes=ranges.map(({index,start,length,sha})=>{
  const ref=refs[index],passage=source.sources?.[index];
  if(!Number.isSafeInteger(index)||!ref||!Number.isSafeInteger(start)||start<0||
     !Number.isSafeInteger(length)||length<1||start+length>ref.text.length)throw Error('La cita de la nota cambió.');
  const quote=ref.text.slice(start,start+length);
  const full=requiredQuote(source,ref,index);
  if((full?quote!==full:length<24||length>420)||digest(quote)!==sha)throw Error('La cita de la nota cambió.');
  const choice=source.variants?source.choices.find(item=>item.source===ref.id&&item.quote===quote):source.choices?.[index]?.find(item=>item.quote===quote);
  const condition=passage?passage.condition:choice?.condition??source.condition;
  if(condition&&!ref.text.includes(condition))throw Error('La condición del pasaje requiere cotejo.');
  return {ref,quote,condition,locator:choice?.locator};
 });
 const spec=forms[form],names=focusNames(focus);
 let previous='';
 if(prior){
  if(!isFollowupForm(prior.form))throw Error('No se pudo cotejar el turno anterior.');
  const previousFocus=focusNames(prior.focus??[]);
  previous='\n\nTurno anterior\n'+forms[prior.form].title+(previousFocus.length?' · '+previousFocus.join(' y '):'')+'.';
 }
 const period=source?.period??null;
 const schema=period?'Devuelve JSON con cuatro claves: comun, antes, captura, declaracion. Cada valor es una oración de 25 a 145 caracteres. En comun pide revisar los documentos sobre la mercancía y su clasificación. En antes pide únicamente evidencia de la operación o la fecha. Omite avisos, permisos, declaraciones y obligaciones en comun y antes. En captura pregunta si el interesado presentó una solicitud y condiciona cualquier acuse a que exista; incluye la palabra «si». En declaracion pide verificar el número en el pedimento condicionado al alcance; incluye la expresión «si procede». Escribe las cuatro alternativas aunque desconozcas la fecha de la operación. '+(names.length?'En comun menciona los documentos seleccionados. ':'')+(names.includes('acuse de transmisión')?'Si se pidió un acuse de transmisión, solicítalo en comun sólo si existe, como documento del expediente. ':''):
  'Devuelve JSON con una sola clave "acciones", una lista de dos oraciones en español de hasta 200 caracteres cada una. ';
 const instruction=period?(form==='carta'?'Prepara opciones de petición al cliente. Inicia cada oración con «Solicitamos» o «Por favor».':'Prepara opciones de cotejo interno. Inicia cada oración con «Cotejar», «Verificar», «Comparar», «Revisar» o «Identificar».'):spec.instruction;
 const prompt='Continúa el trabajo de la nota anterior. '+(source.equipmentIdentity?returnIdentityInquiry+' Pide comparar el número de serie o una característica comprobable en los documentos de salida y regreso. ':'')+instruction+(names.length?' Menciona literalmente cada tipo de documento seleccionado por el abogado al menos una vez en las acciones: '+names.join(' y ')+'.':'')+' '+schema+'Limita el texto a solicitudes de documentos o tareas de cotejo. Evita nombres, identificadores, cifras, citas nuevas, plazos y conclusiones jurídicas.\n\nFundamentos seleccionados en el primer borrador\n'+
  quotes.map(({ref,quote,condition,locator})=>ref.id+' · '+(locator?locator+' · ':'')+ref.locator+'\n'+ref.url+'\n'+quote+(ref.remedy?'\n'+ref.summary:'')+(condition?(['MX-FED-LADUA-97','MX-FED-LADUA-117'].includes(ref.id)?'\nCondición del párrafo primero\n':'\nCondición de la fracción I\n')+condition:'')).join('\n\n')+
  (source.caseFacts?.inquiry?'\n\nPregunta del abogado con referencias sustituidas\n'+source.caseFacts.inquiry:'')+
  (facts.length?'\n\nHechos del ejercicio con sustituciones locales\n'+facts.join('\n'):'')+previous;
 const localContext=source.localTokens?['Proveedor registrado · '+source.localTokens.find(item=>item.publicToken===source.provider).localToken,
  ...facts.map(fact=>fact.replace(/\[\[PARTE_\d+\]\]/gu,marker=>source.localTokens.find(item=>item.publicToken===marker).localToken))].join('\n'):'';
 const result=Object.freeze({localContext,period,discrepancy:source.caseFacts?.discrepancy,focus:Object.freeze(names),form,title:spec.title+(names.length?' · '+names.join(' y '):''),prompt,quotes:Object.freeze(quotes.map(Object.freeze)),refs:Object.freeze(quotes.map(q=>q.ref)),synthetic:facts.length>0});
 trusted.add(result);
 return result;
}
export function followupEnvelope(note){
 if(!trusted.has(note))throw Error('Seguimiento sin procedencia verificada.');
 return {version:1,responseFormat:'json',messages:[{role:'user',content:note.prompt}]};
}
export function renderFollowup(raw,note,{evidence=false}={}){
 followupEnvelope(note);
 let result;
 try{result=JSON.parse(raw);}catch{}
 const start=note.form==='carta'?/^(?:Solicitamos|Por favor)\b/u:/^(?:Cotejar|Verificar|Comparar|Revisar|Identificar)\b/u;
 const documentary=a=>typeof a==='string'&&a.length>=20&&a.length<=200&&start.test(a)&&/^[\p{L}\p{M} ,()–-]+[.]?$/u.test(a);
 let actions=result?.acciones;
 if(note.period){
  const keys=['comun','antes','captura','declaracion'];
  const common=result?.comun;
  const commonCheck=typeof common==='string'&&note.focus.includes('acuse de transmisión')&&/\bsi existe\b/iu.test(common)?common.replace(/acuse de transmisión/giu,'soporte'):common;
  const valid=result&&Object.keys(result).length===keys.length&&keys.every(key=>documentary(result[key])&&result[key].length>=25&&result[key].length<=145)
    &&!/(?:avis[oa]|permis[oa]|declar|oblig|captur|solicitud|acuse|folio)/iu.test(commonCheck+' '+result.antes)
    &&/\bsi\b/iu.test(result.captura)&&/solicitud/iu.test(result.captura)&&!/declar|oblig/iu.test(result.captura)
    &&/\bsi procede\b/iu.test(result.declaracion)&&/pedimento/iu.test(result.declaracion);
  if(!valid)throw Error('La respuesta no distingue los tres periodos del trámite. Revisa la ficha y sus fundamentos.');
  actions=[result.comun,result[note.period]];
 }
 if(!result||(!note.period&&Object.keys(result).join()!=='acciones')||!Array.isArray(actions)||actions.length!==2||
    !actions.every(documentary)||
    !note.focus.every(name=>actions.some(a=>a.toLocaleLowerCase('es').includes(name)))||
    new Set(actions.map(a=>a.toLowerCase().replace(/[\p{P}\s]/gu,''))).size!==2)
  throw Error('La revisión requiere dos acciones documentales completas. Se conserva el primer borrador.');
 const spec=forms[note.form];
 const basis=note.quotes.map(({ref,quote,locator,condition})=>'['+ref.id+']'+(locator?' · '+locator:'')+'\n'+quote+(ref.remedy?'\n'+ref.summary:'')+(condition?(['MX-FED-LADUA-97','MX-FED-LADUA-117'].includes(ref.id)?'\nCondición del párrafo primero\n':'\nCondición de la fracción I\n')+condition:'')).join('\n');
 return [note.form==='carta'?'Asunto · [[ASUNTO]]\n\nA la atención de [[CLIENTE]]':spec.title+' para [[CLIENTE]] · [[ASUNTO]]',
  spec.intro,actions.map((a,i)=>(i+1)+'. '+a).join('\n'),
  ...(note.localContext&&note.form==='control'?[note.localContext]:[]),
  ...(note.discrepancy&&note.form==='control'?[note.discrepancy]:[]),
  ...(evidence&&note.form==='control'?['Soporte del expediente\n[[SOPORTE]]']:[]),
  'Fundamento de la revisión\n'+basis,
  ...customsEditionWarnings(note.refs).map(text=>'Advertencia de la copia consultada\n'+text)].join('\n\n');
}
