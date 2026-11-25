// Hand-authored synthetic backend responses only. No inference, egress or corpus.
import test from 'node:test';import assert from 'node:assert/strict';
import {createIntakeContractualCandidate,INTAKE_CONTRACTUAL_VERSION} from '../server/privacy/intake-contractual-candidate.mjs';
const scope={workspaceId:'W',matterId:'M',threadId:'T'};
const input=(texts=['La obligación se cumple en plazo.'])=>({scope,segments:texts.map((text,i)=>({id:'S'+i,path:'field'+i,text,classification:'synthetic',originScope:scope})),operational:{processorStatus:'ok',segments:texts.map((_,i)=>({id:'S'+i,mediaType:'text/plain',extractionStatus:'complete',assessment:'known'}))}});
const complete=detections=>({status:'complete',reasonCategory:null,detections});
const ask=async()=>({oraciones:[]});
const backend=(review=async()=>complete([]))=>({review,ask});
test('typed whole-context input binds every field and scope, exact offsets survive emojis',async()=>{
 const text='🚢 Rosa pregunta por la cláusula.';const request=input([text,'Ella firma con su hermano.']);let call;
 const candidate=createIntakeContractualCandidate({backend:backend(async value=>{call=structuredClone(value);value.scope.matterId='mutated-backend-copy';return complete([{segmentId:'T0',start:3,end:7,category:'person'},{segmentId:'T1',start:0,end:25,category:'sensitive_relation'}]);})});
 const result=await candidate.detect(request);assert.equal(candidate.version,INTAKE_CONTRACTUAL_VERSION);assert.equal(result.status,'complete');assert.ok(result.detections.some(d=>d.segmentId==='S0'&&d.start===3&&d.end===7&&d.category==='person'));assert.ok(call.segments.some(s=>s.id==='T1'));assert.equal(request.scope.matterId,'M');
 const first=call.binding;const changed=structuredClone(request);changed.segments[1].text+=' Otro contexto.';await candidate.detect(changed);assert.notEqual(call.binding,first);const second=call.binding;changed.scope={...scope,threadId:'T2'};changed.segments.forEach(s=>s.originScope=changed.scope);await candidate.detect(changed);assert.notEqual(call.binding,second);
});
test('untyped, fabricated, foreign, surrogate-split and path detections fail closed',async()=>{
 for(const detections of [[{segmentId:'T0',start:0,end:1,category:'Dato1'}],[{segmentId:'foreign',start:0,end:1,category:'person'}],[{segmentId:'T0',start:0,end:1,category:'person'}],[{segmentId:'P0',start:0,end:2,category:'person'}]]){
  const result=await createIntakeContractualCandidate({backend:backend(async()=>complete(detections))}).detect(input(['🚢 Consulta de prueba.']));assert.equal(result.status,'blocked');
 }
 assert.equal((await createIntakeContractualCandidate({backend:backend(async()=>({entities:['Rosa']}))}).detect(input())).status,'blocked');
});
test('legacy indirect mask without typed classification blocks, never becomes context by inference',async()=>{
 const candidate=createIntakeContractualCandidate({backend:{review:async()=>complete([]),ask:async(_prompt,body)=>({oraciones:[JSON.parse(body)[0].id]})}});
 const result=await candidate.detect(input(['La entrega ocurre durante la feria del pueblo.']));assert.equal(result.status,'blocked');assert.equal(result.reasonCategory,'ambiguous_context');assert.deepEqual(result.detections,[]);
});
test('scope, operational failure, reserved marker, abort and malformed context fail before success',async()=>{
 let calls=0;const candidate=createIntakeContractualCandidate({backend:backend(async()=>{calls++;return complete([]);})});
 const mismatch=input();mismatch.segments[0].originScope={...scope,matterId:'other'};assert.equal((await candidate.detect(mismatch)).reasonCategory,'scope_mismatch');assert.equal(calls,0);
 const failed=input();failed.operational.processorStatus='failed';assert.equal((await candidate.detect(failed)).reasonCategory,'detector_failure');assert.equal(calls,0);
 assert.equal((await candidate.detect(input(['[[LEX_foreign]] consulta.']))).status,'blocked');
 const stop=new AbortController();stop.abort();assert.equal((await candidate.detect(input(),{signal:stop.signal})).status,'blocked');assert.equal(calls,0);
 const broken=createIntakeContractualCandidate({backend:{review:async()=>complete([]),ask:async()=>({oraciones:[999]})}});assert.equal((await broken.detect(input())).status,'blocked');
});
test('backend failure never exposes partial spans or a completed assessment',async()=>{
 for(const review of [async()=>{throw Error('local unavailable');},async()=>({status:'blocked',reasonCategory:'ambiguous_context',detections:[{segmentId:'T0',start:0,end:2,category:'person'}]})]){
  const result=await createIntakeContractualCandidate({backend:backend(review)}).detect(input());assert.equal(result.status,'blocked');assert.deepEqual(result.detections,[]);
 }
});
test('abort settles even an uncooperative synthetic backend without partial result',async()=>{
 const stop=new AbortController();const candidate=createIntakeContractualCandidate({backend:backend(async()=>{stop.abort();return new Promise(()=>{});})});
 const result=await candidate.detect(input(),{signal:stop.signal});assert.equal(result.status,'blocked');assert.deepEqual(result.detections,[]);
});
test('same literal repeated with only one typed occurrence blocks partial coverage',async()=>{
 const text='Rosa solicita el contrato. Rosa firma la entrega.';
 const candidate=createIntakeContractualCandidate({backend:backend(async()=>complete([{segmentId:'T0',start:0,end:4,category:'person'}]))});
 const result=await candidate.detect(input([text]));assert.equal(result.status,'blocked');assert.equal(result.reasonCategory,'ambiguous_context');
});
test('deterministic path scan rejects known identifier even if backend says empty',async()=>{
 let called=false;const request=input();request.segments[0].path='correo@example.test';
 const result=await createIntakeContractualCandidate({backend:backend(async()=>{called=true;return complete([]);})}).detect(request);assert.equal(result.status,'blocked');assert.equal(called,false);
});
