// Synthetic opt-in composition: actual detector + trusted provenance + H1/H2/H3.
// This test adapter is not a production route or evidence of preregistered recall.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalPrivacyDetector} from '../server/privacy/detector.mjs';
import {createProvenanceRegistry,privacyTextHash,segmentsFromEnvelope} from '../server/privacy/provenance.mjs';
import {createPseudonymStore} from '../server/privacy/pseudonyms.mjs';
import {createEgressPolicy} from '../server/egress-policy.mjs';
import {createMockInference} from '../server/inference-mock.mjs';
import {canonicalJson} from '../server/canonical-json.mjs';

const a={workspaceId:'FIRM_A',matterId:'MATTER_A',threadId:'THREAD_A'};
const scopes=[a,{...a,threadId:'THREAD_B'},{...a,matterId:'MATTER_B'},{workspaceId:'FIRM_B',matterId:'MATTER_B',threadId:'THREAD_B'}];
const fail=code=>{throw Object.assign(Error('Synthetic composition blocked.'),{code});};
const entity='María Pérez',email='persona@demo.invalid';
const originalText=`🧪 ${entity} entregará $1,234.50 el 2026-11-09 según artículo 12 [S1].`;
function entitiesFor(segments,detections) {
 const entities=[];
 for(const segment of segments) {
  const ranges=detections.filter(d=>d.segmentId===segment.id).sort((a,b)=>a.start-b.start||a.end-b.end),merged=[];
  for(const range of ranges) {
   const previous=merged.at(-1);
   if(previous&&range.start<previous.end)previous.end=Math.max(previous.end,range.end);else merged.push({...range});
  }
  entities.push(...merged.map(range=>segment.text.slice(range.start,range.end)));
 }
 return [...new Set(entities)];
}
function harness({scope=a,pseudonyms=createPseudonymStore(),sourceOverrides={},envelopeChange,preparedChange,beforeClassify,afterChunk,controller,markerNamespace}={}) {
 const provenance=createProvenanceRegistry(),detector=createLocalPrivacyDetector({provenanceRegistry:provenance}),shown=[],saved=[],checks=[];
 const policy={version:'P1',grants:[{scope,destination:'mock',allowedCategories:['synthetic','public']}]};
 let provider,gate,prepared;
 const register=(objectId,envelope,extras={})=>provenance.registerSource({objectId,version:'v1',scope,classification:'synthetic',
  extraction:{status:'complete',extractorVersion:'canonical-envelope-v1',originalSha256:privacyTextHash(canonicalJson(envelope))},segments:segmentsFromEnvelope(envelope),...extras});
 const state={shown,saved,checks,provenance,pseudonyms,policy,get sent(){return provider?.sent??[];},get prepared(){return prepared;},get audit(){return gate?.audit??[];},
  async run() {
   const envelope={version:1,responseFormat:'json',messages:[{role:'user',content:originalText,metadata:{fileName:`${entity}.docx`,toolResult:{excerpt:`Correo: ${email}`}}},{role:'assistant',content:`Antes: ${entity}.`}],outputSchema:{type:'object',description:`Resumen para ${entity}`,properties:{reply:{type:'string'}}}};
   envelopeChange?.(envelope);
   const source=register('ORIGINAL',envelope,sourceOverrides);
   const initial=await detector.detect({scope,segments:source.segments,signal:controller?.signal});checks.push(initial);
   if(initial.status!=='complete')fail(initial.reasonCategory);
   // H3 metadata wrapping lets the SAME protected version cover schema text too.
   const wrapper=[...envelope.messages,{role:'system',content:'',metadata:{outputSchema:envelope.outputSchema}}];
   const entities=entitiesFor(source.segments,initial.detections);
   // Pin ALL synthetic markers, not only the namespace: random hex IDs can
   // contain digit runs which the real final detector correctly blocks.
   let snapshot;
   try {snapshot=pseudonyms.exportSnapshot({scope});}catch(error){if(error.code!=='unknown_scope')throw error;}
   if(!snapshot) {
    const namespace=markerNamespace??'abcdef'[scopes.findIndex(candidate=>candidate.workspaceId===scope.workspaceId&&candidate.matterId===scope.matterId)].repeat(32);
    const entries=entities.map((text,index)=>({text,marker:`[[LEX_${namespace}_${index.toString(6).replace(/[0-5]/g,digit=>'abcdef'[Number(digit)]).padStart(32,'a')}]]`}));
    pseudonyms.importSnapshot({scope,snapshot:{format:1,scope:{workspaceId:scope.workspaceId,matterId:scope.matterId},namespace,mappingVersion:namespace,entries}});
   } else assert.deepEqual(entities.filter(text=>!snapshot.entries.some(entry=>entry.text===text)),[],'fixture must pin every expected entity marker');
   const protectedData=pseudonyms.protect({scope,messages:wrapper,entities,provenance:{reference:source.reference}});
   prepared={version:1,responseFormat:'json',messages:protectedData.messages.slice(0,-1),outputSchema:protectedData.messages.at(-1).metadata.outputSchema};
   const pinned=canonicalJson(prepared),mappingVersion=protectedData.mappingVersion;
   const derived=provenance.deriveSource({objectId:'PREPARED',version:'v1',scope,classification:'public',parents:[source.reference],extraction:{status:'complete',extractorVersion:'protection-v1',originalSha256:privacyTextHash(pinned)},segments:segmentsFromEnvelope(prepared)});
   const response=JSON.stringify({reply:prepared.messages[0].content});
   provider=createMockInference({responses:[[response.slice(0,17),response.slice(17)]]});await provider.initialize();
   preparedChange?.(prepared);
   gate=createEgressPolicy({destinations:{mock:provider},getPolicy:()=>policy,classify:async input=>{
    beforeClassify?.({source,provenance,policy});
    const exact=input.serialized===pinned;
    const actual=segmentsFromEnvelope(input.envelope);
    const bound=exact && canonicalJson(actual)===canonicalJson(derived.segments.map(({provenance,...segment})=>segment));
    const final=await detector.detect({scope:input.scope,segments:bound?derived.segments:actual,signal:controller?.signal});checks.push(final);
    const category=provenance.resolve({scope,segment:derived.segments[0]}).classification;
    return {scope:input.scope,destination:input.destination,policyVersion:input.policyVersion,serialized:input.serialized,
     category,reliable:exact&&final.status==='complete'&&final.detections.length===0,scopeVerified:bound};
   }});
   const chunks=[];
   for await(const chunk of gate.generate(prepared.messages,{scope,destination:'mock',responseFormat:'json',outputSchema:prepared.outputSchema,signal:controller?.signal})) {
    chunks.push(chunk);afterChunk?.({policy,controller});
   }
   const output=JSON.parse(chunks.join(''));
   const text=pseudonyms.restore({scope,mappingVersion,text:output.reply});
   if(controller?.signal.aborted)fail('cancelled');
   shown.push(text);saved.push(text);return text;
  }};
 return state;
}

