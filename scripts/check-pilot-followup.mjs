// Exercise the real packaged UI and local Ollama. --openai authorizes live
// requests for the two follow-ups only. --replay reuses their saved responses.
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {chromium} from 'playwright';
import {Document,Paragraph,Packer} from 'docx';
import {createHash} from 'node:crypto';
const live=process.argv.includes('--openai'),replay=process.argv.includes('--replay');
assert.ok(!(live&&replay));
const root=path.resolve(process.argv.find(arg=>arg.startsWith('--app='))?.slice(6)??'.');
const {startServer}=await import(pathToFileURL(path.join(root,'server/main.mjs')));
const {createIntakeGenerator}=await import(pathToFileURL(path.join(root,'server/intake-pilot.mjs')));
const base=path.resolve('artifacts/seguimiento-r11'),output=path.join(base,live?'openai':replay?'replay':'simulado');
await mkdir(output,{recursive:true});
const example=['Cliente: Operadora Jacaranda de Ensayo','Asunto: Simulación Puerto Violeta','Revisar el valor en aduana del lote EJEMPLO-8179.','Flete: USD 412.75'];
const client='Operadora Jacaranda de Ensayo',title='Simulación Puerto Violeta',edit='Anotación reservada del despacho Violeta 9408.';
const doc=await Packer.toBuffer(new Document({sections:[{children:example.map(t=>new Paragraph(t))}]}));
const parent='lectura-valoracion';
const first=JSON.stringify({A:{pasaje:'A2',solicitud:'¿Qué documento identifica el precio pagado?'},B:{pasaje:'B2',solicitud:'¿Qué documento aporta el desglose del flete?'}});
const instruction='Para Vendedora Níspero 9307, pide la factura y el comprobante de pago.';
const recorded=replay?JSON.parse(await readFile(path.join(base,'openai/resultado.json'),'utf8')):null;
const names={carta:'Preparar solicitud al cliente',control:'Preparar lista de cotejo'};
const actions={carta:['Solicitamos la factura comercial para cotejar las condiciones del precio.','Por favor, remita el comprobante de pago para identificar el gasto.'],control:['Verificar el precio pactado en el contrato de compraventa.','Cotejar los gastos de transporte contra la factura de flete.']};
let form='primera',preview='',count=0;
const receipts=[],posted=[],exports=[];
const generate=createIntakeGenerator({...(live?{}:{getApiKey:async()=>'sk-'+'p'.repeat(32)}),onReceipt:r=>receipts.push({form,...r}),fetchImpl:async(url,opts)=>{
 assert.equal(url,'https://api.openai.com/v1/chat/completions');
 const prompt=JSON.parse(opts.body).messages[0].content;
 assert.equal(prompt,preview);
 for(const word of [edit,client,title,'Níspero','9307','8179','412.75','COTEJO-DEMO-3946','privado.docx','[[SOPORTE]]'])assert.ok(!opts.body.includes(word),word);
 posted.push({form,hash:createHash('sha256').update(opts.body).digest('hex')}); count++;
 if(form!=='primera')await writeFile(path.join(output,form+'-consulta.txt'),prompt);
 if(live&&form!=='primera'){
  const r=await fetch(url,opts);
  if(r.ok)await writeFile(path.join(output,form+'-respuesta.json'),(await r.clone().json()).choices[0].message.content);
  return r;
 }
 const result=form==='primera'?first:replay?await readFile(path.join(base,'openai',form+'-respuesta.json'),'utf8'):JSON.stringify({acciones:actions[form]});
 const used=recorded?.receipts.find(item=>item.form===form)?.usage;
 const usage=used?{prompt_tokens:used.promptTokens,completion_tokens:used.completionTokens}:!live?{prompt_tokens:400,completion_tokens:75}:undefined;
 return Response.json({model:'simulado',usage,choices:[{finish_reason:'stop',message:{content:result}}]});
}});
const dir=await mkdtemp(path.join(tmpdir(),'rejon-seguimiento-'));
const launch=()=>startServer({intakePilot:true,intakeGenerate:generate,dataDir:dir,autoInitialize:false,pilotPassphrase:Buffer.from('frase ficticia del expediente')});
let app=await launch();
const browser=await chromium.launch();
try{
 const p=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'}),external=[],errors=[];
 p.on('request',r=>{if(r.url().startsWith('http')&&new URL(r.url()).origin!==new URL(app.connection.url).origin)external.push(r.url());});
 p.on('pageerror',e=>errors.push(e.message));
 const open=()=>p.goto(app.connection.url+'/#pilot=intake&token='+app.connection.token);
 await open();await p.locator('#intake-firm').fill('Despacho de Práctica');await p.getByRole('button',{name:'Continuar'}).click();
 await p.locator('input[type=file]').setInputFiles({name:'privado.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:doc});
 await p.getByRole('checkbox',{name:/Guardar el texto/}).waitFor({timeout:125000});await p.locator('#intake-title').fill(title);await p.locator('#intake-client').fill(client);
 await p.getByRole('button',{name:'Guardar en este equipo'}).click();await p.locator('#intake-task').selectOption(parent);
 await p.getByRole('button',{name:'Control de valoración'}).click();
 await p.getByRole('combobox',{name:'Concepto',exact:true}).selectOption('transporte');
 await p.getByRole('button',{name:'Usar dato del soporte'}).click();
 assert.equal(await p.getByLabel('Importe',{exact:true}).inputValue(),'412.75');
 await p.getByLabel('Observación',{exact:true}).fill('COTEJO-DEMO-3946');
 await p.getByRole('button',{name:'Guardar renglón'}).click();await p.getByText('Renglón guardado en el expediente.').waitFor();
 await p.getByText('Leer el mensaje completo',{exact:true}).click();preview=await p.locator('.rp-proof .rp-preview').innerText();
 const send=p.getByRole('button',{name:'Enviar y generar borrador'});await send.click();
 await p.getByRole('button',{name:'Editar borrador'}).click();
 const editor=p.locator('#intake-edit');await editor.fill((await editor.inputValue())+'\n'+edit);await p.getByRole('button',{name:'Guardar cambios'}).click();
 for(const kind of ['carta','control']){
  form=kind;
  if(form==='carta'){
   const entry=p.getByLabel('Documentos que quieres revisar (opcional)');
   await entry.fill(instruction);
   for(const width of [320,390,768,1280]){
    await p.setViewportSize({width,height:900});
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.ok(await entry.evaluate(e=>e.getBoundingClientRect().width>180));
   }
   await p.locator('section.rp-followup').screenshot({path:path.join(output,'indicacion.png')});
  }
  await p.getByRole('button',{name:names[form]}).click();await send.waitFor();
  preview=await p.locator('.rp-proof .rp-preview').innerText();
  assert.ok(preview.includes('MX-FED-LADUA-64')&&preview.includes('MX-FED-LADUA-65'));
  if(form==='carta')assert.ok(preview.includes('factura comercial y comprobante de pago'));
  await send.click();await p.getByRole('button',{name:'Datos originales'}).waitFor({timeout:50000});await p.getByRole('button',{name:'Datos originales'}).click();
  const note=p.locator('.rp-document');await note.filter({hasText:client}).waitFor();const draft=await note.innerText();
  assert.ok(draft.includes(title)&&!draft.includes(edit));assert.equal(draft.includes('EJEMPLO-8179'),form==='control');assert.equal(draft.includes('COTEJO-DEMO-3946'),form==='control');
  for(const width of [320,390,768,1280]){
   await p.setViewportSize({width,height:900});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  for(const [label,ext] of [['Word','docx'],['Excel','xlsx'],['PowerPoint','pptx']]){
   await p.getByRole('button',{name:label,exact:true}).click();const dl=p.waitForEvent('download');
   await p.getByRole('button',{name:'Descargar .'+ext}).click();await(await dl).saveAs(path.join(output,form+'.'+ext));exports.push(form+'.'+ext);
  }
  await p.locator('.rp-document').screenshot({path:path.join(output,form+'.png')});
  await p.getByRole('button',{name:'Volver al primer borrador'}).click();assert.ok((await p.locator('.rp-document').innerText()).includes(edit));
 }
 await app.close();app=await launch();await open();
 await p.locator('#intake-task').selectOption('revision-carta-factura-pago-'+parent);await p.getByRole('button',{name:'Datos originales'}).click();
 await p.locator('.rp-document').filter({hasText:client}).waitFor();
 await p.getByRole('button',{name:'Volver al primer borrador'}).click();await p.getByRole('button',{name:names.control}).click();
 await p.getByRole('button',{name:'Datos originales'}).click();await p.locator('.rp-document').filter({hasText:'EJEMPLO-8179'}).waitFor();
 if(replay)assert.deepEqual(posted,recorded.posted);
 assert.equal(count,3);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 const report={liveRequests:live?2:0,posted,receipts,exports,reopened:true,externalBrowserRequests:external.length};
 await writeFile(path.join(output,'resultado.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();await app.close();await rm(dir,{recursive:true,force:true});}
