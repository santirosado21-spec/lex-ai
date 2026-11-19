import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectLocalDocument} from '../server/intake-import.mjs';
const original='Cliente: Empresa Ficticia. Asunto: Importación de piezas.';
const payload={extension:'txt',base64:Buffer.from(original).toString('base64')};
test('original stays on loopback and only verbatim suggestions and permitted enums return', async()=>{
 const data=await inspectLocalDocument(payload,{fetchImpl:async(url,opts)=>{
  assert.equal(new URL(url).hostname,'127.0.0.1');assert.equal(opts.redirect,'error');
  assert.equal(JSON.parse(opts.body).messages.at(-1).content,original);
  return Response.json({message:{content:JSON.stringify({client:'Empresa Ficticia',title:'inventado',documentKind:'identidad'})}});
 }});
 assert.deepEqual(data,{client:'Empresa Ficticia',title:'',documentKind:'otro'});
});
test('oversize input and unexpected fields blocked before model access',async()=>{
 const fetchImpl=()=>assert.fail('unexpected network');
 await assert.rejects(inspectLocalDocument({...payload,extra:true},{fetchImpl}),/Elige/);
 await assert.rejects(inspectLocalDocument({extension:'txt',base64:Buffer.from('z'.repeat(8001)).toString('base64')},{fetchImpl}),/8 000/);
});
test('recognized invoice has a fixed kind even if the local model misclassifies it',async()=>{
 const {readFile}=await import('node:fs/promises');
 const bytes=await readFile(new URL('../piloto/factura-ficticia.txt',import.meta.url));
 const fetchImpl=async()=>Response.json({message:{content:JSON.stringify({documentKind:'pedimento'})}});
 const inspect=bytes=>inspectLocalDocument({extension:'txt',base64:bytes.toString('base64')},{fetchImpl});
 const recognized=await inspect(bytes);
 assert.equal(recognized.documentKind,'factura');
 assert.equal(recognized.scenarioId,'factura-origen-v1');
 assert.match(recognized.scenarioPreview,/\[\[PROVEEDOR\]\]/);
 assert.equal((await inspect(Buffer.concat([bytes,Buffer.from([0])]))).scenarioId,undefined);
});
