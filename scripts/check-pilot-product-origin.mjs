// Run from the development checkout. Chrome and the local service use a temporary synthetic matter.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

const root=path.resolve(process.argv[2]??'.'),out=path.resolve(process.argv[3]??'artifacts/origen-r31/web');
const live=process.argv.includes('--openai'),replay=process.argv.find(x=>x.startsWith('--replay='))?.slice(9);
assert.ok(!(live&&replay));
const mod=name=>import(pathToFileURL(path.join(root,name)));
const {startServer}=await mod('server/main.mjs'),{createIntakeGenerator}=await mod('server/intake-pilot.mjs');
const {productOriginRef,productOriginId,productOriginSuggestions}=await mod('server/corpus/product-origin.mjs');
const client='Taller Capuchino de Ensayo',title='Trámite Cuarzo de Ensayo',privateCode='CXW-71403';
const withFile=process.argv.includes('--minutas');
const coffee=withFile||process.argv.includes('--cafe');
const confidential=withFile?(await readFile(path.join(root,'piloto/minutas-cafe-ficticias.txt'),'utf8')).trimEnd().split('\n'):[];

const selected=coffee?productOriginSuggestions('Renglón 09.01 de la página 87 del Anexo 4-B del T-MEC')[0]:{part:1,ref:productOriginRef(productOriginId,1)};
const ref=selected.ref,source=ref.text;

