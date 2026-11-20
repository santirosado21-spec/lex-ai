import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const root=path.resolve(process.argv.find(a=>a.startsWith('--app='))?.slice(6)??'.');
const base=path.resolve('artifacts/consulta-r14'),live=process.argv.includes('--openai'),replay=process.argv.includes('--replay');
assert.ok(!(live&&replay));
const out=path.join(base,process.argv.some(a=>a.startsWith('--app='))?'zip':live?'openai':replay?'replay':'simulado');
const {startServer}=await import(pathToFileURL(path.join(root,'server/main.mjs')));
const {createIntakeGenerator}=await import(pathToFileURL(path.join(root,'server/intake-pilot.mjs')));
const {customsPassage}=await import(pathToFileURL(path.join(root,'server/corpus/customs-edition.mjs')));
const article=customsPassage('65').passages[1],question='¿Qué documentos permiten a Envases Ágata Ficticia comprobar el flete y los seguros del embarque CJ-58207 en el valor en aduana?';
const privateText=['Envases Ágata','CJ-58207','Informe privado de carga','Despacho Almendra','client@example.test'];
let preview='',calls=0,receipt;
await mkdir(out,{recursive:true});
const generate=createIntakeGenerator({...(live?{}:{getApiKey:async()=>'sk-'+'t'.repeat(32)}),onReceipt:value=>{receipt=value;},fetchImpl:async(url,opts)=>{
 assert.equal(url,'https://api.openai.com/v1/chat/completions');assert.equal(++calls,1);
 const body=JSON.parse(opts.body);assert.equal(body.messages[0].content,preview);assert.equal(body.store,false);
 for(const literal of [...privateText,'[[LEX_','[[DATO_','[[CONSULTA]]','CJ-'])assert.ok(!opts.body.includes(literal));
 assert.ok(preview.includes('Documentos para acreditar los hechos · Gastos de transporte, Seguro de la mercancía'));
 assert.ok(preview.includes(article.condition)&&preview.includes(article.quote));
 await writeFile(path.join(out,'sobre-publico.json'),JSON.stringify(body,null,2));
 if(live){const response=await fetch(url,opts);if(response.ok)await writeFile(path.join(out,'respuesta.json'),(await response.clone().json()).choices[0].message.content);return response;}
 const captured=replay?JSON.parse(await readFile(new URL('../fixtures/public-cases/consulta-flete-r14.json',import.meta.url),'utf8')):null;
 if(captured)assert.equal(createHash('sha256').update(preview).digest('hex'),captured.promptSha256);
 const content=captured?JSON.stringify(captured.response):JSON.stringify({cita:article.quote,solicitud:'¿Qué factura desglosa los gastos de transporte y seguros de la mercancía?'});
 return Response.json({model:'simulado',choices:[{finish_reason:'stop',message:{content}}]});
}});
const dataDir=await mkdtemp(path.join(tmpdir(),'rejon-pregunta-'));
const start=()=>startServer({intakePilot:true,intakeGenerate:generate,dataDir,autoInitialize:false,pilotPassphrase:Buffer.from('ejercicio de preguntas ficticias')});
let app=await start();const browser=await chromium.launch();
try{
 const p=await browser.newPage({viewport:{width:1280,height:900}}),external=[],errors=[];
 p.setDefaultTimeout(16000);p.on('pageerror',e=>errors.push(e.message));
 p.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(app.connection.url).origin)external.push(r.url());});
 const open=()=>p.goto(app.connection.url+'/#pilot=intake&token='+app.connection.token);
 const button=name=>p.getByRole('button',{name,exact:true});
 await open();await p.locator('#intake-firm').fill('Despacho Almendra');await button('Continuar').click();
 await p.locator('#intake-client').fill('Envases Ágata Ficticia');await p.locator('#intake-title').fill('Informe privado de carga');
 await button('Guardar en este equipo').click();await button('Consultar con una pregunta propia').click();
 await p.getByLabel('Pregunta del expediente').fill(question);await button('Buscar fundamentos en este equipo').click();
 const source=p.getByLabel('Pasaje que quieres consultar');await source.waitFor({timeout:130000});await source.selectOption('aduana-65/1');
 await p.getByText(/Pregunta con sustituciones locales/).click();
 const view=await p.locator('.rp-question .rp-details p').first().innerText();assert.ok(!view.includes('Envases Ágata')&&!view.includes('CJ-58207'));
 await p.getByLabel('Enfoque jurídico').selectOption('documentos');
 for(const width of [320,390,768,1280]){await p.setViewportSize({width,height:900});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await p.locator('.rp-question').screenshot({path:path.join(out,'pregunta.png')});
 assert.equal(calls,0);await button('Preparar mensaje para revisión').click();
 const pending=p.locator('.rp-proof .rp-preview');await pending.filter({hasText:'Documentos para acreditar los hechos'}).waitFor();preview=await pending.innerText();
 const id=await p.locator('#intake-task').inputValue();
 await button('Enviar y generar borrador').click();await button('Datos originales').waitFor({timeout:60000});
 await button('Datos originales').click();await p.locator('.rp-document').filter({hasText:question}).waitFor();const text=await p.locator('.rp-document').innerText();
 for(const literal of [question,'Informe privado de carga',article.condition,article.quote,'Cita documental','65'])assert.ok(text.includes(literal),literal);
 assert.ok(!text.includes('Fundamento pendiente'));assert.ok(text.includes('¿'));
 for(const [label,ext] of [['Word','docx'],['Excel','xlsx'],['PowerPoint','pptx']]){
  await button(label).click();const dl=p.waitForEvent('download');await button('Descargar .'+ext).click();await(await dl).saveAs(path.join(out,'consulta.'+ext));
 }
 await app.close();app=await start();await open();await p.locator('#intake-task').selectOption(id);await button('Datos originales').click();
 await p.locator('.rp-document').filter({hasText:question}).waitFor();assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 const result={real:live,calls,receipt,reopened:true,exports:3,widths:[320,390,768,1280],externalBrowserRequests:0,providerSawPrivateLiterals:false};
 await writeFile(path.join(out,'resultado.json'),JSON.stringify(result,null,2));console.log(result);
}finally{await browser.close();await app.close();await rm(dataDir,{recursive:true,force:true});}
