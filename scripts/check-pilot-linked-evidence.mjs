// Exercise the browser and the same bounded cloud generator used by the private pilot.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

const root=path.resolve(process.argv[2]??'.'),out=path.resolve(process.argv[3]??'artifacts/contexto-r26/simulado');
const resume=process.argv.find(s=>s.startsWith('--continuar='))?.slice(12);
const reservations=process.argv.includes('--reservas');
const live=process.argv.includes('--openai'),replay=process.argv.find(s=>s.startsWith('--replay='))?.slice(9);
assert.ok(!(live&&replay)&&(!resume||live));
const mod=file=>import(pathToFileURL(path.join(root,file)));
const {startServer}=await mod('server/main.mjs'),{createIntakeGenerator}=await mod('server/intake-pilot.mjs');
const {customsPassage}=await mod('server/corpus/customs-edition.mjs');
const fixture=JSON.parse(await readFile('eval/privacy-trade/dialogo-inspeccion-r25.json','utf8'));
const [order,report,,follow]=fixture.entries;
for(const [filename,row] of [['orden-inspeccion-ficticia',order],['parte-inspeccion-ficticia',report]]){
 assert.equal((await readFile(path.join(root,'piloto',filename+'.txt'),'utf8')).trimEnd(),row.text);
}
const title='Comprobación Azafrán',firm='Despacho Nacarado de Ensayo',q=follow.text;
const work=report.text.split('\n')[2],abroad=order.text.split('\n')[2],labels=['Salida Malva','Taller Malva','Salida de otro equipo'];
const expected=[abroad,work];
const passage=customsPassage('117').passages[0].quote;
const replies=[{cita:passage.slice(0,109),lectura:'Conviene cotejar las características de salida y retorno y el informe del taller para saber si se intervino el mismo bien.',solicitud:'¿Qué documento permite comparar la identidad del equipo?'},
 {acciones:['Cotejar los datos de salida y retorno del bien intervenido.','Revisar el informe de servicio para distinguir un cambio de pieza.']}];
