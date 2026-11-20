import {operationDate} from './permit-question.mjs';
// Curated public passages. Only an edition identifier and numbered point select text.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const base=new URL('../../resources/trade/',import.meta.url);
const digest='681ea01e963519683ce12eb53e32e3ec3b2c274c9995b2b1cf8c782f90311624';
const summaries={
 inicio:'Esta etapa abrió la investigación. Coteja los actos posteriores para la fecha de la operación.',
 preliminar:'El punto 298 fijó cuatro meses desde la entrada en vigor de la preliminar. Comprueba los actos intermedios antes de aplicar la cuota a una fecha posterior.',
 final:'Coteja el producto y las características técnicas de los puntos 3 y 156, el origen del punto 383 y la fecha del punto 386. La fracción por sí sola resulta insuficiente.',
};
let corpus;
function checked(file,hash){
 const bytes=readFileSync(new URL(file,base));
 if(createHash('sha256').update(bytes).digest('hex')!==hash)throw Error('La publicación de defensa comercial requiere cotejo.');
 return bytes;
}
function stages(){return corpus??=JSON.parse(checked('ad29-pasajes.json',digest));}
const sourceId=stage=>'ad29-'+stage.id+'-'+digest.slice(0,12);
export function remedyReference(source,point){
 const stage=stages().find(s=>sourceId(s)===source);
 const row=stage?.points.find(p=>p.point===point);
 if(!row)throw Error('Selecciona un punto publicado del expediente AD_29-24.');
 const page=stage.pages[row.page];
 return Object.freeze({remedy:true,id:'SE-AD29-'+stage.id.toUpperCase()+'-'+point,sourceId:source,title:'AD_29-24 · '+stage.title+' · '+row.label,
  locator:'Punto '+point+' · DOF '+stage.published+' · página '+row.page,url:stage.url,localUrl:'/fuentes/'+page.sha256+'.pdf',
  text:row.text,summary:summaries[stage.id],checkedOn:'2026-11-19',pdfSha256:stage.editionSha256});
}
export function remedyCatalog(){
 return stages().map(stage=>({sourceId:sourceId(stage),title:stage.title,published:stage.published,effective:stage.effective,
  summary:summaries[stage.id],points:stage.points.map(p=>({number:p.point,label:p.label,...remedyReference(sourceId(stage),p.point)}))}));
}
export function remedyAttachment(path){
 for(const stage of stages()){
  const page=Object.values(stage.pages).find(p=>path==='/fuentes/'+p.sha256+'.pdf');
  if(page)return {type:'application/pdf',bytes:checked(page.file,page.sha256)};
 }
 return null;
}
export function remedyPeriod(date){
 if(!/^\d{4}-\d{2}-\d{2}$/u.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw Error('Indica una fecha válida.');
 if(date<'2025-03-06')return {id:'before',message:'La operación precede a la entrada en vigor del inicio de esta investigación.'};
 if(date<'2025-12-30')return {id:'inicio',message:'La resolución de inicio ya se había publicado. La preliminar entró en vigor el 30 de diciembre de 2025.'};
 if(date<'2026-04-30')return {id:'preliminar',message:'Revisa los puntos 296, 298 y 306 de la preliminar y las condiciones documentales de la operación.'};
 if(date<'2026-09-05')return {id:'interval',message:'El punto 298 limitó la provisional a cuatro meses. La definitiva entró en vigor el 5 de septiembre. Para esta fecha hace falta comprobar el cómputo y cualquier acto intermedio.'};
 if(date<='2026-11-19')return {id:'final',message:'Revisa la resolución final, la descripción del producto y la prueba de origen. Comprueba también si hubo actos posteriores para esa fecha.'};
 return {id:'later',message:'La fecha es posterior al corte del 19 de noviembre de 2026. Localiza las publicaciones posteriores antes de determinar una cuota.'};
}
export function remedySuggestions(question){
 const text=question.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
 const named=/\bad[_ -]?29[-/]24\b/u.test(text);
 const product=/\b(?:perfiles?|barras?)\b/u.test(text)&&/\baluminio\b/u.test(text);
 if(!named&&(!product||!/antidumping|dumping|cuotas? compensatorias?|practicas? desleales/u.test(text)))return [];
 if(/\bad[_ -]?(?!29[-/]24\b)\d+[-/]\d+\b/u.test(text))return [];
 const hollow=/\bhuec[oa]s?\b/u.test(text)&&!/\bno huec[oa]s?\b/u.test(text);
 const specific=/herramientas?|escaleras?|niveles|templad[oa]|dureza|tolerancia|\bt[56]\b/u.test(text);
 const timing=/cuatro meses|duracion|vencimiento|intermedi[oa]|vigencia provisional/u.test(text);
 const origin=/origen|procedencia/u.test(text);
 const date=operationDate(text),period=date?remedyPeriod(date).id:null;
 if(period==='before'||period==='later')return [];
 const explicit=/\bpunto\s+(\d+)\b/u.exec(text);
 const stage= /preliminar|provisional/u.test(text)?'preliminar':/apertura|resolucion de inicio|inicio de la investigacion/u.test(text)?'inicio':/definitiva|resolucion final/u.test(text)?'final':period??'final';
 const points=explicit?[Number(explicit[1])]:period==='interval'?[298,306,386]:stage==='inicio'?[183,191]:
  stage==='preliminar'?(timing?[298,306,296]:origin?[301,296,298]:[296,298,306]):
  hollow?[3]:specific?[156,3]:origin?[383,381,3]:[381,3,156,386];
 return points.flatMap(n=>{
  const row=stages().find(s=>s.points.some(p=>p.point===n));
  if(!row)return [];
  return {part:n,ref:remedyReference(sourceId(row),n),partial:hollow};
 });
}
