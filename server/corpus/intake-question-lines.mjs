import {certifiedWorkbook,workbookCellParts} from './practice-workbook.mjs';
import {reservedRanges} from '../privacy/matter-reservations.mjs';
// Project the stored substitutions onto original line offsets, including multiline masks.
// Per-document proof is checked before the result can supply synthetic cloud context.
import {isProductAlias,tradeDocumentAnchorValues} from '../privacy/trade-document-structure.mjs';
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
export function questionLines(saved,sourceId,transient){
 const sources=caseSources(saved?.intake);
 if(transient)sources.push(transient);
 const index=sources.findIndex(row=>row.id===sourceId);
 if(index<0)throw Error('Selecciona un documento de este expediente.');
 const selected=sources[index],tokens=new Map(),anchors=new Set();
 let original;
 for(const source of sources){
  const view=openReviewedDocument(source.document,saved.firm.id,saved.entry.id);
  for(const value of tradeDocumentAnchorValues(view.original))anchors.add(value);
  if(source.id===sourceId)original=view.original;
  for(const {value,token} of view.tokens){
   if(!tokens.has(value))tokens.set(value,token);
   if(isProductAlias(value))anchors.add(value);
  }
 }
 const ends=new Uint32Array(original.length),anchorEnds=new Uint32Array(original.length);
 const values=new Set([...tokens.keys(),...anchors,saved.firm.name,saved.entry.title,saved.entry.client,saved.intake.supplier]);
 for(const value of values){
  if(typeof value==='string'&&value.trim())occurrences(original,value,(start,end)=>{ends[start]=Math.max(ends[start],end);if(anchors.has(value))anchorEnds[start]=Math.max(anchorEnds[start],end);});
 }
 // Reproject older sources when a later document discloses a spelling variant.
 // Keep the matched original in the local view; never restore a different form.
 const known=[...values].filter(value=>typeof value==='string'&&value.trim().length>=2);
 const prior=[...(saved.intake.reservations??[]),...known.map(text=>({text}))];
 for(const [a,b] of reservedRanges(original,prior))ends[a]=Math.max(ends[a],b);
 const merged=[];
 for(let start=0;start<ends.length;start++){
  if(!ends[start])continue;
  const previous=merged.at(-1);
  if(previous&&start<previous[1])previous[1]=Math.max(previous[1],ends[start]);
  else merged.push([start,ends[start]]);
 }
 // Partition only already hidden ranges. Surrounding words remain hidden
 // even when the local model marked an entire sentence as identifying.
 const slices=[];
 for(const [start,end] of merged){
  let cursor=start;
  for(let i=start;i<end;i++){
   const last=anchorEnds[i];
   if(last<=i||last>end)continue;
   if(cursor<i)slices.push([cursor,i]);
   slices.push([i,last]);cursor=last;i=last-1;
  }
  if(cursor<end)slices.push([cursor,end]);
 }
 const workbook=certifiedWorkbook(selected);
 const workbookCovered=workbook?.private.every(value=>{
  let found=false,covered=true;
  occurrences(original,value,(a,b)=>{found=true;covered&&=merged.some(([first,last])=>first<=a&&last>=b);});
  return found&&covered;
 });
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
  while(firstRange<slices.length&&slices[firstRange][1]<=start)firstRange++;
  const local=[];
  for(let i=firstRange;i<slices.length&&slices[i][0]<end;i++){
   const [a,b]=slices[i];
   local.push([Math.max(a,start)-start,Math.min(b,end)-start]);
  }
  const parts=fragments(text,local,tokens);
  const masked=parts.map(p=>p.text??(p.token?'〔Dato '+numbers.get(p.value)+'〕':'〔Dato oculto〕')).join('');
  const visible=parts.map(p=>p.text??' ').join(' ');
  // Keep identity fields and entirely masked lines available for local use.
  const cell=workbookCovered?workbookCellParts(workbook,text,parts):null;
  const cloud=Boolean(cell)||attested&&text.length<=420&&!/^[^.!?]{1,45}:/.test(text)&&
   (visible.match(/\p{L}{2,}/gu)?.length??0)>=3;
  if(text.trim())lines.push({id:'line:'+selected.id+'/'+(n+1)+'-'+sha(JSON.stringify([parts,cloud])).slice(0,20),
   masked,cloud,parts,...(cell?{cell}:{}),evidence:{sourceId:selected.id,sourceLabel:'Documento '+(index+1)+' · '+selected.label,line:n+1,excerpt:text}});
  start=end+1;
 }
 return lines;
}

// Keep document indexes first so the lawyer sees each known reference with
// the same local number in the current question and the selected supports.
export function maskedMatterQuestion(saved,document,id,original){
 const rows=questionLines(saved,id,{id,label:'Pregunta',document});
 const lines=original.split('\n');
 let count=0;
 for(const row of rows){
  lines[row.evidence.line-1]=row.masked;
  count+=row.parts.filter(part=>part.value!==undefined).length;
 }
 return {masked:lines.join('\n'),count};
}
