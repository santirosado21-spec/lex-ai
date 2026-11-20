import {remedySuggestions} from './remedy-index.mjs';
import {extractReference} from '../retrieval/references.mjs';
import {verifiedConceptSources} from '../retrieval/thesaurus.mjs';
import {requestedLegalJurisdiction} from '../assistant-router.mjs';
// Candidate lookup runs on the device. Only source identifiers and a closed
// set of research angles are used to reconstruct a question at the cloud boundary.
import {mentionedConcepts,selectedConcepts} from './question-concepts.mjs';
import {customsPassage} from './customs-edition.mjs';
import {loadResearchPassage} from './intake-research.mjs';
import {loadTradeReading,suggestTradeReadings} from './intake-trade-reading.mjs';

const normalize=value=>value.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
const ignored=new Set('que quien quienes cuyo cuya con sin los las del una uno unos unas por sus son ser sea hay han mis ese esa entre segun cuanto cuantos para como esta este estos estas debe deben puedo puede pueden sobre tiene tenemos cuando donde revisar acredita acreditar necesito cliente expediente saber corresponde cuales cual aplican aplicar aplicable requisitos excepciones documentos solicita solicitar verificar pregunta deberia documento debo permite permiten comprobar'.split(' '));
function words(text){
 return [...new Set((normalize(text).match(/\p{L}{3,40}/gu)??[]).filter(w=>!ignored.has(w)))].slice(0,28);
}
function rank(text,terms){
 const tokens=new Set(normalize(text).match(/\p{L}+/gu));
 return terms.reduce((score,term)=>score+(tokens.has(term)?1:0),0);
}
export function questionCandidates(library,original,parts,reference=null){
 const candidates=new Map();
 const visible=parts.map(p=>p.label?' ':p.text).join('');
 const terms=words(visible),localTerms=words(original),concepts=mentionedConcepts(original);
 const focus=concepts.map(c=>c.id);
 const display=(source,part,ref,text,score,partial=false,section='')=>{
  const key=source+'/'+part;
  score+=4*selectedConcepts(focus,text).length;
  if((candidates.get(key)?.score??-1)>=score)return;
  candidates.set(key,{key,citationId:ref.id,source,part,title:ref.title,label:'Art. '+ref.article+' · '+(section||'pasaje '+(part+1))+' · '+ref.title,locator:ref.locator,text,score,partial});
 };
 function fromLibrary(source,priority,partial=false){
  const first=loadResearchPassage(library,source,0);
  let best=first,score=rank(first.ref.text,terms);
  for(let part=1;part<first.count;part++){
   const candidate=loadResearchPassage(library,source,part),value=rank(candidate.ref.text,terms);
   if(value>score){best=candidate;score=value;}
  }
  display(source,best.part,best.ref,best.ref.text,priority+score,partial);
 }
 const customs=(article,priority)=>{
  const {ref,passages}=customsPassage(article);
  passages.forEach((p,i)=>display('aduana-'+article,i,{...ref,locator:p.locator+' · '+ref.locator},p.quote+(p.condition?'\n\nCondición del encabezado\n'+p.condition:''),priority+rank(p.quote,localTerms),false,p.locator));
 };
 const ranked=()=>[...candidates.values()].sort((a,b)=>b.score-a.score||a.key.localeCompare(b.key)).slice(0,8);
 const namedArticle=/\b(?:articulos?|arts?[.]?)\s+\d/u.test(normalize(original));
 const jurisdiction=requestedLegalJurisdiction(original);
 if(jurisdiction&&jurisdiction.id!=='MX-FED')return [];
 const named=extractReference(original);
 if(!reference&&namedArticle&&named.lawId&&named.article&&!named.ambiguous)reference={lawId:named.lawId,articleId:named.article,jurisdiction:'MX-FED'};
 if(reference||namedArticle){
  if(!reference||reference.unavailable||reference.state)return [];
  for(const item of reference.multi?reference.refs:[reference]){
   if(item.jurisdiction!=='MX-FED')return [];
   if((item.lawId==='MX-FED-LADUA'||item.titleKey==='ley aduanera')&&['36','36-A','64','65'].includes(item.articleId)){
    customs(item.articleId,60);continue;
   }
   const row=item.lawId&&library?.lookupArticle({lawId:item.lawId,articleId:item.articleId});
   if(!row)return [];
   fromLibrary(row.sourceId,60);
  }
  return ranked();
 }
 if(!named.lawId){
  for(const [i,{ref,part,partial}] of remedySuggestions(original).entries()){
   const key=ref.sourceId+'/'+part;
   candidates.set(key,{key,citationId:ref.id,source:ref.sourceId,part,title:ref.title,label:ref.title+' · punto '+part,locator:ref.locator,text:ref.text,score:100-i,partial});
  }
 }
 // Fixed trade topics can be recognised locally even when a whole sentence
 // was masked. Their private evidence and the search terms never enter the request.
 if(!named.ambiguous){
  for(const row of verifiedConceptSources(library,original,{jurisdiction:'MX-FED',lawId:named.lawId}).slice(0,8))fromLibrary(row.sourceId,25);
 }
 const topics=new Set([...suggestTradeReadings(original).map(t=>t.id),...concepts.map(c=>'lectura-'+c.topic)]);
 for(const topic of topics){
  const reading=loadTradeReading(library,topic);
  for(const ref of reading.refs){
   if(named.lawId&&!ref.id.startsWith(named.lawId+'-'))continue;
   if(ref.sourceId){fromLibrary(ref.sourceId,35);continue;}
   customs(ref.article,30);
  }
 }
 if(library&&terms.length){
  const queries=terms.slice(0,7).flatMap((term,i,arr)=>arr[i+1]?[term+' '+arr[i+1]]:[]);
  if(!queries.length)queries.push(terms[0]);
  const sources=new Set();
  for(const query of queries)for(const row of library.search({query,limit:2,lawId:named.lawId??undefined}).sources)sources.add(row.sourceId);
  const partial=sources.size===0&&terms.length>1;
  if(partial){
   for(const term of terms.slice(0,7))for(const row of library.search({query:term,limit:2,lawId:named.lawId??undefined}).sources)sources.add(row.sourceId);
  }
  for(const source of sources)fromLibrary(source,0,partial);
 }
 return ranked();
}
