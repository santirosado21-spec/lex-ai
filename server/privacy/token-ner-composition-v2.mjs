// Inactive experiment: literal coverage proofs are not legal-ID validity or egress grants.
import {createLocalPrivacyDetector} from './detector.mjs';
import {createProvenanceRegistry,privacyTextHash,validPrivacyRange,samePrivacyScope} from './provenance.mjs';
import {validateOperationalInput,evaluateOperationalPreparation,copyPrivacyJson,exactFields} from './operational-v2.mjs';
export const TOKEN_NER_VERSION='rampart-q4-composition-v2';
const KINDS=new Set('GIVEN_NAME SURNAME EMAIL PHONE URL TAX_ID BANK_ACCOUNT ROUTING_NUMBER GOVERNMENT_ID PASSPORT DRIVERS_LICENSE BUILDING_NUMBER STREET_NAME SECONDARY_ADDRESS CITY STATE ZIP_CODE'.split(' '));
const mapping={GIVEN_NAME:'person',SURNAME:'person',EMAIL:'email',PHONE:'phone',BANK_ACCOUNT:'account',BUILDING_NUMBER:'address',STREET_NAME:'address',SECONDARY_ADDRESS:'address',ZIP_CODE:'address'};
const order=(a,b)=>a.segmentId.localeCompare(b.segmentId)||a.start-b.start||a.end-b.end||a.category.localeCompare(b.category);
const overlap=(a,b)=>a.segmentId===b.segmentId&&a.start<b.end&&b.start<a.end;
const contains=(a,b)=>a.segmentId===b.segmentId&&a.start<=b.start&&a.end>=b.end;
export function validateNativeOutput(input,texts){
 const value=copyPrivacyJson(input);exactFields(value,['status','reasonCategory','detections','scannedSegments']);
 if(value.status!=='complete'||value.reasonCategory!==null||!Array.isArray(value.detections)||value.detections.length>2048||JSON.stringify(value.scannedSegments)!==JSON.stringify(texts.map(t=>t.id)))throw Error('backend_contract');
 const sources=new Map(texts.map(t=>[t.id,t.text])),seen=new Set();
 for(const d of value.detections){exactFields(d,['segmentId','start','end','kind','score']);if(!sources.has(d.segmentId)||!KINDS.has(d.kind)||!Number.isFinite(d.score)||d.score<.4||d.score>1||!validPrivacyRange(sources.get(d.segmentId),d.start,d.end))throw Error('backend_contract');const key=JSON.stringify([d.segmentId,d.start,d.end,d.kind]);if(seen.has(key))throw Error('backend_contract');seen.add(key);}
 return value.detections;
}
function response(status,reasonCategory,diagnostic,detections=[],protectionPlan=null){
 return {result:{status,reasonCategory,detections:status==='complete'?detections:[]},diagnostic,protectionPlan:status==='complete'?protectionPlan:null,diagnosticOnly:true,egressEligible:false};
}
export function createCompositionDetector({backend,timeoutMs=15000}={}){
 if(typeof backend?.detect!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>15000)throw Error('invalid_backend');
 let running=false,disabled=false;
 return Object.freeze({version:TOKEN_NER_VERSION,async detect(input,{signal}={}){
  const diagnostic={ruleDetections:[],nativeSpans:[],proofs:[],causes:[]};
  const block=(reason,code)=>{diagnostic.causes.push(code);return response('blocked',reason,diagnostic);};
  if(disabled||running||signal?.aborted||signal!==undefined&&!(signal instanceof AbortSignal))return block('detector_failure','CANCEL_OR_BUSY');
  running=true;let timer,abort;const controller=new AbortController(),deadline=performance.now()+timeoutMs;
  try{
   const value=validateOperationalInput(input);
   if(value.segments.some(s=>!s.text.isWellFormed()||!s.path.isWellFormed()))return block('detector_failure','INVALID_UNICODE');
   const prepared=evaluateOperationalPreparation(value);if(prepared.status==='blocked')return block(prepared.reasonCategory,'OPERATIONAL');
   const registry=createProvenanceRegistry();
   const handles=value.segments.map((s,index)=>{const op=value.operational.segments.find(o=>o.id===s.id);return registry.registerSource({objectId:`composition-${index}`,version:'v2',scope:s.originScope,classification:s.classification,extraction:{status:op.extractionStatus,extractorVersion:'plain-fixture-v2',originalSha256:privacyTextHash(s.text)},assessment:op.assessment,segments:[{id:s.id,path:s.path,text:s.text}]}).segments[0];});
   const rules=await createLocalPrivacyDetector({provenanceRegistry:registry}).detect({scope:value.scope,segments:handles,signal});diagnostic.ruleDetections=copyPrivacyJson(rules.detections);
   if(rules.status==='blocked')return block(rules.reasonCategory,'RULES_BLOCK');
   const texts=value.segments.flatMap((s,i)=>[{id:`T${i}`,text:s.text},{id:`P${i}`,text:s.path}]);
   if(performance.now()>=deadline){disabled=true;controller.abort();return block('detector_failure','CANCEL_OR_TIMEOUT');}
   const stopped=new Promise((_,reject)=>{abort=()=>{disabled=true;controller.abort();reject(Error());};signal?.addEventListener('abort',abort,{once:true});timer=setTimeout(abort,Math.max(0,deadline-performance.now()));});
   const output=await Promise.race([backend.detect({segments:texts},{signal:controller.signal}),stopped]);
   if(signal?.aborted||controller.signal.aborted||performance.now()>=deadline){disabled=true;controller.abort();return block('detector_failure','CANCEL_OR_TIMEOUT');}
   if(output?.status==='blocked'){const b=copyPrivacyJson(output);exactFields(b,['status','reasonCategory','detections']);if(!['detector_failure','ambiguous_context'].includes(b.reasonCategory)||!Array.isArray(b.detections)||b.detections.length)throw Error();return block(b.reasonCategory,'BACKEND_HARD_ERROR');}
   const native=validateNativeOutput(output,texts);diagnostic.nativeSpans=native;
   // Revalidate local immutable handles after await; backend sees neither handles nor rule claims.
   const bound=handles.map(segment=>registry.resolve({scope:value.scope,segment}));
   if(native.some(d=>d.segmentId[0]==='P'))return block('ambiguous_context','PATH_SPAN');
   const learned=native.filter(d=>mapping[d.kind]).map(d=>({segmentId:value.segments[Number(d.segmentId.slice(1))].id,start:d.start,end:d.end,category:mapping[d.kind]}));
   const known=[...rules.detections,...learned];
   for(let i=0;i<known.length;i++)for(let j=i+1;j<known.length;j++)if(known[i].category!==known[j].category&&overlap(known[i],known[j]))return block('ambiguous_context','CATEGORY_CONFLICT');
   for(const span of native.filter(d=>!mapping[d.kind])){
    const index=Number(span.segmentId.slice(1)),record=bound[index],subject={...span,segmentId:record.segment.id};
    const rule=rules.detections.find(r=>contains(r,subject));
    if(!rule)return block('ambiguous_context','UNCOVERED_UNMAPPED');
    diagnostic.proofs.push({kind:span.kind,segmentId:subject.segmentId,start:span.start,end:span.end,rule:copyPrivacyJson(rule),scope:copyPrivacyJson(record.scope),reference:copyPrivacyJson(record.reference),textSha256:record.segment.provenance.textSha256,utf8Start:Buffer.byteLength(record.segment.text.slice(0,span.start),'utf8'),utf8End:Buffer.byteLength(record.segment.text.slice(0,span.end),'utf8')});
   }
   const retained=learned.filter(d=>!rules.detections.some(r=>r.category===d.category&&contains(r,d)));
   const detections=[...new Map([...rules.detections,...retained].map(d=>[JSON.stringify([d.segmentId,d.start,d.end,d.category]),d])).values()].sort(order);
   const ranges=[];for(const d of detections){const previous=ranges.at(-1);if(previous&&previous.segmentId===d.segmentId&&d.start<previous.end)previous.end=Math.max(previous.end,d.end);else ranges.push({segmentId:d.segmentId,start:d.start,end:d.end});}
   const protectionPlan=ranges.map(r=>{const record=bound.find(b=>b.segment.id===r.segmentId);return {...r,scope:copyPrivacyJson(record.scope),reference:copyPrivacyJson(record.reference),textSha256:record.segment.provenance.textSha256};});
   if(performance.now()>=deadline){disabled=true;controller.abort();return block('detector_failure','CANCEL_OR_TIMEOUT');}
   diagnostic.causes.push('SCAN_COMPLETE_NOT_EGRESS');return response('complete',null,diagnostic,detections,protectionPlan);
  }catch{return block('detector_failure',controller.signal.aborted?'CANCEL_OR_TIMEOUT':'INVALID_OR_UNKNOWN');}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);running=false;}
 }});
}

