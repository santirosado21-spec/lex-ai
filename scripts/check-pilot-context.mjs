// Three-turn browser exercise with locally checked synthetic text and audited outbound bodies.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
const root=path.resolve(process.argv.find(x=>x.startsWith('--app='))?.slice(6)??'.');
const live=process.argv.includes('--openai'),replay=process.argv.includes('--replay');
assert.ok(!(live&&replay));
const out=path.resolve('artifacts/contexto-r16',root!==path.resolve('.')?'paquete':live?'openai':replay?'replay':'simulado');
await mkdir(out,{recursive:true});
const {startServer}=await import(pathToFileURL(path.join(root,'server/main.mjs')));
const {createIntakeGenerator}=await import(pathToFileURL(path.join(root,'server/intake-pilot.mjs')));
const {customsPassage}=await import(pathToFileURL(path.join(root,'server/corpus/customs-edition.mjs')));
const fullQuote=customsPassage('65').passages[1].quote;
const question='¿Qué documentos acreditan el flete de Importadora Lirio de Ensayo para la operación MZ-77384?';
const edits='Anotación interna ZAF-10298.';
const parties=['Importadora Lirio','Taller Níquel','Firma Los Ciruelos','Consulta embarque Lirio','MZ-77384','FM-38214','CT-41726','ZAF-10298','625.30','4200','Soporte violeta','Anexo índigo','[[DATO_','[[LEX_'];
const actual=[],receipts=[],records=[];
const fixture=replay?JSON.parse(await readFile('fixtures/public-cases/consulta-contexto-r16.json','utf8')):null;
const mock=[
 {lectura:'Las afirmaciones sobre la inclusión del flete discrepan. Se requiere cotejar el precio pagado y el gasto que corresponde al importador.',cita:fullQuote,solicitud:'¿Qué comprobante acredita el gasto de transporte?'},
 {acciones:['Solicitamos la factura comercial para verificar el precio pagado.','Por favor remita el contrato para cotejar los gastos de transporte.']},
 {acciones:['Cotejar la factura comercial contra el comprobante de pago.','Verificar el comprobante de pago para identificar el gasto de transporte.']},
];
let preview='';
const generate=createIntakeGenerator({...(live?{}:{getApiKey:async()=>'sk-'+'x'.repeat(32)}),onReceipt:r=>receipts.push(r),fetchImpl:async(url,opts)=>{
 assert.equal(url,'https://api.openai.com/v1/chat/completions');
 const i=actual.length;console.log('Consulta recibida por el transporte:',i+1);assert.ok(i<3);
 const body=JSON.parse(opts.body);

 assert.equal(body.messages.length,1);assert.equal(body.messages[0].content,preview);assert.equal(body.store,false);
 for(const literal of parties)assert.ok(!opts.body.includes(literal),literal);
 for(const fact of ['El precio pagado incluye el flete.','El precio pagado no incluye el flete.'])assert.ok(preview.includes(fact));
 if(i===2)assert.match(preview,/Turno anterior\nSolicitud al cliente · factura comercial y contrato/);
 actual.push(body);const sha256=createHash('sha256').update(opts.body).digest('hex');
 if(fixture)assert.equal(sha256,fixture[i].sha256);
 if(live){
  const response=await fetch(url,opts);
  if(response.ok){const raw=(await response.clone().json()).choices[0].message.content;records.push({sha256,response:JSON.parse(raw)});await writeFile(path.join(out,'respuestas.json'),JSON.stringify(records,null,2));}
  return response;
 }
 const content=JSON.stringify(fixture?fixture[i].response:mock[i]);
 return Response.json({usage:{prompt_tokens:350,completion_tokens:96},choices:[{finish_reason:'stop',message:{content}}]});
}});
const dir=await mkdtemp(path.join(tmpdir(),'rejon-turnos-'));
const start=()=>startServer({intakePilot:true,intakeGenerate:generate,dataDir:dir,autoInitialize:false,pilotPassphrase:Buffer.from('prueba ficticia de tres turnos')});
const browser=await chromium.launch();let app;
try{
 app=await start();
 const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});page.setDefaultTimeout(20000);
 const errors=[],external=[];
 page.on('response',async r=>{if(r.status()>=400&&new URL(r.url()).origin===new URL(app.connection.url).origin)console.log('Servicio local',r.status(),(await r.json().catch(()=>({}))).error);});page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(app.connection.url).origin)external.push(r.url());});
 const open=()=>page.goto(app.connection.url+'/#pilot=intake&token='+app.connection.token);
 const b=name=>page.getByRole('button',{name,exact:true});
 const exportAs=async(label,ext,basename)=>{
  await b(label).click();const item=page.waitForEvent('download');await b('Descargar .'+ext).click();
  await(await item).saveAs(path.join(out,basename+'.'+ext));
 };
 const gen=async()=>{
  await b('Enviar y generar borrador').waitFor();
  const panel=page.locator('.rp-proof').filter({has:b('Enviar y generar borrador')}).locator('.rp-preview');
  if(!await panel.isVisible())await page.getByText('Leer el mensaje completo',{exact:true}).click();
  preview=await panel.innerText();await b('Enviar y generar borrador').click();
  const outcome=await Promise.race([b('Datos originales').waitFor({timeout:65000}).then(()=>''),page.getByRole('alert').waitFor({timeout:65000}).then(()=>page.getByRole('alert').innerText())]);
  assert.equal(outcome,'','Generación: '+outcome);await b('Datos originales').click();
  const restored=page.locator('.rp-document');await restored.filter({hasText:'Consulta embarque Lirio'}).waitFor();
  const text=await restored.innerText();assert.ok(!text.includes('Fundamento pendiente')&&!text.includes('[['));return text;
 };
 await open();await page.locator('#intake-firm').fill('Firma Los Ciruelos');await b('Continuar').click();
 await page.locator('#intake-client').fill('Importadora Lirio de Ensayo');await page.locator('#intake-title').fill('Consulta embarque Lirio');await b('Guardar en este equipo').click();
 await b('Documentos del expediente (0)').click();
 for(const [i,[file,label]] of [['factura-cotejo-ficticia','Soporte violeta'],['contrato-cotejo-ficticio','Anexo índigo']].entries()){
  await b('Añadir documento').click();
  await page.locator('input[type=file]').setInputFiles(path.join(root,'piloto',file+'.txt'));
  await page.getByText(/Revisar protección local/).waitFor({timeout:120000});
  await page.getByLabel('Nombre en el expediente').fill(label);await b('Guardar documento en este equipo').click();
  await b('Documentos del expediente ('+(i+1)+')').waitFor();
 }
 await b('Documentos del expediente (2)').click();await b('Consultar con una pregunta propia').click();
 await page.getByLabel('Pregunta del expediente').fill(question);await b('Buscar fundamentos en este equipo').click();
 const first=page.getByRole('checkbox',{name:/El precio pagado incluye el flete/});
 await first.waitFor({timeout:120000});assert.equal(await first.isChecked(),false);await first.check();
 await page.getByRole('checkbox',{name:/El precio pagado no incluye el flete/}).check();
 await page.getByLabel('Pasaje que quieres consultar').selectOption('aduana-65/1');await page.getByLabel('Enfoque jurídico').selectOption('documentos');
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await page.locator('.rp-question-facts').screenshot({path:path.join(out,'hechos.png')});
 await b('Preparar mensaje para revisión').click();await page.getByText('Leer el mensaje completo',{exact:true}).waitFor();
 const ids=[],rendered=[];ids.push(await page.locator('#intake-task').inputValue());rendered.push(await gen());
 for(const fragment of [question,'CT-41726','FM-38214','Discrepancia entre soportes','Lectura preliminar de OpenAI',fullQuote])assert.ok(rendered[0].includes(fragment),fragment);
 await exportAs('Word','docx','nota');
 await b('Editar borrador').click();const editBox=page.getByLabel('Editar en este equipo');
 await editBox.fill((await editBox.inputValue())+'\n'+edits);await b('Guardar cambios').click();
 for(const [i,[instruction,action]] of [['Pide la factura y el contrato de MZ-77384.','Preparar solicitud al cliente'],['Coteja la factura y el comprobante de pago ZAF-10298.','Preparar lista de cotejo']].entries()){
  await page.locator('#rp-focus').fill(instruction);await b(action).click();
  await b('Enviar y generar borrador').waitFor();ids.push(await page.locator('#intake-task').inputValue());rendered.push(await gen());
  assert.ok(!rendered[i+1].includes(edits));assert.equal(rendered[i+1].includes('CT-41726'),i===1);assert.equal(rendered[i+1].includes('discrepan sobre si el flete'),i===1);
  if(!i)await exportAs('Word','docx','carta');
 }
 for(const [label,ext] of [['Word','docx'],['Excel','xlsx'],['PowerPoint','pptx']]){
  await exportAs(label,ext,'control');
 }
 await app.close();app=await start();await open();await page.locator('#intake-task').selectOption(ids[2]);
 await b('Volver al documento anterior').click();assert.equal(await page.locator('#intake-task').inputValue(),ids[1]);
 await b('Volver al primer borrador').click();await b('Datos originales').click();await page.locator('.rp-document').filter({hasText:edits}).waitFor();
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.equal(actual.length,3);
 await writeFile(path.join(out,'recorrido.json'),JSON.stringify({real:live,replay,receipts,turns:3,externalBrowserRequests:0,restored:rendered},null,2));
 console.log('Tres turnos verificados. El abogado eligió ambos hechos; la nota y el control recuperaron las dos referencias.');
}finally{await browser.close();await app?.close();await rm(dir,{recursive:true,force:true});}
