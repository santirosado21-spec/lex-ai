// Pruebas del parser NDJSON de `analyze` en src/api.ts, con fetch y ReadableStream
// sinteticos aislados. Mismo patron transpileModule + import por data URL que
// tests/dof-capture-url.test.mjs: cada test importa una instancia fresca del
// modulo (sequence++) para que el `connection` cacheado a nivel de modulo no
// se filtre entre casos, y restaura globalThis.window / globalThis.fetch en
// un finally. No se modifica src ni ningun otro archivo.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=ts.transpileModule(readFileSync(new URL('../src/api.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
let sequence=0;

async function withApi(windowObj,fetchImpl,run){
 const previousWindow=globalThis.window;
 const previousFetch=globalThis.fetch;
 globalThis.window=windowObj;
 globalThis.fetch=fetchImpl;
 try{
  const api=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64')+'#'+sequence++);
  return await run(api);
 }finally{
  if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
  if(previousFetch===undefined)delete globalThis.fetch;else globalThis.fetch=previousFetch;
 }
}

const enc=new TextEncoder();
function concatBytes(parts){
 let total=0;for(const p of parts)total+=p.length;
 const out=new Uint8Array(total);let o=0;
 for(const p of parts){out.set(p,o);o+=p.length;}
 return out;
}

// Stream sintetico: entrega exactamente los chunks dados (en orden) y luego
// cierra. getReader() se envuelve para contar read()/releaseLock() sin alterar
// el comportamiento real del ReadableStream nativo.
function trackedStream(chunks){
 let i=0;
 const stream=new ReadableStream({
  pull(controller){
   if(i<chunks.length)controller.enqueue(chunks[i++]);
   else controller.close();
  }
 });
 const nativeGetReader=stream.getReader.bind(stream);
 const state={readCalls:0,releaseLockCalls:0};
 stream.getReader=()=>{
  const reader=nativeGetReader();
  return{
   read:(...args)=>{state.readCalls++;return reader.read(...args);},
   releaseLock:(...args)=>{state.releaseLockCalls++;return reader.releaseLock(...args);}
  };
 };
 stream.__state=state;
 return stream;
}

// Stream sintetico cuya primera lectura falla (reader.read() rechaza), para
// comprobar limpieza si la primera lectura rechaza.
function erroringStream(message){
 const stream=new ReadableStream({
  pull(controller){controller.error(new Error(message));}
 });
 const nativeGetReader=stream.getReader.bind(stream);
 const state={releaseLockCalls:0};
 stream.getReader=()=>{
  const reader=nativeGetReader();
  return{
   read:(...args)=>reader.read(...args),
   releaseLock:(...args)=>{state.releaseLockCalls++;return reader.releaseLock(...args);}
  };
 };
 stream.__state=state;
 return stream;
}

function makeFetch(handler){
 const calls=[];
 const fn=async(url,options)=>{
  calls.push({url,options});
  return handler(url,options,calls.length);
 };
 fn.calls=calls;
 return fn;
}

const windowWithToken=(token)=>({location:{hash:`#token=${token}`}});

test('reconstruye un evento NDJSON cuyo JSON queda partido entre dos chunks',async()=>{
 const resultData={id:'a1',matterId:'m1',text:'Respuesta final',citations:[],createdAt:'2026-01-01T00:00:00.000Z'};
 const line1=JSON.stringify({type:'token',text:'Hola mundo'})+'\n';
 const line2=JSON.stringify({type:'result',data:resultData})+'\n';
 const bytes1=enc.encode(line1);
 const splitAt=10; // corta dentro del texto del primer evento, no en un borde de linea
 const chunkA=bytes1.slice(0,splitAt);
 const chunkB=concatBytes([bytes1.slice(splitAt),enc.encode(line2)]);
 const stream=trackedStream([chunkA,chunkB]);
 const fetchImpl=makeFetch(()=>({ok:true,status:200,body:stream}));
 const tokens=[];
 await withApi(windowWithToken('t1'),fetchImpl,async(api)=>{
  const answer=await api.analyze({question:'hola'},(text)=>tokens.push(text));
  assert.deepEqual(tokens,['Hola mundo']);
  assert.deepEqual(answer,resultData);
 });
 assert.equal(stream.__state.releaseLockCalls,1);
 assert.equal(fetchImpl.calls.length,1);
 const call=fetchImpl.calls[0];
 assert.equal(call.url,'/analyze');
 assert.equal(call.options.method,'POST');
 assert.equal(call.options.headers['Content-Type'],'application/json');
 assert.equal(call.options.headers.Authorization,'Bearer t1');
 assert.deepEqual(JSON.parse(call.options.body),{question:'hola'});
});

test('reconstruye caracteres UTF-8 multibyte partidos entre chunks',async()=>{
 const resultData={id:'a2',matterId:'m1',text:'ok',citations:[],createdAt:'2026-01-01T00:00:00.000Z'};
 const tokenText='café 😀 fin'; // el emoji (4 bytes) cruza el corte; 'é' queda intacto
 const tokenLine=JSON.stringify({type:'token',text:tokenText})+'\n';
 const resultLine=JSON.stringify({type:'result',data:resultData})+'\n';
 const idxEmoji=tokenLine.indexOf('😀');
 const beforeEmojiBytesLen=enc.encode(tokenLine.slice(0,idxEmoji)).length;
 const fullTokenBytes=enc.encode(tokenLine);
 const splitAt=beforeEmojiBytesLen+2; // parte el emoji de 4 bytes exactamente a la mitad
 const chunkA=fullTokenBytes.slice(0,splitAt);
 const chunkB=concatBytes([fullTokenBytes.slice(splitAt),enc.encode(resultLine)]);
 const stream=trackedStream([chunkA,chunkB]);
 const tokens=[];
 await withApi(windowWithToken('t2'),makeFetch(()=>({ok:true,status:200,body:stream})),async(api)=>{
  const answer=await api.analyze({},(text)=>tokens.push(text));
  assert.deepEqual(tokens,[tokenText]);
  assert.deepEqual(answer,resultData);
 });
 assert.equal(stream.__state.releaseLockCalls,1);
});

