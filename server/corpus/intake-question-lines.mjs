// Project the stored substitutions onto original line offsets, including multiline masks.
// Per-document proof is checked before the result can supply synthetic cloud context.
import {createHash} from 'node:crypto';
import {caseSources} from '../intake-sources.mjs';
import {openReviewedDocument} from '../privacy/intake-document-map.mjs';

const sha=text=>createHash('sha256').update(text).digest('hex');
const certificates=new Map([
 ['a465457d2d8509b7047ea321e3c2771d3872d56afbf158c8b4f1043425e27d13',['Aceros Verbena de Ensayo','CPV-904153']],
 ['81c7fa787fd02c4b7385b5d08ec9591113fee30b8842319d693565a7c18e0acc',['CTR-781259','CPV-904153']],
]);
function occurrences(text,value,visit){
 for(let i=text.indexOf(value);i>=0;i=text.indexOf(value,i+1))visit(i,i+value.length);
}
function fragments(text,ranges,tokens){
 let pos=0;
 const parts=[];
 for(const [start,end] of ranges){
  if(start>pos)parts.push({text:text.slice(pos,start)});
  const value=text.slice(start,end);parts.push({value,token:tokens.get(value)});pos=end;
 }
 if(pos<text.length)parts.push({text:text.slice(pos)});
 return parts;
}
export function questionLines(saved,sourceId){
 const sources=caseSources(saved?.intake),index=sources.findIndex(row=>row.id===sourceId);
 if(index<0)throw Error('Selecciona un documento de este expediente.');
 const selected=sources[index],tokens=new Map();
 let original;
 for(const source of sources){
  const view=openReviewedDocument(source.document,saved.firm.id,saved.entry.id);
  if(source.id===sourceId)original=view.original;
  for(const {value,token} of view.tokens)if(!tokens.has(value))tokens.set(value,token);
 }
 const ends=new Uint32Array(original.length);
 const values=new Set([...tokens.keys(),saved.firm.name,saved.entry.title,saved.entry.client,saved.intake.supplier]);
 for(const value of values){
  if(typeof value==='string'&&value.trim())occurrences(original,value,(start,end)=>{ends[start]=Math.max(ends[start],end);});
 }
 const merged=[];
 for(let start=0;start<ends.length;start++){
  if(!ends[start])continue;
  const previous=merged.at(-1);
  if(previous&&start<previous[1])previous[1]=Math.max(previous[1],ends[start]);
  else merged.push([start,ends[start]]);
 }
 const certified=certificates.get(sha(original.split('\n').filter(s=>s.trim()).join('\n')));
 let attested=Boolean(certified);
 for(const value of certified??[]){
  if(!original.includes(value))attested=false;
  occurrences(original,value,(a,b)=>{if(!merged.some(([first,last])=>first<=a&&last>=b))attested=false;});
 }
 const numbers=new Map([...tokens.keys()].map((value,i)=>[value,i+1]));
 const lines=[];let start=0,firstRange=0;
 for(const [n,text] of original.split('\n').entries()){
  const end=start+text.length;
  while(firstRange<merged.length&&merged[firstRange][1]<=start)firstRange++;
  const local=[];
  for(let i=firstRange;i<merged.length&&merged[i][0]<end;i++){
   const [a,b]=merged[i];
   local.push([Math.max(a,start)-start,Math.min(b,end)-start]);
  }
  const parts=fragments(text,local,tokens);
  const masked=parts.map(p=>p.text??(p.token?'〔Dato '+numbers.get(p.value)+'〕':'〔Dato oculto〕')).join('');
  const visible=parts.map(p=>p.text??' ').join(' ');
  // Keep identity fields and entirely masked lines available for local use.
  const cloud=attested&&text.length<=420&&!/^[^.!?]{1,45}:/.test(text)&&
   (visible.match(/\p{L}{2,}/gu)?.length??0)>=3;
  if(text.trim())lines.push({id:'line:'+selected.id+'/'+(n+1)+'-'+sha(JSON.stringify([parts,cloud])).slice(0,20),
   masked,cloud,parts,evidence:{sourceId:selected.id,sourceLabel:'Documento '+(index+1)+' · '+selected.label,line:n+1,excerpt:text}});
  start=end+1;
 }
 return lines;
}
