// Experimental fixture-only learned + rules composition. Diagnostic spans NEVER grant egress.
import {createLocalPrivacyDetector,DETECTION_CATEGORIES} from './detector.mjs';
import {createProvenanceRegistry,privacyTextHash,validPrivacyRange} from './provenance.mjs';
import {validateOperationalInput,evaluateOperationalPreparation,copyPrivacyJson,exactFields} from './operational-v2.mjs';
export const TOKEN_NER_VERSION='rampart-q4-token-ner-local-v1';
export const LEARNED_CATEGORIES=Object.freeze(['person','email','phone','account','address']);
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
export function createTokenNerDetector({backend,timeoutMs=15000}={}){
 if(typeof backend?.detect!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>15000)throw Error('invalid_backend');
 let running=false,disabled=false;
 return Object.freeze({version:TOKEN_NER_VERSION,async detect(input,{signal}={}){
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
   if(result?.status==='blocked'){const b=copyPrivacyJson(result);exactFields(b,['status','reasonCategory','detections']);if(b.reasonCategory==='ambiguous_context'&&Array.isArray(b.detections)&&b.detections.length===0)return b;return blocked();}
   const learned=validateLearnedOutput(result,texts);const detections=[...rules.detections];let pathSensitive=false;
   for(const d of learned){if(d.segmentId[0]==='P'){pathSensitive=true;continue;}const index=Number(d.segmentId.slice(1));detections.push({segmentId:value.segments[index].id,start:d.start,end:d.end,category:d.category});}
   if(detections.some(d=>!DETECTION_CATEGORIES.includes(d.category)))return blocked();
   const unique=[...new Map(detections.map(d=>[JSON.stringify([d.segmentId,d.start,d.end,d.category]),d])).values()].sort(order);
   return {status:pathSensitive?'blocked':'complete',reasonCategory:pathSensitive?'ambiguous_context':null,detections:unique};
  }catch{return blocked();}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);running=false;}
 }});
}

import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
const python=fileURLToPath(new URL('../../artifacts/privacy/onnx-env/bin/python',import.meta.url));
const script=fileURLToPath(new URL('../../scripts/privacy-token-ner-worker.py',import.meta.url));
const fail=()=>({status:'blocked',reasonCategory:'detector_failure',detections:[]});
function startPythonBackend(){
 const candidateId=TOKEN_NER_VERSION;
 const child=spawn(python,['-I','-B',script,'--serve'],{stdio:['pipe','pipe','ignore'],env:{PATH:'/usr/bin:/bin',LANG:'en_US.UTF-8',PYTHONNOUSERSITE:'1',TOKENIZERS_PARALLELISM:'false',OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1',HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1',LEX_PRIVACY_NETWORK_SANDBOX:'required'}});
 let pending=null,dead=false,buffer='',metadata=null,peakRssBytes=0,readyResolve,readyReject;
 const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
 function stop(){if(dead)return;dead=true;clearTimeout(initial);child.kill('SIGKILL');readyReject(Error('detector_failure'));pending?.reject(Error('detector_failure'));pending=null;}
 const initial=setTimeout(stop,15000);
 child.on('error',stop);child.on('exit',stop);
 child.stdout.on('data',chunk=>{
  buffer+=chunk.toString('utf8');if(Buffer.byteLength(buffer)>524288)return stop();
  while(buffer.includes('\n')){
   const at=buffer.indexOf('\n'),line=buffer.slice(0,at);buffer=buffer.slice(at+1);
   try{
    const result=JSON.parse(line);
    if(!metadata){exactFields(result,['ready']);metadata=copyPrivacyJson(result.ready);if(metadata.candidateId!==candidateId||metadata.executionProvider!=='CPUExecutionProvider')return stop();clearTimeout(initial);peakRssBytes=metadata.peakRssBytes;readyResolve(metadata);}
    else {if(!pending)return stop();const request=pending;const {peakRssBytes:rss,...output}=result;if(!Number.isInteger(rss)||rss<0||rss>924*1024*1024)return stop();peakRssBytes=Math.max(peakRssBytes,rss);pending=null;request.resolve(output);}
   }catch{stop();}
  }
 });
 return {ready,get metadata(){return metadata;},get peakRssBytes(){return peakRssBytes;},close:stop,
  async detect(input,{signal}={}){await ready;if(dead||pending||signal?.aborted)throw Error('detector_failure');return new Promise((resolve,reject)=>{
   const abort=()=>{stop();reject(Error('detector_failure'));};const timer=setTimeout(abort,15000);signal?.addEventListener('abort',abort,{once:true});
   const finish=fn=>value=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);fn(value);};pending={resolve:finish(resolve),reject:finish(reject)};
   child.stdin.write(JSON.stringify(input)+'\n',error=>{if(error)stop();});
  });},
 };
}
if(process.send){
 if(process.argv.slice(2).length)throw Error('invalid_configuration');
 const backend=startPythonBackend(),detector=createTokenNerDetector({backend});let busy=false;
 const memory=setInterval(()=>{if(process.resourceUsage().maxRSS*1024>100*1024*1024){backend.close();process.exit(3);}},25);
 process.on('disconnect',()=>{clearInterval(memory);backend.close();process.exit(0);});
 backend.ready.then(metadata=>process.send({ready:metadata})).catch(()=>{process.send({errorCategory:'detector_failure'});process.exitCode=2;backend.close();clearInterval(memory);process.disconnect();});
 process.on('message',async message=>{
  if(busy){process.send({errorCategory:'detector_failure'});return;}busy=true;
  try{
   const clean=copyPrivacyJson(message);exactFields(clean,['input']);const input=validateOperationalInput(clean.input);
   const start=performance.now(),result=await detector.detect(input);
   process.send({result,latencyMs:performance.now()-start,peakRssBytes:backend.peakRssBytes+process.resourceUsage().maxRSS*1024});
  }catch{process.send({result:fail(),latencyMs:0,peakRssBytes:backend.peakRssBytes+process.resourceUsage().maxRSS*1024});}
  finally{busy=false;}
 });
}

