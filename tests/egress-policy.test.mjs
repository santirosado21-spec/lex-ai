import test from 'node:test';
import assert from 'node:assert/strict';
import {getEventListeners} from 'node:events';
import {createMockInference} from '../server/inference-mock.mjs';
import {createEgressPolicy} from '../server/egress-policy.mjs';

const scope = {workspaceId:'FIRM_A',matterId:'MATTER_A',threadId:'THREAD_A'};
const messages = () => [{role:'user',content:'Pregunta sintética'}];
const options = () => ({scope:{...scope},destination:'mock',responseFormat:'text'});
const policy = () => ({version:'v1',grants:[{scope:{...scope},destination:'mock',allowedCategories:['synthetic','public']}]});
const verdict = input => ({serialized:input.serialized,scope:input.scope,destination:input.destination,policyVersion:input.policyVersion,reliable:true,scopeVerified:true,category:'synthetic'});
const collect = async iterator => { const chunks=[]; for await (const chunk of iterator) chunks.push(chunk); return chunks; };
const rejected = (promise, code) => assert.rejects(promise, error => error.name === 'EgressPolicyError' && error.code === code && !error.message.includes('CANARY'));
async function fixture(overrides={}) {
 const provider=createMockInference({responses:[['Uno','Dos'],'Otro']});await provider.initialize();
 const current={value:policy()};
 const gate=createEgressPolicy({destinations:{mock:provider},getPolicy:()=>current.value,classify:verdict,...overrides});
 return {provider,current,gate};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('default deny, absent classification, missing scope and caller authorization claims never invoke provider',async()=>{
 const provider=createMockInference({responses:['Reserved']});await provider.initialize();
 const gate=createEgressPolicy({destinations:{mock:provider}});
 await rejected(collect(gate.generate(messages(),options())),'policy_unavailable');
 const setup=await fixture({classify:undefined});
 await rejected(collect(setup.gate.generate(messages(),options())),'classification_unavailable');
 for(const extra of [{policy:policy()},{classification:{reliable:true}},{tools:[]},{toolChoice:'auto'},{destination:'unknown'},{scope:{workspaceId:'FIRM_A',matterId:'MATTER_A'}}]) {
  const {gate,provider}=await fixture();await assert.rejects(collect(gate.generate(messages(),{...options(),...extra})));assert.equal(provider.sent.length,0);
 }
 assert.equal(provider.sent.length,0);assert.equal(setup.provider.sent.length,0);
});

test('trusted verdict binds whole exact envelope, UTF-8, history, metadata and schema; caller mutation cannot change dispatch',async()=>{
 let release, captured;
 const pending=new Promise(resolve=>{release=resolve;});
 const {gate,provider}=await fixture({classify:async input=>{captured=input;await pending;return verdict(input);}});
 const input=[{role:'system',content:'Sintético'},{role:'assistant',content:'Historia 🧪',metadata:{origin:'public',toolResult:{text:'dato sintético'}}},{role:'user',content:'Nueva pregunta'}];
 const opts={...options(),responseFormat:'json',outputSchema:{type:'object',properties:{answer:{description:'Descripción sintética',type:'string'}}}};
 const expected=structuredClone({input,opts});
 const generation=collect(gate.generate(input,opts));await tick();
 assert.equal(provider.sent.length,0);assert.ok(Object.isFrozen(captured.envelope.messages[1].metadata.toolResult));
 input[1].content='CANARY_MUTATION';opts.scope.threadId='THREAD_B';opts.outputSchema.properties.answer.description='CANARY_SCHEMA';
 release();assert.deepEqual(await generation,['Uno','Dos']);
 assert.equal(provider.sent[0].serialized,captured.serialized);
 assert.equal(Buffer.from(provider.sent[0].bytes).toString('utf8'),captured.serialized);
 assert.deepEqual(provider.sent[0].messages,expected.input);assert.deepEqual(provider.sent[0].outputSchema,expected.opts.outputSchema);
 assert.doesNotMatch(captured.serialized,/FIRM_A|MATTER_A|THREAD_A|policyVersion|CANARY/);
 assert.equal(gate.audit[0].result,'completed');
});

test('two firms, matters and threads require exact grants, with no wildcard or cross-scope composition',async()=>{
 const {provider}=await fixture();
 const second={workspaceId:'FIRM_B',matterId:'MATTER_B',threadId:'THREAD_B'};
 const current=policy();current.grants.push({scope:second,destination:'mock',allowedCategories:['synthetic']});
 const gate=createEgressPolicy({destinations:{mock:provider},getPolicy:()=>current,classify:verdict});
 for(const workspaceId of ['FIRM_A','FIRM_B'])for(const matterId of ['MATTER_A','MATTER_B'])for(const threadId of ['THREAD_A','THREAD_B']) {
  const requested={workspaceId,matterId,threadId};
  const run=collect(gate.generate(messages(),{...options(),scope:requested}));
  if(JSON.stringify(requested)===JSON.stringify(scope)||JSON.stringify(requested)===JSON.stringify(second))await run;
  else await rejected(run,'scope_denied');
 }
 assert.equal(provider.sent.length,2);
 assert.equal(gate.audit.filter(event=>event.result==='scope_denied').every(event=>event.scope===null&&event.destination===null),true);
});

test('unreliable, partial, private, stale or differently scoped classifications fail closed',async()=>{
 for(const alter of [v=>null,v=>({...v,reliable:false}),v=>({...v,scopeVerified:false}),v=>({...v,category:'private'}),v=>({...v,serialized:'partial'}),v=>({...v,scope:{...scope,matterId:'MATTER_B'}}),v=>({...v,destination:'other'}),v=>({...v,policyVersion:'old'}),v=>({...v,extra:'CANARY'})]) {
  const {gate,provider}=await fixture({classify:input=>alter(verdict(input))});
  await rejected(collect(gate.generate(messages(),options())),'classification_denied');assert.equal(provider.sent.length,0);
 }
 const {gate,provider}=await fixture({getPolicy:()=>({...policy(),grants:[{...policy().grants[0],allowedCategories:['public']}]})});
 await rejected(collect(gate.generate(messages(),options())),'classification_denied');assert.equal(provider.sent.length,0);
});

test('revocation between operations and during asynchronous classification blocks before provider invocation',async()=>{
 const first=await fixture();await collect(first.gate.generate(messages(),options()));first.current.value.grants=[];
 await rejected(collect(first.gate.generate(messages(),options())),'scope_denied');assert.equal(first.provider.sent.length,1);
 for(const change of [p=>p.grants.splice(0),p=>{p.version='v2';},p=>{p.grants[0].allowedCategories=['public'];}]) {
  let release;const wait=new Promise(resolve=>{release=resolve;});
  const {gate,provider,current}=await fixture({classify:async input=>{await wait;return verdict(input);}});
  const run=collect(gate.generate(messages(),options()));await tick();change(current.value);release();
  await rejected(run,'policy_changed');assert.equal(provider.sent.length,0);
 }
});

test('async policy is invalid and synchronous abort from policy check cannot slip through dispatch',async()=>{
 const asyncPolicy=await fixture({getPolicy:async()=>policy()});
 await rejected(collect(asyncPolicy.gate.generate(messages(),options())),'policy_unavailable');assert.equal(asyncPolicy.provider.sent.length,0);
 const controller=new AbortController();let reads=0;
 const {gate,provider}=await fixture({getPolicy:()=>{if(++reads===2)controller.abort();return policy();}});
 await rejected(collect(gate.generate(messages(),{...options(),signal:controller.signal})),'cancelled');assert.equal(provider.sent.length,0);
});

test('cancellation before and during classification does not dispatch, consume fixtures or leak listeners',async()=>{
 const controller=new AbortController(),first=await fixture();controller.abort();
 await rejected(collect(first.gate.generate(messages(),{...options(),signal:controller.signal})),'cancelled');assert.equal(first.provider.sent.length,0);
 const pending=new AbortController();let release;
 const wait=new Promise(resolve=>{release=resolve;});
 const {gate,provider}=await fixture({classify:async input=>{await wait;return verdict(input);}});
 const run=collect(gate.generate(messages(),{...options(),signal:pending.signal}));await tick();pending.abort();
 await rejected(run,'cancelled');assert.equal(getEventListeners(pending.signal,'abort').length,0);release();await tick();assert.equal(provider.sent.length,0);
 assert.deepEqual(await collect(gate.generate(messages(),options())),['Uno','Dos']);
});

test('provider errors, classification errors and consumer break never retry or fallback; diagnostics stay fixed',async()=>{
 let calls=0,closed=0,fallbackCalls=0;
 const broken={async *generate(){calls++;try{yield 'uno';throw Error('CANARY_PROVIDER_SECRET');}finally{closed++;}}};
 const fallback={async *generate(){fallbackCalls++;yield 'bad';}};
 const gate=createEgressPolicy({destinations:{mock:broken,other:fallback},getPolicy:policy,classify:verdict});
 await rejected(collect(gate.generate(messages(),options())),'provider_failed');
 assert.equal(calls,1);assert.equal(closed,1);assert.equal(fallbackCalls,0);assert.equal(gate.audit[0].result,'provider_failed');
 for await(const _ of gate.generate(messages(),options()))break;
 assert.equal(calls,2);assert.equal(closed,2);assert.equal(gate.audit[1].result,'interrupted');
 const badClassifier=await fixture({classify:()=>{throw Error('CANARY_DETECTOR_SECRET');}});
 await rejected(collect(badClassifier.gate.generate(messages(),options())),'classification_unavailable');assert.equal(badClassifier.provider.sent.length,0);
 assert.doesNotMatch(JSON.stringify([...gate.audit,...badClassifier.gate.audit]),/CANARY|SECRET|messages|serialized/);
});

test('stream cancellation and revocation close the active provider without additional dispatch',async()=>{
 for(const cancel of [true,false]) {
  const {gate,provider,current}=await fixture(),controller=new AbortController();
  const iterator=gate.generate(messages(),{...options(),signal:controller.signal});assert.equal((await iterator.next()).value,'Uno');
  if(cancel)controller.abort();else current.value.grants=[];
  await rejected(iterator.next(),cancel?'cancelled':'policy_changed');assert.equal(provider.sent.length,1);assert.equal((await provider.status()).busy,false);
 }
});

test('strict request validation rejects unsupported fields, non-JSON input and getters without side effects',async()=>{
 const {gate,provider}=await fixture();let called=0;
 const accessor={role:'user'};Object.defineProperty(accessor,'content',{enumerable:true,get(){called++;return 'CANARY';}});
 const cycle={};cycle.self=cycle;
 for(const input of [[accessor],[{role:'user',content:'text',tools:[]}],[{role:'tool',content:'text'}],[{role:'user',content:'text',metadata:cycle}],[{role:'user',content:'text',metadata:undefined}],[{role:'user',content:'text',destination:'other'}]]) {
  await rejected(collect(gate.generate(input,options())),'invalid_request');
 }
 const opts=options();Object.defineProperty(opts,'policy',{enumerable:true,get(){called++;return policy();}});
 await rejected(collect(gate.generate(messages(),opts)),'invalid_request');
 assert.equal(called,0);assert.equal(provider.sent.length,0);
});

test('audit uses only fixed fields and trusted matched IDs; returned records cannot mutate audit history',async()=>{
 const {gate}=await fixture();
 await rejected(collect(gate.generate(messages(),{...options(),scope:{...scope,threadId:'CANARY_UNKNOWN_SCOPE'}})),'scope_denied');
 await rejected(collect(gate.generate(messages(),{...options(),destination:'CANARY_DESTINATION'})),'scope_denied');
 await collect(gate.generate([{role:'user',content:'CANARY_SYNTHETIC_CONTENT'}],options()));
 for(const event of gate.audit){assert.deepEqual(Object.keys(event).sort(),['category','scope','destination','time','result','policyVersion'].sort());assert.equal(Number.isFinite(Date.parse(event.time)),true);}
 assert.doesNotMatch(JSON.stringify(gate.audit),/CANARY/);
 const audit=gate.audit;audit[2].scope.threadId='MUTATED';assert.equal(gate.audit[2].scope.threadId,'THREAD_A');
});

test('cancellation during a pending mock chunk closes the provider and never dispatches elsewhere',{timeout:2000},async()=>{
 const provider=createMockInference({responses:['Never delivered'],chunkDelayMs:60000});await provider.initialize();
 let fallbackCalls=0;
 const other={async *generate(){fallbackCalls++;yield 'fallback';}};
 const gate=createEgressPolicy({destinations:{mock:provider,other},getPolicy:policy,classify:verdict});
 const controller=new AbortController();
 const run=collect(gate.generate(messages(),{...options(),signal:controller.signal}));await tick();
 assert.equal(provider.sent.length,1);controller.abort();await rejected(run,'cancelled');
 assert.equal((await provider.status()).busy,false);assert.equal(getEventListeners(controller.signal,'abort').length,0);
 assert.equal(provider.sent.length,1);assert.equal(fallbackCalls,0);assert.equal(gate.audit[0].result,'cancelled');
});

test('revocation while awaiting a provider chunk suppresses that chunk and closes the stream',async()=>{
 let release,closed=false,calls=0;
 const waiting=new Promise(resolve=>{release=resolve;});
 const provider={async *generate(){calls++;try{await waiting;yield 'revoked output';}finally{closed=true;}}};
 const current=policy();
 const gate=createEgressPolicy({destinations:{mock:provider},getPolicy:()=>current,classify:verdict});
 const iterator=gate.generate(messages(),options()),pending=iterator.next();await tick();
 current.grants=[];release();await rejected(pending,'policy_changed');
 assert.equal(closed,true);assert.equal(calls,1);assert.equal(gate.audit[0].result,'policy_changed');
});