await mkdir(out,{recursive:true});
let count=0,realCalls=0,replays=0,preview='';
const receipts=[],errors=[],external=[];
const generator=createIntakeGenerator({...(live?{}:{getApiKey:async()=>'sk-'+'s'.repeat(32)}),onReceipt:r=>receipts.push(r),fetchImpl:async(url,opts)=>{
 try{
 assert.equal(url,'https://api.openai.com/v1/chat/completions');
 const body=JSON.parse(opts.body),message=body.messages[0].content;
 assert.equal(message,preview);assert.equal(body.store,false);
 for(const term of [q,firm,fixture.client,title,...labels,...expected,'VQA-70246','TRQ-64021','OV-30333','espirales de esparto','abanico frente a'])assert.ok(!opts.body.includes(term),term);
 assert.ok(message.includes(passage));if(!count)assert.ok(message.includes('cambiar una pieza'));
 const index=count++,hash=createHash('sha256').update(opts.body).digest('hex');
 let record;
 if(replay||resume&&index===0){replays++;record=JSON.parse(await readFile(path.join(replay??resume,'respuesta-'+index+'.json'),'utf8'));assert.equal(hash,record.hash);}
 if(live&&!record)realCalls++;
 const answer=live&&!record?await fetch(url,opts):Response.json({choices:[{finish_reason:'stop',message:{content:record?.answer??JSON.stringify(replies[index])}}]});
 if(answer.ok){const data=await answer.clone().json();await writeFile(path.join(out,'respuesta-'+index+'.json'),JSON.stringify({hash,answer:data.choices[0].message.content,usage:data.usage??record?.usage??null},null,2));}
 return answer;
 }catch(e){console.error(e);throw e;}
}});
const dataDir=await mkdtemp(path.join(tmpdir(),'rejon-contexto-'));
const start=()=>startServer({dataDir,intakePilot:true,intakeGenerate:generator,autoInitialize:false,pilotPassphrase:Buffer.from('prueba de soportes del expediente')});
const browser=await chromium.launch();let app;
try{
 app=await start();const p=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});
 const open=()=>p.goto(app.connection.url+'/#pilot=intake&token='+app.connection.token);
 const b=name=>p.getByRole('button',{name,exact:true});
 p.setDefaultTimeout(35000);p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(app.connection.url).origin)external.push(r.url());});
 await open();await b('Biblioteca federal').click();await b('Reglamento aduanero').click();
 const regulation=p.getByLabel('Artículo del Reglamento de la Ley Aduanera');
 await regulation.selectOption('174');assert.equal(await regulation.locator('option').count(),282);
 const regSection=p.getByRole('region',{name:'Reglamento de la Ley Aduanera'});
 await regSection.locator('summary').click();await regSection.getByText(/hayan efectuado importaciones temporales/).waitFor();
 const edition=await regSection.getByRole('link',{name:/Abrir página/}).getAttribute('href');
 const pdf=await p.request.get(new URL(edition,app.connection.url).href);
 assert.equal(createHash('sha256').update(await pdf.body()).digest('hex'),'bcdfcd9073014aec4aefbacc01c9dd5b1f97f0da0c4556f0f506d20f12d77812');
 await regSection.screenshot({path:path.join(out,'reglamento.png')});
 await b('Cerrar biblioteca').click();await p.locator('#intake-firm').fill(firm);await b('Continuar').click();await p.locator('#intake-client').fill(fixture.client);await p.locator('#intake-title').fill(title);await b('Guardar en este equipo').click();await b('Documentos del expediente (0)').click();
 for(const [i,text] of [order.text,report.text,'Orden de retorno: OV-30333\nLa reparación fue nacional.'].entries()){
  await b('Añadir documento').click();await p.locator('input[type=file]').setInputFiles({name:'ensayo.txt',mimeType:'text/plain',buffer:Buffer.from(text)});
  await p.getByText(/Revisar protección local/).waitFor({timeout:125000});await p.getByLabel('Nombre en el expediente').fill(labels[i]);await b('Guardar documento en este equipo').click();
  await b('Documentos del expediente ('+(i+1)+')').waitFor();
 }
 if(reservations){
  await b('Reservas del expediente (0)').click();
  await p.getByLabel('Expresión que quieres reservar').fill('ESPIRALES DE ESPARTO');
  await b('Guardar reserva').click();await b('Quitar reserva de ESPIRALES DE ESPARTO').waitFor();
  await b('Reservas del expediente (1)').click();
 }
 await b('Consultar con una pregunta propia').click();await p.getByLabel('Pregunta del expediente').fill(q);await b('Buscar fundamentos en este equipo').click();
 const region=p.getByRole('region',{name:'Contexto del expediente'});
 const boxes=region.getByRole('checkbox');await boxes.first().waitFor({timeout:125000});
 assert.equal(await boxes.count(),2);
 assert.ok(!(await region.innerText()).includes(labels[2]));
 const primary=p.getByLabel('Pasaje que quieres consultar');assert.ok((await primary.inputValue()).startsWith('aduana-117/'));
 for(const box of await boxes.all())await box.check();
 const refined=p.waitForResponse(r=>r.url().endsWith('/api')&&r.request().postDataJSON()?.action==='intake.refineQuestion');
 await b('Buscar fundamentos con las líneas elegidas').click();assert.ok((await refined).ok());
 await primary.selectOption('aduana-117/0');
 for(const w of [320,390,768,1280]){await p.setViewportSize({width:w,height:900});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 assert.equal(await p.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true);
 assert.equal(await region.evaluate(el=>getComputedStyle(el).animationName),'none');
 await b('Ver líneas originales en este equipo').click();
 for(const line of expected)await region.getByText(line,{exact:true}).waitFor();
 await region.screenshot({path:path.join(out,'soportes.png')});
 await b('Volver a ver las sustituciones').click();
 await b('Preparar mensaje para revisión').click();const drafts=[];
 if(reservations){
  await b('Reservas del expediente (1)').click();
  await p.getByLabel('Expresión que quieres reservar').fill('TERRITORIO NACIÓNAL');
  await b('Guardar reserva').click();await p.getByText('El mensaje contiene una expresión reservada.',{exact:false}).waitFor();
  assert.ok(await b('Enviar y generar borrador').isDisabled());assert.equal(count,0);
  await p.getByRole('button',{name:'Reservas del expediente (2)'}).locator('..').screenshot({path:path.join(out,'reservas.png')});
  await b('Quitar reserva de TERRITORIO NACIÓNAL').click();await b('Reservas del expediente (1)').waitFor();
  await b('Reservas del expediente (1)').click();
 }
 for(const name of ['nota','lista']){
  if(name==='lista')await b('Preparar lista de cotejo').click();
  const proof=p.locator('.rp-proof').filter({has:p.getByRole('heading',{name:'Mensaje para OpenAI'})});
  const message=proof.locator('.rp-preview').filter({hasText:name==='nota'?'cambiar una pieza':'Continúa el trabajo'});
  await message.waitFor({state:'attached'});const show=proof.getByText('Leer el mensaje completo');if(await show.isVisible())await show.click();
  await message.waitFor();preview=await message.innerText();
  const waiting=p.waitForResponse(r=>r.url().endsWith('/api')&&r.request().postDataJSON()?.action==='intake.draft',{timeout:125000});
  await b('Enviar y generar borrador').click();const res=await waiting;assert.ok(res.ok(),JSON.stringify(await res.json()).slice(0,200));
  await b('Datos originales').click();const content=await p.locator('.rp-document').filter({hasText:q}).innerText();
  for(const term of [fixture.client,title,...expected,...labels.slice(0,2),'MX-FED-LADUA-117'])assert.ok(content.includes(term),term);
  assert.ok(!content.includes(labels[2])&&!content.includes('Fundamento pendiente'));drafts.push({id:await p.locator('#intake-task').inputValue(),content});
  for(const [label,ext] of [['Word','docx'],['Excel','xlsx'],['PowerPoint','pptx']]){
   await b(label).click();const dl=p.waitForEvent('download');await b('Descargar .'+ext).click();await(await dl).saveAs(path.join(out,name+'.'+ext));
  }
 }
 await app.close();app=await start();await open();
 if(reservations){
  await b('Reservas del expediente (1)').click();await b('Quitar reserva de ESPIRALES DE ESPARTO').waitFor();
 }
 for(const draft of drafts){await p.locator('#intake-task').selectOption(draft.id);await b('Datos originales').click();assert.equal(await p.locator('.rp-document').filter({hasText:q}).innerText(),draft.content);}
 assert.equal(count,2);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 await writeFile(path.join(out,'resultado.json'),JSON.stringify({real:realCalls,replay:replays,simulated:!live&&!replay?count:0,receipts,errors,external,drafts},null,2));
 console.log('Tres documentos, dos soportes vinculados, dos borradores restituidos y seis archivos.');
}finally{await browser.close();await app?.close();await rm(dataDir,{recursive:true,force:true});}
