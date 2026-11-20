// Verify local research, the public cloud boundary and native Office downloads.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

const arg=(key,fallback)=>process.argv.find(s=>s.startsWith(key))?.slice(key.length)??fallback;
const root=path.resolve(arg('--app=','.')),out=path.resolve(arg('--out=','artifacts/defensa-r20/browser'));
const mod=name=>import(pathToFileURL(path.join(root,name)));
const {startServer}=await mod('server/main.mjs'),{createIntakeGenerator}=await mod('server/intake-pilot.mjs');
const {remedyCatalog}=await mod('server/corpus/remedy-index.mjs');
const technical=remedyCatalog()[2].points.find(p=>p.number===156);
const long=process.argv.includes('--informe');
const originalPath=path.join(root,'piloto',long?'informe-perfiles-extenso-ficticio.txt':'perfil-escalera-ficticio.txt');
const original=await readFile(originalPath);
const lines=original.toString('utf8').trimEnd().split('\n');
const evidenceLines=['Uso declarado:','Tratamiento informado:'].map(label=>lines.findIndex(row=>row.startsWith(label))+1);
const question='¿Qué exclusión antidumping se revisa para los perfiles de aluminio de escaleras de la operación del 7 de octubre de 2026 del folio TBR-48721 de Laminadora de Ensayo?';
const texts=[],external=[],errors=[],tasks=[];
let preview;
const generate=createIntakeGenerator({getApiKey:async()=>'sk-'+'k'.repeat(35),fetchImpl:async(url,options)=>{
 assert.equal(url,'https://api.openai.com/v1/chat/completions');
 const body=JSON.parse(options.body);
 assert.equal(body.store,false);assert.equal(body.messages.length,1);assert.equal(body.messages[0].content,preview);
 for(const s of ['2026-06-15','2026-10-07','7 de octubre','TBR-48721','TAL-47315','la ficha recibida deja pendientes','Ficha del taller','Laminadora de Ensayo','Perfiles de taller','Firma Avellana'])assert.ok(!options.body.toLowerCase().includes(s.toLowerCase()),s);
 texts.push(preview);
 const research=preview.includes('Resuelve esta consulta');
 const reply=research?{cita:technical.text.slice(0,92),solicitud:'¿Qué ficha técnica acredita la dureza del perfil?'}:
  {acciones:['Cotejar la ficha técnica con las especificaciones de la mercancía.','Verificar los documentos de la operación y la publicación correspondiente.']};
 return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(reply)}}]});
}});
await mkdir(out,{recursive:true});
const dataDir=await mkdtemp(path.join(tmpdir(),'rejon-medidas-'));
const start=()=>startServer({intakePilot:true,intakeGenerate:generate,autoInitialize:false,dataDir,pilotPassphrase:Buffer.from('ensayo aislado de cuotas')});
const browser=await chromium.launch();
let app;
try{
 app=await start();
 const p=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});p.setDefaultTimeout(20000);
 const open=()=>p.goto(app.connection.url+'/#pilot=intake&token='+app.connection.token);
 p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/^https?:/u.test(r.url())&&new URL(r.url()).origin!==new URL(app.connection.url).origin)external.push(r.url());});
 p.on('response',async r=>{if(r.status()>=400&&r.url().endsWith('/api'))console.error(r.status(),r.request().postDataJSON().action,await r.text());});
 const b=name=>p.getByRole('button',{name,exact:true}),doc=p.locator('.rp-document');
 const reveal=async(term)=>{await b('Datos originales').click();await doc.filter({hasText:term}).waitFor();return doc.innerText();};
 async function send(expected){
  const outgoing=p.locator('.rp-proof').filter({has:p.getByRole('heading',{name:'Mensaje para OpenAI'})});
  await outgoing.locator('.rp-preview').filter({hasText:expected}).waitFor({state:'attached'});
  const full=outgoing.getByText('Leer el mensaje completo');if(await full.isVisible())await full.click();
  const shown=outgoing.locator('.rp-preview');await shown.filter({hasText:expected}).waitFor();preview=await shown.innerText();
  await b('Enviar y generar borrador').click();await b('Datos originales').waitFor();
 }
 async function files(stem){
  for(const [label,ext] of [['Word','docx'],['Excel','xlsx'],['PowerPoint','pptx']]){
   await b(label).click();const waiting=p.waitForEvent('download');await b('Descargar .'+ext).click();await(await waiting).saveAs(path.join(out,stem+'.'+ext));
  }
 }
 await open();await p.locator('#intake-firm').fill('Firma Avellana');await b('Continuar').click();
 await p.locator('#intake-client').fill('Laminadora de Ensayo');await p.locator('#intake-title').fill('Perfiles de taller');await b('Guardar en este equipo').click();
 await b('Biblioteca federal').click();await b('Defensa comercial').click();
 const panel=p.locator('.rp-remedy');await panel.getByLabel('Fecha de operación para comparar').fill('2026-06-15');
 await panel.getByRole('status').filter({hasText:'acto intermedio'}).waitFor();
 await panel.getByRole('button',{name:/Preliminar/}).click();await panel.getByLabel('Punto de la resolución').selectOption('298');
 assert.ok((await panel.locator('blockquote').innerText()).includes('cuatro meses'));
 const pdf=await panel.getByRole('link',{name:/Punto 298/}).getAttribute('href');
 assert.equal((await p.request.get(new URL(pdf,app.connection.url).href)).headers()['content-type'],'application/pdf');
 for(const width of [320,390,768,1280]){
  await p.setViewportSize({width,height:900});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Desborde a '+width);
 }
 assert.equal(await panel.locator('article').evaluate(e=>getComputedStyle(e).animationName),'none');
 await p.emulateMedia({reducedMotion:'no-preference'});assert.notEqual(await panel.locator('article').evaluate(e=>getComputedStyle(e).animationName),'none');
 const selected=panel.getByRole('button',{pressed:true});
 await selected.hover();
 await p.waitForFunction(()=>{
  const button=document.querySelector('.rp-stage-list [aria-pressed="true"]');
  const css=getComputedStyle(button);
  const light=value=>{
   const [r,g,b]=value.match(/\d+/g).slice(0,3).map(Number).map(c=>c/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
   return .2126*r+.7152*g+.0722*b;
  };
  const [dark,bright]=[light(css.backgroundColor),light(css.color)].sort((a,b)=>a-b);
  return (bright+.05)/(dark+.05)>=4.5;
 },null,{timeout:4000});
 await panel.screenshot({path:path.join(out,'etapas.png')});
 await b('Guardar punto en el expediente').click();await reveal('Fecha consultada · 2026-06-15');
 await b('Preparar lista de cotejo').click();await send('SE-AD29-PRELIMINAR-298');
 const gap=await reveal('acto intermedio');assert.ok(gap.includes('2026-06-15'));await files('intervalo');
 tasks.push({id:await p.locator('#intake-task').inputValue(),text:gap});
 await b('Documentos del expediente (0)').click();await b('Añadir documento').click();
 if(long){
  const started=p.waitForRequest(request=>request.url().endsWith('/api')&&request.postDataJSON()?.action==='intake.inspectSource');
  await p.locator('input[type=file]').setInputFiles(originalPath);await started;
  await b('Cancelar lectura').click();await p.getByText('Lectura cancelada.',{exact:true}).waitFor();
  assert.ok(await b('Guardar documento en este equipo').isDisabled());
 }
 const reading=p.waitForResponse(response=>response.url().endsWith('/api')&&response.request().postDataJSON()?.action==='intake.inspectSource',{timeout:300000});
 await p.locator('input[type=file]').setInputFiles(originalPath);
 const inspection=await (await reading).json();
 assert.ok(inspection.protection?.available,inspection.error??inspection.protection?.reason??'Falta la revisión');
 assert.ok(inspection.reviewId&&!inspection.protection.contextUnavailable,'Lectura local incompleta');
 await p.getByText(/Revisar protección local/).waitFor({timeout:125000});if(long){await p.getByText(/Se leyeron [2-9] bloques en este equipo/).waitFor();}
 await p.getByLabel('Nombre en el expediente').fill('Ficha del taller');
 await b('Guardar documento en este equipo').click();await b('Documentos del expediente (1)').waitFor();
 if(long){
  const downloading=p.waitForEvent('download');await b('Descargar .txt').click();
  const savedPath=await(await downloading).path();assert.deepEqual(await readFile(savedPath),original);
 }
 await b('Documentos del expediente (1)').click();
 await b('Consultar con una pregunta propia').click();await p.getByLabel('Pregunta del expediente').fill(question);
 await b('Buscar fundamentos en este equipo').click();const selector=p.getByLabel('Pasaje que quieres consultar');
 await selector.waitFor({timeout:125000});assert.ok((await selector.inputValue()).endsWith('/156'));
 await b('Elegir líneas de mis documentos').click();
 const supports=p.locator('.rp-question-lines');
 for(const number of evidenceLines){
  if(long)await supports.getByRole('searchbox').fill('#'+number);
  await supports.getByRole('checkbox',{name:new RegExp('Ficha del taller · línea '+number+' · Sólo en este equipo')}).check();
 }
 if(long){
  await supports.getByRole('searchbox').fill('término sin coincidencia');
  assert.equal(await supports.getByRole('checkbox',{checked:true}).count(),2);
  await supports.getByRole('searchbox').fill('rectitud');
  await supports.screenshot({path:path.join(out,'buscar-lineas.png')});
 }
 await p.getByLabel('Enfoque jurídico').selectOption('excepciones');await b('Preparar mensaje para revisión').click();
 await send('0.15 mm a lo ancho.');const result=await reveal(question);
 assert.ok(result.includes('TAL-47315')&&result.includes('pendientes el ensayo de dureza')&&result.includes('Fecha consultada · 2026-10-07')&&result.includes(technical.text)&&result.includes('¿Qué ficha técnica acredita la dureza del perfil?'));await files('exclusion');
 tasks.push({id:await p.locator('#intake-task').inputValue(),text:result});
 await b('Preparar lista de cotejo').click();await send('SE-AD29-FINAL-156');const follow=await reveal(question);assert.ok(follow.includes(technical.text)&&follow.includes('TAL-47315'));
 tasks.push({id:await p.locator('#intake-task').inputValue(),text:follow});
 await app.close();app=await start();await open();
 for(const t of tasks){await p.locator('#intake-task').selectOption(t.id);assert.equal(await reveal('Laminadora de Ensayo'),t.text);}
 assert.equal(texts.length,3);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 await writeFile(path.join(out,'resultado.json'),JSON.stringify({tasks,texts,external,errors,realOpenAICalls:0,characters:original.toString('utf8').trim().length,evidenceLines},null,2));
 console.log('Dos casos, tres mensajes contrastados con el transporte simulado, seis archivos y tres reaperturas.');
}finally{await browser.close();await app?.close();await rm(dataDir,{recursive:true,force:true});}
