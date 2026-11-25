import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm,access,mkdir} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';import {chromium,expect} from '@playwright/test';import {createServer} from 'vite';import react from '@vitejs/plugin-react';
import {startServer} from '../server/main.mjs';import {emptyLocalReading} from './helpers/local-reader.mjs';
test('real question UI and service reject ranges and over-cap lists instead of showing a silent subset',async t=>{
 const root=fileURLToPath(new URL('..',import.meta.url)),dir=await mkdtemp(path.join(tmpdir(),'reference-ui-'));let app,server,browser;
 try{
 app=await startServer({dataDir:dir,intakePilot:true,pilotPassphrase:Buffer.from('synthetic reference scope'),autoInitialize:false,libraryPath:path.join(dir,'absent'),intakeGenerate:()=>assert.fail('no cloud')});
 await app.service.dispatch('intake.save',{firm:'Despacho sintético',client:'Cliente sintético',title:'Consulta sintética',jurisdiction:'MX-FED'});
 const nativeFetch=globalThis.fetch;t.mock.method(globalThis,'fetch',async(url,opts)=>{
  if(String(url)==='http://127.0.0.1:11434/api/chat'){const req=JSON.parse(opts.body);return Response.json({message:{content:JSON.stringify(emptyLocalReading(req.format.properties))}});}
  return nativeFetch(url,opts);
 });
 server=await createServer({root,configFile:false,plugins:[react()],logLevel:'error',server:{host:'127.0.0.1',port:0}});await server.listen();let options={headless:true};try{await access(chromium.executablePath());}catch{options.channel='chrome';}browser=await chromium.launch(options);
 const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'}),actions=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api',async route=>{const {action,payload}=route.request().postDataJSON();actions.push(action);assert.equal(action,'intake.inspectQuestion');try{await route.fulfill({json:await app.service.dispatch(action,payload)});}catch(e){await route.fulfill({status:400,json:{error:e.message}});}});
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tests/fixtures/question-reference-scope/index.html#token=synthetic`);
 await page.getByRole('button',{name:'Consultar con una pregunta propia'}).click();const text=page.getByLabel('Pregunta del expediente');const find=page.getByRole('button',{name:'Buscar fundamentos en este equipo'});
 await text.fill('Coteja los artículos 66–70 de la Ley Aduanera.');await find.click();await expect(page.getByRole('alert')).toContainText('Los rangos de artículos no están disponibles');await expect(page.getByLabel('Pasaje que quieres consultar')).toHaveCount(0);await expect(page.getByRole('button',{name:'Preparar mensaje para revisión'})).toHaveCount(0);await expect(text).toHaveValue(/66–70/);
 await text.fill('Coteja los artículos 66 y 67 de la Ley Aduanera.');await find.click();await expect(page.getByRole('alert')).toContainText('más de ocho pasajes');await expect(page.getByRole('alert')).toContainText('no se seleccionó un subconjunto');await expect(page.getByLabel('Pasaje que quieres consultar')).toHaveCount(0);
 const evidence=process.env.REJON_UI_EVIDENCE_DIR||await mkdtemp(path.join(tmpdir(),'reference-evidence-'));await mkdir(evidence,{recursive:true});await page.screenshot({path:path.join(evidence,'scope-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(evidence,'scope-narrow.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await text.fill('Coteja los artículos 97 y 117 de la Ley Aduanera.');await find.click();await expect(page.getByRole('alert')).toHaveCount(0);const optionsList=page.getByLabel('Pasaje que quieres consultar').locator('option');await expect(optionsList).toHaveCount(6);assert.ok((await optionsList.allTextContents()).some(x=>x.includes('Art. 117')));await page.getByRole('button',{name:'Preparar mensaje para revisión'}).click();await expect(page.getByLabel('Selección preparada')).toContainText('reviewId');assert.equal(actions.length,3);assert.deepEqual(errors,[]);
 if(!process.env.REJON_UI_EVIDENCE_DIR)await rm(evidence,{recursive:true,force:true});
 }finally{await browser?.close();await server?.close();await app?.close();await rm(dir,{recursive:true,force:true});}
});


test('real service closes unsupported range and explicit candidate-limit boundaries without changing supported suffixes or lists',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'reference-api-'));let app;
 try{
 app=await startServer({dataDir:dir,intakePilot:true,pilotPassphrase:Buffer.from('synthetic reference scope'),autoInitialize:false,libraryPath:path.join(dir,'absent'),intakeGenerate:()=>assert.fail('no cloud')});
 await app.service.dispatch('intake.save',{firm:'Despacho sintético',client:'Cliente sintético',title:'Consulta sintética',jurisdiction:'MX-FED'});
 t.mock.method(globalThis,'fetch',async(url,opts)=>{assert.equal(url,'http://127.0.0.1:11434/api/chat');const req=JSON.parse(opts.body);return Response.json({message:{content:JSON.stringify(emptyLocalReading(req.format.properties))}});});
 const inspect=text=>app.service.dispatch('intake.inspectQuestion',{text});
 for(const scope of ['66–70','66-70','66—70','66 a 70','66 al 70','66 hasta 70','64, 66 a 70','36-A a 36-C'])await assert.rejects(inspect('Coteja los artículos '+scope+' de la Ley Aduanera.'),/Los rangos de artículos no están disponibles/);
 for(const scope of ['66 y 67','66, 67 y 68','69 y 70'])await assert.rejects(inspect('Coteja los artículos '+scope+' de la Ley Aduanera.'),/más de ocho pasajes/);
 const eight=await inspect('Coteja el artículo 68 de la Ley Aduanera.');assert.equal(eight.candidates.length,8);assert.ok(eight.candidates.some(c=>c.key==='aduana-68/7'));
 const suffix=await inspect('Coteja el artículo 36-A de la Ley Aduanera.');assert.equal(suffix.candidates.length,3);assert.ok(suffix.candidates.every(c=>c.citationId==='MX-FED-LADUA-36-A'));
 const list=await inspect('Coteja los artículos 97 y 117 de la Ley Aduanera.');assert.equal(list.candidates.length,6);assert.deepEqual(new Set(list.candidates.map(c=>c.citationId)),new Set(['MX-FED-LADUA-97','MX-FED-LADUA-117']));
 const regulation=await inspect('Coteja los artículos 150 y 174 del Reglamento de la Ley Aduanera.');assert.equal(regulation.candidates.length,3);
 await assert.rejects(inspect('Coteja los artículos 150–174 del Reglamento de la Ley Aduanera.'),/Los rangos de artículos no están disponibles/);
 }finally{await app?.close();await rm(dir,{recursive:true,force:true});}
});
