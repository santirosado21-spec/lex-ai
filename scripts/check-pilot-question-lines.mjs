// Verifies a mixed question through the browser and captures at most one real provider call.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
const root=path.resolve(process.argv.find(a=>a.startsWith('--app='))?.slice(6)??'.');
const linked=process.argv.includes('--pregunta-vinculada');
const live=process.argv.includes('--openai'),replay=process.argv.includes('--replay');
assert.ok(!(live&&replay));
const out=path.resolve(linked?'artifacts/dialogo-r23':'artifacts/privacidad-r17',root!==path.resolve('.')?'paquete':live?'openai':replay?'replay':'simulado');await mkdir(out,{recursive:true});
const {startServer}=await import(pathToFileURL(path.join(root,'server/main.mjs')));
const {createIntakeGenerator}=await import(pathToFileURL(path.join(root,'server/intake-pilot.mjs')));
const {customsPassage}=await import(pathToFileURL(path.join(root,'server/corpus/customs-edition.mjs')));
const bodyQuote=customsPassage('65').passages[1].quote,fixture=replay?JSON.parse(await readFile(linked?'fixtures/public-cases/pregunta-vinculada-r23.json':'fixtures/public-cases/porte-r17.json','utf8')):null;
const mock={lectura:'Los soportes de [[PARTE_1]] atribuyen el pago del flete a partes distintas y requieren cotejo con el recibo.',cita:bodyQuote,solicitud:'¿Qué comprobante permite identificar quién pagó el flete?'};
const privateItems=['CPV-904153','CTR-781259','Aceros Verbena','Bambú Coral','TUR-99286','DICTAMEN-LILA','Remisión privada del vivero','carta-porte-practica'];
let calls=0,preview='',receipt;
const generate=createIntakeGenerator({...(live?{}:{getApiKey:async()=>'sk-'+'l'.repeat(32)}),onReceipt:r=>{receipt=r;},fetchImpl:async(url,opts)=>{
 assert.equal(url,'https://api.openai.com/v1/chat/completions');assert.equal(++calls,1);
 const body=JSON.parse(opts.body);assert.equal(body.messages.length,1);assert.equal(body.messages[0].content,preview);assert.equal(body.store,false);
 for(const literal of privateItems)assert.ok(!opts.body.includes(literal));
 assert.match(preview,/comprador cubrió el flete/);assert.match(preview,/vendedor el pago del transporte/);
 const facts=preview.split('Hechos del ejercicio elegidos por el abogado\n')[1].split(' En la lectura vincula')[0];
 assert.equal((facts.match(/\[\[PARTE_1\]\]/gu)??[]).length,2);assert.doesNotMatch(facts,/H3|PARTE_2/);
 if(linked)assert.ok(preview.includes('Pregunta del abogado con referencias sustituidas\n¿Qué comprobante acredita quién pagó el flete de [[PARTE_1]]?'));
 const sha256=createHash('sha256').update(opts.body).digest('hex');
 if(fixture)assert.equal(sha256,fixture.sha256);
 if(live){
  const r=await fetch(url,opts);if(r.ok)await writeFile(path.join(out,'respuesta.json'),JSON.stringify({sha256,response:JSON.parse((await r.clone().json()).choices[0].message.content)},null,2));return r;
 }
 return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(fixture?.response??mock)}}]});
}});
let app;const dir=await mkdtemp(path.join(tmpdir(),'rejon-lineas-'));const browser=await chromium.launch();
const start=()=>startServer({intakePilot:true,intakeGenerate:generate,dataDir:dir,autoInitialize:false,pilotPassphrase:Buffer.from('expediente ficticio con documentos')});
try{
 app=await start();const p=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});p.setDefaultTimeout(20000);
 const errors=[],external=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(app.connection.url).origin)external.push(r.url());});
 const b=name=>p.getByRole('button',{name,exact:true}),open=()=>p.goto(app.connection.url+'/#pilot=intake&token='+app.connection.token);
 await open();await p.locator('#intake-firm').fill('Firma de Ensayo');await b('Continuar').click();
 await p.locator('#intake-client').fill('Bambú Coral Ficticio');await p.locator('#intake-title').fill('Ensayo transporte');await b('Guardar en este equipo').click();
 await b('Documentos del expediente (0)').click();
 const files=[['carta-porte-practica','Carta de porte'],['recibo-porte-practica','Recibo de transporte'],['personal','Nota del abogado']];
 for(const [i,[file,label]] of files.entries()){
  await b('Añadir documento').click();
  const localLines=['Remisión privada del vivero DICTAMEN-LILA. Se cotejó el folio TUR-99286.'];
  if(replay)localLines.push(...Array.from({length:13},(_,n)=>'Constancia ficticia de cotejo documental, posición '+(n+2)+'.'));
  const buffer=i<2?await readFile(path.join(root,'piloto',file+'.txt')):Buffer.from(localLines.join('\n'));
  await p.locator('input[type=file]').setInputFiles({name:file+'.txt',mimeType:'text/plain',buffer});
  await p.getByText(/Revisar protección local/).waitFor({timeout:125000});await p.getByLabel('Nombre en el expediente').fill(label);
  await b('Guardar documento en este equipo').click();await b('Documentos del expediente ('+(i+1)+')').waitFor();
 }
 await b('Documentos del expediente (3)').click();await b('Consultar con una pregunta propia').click();
 const question=linked?'¿Qué comprobante acredita quién pagó el flete de CPV-904153?':'¿Qué documento permite a Bambú Coral Ficticio acreditar el flete en el valor en aduana?';
 await p.getByLabel('Pregunta del expediente').fill(question);await b('Buscar fundamentos en este equipo').click();
 const source=p.getByLabel('Pasaje que quieres consultar');await source.waitFor({timeout:125000});await source.selectOption('aduana-65/1');
 await p.getByLabel('Enfoque jurídico').selectOption('documentos');await b('Elegir líneas de mis documentos').click();
 const group=p.locator('.rp-question-lines'),picker=group.getByRole('combobox');
 for(const [i,number] of [[0,3],[1,3],[2,1]]){
  await picker.selectOption({label:files[i][1]});
  const suffix=i<2?'OpenAI con sustituciones':'Sólo en este equipo';
  const choice=group.getByRole('checkbox',{name:new RegExp(files[i][1]+' · línea '+number+' · '+suffix,'u')});
  await choice.check();
  if(replay&&i===2){
   await b('Siguientes').click();
   await group.getByText('13–14 de 14').waitFor();
   assert.ok(await choice.isChecked());
   const last=group.getByRole('checkbox',{name:/Nota del abogado · línea 14 · Sólo en este equipo/u});
   await last.check();await b('Anteriores').click();assert.ok(await last.isChecked());
   await last.click();await last.waitFor({state:'detached'});
  }
 }
 for(const width of [320,390,768,1280]){await p.setViewportSize({width,height:900});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await group.screenshot({path:path.join(out,'lineas.png')});
 assert.equal(calls,0);await b('Preparar mensaje para revisión').click();await p.getByText('Leer el mensaje completo',{exact:true}).click();
 preview=await p.locator('.rp-proof .rp-preview').innerText();const task=await p.locator('#intake-task').inputValue();
 if(linked){
  const explanation=p.locator('.rp-outgoing-question');
  await explanation.waitFor();assert.ok((await explanation.innerText()).includes('¿Qué comprobante acredita quién pagó el flete'));
  await p.locator('.rp-proof').filter({has:explanation}).screenshot({path:path.join(out,'pregunta-para-openai.png')});
 }
 await b('Enviar y generar borrador').click();await b('Datos originales').waitFor({timeout:65000});
 const masked=await p.locator('.rp-document').innerText();assert.ok(masked.includes('Lectura preliminar de OpenAI'));
 await b('Datos originales').click();let note=p.locator('.rp-document');await note.filter({hasText:'DICTAMEN-LILA'}).waitFor();
 const restored=await note.innerText();assert.ok(restored.includes('CPV-904153')&&restored.includes('TUR-99286')&&!restored.includes('[['));
 if(linked&&replay){
  assert.ok(restored.includes(question)&&restored.includes('H1 · Documento 1')&&restored.includes('H2 · Documento 2'));
  assert.ok(restored.includes('Pregunta de cotejo del despacho')&&!restored.includes('quien pago el flete de PARTE'));
 }
 const returnedAlias=restored.split('Lectura preliminar de OpenAI\n')[1].split('\n\n')[0].includes('CPV-904153');
 assert.ok(returnedAlias);
 for(const [label,ext] of [['Word','docx'],['Excel','xlsx'],['PowerPoint','pptx']]){
  await b(label).click();const d=p.waitForEvent('download');await b('Descargar .'+ext).click();await(await d).saveAs(path.join(out,'nota.'+ext));
 }
 await app.close();app=await start();await open();await p.locator('#intake-task').selectOption(task);
 await b('Datos originales').click();await p.locator('.rp-document').filter({hasText:'DICTAMEN-LILA'}).waitFor();
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.equal(calls,1);
 await writeFile(path.join(out,'resultado.json'),JSON.stringify({real:live,replay,receipt,returnedAlias,externalBrowserRequests:0,restored},null,2));
 console.log({calls,returnedAlias,restoredThreeSupports:true});
}finally{await browser.close();await app?.close();await rm(dir,{recursive:true,force:true});}