test('real detector-derived entities protect all actual outbound bytes and restore exact Unicode, dates, amounts and citations',async()=>{
 const h=harness(),answer=await h.run();assert.equal(answer,originalText);assert.deepEqual(h.saved,[originalText]);assert.deepEqual(h.shown,[originalText]);
 assert.equal(h.checks.length,2);assert.equal(h.checks[0].status,'complete');assert.equal(h.checks[1].status,'complete');assert.deepEqual(h.checks[1].detections,[]);
 const captured=h.sent[0];assert.equal(captured.serialized,canonicalJson(h.prepared));assert.deepEqual(captured.bytes,new TextEncoder().encode(canonicalJson(h.prepared)));
 for(const secret of [entity,email,'mappingVersion','textSha256','provenance','originalSha256','FIRM_A','MATTER_A','THREAD_A'])assert.ok(!captured.serialized.includes(secret),secret);
 for(const preserved of ['$1,234.50','2026-11-09','artículo 12','[S1]','🧪'])assert.ok(captured.messages[0].content.includes(preserved),preserved);
 assert.equal(h.audit[0].result,'completed');
});

test('overlapping relationship/person detections union locally and restore without lost or duplicated facts',async()=>{
 const h=harness({envelopeChange:e=>{e.messages[0].content='María Pérez es paciente del consultorio. Fecha 2026-11-09; monto $1,234.50 [S1].';}});
 const result=await h.run();assert.equal(result,'María Pérez es paciente del consultorio. Fecha 2026-11-09; monto $1,234.50 [S1].');
 const initial=h.checks[0];assert.ok(initial.detections.some(d=>d.category==='person'));assert.ok(initial.detections.some(d=>d.category==='sensitive_relation'));
 assert.doesNotMatch(h.sent[0].serialized,/María|paciente del consultorio/);
});

test('partial/unsupported/ambiguous/detector failures and unknown/private provenance prevent transport and local commits',async()=>{
 const variants=[
  ...['partial','unsupported','failed'].map(status=>({extraction:{status,extractorVersion:'plain-v1',originalSha256:privacyTextHash('original')}})),
  {assessment:'ambiguous'},{assessment:'failed'},{classification:'unknown'},{classification:'private'},
 ];
 for(const sourceOverrides of variants) {
  const h=harness({sourceOverrides});await assert.rejects(h.run());assert.equal(h.sent.length,0);assert.deepEqual(h.shown,[]);assert.deepEqual(h.saved,[]);
 }
});

test('foreign firms, matters or threads reject before dispatch even when entity text would be fully masked',async()=>{
 for(const field of ['workspaceId','matterId','threadId']) {
  const h=harness({sourceOverrides:{scope:{...a,[field]:'FOREIGN'}}});await assert.rejects(h.run(),{code:'scope_mismatch'});assert.equal(h.sent.length,0);assert.deepEqual(h.saved,[]);
 }
});

test('sensitive structural keys cannot be rewritten as values, merged or skipped',async()=>{
 const h=harness({envelopeChange:e=>{e.messages[0].metadata[email]='generic';}});
 await assert.rejects(h.run(),{code:'ambiguous_context'});assert.equal(h.sent.length,0);assert.deepEqual(h.shown,[]);
});

