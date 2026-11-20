// Run from the development checkout against either the checkout or an unpacked pilot.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
const root=path.resolve(process.argv[2]??'.'),out=path.resolve(process.argv[3]??'artifacts/origen-r29/web-anexo');
const replay=process.argv.find(arg=>arg.startsWith('--replay='))?.slice(9),live=process.argv.includes('--openai');
assert.notEqual(Boolean(replay),live);
const mod=name=>import(pathToFileURL(path.join(root,name)));
const {startServer}=await mod('server/main.mjs'),{createIntakeGenerator}=await mod('server/intake-pilot.mjs');
const {originAnnexDirectory}=await mod('server/corpus/origin-annex.mjs');
const ref=originAnnexDirectory()[3],client='Talleres Caracola de Ensayo',title='Certificación de muestra';
const restored=['Hoja 1 · B2 | ORP-61742','Hoja 1 · B3 | Disponible a solicitud de la autoridad'];
const bytes=await readFile(path.join(root,'piloto/matriz-origen-ficticia.xlsx'));
const dir=await mkdtemp(path.join(tmpdir(),'rejon-origen-'));await mkdir(out,{recursive:true});
let preview,question,calls=0,app;
const generate=createIntakeGenerator({...(replay?{getApiKey:async()=>'sk-'+'x'.repeat(32)}:{}),fetchImpl:async(url,opts)=>{
 assert.equal(url,'https://api.openai.com/v1/chat/completions');const body=JSON.parse(opts.body);
 assert.ok(body.store===false&&body.messages.length===1&&body.messages[0].content===preview&&preview.includes(ref.text));
 for(const term of [client,title,question,'ORP-61742','Hoja 1 ·','Matriz Caracola','Origen ficticio',...restored])assert.ok(!opts.body.includes(term));
 const hash=createHash('sha256').update(opts.body).digest('hex');let response;
 if(live)response=await fetch(url,opts);
 else{const old=JSON.parse(await readFile(path.join(replay,'respuesta.json')));assert.equal(hash,old.hash);response=Response.json(old.response);}
 calls++;if(response.ok)await writeFile(path.join(out,'respuesta.json'),JSON.stringify({hash,response:await response.clone().json()},null,2));
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
 await b('Documentos del expediente (0)').click();await b('Añadir documento').click();await p.locator('input[type=file]').setInputFiles({name:'ensayo.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:bytes});
 await p.getByText(/Revisar protección local/).waitFor({timeout:125000});await p.getByLabel('Nombre en el expediente').fill('Matriz Caracola');await b('Guardar documento en este equipo').click();await b('Documentos del expediente (1)').waitFor();
 const [original]=await Promise.all([p.waitForEvent('download'),b('Descargar original .xlsx').click()]);assert.deepEqual(await readFile(await original.path()),bytes);
 await b('Biblioteca federal').click();await b('Origen T-MEC').click();const select=p.getByLabel('Elemento de la certificación');
 await select.selectOption('4');assert.equal(await select.locator('option').count(),9);const origin=p.getByRole('region',{name:'Certificación de origen del T-MEC'});
 const link=await origin.getByRole('link').getAttribute('href');const pdf=await p.request.get(new URL(link,app.connection.url).href);assert.equal(createHash('sha256').update(await pdf.body()).digest('hex'),ref.pdfSha256);
 for(const width of [320,390,768,1180]){await p.setViewportSize({width,height:880});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await origin.screenshot({path:path.join(out,'anexo.png')});await b('Consultar este numeral').click();
 const ask=p.getByLabel('Pregunta del expediente');question=(await ask.inputValue()).replace('?',' en el folio ORP-61742?');await ask.fill(question);
 await b('Buscar fundamentos en este equipo').click();const candidate=p.getByLabel('Pasaje que quieres consultar');await candidate.waitFor({timeout:125000});assert.equal(await candidate.inputValue(),ref.sourceId+'/4');
 await b('Elegir líneas de mis documentos').click();const boxes=p.locator('.rp-line-options input[type=checkbox]');await boxes.nth(5).waitFor();await boxes.nth(3).check();await boxes.nth(5).check();
 await p.getByLabel('Enfoque jurídico').selectOption('documentos');await b('Preparar mensaje para revisión').click();const proof=p.locator('.rp-proof').filter({has:p.getByRole('heading',{name:'Mensaje para OpenAI'})});
 const msg=proof.locator('.rp-preview').filter({hasText:ref.locator});await msg.waitFor({state:'attached'});const show=proof.getByText('Leer el mensaje completo');if(await show.isVisible())await show.click();await msg.waitFor();preview=await msg.innerText();
 const [reply]=await Promise.all([p.waitForResponse(r=>r.url().endsWith('/api')&&r.request().postDataJSON()?.action==='intake.draft',{timeout:125000}),b('Enviar y generar borrador').click()]);assert.ok(reply.ok(),JSON.stringify(await reply.json()).slice(0,350));
 await b('Datos originales').click();const area=p.locator('.rp-document').filter({hasText:question});const draft=await area.innerText();
 for(const term of [question,'TMEC-5A-4',ref.text,'Lectura preliminar de OpenAI',...restored])assert.ok(draft.includes(term),term);
 assert.ok(!draft.includes('Fundamento pendiente'));const task=await p.locator('#intake-task').inputValue();
 for(const [name,ext] of [['Word','docx'],['Excel','xlsx'],['PowerPoint','pptx']]){
  await b(name).click();const [download]=await Promise.all([p.waitForEvent('download'),b('Descargar .'+ext).click()]);await download.saveAs(path.join(out,'origen.'+ext));
 }
 await app.close();app=await start();await open();await p.locator('#intake-task').selectOption(task);await b('Datos originales').click();assert.equal(await area.innerText(),draft);
 assert.equal(calls,1);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);await writeFile(path.join(out,'resultado.json'),JSON.stringify({live,calls,question,restored,draft,errors,external},null,2));console.log('Numeral 4, original Excel, dos celdas, tres exportaciones y reapertura verificados.');
}finally{await browser.close();await app?.close();await rm(dir,{recursive:true,force:true});}
