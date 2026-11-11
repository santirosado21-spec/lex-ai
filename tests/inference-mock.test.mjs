import test from 'node:test';
import assert from 'node:assert/strict';
import {createMockInference} from '../server/inference-mock.mjs';

const messages=()=>[{role:'user',content:'Pregunta sintética'}];
const collect=async(iterator)=>{const chunks=[];for await(const chunk of iterator)chunks.push(chunk);return chunks;};
async function ready(options){const engine=createMockInference(options);await engine.initialize();return engine;}

test('mock is opt-in, stopped initially and reports simulation without claiming hardware validation',async()=>{
 const engine=createMockInference({responses:['Ficticio']});
 assert.equal(engine.outputContract,'paragraph-citations-v1');
 assert.deepEqual(await engine.status(),{state:'stopped',model:'Rejon.AI',simulated:true,busy:false,progress:0});
 await assert.rejects(collect(engine.generate(messages())),/Prepara Rejon.AI/);assert.deepEqual(engine.sent,[]);
 assert.equal((await engine.initialize()).state,'ready');assert.equal((await engine.initialize()).state,'ready');
 assert.deepEqual(await collect(engine.generate(messages())),['Ficticio']);
 assert.equal((await engine.stop()).state,'stopped');assert.equal((await engine.stop()).state,'stopped');
 await assert.rejects(collect(engine.generate(messages())),/Prepara Rejon.AI/);
});

test('mock streams queued chunks and fails closed on exhaustion instead of inventing a response',async()=>{
 const responses=[['Parte ', 'sintética.'],'Segunda'];const engine=await ready({responses});
 responses[0][0]='Cambiado';responses.push('Extra');
 assert.deepEqual(await collect(engine.generate(messages())),['Parte ','sintética.']);
 assert.deepEqual(await collect(engine.generate(messages(),{responseFormat:'text'})),['Segunda']);
 await assert.rejects(collect(engine.generate(messages())),/No quedan respuestas/);
 assert.equal(engine.sent.length,2);assert.equal((await engine.status()).busy,false);
});

test('mock captures canonical UTF-8 bytes, complete metadata and schema before caller mutation',async()=>{
 const engine=await ready({responses:[['A','B']]});
 const input=[{role:'system',content:'Instrucción ficticia'},{role:'user',content:'Ámbito sintético 🧪',metadata:{z:'CANARIO-METADATO',a:[1,true,null]}}];
 const schema={type:'object',properties:{z:{type:'string'},a:{type:'number'}}};
 const expected=structuredClone({messages:input,outputSchema:schema});
 const iterator=engine.generate(input,{outputSchema:schema});assert.deepEqual(engine.sent,[]);
 assert.equal((await iterator.next()).value,'A');input[1].content='Cambiado';input[1].metadata.z='Cambiado';schema.properties.a.type='boolean';
 const record=engine.sent[0];assert.deepEqual(record.messages,expected.messages);assert.deepEqual(record.outputSchema,expected.outputSchema);
 assert.deepEqual(JSON.parse(new TextDecoder().decode(record.bytes)),{version:1,messages:expected.messages,outputSchema:expected.outputSchema,responseFormat:'json'});
 assert.equal(Buffer.from(record.bytes).toString('utf8'),record.serialized);assert.match(record.serialized,/CANARIO-METADATO/);
 assert.ok(record.bytes.length>record.serialized.length);
 record.messages[1].metadata.z='Otra mutación';record.bytes.fill(0);assert.equal(engine.sent[0].messages[1].metadata.z,'CANARIO-METADATO');assert.notEqual(engine.sent[0].bytes[0],0);
 await collect(iterator);assert.equal((await engine.status()).busy,false);
 const equivalent=await ready({responses:['X']});
 const reordered=expected.messages.map(m=>Object.fromEntries(Object.entries(m).reverse()));
 await collect(equivalent.generate(reordered,{outputSchema:{properties:{a:{type:'number'},z:{type:'string'}},type:'object'}}));
 assert.equal(equivalent.sent[0].serialized,engine.sent[0].serialized);
});

