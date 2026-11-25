// Transport simulation only. Never contacts Ollama or loads model weights.
import test from 'node:test';import assert from 'node:assert/strict';
import {createIntakeContractualOllama} from '../server/privacy/intake-contractual-ollama.mjs';
import {readerModel} from '../server/privacy/local-reader-status.mjs';
const scope={workspaceId:'W',matterId:'M',threadId:'T'};
const input=()=>({scope,segments:[{id:'S0',path:'comment',text:'  Rosa consulta\r\nla cláusula\u0000 contractual.  ',originScope:scope,classification:'synthetic'}],operational:{processorStatus:'ok',segments:[{id:'S0',mediaType:'text/plain',extractionStatus:'complete',assessment:'known'}]}});
const output=detections=>({status:'complete',reasonCategory:null,detections});
function response(value,overrides={}){return new Response(JSON.stringify({model:readerModel,done:true,done_reason:'stop',message:{role:'assistant',content:JSON.stringify(value)},...overrides}),{status:200});}
test('explicit invocation uses fixed loopback, exact text, typed schema and shared abort signal',async()=>{
 const calls=[];const candidate=createIntakeContractualOllama({fetchImpl:async(url,options)=>{const body=JSON.parse(options.body);calls.push({url,options,body});return response(body.format.properties.oraciones?{oraciones:[]}:output([{segmentId:'T0',start:2,end:6,category:'person'}]));}});
 assert.equal(calls.length,0);const result=await candidate.detect(input());assert.equal(result.status,'complete');assert.equal(result.detections[0].category,'person');assert.ok(calls.length>=2);
 for(const call of calls){assert.equal(call.url,'http://127.0.0.1:11434/api/chat');assert.equal(call.options.redirect,'error');assert.ok(call.options.signal instanceof AbortSignal);assert.equal(call.options.signal,calls[0].options.signal);assert.equal(call.body.model,readerModel);assert.equal(call.body.think,false);assert.equal(call.body.stream,false);assert.equal(call.body.options.temperature,0);}
 const initial=calls[0].body;assert.equal(JSON.parse(initial.messages[1].content)[0].text,input().segments[0].text);assert.ok(initial.format.properties.detections.items.properties.category.enum.includes('sensitive_relation'));
});
test('strict transport/parser blocks malformed, truncated, wrong-model, foreign-field and oversized responses',async()=>{
 const bad=[()=>new Response('{'),()=>response(output([]),{done:false}),()=>response(output([]),{done_reason:'length'}),()=>response(output([]),{model:'different'}),()=>response({status:'complete',reasonCategory:null,detections:[],entities:[]}),()=>new Response('x'.repeat(262145)),()=>response(output([{segmentId:'T0',start:2,end:6,category:'Dato1'}])),()=>new Response('',{status:503})];
 for(const reply of bad){const result=await createIntakeContractualOllama({fetchImpl:async()=>reply()}).detect(input());assert.equal(result.status,'blocked');assert.deepEqual(result.detections,[]);}
});
test('aborted simulated transport does not become complete or retry',async()=>{
 const stop=new AbortController();let calls=0;const result=await createIntakeContractualOllama({fetchImpl:async(_url,options)=>{calls++;stop.abort();options.signal.throwIfAborted();}}).detect(input(),{signal:stop.signal});assert.equal(result.status,'blocked');assert.equal(calls,1);
});
