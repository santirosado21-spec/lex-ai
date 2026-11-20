import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const root=path.resolve(process.argv[2]??'.'),out=path.resolve(process.argv[3]??'artifacts/nico-r13/browser');
const {startServer}=await import(pathToFileURL(path.join(root,'server/main.mjs')));
const dataDir=await mkdtemp(path.join(tmpdir(),'rejon-nico-browser-'));
await mkdir(out,{recursive:true});
const start=()=>startServer({intakePilot:true,dataDir,autoInitialize:false,pilotPassphrase:Buffer.from('ejercicio ficticio de identificación')});
let app=await start();
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const outgoing=[],errors=[];
 page.on('request',request=>{if(/^https?:/.test(request.url())&&new URL(request.url()).origin!==new URL(app.connection.url).origin)outgoing.push(request.url());});
 page.on('pageerror',error=>errors.push(error.message));
 const open=()=>page.goto(app.connection.url+'/#pilot=intake&token='+app.connection.token);
 const button=name=>page.getByRole('button',{name,exact:true});
 await open();await page.locator('#intake-firm').fill('Firma del ensayo');await button('Continuar').click();
 await page.locator('#intake-client').fill('Tostadora Ficticia');await page.locator('#intake-title').fill('Expediente café');
 await button('Guardar en este equipo').click();await page.locator('#intake-task').waitFor();
 await button('Biblioteca federal').click();await button('Tarifa arancelaria').click();
 await page.getByRole('textbox',{name:'Fracción o descripción impresa'}).fill('09012199');
 await button('Buscar en la tarifa').click();await button('Consultar NICO').first().click();
 const results=page.locator('.rp-tariff article');
 await results.getByText('En cápsulas.',{exact:true}).waitFor();assert.equal(await results.count(),2);
 const book=page.waitForEvent('download');await results.first().getByRole('link',{name:/Libro SNICE/}).click();
 assert.equal((await book).suggestedFilename(),'NICO-SNICE-abril-2024.xlsx');
 const pdf=await results.first().getByRole('link',{name:/DOF/}).getAttribute('href');
 assert.equal((await page.request.get(new URL(pdf,app.connection.url).href)).headers()['content-type'],'application/pdf');
 for(const width of [320,390,768,1280]){
  await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 await page.locator('.rp-tariff').screenshot({path:path.join(out,'consulta.png')});
 await button('Guardar NICO 01').click();await button('Datos originales').click();
 await page.locator('.rp-document').getByText(/Tostadora Ficticia/).waitFor();
 for(const [label,ext] of [['Word','docx'],['Excel','xlsx'],['PowerPoint','pptx']]){
  await button(label).click();const downloaded=page.waitForEvent('download');await button('Descargar .'+ext).click();
  await(await downloaded).saveAs(path.join(out,'ficha.'+ext));
 }
 await button('Biblioteca federal').click();await button('Catálogo NICO').click();
 const query=page.getByRole('textbox',{name:/clave de diez dígitos/});
 await query.fill('0901219999');await button('Buscar NICO').click();await button('Guardar NICO 99').click();
 const comparison=page.waitForEvent('download');await button('Comparar fichas guardadas en Excel').click();
 await(await comparison).saveAs(path.join(out,'comparativo.xlsx'));
 await app.close();app=await start();await open();await page.locator('#intake-task').selectOption({label:'NICO 0901.21.99 · 01'});
 await button('Datos originales').click();await page.locator('.rp-document').getByText(/Tostadora Ficticia/).waitFor();
 assert.deepEqual(outgoing,[]);assert.deepEqual(errors,[]);
 const result={widths:[320,390,768,1280],exports:4,reopened:true,externalBrowserRequests:outgoing.length};
 await writeFile(path.join(out,'resultado.json'),JSON.stringify(result,null,2));console.log(result);
}finally{await browser.close();await app.close();await rm(dataDir,{recursive:true,force:true});}
