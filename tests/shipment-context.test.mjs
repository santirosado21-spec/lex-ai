import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewShipmentContext} from '../server/privacy/shipment-context.mjs';
import {inspectLocalDocument} from '../server/intake-import.mjs';
import {logisticsReferenceRanges} from '../server/privacy/trade-document-structure.mjs';
import {originContextRanges} from '../server/privacy/origin-evidence.mjs';
import {emptyLocalReading} from './helpers/local-reader.mjs';

test('local quote review uses original offsets, protects repeated traces and confines uncertain wording to the selected clause',async()=>{
 const text='📦 El proveedor pagó, había un residuo ocre y otro residuo ocre; se devolvió el depósito.';
 const inspect=async fragmento=>reviewShipmentContext([{id:0,text}],async(_prompt,input)=>{
  const batch=JSON.parse(input);assert.equal(batch.length,1);
  assert.ok(!input.includes('depósito')&&!input.includes('proveedor'));
  return {lugares:[],sucesos:[],huellas:[{id:batch[0].id,fragmento}]};
 });
 assert.deepEqual((await inspect('residuo ocre')).map(([a,b])=>text.slice(a,b)),['residuo ocre','residuo ocre']);
 assert.deepEqual((await inspect('paráfrasis')).map(([a,b])=>text.slice(a,b)),[' había un residuo ocre y otro residuo ocre']);
 await assert.rejects(reviewShipmentContext([{id:0,text}],async()=>({lugares:[],huellas:[{id:500,fragmento:'inventado'}],sucesos:[]})));
});

test('narrative field groups must be complete and known spelling variants preserve the exact original',async()=>{
 const text='El lote llegó para ÓPALO   DEL NORTE con la referencia rd‑7342.';
 const payload={extension:'txt',review:true,base64:Buffer.from(text).toString('base64')};
 const inspect=missing=>inspectLocalDocument(payload,{knownIdentities:['Ópalo del Norte','RD-7342'],fetchImpl:async(url,opts)=>{
  assert.equal(url,'http://127.0.0.1:11434/api/chat');const props=JSON.parse(opts.body).format.properties;
  const reply=emptyLocalReading(props);if(missing)delete reply.empresas;
  return Response.json({message:{content:JSON.stringify(reply)}});
 }});
 const {protection}=await inspect(false);assert.equal(protection.restored,text);
 const hidden=protection.parts.filter(p=>p.label).map(p=>text.slice(p.start,p.end));
 assert.ok(hidden.includes('ÓPALO   DEL NORTE')&&hidden.includes('rd‑7342'));
 assert.equal((await inspect(true)).protection.available,false);
});

test('isolated shipment references and observed traces are distinguished from standards and tariff transformations',()=>{
 const ref='ABC-44875. Se recibió la nota.';assert.equal(ref.slice(...logisticsReferenceRanges(ref)[0]),'ABC-44875');
 assert.deepEqual(logisticsReferenceRanges('ISO-9001. Control de calidad.'),[]);
 assert.deepEqual(originContextRanges('El insumo es proveniente de otro capítulo.'),[]);
 const text='El embarque llegó con una fina capa de salitre, según la factura comercial.';
 const concealed=originContextRanges(text).map(([a,b])=>text.slice(a,b));
 assert.deepEqual(concealed,['fina capa de salitre']);
});

test('a physical observation ends before the separate documentary question',()=>{
 const text='El embarque mostraba un residuo ocre en el embalaje, con la factura se comprobó el pago.';
 const ranges=originContextRanges(text).map(([a,b])=>text.slice(a,b));
 assert.ok(ranges.includes('residuo ocre en el embalaje'));assert.ok(ranges.every(span=>!span.includes('pago')));
 const generic='El embarque requiere la instalación de una máquina nueva.';
 assert.deepEqual(originContextRanges(generic),[]);
});
