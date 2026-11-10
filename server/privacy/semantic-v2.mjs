// Experimental fixture-only learned + rules composition. Diagnostic spans NEVER grant egress.
import {createLocalPrivacyDetector,DETECTION_CATEGORIES} from './detector.mjs';
import {createProvenanceRegistry,privacyTextHash,validPrivacyRange} from './provenance.mjs';
import {validateOperationalInput,evaluateOperationalPreparation,copyPrivacyJson,exactFields} from './operational-v2.mjs';
export const SEMANTIC_VERSION='gliner-pii-small-uint8-local-v2';
export const LEARNED_CATEGORIES=Object.freeze(['person','organization','address','context','sensitive_relation']);
const blocked=()=>({status:'blocked',reasonCategory:'detector_failure',detections:[]});
const order=(a,b)=>a.segmentId.localeCompare(b.segmentId)||a.start-b.start||a.end-b.end||a.category.localeCompare(b.category);

// Preserve diagnostic categories; union only literal protection ranges, never gaps or adjacent text.
export function unionPrivacyRanges(detections){
 const result=[];
 for(const span of [...detections].sort((a,b)=>a.segmentId.localeCompare(b.segmentId)||a.start-b.start||a.end-b.end)){
  const last=result.at(-1);
  if(last&&last.segmentId===span.segmentId&&span.start<last.end)last.end=Math.max(last.end,span.end);
  else result.push({segmentId:span.segmentId,start:span.start,end:span.end});
 }
 return result;
}
export function validateLearnedOutput(input,segments){
 const value=copyPrivacyJson(input);exactFields(value,['status','reasonCategory','detections']);
 if(value.status!=='complete'||value.reasonCategory!==null||!Array.isArray(value.detections)||value.detections.length>2048)throw Error('detector_failure');
 const texts=new Map(segments.map(s=>[s.id,s.text]));const keys=new Set();
 for(const d of value.detections){
  exactFields(d,['segmentId','start','end','category','score']);
  if(!texts.has(d.segmentId)||!LEARNED_CATEGORIES.includes(d.category)||!Number.isFinite(d.score)||d.score<0||d.score>1||!validPrivacyRange(texts.get(d.segmentId),d.start,d.end))throw Error('detector_failure');
  const key=JSON.stringify([d.segmentId,d.start,d.end,d.category]);if(keys.has(key))throw Error('detector_failure');keys.add(key);
 }
 return value.detections;
}
/** Backend is a trusted developer-owned capability, not an input field. No model auto-load/download. */
export function createSemanticPrivacyDetector({backend,timeoutMs=15000}={}){
 if(typeof backend?.detect!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>15000)throw Error('invalid_backend');
 let running=false,disabled=false;
 return Object.freeze({version:SEMANTIC_VERSION,async detect(input,{signal}={}){
  if(disabled||running||signal?.aborted||signal!==undefined&&!(signal instanceof AbortSignal))return blocked();
  running=true;let timer,abort;
  const controller=new AbortController();
  try{
   const value=validateOperationalInput(input);
   if(value.segments.some(s=>!s.text.isWellFormed()||!s.path.isWellFormed()))return blocked();
   const preparation=evaluateOperationalPreparation(value);
   if(preparation.status==='blocked')return {...preparation,detections:[]};
   const registry=createProvenanceRegistry();
   const segments=value.segments.map((s,index)=>{
    const op=value.operational.segments.find(o=>o.id===s.id);
    return registry.registerSource({objectId:`synthetic-v2-${index}`,version:'v2',scope:s.originScope,classification:s.classification,
     extraction:{status:op.extractionStatus,extractorVersion:'plain-fixture-v2',originalSha256:privacyTextHash(s.text)},assessment:op.assessment,
     segments:[{id:s.id,path:s.path,text:s.text}]}).segments[0];
   });
   const rules=await createLocalPrivacyDetector({provenanceRegistry:registry}).detect({scope:value.scope,segments,signal});
   if(rules.status==='blocked')return rules;
   // Paths are also potentially identifying; learned matches there block rather than changing structure.
   const texts=value.segments.flatMap((s,index)=>[{id:`T${index}`,text:s.text},{id:`P${index}`,text:s.path}]);
   const stop=new Promise((_,reject)=>{
    abort=()=>{disabled=true;controller.abort();reject(Error('detector_failure'));};
    signal?.addEventListener('abort',abort,{once:true});timer=setTimeout(abort,timeoutMs);
   });
   const result=await Promise.race([backend.detect({segments:texts},{signal:controller.signal}),stop]);
   if(signal?.aborted||controller.signal.aborted)return blocked();
   const learned=validateLearnedOutput(result,texts);const detections=[...rules.detections];let pathSensitive=false;
   for(const d of learned){if(d.segmentId[0]==='P'){pathSensitive=true;continue;}const index=Number(d.segmentId.slice(1));detections.push({segmentId:value.segments[index].id,start:d.start,end:d.end,category:d.category});}
   if(detections.some(d=>!DETECTION_CATEGORIES.includes(d.category)))return blocked();
   const unique=[...new Map(detections.map(d=>[JSON.stringify([d.segmentId,d.start,d.end,d.category]),d])).values()].sort(order);
   return {status:pathSensitive?'blocked':'complete',reasonCategory:pathSensitive?'ambiguous_context':null,detections:unique};
  }catch{return blocked();}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);running=false;}
 }});
}
