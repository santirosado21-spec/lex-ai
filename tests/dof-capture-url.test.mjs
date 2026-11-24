import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(readFileSync(new URL('../src/api.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
let sequence=0;
async function withApi(window,run){
 const previous=globalThis.window;globalThis.window=window;
 try{return await run(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64')+'#'+sequence++));}
 finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
}
test('browser capture uses same loopback origin and never leaks hash session token',async()=>{
 await withApi({location:{origin:'http://127.0.0.1:43210',hash:'#review=dof&token=private-session'}},async api=>{
  assert.equal(await api.dofReviewCaptureUrl('/dev/dof-review/source'),'http://127.0.0.1:43210/dev/dof-review/source');
 });
});
test('capture resolver rejects arbitrary and token-bearing paths before connection access',async()=>{
 await withApi({location:{origin:'http://localhost:43210',hash:''}},async api=>{
  for(const value of ['https://example.invalid/','//example.invalid/','/api','/dev/dof-review/source?token=x','/dev/dof-review/source#x','/dev/dof-review/../source','',null])await assert.rejects(()=>api.dofReviewCaptureUrl(value),/Ruta de captura/);
 });
});
test('browser capture rejects non-loopback, encrypted, credentialed and opaque origins',async()=>{
 for(const origin of ['https://127.0.0.1:43210','http://example.invalid','http://127.0.0.1.example.invalid','http://user@localhost:43210','null','tauri://localhost','http://localhost:43210/other','http://localhost:43210/?token=x','http://localhost:43210/#x']){
  await withApi({location:{origin,hash:''}},async api=>{await assert.rejects(()=>api.dofReviewCaptureUrl('/dev/dof-review/source'));});
 }
});
test('localhost HTTP browser capture remains supported',async()=>{
 await withApi({location:{origin:'http://localhost:43210',hash:''}},async api=>{
  assert.equal(await api.dofReviewCaptureUrl('/dev/dof-review/source'),'http://localhost:43210/dev/dof-review/source');
 });
});
