// Opt-in OFFLINE fixture contract. Declarative stimuli are never trusted import
// authority, a provenance capability, a detector result, or permission for egress.
import {validPrivacyScope,samePrivacyScope} from './provenance.mjs';
export const REASON_PRIORITY=Object.freeze(['scope_mismatch','unknown_provenance','detector_failure','unsupported_format','partial_extraction','ambiguous_context']);
export function contractFailure(){throw Object.assign(new Error('privacy_v2_invalid'),{code:'privacy_v2_invalid'});}
// Reject accessors without invoking them, symbols, custom prototypes, sparse arrays,
// non-JSON values and cycles before copying. No caller toJSON is ever executed.
export function copyPrivacyJson(input){
 const active=new Set();let nodes=0;
 function walk(value,depth){
  if(++nodes>100000||depth>40)contractFailure();
  if(value===null||typeof value==='boolean'||typeof value==='string')return value;
  if(typeof value==='number'&&Number.isFinite(value))return value;
  if(typeof value!=='object'||active.has(value))contractFailure();
  const array=Array.isArray(value),proto=Object.getPrototypeOf(value);
  if(proto!==(array?Array.prototype:Object.prototype)&&!(proto===null&&!array))contractFailure();
  if(Object.getOwnPropertySymbols(value).length)contractFailure();
  const descriptors=Object.getOwnPropertyDescriptors(value),keys=Object.keys(descriptors);
  if(keys.some(key=>!Object.hasOwn(descriptors[key],'value')))contractFailure();
  active.add(value);let result;
  if(array){
   if(keys.length!==value.length+1||keys.some(key=>key!=='length'&&!/^(0|[1-9]\d*)$/.test(key)))contractFailure();
   result=[];for(let i=0;i<value.length;i++){if(!descriptors[i])contractFailure();result.push(walk(descriptors[i].value,depth+1));}
  }else{
   result=Object.create(null);for(const key of keys){if(!descriptors[key].enumerable)contractFailure();result[key]=walk(descriptors[key].value,depth+1);}
  }
  active.delete(value);return result;
 }
 try{return JSON.parse(JSON.stringify(walk(input,0)));}catch{contractFailure();}
}
export function exactFields(value,fields){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==fields.length||fields.some(key=>!Object.hasOwn(value,key)))contractFailure();}
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/.test(value);
export function validateOperationalInput(input){
 const value=copyPrivacyJson(input);exactFields(value,['scope','segments','operational']);
 if(!validPrivacyScope(value.scope)||!Array.isArray(value.segments)||!value.segments.length||value.segments.length>256)contractFailure();
 const ids=new Set();let units=0;
 for(const segment of value.segments){
  exactFields(segment,['id','path','text','originScope','classification']);
  if(!id(segment.id)||ids.has(segment.id)||typeof segment.path!=='string'||!segment.path.trim()||typeof segment.text!=='string'||!segment.text.length||!['synthetic','public','unknown'].includes(segment.classification))contractFailure();
  if(segment.originScope!==null&&!validPrivacyScope(segment.originScope)||segment.originScope===null&&segment.classification!=='unknown')contractFailure();
  ids.add(segment.id);units+=segment.path.length+segment.text.length;
 }
 exactFields(value.operational,['processorStatus','segments']);
 if(!['ok','failed'].includes(value.operational.processorStatus)||!Array.isArray(value.operational.segments)||value.operational.segments.length!==ids.size)contractFailure();
 const seen=new Set();for(const item of value.operational.segments){
  exactFields(item,['id','mediaType','extractionStatus','assessment']);
  if(!ids.has(item.id)||seen.has(item.id)||typeof item.mediaType!=='string'||item.mediaType.length>127||!/^[-a-z0-9.+]+\/[-a-z0-9.+]+$/.test(item.mediaType)||!['complete','partial','unsupported','failed'].includes(item.extractionStatus)||!['known','ambiguous'].includes(item.assessment))contractFailure();seen.add(item.id);
 }
 if(units>7000||Buffer.byteLength(JSON.stringify(value),'utf8')>32768)contractFailure();
 return value;
}
export function evaluateOperationalPreparation(input){
 let value;try{value=validateOperationalInput(input);}catch{return {status:'blocked',reasonCategory:'detector_failure'};}
 const reasons=new Set(),ops=value.operational;
 for(const segment of value.segments){if(segment.originScope!==null&&!samePrivacyScope(value.scope,segment.originScope))reasons.add('scope_mismatch');if(segment.originScope===null||segment.classification==='unknown')reasons.add('unknown_provenance');}
 if(ops.processorStatus==='failed'||ops.segments.some(s=>s.extractionStatus==='failed'))reasons.add('detector_failure');
 if(ops.segments.some(s=>!['text/plain','text/markdown'].includes(s.mediaType)||s.extractionStatus==='unsupported'))reasons.add('unsupported_format');
 if(ops.segments.some(s=>s.extractionStatus==='partial'))reasons.add('partial_extraction');
 if(ops.segments.some(s=>s.assessment==='ambiguous'))reasons.add('ambiguous_context');
 const reasonCategory=REASON_PRIORITY.find(reason=>reasons.has(reason))??null;
 return {status:reasonCategory?'blocked':'complete',reasonCategory};
}
// Reads/copies only whitelisted inputs: gold can change without affecting projection.
// Still inspect descriptors for all fields, so malicious gold getters never execute.
export function projectPrivacyCase(row){
 const clean=copyPrivacyJson(row);
 exactFields(clean,['id','split','templateGroup','synthetic','scope','segments','entities','expectedStatus','blockReason','preserve','operational']);
 return validateOperationalInput({scope:clean.scope,segments:clean.segments,operational:clean.operational});
}