test('ignora lineas vacias dentro del NDJSON sin romper el parseo',async()=>{
 const resultData={id:'a3',matterId:'m1',text:'listo',citations:[],createdAt:'2026-01-01T00:00:00.000Z'};
 const raw='\n'+JSON.stringify({type:'token',text:'uno'})+'\n\n'+JSON.stringify({type:'token',text:'dos'})+'\n\n'+JSON.stringify({type:'result',data:resultData})+'\n';
 const stream=trackedStream([enc.encode(raw)]);
 const tokens=[];
 await withApi(windowWithToken('t3'),makeFetch(()=>({ok:true,status:200,body:stream})),async(api)=>{
  const answer=await api.analyze({},(text)=>tokens.push(text));
  assert.deepEqual(tokens,['uno','dos']);
  assert.deepEqual(answer,resultData);
 });
 assert.equal(stream.__state.releaseLockCalls,1);
});

test('acepta el evento result final sin salto de linea antes de cerrar el stream',async()=>{
 const resultData={id:'a4',matterId:'m1',text:'final',citations:[],createdAt:'2026-01-01T00:00:00.000Z'};
 const tokenLine=JSON.stringify({type:'token',text:'parcial'})+'\n';
 const resultLineNoNewline=JSON.stringify({type:'result',data:resultData}); // sin '\n' final
 const stream=trackedStream([enc.encode(tokenLine),enc.encode(resultLineNoNewline)]);
 const tokens=[];
 await withApi(windowWithToken('t4'),makeFetch(()=>({ok:true,status:200,body:stream})),async(api)=>{
  const answer=await api.analyze({},(text)=>tokens.push(text));
  assert.deepEqual(tokens,['parcial']);
  assert.deepEqual(answer,resultData);
 });
 assert.equal(stream.__state.releaseLockCalls,1);
});

test('propaga el mensaje de un evento error emitido por el servidor y libera el lector',async()=>{
 const errorLine=JSON.stringify({type:'error',message:'El modelo local no respondió.'})+'\n';
 const stream=trackedStream([enc.encode(errorLine)]);
 const tokens=[];
 await withApi(windowWithToken('t5'),makeFetch(()=>({ok:true,status:200,body:stream})),async(api)=>{
  await assert.rejects(()=>api.analyze({},(text)=>tokens.push(text)),/El modelo local no respondió\./);
 });
 assert.deepEqual(tokens,[]);
 assert.equal(stream.__state.releaseLockCalls,1);
});

test('propaga el error HTTP devuelto por el servicio local antes de abrir el stream',async()=>{
 const fetchImpl=makeFetch(()=>({ok:false,status:500,json:async()=>({error:'Fallo interno del servicio.'})}));
 await withApi(windowWithToken('t6'),fetchImpl,async(api)=>{
  await assert.rejects(()=>api.analyze({},()=>{}),/Fallo interno del servicio\./);
 });
 assert.equal(fetchImpl.calls.length,1);
});

test('rechaza un stream truncado que cierra sin emitir un evento result (no debe aceptarse)',async()=>{
 const tokenLine=JSON.stringify({type:'token',text:'a medias'})+'\n';
 const stream=trackedStream([enc.encode(tokenLine)]);
 const tokens=[];
 await withApi(windowWithToken('t7'),makeFetch(()=>({ok:true,status:200,body:stream})),async(api)=>{
  await assert.rejects(()=>api.analyze({},(text)=>tokens.push(text)),/terminó antes de completar/);
 });
 assert.deepEqual(tokens,['a medias']);
 assert.equal(stream.__state.releaseLockCalls,1);
});

test('libera el lector incluso cuando la primera llamada a reader.read() falla',async()=>{
 const stream=erroringStream('Conexion perdida');
 await withApi(windowWithToken('t8'),makeFetch(()=>({ok:true,status:200,body:stream})),async(api)=>{
  await assert.rejects(()=>api.analyze({},()=>{}),/Conexion perdida/);
 });
 assert.equal(stream.__state.releaseLockCalls,1);
});

test('reenvia la señal de cancelacion a fetch y propaga el abort sin tocar el stream',async()=>{
 const controller=new AbortController();
 controller.abort();
 const fetchImpl=makeFetch((url,options)=>{
  assert.equal(options.signal,controller.signal);
  assert.equal(options.signal.aborted,true);
  const err=new Error('The operation was aborted.');err.name='AbortError';
  throw err;
 });
 await withApi(windowWithToken('t9'),fetchImpl,async(api)=>{
  await assert.rejects(()=>api.analyze({},()=>{},controller.signal),(err)=>err.name==='AbortError');
 });
 assert.equal(fetchImpl.calls.length,1);
});
