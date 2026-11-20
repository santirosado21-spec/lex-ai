import {emptyLocalReading} from './helpers/local-reader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {hasReservedText,reservedRanges} from '../server/privacy/matter-reservations.mjs';
import {startServer} from '../server/main.mjs';

test('reservations cover accents, decomposed characters, whitespace and overlapping matches at original offsets',()=>{
 const text='🚚 El A\u0301mbar\n  pálido, ámbar pálido. aaaa. Straße al sur.';
 const rows=['ámbar pálido','aaa','STRASSE'].map(text=>({text}));
 assert.deepEqual(reservedRanges(text,rows).map(([a,b])=>text.slice(a,b)),['A\u0301mbar\n  pálido','ámbar pálido','aaaa','Straße']);
 assert.ok(hasReservedText(text,rows));assert.deepEqual(reservedRanges('carga de otro color',rows),[]);
});

test('case reservations apply to earlier documents, new queries and actual dispatch; stale writes, restart and removal',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'rejon-reservas-'));
 let app,requests=0;
 const start=()=>startServer({dataDir:dir,intakePilot:true,autoInitialize:false,pilotPassphrase:Buffer.from('frase privada para el ensayo'),
  intakeGenerate:async()=>{requests++;return 'Nota para [[CLIENTE]] · [[ASUNTO]]';}});
 t.after(async()=>{await app?.close();await rm(dir,{recursive:true,force:true});});
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  assert.equal(url,'http://127.0.0.1:11434/api/chat');const shape=JSON.parse(options.body).format.properties;
  return Response.json({message:{content:JSON.stringify(emptyLocalReading(shape))}});
 });
 app=await start();const rpc=(n,p={})=>app.service.dispatch('intake.'+n,p);
 await assert.rejects(rpc('reserveTerm',{text:'sin asunto',revision:0}));
 await rpc('save',{firm:'Firma sintética',client:'Empresa de prueba',title:'Valor de importación',jurisdiction:'MX-FED'});
 const text='El papel llegó con ribetes de ambar   palido.\nEl comprador pagó el flete.';
 const inspect=()=>rpc('inspectSource',{extension:'txt',base64:Buffer.from(text).toString('base64'),review:true});
 const upload=await inspect();
 const {id}=await rpc('addSource',{reviewId:upload.reviewId,label:'Constancia'});
 const question='¿Qué comprobante de ámbar pálido acredita el flete?';
 const prior=await rpc('inspectQuestion',{text:question});
 const before=await rpc('questionLines',{reviewId:prior.id,sourceId:id});
 assert.ok(before[0].text.includes('ambar'));
 await rpc('reserveTerm',{text:'ámbar pálido',revision:0});
 await assert.rejects(rpc('addQuestion',{reviewId:prior.id,key:'aduana-65/1',angle:'documentos'}));
 await assert.rejects(rpc('reserveTerm',{text:'otra expresión',revision:0}));
 const fresh=await rpc('inspectQuestion',{text:question});
 assert.ok(!fresh.masked.includes('pálido'));
 const rows=await rpc('questionLines',{reviewId:fresh.id,sourceId:id});assert.ok(!rows[0].text.includes('ambar'));
 const view=await rpc('readDocument',{id});
 assert.ok(view.original===text&&!view.masked.includes('ambar'));
 const protectedUpload=await inspect();assert.ok(protectedUpload.protection.parts.some(p=>p.label&&text.slice(p.start,p.end).includes('ambar')));
 const testTask=await rpc('addQuestion',{reviewId:fresh.id,key:'aduana-65/1',angle:'documentos'});
 const target=testTask.status.tasks.find(row=>row.id===testTask.task);
 assert.ok(target.preview.includes('transporte'));
 await rpc('reserveTerm',{text:'TRANSPÓRTE',revision:1});
 assert.ok((await rpc('status')).tasks.find(r=>r.id===target.id).reservationConflict);
 await assert.rejects(rpc('draft',{task:target.id}),/expresión reservada/);
 assert.equal(requests,0);
 await app.close();app=await start();
 const list=await rpc('getReservations');assert.equal(list.rows.length,2);assert.equal(list.revision,2);
 await assert.rejects(rpc('draft',{task:target.id}),/expresión reservada/);
 await rpc('removeReservation',{id:list.rows[1].id,revision:2});
 await rpc('draft',{task:target.id});assert.equal(requests,1);
 for(const item of await readdir(dir,{withFileTypes:true}))if(item.isFile())assert.ok(!(await readFile(path.join(dir,item.name))).includes(Buffer.from('ámbar pálido')));
});

test('the saved document viewer rechecks later identities while preserving the original spelling after reopening',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'rejon-identidades-'));
 let app;
 const start=()=>startServer({dataDir:dir,autoInitialize:false,intakePilot:true,pilotPassphrase:Buffer.from('clave de prueba para dos minutas')});
 t.after(async()=>{await app?.close();await rm(dir,{recursive:true,force:true});});
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  assert.equal(url,'http://127.0.0.1:11434/api/chat');
  return Response.json({message:{content:JSON.stringify(emptyLocalReading(JSON.parse(options.body).format.properties))}});
 });
 app=await start();const rpc=(name,payload)=>app.service.dispatch('intake.'+name,payload);
 await rpc('save',{firm:'Despacho de laboratorio',client:'Importador ficticio',title:'Ensayo',jurisdiction:'MX-FED'});
 async function attach(text,label){
  const review=await rpc('inspectSource',{extension:'txt',base64:Buffer.from(text).toString('base64'),review:true});
  const {id}=await rpc('addSource',{reviewId:review.reviewId,label});return id;
 }
 const first='Se entregó la nota a mavía   de oro para cotejarla.';
 const id=await attach(first,'Primera');assert.ok((await rpc('readDocument',{id})).masked.includes('mavía'));
 await attach('Cliente: Mavia de Oro','Segunda');
 const match=await rpc('readDocument',{id});assert.equal(match.original,first);assert.ok(!match.masked.includes('mavía'));
 await app.close();app=await start();
 assert.deepEqual((await rpc('readDocument',{id})).masked,match.masked);
});
