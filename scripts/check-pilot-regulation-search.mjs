// Run from the development checkout. Chrome and the local service use a temporary synthetic matter.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

const root=path.resolve(process.argv[2]??'.'),out=path.resolve(process.argv[3]??'artifacts/reglamento-r28');
const live=process.argv.includes('--openai'),replay=process.argv.find(x=>x.startsWith('--replay='))?.slice(9);
assert.ok(!(live&&replay));
const mod=name=>import(pathToFileURL(path.join(root,name)));
const {startServer}=await mod('server/main.mjs'),{createIntakeGenerator}=await mod('server/intake-pilot.mjs');
const {regulationPassage}=await mod('server/corpus/customs-edition.mjs');
const client='Taller Capuchino de Ensayo',title='Trámite Cuarzo de Ensayo',privateCode='CXW-71403';
const source=regulationPassage('6-A').ref.text,topic='sello digital correo electrónico avisos de disponibilidad';
await mkdir(out,{recursive:true});
const dir=await mkdtemp(path.join(tmpdir(),'rejon-reglamento-'));let app,preview,originalQuestion,calls=0;
const external=[],errors=[];
const generator=createIntakeGenerator({...(live?{}:{getApiKey:async()=>'sk-'+'s'.repeat(32)}),fetchImpl:async(url,opts)=>{
 assert.equal(url,'https://api.openai.com/v1/chat/completions');const req=JSON.parse(opts.body);
 assert.ok(req.store===false&&req.messages.length===1&&req.messages[0].content===preview);
 assert.ok(preview.includes(source)&&preview.includes('Pasaje público relacionado'));
 for(const secret of [client,title,privateCode,originalQuestion])assert.ok(!opts.body.includes(secret));
 const hash=createHash('sha256').update(opts.body).digest('hex');let response;calls++;
 if(live)response=await fetch(url,opts);
 else if(replay){const stored=JSON.parse(await readFile(path.join(replay,'respuesta.json')));assert.equal(hash,stored.hash);response=Response.json(stored.response);}
 else response=Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({
  cita:'Dirección de correo electrónico para recibir notificaciones, a la cual serán enviados los avisos de disponibilidad de notificación relacionados con el trámite que corresponda.',
  lectura:'Conviene cotejar el correo registrado para notificaciones y el soporte del trámite electrónico para verificar a quién se dirigen los avisos.',solicitud:'¿Qué constancia acredita el registro del correo electrónico?'})}}]});
 if(response.ok)await writeFile(path.join(out,'respuesta.json'),JSON.stringify({hash,response:await response.clone().json()},null,2));
 return response;
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
 await b('Biblioteca federal').click();await b('Reglamento aduanero').click();const search=p.getByLabel('Buscar en el Reglamento');
 await search.fill('xyzzzyyyy');await b('Buscar artículos').click();await p.getByText('Sin coincidencias.',{exact:false}).waitFor();
 await search.fill(topic);await b('Buscar artículos').click();const select=p.getByLabel('Artículo del Reglamento de la Ley Aduanera');await select.waitFor();
 assert.equal(await select.inputValue(),'6-A');
 await p.getByText('texto del artículo · pp. 3–4').click();
 for(const w of [320,390,768,1280]){await p.setViewportSize({width:w,height:900});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await p.getByRole('region',{name:'Reglamento de la Ley Aduanera'}).screenshot({path:path.join(out,'biblioteca.png')});
 await b('Preparar consulta de este artículo').click();const inquiry=p.getByLabel('Pregunta del expediente');assert.ok((await inquiry.inputValue()).includes(topic));
 originalQuestion=(await inquiry.inputValue()).replace('?',' en el asunto '+privateCode+'?');
 await inquiry.fill(originalQuestion);await b('Buscar fundamentos en este equipo').click();
 const candidate=p.getByLabel('Pasaje que quieres consultar');await candidate.waitFor({timeout:125000});assert.equal(await candidate.inputValue(),'reg-aduana-6-A/0');
 await p.getByLabel('Enfoque jurídico').selectOption('documentos');await b('Preparar mensaje para revisión').click();
 const show=p.getByText('Leer el mensaje completo');if(await show.isVisible())await show.click();preview=await p.locator('.rp-preview').filter({hasText:'Pasaje público relacionado'}).innerText();
 const waiting=p.waitForResponse(r=>r.url().endsWith('/api')&&r.request().postDataJSON()?.action==='intake.draft',{timeout:125000});
 await b('Enviar y generar borrador').click();const reply=await waiting;assert.ok(reply.ok());
 await b('Datos originales').click();const area=p.locator('.rp-document').filter({hasText:privateCode});
 const draft=await area.innerText();assert.ok(draft.includes('Lectura preliminar de OpenAI')&&draft.includes('MX-FED-REG-LADUA-6-A')&&!draft.includes('Fundamento pendiente'),draft);
 const reading=draft.split('Lectura preliminar de OpenAI')[1].split('\n\n')[0];assert.match(reading,/correo|notifica|avisos/iu);
 for(const term of [client,title,originalQuestion])assert.ok(draft.includes(term));
 const task=await p.locator('#intake-task').inputValue();
 for(const [label,ext] of [['Word','docx'],['Excel','xlsx'],['PowerPoint','pptx']]){
  await b(label).click();const ready=p.waitForEvent('download');await b('Descargar .'+ext).click();await(await ready).saveAs(path.join(out,'registro.'+ext));
 }
 await app.close();app=await start();await open();await p.locator('#intake-task').selectOption(task);await b('Datos originales').click();assert.equal(await area.innerText(),draft);
 assert.equal(calls,1);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 await writeFile(path.join(out,'resultado.json'),JSON.stringify({live,replay:Boolean(replay),calls,external,errors,originalQuestion,draft},null,2));
 console.log('Artículo 6-A seleccionado por tema, cita verificada, tres exportaciones y reapertura.');
}finally{await browser.close();await app?.close();await rm(dir,{recursive:true,force:true});}
