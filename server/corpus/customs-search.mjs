import {customsDirectory,customsPassage} from './customs-edition.mjs';
const fold=text=>text.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('es');
// Only pinned, selected passages are searchable, not the full statute. Search
// terms stay local and are never used to construct a provider request.
export function searchCustomsPassages(query){
 if(typeof query!=='string'||query.length>180)throw Error('Busca con un máximo de 180 caracteres.');
 const terms=[...new Set(fold(query).match(/[\p{L}\p{N}]+/gu)??[])];
 if(!terms.length)return [];
 const results=[];
 for(const row of customsDirectory()){
  row.passages.forEach((passage,part)=>{
   const words=new Set(fold(passage.text).match(/[\p{L}\p{N}]+/gu));
   if(!terms.every(term=>words.has(term)))return;
   const source=customsPassage(row.article),selected=source.passages[part];
   results.push({article:row.article,part,page:passage.page,locator:selected.locator,text:passage.text,
    localUrl:row.localUrl.split('#')[0]+'#page='+passage.page,condition:selected.condition??null,warning:source.ref.summary});
  });
 }
 return results;
}
