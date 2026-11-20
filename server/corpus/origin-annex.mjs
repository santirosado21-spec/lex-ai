import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const root=new URL('../../resources/trade/',import.meta.url);
const edition='3cea565ba5be5040878e9332bd0c3f06fc408ae6676c84161de34d613ce33b93';
const index='78ee0139ab7696298da644a557759be142c7e8c5ec8dd7f3e3551760c7b9e8ef';
const pageUrl='/fuentes/'+edition+'.pdf';
const site='https://www.gob.mx/cms/uploads/attachment/file/465786/05ESPProcedimientosdeorigen.pdf';
export const originAnnexId='tmec-5a-'+index.slice(0,12);
let entries;
function checked(file,expected){
 const bytes=readFileSync(new URL(file,root));
 if(createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('La edición del Anexo 5-A requiere cotejo.');
 return bytes;
}
export function originAnnexAttachment(path){
 return path===pageUrl?{bytes:checked('tmec-capitulo5-procedimientos.pdf',edition),type:'application/pdf'}:null;
}
export function originAnnexRef(source,point){
 if(source!==originAnnexId||!Number.isInteger(point)||point<1||point>9)throw Error('Elige un numeral del Anexo 5-A.');
 if(!entries){
  checked('tmec-capitulo5-procedimientos.pdf',edition);
  entries=JSON.parse(checked('tmec-anexo-5a.json',index));
 }
 const row=entries[point-1],anchor='#page='+row.pages[0];
 return Object.freeze({point,label:row.label,id:'TMEC-5A-'+point,sourceId:source,title:'T-MEC · Anexo 5-A · '+row.label,
  locator:'Numeral '+point+' · capítulo 5 · pp. '+row.pages.join('–'),text:row.text,
  localUrl:pageUrl+anchor,url:site+anchor,pdfSha256:edition,checkedOn:'2026-11-19',
  summary:'Coteja la fecha de la operación, la regla de origen del producto y las disposiciones mexicanas aplicables.'});
}
export function originAnnexDirectory(){
 return Array.from({length:9},(_,i)=>originAnnexRef(originAnnexId,i+1));
}
export function requestsOriginAnnex(question){
 const q=question.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
 const annex=/\banexo 5[- ]?a\b/u.test(q);
 return /\bt[- ]?mec\b/u.test(q)&&(annex||/certifica\w* (?:de )?origen/u.test(q));
}
export function originAnnexSuggestions(question){
 if(!requestsOriginAnnex(question))return [];
 const q=question.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
 const explicit=/\b(?:numeral|punto|elemento)\s+(\d+)\b/u.exec(q);
 if(explicit)return +explicit[1]>=1&&+explicit[1]<=9?[originAnnexRef(originAnnexId,+explicit[1])]:[];
 const words=q.match(/[a-z]{4,}/gu)??[];
 const weight=ref=>{
  const title=ref.title.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().match(/[a-z]+/gu);
  return words.filter(w=>title.includes(w)).length;
 };
 return originAnnexDirectory().sort((a,b)=>weight(b)-weight(a));
}
