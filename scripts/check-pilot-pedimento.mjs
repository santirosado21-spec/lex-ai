// Exercise the installed pilot in Chromium. Real provider generation is explicit.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
const arg=(prefix,fallback)=>process.argv.find(s=>s.startsWith(prefix))?.slice(prefix.length)??fallback;
const root=path.resolve(arg('--app=','.')),out=path.resolve(arg('--out=','artifacts/pedimento-r18/browser'));
const live=process.argv.includes('--openai'),replay=process.argv.includes('--replay');
assert.ok(!live||!replay);
const fixture=replay?JSON.parse(await readFile('fixtures/public-cases/anexo22-r18.json','utf8')):null;
const {startServer}=await import(pathToFileURL(path.join(root,'server/main.mjs')));
const {createIntakeGenerator}=await import(pathToFileURL(path.join(root,'server/intake-pilot.mjs')));
await mkdir(out,{recursive:true});
let preview,receipt,calls=0;
const synthetic={comun:'Revisar la ficha técnica y la clasificación de la mercancía.',antes:'Cotejar la fecha de la operación con los soportes comerciales.',captura:'Verificar si se presentó una solicitud y en su caso cotejar el acuse.',declaracion:'Cotejar el número en el pedimento si procede para la mercancía.'};
const generate=createIntakeGenerator({...(live?{}:{getApiKey:async()=>'sk-'+'k'.repeat(32)}),onReceipt:r=>{receipt=r;},fetchImpl:async(url,opts)=>{
 assert.equal(++calls,1);assert.equal(url,'https://api.openai.com/v1/chat/completions');
 const body=JSON.parse(opts.body);assert.equal(body.messages[0].content,preview);assert.equal(body.messages.length,1);assert.equal(body.store,false);
 for(const v of ['Firma Almendra','Forja de Ensayo','Borrador de colada','2026-05-21','7616.99.99','7616999991','Depósito fiscal'])assert.ok(!opts.body.includes(v));
 for(const v of ['VUCEM-2026-HI02','RGCE-2026-TR2','SE-2026-AL','RGCE-A9-SE-AL'])assert.ok(preview.includes(v));
 const sha256=createHash('sha256').update(opts.body).digest('hex');if(replay)assert.equal(sha256,fixture.sha256);
 if(live){const response=await fetch(url,opts);if(response.ok)await writeFile(path.join(out,'respuesta.json'),JSON.stringify({sha256,response:JSON.parse((await response.clone().json()).choices[0].message.content)},null,2));return response;}
 return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(fixture?.response??synthetic)}}]});
}});
const dataDir=await mkdtemp(path.join(tmpdir(),'rejon-pedimento-'));
const start=()=>startServer({intakePilot:true,intakeGenerate:generate,dataDir,autoInitialize:false,pilotPassphrase:Buffer.from('ensayo historico de pedimento')});
let app;const browser=await chromium.launch();
try{
 app=await start();const p=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});p.setDefaultTimeout(15000);
 const external=[],errors=[];p.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(app.connection.url).origin)external.push(r.url());});p.on('pageerror',e=>errors.push(e.message));
 p.on('response',async r=>{if(r.status()>=400&&r.url().endsWith('/api'))console.error(r.status(),r.request().postDataJSON().action,await r.text());});
 const open=()=>p.goto(app.connection.url+'/#pilot=intake&token='+app.connection.token);
 const b=name=>p.getByRole('button',{name,exact:true});
 await open();await p.locator('#intake-firm').fill('Firma Almendra');await b('Continuar').click();
 await p.locator('#intake-client').fill('Forja de Ensayo');await p.locator('#intake-title').fill('Borrador de colada');await b('Guardar en este equipo').click();
 await b('Biblioteca federal').click();await b('Claves del pedimento').click();
 const date=p.getByLabel('Fecha de la operación'),query=p.getByLabel('Clave, autoridad o descripción');
 await date.fill('2026-09-24');await query.fill('C1');await b('Buscar clave').click();
 const cards=p.locator('.rp-tariff article');await cards.nth(1).waitFor();assert.equal(await cards.count(),2);
 await p.getByText('Comparar con la descripción anterior').click();await cards.first().getByRole('link',{name:/PDF 2026-01-15/}).waitFor();
 await b('Revisar SE C1').click();await p.getByLabel('Supuesto que quieres cotejar').selectOption('azucar');await cards.first().getByText(/precede a la declaración obligatoria/).waitFor();
 await date.fill('2026-05-25');await query.fill('AL');await b('Buscar clave').click();await b('Revisar SE AL').click();
 await cards.first().getByText(/Desde el 25 de mayo/).waitFor();
 await date.fill('2026-05-21');await b('Buscar clave').click();await b('Revisar SE AL').click();
 await p.getByLabel('Fracción y NICO (10 dígitos)').fill('7616999991');await p.getByLabel('Régimen',{exact:true}).selectOption('Depósito fiscal');await b('Cotejar alcance').click();
 await cards.getByText(/Únicamente: las demás piezas/).waitFor();await cards.getByText(/ya admitía solicitudes/).waitFor();
 const href=await cards.getByRole('link',{name:/Publicación consultada/}).getAttribute('href');
 assert.equal((await p.request.get(new URL(href,app.connection.url).href)).headers()['content-type'],'application/pdf');
 for(const width of [320,390,768,1280]){await p.setViewportSize({width,height:900});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 const panel=p.locator('.rp-permit-verdict');
 assert.equal(await panel.evaluate(el=>getComputedStyle(el).animationName),'none');
 await p.emulateMedia({reducedMotion:'no-preference'});
 assert.notEqual(await panel.evaluate(el=>getComputedStyle(el).animationName),'none');
 await p.emulateMedia({reducedMotion:'reduce'});
 await p.locator('.rp-tariff').screenshot({path:path.join(out,'cotejo.png')});
 await b('Guardar ficha del pedimento').click();await b('Preparar lista de cotejo').click();
 const outgoing=p.locator('.rp-proof').filter({has:p.getByRole('heading',{name:'Mensaje para OpenAI'})}).locator('.rp-preview');
 await outgoing.filter({hasText:'Continúa el trabajo'}).waitFor();preview=await outgoing.innerText();assert.equal(calls,0);
 await b('Enviar y generar borrador').click();
 await Promise.race([b('Datos originales').waitFor({timeout:65000}),p.getByRole('alert').waitFor({timeout:65000}).then(async()=>{throw Error(await p.getByRole('alert').innerText());})]);await b('Datos originales').click();
 const doc=p.locator('.rp-document');await doc.filter({hasText:'7616.99.99'}).waitFor();const text=await doc.innerText(),task=await p.locator('#intake-task').inputValue();
 for(const v of ['2026-05-21','Forja de Ensayo','Depósito fiscal','ya admitía solicitudes','Únicamente: las demás piezas'])assert.ok(text.includes(v));
 const drafted=live?JSON.parse(await readFile(path.join(out,'respuesta.json'),'utf8')).response:fixture?.response??synthetic;
 assert.ok(text.includes(drafted.captura)&&text.includes(drafted.comun)&&!text.includes(drafted.declaracion)&&!text.includes(drafted.antes));
 for(const [label,ext] of [['Word','docx'],['Excel','xlsx'],['PowerPoint','pptx']]){
  await b(label).click();const d=p.waitForEvent('download');await b('Descargar .'+ext).click();await(await d).saveAs(path.join(out,'control.'+ext));
 }
 await app.close();app=await start();await open();await p.locator('#intake-task').selectOption(task);
 await b('Datos originales').click();await doc.filter({hasText:'7616.99.99'}).waitFor();
 await b('Editar borrador').click();const editor=p.locator('#intake-edit');
 const marked=await editor.inputValue();assert.ok(marked.includes('[[COTEJO]]')&&!marked.includes('7616.99.99'));
 await editor.fill(marked.replace('[[COTEJO]]',''));await b('Guardar cambios').click();await b('Datos originales').click();
 await doc.filter({hasText:'Forja de Ensayo'}).waitFor();assert.ok(!(await doc.innerText()).includes('7616.99.99'));
 assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 await writeFile(path.join(out,'resultado.json'),JSON.stringify({calls,live,replay,receipt,restored:text,external,errors},null,2));console.log({calls,live,replay,reopened:true,formats:3});
}finally{await browser.close();await app?.close();await rm(dataDir,{recursive:true,force:true});}