import {spawn} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
const python=fileURLToPath(new URL('../../artifacts/privacy/onnx-env/bin/python',import.meta.url));
const script=fileURLToPath(new URL('../../scripts/privacy-token-ner-composition-v2-worker.py',import.meta.url));
const fail=()=>({status:'blocked',reasonCategory:'detector_failure',detections:[]});
function startPythonBackend(){
 const candidateId=TOKEN_NER_VERSION;
 const child=spawn(python,['-I','-B',script,'--serve'],{stdio:['pipe','pipe','ignore'],env:{PATH:'/usr/bin:/bin',LANG:'en_US.UTF-8',PYTHONNOUSERSITE:'1',TOKENIZERS_PARALLELISM:'false',OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1',HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1',LEX_PRIVACY_NETWORK_SANDBOX:'required'}});
 let pending=null,dead=false,buffer='',metadata=null,telemetry=null,peakRssBytes=0,readyResolve,readyReject;
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
    else {if(!pending)return stop();const request=pending;const {peakRssBytes:rss,diagnostic,...output}=result;telemetry=validateBackendDiagnostic(diagnostic);if(!Number.isInteger(rss)||rss<0||rss>924*1024*1024)return stop();peakRssBytes=Math.max(peakRssBytes,rss);pending=null;request.resolve(output);}
   }catch{stop();}
  }
 });
 return {ready,get telemetry(){return telemetry;},get metadata(){return metadata;},get peakRssBytes(){return peakRssBytes;},close:stop,
  async detect(input,{signal}={}){telemetry=null;await ready;if(dead||pending||signal?.aborted)throw Error('detector_failure');return new Promise((resolve,reject)=>{
   const abort=()=>{stop();reject(Error('detector_failure'));};const timer=setTimeout(abort,15000);signal?.addEventListener('abort',abort,{once:true});
   const finish=fn=>value=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);fn(value);};pending={resolve:finish(resolve),reject:finish(reject)};
   child.stdin.write(JSON.stringify(input)+'\n',error=>{if(error)stop();});
  });},
 };
}
if(process.send){
 if(process.argv.slice(2).length)throw Error('invalid_configuration');
 const backend=startPythonBackend(),detector=createCompositionDetector({backend});let busy=false;
 const memory=setInterval(()=>{if(process.resourceUsage().maxRSS*1024>100*1024*1024){backend.close();process.exit(3);}},25);
 process.on('disconnect',()=>{clearInterval(memory);backend.close();process.exit(0);});
 backend.ready.then(metadata=>process.send({ready:metadata})).catch(()=>{process.send({errorCategory:'detector_failure'});process.exitCode=2;backend.close();clearInterval(memory);process.disconnect();});
 process.on('message',async message=>{
  if(busy){process.send({errorCategory:'detector_failure'});return;}busy=true;
  try{
   const clean=copyPrivacyJson(message);exactFields(clean,['input']);const input=validateOperationalInput(clean.input);
   const start=performance.now(),composition=await detector.detect(input);
   process.send({composition,telemetry:composition.diagnostic.causes.some(c=>['OPERATIONAL','RULES_BLOCK','INVALID_UNICODE'].includes(c))?null:backend.telemetry,latencyMs:performance.now()-start,peakRssBytes:backend.peakRssBytes+process.resourceUsage().maxRSS*1024});
  }catch{process.send({composition:response('blocked','detector_failure',{ruleDetections:[],nativeSpans:[],proofs:[],causes:['INVALID_OR_UNKNOWN']}),telemetry:null,latencyMs:0,peakRssBytes:backend.peakRssBytes+process.resourceUsage().maxRSS*1024});}
  finally{busy=false;}
 });
}

