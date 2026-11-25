// Explicit opt-in backend for the existing loopback reader. No startup probe,
// downloads, cloud calls, grants or default wiring. Runtime identity is UNATTESTED.
import {readerModel} from './local-reader-status.mjs';
import {copyPrivacyJson,exactFields} from './operational-v2.mjs';
import {createIntakeContractualCandidate} from './intake-contractual-candidate.mjs';
const MAX_RESPONSE=262144;
// Requested values, not observed effective runtime behavior.
export const CONTRACTUAL_OLLAMA_OPTIONS=Object.freeze({temperature:0,presence_penalty:0,top_k:20,top_p:0.95,num_ctx:8192});
export function createIntakeContractualOllama({fetchImpl=fetch}={}){
 if(typeof fetchImpl!=='function')throw Error('local_transport_required');
 async function ask(system,input,format,numPredict,{signal}={}){
  signal?.throwIfAborted();
  const response=await fetchImpl('http://127.0.0.1:11434/api/chat',{method:'POST',redirect:'error',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({model:readerModel,stream:false,think:false,format,keep_alive:'30s',options:{...CONTRACTUAL_OLLAMA_OPTIONS,num_predict:numPredict},messages:[{role:'system',content:system},{role:'user',content:input}]})});
  if(!response.ok||!response.body)throw Error('local_transport_failed');
  const reader=response.body.getReader();let size=0;const chunks=[];
  try{for(;;){signal?.throwIfAborted();const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_RESPONSE)throw Error('local_response_capacity');chunks.push(value);}}catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
  const raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
  if(raw.done!==true||raw.done_reason!=='stop'||raw.model!==readerModel||raw.message?.role!=='assistant'||typeof raw.message.content!=='string')throw Error('local_response_incomplete');
  const result=copyPrivacyJson(JSON.parse(raw.message.content));
  // Context prompts have a smaller exact contract; the candidate validates typed
  // output separately against its actual segments and UTF-16 boundaries.
  if(format.properties.oraciones){exactFields(result,['oraciones']);const allowed=format.properties.oraciones.items.enum;if(!Array.isArray(result.oraciones)||new Set(result.oraciones).size!==result.oraciones.length||result.oraciones.some(id=>!Number.isInteger(id)||!allowed.includes(id)))throw Error('local_context_invalid');}
  return result;
 }
 const backend={ask,review:async({prompt,categories,segments},{signal}={})=>{
  const format={type:'object',additionalProperties:false,required:['status','reasonCategory','detections'],properties:{status:{enum:['complete','blocked']},reasonCategory:{enum:[null,'ambiguous_context','detector_failure']},detections:{type:'array',maxItems:768,items:{type:'object',additionalProperties:false,required:['segmentId','start','end','category'],properties:{segmentId:{enum:segments.map(s=>s.id)},start:{type:'integer',minimum:0},end:{type:'integer',minimum:1},category:{enum:categories}}}}}};
  return ask(prompt,JSON.stringify(segments),format,4096,{signal});
 }};
 return createIntakeContractualCandidate({backend});
}
