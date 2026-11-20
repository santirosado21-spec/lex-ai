import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {Document,Paragraph,Packer} from 'docx';

const root=path.resolve(process.argv.find(x=>x.startsWith('--app='))?.slice(6)??'.');
const out=path.resolve('artifacts/documentos-r15',root===path.resolve('.')?'navegador':'paquete');
await mkdir(out,{recursive:true});
const {startServer}=await import(pathToFileURL(path.join(root,'server/main.mjs')));
const {createIntakeGenerator}=await import(pathToFileURL(path.join(root,'server/intake-pilot.mjs')));
const fixture=JSON.parse(await readFile('fixtures/public-cases/contraste-flete-r15.json'));
const messages=[],requests=[],errors=[];
const generate=createIntakeGenerator({getApiKey:async()=>'sk-'+'x'.repeat(32),fetchImpl:async(_url,opts)=>{
 assert.equal(createHash('sha256').update(opts.body).digest('hex'),fixture.sha256);
 messages.push(JSON.parse(opts.body));
 return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(fixture.response)}}]});
}});
const dir=await mkdtemp(path.join(tmpdir(),'rejon-expediente-'));
const browser=await chromium.launch();
const launch=()=>startServer({intakePilot:true,intakeGenerate:generate,autoInitialize:false,dataDir:dir,pilotPassphrase:Buffer.from('una frase de uso ficticio')});
let app;
try{
 app=await launch();const p=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});
 p.setDefaultTimeout(125000);
 p.on('request',r=>{if(r.url().startsWith('http')&&new URL(r.url()).origin!==new URL(app.connection.url).origin)requests.push(r.url());});
 p.on('pageerror',e=>errors.push(e.message));
 const open=()=>p.goto(app.connection.url+'/#pilot=intake&token='+app.connection.token);
 const button=name=>p.getByRole('button',{name,exact:true});
 const download=async(name,file)=>{
  const waiting=p.waitForEvent('download');await button(name).click();
  const item=await waiting;await item.saveAs(path.join(out,file));return readFile(path.join(out,file));
 };
 await open();
 await p.locator('#intake-firm').fill('Despacho de Ensayo');await button('Continuar').click();
 await p.locator('#intake-title').fill('Cotejo de embarque ficticio');await p.locator('#intake-client').fill('Importadora Lirio de Ensayo');await button('Guardar en este equipo').click();
 await button('Documentos del expediente (0)').click();
 const invoice=await readFile(path.join(root,'piloto/factura-cotejo-ficticia.txt'));
 const contractText=await readFile(path.join(root,'piloto/contrato-cotejo-ficticio.txt'),'utf8');
 const contract=await Packer.toBuffer(new Document({sections:[{children:contractText.trimEnd().split('\n').map(line=>new Paragraph(line))}]}));
 for(const [index,[label,filename,bytes,mime]] of [
  ['Factura comercial','factura.txt',invoice,'text/plain'],
  ['Contrato de compraventa','contrato.docx',contract,'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
 ].entries()){
  await button('Añadir documento').click();
  await p.locator('input[type=file]').setInputFiles({name:filename,mimeType:mime,buffer:bytes});
  await p.getByText(/Revisar protección local/).waitFor();
  await p.getByLabel('Nombre en el expediente').fill(label);await button('Guardar documento en este equipo').click();
  await button('Documentos del expediente ('+(index+1)+')').waitFor();
 }
 assert.deepEqual(await download('Descargar .docx','original.docx'),contract);
 await button('Cotejar documentos').click();
 await p.getByText(/Los documentos contienen afirmaciones incompatibles/).waitFor();
 await p.getByText('Líneas del soporte local',{exact:true}).click();
 const quotes=await p.locator('.rp-reading-evidence blockquote').allInnerTexts();
 assert.ok(!!quotes.find(x=>x.includes('Factura comercial')&&x.includes('FM-38214')));
 assert.ok(!!quotes.find(x=>x.includes('Contrato de compraventa')&&x.includes('CT-41726')));
 await download('Descargar cruce documental en Excel','cruce.xlsx');assert.equal(messages.length,0);
 await p.getByText('Leer el mensaje completo').click();
 const shown=await p.locator('.rp-proof .rp-preview').innerText();
 for(const width of [320,390,768,1280]){
  await p.setViewportSize({width,height:900});
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Desborde a '+width);
 }
 await p.locator('.rp-comparison').screenshot({path:path.join(out,'cotejo.png')});
 await button('Enviar y generar borrador').click();await button('Datos originales').click();
 assert.equal(messages.length,1);assert.equal(messages[0].messages[0].content,shown);
 const doc=p.locator('.rp-document');await doc.filter({hasText:'CT-41726'}).waitFor();
 const restored=await doc.innerText();assert.ok(restored.includes('FM-38214')&&restored.includes('MX-FED-LADUA-65'));
 for(const [label,ext] of [['Word','docx'],['Excel','xlsx'],['PowerPoint','pptx']]){
  await button(label).click();await download('Descargar .'+ext,'nota.'+ext);
 }
 await app.close();app=await launch();await open();
 await button('Documentos del expediente (2)').click();
 assert.deepEqual(await download('Descargar .txt','original.txt'),invoice);
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 await writeFile(path.join(out,'resultado.json'),JSON.stringify({actualOpenAIRequests:0,publicRequestReplay:messages.length,externalBrowserRequests:requests.length,viewports:[320,390,768,1280],quotes,matchedOriginalsAfterImport:true,restored},null,2));
 console.log('Ollama, dos originales, cotejo previo al envío, reproducción pública y exportaciones verificados.');
}finally{await browser.close();await app?.close();await rm(dir,{recursive:true,force:true});}
