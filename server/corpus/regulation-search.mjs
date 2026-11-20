// Rank complete articles on this device. The query never enters a cloud request.
import {regulationDirectory} from './customs-edition.mjs';
const normalize=s=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
const stop=new Set('del las los con por para sin como que una unos unas son sea ante segun sobre cual cuales este esta estos estas debe deben puede pueden informacion revisar acredita comprobar dispone requisitos articulo articulos ley reglamento aduanera aduanero efectos caso mediante forma ser sus doy quiero necesito tiene tienen aplica tiene permite establece mexicano'.split(' '));
function stem(word){
 if(word.length<6)return word;
 if(word.endsWith('iones'))return word.slice(0,-5)+'ion';
 if(/(?:ores|ales|ares|iles|enes)$/u.test(word))return word.slice(0,-2);
 return word.endsWith('s')?word.slice(0,-1):word;
}
function terms(text){
 const words=normalize(text).match(/[a-z]{3,}/gu)??[];
 return [...new Set(words.filter(w=>!stop.has(w)).map(stem))];
}
let index,frequency;
function build(){
 if(index)return;
 frequency=new Map();
 index=regulationDirectory().map(row=>{
  const text=row.passages.at(-1).text;
  const words=new Set(terms(text));
  for(const word of words)frequency.set(word,(frequency.get(word)??0)+1);
  return {article:row.article,words,repealed:row.repealed};
 });
}
export function regulationSearch(query){
 if(typeof query!=='string'||!query.trim()||query.length>2400)return [];
 build();
 const id=/^(?:art(?:[ií]culo|\.)?\s*)?(\d{1,3}(?:-[a-z])?)$/iu.exec(query.trim());
 if(id)return index.filter(r=>r.article===id[1].toUpperCase()).map(r=>r.article);
 const words=terms(query).slice(0,36);
 const minMatches=Math.min(3,words.length);
 if(!minMatches)return [];
 const hits=[];
 for(const row of index){
  if(row.repealed)continue;
  const matches=words.filter(w=>row.words.has(w));
  if(matches.length<minMatches)continue;
  const score=matches.reduce((sum,w)=>sum+Math.log((index.length+1)/(frequency.get(w)+1)),0);
  hits.push({article:row.article,score:score*matches.length/(matches.length+2)});
 }
 return hits.sort((a,b)=>b.score-a.score||a.article.localeCompare(b.article,'es',{numeric:true})).map(h=>h.article);
}

function sentences(text){
 return Array.from(new Intl.Segmenter('es',{granularity:'sentence'}).segment(text),row=>row.segment.trim())
  .flatMap(s=>s.split(/(?:;\s+|:\s+|,\s+[yo]\s+)(?=[a-z]\) )/u))
  .filter(s=>s.length>=24&&s.length<=850&&!/^Artículo (?:derogado|adicionado|reformado) DOF/u.test(s));
}
export function chooseRegulationFocus(text,query){
 build();
 const words=terms(query).filter(w=>frequency.has(w)&&frequency.get(w)<index.length/3);
 let best=-1,high=0;
 for(const [i,sentence] of sentences(text).entries()){
  const found=new Set(terms(sentence)),hits=words.filter(w=>found.has(w));
  if(hits.length<2&&!hits.some(w=>frequency.get(w)<4&&w.length>=6))continue;
  const score=hits.reduce((sum,w)=>sum+Math.log(index.length/frequency.get(w)),0);
  if(score>high){high=score;best=i;}
 }
 return best<0?undefined:best;
}
export function regulationFocusText(text,id){
 if(id===undefined)return '';
 const parts=sentences(text);
 if(!Number.isInteger(id)||id<0||id>=parts.length)throw Error('El fragmento del Reglamento cambió.');
 return parts[id];
}
