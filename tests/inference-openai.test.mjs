import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpenAIInference, loopbackBase } from '../server/inference-openai.mjs';

const enc=new TextEncoder();
const stream=chunks=>new ReadableStream({start(c){for(const x of chunks)c.enqueue(enc.encode(x));c.close();}});
const sse=(parts,reason='stop')=>[...parts.map(t=>`data: ${JSON.stringify({choices:[{delta:{content:t}}]})}\n\n`),`data: ${JSON.stringify({choices:[{delta:{},finish_reason:reason}]})}\n\n`,'data: [DONE]\n\n'];
function mock({models=['m1'],chat}={}){const calls=[];const fetch=async(url,init)=>{calls.push({url,body:init.body?JSON.parse(init.body):null});if(url.endsWith('/models'))return new Response(JSON.stringify({data:models.map(id=>({id}))}));return new Response(stream(chat),{status:200});};return {fetch,calls};}
const run=async g=>{let o='';for await(const t of g)o+=t;return o;};
const msgs=[{role:'user',content:'hola'}];

test('only loopback http addresses are accepted',()=>{
 assert.equal(loopbackBase('http://127.0.0.1:8000/v1/'),'http://127.0.0.1:8000/v1');
 for(const bad of ['https://127.0.0.1:8000/v1','http://example.com/v1','http://192.168.1.5:8000/v1','http://user:pw@127.0.0.1/v1','nope'])assert.throws(()=>loopbackBase(bad));
});
test('initialize connects, lists models and does not download or start anything',async()=>{
 const m=mock();const inf=createOpenAIInference({dependencies:{fetch:m.fetch}});
 assert.equal((await inf.initialize()).state,'ready');assert.deepEqual(m.calls.map(c=>c.url),['http://127.0.0.1:8000/v1/models']);
});
test('missing model or empty server leaves an error state',async()=>{
 assert.equal((await createOpenAIInference({model:'x',dependencies:{fetch:mock().fetch}}).initialize()).state,'error');
 assert.equal((await createOpenAIInference({dependencies:{fetch:mock({models:[]}).fetch}}).initialize()).state,'error');
});
test('generate streams text and sends the JSON schema as strict response_format',async()=>{
 const m=mock({chat:sse(['{"a"',':1}'])});const inf=createOpenAIInference({dependencies:{fetch:m.fetch}});await inf.initialize();
 const schema={type:'object',properties:{a:{type:'number'}},required:['a']};
 assert.equal(await run(inf.generate(msgs,{outputSchema:schema})),'{"a":1}');
 const body=m.calls.at(-1).body;assert.equal(body.stream,true);assert.equal(body.response_format.type,'json_schema');assert.equal(body.response_format.json_schema.strict,true);assert.deepEqual(body.response_format.json_schema.schema,schema);
});
test('truncated or interrupted generations fail instead of returning partial text',async()=>{
 const a=mock({chat:sse(['{"a"'],'length')});const i1=createOpenAIInference({dependencies:{fetch:a.fetch}});await i1.initialize();await assert.rejects(run(i1.generate(msgs)),/excedió/);
 const b=mock({chat:[`data: ${JSON.stringify({choices:[{delta:{content:'x'}}]})}\n\n`]});const i2=createOpenAIInference({dependencies:{fetch:b.fetch}});await i2.initialize();await assert.rejects(run(i2.generate(msgs)),/interrumpi/);
});
test('generate refuses before initialize and rejects bad input',async()=>{
 const inf=createOpenAIInference({dependencies:{fetch:mock().fetch}});await assert.rejects(run(inf.generate(msgs)),/Conecta/);
 await inf.initialize();await assert.rejects(run(inf.generate([{role:'tool',content:'x'}])),/presupuesto/);
});
