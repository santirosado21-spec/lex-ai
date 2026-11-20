// Independent local exercise with two dates and the same recorded public cloud response.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

const option=(prefix,fallback)=>process.argv.find(s=>s.startsWith(prefix))?.slice(prefix.length)??fallback;
const root=path.resolve(option('--app=','.')),out=path.resolve(option('--out=','artifacts/pregunta-r19/browser'));
const fixture=JSON.parse(await readFile('fixtures/public-cases/anexo22-r18.json','utf8'));
const {startServer}=await import(pathToFileURL(path.join(root,'server/main.mjs')));
const {createIntakeGenerator}=await import(pathToFileURL(path.join(root,'server/intake-pilot.mjs')));
const question='¿Qué aviso de aluminio debe revisar Forja de Ensayo en el pedimento del folio QRA-88277?';
const documents=[['Ficha comercial','pedimento-aluminio-ficticio.txt'],['Rectificación de muestra','rectificacion-aluminio-ficticia.txt']];
const operations=[['2026-05-21',documents[0][0],'captura'],['2026-05-26',documents[1][0],'declaracion']];
const completed=[],external=[],errors=[],hashes=[];
let preview;
const generate=createIntakeGenerator({getApiKey:async()=>'sk-'+'k'.repeat(32),fetchImpl:async(url,opts)=>{
 assert.equal(url,'https://api.openai.com/v1/chat/completions');
 const body=JSON.parse(opts.body);
 assert.equal(body.messages.length,1);assert.equal(body.messages[0].content,preview);assert.equal(body.store,false);
 for(const v of ['Forja de Ensayo','QRA-88277','Borrador de colada','2026-05-21','2026-05-26','7616999991','Depósito fiscal',...documents.flat()])assert.ok(!opts.body.includes(v),v);
 const hash=createHash('sha256').update(opts.body).digest('hex');assert.equal(hash,fixture.sha256);hashes.push(hash);
 return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(fixture.response)}}]});
}});
const dataDir=await mkdtemp(path.join(tmpdir(),'rejon-cotejo-'));
const start=()=>startServer({intakePilot:true,intakeGenerate:generate,dataDir,autoInitialize:false,pilotPassphrase:Buffer.from('una frase de prueba local')});
await mkdir(out,{recursive:true});
const browser=await chromium.launch();
let app;
try{
 app=await start();
 const p=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});
 p.setDefaultTimeout(18000);
 p.on('pageerror',e=>errors.push(e.message));
 p.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(app.connection.url).origin)external.push(r.url());});
 p.on('response',async r=>{if(r.status()>=400&&r.url().endsWith('/api'))console.error(r.status(),r.request().postDataJSON().action,await r.text());});
 const open=()=>p.goto(app.connection.url+'/#pilot=intake&token='+app.connection.token);
 const b=name=>p.getByRole('button',{name,exact:true});
 const doc=p.locator('.rp-document');
 await open();await p.locator('#intake-firm').fill('Firma Almendra');await b('Continuar').click();
 await p.locator('#intake-client').fill('Forja de Ensayo');await p.locator('#intake-title').fill('Borrador de colada');await b('Guardar en este equipo').click();
 await b('Documentos del expediente (0)').click();
 for(const [i,[label,filename]] of documents.entries()){
  await b('Añadir documento').click();
  await p.locator('input[type=file]').setInputFiles(path.join(root,'piloto',filename));
  await p.getByText(/Revisar protección local/).waitFor({timeout:135000});
  await p.getByLabel('Nombre en el expediente').fill(label);
  await b('Guardar documento en este equipo').click();await b('Documentos del expediente ('+(i+1)+')').waitFor();
 }
 await b('Documentos del expediente (2)').click();
 for(const [date,source,stage] of operations){
  await b('Consultar con una pregunta propia').click();await p.getByLabel('Pregunta del expediente').fill(question);
  await b('Buscar fundamentos en este equipo').click();
  const permit=p.locator('.rp-question .rp-permit');
  await permit.waitFor({timeout:135000});
  assert.equal(await permit.getByLabel('Fecha de la operación',{exact:true}).inputValue(),'');
  assert.equal(await permit.getByLabel('Clave, autoridad o descripción').inputValue(),'AL');
  await permit.getByText('Usar campos de los documentos del expediente').click();
  await permit.getByText(/Los soportes contienen fechas distintas/).waitFor();
  for(const [field,label] of [['Fecha de operación',source],['Fracción y NICO',documents[0][0]],['Régimen aduanero',documents[0][0]],['Clave de permiso',documents[0][0]]]){
   const select=permit.getByLabel(field+' del soporte',{exact:true});
   const value=await select.locator('option').filter({hasText:label}).getAttribute('value');
   await select.selectOption(value);
  }
  await b('Buscar clave').click();await b('Revisar SE AL').click();
  await permit.getByText(/Únicamente: las demás piezas/).waitFor();
  for(const width of [320,390,768,1280]){
   await p.setViewportSize({width,height:900});
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Desborde a '+width);
  }
  if(!completed.length)await permit.screenshot({path:path.join(out,'consulta.png')});
  await b('Guardar ficha del pedimento').click();await b('Datos originales').click();
  await doc.filter({hasText:question}).waitFor();
  const attribution=source+' · línea 2 · Fecha de operación · '+date;
  assert.ok((await doc.innerText()).includes(attribution));
  await b('Preparar lista de cotejo').click();
  const outgoing=p.locator('.rp-proof').filter({has:p.getByRole('heading',{name:'Mensaje para OpenAI'})}).locator('.rp-preview');
  await outgoing.filter({hasText:'Continúa el trabajo'}).waitFor();preview=await outgoing.innerText();
  await b('Enviar y generar borrador').click();await b('Datos originales').click();
  await doc.filter({hasText:question}).waitFor();
  const restored=await doc.innerText();
  for(const term of [attribution,'Ficha comercial · líneas 3–4','Los soportes contienen fechas distintas','Depósito fiscal',fixture.response[stage]])assert.ok(restored.includes(term),term);
  assert.ok(!restored.includes(fixture.response[stage==='captura'?'declaracion':'captura']));
  for(const [label,ext] of [['Word','docx'],['Excel','xlsx'],['PowerPoint','pptx']]){
   await b(label).click();const download=p.waitForEvent('download');await b('Descargar .'+ext).click();await(await download).saveAs(path.join(out,stage+'.'+ext));
  }
  completed.push({task:await p.locator('#intake-task').inputValue(),stage,attribution,restored});
 }
 assert.notEqual(completed[0].task,completed[1].task);
 await app.close();app=await start();await open();
 for(const {task,restored} of completed){
  await p.locator('#intake-task').selectOption(task);await b('Datos originales').click();
  await doc.filter({hasText:question}).waitFor();assert.equal(await doc.innerText(),restored);
 }
 assert.deepEqual(external,[]);assert.deepEqual(errors,[]);assert.equal(hashes.length,2);
 await writeFile(path.join(out,'resultado.json'),JSON.stringify({completed,external,errors,hashes,liveOpenAICalls:0},null,2));
 console.log('Dos operaciones, seis archivos, reapertura y dos solicitudes públicas idénticas verificadas.');
}finally{await browser.close();await app?.close();await rm(dataDir,{recursive:true,force:true});}
