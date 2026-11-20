// Measure a hypothetical complete packet locally. All expected values are
// evaluated after intake. There is no provider and there is no cloud dispatch.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(process.argv.find(a=>a.startsWith('--app='))?.slice(6)??'.');
const runtime=p=>import(pathToFileURL(join(root,p)));
const {inspectLocalDocument}=await runtime('server/intake-import.mjs');
const {bindReviewedDocument,openReviewedDocument}=await runtime('server/privacy/intake-document-map.mjs');
const {knownParties}=await runtime('server/intake-sources.mjs');
const {questionLines}=await runtime('server/corpus/intake-question-lines.mjs');
const file=process.argv.slice(2).find(a=>!a.startsWith('--'))??'eval/privacy-trade/dialogo-valoracion-r22.json';
const example=JSON.parse(await readFile(file,'utf8'));
const saved={firm:{id:'estudio',name:'Estudio ficticio'},entry:{id:example.case,title:'Ensayo local',client:example.client},intake:{supports:[]}};
const results=[],documents=[];
for(const [index,row] of example.entries.entries()){
 const {protection}=await inspectLocalDocument({extension:'txt',base64:Buffer.from(row.text).toString('base64'),review:true},{
  knownIdentities:knownParties(saved),fetchImpl:(url,opts)=>{
   assert.equal(url,'http://127.0.0.1:11434/api/chat');return fetch(url,opts);
  }
 });
 assert.ok(protection.available&&!protection.contextUnavailable,'Revisión incompleta en '+row.kind);
 const document=bindReviewedDocument(protection,saved.firm.id,saved.entry.id);
 assert.equal(openReviewedDocument(document,saved.firm.id,saved.entry.id).original,row.text);
 const file={id:'muestra-'+index,label:row.kind,document};
 documents.push(file);
 if(row.kind==='pregunta'||row.kind==='seguimiento')continue;
 if(!saved.intake.primarySource){saved.intake.primarySource=file;saved.intake.document=document;}else saved.intake.supports.push(file);
}
const aliases=new Map(),appearances=new Map();
for(const [index,row] of example.entries.entries()){
 const source=documents[index];
 // Questions are a transient projection onto the existing matter. A later
 // question cannot retroactively repair an earlier turn.
 const view=index<saved.intake.supports.length+1?saved:{...saved,intake:{...saved.intake,supports:[...saved.intake.supports,source]}};
 const lines=questionLines(view,source.id);
 const mask=new Array(row.text.length).fill(null);
 const offsets=[0];
 for(const match of row.text.matchAll(/\n/gu))offsets.push(match.index+1);
 for(const line of lines){
  let start=offsets[line.evidence.line-1];
  for(const part of line.parts){
   const raw=part.text??part.value;
   if(part.value!==undefined){
    if(part.token&&!aliases.has(part.token))aliases.set(part.token,aliases.size+1);
    mask.fill(part.token?aliases.get(part.token):'hidden',start,start+raw.length);
   }
   start+=raw.length;
  }
 }
 function inspect(term){
  const start=row.text.indexOf(term);
  assert.ok(start>=0&&row.text.indexOf(term,start+1)<0,'Anotación ambigua');
  return Array.from(term.matchAll(/[\p{L}\p{N}]/gu),m=>mask[start+m.index]);
 }
 for(const term of row.private){
  const spans=inspect(term),marker=spans[0];
  const exact=lines.flatMap(l=>l.parts).find(p=>p.value===term&&p.token);
  if(!appearances.has(term))appearances.set(term,[]);
  appearances.get(term).push(exact&&Number.isInteger(marker)&&spans.every(n=>n===marker)?marker:null);
 }
 results.push({kind:row.kind,privateMiss:row.private.filter(s=>inspect(s).includes(null)),
  clueMiss:row.clues.filter(s=>inspect(s).includes(null)),factMiss:row.facts.filter(s=>inspect(s).some(m=>m!==null)),
  offeredCloudLines:lines.filter(l=>l.cloud).length});
}
const links=[...appearances.entries()].filter(([,v])=>v.length>=2).map(([value,values])=>({value,appearances:values.length,consistent:values.every(n=>n!==null&&n===values[0])}));
const total=key=>example.entries.reduce((sum,e)=>sum+e[key].length,0);
console.log(JSON.stringify({case:example.case,restored:documents.length,private:total('private'),clues:total('clues'),facts:total('facts'),results,links,cloudRequests:0},null,2));
