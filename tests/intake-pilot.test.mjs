import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import mammoth from 'mammoth';
import {startServer} from '../server/main.mjs';
import {createIntakeGenerator} from '../server/intake-pilot.mjs';

test('local intake precedes cloud, the envelope has no intake data, and export restores the saved fields locally',async()=>{
 const dataDir=await mkdtemp(path.join(os.tmpdir(),'rejon-intake-test-'));
 const captured=[];
 const intakeGenerate=createIntakeGenerator({
  getApiKey:async()=>`sk-${'x'.repeat(32)}`,
  fetchImpl:async (url,options)=>{
   const body=JSON.parse(options.body);
   captured.push({url,body});
   const content=captured.length===1?'Marcador incorrecto [[TERCERO]]':'Hola [[CLIENTE]]. Recibimos el asunto [[ASUNTO]].';
   return Response.json({choices:[{finish_reason:'stop',message:{content}}]});
  },
 });
 const fields={firm:'DESPACHO-CANARIO-01',client:'CLIENTE-CANARIO-02',title:'ASUNTO-CANARIO-03',jurisdiction:'MX-FED'};
 let app;
 const start=()=>startServer({dataDir,intakePilot:true,intakeGenerate,autoInitialize:false,libraryPath:path.join(dataDir,'unused.sqlite')});
 const call=(action,payload={})=>fetch(app.connection.url+'/api',{
  method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${app.connection.token}`},
  body:JSON.stringify({action,payload}),
 });
 try {
  app=await start();
  assert.equal((await (await call('intake.status')).json()).saved,false);
  assert.equal((await call('intake.draft',{task:'opening'})).status,400);
  assert.equal((await call('intake.save',{...fields,jurisdiction:'invalid'})).status,400);
  assert.equal((await (await call('state')).json()).workspace,null);
  const save=await call('intake.save',fields);
  assert.equal(save.status,200);
  assert.equal((await save.json()).saved,true);
  assert.equal(captured.length,0);
  assert.equal((await call('intake.draft',{task:'opening',client:fields.client})).status,400);
  assert.equal(captured.length,0);

  assert.equal((await call('intake.draft',{task:'opening'})).status,400);
  assert.equal((await (await call('intake.status')).json()).saved,true);
  assert.equal((await call('intake.export',{task:'opening'})).status,400);
  const drafted=await call('intake.draft',{task:'opening'});
  assert.equal(drafted.status,200);
  const preview=(await drafted.json()).drafts.opening;
  assert.equal(preview,'Hola [[CLIENTE]]. Recibimos el asunto [[ASUNTO]].');
  assert.equal((await call('intake.draft',{task:'opening'})).status,200);
  assert.equal(captured.length,2);
  for(const request of captured){
   assert.equal(request.url,'https://api.openai.com/v1/chat/completions');
   assert.equal(request.body.store,false);
   assert.ok(request.body.messages[0].content.includes('[[CLIENTE]]'));
   assert.ok(request.body.messages[0].content.includes('[[ASUNTO]]'));
   for (const field of Object.values(fields)) assert.ok(!JSON.stringify(request.body).includes(field));
  }

  await app.close();
  app=await start();
  assert.equal((await (await call('intake.status')).json()).drafts.opening,preview);
  const exported=await call('intake.export',{task:'opening'});
  assert.equal(exported.status,200);
  const {base64}=await exported.json();
  const {value}=await mammoth.extractRawText({buffer:Buffer.from(base64,'base64')});
  assert.match(value,/Hola CLIENTE-CANARIO-02\. Recibimos el asunto ASUNTO-CANARIO-03\./);
  assert.doesNotMatch(value,/\[\[(CLIENTE|ASUNTO)\]\]/);
  assert.equal(captured.length,2);
  const db=await readFile(path.join(dataDir,'lex.sqlite'));
  assert.ok(db.includes(fields.client));
  assert.ok(db.includes(fields.title));
 } finally {
  await app?.close();
  await rm(dataDir,{recursive:true,force:true});
 }
});

test('confirmed document class and public references match the preview and all Office exports restore only on the machine',async t=>{
 const {default:ExcelJS}=await import('exceljs');
 const {default:yauzl}=await import('yauzl');
 const dataDir=await mkdtemp(path.join(os.tmpdir(),'rejon-trade-test-'));
 const dispatches=[];
 const generate=createIntakeGenerator({
  getApiKey:async()=>`sk-${'x'.repeat(32)}`,
  fetchImpl:async(_url,options)=>{
   dispatches.push(JSON.parse(options.body));
   const factual='El origen de la mercancía podrá ser nacional, si se considera un solo país, o regional, si se considera a más de un país.';
   const content=dispatches.at(-1).response_format?.type==='json_object'?JSON.stringify({fuente:'LCE-9',cita:factual,pendiente:'origen',solicitud:'¿En qué países se produjeron los insumos de la mercancía?'}):'Para [[CLIENTE]], revisar la operación [[ASUNTO]].';
   return Response.json({usage:{prompt_tokens:100,completion_tokens:50},choices:[{finish_reason:'stop',message:{content}}]});
  },
 });
 const app=await startServer({dataDir,intakePilot:true,intakeGenerate:generate,autoInitialize:false,libraryPath:path.join(dataDir,'unused.sqlite')});
 t.after(async()=>{await app.close();await rm(dataDir,{recursive:true,force:true});});
 const call=(action,payload={})=>fetch(app.connection.url+'/api',{
  method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${app.connection.token}`},
  body:JSON.stringify({action,payload}),
 });
 const fields={firm:'Oficina ficticia & socios',client:'=SUM(17,23)',title:'Operación de muestra',jurisdiction:'MX-FED'};
 assert.equal((await call('intake.save',{...fields,documentKind:'tipo libre'})).status,400);
 assert.equal((await call('intake.save',{...fields,documentKind:'factura',scenarioId:'libre'})).status,400);
 const supplier='Proveedor CANARIO-LOCAL-072';
 assert.equal((await call('intake.save',{...fields,supplier})).status,400);
 const saved=await (await call('intake.save',{...fields,documentKind:'factura',scenarioId:'factura-origen-v1',supplier})).json();
 const trade=saved.tasks.find(task=>task.id==='trade');
 assert.ok(trade.references.length>0);
 assert.match(trade.preview,/Tipo de documento confirmado en el ejercicio: factura/);
 assert.equal((await call('intake.draft',{task:'trade'})).status,200);
 const [dispatched]=dispatches;
 assert.equal(trade.preview,dispatched.messages[0].content);
 for(const ref of trade.references) assert.ok(trade.preview.includes(ref.url));
 for(const ref of trade.references.filter(ref=>ref.text)) assert.ok(dispatched.messages[0].content.includes(ref.text));
 const answered=await (await call('intake.status')).json();
 assert.match(answered.drafts.trade,/Fundamento documental \[LCE-9\]/);
 assert.match(answered.drafts.trade,/Dato pendiente/);
 assert.match(answered.drafts.trade,/¿En qué países se produjeron los insumos/);
 assert.ok(trade.preview.includes('[[PROVEEDOR]]'));
 for(const original of [...Object.values(fields),supplier]) assert.ok(!JSON.stringify(dispatched).includes(original));
 assert.equal((await call('intake.edit',{task:'trade',text:'Faltan los marcadores'})).status,400);
 const edited='Oficio local inédito para [[CLIENTE]]. Asunto [[ASUNTO]].';
 const edit=await call('intake.edit',{task:'trade',text:edited});
 assert.equal(edit.status,200);
 assert.deepEqual((await edit.json()).editedTasks,['trade']);
 assert.equal((await call('intake.draft',{task:'trade'})).status,200);
 assert.equal(dispatches.length,1);
 assert.equal((await call('intake.draft',{task:'documents'})).status,200);
 assert.equal(dispatches.length,2);
 for (const body of dispatches) assert.ok(!JSON.stringify(body).includes('Oficio local inédito'));
 const restored=await (await call('intake.preview',{task:'trade'})).json();
 const statement='Oficio local inédito para =SUM(17,23). Asunto Operación de muestra.';
 const supplierLine='Proveedor registrado: '+supplier;
 assert.equal(restored.text,statement+'\n\n'+supplierLine);
 for (const request of dispatches) assert.ok(!JSON.stringify(request).includes(supplier));
 assert.equal((await call('intake.export',{task:'trade',format:'pdf'})).status,400);
 const file=async format=>{
  const response=await call('intake.export',{task:'trade',format});
  assert.equal(response.status,200);
  const {name,mime,base64}=await response.json();
  assert.equal(name,`Rejon-trade.${format}`);
  return {mime,buffer:Buffer.from(base64,'base64')};
 };
 const doc=await file('docx');
 assert.equal(doc.mime,'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
 const {value}=await mammoth.extractRawText({buffer:doc.buffer});
 assert.ok(value.includes(statement));
 assert.ok(value.includes(supplierLine));
 assert.ok(value.includes(trade.references[0].title));

 const xlsx=await file('xlsx');
 assert.equal(xlsx.mime,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
 const book=new ExcelJS.Workbook();
 await book.xlsx.load(xlsx.buffer);
 const sheet=book.getWorksheet('Expediente');
 const evidence=book.getWorksheet('Control documental');
 assert.equal(evidence.getCell('A2').value,'Factura comercial');
 assert.equal(evidence.getCell('C2').value,'Por revisar');
 assert.equal(evidence.getCell('C2').dataValidation.type,'list');
 assert.equal(sheet.getCell('B3').value,fields.client);
 assert.equal(sheet.getCell('B3').type,ExcelJS.ValueType.String);
 assert.equal(sheet.getCell('B5').value,statement);
 assert.equal(sheet.getCell('B6').value,supplierLine);
 assert.equal(book.getWorksheet('Fuentes').getCell('D2').value.hyperlink,trade.references[0].url);

 const pptx=await file('pptx');
 assert.equal(pptx.mime,'application/vnd.openxmlformats-officedocument.presentationml.presentation');
 const slides=[];
 await new Promise((resolve,reject)=>{
  yauzl.fromBuffer(pptx.buffer,{lazyEntries:true},(error,zip)=>{
   if(error)return reject(error);
   zip.on('error',reject);
   zip.on('end',resolve);
   zip.on('entry',entry=>{
    if(!/^ppt\/slides\/slide\d+\.xml$/.test(entry.fileName))return zip.readEntry();
    zip.openReadStream(entry,(error,stream)=>{
     if(error)return reject(error);
     const bytes=[];
     stream.on('error',reject);
     stream.on('data',chunk=>bytes.push(chunk));
     stream.on('end',()=>{slides.push(Buffer.concat(bytes).toString());zip.readEntry();});
    });
   });
   zip.readEntry();
  });
 });
 assert.equal(slides.length,4);
 assert.ok(slides.some(slide=>slide.includes(statement) && slide.includes(supplierLine)));
 assert.ok(slides.some(slide=>slide.includes(trade.references[0].title)));
 assert.ok(slides.every(slide=>!slide.includes('[[CLIENTE]]')));
});


test('trade rejects invented authority, unrelated quotes and unsupported conclusions',async()=>{
 const {renderTradeDraft,tradeArticles}=await import('../server/corpus/trade-pilot-grounding.mjs');
 const articles=tradeArticles();
 for(const response of [
  {fuente:'LCE-9',cita:'Corresponde una tasa cero.',pendiente:'origen'},
  {fuente:'APOCRIFA',cita:articles[0].text,pendiente:'acuerdo'},
  {abstener:true,pendiente:'proceso'},
 ]) {
  const result=renderTradeDraft(JSON.stringify(response),articles);
  assert.match(result,/Fundamento pendiente/);
  assert.doesNotMatch(result,/tasa cero|APOCRIFA/);
 }
 assert.throws(()=>tradeArticles({lookupArticle:()=>({...articles[0],text:'Sustitución'})}),/cambió/);
});

test('all three pilot tasks fit the local cap even when usage is missing; receipt failure preserves the response',async()=>{
 const receipts=[];
 const bodySizes=[];
 const generate=createIntakeGenerator({
  getApiKey:async()=>`sk-${'x'.repeat(32)}`,
  onReceipt:async receipt=>{receipts.push(receipt);throw new Error('local accounting unavailable');},
  fetchImpl:async(_url,options)=>{
   bodySizes.push(options.body.length);
   return Response.json({model:'test',choices:[{finish_reason:'stop',message:{content:'fixture'}}]});
  },
 });
 for(const task of ['opening','documents','trade']) {
  assert.equal(await generate(task,{documentKind:'factura',scenarioId:'factura-origen-v1'}),'fixture');
 }
 assert.equal(receipts.length,3);
 assert.ok(receipts.every(receipt=>receipt.observedModel==='test' && receipt.usage===null));
 assert.ok(bodySizes.reduce((total,length)=>total+Math.ceil(length/2)+320,0)<=4000);
 await assert.rejects(generate('trade',{documentKind:'factura'}));
 assert.equal(bodySizes.length,3);
});
