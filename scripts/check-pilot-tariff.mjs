import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const live=process.argv.includes('--openai'),replay=process.argv.includes('--replay');assert.ok(!(live&&replay));
const root=path.resolve(process.argv.find(a=>a.startsWith('--app='))?.slice(6)??'.');
const {startServer}=await import(pathToFileURL(path.join(root,'server/main.mjs')));
const {createIntakeGenerator}=await import(pathToFileURL(path.join(root,'server/intake-pilot.mjs')));
const base=path.resolve('artifacts/tarifa-r12'),out=path.join(base,live?'openai':replay?'replay':'simulado');
await mkdir(out,{recursive:true});const dataDir=await mkdtemp(path.join(tmpdir(),'rejon-tarifa-'));
let preview='',receipt,calls=0;
const generate=createIntakeGenerator({...(live?{}:{getApiKey:async()=>'sk-'+'t'.repeat(32)}),onReceipt:r=>{receipt=r;},fetchImpl:async(url,opts)=>{
 assert.equal(url,'https://api.openai.com/v1/chat/completions');assert.equal(++calls,1);
 assert.equal(JSON.parse(opts.body).messages[0].content,preview);assert.ok(preview.includes('8413.70.07')&&preview.includes('sistema de limpiaparabrisas'));
 for(const s of ['Níspero de Ensayo','Taller Lila','MUESTRA-BOMBA','Informe reservado','RV-72981'])assert.ok(!opts.body.includes(s));
 if(live){const r=await fetch(url,opts);if(r.ok)await writeFile(path.join(out,'respuesta.json'),(await r.clone().json()).choices[0].message.content);return r;}
 await writeFile(path.join(out,'consulta.txt'),preview);
 const raw=replay?await readFile(path.join(base,'openai/respuesta.json'),'utf8'):JSON.stringify({acciones:['Solicitamos la ficha técnica para revisar el uso específico del producto.','Por favor, comparta el catálogo que identifica la función de la bomba.']});
 return Response.json({model:'simulado',choices:[{finish_reason:'stop',message:{content:raw}}]});
}});
const start=()=>startServer({intakePilot:true,intakeGenerate:generate,dataDir,autoInitialize:false,pilotPassphrase:Buffer.from('ejercicio local de fracciones')});
let app=await start();const browser=await chromium.launch();
try{
 const p=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'}),external=[];
 const open=()=>p.goto(app.connection.url+'/#pilot=intake&token='+app.connection.token);
 p.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(app.connection.url).origin)external.push(r.url());});
 await open();await p.locator('#intake-firm').fill('Despacho Ficticio');await p.getByRole('button',{name:'Continuar'}).click();
 await p.locator('input[type=file]').setInputFiles(path.join(root,'piloto/fraccion-limpiaparabrisas-ficticia.txt'));
 await p.getByRole('checkbox',{name:/Guardar el texto/}).waitFor({timeout:125000});await p.locator('#intake-client').fill('Manufacturas Níspero de Ensayo');await p.locator('#intake-title').fill('Informe reservado RV-72981');
 await p.getByRole('button',{name:'Guardar en este equipo'}).click();await p.locator('#intake-task').selectOption('lectura-clasificacion');
 await p.getByRole('button',{name:'Buscar fracción en la tarifa'}).click();
 const search=p.getByRole('textbox',{name:'Fracción o descripción impresa'});await search.fill('0401.40.02');await p.getByRole('button',{name:'Buscar en la tarifa'}).click();
 await p.getByRole('link',{name:'Abrir página 862',exact:true}).waitFor();assert.ok((await p.locator('.rp-tariff article').count())>=4);
 await p.locator('.rp-tariff article').filter({has:p.getByRole('link',{name:'Abrir página 862',exact:true})}).getByRole('button',{name:'Guardar ficha'}).click();
 await p.getByRole('button',{name:'Datos originales'}).waitFor();assert.equal(calls,0);
 await p.getByRole('button',{name:'Biblioteca federal',exact:true}).click();
 await search.fill('8414.30.05');await p.getByRole('button',{name:'Buscar en la tarifa'}).click();await p.getByRole('link',{name:'Continuación · página 632'}).waitFor();
 await p.getByText(/volumétrico de hasta 15 m³ por minuto/).waitFor();
 await search.fill('limpiaparabrisas');await p.getByRole('button',{name:'Buscar en la tarifa'}).click();
 await p.locator('.rp-tariff article').filter({hasText:'8413.70.07'}).waitFor();
 await p.getByRole('button',{name:'8413.70.07',exact:true}).click();
 const row=p.locator('.rp-tariff article').filter({hasText:'8413.70.07'});await row.waitFor();await row.getByRole('link',{name:'Abrir página 631'}).waitFor();
 const link=await row.getByRole('link',{name:'Abrir página 631'}).getAttribute('href');const file=await p.request.get(new URL(link,app.connection.url).href);
 assert.equal(file.headers()['content-type'],'application/pdf');assert.equal(createHash('sha256').update(await file.body()).digest('hex'),'955510d7ea82cf42d18c72e3146f999af254c0fda5eda3f12a1fd1c10e9864ce');
 for(const width of [320,390,768,1280]){await p.setViewportSize({width,height:900});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await p.locator('.rp-tariff').screenshot({path:path.join(out,'tarifa.png')});
 await row.getByRole('button',{name:'Guardar ficha'}).click();await p.getByRole('button',{name:'Datos originales'}).click();
 await p.locator('.rp-document').filter({hasText:'MUESTRA-BOMBA-041'}).waitFor();assert.equal(calls,0);
 const download=async(name)=>{for(const [label,ext] of [['Word','docx'],['Excel','xlsx'],['PowerPoint','pptx']]){
  await p.getByRole('button',{name:label,exact:true}).click();const dl=p.waitForEvent('download');await p.getByRole('button',{name:'Descargar .'+ext}).click();await(await dl).saveAs(path.join(out,name+'.'+ext));}};
 await download('ficha');const comparisonDownload=p.waitForEvent('download');
 await p.getByRole('button',{name:'Comparar fichas guardadas en Excel'}).click();await(await comparisonDownload).saveAs(path.join(out,'comparativo.xlsx'));await p.getByLabel('Documentos que quieres revisar (opcional)').fill('Pide la ficha técnica de RV-72981.');
 await p.getByRole('button',{name:'Preparar solicitud al cliente'}).click();const send=p.getByRole('button',{name:'Enviar y generar borrador'});
 await send.waitFor();preview=await p.locator('.rp-proof .rp-preview').innerText();await send.click();
 await p.getByRole('button',{name:'Datos originales'}).waitFor({timeout:50000});await p.getByRole('button',{name:'Datos originales'}).click();
 await p.locator('.rp-document').filter({hasText:'Manufacturas Níspero'}).waitFor();assert.ok(!(await p.locator('.rp-document').innerText()).includes('MUESTRA-BOMBA-041'));
 await download('solicitud');
 await app.close();app=await start();await open();await p.locator('#intake-task').selectOption('tarifa-8413.70.07-631-955510d7ea82');await p.getByRole('button',{name:'Datos originales'}).click();await p.locator('.rp-document').filter({hasText:'MUESTRA-BOMBA-041'}).waitFor();
 assert.deepEqual(external,[]);assert.equal(calls,1);const result={real:live,calls,receipt,sourcePage:631,reopened:true,exports:7,externalBrowserRequests:0};await writeFile(path.join(out,'resultado.json'),JSON.stringify(result,null,2));console.log(result);
}finally{await browser.close();await app.close();await rm(dataDir,{recursive:true,force:true});}
