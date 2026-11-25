import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import ExcelJS from 'exceljs';
import mammoth from 'mammoth';
import {startServer} from '../server/main.mjs';
import {createIntakeGenerator} from '../server/intake-pilot.mjs';
import {customsPdfPath,customsPassage} from '../server/corpus/customs-edition.mjs';
import {loadTradeReading,renderTradeReading} from '../server/corpus/intake-trade-reading.mjs';
import {tradeWorksheet,revisedWorksheetRow,worksheetProposals,worksheetPendingNote} from '../server/intake-trade-worksheet.mjs';

test('each customs choice keeps its printed page and subsection and fits the draft editor',()=>{
 for(const key of ['lectura-valoracion','lectura-pedimento']){
  const reading=loadTradeReading(null,key);
  for(const a of reading.choices[0])for(const b of reading.choices[1]){
   const output=renderTradeReading(JSON.stringify({A:{pasaje:a.key,solicitud:'¿Qué documento acredita el precio?'},B:{pasaje:b.key,solicitud:'¿Cómo se acredita la transmisión?'}}),reading);
   assert.ok(output.includes(a.quote)&&output.includes(b.quote)&&output.includes(a.locator)&&output.includes(b.locator));
   if(b.condition)assert.ok(output.includes(b.condition));
   assert.ok(output.length<=1800);
  }
 }
 assert.throws(()=>customsPassage('151'));
});
test('work papers distinguish missing amounts from zero and keep ambiguous amounts for manual review',()=>{
 const key='lectura-valoracion';
 const data=worksheetProposals(key,'Flete: USD 1,203.40\nFlete: 1.203,40 EUR\nFlete: USD 1,203\nSeguro: 0.00 MXN\nPrecio pagado: $1200\nRegalías: XXX 123\nPrecio pagado: 1.000.000,01 MXN');
 assert.deepEqual(data.transporte.map(x=>[x.amount,x.currency,x.line]),[['1203.40','USD',1],['1203.40','EUR',2]]);
 assert.equal(data.seguro[0].amount,'0.00');
 assert.equal(data.precio[0].amount,'1000000.01');
 const sheet=tradeWorksheet(key);
 const values={amount:'0',currency:'USD',reference:'=SIMULACION()',note:'Ficticio',status:'Recibido'};
 assert.equal(revisedWorksheetRow(sheet,'precio',values,0).amount,'0');
 for(const change of [{currency:''},{amount:'1e5'},{amount:'0.00001'},{amount:'NaN'},{note:'a\nb'},{status:'Autorizado'}]){
  assert.throws(()=>revisedWorksheetRow(sheet,'precio',{...values,...change},0));
 }
 assert.throws(()=>revisedWorksheetRow(tradeWorksheet('lectura-pedimento'),'declaracion',values,0));
});
test('local worksheet edits are versioned, encrypted, excluded from cloud messages and restored into Office after restart',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'rejon-worksheet-'));
 const sent=[];
 const generator=createIntakeGenerator({getApiKey:async()=>'sk-'+'f'.repeat(35),fetchImpl:async(_url,opts)=>{
  sent.push(opts.body);return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({A:{pasaje:'A1'},B:{pasaje:'B2'}})}}]});
 }});
 const start=()=>startServer({dataDir:dir,autoInitialize:false,intakePilot:true,intakeGenerate:generator,libraryPath:path.join(dir,'sin-indice'),pilotPassphrase:Buffer.from('frase para el piloto ficticio')});
 let app=await start();t.after(async()=>{await app.close();await rm(dir,{recursive:true,force:true});});
 const call=(a,p)=>app.service.dispatch(a,p);
 const paper=await fetch(app.connection.url+customsPdfPath);
 assert.equal(paper.headers.get('content-type'),'application/pdf');
 assert.ok(customsPdfPath.includes(createHash('sha256').update(Buffer.from(await paper.arrayBuffer())).digest('hex')));
 const task='lectura-valoracion',other='lectura-pedimento';
 const txt='Cliente: Casa Mirlo Ficticia\nRevisar valor en aduana y pedimento.\nFlete: USD 3,780.50\nPedimento: 26 47 0000 6000001';
 const native=globalThis.fetch;
 let upload;
 try{globalThis.fetch=async url=>{assert.equal(url,'http://127.0.0.1:11434/api/chat');return Response.json({message:{content:JSON.stringify({client:'Casa Mirlo Ficticia',title:'',documentKind:'pedimento',entities:['Casa Mirlo Ficticia']})}});};
  upload=await call('intake.inspectLocal',{extension:'txt',base64:Buffer.from(txt).toString('base64'),review:true});
 }finally{globalThis.fetch=native;}
 const saved=await call('intake.save',{firm:'Despacho Mirlo',client:'Casa Mirlo Ficticia',title:'Asunto cobre',jurisdiction:'MX-FED',reviewId:upload.reviewId});
 const preview=saved.tasks.find(n=>n.id===task).preview;
 const sheet=await call('intake.readWorksheet',{task});
 const values={amount:'3780.50',currency:'USD',reference:'=FICTICIO()',status:'Cotejado',note:'Soporte privado BETA-FLETE-817'};
 const change={task,id:'transporte',revision:0,values};
 assert.equal(sheet.proposals.transporte[0].amount,'3780.50');
 await call('intake.saveWorksheetRow',change);
 await assert.rejects(call('intake.saveWorksheetRow',change),/cambió/);
 const copy={...change,revision:1,copyId:'a11f9705-be32-48d6-9e93-556e6888355f',values:{...values,amount:'232.58',currency:'EUR'}};
 await call('intake.saveWorksheetRow',copy);const again=await call('intake.saveWorksheetRow',copy);
 assert.deepEqual(again.rows.filter(r=>r.base==='transporte').map(r=>r.currency),['USD','EUR']);
 assert.equal((await call('intake.readWorksheet',{task:other})).rows.every(x=>!x.revision),true);
 const worksheetFile=await call('intake.exportWorksheet',{task});
 assert.equal(worksheetFile.name,'Rejon-control-valoracion.xlsx');
 const pendingFile=await call('intake.exportWorksheetPending',{task});
 const pendingText=(await mammoth.extractRawText({buffer:Buffer.from(pendingFile.base64,'base64')})).value;
 assert.equal(pendingFile.name,'Rejon-pendientes-valoracion.docx');
 assert.ok(pendingText.includes('Por revisar: definir el siguiente paso'));
 assert.ok(!pendingText.includes('Análisis jurídico'));
 assert.ok(!pendingText.includes('Fuentes recuperadas'));
 assert.ok(pendingText.includes('No es una solicitud al cliente.'));
 assert.ok(!pendingText.includes(values.note));
 await assert.rejects(call('intake.exportWorksheetPending',{task:'trade'}),/control/);
 assert.equal(sent.length,0);
 await call('intake.draft',{task});
 assert.equal(sent.length,1);assert.equal(JSON.parse(sent[0]).messages[0].content,preview);
 for(const secret of ['3780','3,780','FICTICIO()','BETA-FLETE-817','Casa Mirlo','6000001'])assert.ok(!sent[0].includes(secret));
 await app.close();app=await start();
 const {readFile}=await import('node:fs/promises');
 assert.ok(!(await readFile(path.join(dir,'rejon-protegido.sqlite'))).includes(Buffer.from(values.note)));
 assert.ok((await call('intake.preview',{task})).text.includes(values.note));
 assert.equal((await call('intake.readWorksheet',{task})).rows.find(r=>r.id==='transporte').revision,1);
 const xlsx=await call('intake.export',{task,format:'xlsx'}),book=new ExcelJS.Workbook();
 await book.xlsx.load(Buffer.from(xlsx.base64,'base64'));
 const row=book.getWorksheet('Control de valoración').getRow(3);
 assert.equal(row.getCell(4).value,3780.5);assert.equal(row.getCell(5).value,'USD');assert.equal(row.getCell(6).type,ExcelJS.ValueType.String);assert.equal(row.getCell(6).value,values.reference);assert.equal(row.getCell(7).value,values.note);
 const doc=await call('intake.export',{task,format:'docx'});
 assert.ok((await mammoth.extractRawText({buffer:Buffer.from(doc.base64,'base64')})).value.includes(values.note));
});

