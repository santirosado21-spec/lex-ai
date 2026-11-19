import {randomUUID} from 'node:crypto';
import {createProvenanceRegistry,privacyTextHash} from './provenance.mjs';
import {createVariantAwareDetector} from './detector-variants.mjs';
import {createPseudonymStore} from './pseudonyms.mjs';
import {formCaptionRanges,detectorSegments,labelledIdentityRanges,postalBlockRanges,logisticsReferenceRanges} from './trade-document-structure.mjs';

// Local review of extracted text. The temporary map belongs only to this call.
// The returned view contains originals and is never a cloud request.
export async function reviewIntakeDocument({text,originalHash,suggestions,fields,signal}) {
 const incomplete={available:false,reason:'No se pudo reconstruir y comprobar la vista de protección local.'};
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
 let needsReview=result.status!=='complete';
 const ranges=[...labelledIdentityRanges(text),...postalBlockRanges(text),...logisticsReferenceRanges(text)];
 for (const detection of result.detections) {
  const offset=offsets.get(detection.segmentId),start=offset+detection.start,end=offset+detection.end;
  if(detection.category==='person'&&isCaption(start,end))continue;
  ranges.push([start,end]);
 }
 const fieldValues=new Set(fields);
 for (const value of new Set([...fields,...suggestions])) {
  if (value==='') continue;
  if (typeof value!=='string'||value.trim().length<2||value.length>1024||!text.includes(value)) {needsReview=true;continue;}
  for(let start=text.indexOf(value);start!==-1;start=text.indexOf(value,start+value.length)) {
   const end=start+value.length;
   if(fieldValues.has(value)||!isCaption(start,end))ranges.push([start,end]);
  }
 }
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
  return {available:true,parts,restored,count:merged.length,needsReview};
 } catch {return incomplete;}
}
