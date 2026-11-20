import {createHash} from 'node:crypto';
import {createPseudonymStore} from './pseudonyms.mjs';

export const documentToken=/\[\[DATO_[1-9]\d{0,2}_[a-f0-9]{12}\]\]/g;
const digest=text=>createHash('sha256').update(text).digest('hex');
const scopeFor=(workspaceId,matterId)=>({workspaceId,matterId,threadId:'intake-document'});
const tokenFor=(namespace,i)=>'[[DATO_'+(i+1)+'_'+namespace.slice(0,12)+']]';

export function bindReviewedDocument(review,workspaceId,matterId) {
 const scope=scopeFor(workspaceId,matterId);
 const entities=[...new Set(review.parts.filter(part=>part.label).map(part=>review.restored.slice(part.start,part.end)))];
 const vault=createPseudonymStore();
 const {mappingVersion}=vault.protect({scope,entities,messages:[{role:'user',content:''}]});
 const snapshot=vault.exportSnapshot({scope});
 const marker=new Map(snapshot.entries.map(entry=>[entry.text,entry.marker]));
 const protectedText=review.parts.map(part=>part.label?marker.get(review.restored.slice(part.start,part.end)):part.text).join('');
 if(vault.restoreReviewedDocument({scope,mappingVersion,text:protectedText})!==review.restored)throw Error('No se pudo verificar la restitución del documento.');
 return {snapshot,protectedText,sha256:digest(review.restored),needsReview:review.needsReview};
}

export function documentTokens(doc) {
 return (doc?.snapshot.entries??[]).map((_,i)=>({token:tokenFor(doc.snapshot.namespace,i),label:'Dato '+(i+1)}));
}

export function openReviewedDocument(doc,workspaceId,matterId) {
 if(!doc)throw Error('Este expediente no tiene un soporte guardado.');
 const scope=scopeFor(workspaceId,matterId);
 const vault=createPseudonymStore();
 const {mappingVersion}=vault.importSnapshot({scope,snapshot:doc.snapshot});
 const restore=text=>vault.restoreReviewedDocument({scope,mappingVersion,text});
 const original=restore(doc.protectedText);
 if(digest(original)!==doc.sha256)throw Error('No se pudo verificar el texto guardado.');
 const tokens=documentTokens(doc);
 const byOpaque=new Map(doc.snapshot.entries.map((entry,i)=>[entry.marker,tokens[i].label]));
 const masked=doc.protectedText.replace(/\[\[LEX_[a-f0-9]{32}_[a-f0-9]{32}\]\]/g,key=>byOpaque.get(key));
 return {original,masked,needsReview:doc.needsReview,tokens:tokens.map((item,i)=>({...item,value:restore(doc.snapshot.entries[i].marker)}))};
}