test('pending note separates saved states without re-requesting received items or inventing a legal result',()=>{
 const base=tradeWorksheet('lectura-pedimento');
 const states=['Por revisar','Solicitado','Recibido','Cotejado','No aplica'];
 const sheet={...base,rows:base.rows.map((row,i)=>({...row,status:states[i],reference:i===2?'Línea 18 · soporte local':'',note:i===2?'Dato del usuario':''}))};
 const text=worksheetPendingNote(sheet);
 assert.match(text,/Recibido: cotejo pendiente/);assert.match(text,/Referencia local: Línea 18/);
 assert.match(text,/Observación del usuario: Dato del usuario/);
 assert.ok(!text.includes('Qué cotejar: '+sheet.rows[3].check));
 assert.ok(!text.includes('Qué cotejar: '+sheet.rows[4].check));
 assert.match(worksheetPendingNote({...sheet,rows:sheet.rows.map(row=>({...row,status:'Cotejado'}))}),/Sin pendientes según los estados guardados/);
 assert.throws(()=>worksheetPendingNote({...sheet,rows:[{...sheet.rows[0],status:'Aprobado'}]}),/no reconocidos/);
 const copy={...sheet.rows[2],id:'factura~copy',label:'Documento de valor (2)'};
 assert.match(worksheetPendingNote({...sheet,rows:[...sheet.rows,copy]}),/Documento de valor \(2\)/);
});

test('pending Word treats Markdown-like user fields as literal attributed data',async()=>{
 const {exportWorksheetPending}=await import('../server/worksheet-pending-export.mjs');
 const note='Primera línea\n\n## Aprobación sintética\n\n- No es una acción del sistema';
 const sheet={...tradeWorksheet('lectura-pedimento'),rows:[{...tradeWorksheet('lectura-pedimento').rows[0],status:'Recibido',reference:'## Referencia literal',note}]};
 const file=await exportWorksheetPending({firm:{name:'## Despacho literal'},matter:{client:'- Cliente literal',title:'Asunto de prueba'},sheet});
 const {value:html}=await mammoth.convertToHtml({buffer:Buffer.from(file.base64,'base64')});
 assert.ok(html.includes('## Aprobación sintética'),'user Markdown must remain literal');
 assert.ok(html.includes('- No es una acción del sistema'));
 assert.ok(!/<h\d[^>]*>Aprobación sintética<\/h\d>/u.test(html));
 assert.ok(!/<li>No es una acción del sistema<\/li>/u.test(html));
 assert.ok(html.includes('Observación del usuario: Primera línea'));
 assert.ok(html.includes('Referencia local: ## Referencia literal'));
 assert.ok(html.includes('## Despacho literal'));
});