import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const failure=()=>Error('privacy_token_ner_failed');
export async function startTokenNerWorker({reviewedManifestSha256,timeoutMs=15000}={}, {spawnChild=spawn,killGroup=pid=>process.kill(-pid,'SIGKILL')}={}){
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>15000)throw failure();
 const candidateId=TOKEN_NER_VERSION;
 const manifest=await readFile(new URL('../../resources/privacy-token-ner-composition-v2.json',import.meta.url));
 if(typeof reviewedManifestSha256!=='string'||!/^[a-f0-9]{64}$/.test(reviewedManifestSha256)||createHash('sha256').update(manifest).digest('hex')!==reviewedManifestSha256)throw failure();
 const {candidateSandboxProfile}=await import('../../scripts/run-privacy-detector-v2.mjs');
 const base=await candidateSandboxProfile();
 const receiptPrefix=fileURLToPath(new URL('../../artifacts/privacy/',import.meta.url)).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const profile=base+`(deny file-read* (regex ${JSON.stringify('^'+receiptPrefix+'.*/(failure|started)\\.json$')}) (literal ${JSON.stringify(fileURLToPath(new URL('../../scripts/run-privacy-token-ner-composition-v2.mjs',import.meta.url)))}) (subpath ${JSON.stringify(fileURLToPath(new URL('../../docs',import.meta.url)))}) (literal ${JSON.stringify(fileURLToPath(new URL('../../scripts/run-privacy-ablation-v3.mjs',import.meta.url)))}) (literal ${JSON.stringify(fileURLToPath(new URL('../../scripts/run-privacy-token-ner-v1.mjs',import.meta.url)))}) (literal ${JSON.stringify(fileURLToPath(new URL('../../scripts/run-privacy-token-ner-trace-v1.mjs',import.meta.url)))}) (literal ${JSON.stringify(fileURLToPath(new URL('../../scripts/diagnose-privacy-token-ner-v1.mjs',import.meta.url)))}))`; 
 const child=spawnChild('/usr/bin/sandbox-exec',['-p',profile,process.execPath,fileURLToPath(import.meta.url)],{stdio:['ignore','ignore','ignore','ipc'],detached:true,env:{PATH:'/usr/bin:/bin',LANG:'en_US.UTF-8'},serialization:'json'});
 let dead=false,pending=null,readyResolve,readyReject,metadata;
 const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
 function close(){if(dead)return;dead=true;clearTimeout(loadTimer);try{killGroup(child.pid);}catch{}readyReject(failure());pending?.reject(failure());pending=null;}
 const loadTimer=setTimeout(close,15000);
 child.on('error',close);child.on('exit',close);
 child.on('message',message=>{if(dead)return;try{
  const m=copyPrivacyJson(message);
  if(!metadata){exactFields(m,['ready']);if(m.ready.candidateId!==candidateId||m.ready.manifestSha256!==reviewedManifestSha256)throw failure();metadata=m.ready;clearTimeout(loadTimer);readyResolve(metadata);return;}
  if(!pending?.dispatched)throw failure();exactFields(m,['composition','telemetry','latencyMs','peakRssBytes']);if(m.telemetry!==null)validateBackendDiagnostic(m.telemetry);
  if(!Number.isFinite(m.latencyMs)||m.latencyMs<0||!Number.isInteger(m.peakRssBytes)||m.peakRssBytes>1073741824)throw failure();
  if(m.composition?.diagnosticOnly!==true||m.composition?.egressEligible!==false)throw failure();
  const p=pending;if(performance.now()>=p.deadline||p.signal?.aborted)throw failure();pending=null;p.resolve(m);
 }catch{close();}});
 return {ready,pid:child.pid,close,
  async request(input,{signal}={}){
   // One absolute budget includes readiness and IPC; cancellation owns the worker
   // even while loading, and no continuation may send after settlement.
   const deadline=performance.now()+timeoutMs,clean=validateOperationalInput(input);
   if(signal!==undefined&&!(signal instanceof AbortSignal)||dead||pending)throw failure();
   return new Promise((resolve,reject)=>{
    let settled=false;
    const abort=()=>close();
    const timer=setTimeout(abort,Math.max(0,deadline-performance.now()));
    const finish=fn=>value=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);fn(value);};
    pending={resolve:finish(resolve),reject:finish(reject),deadline,signal,dispatched:false};
    // Install rejection handling before an already-aborted signal closes readiness.
    ready.then(()=>{
     if(settled)return;
     if(dead||signal?.aborted||performance.now()>=deadline){close();return;}
     pending.dispatched=true;
     try{child.send({input:clean},error=>{if(error)close();});}catch{close();}
    },()=>{close();});
    signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted||performance.now()>=deadline)close();
   });
  },
 };
}

