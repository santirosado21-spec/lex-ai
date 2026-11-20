import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root=new URL('../../resources/trade/',import.meta.url);
const chamber='https://www.diputados.gob.mx/LeyesBiblio/ref/ligie_2022/LIGIE_2022_acuerdo02_';
const historyUrl='https://www.diputados.gob.mx/LeyesBiblio/ref/ligie_2022.htm';
export const nicoEdition='86a16096525b0fdbc0d3cd5005ae44fbcbce356c6a9ba7ad16684aef956acd46';
const indexDigest='14cff9f9d234b2608b8926d6aad37fa748f481c205af93be0e7811adc454706a';
const sources=[
 ['22ago22','22-08-2022','c5fd56aa5e6d39623539e87ad15336f55d166b0649e616f0c3cedab682c21460'],
 ['mod01_30jun23','30-06-2023','4cc5f6f38c1be002554ae66c3e6870e4541b5489b95850d6e060dfd9b13ecda9'],
 ['mod02_22mar24','22-03-2024','f0906faff2fe6510f26798578f9993ad54d0014a4850983144c5bdbb2a317420'],
];
const bookUrl='https://www.snice.gob.mx/~oracle/SNICE_DOCS/NICO-ABRIL24-LIGIE_20240415-20240415.XLSX';
const local=(hash,ext)=>'/fuentes/'+hash+'.'+ext;
const normalize=s=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
function checked(name,hash){
 const bytes=readFileSync(new URL(name,root));
 if(createHash('sha256').update(bytes).digest('hex')!==hash)throw Error('La fuente NICO requiere cotejo.');
 return bytes;
}
export function nicoAttachment(path){
 if(path===local(nicoEdition,'xlsx'))return {bytes:checked('nico-abril24.xlsx',nicoEdition),type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',name:'NICO-SNICE-abril-2024.xlsx'};
 const source=sources.find(([, ,hash])=>path===local(hash,'pdf'));
 return source?{bytes:checked('nico-'+source[0]+'.pdf',source[2]),type:'application/pdf'}:null;
}
let edition;
function catalog(){
 if(edition)return edition;
 const entries=new Map();
 for(const line of checked('nico-abril24.jsonl',indexDigest).toString('utf8').trimEnd().split('\n')){
  const [code,nico,description,excelRow,source,page,literal]=JSON.parse(line);
  const [suffix,date,hash]=sources[source];
  const row=Object.freeze({code,nico,description,excelRow,date,page,literal,edition:nicoEdition,
   url:chamber+suffix+'.pdf#page='+page,localUrl:local(hash,'pdf')+'#page='+page,bookUrl,localBook:local(nicoEdition,'xlsx')});
  entries.set(code+'.'+nico,{row,words:normalize(description)});
 }
 edition=entries;return entries;
}
export function nicoRow(code,nico){
 if(typeof code!=='string'||typeof nico!=='string'||!/^\d{4}\.\d{2}\.\d{2}$/u.test(code)||!/^\d{2}$/u.test(nico))
  throw Error('Selecciona la fracción y los dos dígitos del NICO.');
 const row=catalog().get(code+'.'+nico)?.row;
 if(!row)throw Error('La clave no figura en esta edición del NICO.');
 return row;
}
export function searchNico(query,offset){
 if(typeof query!=='string'||query.trim().length<2||query.length>90||!Number.isSafeInteger(offset)||offset<0)
  throw Error('Escribe una fracción, una clave completa o palabras de la descripción.');
 const input=query.trim(),catalogue=catalog();
 let found;
 if(/^(?:\d{8}(?:\d{2})?|\d{4}\.\d{2}\.\d{2}(?:[. -]\d{2})?)$/u.test(input)){
  const digits=input.replace(/\D/gu,''),code=digits.slice(0,4)+'.'+digits.slice(4,6)+'.'+digits.slice(6,8);
  found=digits.length===10?[catalogue.get(code+'.'+digits.slice(8))].filter(Boolean):
   [...catalogue.values()].filter(({row})=>row.code===code);
 }else{
  if(!/^[\p{L}\p{M}][\p{L}\p{M}\d -]*$/u.test(input))throw Error('Usa ocho o diez dígitos, o palabras de la descripción.');
  const terms=normalize(input).split(/\s+/u);
  found=[...catalogue.values()].filter(({words})=>terms.every(term=>words.includes(term)));
 }
 return {total:found.length,results:found.slice(offset,offset+12).map(({row})=>row)};
}
export function nicoReference(row){
 return Object.freeze({id:'NICO-'+row.code+'-'+row.nico,title:'NICO '+row.code+' · '+row.nico,
  locator:'SNICE abril 2024 · fila '+row.excelRow+' · DOF '+row.date+' · PDF p. '+row.page,
  url:row.url,localUrl:row.localUrl,historyUrl,checkedOn:'2026-11-19',text:row.description,
  summary:'Descripción del catálogo informativo. Cotejar las anotaciones y la vigencia para la fecha de la operación.'});
}
