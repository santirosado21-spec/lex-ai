import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import {searchNico,nicoRow,nicoAttachment} from '../server/corpus/nico-index.mjs';
import {startServer} from '../server/main.mjs';

test('NICO preserves the ten-digit identity, suppressed codes, source edition and pagination',()=>{
 const coffee=searchNico('09012199',0).results;
 assert.deepEqual(coffee.map(r=>[r.nico,r.description,r.page,r.excelRow]),[['01','En cápsulas.',2,777],['99','Los demás.',2,778]]);
 assert.equal(searchNico('0901219900',0).total,0);
 for(const query of ['0901219901','0901.21.99.01','0901.21.99 01'])assert.deepEqual(searchNico(query,0).results,[coffee[0]]);
 assert.equal(nicoRow('0101.21.01','00').excelRow,6);
 assert.equal(nicoRow('8414.51.01','01').date,'30-06-2023');
 assert.ok(searchNico('capsulas',0).results.some(r=>r.code==='0901.21.99'));
 const second=searchNico('los demás',12),first=searchNico('los demás',0);
 assert.equal(second.results.length,12);
 assert.ok(second.results.every(r=>!first.results.some(a=>a.excelRow===r.excelRow)));
 for(const query of ['0901.21','0901/21/99','0912.88.8','a',null])assert.throws(()=>searchNico(query,0));
 assert.throws(()=>nicoRow('0101.21.01',0));
 assert.equal(nicoAttachment(coffee[0].localUrl.split('#')[0]).bytes.toString('ascii',0,4),'%PDF');
 assert.equal(nicoAttachment(coffee[0].localBook).bytes.toString('ascii',0,2),'PK');
});

test('separate case notes with local restoration, verified outbound quote and typed Excel identifiers',async t=>{
 const dataDir=await mkdtemp(path.join(tmpdir(),'rejon-nico-'));
 const options={intakePilot:true,intakeGenerate:async()=>{throw Error('Unexpected cloud request');},dataDir,autoInitialize:false};
 const start=()=>startServer({...options,pilotPassphrase:Buffer.from('frase ficticia para pruebas')});
 let app=await start();
 t.after(async()=>{await app.close();await rm(dataDir,{recursive:true,force:true});});
 const rpc=(action,payload)=>app.service.dispatch('intake.'+action,payload);
 const coffee={code:'0901.21.99',nico:'01'};
 await assert.rejects(rpc('addNico',coffee));
 await rpc('save',{firm:'Firma ficticia',client:'Tienda ficticia',title:'Ensayo café',jurisdiction:'MX-FED'});
 await assert.rejects(rpc('addNico',{...coffee,description:'Privado'}));
 const one=await rpc('addNico',coffee);
 assert.ok(!one.status.followupParents.includes(one.task));
 const rest=await rpc('addNico',{...coffee,nico:'99'});
 assert.notEqual(rest.task,one.task);
 const animal=await rpc('addNico',{code:'0101.21.01',nico:'00'});
 assert.ok(animal.status.followupParents.includes(animal.task));
 const edit=animal.status.drafts[animal.task]+'\n\nDetalle local privado.';
 await rpc('edit',{task:animal.task,text:edit});
 const follow=await rpc('addFollowup',{task:animal.task,form:'carta',instruction:'Solicitar ficha técnica de Tienda ficticia'});
 const prompt=follow.status.tasks.find(r=>r.id===follow.task).preview;
 assert.match(prompt,/Reproductores de raza pura/);assert.doesNotMatch(prompt,/Tienda ficticia|Detalle local privado|Ensayo café/);
 await app.close();app=await start();
 assert.equal((await rpc('addNico',{code:'0101.21.01',nico:'00'})).status.drafts[animal.task],edit);
 const preview=await rpc('preview',{task:one.task});
 assert.match(preview.text,/Tienda ficticia/);assert.match(preview.text,/En cápsulas/);
 await rpc('addNico',{code:'9802.00.24',nico:'00'}); // Longest description in this edition.
 for(const format of ['docx','xlsx','pptx']){
  const file=await rpc('export',{task:one.task,format});assert.ok(file.name.endsWith('.'+format));
 }
 await rpc('addTariff',{code:'8413.70.07',page:631});
 const file=await rpc('exportTariffBook',{}),book=new ExcelJS.Workbook();
 await book.xlsx.load(Buffer.from(file.base64,'base64'));
 const rows=book.getWorksheet('NICO consultados');
 assert.ok(book.getWorksheet('Tarifa consultada'));
 assert.deepEqual([2,3,4].map(i=>rows.getCell('B'+i).value),['01','99','00']);
 assert.match(rows.getCell('G2').value.hyperlink,/mod02_22mar24\.pdf#page=2$/);
});
