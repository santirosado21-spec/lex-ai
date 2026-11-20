// Synthetic local evaluation. Every occurrence is uniquely annotated in each document.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv.find(s=>s.startsWith('--app='))?.slice(6)??'.');
const runtime=name=>import(pathToFileURL(path.join(root,name)));
const {inspectLocalDocument}=await runtime('server/intake-import.mjs');
const {bindReviewedDocument,openReviewedDocument}=await runtime('server/privacy/intake-document-map.mjs');
const {questionLines}=await runtime('server/corpus/intake-question-lines.mjs');
const file=process.argv.slice(2).find(s=>!s.startsWith('--'))??'eval/privacy-trade/expedientes-pareados-dev.json';
const bundles=JSON.parse(await readFile(file,'utf8'));
const counters=()=>({documents:0,private:0,covered:0,clues:0,hidden:0,facts:0,intact:0,pairs:0,pairsWithResidualClues:0,pairsWithoutReview:0});
const totals={individual:counters(),joint:counters(),restored:0,completed:0,offeredCloudLines:0};
const rows=[];
function score(item,mask,complete,total){
 function missing(terms,hide){
  return terms.filter(term=>{
   const i=item.text.indexOf(term);
   if(i<0||item.text.indexOf(term,i+1)!==-1)throw Error('Anotación ausente o repetida.');
   return !complete||!mask.slice(i,i+term.length).every((v,n)=>!/[\p{L}\p{N}]/u.test(term[n])||v===hide);
  });
 }
 const privateMiss=missing(item.private,true),clueMiss=missing(item.clues,true),factMiss=missing(item.facts,false);
 total.documents++;total.private+=item.private.length;total.covered+=item.private.length-privateMiss.length;
 total.clues+=item.clues.length;total.hidden+=item.clues.length-clueMiss.length;total.facts+=item.facts.length;total.intact+=item.facts.length-factMiss.length;
 return {privateMiss,clueMiss,factMiss};
}
for(const bundle of bundles){
 const firm={id:'firma-sintetica',name:'Despacho de laboratorio'},entry={id:bundle.id,title:'Caso ficticio',client:'Importador ficticio'};
 const docs=[],known=[],details=[];
 for(const [i,item] of bundle.documents.entries()){
  const {protection}=await inspectLocalDocument({extension:'txt',review:true,base64:Buffer.from(item.text).toString('base64')},{knownIdentities:known});
  const complete=Boolean(protection.available&&!protection.contextUnavailable);
  const mask=Array(item.text.length).fill(false);
  let restored=false;
  if(protection.available){
   for(const part of protection.parts)if(part.label)mask.fill(true,part.start,part.end);
   const document=bindReviewedDocument(protection,firm.id,entry.id),view=openReviewedDocument(document,firm.id,entry.id);
   known.push(...view.tokens.map(t=>t.value));restored=view.original===item.text;
   docs.push({id:'doc-'+i,label:'Soporte '+(i+1),document});
  }
  totals.completed+=Number(complete);totals.restored+=Number(restored);
  details.push({complete,restored,individual:score(item,mask,complete,totals.individual)});
 }
 const available=docs.length===bundle.documents.length;
 const saved=available?{firm,entry,intake:{primarySource:docs[0],document:docs[0].document,supports:docs.slice(1)}}:null;
 for(const [i,item] of bundle.documents.entries()){
  const mask=Array(item.text.length).fill(false);
  if(available)for(const row of questionLines(saved,docs[i].id)){
   const absolute=item.text.split('\n').slice(0,row.evidence.line-1).reduce((n,l)=>n+l.length+1,0);
   let cursor=absolute,restored='';
   for(const part of row.parts){
    const literal=part.text??part.value;
    if(part.value!==undefined)mask.fill(true,cursor,cursor+literal.length);
    restored+=literal;cursor+=literal.length;
   }
   if(restored!==row.evidence.excerpt)throw Error('La línea no se pudo restituir.');
   totals.offeredCloudLines+=Number(row.cloud);
  }
  details[i].joint=score(item,mask,available&&details[i].complete,totals.joint);
 }
 if(bundle.documents.filter(doc=>doc.clues.length).length>=2){
  for(const kind of ['individual','joint']){
   totals[kind].pairs++;
   if(!details.every(d=>d.complete))totals[kind].pairsWithoutReview++;
   else if(details.filter(d=>d[kind].clueMiss.length).length>=2)totals[kind].pairsWithResidualClues++;
  }
 }
 rows.push({case:bundle.id,details});
}
console.log(JSON.stringify({totals,rows},null,2));
