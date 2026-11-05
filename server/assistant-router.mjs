const normalized=value=>String(value).toLowerCase().normalize('NFD').replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function requestedLegalJurisdiction(question){
 const q=normalized(question);
 if(/\b(?:ccf|cpeum|codigo civil federal|codigo penal federal|constitucion politica de los estados unidos mexicanos)\b/.test(q))return {id:'MX-FED',supported:true};
 if(/\b(?:cdmx|ciudad de mexico|distrito federal)\b/.test(q))return {id:'MX-CMX',supported:true};
 if(/\bjalisco\b/.test(q))return {id:'MX-JAL',name:'Jalisco',supported:true,exactOnly:true};
 if(/\bnuevo leon\b/.test(q))return {id:'MX-NLE',name:'Nuevo León',supported:true,exactOnly:true};
 const states=['aguascalientes','baja california sur','baja california','campeche','chiapas','chihuahua','coahuila','colima','durango','guanajuato','guerrero','hidalgo','jalisco','michoacan','morelos','nayarit','nuevo leon','oaxaca','puebla','queretaro','quintana roo','san luis potosi','sinaloa','sonora','tabasco','tamaulipas','tlaxcala','veracruz','yucatan','zacatecas','estado de mexico'];
 for(const state of states)if(q.includes(`en ${state}`)||q.includes(`estado de ${state}`)||/\b(?:codigo|ley|constitucion)\b/.test(q)&&q.includes(state))return {id:null,name:state,supported:false};
 return null;
}
// Routing grants only existing retrieval/analysis capabilities. It cannot
// execute actions, expand document scope, or approve changes.
export function routeAssistantRequest({question,skillId='auto',documentCount=0,previousTurn=null}) {
 const q=normalized(question);
 // A selected skill focuses substantive work; it never turns off conversation.
 if(skillId!=='auto'){
  const automatic=routeAssistantRequest({question,skillId:'auto',documentCount,previousTurn});
  if(automatic.kind==='chat')return {...automatic,reason:`selected-skill-${automatic.reason}`};
  return {kind:'grounded',skillId,reason:'selected-skill',needsDocument:skillId!=='legal-researcher'&&skillId!=='legal-drafter',...(automatic.query?{query:automatic.query}:{})};
 }
 const exactAuthority=/\b(?:articulo|art)\s+\d|\b(?:cpeum|ccf|cnpp)\b/.test(q);
 const documentAction=/\b(?:analiza|analizar|revisa|revisar|resume|resumir|compara|comparar|extrae|extraer|lee|leer|identifica|identificar|que dice|que establece|obligaciones|riesgos|clausulas)\b/.test(q);
 const documentObject=/\b(?:documentos?|archivos?|adjuntos?|contratos?|escritos?|expedientes?|sentencias?|demandas?|contestacion|contestaciones|convenios?|pagares?|clausulas?)\b/.test(q);
 const drafting=/\b(?:redacta|redactar|prepara|preparar|elabora|elaborar|genera|generar|borrador)\b/.test(q)&&documentObject;
 const legalQuestion=/\b(?:busca|buscar|encuentra|consulta|investiga|que dice|que establece|explica|explicame|interpreta|interpretar|fundamenta|fundamento|jurisprudencia|tesis|procedente|procede|derechos|obligaciones|prescripcion|caducidad|plazo|requisitos|procedimiento|recurso|impugnar|despido|amparo|pena|delito|nulidad|rescision|apelar|apelacion|cuanto tiempo|puedo|se puede|que articulo)\b/.test(q)&&/\b(?:ley|codigo|constitucion|jurisprudencia|tesis|legal|juridico|juridica|penal|civil|mercantil|laboral|fiscal|amparo|derechos|prescripcion|caducidad|plazo|recurso|despido|delito|contrato|sentencia|demanda|articulo)\b/.test(q);
 // A greeting must not consume a substantive legal/document question following it.
 if(exactAuthority)return {kind:'grounded',skillId:'legal-researcher',reason:'explicit-authority',needsDocument:false};
 if(drafting)return {kind:'grounded',skillId:'legal-drafter',reason:'legal-draft',needsDocument:false};
 if(documentAction&&documentObject)return {kind:'grounded',skillId:'document-analyzer',reason:'document-analysis',needsDocument:true};
 const capabilities=/\b(?:que puedes hacer|como puedes ayudar|como me puedes ayudar|puedes ayudarme|para que sirves|quien eres|como funcionas)\b/.test(q);
 if(capabilities&&!/\b(?:explica|que dice|que establece|interpreta|fundamenta|cita|dame|busca|encuentra|investiga|redacta)\b/.test(q))return {kind:'chat',reason:'capabilities'};
 if(legalQuestion)return {kind:'grounded',skillId:'legal-researcher',reason:'legal-question',needsDocument:false};
 // Naming a law, or a common labour entitlement asked as a question, is legal
 // work even without the verbs above ("¿cuánto es el aguinaldo según la LFT?").
 const namedLaw=/\b(?:segun (?:la|el) (?:ley|lft|lss|cff|constitucion|codigo|reglamento)|de acuerdo con la (?:ley|lft)|conforme a la (?:ley|lft)|lft|lss|cff|ccom|cnpcf|lgtoc|lfpa|ley federal|ley del seguro social|ley (?:general|nacional|organica) (?:de|del|para|sobre)|codigo (?:civil|penal|fiscal|de comercio|nacional))\b/.test(q);
 const entitlement=/\b(?:aguinaldo|vacaciones|prima vacacional|prima de antiguedad|finiquito|liquidacion|indemnizacion|reparto de utilidades|ptu|horas extra|tiempo extra|salario minimo|incapacidad|maternidad|paternidad)\b/.test(q)&&/\b(?:cuanto|cuantos|cuantas|que es|me toca|me corresponde|corresponde|tengo derecho|cuando|como se calcula|minimo|obligad[oa]|debe|deben)\b/.test(q);
 if(namedLaw&&!/\b(?:cuento|poema|chiste|historia|pelicula)\b/.test(q)||entitlement)return {kind:'grounded',skillId:'legal-researcher',reason:'named-law-or-entitlement',needsDocument:false};
 const legalSituation=/\b(?:despid\p{L}*|desped\p{L}*|demand\p{L}*|detuv\p{L}*|deten\p{L}*|notific\p{L}*|embarg\p{L}*|pension\p{L}*|divorcio|custodia|arrend\p{L}*|apela\p{L}*|sentenc\p{L}*|pagare|prescri\p{L}*|caduc\p{L}*|amparo)\b/u.test(q);
 if(legalSituation&&/\b(?:me|mi|puedo|quiero|necesito|que hago|que pasa|como|cuanto|cuando)\b/.test(q))return {kind:'grounded',skillId:'legal-researcher',reason:'legal-situation',needsDocument:false};
 const personalRecall=/\b(?:como me llamo|cual es mi (?:nombre|palabra|profesion|area|especialidad)|que area soy|a que me dedico|recuerdas mi (?:nombre|palabra|presentacion|profesion)|que te (?:dije|conte)|que sabes de mi)\b/.test(q);
 if(personalRecall)return {kind:'chat',reason:'personal-context'};
 const introduction=/^(?:hola\s+)?(?:me llamo|mi nombre(?: de prueba)? es)\s+/.test(q)||/^(?:hola\s+)?soy abogad[oa](?:\s+(?:penal|penalista|civil|civilista|laboral|fiscal|mercantil|litigante))?$/.test(q);
 if(introduction)return {kind:'chat',reason:'introduction'};
 const social=/^(?:(?:hola|holi|buenos dias|buenas tardes|buenas noches|buenas|gracias|muchas gracias|ok|vale|perfecto|entendido|adios|hasta luego|como estas|como te va|que tal)(?:\s+|$))+$/.test(q);
 if(social)return {kind:'chat',reason:'social'};
 // Exact arithmetic is a general task, even when "resultado" happens to match
 // an article in the library. Do not classify tax/deadline/document requests
 // this way: only a closed expression of numbers/operators plus a short output
 // instruction qualifies. Retrieval still runs, then its unrelated hits clear.
 const math=String(question).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[¿?¡!]/g,'').trim();
 if(/^(?:hola[,.:]?\s+)?(?:(?:cuanto (?:es|son)|calcula|resuelve)\s+)?[+-]?\d+(?:[.,]\d+)?(?:\s*(?:[+*/×÷-]|mas|menos|por|entre)\s*[+-]?\d+(?:[.,]\d+)?)+(?:[.,]?\s*responde\s+(?:solo|unicamente)\s+(?:el resultado|con el resultado|con una cifra))?\.?$/.test(math))return {kind:'chat',reason:'general-task'};
 const conversationalTask=/\b(?:correo|email|reunion|agenda|ideas|organizar|organizacion|ortografia|traduce|traducir|saludo|presentacion|platicar|charlar|cuento|poema|chiste|misterio)\b/.test(q)||/\b(?:cambiemos de tema|hablemos de otra cosa)\b/.test(q);
 if(conversationalTask)return {kind:'chat',reason:'general-task'};
 const articleNavigation=/^(?:el\s+)?(?:articulo\s+)?(?:siguiente|anterior|posterior|previo)(?:\s+articulo)?$/.test(q);
 const followUp=articleNavigation||/^(?:y\b|tambien\b|entonces\b|sobre lo anterior|respecto de lo anterior|el articulo anterior|eso\b|esa\b|ese\b|esto\b|hazlo\b|haz\b|resumelo\b|amplia\b|explica mas\b|mas breve\b|mas cort[oa]\b|mas simple\b|mas sencillo\b|en pocas palabras\b|en (?:una|dos|tres) (?:lineas?|oraciones?|frases?)\b|explicalo\b|dimelo\b|(?:dame|ponme|con) un ejemplo\b|continua\b|simplifica\b|por que\b)/.test(q);
 if(followUp&&previousTurn?.kind==='grounded'&&previousTurn.citations?.length)return {kind:'grounded',skillId:previousTurn.skillId||'legal-researcher',reason:'grounded-follow-up',needsDocument:false,query:`${question}\n${previousTurn.question}`};
 if(documentCount&&/\b(?:resumen|resumir|resume|analiza|revisa|comparar|compara|riesgos|clausulas|obligaciones)\b/.test(q))return {kind:'grounded',skillId:'document-analyzer',reason:'matter-document-request',needsDocument:true};
 return {kind:'chat',reason:'conversation'};
}
