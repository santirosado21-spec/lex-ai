// Run from the development checkout against either the checkout or an unpacked pilot.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import ExcelJS from 'exceljs';
const root=path.resolve(process.argv[2]??'.'),out=path.resolve(process.argv[3]??'artifacts/origen-r29/web-anexo');
const replay=process.argv.find(arg=>arg.startsWith('--replay='))?.slice(9),live=process.argv.includes('--openai');
assert.notEqual(Boolean(replay),live);
const mod=name=>import(pathToFileURL(path.join(root,name)));
const {startServer}=await mod('server/main.mjs'),{createIntakeGenerator}=await mod('server/intake-pilot.mjs');
const {originAnnexDirectory}=await mod('server/corpus/origin-annex.mjs');
const ref=originAnnexDirectory()[3],client='Talleres Caracola de Ensayo',title='Certificación de muestra';
const variant=process.argv.find(a=>a.startsWith('--caso='))?.slice(7);
assert.ok(!variant||['discrepancia','coincidencia'].includes(variant));
const local=process.argv.find(a=>a.startsWith('--propia='))?.slice(9);
assert.ok(!local||(!variant&&['coinciden','difieren','pendiente'].includes(local)));
const quantity=local==='coinciden'?31:local==='difieren'?47:'Sin verificar';
const folio=variant==='discrepancia'?'OCE-41857':variant?'OCE-63942':'ORP-61742';
const first=variant==='discrepancia'?'varios productores':'un solo productor';
const restored=local?['Hoja 1 · B2 | 31','Hoja 1 · B3 | '+quantity]:variant?['Hoja 1 · B2 | La certificación del folio '+folio+' declara '+first+'.','Hoja 1 · B3 | El registro del folio '+folio+' identifica un solo productor.']:['Hoja 1 · B2 | ORP-61742','Hoja 1 · B3 | Disponible a solicitud de la autoridad'];
async function ownMatrix(){
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Productores Nardo de Ensayo');
 sheet.addRows([['Documento','Cantidad'],['Certificación de origen',31],['Registro de productores',quantity],['Contacto reservado','almacen@nardo.invalid']]);
 return Buffer.from(await book.xlsx.writeBuffer());
}
const bytes=local?await ownMatrix():await readFile(path.join(root,variant?'piloto/certificacion-'+variant+'-ficticia.xlsx':'piloto/matriz-origen-ficticia.xlsx'));
const dir=await mkdtemp(path.join(tmpdir(),'rejon-origen-'));await mkdir(out,{recursive:true});
let preview,question,calls=0,app;
const generate=createIntakeGenerator({...(replay?{getApiKey:async()=>'sk-'+'x'.repeat(32)}:{}),fetchImpl:async(url,opts)=>{
 assert.equal(url,'https://api.openai.com/v1/chat/completions');const body=JSON.parse(opts.body);
 assert.ok(body.store===false&&body.messages.length===1&&body.messages[0].content===preview&&preview.includes(ref.text));
 if(variant){assert.ok(preview.includes('La certificación del folio [[PARTE_1]] declara '+first+'.'));assert.ok(preview.includes('El registro del folio [[PARTE_1]] identifica un solo productor.'));assert.ok(preview.includes(question.split(' conforme al numeral')[0].replace(folio,'[[PARTE_1]]')+'?'));}
 for(const term of [client,title,question,folio,'ORP-61742','Hoja 1 ·','Matriz Caracola','Origen ficticio',...restored])assert.ok(!opts.body.includes(term));
 if(local){assert.ok(preview.includes('Redacta las tres alternativas'));for(const term of ['31','47','almacen@nardo.invalid','Productores Nardo','Sin verificar'])assert.ok(!preview.includes(term),term);}
 const hash=createHash('sha256').update(opts.body).digest('hex');let response;
 if(live)response=await fetch(url,opts);
 else{const old=JSON.parse(await readFile(path.join(replay,'respuesta.json')));assert.equal(hash,old.hash);response=Response.json(old.response);}
 calls++;if(response.ok)await writeFile(path.join(out,'respuesta.json'),JSON.stringify({hash,preview,response:await response.clone().json()},null,2));
 return response;
}});
const start=()=>startServer({dataDir:dir,intakePilot:true,intakeGenerate:generate,autoInitialize:false,pilotPassphrase:Buffer.from('frase de ensayo del productor')});
const browser=await chromium.launch();
try{
 app=await start();const p=await browser.newPage({viewport:{width:1180,height:880},reducedMotion:'reduce'});p.setDefaultTimeout(35000);
 const external=[],errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(app.connection.url).origin)external.push(r.url());});
 const open=()=>p.goto(app.connection.url+'/#pilot=intake&token='+app.connection.token);
 const b=name=>p.getByRole('button',{name,exact:true});
 await open();await p.locator('#intake-firm').fill('Despacho de Ensayo');await b('Continuar').click();await p.locator('#intake-client').fill(client);await p.locator('#intake-title').fill(title);await b('Guardar en este equipo').click();
 await b('Documentos del expediente (0)').click();
 if(local==='pendiente'){
  let first=true;await p.route('**/api',async route=>{
   if(first&&route.request().postDataJSON()?.action==='intake.readerStatus'){first=false;await route.fulfill({json:{state:'missing'}});}
   else await route.continue();
  });
 }
 await b('Añadir documento').click();
 if(local==='pendiente'){await p.getByText('ollama pull qwen3.5:2b-q4_K_M',{exact:true}).waitFor();await b('Volver a comprobar el lector').click();}
 await p.getByText('Lector local instalado · Ollama disponible',{exact:true}).waitFor();await p.locator('input[type=file]').setInputFiles({name:'ensayo.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:bytes});
 await p.getByText(/Revisar protección local/).waitFor({timeout:125000});await p.getByLabel('Nombre en el expediente').fill('Matriz Caracola');await b('Guardar documento en este equipo').click();await b('Documentos del expediente (1)').waitFor();
 const [original]=await Promise.all([p.waitForEvent('download'),b('Descargar original .xlsx').click()]);assert.deepEqual(await readFile(await original.path()),bytes);
 await b('Biblioteca federal').click();await b('Origen T-MEC').click();const select=p.getByLabel('Elemento de la certificación');
 await select.selectOption('4');assert.equal(await select.locator('option').count(),9);const origin=p.getByRole('region',{name:'Certificación de origen del T-MEC'});
 const link=await origin.getByRole('link').getAttribute('href');const pdf=await p.request.get(new URL(link,app.connection.url).href);assert.equal(createHash('sha256').update(await pdf.body()).digest('hex'),ref.pdfSha256);
 for(const width of [320,390,768,1180]){await p.setViewportSize({width,height:880});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await origin.screenshot({path:path.join(out,'anexo.png')});if(variant){await b('Cerrar biblioteca').click();await b('Consultar productores').click();}else await b('Consultar este numeral').click();
 const ask=p.getByLabel('Pregunta del expediente');question=variant?await ask.inputValue():(await ask.inputValue()).replace('?',' en el folio ORP-61742?');await ask.fill(question);
 await b('Buscar fundamentos en este equipo').click();const candidate=p.getByLabel('Pasaje que quieres consultar');await candidate.waitFor({timeout:125000});assert.equal(await candidate.inputValue(),ref.sourceId+'/4');
 await b('Elegir líneas de mis documentos').click();const boxes=p.locator('.rp-line-options input[type=checkbox]');await boxes.nth(5).waitFor();await boxes.nth(3).check();await boxes.nth(5).check();
 await p.getByLabel('Enfoque jurídico').selectOption('documentos');
 if(local){
  const choose=p.getByLabel('Línea de la certificación',{exact:true});await choose.selectOption({index:1});
  for(const width of [320,390,768,1180]){await p.setViewportSize({width,height:880});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  const fieldset=p.locator('.rp-question-lines fieldset');
  assert.equal(await fieldset.evaluate(el=>getComputedStyle(el).animationName),'none');
  await p.emulateMedia({reducedMotion:'no-preference'});assert.equal(await fieldset.evaluate(el=>getComputedStyle(el).animationName),'rp-enter');
  await p.emulateMedia({reducedMotion:'reduce'});await p.locator('.rp-producer-comparison').screenshot({path:path.join(out,'cotejo.png')});await b('Preparar cotejo de cantidades').click();
 }else await b('Preparar mensaje para revisión').click();const proof=p.locator('.rp-proof').filter({has:p.getByRole('heading',{name:'Mensaje para OpenAI'})});
 const msg=proof.locator('.rp-preview').filter({hasText:ref.locator});await msg.waitFor({state:'attached'});const show=proof.getByText('Leer el mensaje completo');if(await show.isVisible())await show.click();await msg.waitFor();preview=await msg.innerText();
 if(variant){
  assert.ok(preview.includes('Hechos del ejercicio elegidos')&&preview.includes(question.split(' conforme al numeral')[0].replace(folio,'[[PARTE_1]]')+'?'),preview);
  await proof.screenshot({path:path.join(out,'envio.png')});
 }
 const [reply]=await Promise.all([p.waitForResponse(r=>r.url().endsWith('/api')&&r.request().postDataJSON()?.action==='intake.draft',{timeout:125000}),b('Enviar y generar borrador').click()]);assert.ok(reply.ok(),JSON.stringify(await reply.json()).slice(0,350));
 await b('Datos originales').click();const area=p.locator('.rp-document').filter({hasText:question});const draft=await area.innerText();
 for(const term of [question,'TMEC-5A-4',ref.text,local?'Comprobación propuesta por OpenAI':'Lectura preliminar de OpenAI',...restored])assert.ok(draft.includes(term),term);
 assert.ok(!draft.includes('Fundamento pendiente'));if(local){
  const record=JSON.parse(await readFile(path.join(out,'respuesta.json')));
  const options=JSON.parse(record.response.choices[0].message.content);
  assert.ok(draft.includes(options[local]),local);
  const finding={coinciden:'misma cantidad de productores',difieren:'cantidades que indican la certificación y el registro difieren',pendiente:'carece de una cantidad inequívoca'};
  assert.ok(draft.includes(finding[local]),local);
 }if(variant){
  const reading=draft.split('Lectura preliminar de OpenAI')[1].split('\n\n')[0];
  for(const term of [folio,'H1','H2'])assert.ok(reading.includes(term),reading);
  assert.match(reading,variant==='coincidencia'?/coincid|misma cantidad/iu:/discrep|difer/iu);
  assert.ok(!reading.includes('[[PARTE_'));
 }
 const task=await p.locator('#intake-task').inputValue();
 for(const [name,ext] of [['Word','docx'],['Excel','xlsx'],['PowerPoint','pptx']]){
  await b(name).click();const [download]=await Promise.all([p.waitForEvent('download'),b('Descargar .'+ext).click()]);await download.saveAs(path.join(out,'origen.'+ext));
 }
 await app.close();app=await start();await open();await p.locator('#intake-task').selectOption(task);await b('Datos originales').click();assert.equal(await area.innerText(),draft);
 assert.equal(calls,1);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);await writeFile(path.join(out,'resultado.json'),JSON.stringify({live,calls,local,variant,question,restored,draft,errors,external},null,2));console.log('Numeral 4, original Excel, dos celdas, tres exportaciones y reapertura verificados.');
}finally{await browser.close();await app?.close();await rm(dir,{recursive:true,force:true});}
