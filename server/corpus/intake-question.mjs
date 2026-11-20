import {requestsOriginAnnex,originAnnexSuggestions} from './origin-annex.mjs';
import {regulationSearch,chooseRegulationFocus} from './regulation-search.mjs';
import {remedySuggestions} from './remedy-index.mjs';
import {extractReference} from '../retrieval/references.mjs';
import {verifiedConceptSources} from '../retrieval/thesaurus.mjs';
import {requestedLegalJurisdiction} from '../assistant-router.mjs';
// Candidate lookup runs on the device. Only source identifiers and a closed
// set of research angles are used to reconstruct a question at the cloud boundary.
import {mentionedConcepts,selectedConcepts} from './question-concepts.mjs';
import {customsPassage,hasCustomsPassage,customsInstrumentForArticle,regulationLawId,regulationDirectory,regulationPassage} from './customs-edition.mjs';
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
export function questionCandidates(library,original,parts,reference=null,context=null){
 const candidates=new Map();
 const visible=parts.map(p=>p.label?' ':p.text).join('');
 const working=context?.manual?[original,...context.lines.map(line=>line.text)].join(' '):original;
 const terms=words(context?.manual?working:visible),localTerms=words(working),concepts=mentionedConcepts(working);
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
 const customs=(article,priority,regulation=false)=>{
  const {ref,passages}=regulation?regulationPassage(article):customsPassage(article);
  const source=(regulation?'reg-aduana-':'aduana-')+article;
  passages.forEach((p,i)=>{
   const exact=p.reference??ref;
   display(source,i,{...exact,locator:p.locator+' · '+exact.locator},p.quote+(p.condition?'\n\nCondición del encabezado\n'+p.condition:''),priority+rank(p.quote,localTerms),false,p.locator);
   if(regulation&&p.full)candidates.get(source+'/'+i).regulationFocus=chooseRegulationFocus(p.quote,working);
  });
 };
 const ranked=()=>[...candidates.values()].sort((a,b)=>b.score-a.score||a.key.localeCompare(b.key)).slice(0,8);
 const namedArticle=/\b(?:articulos?|arts?[.]?)\s+\d/u.test(normalize(original));
 const jurisdiction=requestedLegalJurisdiction(original);
 if(jurisdiction&&jurisdiction.id!=='MX-FED')return [];
 const named=extractReference(original);
 const namedRegulation=/\breglamento (?:de la ley aduanera|aduanero)\b/u.test(normalize(original));
 if(!reference&&namedRegulation&&namedArticle){
  const explicit=/\b(?:articulo|art[.]?)\s+(\d{1,3}(?:-[a-z])?)\b/u.exec(normalize(original));
  const instrument=customsInstrumentForArticle(original);
  if(instrument?.unavailable)return [];
  if(explicit)reference={lawId:instrument?.lawId??regulationLawId,articleId:explicit[1].toUpperCase(),jurisdiction:'MX-FED'};
  else return [];
 }
 if(!reference&&namedArticle&&named.lawId&&named.article&&!named.ambiguous)reference={lawId:named.lawId,articleId:named.article,jurisdiction:'MX-FED'};
 if(reference||namedArticle){
  if(!reference||reference.unavailable||reference.state)return [];
  for(const item of reference.multi?reference.refs:[reference]){
   if(item.jurisdiction!=='MX-FED')return [];
   if(item.lawId===regulationLawId){
    if(!regulationDirectory().some(row=>row.article===item.articleId))return [];
    customs(item.articleId,60,true);continue;
   }
   if((item.lawId==='MX-FED-LADUA'||item.titleKey==='ley aduanera')&&hasCustomsPassage(item.articleId)){
    customs(item.articleId,60);continue;
   }
   const row=item.lawId&&library?.lookupArticle({lawId:item.lawId,articleId:item.articleId});
   if(!row)return [];
   fromLibrary(row.sourceId,60);
  }
  return ranked();
 }
 for(const [i,ref] of originAnnexSuggestions(original).entries()){
  const part=ref.point,key=ref.sourceId+'/'+part;
  candidates.set(key,{key,citationId:ref.id,source:ref.sourceId,part,title:ref.title,label:ref.title+' · numeral '+part,
   locator:ref.locator,text:ref.text,score:130-i,partial:false});
 }
 if(requestsOriginAnnex(original))return ranked();
 if(namedRegulation){
  for(const [i,article] of regulationSearch(working).slice(0,6).entries())customs(article,60-i*4,true);
  return ranked();
 }
 // Match the prior operation as well as the legal event. A product defect
 // or a repair alone can belong to an ordinary civil or consumer dispute.
 if(!named.ambiguous&&(!named.lawId||named.lawId==='MX-FED-LADUA')){
  if(context?.state==='supported')customs('117',120);
  const q=normalize(original);
  const international=/\b(?:aduan\w*|importa\w*|exporta\w*|extranjero|pedimento)\b/u.test(q);
  if(international&&(!context||!['domestic','ambiguous'].includes(context.state))){
   if(/\b(?:sustitu\w*|reemplaz\w*|defectuos\w*)\b/u.test(q)&&/\b(?:importa\w*|retorn\w*)\b/u.test(q))customs('97',75);
   if(/\b(?:repara\w*|elabora\w*|transforma\w*)\b/u.test(q)&&/\b(?:exporta\w*|extranjero)\b/u.test(q))customs('117',75);
   if(/\b(?:mismo estado|sin modificacion(?:es)?|sin modificar)\b/u.test(q)&&/\b(?:exporta\w*|retorn\w*)\b/u.test(q))customs('115',75);
  }
 }
 if(context?.state&&context.state!=='supported'&&!candidates.size&&!named.lawId)return [];
 if(!named.lawId){
  for(const [i,{ref,part,partial}] of remedySuggestions(original).entries()){
   const key=ref.sourceId+'/'+part;
   candidates.set(key,{key,citationId:ref.id,source:ref.sourceId,part,title:ref.title,label:ref.title+' · punto '+part,locator:ref.locator,text:ref.text,score:100-i,partial});
  }
 }
 // Fixed trade topics can be recognised locally even when a whole sentence
 // was masked. Their private evidence and the search terms never enter the request.
 if(!named.ambiguous){
  for(const row of verifiedConceptSources(library,working,{jurisdiction:'MX-FED',lawId:named.lawId}).slice(0,8))fromLibrary(row.sourceId,25);
 }
 const topics=new Set([...suggestTradeReadings(working).map(t=>t.id),...concepts.map(c=>'lectura-'+c.topic)]);
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