test('mock accepts text without a schema and rejects invalid requests before capture or consuming a fixture',async()=>{
 const engine=await ready({responses:['Reservada']});
 const invalid=[
  [[],{}], [null,{}], [[null],{}], [[{role:'tool',content:'x'}],{}], [[{role:'user',content:1}],{}],
  [Array.from({length:17},messages).flat(),{}], [[{role:'user',content:'x'.repeat(7001)}],{}],
  [messages(),{responseFormat:'xml'}], [messages(),{responseFormat:'text',outputSchema:{type:'object'}}],
  [messages(),{outputSchema:{description:'x'.repeat(16000)}}], [messages(),{signal:{aborted:false}}]
 ];
 for(const [input,options] of invalid){await assert.rejects(collect(engine.generate(input,options)));assert.equal(engine.sent.length,0);assert.equal((await engine.status()).busy,false);}
 assert.deepEqual(await collect(engine.generate(messages(),{responseFormat:'text'})),['Reservada']);
 assert.equal(engine.sent[0].responseFormat,'text');assert.equal(Object.hasOwn(engine.sent[0],'outputSchema'),false);
});

test('mock rejects non-JSON fields rather than silently dropping or converting them',async()=>{
 const cyclic={};cyclic.self=cyclic;
 const sparse=[];sparse.length=1;
 let getterCalls=0;const accessor={};Object.defineProperty(accessor,'secret',{enumerable:true,get(){getterCalls++;return 'no';}});
 const symbolField={[Symbol('hidden')]:'synthetic'};
 const invalid=[undefined,NaN,Infinity,1n,()=>{},new Date(),cyclic,sparse,accessor,symbolField];
 const engine=await ready({responses:['Reservada']});
 for(const metadata of invalid)await assert.rejects(collect(engine.generate([{role:'user',content:'Sintético',metadata}])));
 assert.equal(getterCalls,0);assert.deepEqual(engine.sent,[]);
 assert.deepEqual(await collect(engine.generate(messages())),['Reservada']);
});

test('mock cancels before capture and does not consume the next response',async()=>{
 const engine=await ready({responses:['Reservada']}),controller=new AbortController();controller.abort();
 await assert.rejects(collect(engine.generate(messages(),{signal:controller.signal})),/cancelado/);
 assert.deepEqual(engine.sent,[]);assert.deepEqual(await collect(engine.generate(messages())),['Reservada']);
});

test('mock cancels between chunks, releases busy state and removes its abort listener',async()=>{
 const engine=await ready({responses:[['A','B'],'Siguiente']}),controller=new AbortController();
 const {getEventListeners}=await import('node:events');
 const iterator=engine.generate(messages(),{signal:controller.signal});assert.equal((await iterator.next()).value,'A');
 assert.equal((await engine.status()).busy,true);assert.equal(getEventListeners(controller.signal,'abort').length,1);
 controller.abort();await assert.rejects(iterator.next(),/cancelado/);
 assert.equal((await engine.status()).busy,false);assert.equal(getEventListeners(controller.signal,'abort').length,0);
 assert.deepEqual(await collect(engine.generate(messages())),['Siguiente']);
});

test('mock rejects overlapping generation without capturing or consuming the other response',async()=>{
 const engine=await ready({responses:[['A','B'],'Siguiente']});const first=engine.generate(messages());
 await first.next();await assert.rejects(collect(engine.generate(messages())),/Ya hay un análisis/);assert.equal(engine.sent.length,1);
 await first.return();assert.equal((await engine.status()).busy,false);
 assert.deepEqual(await collect(engine.generate(messages())),['Siguiente']);
});

test('stop aborts a waiting chunk promptly and reinitialization preserves the consumed queue',{timeout:2000},async()=>{
 const engine=await ready({responses:[['A','B'],'Siguiente'],chunkDelayMs:60000});
 const iterator=engine.generate(messages());const pending=iterator.next();
 const rejected=assert.rejects(pending,/cancelado/);assert.equal((await engine.status()).busy,true);
 await engine.stop();await rejected;assert.equal((await engine.status()).busy,false);assert.equal(engine.sent.length,1);
 await engine.initialize();const next=engine.generate(messages());const waiting=assert.rejects(next.next(),/cancelado/);
 await engine.stop();await waiting;assert.equal(engine.sent.length,2);
});

test('mock bounds streamed output and permits recovery after output rejection',async()=>{
 const engine=await ready({responses:[['x'.repeat(32768),'y'],'Recuperado']});const iterator=engine.generate(messages());
 assert.equal((await iterator.next()).value.length,32768);await assert.rejects(iterator.next(),/demasiado grande/);
 assert.equal((await engine.status()).busy,false);assert.deepEqual(await collect(engine.generate(messages())),['Recuperado']);
});

test('mock rejects malformed fixture configuration',()=>{
 for(const options of [{responses:null},{responses:[1]},{responses:[['x',null]]},{responses:Array(1)},{responses:[Array(1)]},{chunkDelayMs:-1},{chunkDelayMs:60001},{maxInputCharacters:0},{maxInputCharacters:7001}])assert.throws(()=>createMockInference(options));
});
