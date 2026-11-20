import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,rm,readdir,copyFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import {startServer} from '../server/main.mjs';
import {comparisonsFor} from '../server/corpus/intake-comparison.mjs';
import {createIntakeGenerator} from '../server/intake-pilot.mjs';

test('sealed originals, two conflicting documents, scoped follows and reversible Office exports',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'rejon-documentos-'));
 const fixture=JSON.parse(await readFile('fixtures/public-cases/contraste-flete-r15.json','utf8'));
 const bodies=[];
 const generate=createIntakeGenerator({getApiKey:async()=>'sk-'+'x'.repeat(32),fetchImpl:async(_url,options)=>{
  const raw=options.body;
  for(const term of ['CT-41726','FM-38214','625.30','4200','Taller Níquel','Importadora Lirio','Factura privada','Contrato privado'])assert.ok(!raw.includes(term));
  const first=!bodies.length;
  if(first)assert.equal(createHash('sha256').update(raw).digest('hex'),fixture.sha256);
  bodies.push(JSON.parse(raw));
  const reply=first?fixture.response:{acciones:['Verificar la factura comercial contra el documento de transporte.','Cotejar el contrato con la factura comercial de la operación.']};
  return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(reply)}}]});
 }});
 const start=(dataDir=dir)=>startServer({intakePilot:true,intakeGenerate:generate,pilotPassphrase:Buffer.from('frase de laboratorio ficticia'),autoInitialize:false,dataDir});
 let app=await start();
 t.after(async()=>{await app.close();await rm(dir,{recursive:true,force:true});});
 const call=(name,p={})=>app.service.dispatch('intake.'+name,p);
 const native=globalThis.fetch;
 t.after(()=>{globalThis.fetch=native;});
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,'http://127.0.0.1:11434/api/chat');
  return Response.json({message:{content:JSON.stringify(JSON.parse(options.body).format.properties.oraciones?{oraciones:[]}:{client:'',title:'',documentKind:'otro',entities:[]})}});
 };
 const files=await Promise.all(['factura-cotejo-ficticia','contrato-cotejo-ficticio'].map(n=>readFile('piloto/'+n+'.txt')));
 const review=bytes=>call('inspectSource',{extension:'txt',base64:bytes.toString('base64'),review:true});
 await assert.rejects(review(files[0]));
 await call('save',{firm:'Firma de Ensayo',client:'Importadora Lirio de Ensayo',title:'Cotejo documental de prueba',jurisdiction:'MX-FED'});
 const add=async(bytes,label)=>{
  let {reviewId,protection}=await review(bytes);
  if(label==='Contrato privado'){
   const start=protection.restored.indexOf('CT-41726');
   if(!protection.parts.some(part=>part.label&&part.start<=start&&part.end>=start+8)){
    ({reviewId}=await call('protectSelection',{reviewId,start,end:start+8}));
   }
  }
  const result=await call('addSource',{reviewId,label});
  assert.deepEqual(await call('addSource',{reviewId,label}),result);
  return result;
 };
 const a=await add(files[0],'Factura privada'),b=await add(files[1],'Contrato privado');
 assert.equal((await add(files[1],'Otro título')).duplicate,true);
 assert.equal((await call('status')).sources.length,2);
 for(const ids of [[a.id,a.id],[a.id,'fuera']])await assert.rejects(call('compareSources',{ids}));
 await assert.rejects(call('downloadSource',{id:'fuera'}));
 const current=await call('compareSources',{ids:[b.id,a.id]});
 assert.deepEqual(current.comparisonPair,[a.id,b.id]);
 const note=current.tasks.find(n=>n.comparison?.suggested&&n.comparison.subject==='flete');
 assert.ok(note.comparison.conflicting);
 assert.equal(note.evidence.line,3);
 assert.equal(note.evidence.additional[0].sourceId,b.id);
 async function workbook(result){
  const book=new ExcelJS.Workbook();
  await book.xlsx.load(Buffer.from(result.base64,'base64'));
  return book;
 }
 const sheet=(await workbook(await call('exportSourceComparison'))).getWorksheet('Cruce de soportes');
 assert.equal(sheet.getCell('B3').value,3);
 assert.match(sheet.getCell('C2').value,/FM-38214/);
 assert.match(sheet.getCell('C3').value,/CT-41726/);
 assert.ok(sheet.getCell('D2').value);assert.equal(bodies.length,0);
 const initial=await call('draft',{task:note.id});
 assert.equal(bodies[0].messages[0].content,note.preview);
 assert.ok(initial.followupParents.includes(note.id));
 const secondary=await call('readDocument',{id:b.id});
 const marker=secondary.tokens.find(x=>x.value.includes('41726'));
 assert.ok(marker);
 const updated=initial.drafts[note.id]+'\nReferencia comprobada '+marker.token;
 await call('edit',{task:note.id,text:updated});
 await app.close();app=await start();
 const archived=await call('compareSources',{ids:[]});
 assert.ok(archived.tasks.find(n=>n.id===note.id).comparison.archived);
 await call('draft',{task:'contraste-flete-incluido'});
 assert.equal(bodies.length,1);
 const follow=await call('addFollowup',{task:note.id,form:'control',instruction:'Cotejar la factura y el contrato.'});
 const child=await call('draft',{task:follow.task});
 assert.equal(bodies[1].messages[0].content,child.tasks.find(n=>n.id===follow.task).preview);
 assert.match((await call('preview',{task:follow.task})).text,/CT-41726/);
 const restored=(await call('preview',{task:note.id})).text;
 for(const term of ['Factura privada','Contrato privado','FM-38214','CT-41726',marker.value])assert.ok(restored.includes(term));
 assert.ok(!restored.includes('[['));
 assert.equal((await call('downloadSource',{id:a.id})).base64,files[0].toString('base64'));
 assert.equal((await call('downloadSource',{id:b.id})).base64,files[1].toString('base64'));
 assert.ok((await workbook(await call('export',{task:note.id,format:'xlsx'}))).getWorksheet('Cruce de soportes'));
 await call('edit',{task:note.id,text:updated.replace('[[SOPORTE]]','')});
 assert.equal((await workbook(await call('export',{task:note.id,format:'xlsx'}))).getWorksheet('Cruce de soportes'),undefined);
 assert.ok(!(await call('preview',{task:note.id})).text.includes('FM-38214'));
 for(const name of (await readdir(dir)).filter(n=>n.includes('sqlite'))){
  const sealed=await readFile(path.join(dir,name));
  for(const file of files)assert.ok(!sealed.includes(file)&&!sealed.includes(Buffer.from(file.toString('base64'))));
 }
 const backup=await mkdtemp(path.join(tmpdir(),'rejon-restaurado-'));
 t.after(()=>rm(backup,{recursive:true,force:true}));
 const copy=path.join(backup,path.basename(path.dirname(dir)),path.basename(dir));
 await mkdir(copy,{recursive:true});
 await app.close();
 await copyFile(path.join(dir,'rejon-protegido.sqlite'),path.join(copy,'rejon-protegido.sqlite'));
 app=await start(copy);
 assert.equal((await call('downloadSource',{id:b.id})).base64,files[1].toString('base64'));
 assert.deepEqual((await call('status')).sources.map(row=>row.id),[a.id,b.id]);
});

test('a pair requires shared evidence and keeps conditional facts unresolved',()=>{
 const notes=(a,b)=>comparisonsFor([{id:'a',label:'Factura',original:a},{id:'b',label:'Contrato',original:b}]).filter(n=>n.suggested);
 assert.deepEqual(notes('El precio pagado incluye el flete.','Se adjunta el acuse de los anexos.'),[]);
 for(const [a,b,subject,variant,conflicting] of [
  ['El precio pagado incluye el flete.','¿El precio pagado incluye el flete?','flete','pendiente',false],
  ['El pago de regalías es condición de venta.','El pago de las regalías no es condición de venta.','regalias','pendiente',true],
  ['Se adjunta el acuse de los anexos del pedimento.','Falta el acuse de los anexos del pedimento.','acuse','pendiente',true],
  ['El precio pagado incluye el flete.','El precio pagado incluye el flete.','flete','incluido',false],
 ]){
  const [note]=notes(a,b);
  assert.equal(note.subject,subject);assert.equal(note.variant.id,variant);assert.equal(note.conflicting,conflicting);
  assert.equal(note.evidence.sourceId,'a');assert.equal(note.evidence.additional[0].sourceId,'b');
 }
});