const BACKEND_CODES=new Set('COMPLETE UNKNOWN UNK OFFSET COVERAGE OVERFLOW SHAPE BIO_ORPHAN BIO_INVALID LOW_CONFIDENCE UNMAPPED INPUT'.split(' '));
const COMPOSITION_CODES=new Set('COMPLETE UNKNOWN OPERATIONAL RULES BACKEND PATH TIMEOUT_OR_CANCEL'.split(' '));
const ENTITY_KINDS=new Set('GIVEN_NAME SURNAME EMAIL PHONE URL TAX_ID BANK_ACCOUNT ROUTING_NUMBER GOVERNMENT_ID PASSPORT DRIVERS_LICENSE BUILDING_NUMBER STREET_NAME SECONDARY_ADDRESS CITY STATE ZIP_CODE'.split(' '));
export function validateBackendDiagnostic(input){
 const d=copyPrivacyJson(input);exactFields(d,['code','streamIndex','streamKind','entityKind']);
 if(!BACKEND_CODES.has(d.code)||!(d.streamIndex===null||Number.isInteger(d.streamIndex)&&d.streamIndex>=0&&d.streamIndex<256)||![null,'text','path'].includes(d.streamKind)||!(d.entityKind===null||ENTITY_KINDS.has(d.entityKind)))throw Error('invalid_diagnostic');return d;
}
export function validateTelemetry(input){
 const t=copyPrivacyJson(input);exactFields(t,['composition','backend']);if(!COMPOSITION_CODES.has(t.composition))throw Error('invalid_diagnostic');if(t.backend!==null)validateBackendDiagnostic(t.backend);return t;
}
export async function validateCompositionOutput(output,input){
 const c=copyPrivacyJson(output),v=validateOperationalInput(input);exactFields(c,['result','diagnostic','protectionPlan','diagnosticOnly','egressEligible']);
 if(c.diagnosticOnly!==true||c.egressEligible!==false)throw Error('invalid_composition');exactFields(c.result,['status','reasonCategory','detections']);
 if(!['complete','blocked'].includes(c.result.status)||c.result.status==='complete'&&c.result.reasonCategory!==null||c.result.status==='blocked'&&!['scope_mismatch','unknown_provenance','unsupported_format','partial_extraction','ambiguous_context','detector_failure'].includes(c.result.reasonCategory))throw Error('invalid_composition');
 const category=new Set('person organization rfc curp clabe account email phone address case_id context sensitive_relation'.split(' ')),segments=new Map(v.segments.map(s=>[s.id,s]));
 const detection=d=>{exactFields(d,['segmentId','start','end','category']);if(!category.has(d.category)||!segments.has(d.segmentId)||!validPrivacyRange(segments.get(d.segmentId).text,d.start,d.end))throw Error('invalid_composition');};
 if(!Array.isArray(c.result.detections)||c.result.detections.length>2048)throw Error('invalid_composition');c.result.detections.forEach(detection);
 exactFields(c.diagnostic,['ruleDetections','nativeSpans','proofs','causes']);
 for(const field of ['ruleDetections','nativeSpans','proofs','causes'])if(!Array.isArray(c.diagnostic[field])||c.diagnostic[field].length>2048)throw Error('invalid_composition');
 c.diagnostic.ruleDetections.forEach(detection);
 validateNativeOutput({status:'complete',reasonCategory:null,detections:c.diagnostic.nativeSpans,scannedSegments:v.segments.flatMap((_,i)=>[`T${i}`,`P${i}`])},v.segments.flatMap((s,i)=>[{id:`T${i}`,text:s.text},{id:`P${i}`,text:s.path}]));
 const causes=new Set('CANCEL_OR_BUSY INVALID_UNICODE OPERATIONAL RULES_BLOCK CANCEL_OR_TIMEOUT BACKEND_HARD_ERROR PATH_SPAN CATEGORY_CONFLICT UNCOVERED_UNMAPPED SCAN_COMPLETE_NOT_EGRESS INVALID_OR_UNKNOWN'.split(' '));if(c.diagnostic.causes.some(x=>!causes.has(x)))throw Error('invalid_composition');
 const registry=createProvenanceRegistry(),references=new Map();
 if(c.protectionPlan?.length||c.diagnostic.proofs.length)for(const [index,s] of v.segments.entries()){const op=v.operational.segments.find(o=>o.id===s.id);const registered=registry.registerSource({objectId:`composition-${index}`,version:'v2',scope:s.originScope,classification:s.classification,extraction:{status:op.extractionStatus,extractorVersion:'plain-fixture-v2',originalSha256:privacyTextHash(s.text)},assessment:op.assessment,segments:[{id:s.id,path:s.path,text:s.text}]});references.set(s.id,registry.resolve({scope:v.scope,segment:registered.segments[0]}).reference);}
 const bound=r=>{if(!segments.has(r.segmentId)||!validPrivacyRange(segments.get(r.segmentId).text,r.start,r.end)||r.textSha256!==privacyTextHash(segments.get(r.segmentId).text)||!samePrivacyScope(r.scope,v.scope))throw Error('invalid_composition');exactFields(r.reference,['objectId','version','hash']);if(!/^composition-\d+$/.test(r.reference.objectId)||r.reference.version!=='v2'||!/^[a-f0-9]{64}$/.test(r.reference.hash)||!references.has(r.segmentId)||Object.keys(r.reference).some(k=>r.reference[k]!==references.get(r.segmentId)[k]))throw Error('invalid_composition');};
 for(const proof of c.diagnostic.proofs){exactFields(proof,['kind','segmentId','start','end','rule','scope','reference','textSha256','utf8Start','utf8End']);bound(proof);detection(proof.rule);if(!KINDS.has(proof.kind)||mapping[proof.kind]||!contains(proof.rule,proof)||!c.diagnostic.ruleDetections.some(r=>JSON.stringify(r)===JSON.stringify(proof.rule))||proof.utf8Start!==Buffer.byteLength(segments.get(proof.segmentId).text.slice(0,proof.start))||proof.utf8End!==Buffer.byteLength(segments.get(proof.segmentId).text.slice(0,proof.end)))throw Error('invalid_composition');}
 if(c.result.status==='blocked'){if(c.protectionPlan!==null||c.result.detections.length)throw Error('invalid_composition');}
 else{if(!Array.isArray(c.protectionPlan)||c.protectionPlan.length>2048)throw Error('invalid_composition');for(const range of c.protectionPlan){exactFields(range,['segmentId','start','end','scope','reference','textSha256']);bound(range);}
 const expected=[];for(const d of [...c.result.detections].sort(order)){const last=expected.at(-1);if(last&&last.segmentId===d.segmentId&&d.start<last.end)last.end=Math.max(last.end,d.end);else expected.push({segmentId:d.segmentId,start:d.start,end:d.end});}if(JSON.stringify(expected)!==JSON.stringify(c.protectionPlan.map(({segmentId,start,end})=>({segmentId,start,end}))))throw Error('invalid_composition');}
 // Independently recompute local rules, operational gates and every native-span proof.
 // Declared native spans are data, never authority for rule claims or release eligibility.
 const replay=await createCompositionDetector({backend:fakeReplayBackend(c.diagnostic.nativeSpans)}).detect(v);
 const transient=new Set(['CANCEL_OR_BUSY','CANCEL_OR_TIMEOUT','BACKEND_HARD_ERROR','INVALID_OR_UNKNOWN']);
 if(c.result.status==='complete'||!c.diagnostic.causes.some(code=>transient.has(code))){
  if(!isDeepStrictEqual(c,replay))throw Error('invalid_composition');
 }else{
  // Runtime failures cannot be replayed. Still verify all retained rules locally and
  // verify any proof prefix, and forbid overriding an operational failure.
  if(c.diagnostic.causes.length!==1||!transient.has(c.diagnostic.causes[0])||evaluateOperationalPreparation(v).status==='blocked')throw Error('invalid_composition');
  if(!isDeepStrictEqual(c.diagnostic.ruleDetections,replay.diagnostic.ruleDetections)&&!(c.diagnostic.causes[0]==='CANCEL_OR_BUSY'&&c.diagnostic.ruleDetections.length===0))throw Error('invalid_composition');
  if(!isDeepStrictEqual(c.diagnostic.proofs,replay.diagnostic.proofs.slice(0,c.diagnostic.proofs.length)))throw Error('invalid_composition');
  if(c.result.reasonCategory!=='detector_failure'&&!(c.diagnostic.causes[0]==='BACKEND_HARD_ERROR'&&c.result.reasonCategory==='ambiguous_context'))throw Error('invalid_composition');
 }
 return c;
}
function fakeReplayBackend(nativeSpans){return {async detect({segments}){return {status:'complete',reasonCategory:null,detections:nativeSpans,scannedSegments:segments.map(s=>s.id)};}};}

