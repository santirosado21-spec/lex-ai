// Exercise the normal browser workflow with the two published synthetic trade documents.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
const opt=(name,defaultValue)=>process.argv.find(s=>s.startsWith(name))?.slice(name.length)??defaultValue;
const root=path.resolve(opt('--app=','.')),out=path.resolve(opt('--out=','artifacts/consulta-r22/simulado'));
const live=process.argv.includes('--openai'),replay=opt('--replay=','');
assert.ok(!live||!replay);
const previous=opt('--continuar=','');
assert.ok(!previous||live&&!replay);
const referenceFile=replay||previous;
const reference=referenceFile?JSON.parse(await readFile(referenceFile,'utf8')):null;
let realCalls=0;
const mod=name=>import(pathToFileURL(path.join(root,name)));
const {startServer}=await mod('server/main.mjs'),{createIntakeGenerator}=await mod('server/intake-pilot.mjs');
const {customsPassage}=await mod('server/corpus/customs-edition.mjs');
const first=customsPassage('65').passages[1],second=customsPassage('64').passages[2];
const synthetic=[
 {cita:first.quote.slice(0,86),segundaCita:second.quote.slice(0,72),lectura:'La factura y el contrato difieren sobre la inclusión del flete en el precio pagado. Debe cotejarse quién lo cubrió y si ya se incluyó.',solicitud:'¿Qué comprobante aclara quién cubrió el transporte?'},
 {acciones:['Comparar las condiciones de la factura con el contrato de compraventa.','Verificar si el comprobante identifica quién asumió el gasto de transporte.']},
];
const question='¿Qué documentos permiten cotejar el precio pagado y el flete del lote TVR-61488?';
const firm='Estudio Dátil de Ensayo',client='Importadora Lirio de Ensayo',title='Revisión Salvia',docs=['Factura de muestra','Contrato de muestra'];
const receipts=[],records=[],external=[],errors=[];
let preview;
await mkdir(out,{recursive:true});
const generate=createIntakeGenerator({...(live?{}:{getApiKey:async()=>'sk-'+'k'.repeat(35)}),onReceipt:r=>receipts.push(r),fetchImpl:async(url,opts)=>{
 try{
 const index=records.length;assert.ok(index<2);assert.equal(url,'https://api.openai.com/v1/chat/completions');
 const body=JSON.parse(opts.body);assert.equal(body.store,false);assert.equal(body.messages.length,1);assert.equal(body.messages[0].content,preview);
 for(const v of [firm,client,title,question,'TVR-61488','FM-38214','CT-41726','625.30','4200','Níquel',...docs])assert.ok(!opts.body.includes(v),v);
 for(const v of [first.condition,'El precio pagado incluye el flete.','El precio pagado no incluye el flete.'])assert.ok(preview.includes(v),v);
 const sha256=createHash('sha256').update(opts.body).digest('hex');
 const recorded=reference?.[index];
 if(replay)assert.ok(recorded);
 if(recorded)assert.equal(sha256,recorded.sha256);
 const send=live&&!recorded;
 if(send)realCalls++;
 const response=send?await fetch(url,opts):Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(recorded?.reply??synthetic[index])}}]});
 if(response.ok){
  const data=await response.clone().json();
  records.push({sha256,reply:JSON.parse(data.choices[0].message.content),usage:data.usage??recorded?.usage??null});
  await writeFile(path.join(out,'respuestas.json'),JSON.stringify(records,null,2));
 }
 return response;
 }catch(error){console.error(error);throw error;}
}});
const dir=await mkdtemp(path.join(tmpdir(),'rejon-cotejo-')),browser=await chromium.launch();
const start=()=>startServer({intakePilot:true,intakeGenerate:generate,autoInitialize:false,dataDir:dir,pilotPassphrase:Buffer.from('ensayo sintetico de dos fundamentos')});
let app;
try{
 app=await start();const p=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});p.setDefaultTimeout(25000);
 const open=()=>p.goto(app.connection.url+'/#pilot=intake&token='+app.connection.token);
 p.on('request',r=>{if(/^https?:/u.test(r.url())&&new URL(r.url()).origin!==new URL(app.connection.url).origin)external.push(r.url());});
 p.on('pageerror',e=>errors.push(e.message));
 const b=name=>p.getByRole('button',{name,exact:true});
 async function generateAndRead(expected){
  const proof=p.locator('.rp-proof').filter({has:p.getByRole('heading',{name:'Mensaje para OpenAI'})});
  await proof.locator('.rp-preview').filter({hasText:expected}).waitFor({state:'attached'});
  const show=proof.getByText('Leer el mensaje completo');if(await show.isVisible())await show.click();
  const message=proof.locator('.rp-preview').filter({hasText:expected});await message.waitFor();preview=await message.innerText();
  const waiting=p.waitForResponse(r=>r.url().endsWith('/api')&&r.request().postDataJSON()?.action==='intake.draft',{timeout:125000});
  await b('Enviar y generar borrador').click();const result=await waiting;
  assert.ok(result.ok(),(await result.json()).error);
  await b('Datos originales').click();
  const content=await p.locator('.rp-document').filter({hasText:question}).innerText();
  for(const term of [first.condition,second.quote,'FM-38214','CT-41726','MX-FED-LADUA-64','MX-FED-LADUA-65'])assert.ok(content.includes(term),term);
  assert.ok(!content.includes('Fundamento pendiente.'));
  return {id:await p.locator('#intake-task').inputValue(),content};
 }
 async function exports(stem){
  for(const [label,ext] of [['Word','docx'],['Excel','xlsx'],['PowerPoint','pptx']]){
   await b(label).click();const waiting=p.waitForEvent('download');await b('Descargar .'+ext).click();await(await waiting).saveAs(path.join(out,stem+'.'+ext));
  }
 }
 await open();await p.locator('#intake-firm').fill(firm);await b('Continuar').click();
 await p.locator('#intake-client').fill(client);await p.locator('#intake-title').fill(title);await b('Guardar en este equipo').click();
 await b('Documentos del expediente (0)').click();
 for(const [i,file] of ['factura-cotejo-ficticia.txt','contrato-cotejo-ficticio.txt'].entries()){
  await b('Añadir documento').click();await p.locator('input[type=file]').setInputFiles(path.join(root,'piloto',file));
  await p.getByText(/Revisar protección local/).waitFor({timeout:125000});await p.getByLabel('Nombre en el expediente').fill(docs[i]);
  await b('Guardar documento en este equipo').click();await b('Documentos del expediente ('+(i+1)+')').waitFor();
 }
 await b('Consultar con una pregunta propia').click();await p.getByLabel('Pregunta del expediente').fill(question);
 await b('Buscar fundamentos en este equipo').click();const primary=p.getByLabel('Pasaje que quieres consultar');await primary.waitFor({timeout:125000});
 await primary.selectOption('aduana-65/1');await p.getByLabel('Segundo fundamento').selectOption('aduana-64/2');
 await p.getByText('Leer el segundo fundamento',{exact:true}).click();
 for(const fact of ['El precio pagado incluye el flete.','El precio pagado no incluye el flete.'])await p.getByRole('checkbox',{name:new RegExp(fact)}).check();
 for(const width of [320,390,768,1280]){await p.setViewportSize({width,height:900});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Ancho '+width);}
 await p.locator('.rp-question').screenshot({path:path.join(out,'pregunta.png')});
 await b('Preparar mensaje para revisión').click();const parent=await generateAndRead('Relaciona dos fundamentos');assert.ok(parent.content.includes('Lectura preliminar de OpenAI'));await exports('nota');
 await b('Preparar lista de cotejo').click();const child=await generateAndRead('Continúa el trabajo');await exports('lista');
 await app.close();app=await start();await open();
 for(const item of [parent,child]){
  await p.locator('#intake-task').selectOption(item.id);await b('Datos originales').click();
  assert.equal(await p.locator('.rp-document').filter({hasText:question}).innerText(),item.content);
 }
 assert.equal(records.length,2);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 await writeFile(path.join(out,'resultado.json'),JSON.stringify({realCalls,replayed:reference?.length??0,receipts,external,errors,parent,child},null,2));
 console.log('Dos consultas con ambas fuentes, seis exportaciones y dos reaperturas verificadas.');
}finally{await browser.close();await app?.close();await rm(dir,{recursive:true,force:true});}