test('final serialized metadata/history/schema/tool leakage or tampering is rejected with zero captured bytes',async()=>{
 for(const preparedChange of [
  e=>e.messages[0].content=entity,
  e=>e.messages[1].content=email,
  e=>e.messages[0].metadata.fileName=`${entity}.docx`,
  e=>e.messages[0].metadata.toolResult.excerpt=email,
  e=>e.outputSchema.description=entity,
  e=>e.outputSchema.properties[email]={type:'string'},
 ]) {
  const h=harness({preparedChange});await assert.rejects(h.run());assert.equal(h.sent.length,0);assert.deepEqual(h.saved,[]);
 }
});

test('ancestor changes during classification invalidate derivation before sending; no stale restoration can commit',async()=>{
 const h=harness({beforeClassify:({provenance})=>{
  provenance.registerSource({objectId:'ORIGINAL',version:'v2',scope:a,classification:'synthetic',extraction:{status:'complete',extractorVersion:'txt-v1',originalSha256:privacyTextHash('new')},segments:[{id:'SEG',path:'content',text:'changed'}]});
 }});
 await assert.rejects(h.run());assert.equal(h.sent.length,0);assert.deepEqual(h.shown,[]);
});

test('cancellation before dispatch or during stream suppresses every local result; sent bytes remain observable',async()=>{
 const before=new AbortController();before.abort();const blocked=harness({controller:before});await assert.rejects(blocked.run());assert.equal(blocked.sent.length,0);assert.deepEqual(blocked.saved,[]);
 const during=new AbortController();let chunksSeen=0;
 const h=harness({controller:during,afterChunk:({controller})=>{
  assert.equal(h.checks.length,2);assert.equal(h.checks[1].status,'complete');assert.deepEqual(h.checks[1].detections,[]);
  assert.equal(h.sent.length,1,'classification passed before the provider chunk');chunksSeen++;controller.abort();
 }});
 await assert.rejects(h.run(),{code:'cancelled'});assert.equal(chunksSeen,1);assert.equal(h.sent.length,1);assert.deepEqual(h.shown,[]);assert.deepEqual(h.saved,[]);
});

test('two firms, matters and threads keep registry checks exact and per-matter H3 markers isolated',async()=>{
 const pseudonyms=createPseudonymStore(),runs=[];
 for(const scope of scopes) {const h=harness({scope,pseudonyms});await h.run();runs.push(h);}
 const marker=scope=>pseudonyms.exportSnapshot({scope}).entries.find(entry=>entry.text===entity).marker;
 assert.equal(marker(scopes[0]),marker(scopes[1]));assert.notEqual(marker(scopes[0]),marker(scopes[2]));assert.notEqual(marker(scopes[2]),marker(scopes[3]));
 const foreignVersion=pseudonyms.exportSnapshot({scope:scopes[3]}).mappingVersion;
 assert.throws(()=>pseudonyms.restore({scope:a,mappingVersion:foreignVersion,text:marker(scopes[3])}),{code:'stale_version'});
 for(const h of runs){assert.equal(h.sent.length,1);assert.deepEqual(h.saved,[originalText]);}
});

test('policy revocation after a captured chunk suppresses restoration and history commit without retry',async()=>{
 const h=harness({afterChunk:({policy})=>{policy.grants=[];}});await assert.rejects(h.run(),{code:'policy_changed'});
 assert.equal(h.sent.length,1);assert.deepEqual(h.shown,[]);assert.deepEqual(h.saved,[]);assert.equal(h.audit[0].result,'policy_changed');
});

test('actual full requests with numeric account values or numeric schema const/enum never dispatch',async()=>{
 for(const envelopeChange of [
  e=>{e.messages[0].metadata.account=1234567890123456;},
  e=>{e.outputSchema.properties.reply.const=1234567890123456;},
  e=>{e.outputSchema.properties.reply.enum=[1,1234567890123456];},
 ]) {
  const h=harness({envelopeChange});await assert.rejects(h.run(),{code:'ambiguous_context'});assert.equal(h.sent.length,0);assert.deepEqual(h.saved,[]);
 }
 const ordinary=harness({envelopeChange:e=>{e.messages[0].metadata.article=12;e.messages[0].metadata.amount=1234.5;}});
 assert.equal(await ordinary.run(),originalText);assert.equal(ordinary.sent[0].messages[0].metadata.amount,1234.5);
});

// This is a deterministic reproduction of the mechanism, not the unlogged
// random UUID from the earlier intermittent failure. No marker exemption exists.
test('digit-rich synthetic markers are rejected by real final classification before dispatch',async()=>{
 let chunksSeen=0;
 const h=harness({markerNamespace:'abcdef123456489082345678abcdefab',afterChunk:()=>{chunksSeen++;}});
 await assert.rejects(h.run(),{code:'classification_denied'});
 assert.equal(h.checks.length,2);assert.equal(h.checks[1].status,'complete');
 assert.ok(h.checks[1].detections.length>0);
 assert.equal(chunksSeen,0);assert.equal(h.sent.length,0);assert.deepEqual(h.shown,[]);assert.deepEqual(h.saved,[]);
});
