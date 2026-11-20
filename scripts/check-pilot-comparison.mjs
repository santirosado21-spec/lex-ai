// Compare the authorized body from two opposite fictitious cases, using at most
// one real provider call when explicitly invoked with --openai.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {Document,Paragraph,Packer} from 'docx';

const live=process.argv.includes('--openai'),replay=process.argv.includes('--replay');
assert.ok(!(live&&replay));
const root=path.resolve(process.argv.find(x=>x.startsWith('--app='))?.slice(6)??'.');
const {startServer}=await import(pathToFileURL(path.join(root,'server/main.mjs')));
const {createIntakeGenerator}=await import(pathToFileURL(path.join(root,'server/intake-pilot.mjs')));
const topics={
 flete:{ids:['incluido','excluido','pendiente'],facts:['El precio pagado incluye el flete.','El precio pagado no incluye el flete.'],ref:'MX-FED-LADUA-65'},
 regalias:{ids:['pactada','negada','pendiente'],facts:['El pago de regalías es condición de venta.','El pago de las regalías no es condición de venta.'],ref:'MX-FED-LADUA-65'},
 acuse:{ids:['presente','ausente','pendiente'],facts:['Se adjunta el acuse de los anexos del pedimento.','Falta el acuse de los anexos del pedimento.'],ref:'MX-FED-LADUA-36-A'},
};
const subject=process.argv.includes('--regalias')?'regalias':process.argv.includes('--acuse')?'acuse':'flete';
const topic=topics[subject];
const outputBase=path.resolve('artifacts/contraste-r10',subject==='flete'?'.':subject);
const output=path.resolve(outputBase,live?'openai':replay?'replay':'simulado');
await mkdir(output,{recursive:true});
const fixture=Object.fromEntries(topic.ids.map((id,i)=>[id,{pasaje:'P'+(i+1),pregunta:'¿Qué documento respalda el precio de la mercancía?'}]));
const capture=(name,value)=>writeFile(path.join(output,name),JSON.stringify(value,null,2));
let completion=replay?JSON.parse(await readFile(path.join(outputBase,'openai/respuesta.json'),'utf8')):JSON.stringify(fixture);
const sent=[],receipts=[],pages=[];
const browser=await chromium.launch();
try{
 for(const [index,variant] of topic.ids.slice(0,2).entries()){
  const title='Revisión '+(index?'Boreal':'Ámbar')+' ficticia',client='Importadora '+(index?'Violeta':'Lirio')+' de Ensayo';
  const code=index?'EXP-17042':'EXP-33981';
  const fact=topic.facts[index];
  const support=fact+' Ref. '+code;
  const original=['Cliente: '+client,'Asunto: '+title,support,'Factura comercial: '+(index?'EF-86221':'EF-44877'),'Flete: USD '+(index?'1427.31':'3874.29')];
  const document=await Packer.toBuffer(new Document({sections:[{children:original.map(line=>new Paragraph(line))}]}));
  const dir=await mkdtemp(path.join(tmpdir(),'rejon-contraste-'));let app;
  const actual=live&&index===0;
  const generate=createIntakeGenerator({...(!actual?{getApiKey:async()=>'sk-'+'r'.repeat(32)}:{}),onReceipt:r=>receipts.push({actual,...r}),fetchImpl:async(url,opts)=>{
   assert.equal(url,'https://api.openai.com/v1/chat/completions');
   assert.equal(sent.length,index,'Se envió más de una consulta para un expediente.');
   for(const item of [client,title,code,'EF-44877','EF-86221','3874.29','1427.31','privado.docx'])assert.ok(!opts.body.includes(item));
   assert.equal(JSON.parse(opts.body).messages.length,1);sent.push(opts.body);
   if(actual){
    const response=await fetch(url,opts);
    if(response.ok){completion=(await response.clone().json()).choices[0].message.content;await capture('respuesta.json',completion);}
    return response;
   }
   return Response.json({model:'simulado',choices:[{finish_reason:'stop',message:{content:completion}}]});
  }});
  const launch=()=>startServer({intakePilot:true,intakeGenerate:generate,autoInitialize:false,dataDir:dir,pilotPassphrase:Buffer.from('frase de prueba de escenarios')});
  try{
   app=await launch();
   const p=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'}),external=[];
   p.on('request',r=>{if(r.url().startsWith('http')&&new URL(r.url()).origin!==new URL(app.connection.url).origin)external.push(r.url());});
   await p.goto(app.connection.url+'/#pilot=intake&token='+app.connection.token);
   await p.locator('#intake-firm').fill('Despacho Ficticio');await p.getByRole('button',{name:'Continuar'}).click();
   await p.locator('input[type=file]').setInputFiles({name:'privado.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:document});
   await p.getByRole('checkbox',{name:/Guardar el texto/}).waitFor({timeout:125000});
   await p.locator('#intake-client').fill(client);await p.locator('#intake-title').fill(title);
   await p.getByRole('button',{name:'Guardar en este equipo'}).click();
   const task='contraste-'+subject+'-'+variant;await p.locator('#intake-task').selectOption(task);
   assert.equal(await p.locator('#rp-variant').inputValue(),task);
   await p.getByText('Líneas del soporte local',{exact:true}).click();assert.ok((await p.locator('.rp-reading-evidence blockquote').first().innerText()).includes(code));
   await p.getByText('Leer el mensaje completo').click();const preview=await p.locator('.rp-proof .rp-preview').innerText();
   await p.getByRole('button',{name:'Enviar y generar borrador'}).click();
   await p.getByRole('button',{name:'Datos originales'}).waitFor({timeout:65000});
   assert.equal(JSON.parse(sent[index]).messages[0].content,preview);if(subject==='regalias')assert.ok(preview.includes('2013396')&&preview.includes('PC.I.A. J/90 A (10a.)'));await p.getByRole('button',{name:'Datos originales'}).click();
   await p.locator('.rp-document').filter({hasText:code}).waitFor();
   const note=await p.locator('.rp-document').innerText();assert.ok(note.includes(client)&&note.includes(title)&&note.includes(support)&&note.includes(topic.ref));
   if(!index){
    for(const [label,ext] of [['Word','docx'],['Excel','xlsx'],['PowerPoint','pptx']]){
     await p.getByRole('button',{name:label,exact:true}).click();const download=p.waitForEvent('download');
     await p.getByRole('button',{name:'Descargar .'+ext}).click();await(await download).saveAs(path.join(output,subject+'.'+ext));
    }
    await p.locator('#rp-variant').selectOption('contraste-'+subject+'-pendiente');
    for(const width of [320,390,768,1280]){
     await p.setViewportSize({width,height:900});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
    await p.locator('.rp-comparison').screenshot({path:path.join(output,'selector.png')});
    await p.getByRole('button',{name:'Preparar esta variante en mi equipo'}).click();
    await p.getByRole('button',{name:'Datos originales'}).waitFor();
    await app.close();app=await launch();const result=await app.service.dispatch('intake.status',{});
    assert.ok(result.drafts['contraste-'+subject+'-pendiente']&&result.drafts[task]);
    assert.equal(sent.length,1);
   }
   assert.deepEqual(external,[]);pages.push({suggested:variant,external:external.length,localEvidenceRestored:note.includes(support)});await p.close();
  }finally{await app?.close();await rm(dir,{recursive:true,force:true});}
 }
 assert.equal(sent[0],sent[1],'El cuerpo dependió del expediente.');
 await capture('mensaje-publico.json',JSON.parse(sent[0]));await capture('resultado.json',{identicalBodies:true,browser:pages,actualPosts:live?1:0,simulatedPosts:live?1:2,receipts});
 console.log('Dos archivos Word opuestos, solicitudes idénticas, restitución, tres exportaciones y reutilización local verificadas.');
}finally{await browser.close();}
