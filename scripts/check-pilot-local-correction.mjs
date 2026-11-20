// Actual local Ollama and Chromium. A synthetic provider lets us inspect every outbound byte.
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

const root=path.resolve(process.argv[2]??'.');
const {startServer}=await import(pathToFileURL(path.join(root,'server/main.mjs')));
const {createIntakeGenerator}=await import(pathToFileURL(path.join(root,'server/intake-pilot.mjs')));
const dir=await mkdtemp(path.join(tmpdir(),'rejon-correccion-'));
const output=path.resolve('artifacts/privacidad-r9');
await mkdir(output,{recursive:true});
const client='Empresa Ejercicio Glicina',title='Comprobación de flete ficticio';
const literal='volver a cotejar con cuidado';
const text='El buque Viento de Plata, viaje KM8B, transportó la carga. La instrucción del abogado es volver a cotejar con cuidado. Como segundo paso se pide volver a cotejar con cuidado.';
const sent=[],external=[];
const generate=createIntakeGenerator({getApiKey:async()=>'sk-'+'z'.repeat(32),fetchImpl:async(_url,opts)=>{
 sent.push(opts.body);return Response.json({choices:[{finish_reason:'stop',message:{content:'Para [[CLIENTE]] respecto de [[ASUNTO]].'}}]});
}});
const launch=()=>startServer({intakePilot:true,intakeGenerate:generate,dataDir:dir,autoInitialize:false,pilotPassphrase:Buffer.from('ensayo local con correcciones')});
const browser=await chromium.launch();
let app;
try{
 app=await launch();
 const p=await browser.newPage({viewport:{width:960,height:900}});
 p.on('request',r=>{if(r.url().startsWith('http')&&new URL(r.url()).origin!==new URL(app.connection.url).origin)external.push(new URL(r.url()).origin);});
 await p.goto(app.connection.url+'/#pilot=intake&token='+app.connection.token);
 await p.locator('#intake-firm').fill('Despacho Ficticio');await p.getByRole('button',{name:'Continuar'}).click();
 await p.locator('input[type=file]').setInputFiles({name:'viaje-ficticio.txt',mimeType:'text/plain',buffer:Buffer.from(text)});
 await p.getByText(/Revisar protección local ·/).waitFor({timeout:130000});await p.getByText(/Revisar protección local ·/).click();
 const review=p.locator('.rp-private-review pre');
 const before=await review.innerText();
 assert.ok(!before.includes('KM8B')&&!before.includes('Viento de Plata'));
 assert.equal(before.split(literal).length,3);
 async function hide(type=false){
  await p.getByRole('button',{name:'Ocultar otro dato'}).click();
  const original=p.getByRole('textbox',{name:'Selecciona el dato en el texto original'});
  if(type)await p.getByRole('textbox',{name:'O escribe el fragmento exacto'}).fill(literal);
  else{
   await original.focus();
   await original.evaluate((el,value)=>{const i=el.value.indexOf(value);el.setSelectionRange(i,i+value.length);},literal);
   assert.equal(await original.evaluate(el=>el.value.slice(el.selectionStart,el.selectionEnd)),literal);
  }
  await p.getByRole('button',{name:'Ocultar coincidencias exactas'}).click();
  await p.getByText('Las coincidencias exactas del fragmento están ocultas.').waitFor();
  assert.ok(!(await review.innerText()).includes(literal));
 }
 await hide();await p.getByRole('button',{name:'Deshacer última corrección'}).click();await p.getByText('Se deshizo la última corrección.').waitFor();
 assert.equal(await review.innerText(),before);await hide(true);
 for(const width of [320,390,768,1280]){
  await p.setViewportSize({width,height:900});const overflow=await p.evaluate(()=>Array.from(document.querySelectorAll('main *')).filter(el=>el.getBoundingClientRect().right>innerWidth+1).map(el=>[el.tagName,el.className,Math.ceil(el.getBoundingClientRect().right)]).slice(0,10));
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),JSON.stringify({width,overflow}));
 }
 await p.locator('.rp-private-review').screenshot({path:path.join(output,'correccion-local.png')});
 await p.locator('#intake-client').fill(client);await p.locator('#intake-title').fill(title);
 await p.getByRole('button',{name:'Guardar en este equipo'}).click();await p.locator('#intake-task').selectOption('opening');
 const stored=await app.service.dispatch('intake.readDocument',{});
 assert.equal(stored.original,text);assert.ok(!stored.masked.includes(literal));assert.equal(sent.length,0);
 await p.getByRole('button',{name:'Enviar y generar borrador'}).click();await p.getByRole('button',{name:'Editar borrador'}).click();
 const item=stored.tokens.find(x=>x.value===literal);assert.ok(item);
 const draft=p.getByRole('textbox',{name:'Editar en este equipo'});await draft.fill('Para [[CLIENTE]], en [[ASUNTO]], revisar '+item.token+'.');
 await p.getByRole('button',{name:'Guardar',exact:false}).filter({hasNotText:'expediente'}).first().click();
 await p.getByRole('button',{name:'Editar borrador'}).waitFor();
 for(const [name,ext] of [['Word','docx'],['Excel','xlsx'],['PowerPoint','pptx']]){
  await p.getByRole('button',{name,exact:true}).click();
  const dl=p.waitForEvent('download');await p.getByRole('button',{name:'Descargar .'+ext}).click();
  await(await dl).saveAs(path.join(output,'correccion.'+ext));
 }
 assert.equal(sent.length,1);for(const datum of [literal,'Viento de Plata','KM8B',title,client,item.token])assert.ok(!sent[0].includes(datum));
 await app.close();app=await launch();const restored=await app.service.dispatch('intake.readDocument',{});
 assert.deepEqual(restored,stored);assert.deepEqual(external,[]);
 await writeFile(path.join(output,'navegador.json'),JSON.stringify({localModel:'qwen3.5:2b-q4_K_M',provider:'simulated',externalBrowserRequests:external.length,hiddenOccurrences:2,originalRestoredAfterRestart:true,formats:['docx','xlsx','pptx']},null,2));
 console.log('Ollama real, dos coincidencias, deshacer, reinicio cifrado y tres descargas comprobados.');
}finally{await browser.close();await app?.close();await rm(dir,{recursive:true,force:true});}
