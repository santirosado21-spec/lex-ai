import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root=new URL('../../resources/trade/',import.meta.url);
const pdfHash='955510d7ea82cf42d18c72e3146f999af254c0fda5eda3f12a1fd1c10e9864ce';
const indexHash='87266acfe1fc9c4e7b110250e4cce5988916b672cc933792952178c352c5cc2c';
const rowsHash='5266d43b881eb9a3bc7fc33de9232549ddc5e96ec7f889a717747e1f8512d91a';
const official='https://www.diputados.gob.mx/LeyesBiblio/pdf/LIGIE_2022.pdf';
const history='https://www.diputados.gob.mx/LeyesBiblio/ref/ligie_2022.htm';
export const tariffPdfPath='/fuentes/'+pdfHash+'.pdf';
const checkedRows=new Set(['0101.29.02@2','0101.29.03@2','0102.29.02@2','8413.70.07@631','8413.81.01@631','8413.81.02@631','8414.30.01@631','8414.30.05@631','9803.00.01@894']);
const normal=s=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
let edition;
function readChecked(name,hash){
 const bytes=readFileSync(new URL(name,root));
 if(createHash('sha256').update(bytes).digest('hex')!==hash)throw Error('La edición de la tarifa requiere cotejo.');
 return bytes;
}
export function tariffPdf(){return readChecked('ligie-2022.pdf',pdfHash);}
function catalog(){
 if(edition)return edition;
 tariffPdf();
 const {locations,sha256}=JSON.parse(readChecked('ligie-paginas.json',indexHash));
 if(sha256!==pdfHash)throw Error('Los localizadores corresponden a otra edición.');
 const rows=new Map(),terms=[];
 for(const line of readChecked('ligie-renglones.jsonl',rowsHash).toString('utf8').trimEnd().split('\n')){
  const row=Object.freeze(JSON.parse(line));
  rows.set(row.code+'@'+row.page,row);
  terms.push({row,words:normal(row.description)});
 }
 edition={locations,rows,terms};return edition;
}
function canonicalCode(value){
 if(typeof value!=='string')return null;
 if(/^\d{4}\.\d{2}\.\d{2}$/u.test(value))return value;
 return /^\d{8}$/u.test(value)?value.slice(0,4)+'.'+value.slice(4,6)+'.'+value.slice(6):null;
}
export function tariffResult(value,page){
 const code=canonicalCode(value),{locations,rows}=catalog();
 if(!code||!Number.isInteger(page)||!Object.hasOwn(locations,code)||!locations[code].includes(page))
  throw Error('Selecciona una aparición de la fracción en la edición local.');
 const id=code+'@'+page,row=rows.get(id)??null,reviewed=checkedRows.has(id);
 const unresolved=(row?.adjacent??[]).filter(p=>!row?.continued?.includes(p));
 const complete=row&&row.description.length>=24&&row.description.length<=420&&
  row.description.endsWith('.')&&!unresolved.length&&!/\b(?:DOF|arancel|derogad[ao])\b/iu.test(row.description);
 return {code,page,row,reviewed,canFollow:Boolean(row&&(reviewed||complete)),pages:locations[code],
  localUrl:tariffPdfPath+'#page='+page,historyUrl:history,url:official+'#page='+page};
}
export function searchTariff(query,offset){
 if(typeof query!=='string'||query.trim().length<2||query.length>90||!Number.isSafeInteger(offset)||offset<0)
  throw Error('Busca por fracción de ocho dígitos o por palabras de la descripción.');
 const value=query.trim(),code=canonicalCode(value),{locations,terms}=catalog();
 let matches;
 if(code)matches=(locations[code]??[]).map(page=>({code,page}));
 else{
  if(!/^[\p{L}\p{M}][\p{L}\p{M}\d -]*$/u.test(value))throw Error('Escribe los ocho dígitos de la fracción o una descripción.');
  const words=normal(value).split(/\s+/u);
  matches=terms.filter(t=>words.every(w=>t.words.includes(w))).map(t=>t.row);
 }
 return {total:matches.length,results:matches.slice(offset,offset+12).map(r=>tariffResult(r.code,r.page))};
}
export function labeledTariffCodes(original){
 const matches=[];
 for(const [index,line] of original.split('\n').entries()){
  for(const hit of line.matchAll(/\bfracci[oó]n(?: arancelaria)?\s*(?::|propuesta\s*:?)?\s*(\d{4}\.\d{2}\.\d{2}|\d{8})(?![\d.]\d|\d)/giu)){
   const code=canonicalCode(hit[1]);
   if(!matches.some(m=>m.code===code)&&Object.hasOwn(catalog().locations,code))matches.push({code,line:index+1,excerpt:line.trim().slice(0,320)});
  }
 }
 return matches;
}
export function tariffReference(code,page){
 const hit=tariffResult(code,page);
 const printed=[page,...(hit.row?.continued??[])].sort((a,b)=>a-b);
 const location=printed.length===1?'p. '+page:'pp. '+printed.join(' y ');
 return Object.freeze({id:'LIGIE-'+hit.code+'-p'+page,title:'LIGIE · '+hit.code,
  locator:'Fracción '+hit.code+' · '+location+' de 894 · ejemplar con modificaciones al 13-10-2026',
  checkedOn:'2026-11-19',pdfSha256:pdfHash,url:hit.url,localUrl:hit.localUrl,historyUrl:history,
  text:hit.row?.description??'',summary:(hit.reviewed?'Celdas cotejadas con la página impresa. ':hit.row?'Transcripción por dos extractores. ':'Referencia en el índice de páginas. ')+'Verificar la clasificación, el decreto y los transitorios aplicables a la fecha de la operación.'});
}
