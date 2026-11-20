// Each role is declared by the lawyer. The local parser accepts whole counts
// and affirmative statements. Negation, ranges and qualified amounts need review.
const numbers=new Map(Object.entries({un:1,uno:1,'un solo':1,'un único':1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10}));
const roleCount=/^(?:(?:el|la) (?<role>certificaci[oó]n|certificado|registro|lista|padr[oó]n)(?: de (?:origen|producci[oó]n|proveedores|productores))?(?: (?:con|del) folio (?<folio>[\p{L}\p{N}._/-]{2,60}))? (?:declara|identifica|menciona|indica|registra|incluye|enumera) )?(?<count>un solo|un único|un|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|varios|múltiples|[1-9]\d{0,3}) productor(?:es)?[.]?$/iu;
function count(excerpt){
 const value=excerpt.replace(/^Hoja [1-9]\d* · [A-Z]+[1-9]\d* \| /u,'').trim().toLocaleLowerCase('es');
 const match=roleCount.exec(value);
 const quantity=match?.groups.count??value;
 if(!match&&!/^(?:[1-9]\d{0,3}|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|varios|múltiples)$/u.test(value))return null;
 const role=match?.groups.role;
 const source={role:role?(role.startsWith('certific')?'certificate':'register'):null,folio:match?.groups.folio};
 if(['varios','múltiples'].includes(quantity))return {...source,min:2,max:Infinity};
 const n=numbers.get(quantity)??Number(quantity);
 return Number.isInteger(n)&&n>0?{...source,min:n,max:n}:null;
}
export function producerResult(first,second){
 const a=count(first),b=count(second);
 if(!a||!b)return {key:'pendiente',finding:'Una de las líneas carece de una cantidad inequívoca.'};
 if(a.role==='register'||b.role==='certificate')return {key:'pendiente',finding:'El tipo de documento que menciona una línea difiere del papel que le asignaste. Revisa cuál corresponde a la certificación y cuál al registro.'};
 if(a.folio&&b.folio&&a.folio!==b.folio)return {key:'pendiente',finding:'Los folios que figuran en las líneas son distintos. Comprueba si se trata de la misma operación.'};
 if(a.max<b.min||b.max<a.min)return {key:'difieren',finding:'Las cantidades que indican la certificación y el registro difieren.'};
 if(a.min===a.max&&a.min===b.min&&b.min===b.max)return {key:'coinciden',finding:'Las dos líneas indican la misma cantidad de productores. Falta comprobar su identidad.'};
 return {key:'pendiente',finding:'Los soportes permiten varias cantidades compatibles. Hace falta una relación de productores para precisar el número.'};
}
export function producerPrompt(ref){
 return 'Prepara tres comprobaciones documentales independientes a partir del numeral público. El abogado cotejará en su equipo el número de productores de una certificación y de un registro. Redacta las tres alternativas aunque desconozcas su expediente. En coinciden pide verificar identidad o lugar de producción. En difieren pide conciliar ambas fuentes con la relación de productores. En pendiente pide obtener la información que permita cotejar la cantidad. Devuelve JSON con cita (texto literal continuo de entre 24 y 220 caracteres del numeral), coinciden, difieren y pendiente (una instrucción breve de 25 a 165 caracteres por alternativa). No incluyas nombres, cifras, marcadores ni una conclusión sobre el origen. Si falta sustento devuelve {"abstener":true}.\n\n'+ref.title+' · '+ref.locator+'\n'+ref.url+'\n'+ref.text;
}
export function producerNote(note,result){
 const evidence=note.caseFacts.evidence;
 const local=producerResult(evidence.excerpt,evidence.additional[0].excerpt);
 const keys=['cita','coinciden','difieren','pendiente'];
 const complete=result&&Object.keys(result).length===keys.length&&keys.every(key=>typeof result[key]==='string')&&
  result.cita.length>=24&&result.cita.length<=220&&note.ref.text.includes(result.cita)&&
  new Set(keys.slice(1).map(key=>result[key])).size===3&&keys.slice(1).every(key=>result[key].length>=25&&result[key].length<=165&&/^[\p{L}\p{M} ,.:;¿?()«»“”–-]+$/u.test(result[key]));
 const reading=complete?'Cita documental ['+note.ref.id+']\n'+note.ref.text+'\n\nComprobación propuesta por OpenAI\n'+result[local.key]:
  'Fundamento pendiente. Revisa el numeral y pide otra lectura antes de usar la recomendación.';
 return 'Nota para [[CLIENTE]] · [[ASUNTO]]\n\nConsulta del abogado\n[[CONSULTA]]\n\nCotejo local de cantidades\n'+local.finding+'\n\n'+reading+'\n\nSoportes en orden de certificación y registro\n[[SOPORTE]]\n\n'+note.ref.summary;
}
