import {randomUUID} from 'node:crypto';
import {createProvenanceRegistry,privacyTextHash} from './provenance.mjs';
import {createVariantAwareDetector} from './detector-variants.mjs';
import {createPseudonymStore} from './pseudonyms.mjs';
import {documentaryObjectRanges,formCaptionRanges,detectorSegments,labelledIdentityRanges,postalBlockRanges,logisticsReferenceRanges,contextualIdentityRanges} from './trade-document-structure.mjs';

const incomplete=Object.freeze({available:false,reason:'No se pudo reconstruir y comprobar la vista de protección local.'});

// Local review of extracted text. The temporary map belongs only to this call.
// The returned view contains originals and is never a cloud request.
export async function reviewIntakeDocument({text,originalHash,suggestions,fields,signal,context,contextReviewer}) {
 if (text.includes('[[LEX_') || !Array.isArray(suggestions) || suggestions.length>96) return incomplete;
 const scope={workspaceId:'local-preview',matterId:randomUUID(),threadId:'document'};
 const registry=createProvenanceRegistry();
 const pieces=detectorSegments(text);
 if(pieces.length>256)return incomplete;
 const segments=pieces.map((piece,i)=>({id:'s'+i,path:'content',text:piece.text}));
 const offsets=new Map(segments.map((segment,i)=>[segment.id,pieces[i].start]));
 const captions=formCaptionRanges(text);
 const isCaption=(start,end)=>captions.some(([first,last])=>start>=first&&end<=last);
 const source=registry.registerSource({objectId:'input',version:'1',scope,classification:'private',
   extraction:{status:'complete',extractorVersion:'intake-text-v1',originalSha256:originalHash},
   segments});
 const result=await createVariantAwareDetector({provenanceRegistry:registry}).detect({scope,segments:source.segments,signal});
 const contextual=[...contextualIdentityRanges(text),...(context?.ranges??[])];
 let needsReview=result.status!=='complete'||contextual.length>0||context?.available===false;
 const ranges=[...labelledIdentityRanges(text),...postalBlockRanges(text),...logisticsReferenceRanges(text),...contextual];
 for (const detection of result.detections) {
  const offset=offsets.get(detection.segmentId),start=offset+detection.start,end=offset+detection.end;
  if(detection.category==='person'&&isCaption(start,end))continue;
  ranges.push([start,end]);
 }
 const fieldValues=new Set(fields),objects=documentaryObjectRanges(text);
 for (const value of new Set([...fields,...suggestions])) {
  if (value==='') continue;
  if (typeof value!=='string'||value.trim().length<2||value.length>1024||!text.includes(value)) {needsReview=true;continue;}
  for(let start=text.indexOf(value);start!==-1;start=text.indexOf(value,start+value.length)) {
   const end=start+value.length;
   if(fieldValues.has(value)||(!isCaption(start,end)&&!objects.some(([a,b])=>a===start&&b===end)))ranges.push([start,end]);
  }
 }
 if(contextReviewer){
  const initial=buildReview(text,ranges,scope,needsReview,contextual.length);
  if(!initial.available)return initial;
  context=await contextReviewer(initial.parts);
  ranges.push(...context.ranges);
  contextual.push(...context.ranges);
  needsReview ||= context.ranges.length>0||!context.available;
 }
 const view=buildReview(text,ranges,scope,needsReview,contextual.length);
 return view.available&&context?.available===false?{...view,contextUnavailable:true}:view;
}

function buildReview(text,ranges,scope,needsReview,contextualCount) {
 ranges.sort((a,b)=>a[0]-b[0]||b[1]-a[1]);
 const merged=[];
 for (const [start,end] of ranges) {
  const prev=merged.at(-1);
  if (prev&&start<prev[1]) prev[1]=Math.max(prev[1],end);
  else merged.push([start,end]);
 }
 const entities=[...new Set(merged.map(([start,end])=>text.slice(start,end)))];
 if (entities.length>128||entities.some(value=>value.length>1024)) return incomplete;
 try {
  const vault=createPseudonymStore();
  const {mappingVersion}=vault.protect({scope,entities,messages:[{role:'user',content:''}]});
  const map=new Map(vault.exportSnapshot({scope}).entries.map(entry=>[entry.text,entry.marker]));
  const aliases=new Map(entities.map((value,i)=>[value,'Dato '+(i+1)]));
  const parts=[];
  let cursor=0,protectedText='';
  for(const [start,end] of merged){
   const before=text.slice(cursor,start),original=text.slice(start,end);
   if(before) parts.push({text:before});
   parts.push({label:aliases.get(original),start,end});
   protectedText+=before+map.get(original);
   cursor=end;
  }
  if(cursor<text.length) parts.push({text:text.slice(cursor)});
  protectedText+=text.slice(cursor);
  const restored=vault.restore({scope,mappingVersion,text:protectedText});
  if(privacyTextHash(restored)!==privacyTextHash(text)) return incomplete;
  return {available:true,parts,restored,count:merged.length,needsReview,contextualCount};
 } catch {return incomplete;}
}

export function addReviewSelection(review,start,end) {
 const text=review.restored;
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end>text.length||end-start<2||end-start>256)
  throw Error('Selecciona entre 2 y 256 caracteres del texto original.');
 const value=text.slice(start,end);
 if(!value.trim()||!value.isWellFormed())throw Error('Selecciona un dato completo.');
 const ranges=review.parts.filter(part=>part.label).map(part=>[part.start,part.end]);
 const matches=[];
 for(let offset=text.indexOf(value);offset!==-1;offset=text.indexOf(value,offset+1))
  matches.push([offset,offset+value.length]);
 if(matches.every(([a,b])=>ranges.some(([first,last])=>first<=a&&last>=b)))
  throw Error('El dato seleccionado ya está oculto.');
 const updated=buildReview(text,[...ranges,...matches],{workspaceId:'local-preview',matterId:randomUUID(),threadId:'document'},review.needsReview,review.contextualCount??0);
 if(!updated.available)throw Error('No se pudo verificar la corrección. Selecciona un fragmento más corto.');
 return review.contextUnavailable?{...updated,contextUnavailable:true}:updated;
}