await mkdir(out,{recursive:true});
const dir=await mkdtemp(path.join(tmpdir(),'rejon-reglas-origen-'));let app,preview,originalQuestion,calls=0;
const external=[],errors=[];
const generator=createIntakeGenerator({...(live?{}:{getApiKey:async()=>'sk-'+'s'.repeat(32)}),fetchImpl:async(url,opts)=>{
 try{
 assert.equal(url,'https://api.openai.com/v1/chat/completions');const req=JSON.parse(opts.body);
 assert.ok(req.store===false&&req.messages.length===1&&req.messages[0].content===preview);
 assert.ok(preview.includes(source)&&preview.includes(coffee?'09.01':'1806.10.aa'));
 for(const secret of [client,title,privateCode,originalQuestion,...confidential,...(withFile?['CGS-82946','ceniza volcánica','altiplano','minutas-cafe']:[])])assert.ok(!opts.body.includes(secret));
 const hash=createHash('sha256').update(opts.body).digest('hex');let response;calls++;
 if(live)response=await fetch(url,opts);
 else if(replay){const stored=JSON.parse(await readFile(path.join(replay,'respuesta.json')));assert.equal(hash,stored.hash);response=Response.json(stored.response);}
 else response=Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({
  cita:coffee?ref.quote:'Un cambio a la fracción arancelaria 1806.10.aa de cualquier otra partida.',
  lectura:coffee?'El renglón exige cotejar la clasificación del producto y el capítulo de los materiales no originarios.':'La fracción específica tiene prioridad y requiere comprobar el contenido de azúcar con la ficha de composición.',solicitud:coffee?'¿Qué soporte acredita la clasificación de los insumos?':'¿Qué ficha acredita el contenido de azúcar?'})}}]});
 if(response.ok)await writeFile(path.join(out,'respuesta.json'),JSON.stringify({hash,response:await response.clone().json()},null,2));
 return response;
 }catch(error){console.error(error.message);throw error;}
}});
const start=()=>startServer({dataDir:dir,intakePilot:true,intakeGenerate:generator,autoInitialize:false,pilotPassphrase:Buffer.from('frase sintética de la biblioteca local')});
const browser=await chromium.launch();
try{
 app=await start();const p=await browser.newPage({viewport:{width:1200,height:900},reducedMotion:'reduce'});
 p.setDefaultTimeout(35000);
 p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(app.connection.url).origin)external.push(r.url());});
 const open=()=>p.goto(app.connection.url+'/#pilot=intake&token='+app.connection.token);
 const b=name=>p.getByRole('button',{name,exact:true});await open();
 await p.locator('#intake-firm').fill('Despacho de laboratorio');await b('Continuar').click();await p.locator('#intake-client').fill(client);await p.locator('#intake-title').fill(title);await b('Guardar en este equipo').click();
 if(withFile){
  await b('Documentos del expediente (0)').click();await b('Añadir documento').click();
  await p.locator('input[type=file]').setInputFiles(path.join(root,'piloto/minutas-cafe-ficticias.txt'));
  const review=p.locator('details.rp-private-review');
  await review.locator('summary').waitFor({timeout:125000});await review.locator('summary').click();
  const text=review.getByLabel('Texto con sustituciones');const masked=await text.innerText();
  for(const hidden of ['CGS-82946','ceniza volcánica','altiplano'])assert.ok(!masked.includes(hidden),masked);
  assert.ok(masked.includes('sacos de grano verde')&&masked.includes('café tostado'),masked);
  const next=review.getByRole('button',{name:'Sustitución siguiente'});await next.click();
  const selectedMark=await text.locator('[aria-current=true]').innerText();assert.ok(selectedMark.startsWith('Dato '));
  await review.getByRole('button',{name:'Ver texto restituido'}).click();
  const restored=review.getByLabel('Texto restituido en este equipo');assert.equal((await restored.innerText()).trimEnd(),confidential.join('\n'));
  assert.ok(!(await restored.locator('[aria-current=true]').innerText()).startsWith('Dato '));
  await review.getByRole('button',{name:'Ver sustituciones'}).click();
  await p.setViewportSize({width:390,height:840});await review.screenshot({path:path.join(out,'proteccion-movil.png')});
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await p.getByLabel('Nombre en el expediente').fill('Minutas de trabajo');await b('Guardar documento en este equipo').click();
  await b('Documentos del expediente (1)').waitFor();
 }
 await b('Biblioteca federal').click();await b('Tarifa arancelaria').click();
 await p.getByLabel('Fracción o descripción impresa').fill('1806.10.01');await b('Buscar en la tarifa').click();
 await b('Buscar regla de origen T-MEC').first().click();
 const region=p.getByRole('region',{name:'Reglas de origen por producto'});
 const chapter=p.getByLabel('Ir a un capítulo');await chapter.locator('option').nth(96).waitFor({state:'attached'});
 const field=p.getByLabel('Mercancía, capítulo o código');assert.equal(await field.inputValue(),'1806.10.01');
 async function search(term){await field.fill(term);await b('Buscar en esta edición').click();}
 await search('77');await region.getByText('Sin coincidencias',{exact:false}).waitFor();
 await chapter.selectOption('9');await region.getByRole('link',{name:'09.01 · p. 87',exact:true}).waitFor();
 await search('4009.21');await region.getByText('nota 3',{exact:false}).waitFor();
 await search('1806.10.01');await region.getByRole('link',{name:'1806.10.aa · p. 90',exact:true}).waitFor();
 const href=await region.getByRole('link',{name:'1806.10 · p. 90',exact:true}).getAttribute('href');
 const response=await p.request.get(new URL(href,app.connection.url).href);
 assert.equal(createHash('sha256').update(await response.body()).digest('hex'),ref.pdfSha256);
 await region.getByText('Leer las disposiciones para 1806.10').click();
 const provision=region.locator('.rp-origin-provisions > div').first();
 assert.equal(await provision.evaluate(el=>getComputedStyle(el).animationName),'none');
 await p.emulateMedia({reducedMotion:'no-preference'});assert.equal(await provision.evaluate(el=>getComputedStyle(el).animationName),'rp-enter');
 await p.emulateMedia({reducedMotion:'reduce'});await p.setViewportSize({width:390,height:844});await region.screenshot({path:path.join(out,'biblioteca-movil.png')});
 for(const w of [320,390,768,1280]){await p.setViewportSize({width:w,height:900});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await region.screenshot({path:path.join(out,'biblioteca.png')});
 if(coffee){
  await search('0901.21.01');await region.getByText('Leer renglón 09.01',{exact:true}).click();await b('Consultar 09.01').click();
 }else await b('Consultar la subpartida 1806.10').click();
 const inquiry=p.getByLabel('Pregunta del expediente');assert.ok((await inquiry.inputValue()).includes(coffee?'09.01':'1806.10'));
 originalQuestion=(await inquiry.inputValue()).replace('?',' en el asunto '+privateCode+'?');
 await inquiry.fill(originalQuestion);await b('Buscar fundamentos en este equipo').click();
 const candidate=p.getByLabel('Pasaje que quieres consultar');await candidate.waitFor({timeout:125000});assert.equal(await candidate.inputValue(),productOriginId+'/'+selected.part);
 if(withFile){
  await b('Elegir líneas de mis documentos').click();const boxes=p.locator('.rp-line-options input[type=checkbox]');
  await boxes.nth(1).waitFor();await boxes.nth(0).check();await boxes.nth(1).check();
 }
 await p.getByLabel('Enfoque jurídico').selectOption('documentos');await b('Preparar mensaje para revisión').click();
 const message=p.locator('.rp-preview').filter({hasText:ref.locator});await message.waitFor({state:'attached'});
 const show=p.getByText('Leer el mensaje completo');if(await show.isVisible())await show.click();await message.waitFor();preview=await message.innerText();
 const waiting=p.waitForResponse(r=>r.url().endsWith('/api')&&r.request().postDataJSON()?.action==='intake.draft',{timeout:125000});
 await b('Enviar y generar borrador').click();const reply=await waiting;assert.ok(reply.ok(),JSON.stringify(await reply.json()).slice(0,350));
 const counselNote='El abogado solicita la ficha técnica del insumo para el folio ';
 if(withFile){
  await b('Editar borrador').click();const editor=p.getByLabel('Editar en este equipo');
  const protectedDraft=await editor.inputValue();
  assert.ok(protectedDraft.includes('[[CLIENTE]]')&&!protectedDraft.includes('CGS-82946'));
  await editor.fill(protectedDraft+'\n\n'+counselNote);
  const edit=p.locator('.rp-edit');await edit.getByRole('button',{name:'Consultar soporte local'}).click();
  const choices=edit.getByLabel('Dato para el borrador');
  const token=await choices.getByRole('option',{name:/ · CGS-82946$/u}).getAttribute('value');
  await choices.selectOption(token);await edit.getByRole('button',{name:'Insertar marcador'}).click();
  assert.ok((await editor.inputValue()).includes(counselNote+token));
  await b('Guardar cambios').click();await p.getByText('Cambios guardados en este equipo.',{exact:true}).waitFor();
 }
 await b('Datos originales').click();const area=p.locator('.rp-document').filter({hasText:privateCode});
 const draft=await area.innerText();assert.ok(draft.includes('Lectura preliminar de OpenAI')&&draft.includes(ref.id)&&!draft.includes('Fundamento pendiente'),draft);
 const reading=draft.split('Lectura preliminar de OpenAI')[1].split('\n\n')[0];assert.match(reading,coffee?/capítulo|clasificaci|partida/iu:/fracción|subpartida|composici|azúcar/iu);
 if(withFile)assert.ok(draft.includes(counselNote+'CGS-82946'));
 for(const term of [client,title,originalQuestion,ref.text,...confidential])assert.ok(draft.includes(term));
 const task=await p.locator('#intake-task').inputValue();
 for(const [label,ext] of [['Word','docx'],['Excel','xlsx'],['PowerPoint','pptx']]){
  await b(label).click();const ready=p.waitForEvent('download');await b('Descargar .'+ext).click();await(await ready).saveAs(path.join(out,'registro.'+ext));
 }
 await app.close();app=await start();await open();await p.locator('#intake-task').selectOption(task);await b('Datos originales').click();assert.equal(await area.innerText(),draft);
 assert.equal(calls,1);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 await writeFile(path.join(out,'resultado.json'),JSON.stringify({live,replay:Boolean(replay),calls,external,errors,originalQuestion,draft},null,2));
 console.log('Índice por capítulo, código y nota al pie, consulta por producto, tres exportaciones y reapertura.');
}finally{await browser.close();await app?.close();await rm(dir,{recursive:true,force:true});}