import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const failure=()=>Error('privacy_token_ner_failed');
export async function startTokenNerWorker({reviewedManifestSha256,timeoutMs=15000}={}){
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>15000)throw failure();
 const candidateId=TOKEN_NER_VERSION;
 const manifest=await readFile(new URL('../../resources/privacy-token-ner-candidate-v1.json',import.meta.url));
 if(typeof reviewedManifestSha256!=='string'||!/^[a-f0-9]{64}$/.test(reviewedManifestSha256)||createHash('sha256').update(manifest).digest('hex')!==reviewedManifestSha256)throw failure();
 const {candidateSandboxProfile}=await import('../../scripts/run-privacy-detector-v2.mjs');
 const base=await candidateSandboxProfile();
 const profile=base+`(deny file-read* (literal ${JSON.stringify(fileURLToPath(new URL('../../scripts/run-privacy-ablation-v3.mjs',import.meta.url)))}) (literal ${JSON.stringify(fileURLToPath(new URL('../../scripts/run-privacy-token-ner-v1.mjs',import.meta.url)))}))`; 
 const child=spawn('/usr/bin/sandbox-exec',['-p',profile,process.execPath,fileURLToPath(import.meta.url)],{stdio:['ignore','ignore','ignore','ipc'],detached:true,env:{PATH:'/usr/bin:/bin',LANG:'en_US.UTF-8'},serialization:'json'});
 let dead=false,pending=null,readyResolve,readyReject,metadata;
 const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
 function close(){if(dead)return;dead=true;clearTimeout(loadTimer);try{process.kill(-child.pid,'SIGKILL');}catch{}readyReject(failure());pending?.reject(failure());pending=null;}
 const loadTimer=setTimeout(close,15000);
 child.on('error',close);child.on('exit',close);
 child.on('message',message=>{try{
  const m=copyPrivacyJson(message);
  if(!metadata){exactFields(m,['ready']);if(m.ready.candidateId!==candidateId||m.ready.manifestSha256!==reviewedManifestSha256)throw failure();metadata=m.ready;clearTimeout(loadTimer);readyResolve(metadata);return;}
  if(!pending)throw failure();exactFields(m,['result','latencyMs','peakRssBytes']);
  if(!Number.isFinite(m.latencyMs)||m.latencyMs<0||!Number.isInteger(m.peakRssBytes)||m.peakRssBytes>1073741824)throw failure();
  exactFields(m.result,['status','reasonCategory','detections']);
  const p=pending;pending=null;p.resolve(m);
 }catch{close();}});
 return {ready,pid:child.pid,close,
  async request(input,{signal}={}){const clean=validateOperationalInput(input);await ready;if(dead||pending||signal?.aborted)throw failure();return new Promise((resolve,reject)=>{
   const abort=()=>{close();reject(failure());};const timer=setTimeout(abort,timeoutMs);signal?.addEventListener('abort',abort,{once:true});
   const finish=fn=>value=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);fn(value);};pending={resolve:finish(resolve),reject:finish(reject)};
   child.send({input:clean},error=>{if(error)close();});
  });},
 };
}
