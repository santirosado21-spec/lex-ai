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

test('local review masks repeated literals and rule-only email, restores the full extracted document, and treats uncertain output explicitly',async()=>{
 const text='Proveedor: Taller Ficticio Azul. Envíe soporte a soporte@example.test. Taller Ficticio Azul confirma el trámite.';
 const payload={extension:'txt',base64:Buffer.from(text).toString('base64'),review:true};
 const run=entities=>inspectLocalDocument(payload,{fetchImpl:async(url,opts)=>{
  assert.equal(url,'http://127.0.0.1:11434/api/chat');
  assert.equal(JSON.parse(opts.body).format.properties.entities.type,'array');
  return Response.json({message:{content:JSON.stringify({client:'',title:'',documentKind:'otro',entities})}});
 }});
 const result=await run(['Taller Ficticio Azul','nombre inventado']);
 assert.equal(result.protection.available,true);
 const {parts,restored,needsReview}=result.protection;
 assert.equal(restored,text);
 const visible=parts.map(part=>part.text||part.label).join('');
 assert.ok(!visible.includes('Taller Ficticio Azul')&&!visible.includes('soporte@example.test'));
 assert.match(visible,/confirma el trámite/);
 assert.equal(needsReview,true);
 assert.ok(parts.filter(part=>part.label===parts.find(part=>part.label)?.label).length>=2);
 const broken=await run(null);
 assert.equal(broken.protection.available,false);
});

test('a copied narrative is not a title and a truncated model reply cannot produce a reviewed document',async()=>{
 const convert=(text,title,extra={})=>inspectLocalDocument({extension:'txt',review:true,base64:Buffer.from(text).toString('base64')},{
  fetchImpl:async()=>Response.json({message:{content:JSON.stringify({client:'',title,documentKind:'otro',entities:[]})},...extra}),
 });
 const text='Se requiere factura comercial para el lote TG-9314.';
 const read=await convert(text,text);
 assert.equal(read.title,'');assert.ok(read.protection.needsReview);
 const visible=read.protection.parts.map(x=>x.label??x.text).join('');
 assert.match(visible,/factura comercial/);assert.ok(!visible.includes('TG-9314'));
 assert.equal((await convert('Asunto: Consulta interna\nEntregar la factura.','Consulta interna')).title,'Consulta interna');
 await assert.rejects(convert(text,'',{done:true,done_reason:'length'}));
});
