// Private, synthetic acceptance exercise against the specified local build.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

const root=path.resolve(process.argv[2]??'.');
const out=path.resolve(process.argv[3]??'artifacts/retorno-r24/zip');
const mod=name=>import(pathToFileURL(path.join(root,name)));
const {startServer}=await mod('server/main.mjs');
const {customsPassage}=await mod('server/corpus/customs-edition.mjs');
const {createIntakeGenerator}=await mod('server/intake-pilot.mjs');
const repair=customsPassage('117').passages[1],replacement=customsPassage('97').passages[1];
const firm='Despacho de Prueba Ceiba',client='Cliente de Prueba Coral',title='Ejercicio de devolución';
const reserve=process.argv.includes('--reservar');
const term='luz de ciruela';
const baseQuestion='¿Qué documentos permiten distinguir el retorno de una mercancía exportada para reparación de la sustitución de un bien previamente importado por resultar defectuoso?';
const question=baseQuestion+(reserve?' El primer soporte dice '+term+' y el segundo dice '+term+'.':'');
const replies=[
 {cita:repair.quote.slice(0,107),segundaCita:replacement.quote,lectura:'La reparación exige identificar los servicios prestados en el extranjero. La sustitución requiere cotejar la importación previa y la clase de la mercancía.',solicitud:'¿Qué documento identifica la mercancía sustituta?'},
 {acciones:['Comparar los documentos de importación con la descripción de la mercancía sustituta.','Verificar qué servicios se prestaron en el extranjero.']},
];
let count=0;
const live=process.argv.includes('--openai');
const replay=process.argv.find(arg=>arg.startsWith('--replay='))?.slice(9);
assert.ok(!(live&&replay));
const seen=[],external=[],receipts=[];
const generator=createIntakeGenerator({...(live?{}:{getApiKey:async()=>'sk-'+'s'.repeat(32)}),onReceipt:r=>receipts.push(r),fetchImpl:async(url,opts)=>{
 assert.equal(url,'https://api.openai.com/v1/chat/completions');
 const body=JSON.parse(opts.body);
 for(const word of [firm,client,title,question,term])assert.ok(!opts.body.includes(word));
 for(const word of [repair.quote,repair.condition,replacement.quote,replacement.condition])assert.ok(body.messages[0].content.includes(word));
 assert.equal(body.store,false);
 const fallback=replies[count++];assert.ok(fallback);
 if(live){
  const response=await fetch(url,opts);
  if(response.ok){
   const data=await response.clone().json();
   await writeFile(path.join(out,'respuesta-'+count+'.json'),JSON.stringify({reply:data.choices[0].message.content,usage:data.usage},null,2));
  }
  return response;
 }
 const content=replay?JSON.parse(await readFile(path.join(replay,'respuesta-'+count+'.json'),'utf8')).reply:JSON.stringify(fallback);
 return Response.json({choices:[{finish_reason:'stop',message:{content}}]});
}});
await mkdir(out,{recursive:true});
const dataDir=await mkdtemp(path.join(tmpdir(),'rejon-retornos-'));
const start=()=>startServer({dataDir,intakePilot:true,intakeGenerate:generator,autoInitialize:false,pilotPassphrase:Buffer.from('frase sintetica del ejercicio')});
const browser=await chromium.launch();
let app;
try{
 app=await start();
 const p=await browser.newPage({reducedMotion:'reduce',viewport:{width:1280,height:900}});
 const open=()=>p.goto(app.connection.url+'/#pilot=intake&token='+app.connection.token);
 const b=name=>p.getByRole('button',{name,exact:true});
 p.on('pageerror',e=>seen.push(e.message));
 p.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(app.connection.url).origin)external.push(r.url());});
 await open();await b('Biblioteca federal').click();await b('Ley Aduanera').click();
 const menu=p.getByLabel('Artículo de la Ley Aduanera');
 await menu.selectOption('137-BIS-9');assert.equal(await menu.locator('option').count(),277);
 const panel=p.locator('[aria-labelledby="rp-customs-title"]');
 assert.equal(await panel.evaluate(el=>getComputedStyle(el).animationName),'none');
 await p.emulateMedia({reducedMotion:'no-preference'});
 assert.equal(await panel.evaluate(el=>getComputedStyle(el).animationName),'rp-enter');
 await p.emulateMedia({reducedMotion:'reduce'});
 await menu.selectOption('117');await p.getByText('párrafo segundo · pp. 79–80',{exact:true}).click();
 await p.getByText(repair.quote,{exact:true}).waitFor();
 const href=await p.getByRole('link',{name:'Abrir página 79 en la copia local'}).getAttribute('href');
 assert.ok(href.endsWith('.pdf#page=79'));const pdf=await p.request.get(new URL(href,app.connection.url).href);
 assert.ok(pdf.ok());assert.deepEqual(await pdf.body(),await readFile(path.join(root,'resources/trade/ley-aduanera-2025.pdf')));
 for(const width of [320,390,768,1280]){
  await p.setViewportSize({width,height:900});
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'ancho '+width);
 }
 await p.locator('#rp-law-library').screenshot({path:path.join(out,'biblioteca.png')});
 await b('Cerrar biblioteca').click();await p.locator('#intake-firm').fill(firm);await b('Continuar').click();
 await p.locator('#intake-client').fill(client);await p.locator('#intake-title').fill(title);await b('Guardar en este equipo').click();
 await b('Consultar con una pregunta propia').click();const input=p.getByLabel('Pregunta del expediente');await input.fill(question);
 if(reserve){
  await p.getByText('Reservar datos de esta pregunta',{exact:true}).click();
  await input.focus();
  await input.evaluate((el,term)=>el.setSelectionRange(el.value.indexOf(term),el.value.indexOf(term)+term.length),term);
  await b('Reservar selección').click();
  await b('Quitar '+term).waitFor();
  await input.fill(baseQuestion);
  assert.ok(await b('Buscar fundamentos en este equipo').isDisabled());
  await input.fill(question);
 }
 await b('Buscar fundamentos en este equipo').click();
 const first=p.getByLabel('Pasaje que quieres consultar');await first.waitFor({timeout:125000});
 if(reserve){
  const preview=p.locator('details').filter({has:p.locator('summary').filter({hasText:'Pregunta con sustituciones locales'})});
  await preview.locator('summary').click();
  assert.ok(!(await preview.locator('p').first().innerText()).includes(term));
  for(const width of [320,390,768,1280]){await p.setViewportSize({width,height:900});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await p.locator('.rp-question').screenshot({path:path.join(out,'reserva.png')});
 }
 const results=await first.locator('option').evaluateAll(rows=>rows.map(row=>row.value));
 assert.deepEqual(new Set(results.slice(0,2)),new Set(['aduana-97/1','aduana-117/1']));
 await first.selectOption('aduana-117/1');await p.getByLabel('Segundo fundamento').selectOption('aduana-97/1');
 await b('Preparar mensaje para revisión').click();
 const drafts=[];
 for(const basename of ['nota','lista']){
  if(basename==='lista')await b('Preparar lista de cotejo').click();
  const waiting=p.waitForResponse(r=>r.url().endsWith('/api')&&r.request().postDataJSON()?.action==='intake.draft');
  await b('Enviar y generar borrador').click();const response=await waiting;assert.ok(response.ok(),JSON.stringify(await response.json()).slice(0,250));
  await b('Datos originales').click();const content=await p.locator('.rp-document').filter({hasText:question}).innerText();
  for(const text of [client,title,repair.quote,repair.condition,replacement.quote,replacement.condition,'MX-FED-LADUA-97','MX-FED-LADUA-117'])assert.ok(content.includes(text),text);
  drafts.push({task:await p.locator('#intake-task').inputValue(),content});
  for(const [label,ext] of [['Word','docx'],['Excel','xlsx'],['PowerPoint','pptx']]){
   await b(label).click();const download=p.waitForEvent('download');await b('Descargar .'+ext).click();await(await download).saveAs(path.join(out,basename+'.'+ext));
  }
 }
 await app.close();app=await start();await open();
 for(const draft of drafts){
  await p.locator('#intake-task').selectOption(draft.task);await b('Datos originales').click();
  assert.equal(await p.locator('.rp-document').filter({hasText:question}).innerText(),draft.content);
 }
 assert.equal(count,2);assert.deepEqual(external,[]);assert.deepEqual(seen,[]);
 await writeFile(path.join(out,'resultado.json'),JSON.stringify({results,realRequests:live?count:0,replayedRequests:replay?count:0,mockedRequests:live||replay?0:count,receipts,external,errors:seen,drafts},null,2));
 console.log('Directorio, PDF, consulta con dos fuentes, seis archivos y dos reaperturas verificados.');
}finally{await browser.close();await app?.close();await rm(dataDir,{recursive:true,force:true});}
