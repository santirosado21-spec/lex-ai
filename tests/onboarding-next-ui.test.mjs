import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm,access,mkdir,realpath} from 'node:fs/promises';import path from 'node:path';import {tmpdir} from 'node:os';import {fileURLToPath} from 'node:url';import {chromium,expect} from '@playwright/test';import {createServer} from 'vite';import react from '@vitejs/plugin-react';import {startServer} from '../server/main.mjs';
test('onboarding continues through matter and document without starting inference',async()=>{
 const root=fileURLToPath(new URL('..',import.meta.url)),dir=await mkdtemp(path.join(tmpdir(),'setup-ui-')),cache=await mkdtemp(path.join(tmpdir(),'setup-vite-')),evidence=process.env.REJON_UI_EVIDENCE_DIR||await mkdtemp(path.join(tmpdir(),'setup-pixels-'));let app,vite,browser,calls=0,starts=0;
 try{
  app=await startServer({dataDir:dir,libraryPath:path.join(dir,'absent'),autoInitialize:true,inference:{status:async()=>({state:'stopped'}),stop:async()=>{},initialize:async()=>{starts++;},async *generate(){calls++;throw Error('forbidden inference');}}});
  vite=await createServer({root,cacheDir:cache,configFile:false,plugins:[react()],server:{host:'127.0.0.1',port:0,fs:{allow:[root,await realpath(path.join(root,'node_modules'))]}},logLevel:'error'});await vite.listen();let options={headless:true};try{await access(chromium.executablePath());}catch{options.channel='chrome';}browser=await chromium.launch(options);const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));let analyzeRequests=0,rejectWorkspace=true;
  await page.route('**/api',async route=>{if(route.request().postDataJSON()?.action==='workspace.create'&&rejectWorkspace){rejectWorkspace=false;await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Fallo sintético al crear despacho'})});return;}const r=await route.fetch({url:app.connection.url+'/api',headers:{Authorization:'Bearer '+app.connection.token,'Content-Type':'application/json'}});await route.fulfill({response:r});});
  await page.route('**/analyze',async route=>{analyzeRequests++;await route.abort();});
  await page.goto('http://127.0.0.1:'+vite.httpServer.address().port+'/#token=synthetic');
  const steps=page.getByRole('list',{name:'Preparación del espacio'});
  await expect(steps.locator('[aria-current=step]')).toContainText('Crear tu despacho');
  await page.getByLabel('Nombre del despacho').fill('Despacho sintético de inicio');
  await page.getByRole('button',{name:'Crear espacio privado',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Fallo sintético');await expect(steps.locator('[aria-current=step]')).toContainText('Crear tu despacho');
  await page.getByRole('button',{name:'Crear espacio privado',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Asuntos',exact:true})).toBeVisible();
  await expect(steps.locator('[aria-current=step]')).toContainText('Crear primer asunto');
  await expect(page.getByText('Las respuestas del asistente siguen sin activar',{exact:false})).toBeVisible();
  await mkdir(evidence,{recursive:true});await page.screenshot({path:path.join(evidence,'setup-created.png'),fullPage:true});
  await page.reload();await expect(page.getByRole('button',{name:'Crear primer asunto',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Crear primer asunto',exact:true}).click();
  await page.getByLabel('Nombre del asunto').fill('Contrato sintético de inicio');await page.getByLabel('Cliente',{exact:true}).fill('Parte ficticia');await page.getByRole('button',{name:'Crear asunto',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Documentos',exact:true})).toBeVisible();
  await expect(steps.locator('[aria-current=step]')).toContainText('Importar documento');
  await page.screenshot({path:path.join(evidence,'setup-import.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(evidence,'setup-import-narrow.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewportSize({width:1280,height:900});
  await page.getByLabel('Seleccionar documento',{exact:true}).setInputFiles({name:'contrato-sintetico.txt',mimeType:'text/plain',buffer:Buffer.from('Contrato sintético. Las partes revisan el documento de prueba sin datos personales.')});
  await expect(page.locator('.file-open-button').filter({hasText:'contrato-sintetico.txt'})).toBeVisible();
  await expect(page.getByRole('region',{name:'Primeros pasos'})).toHaveCount(0);
  const state=await app.service.dispatch('state');assert.equal(state.matters.length,1);assert.equal(state.documents.length,1);assert.equal(state.documents[0].matterId,state.matters[0].id);
  await page.getByRole('button',{name:'Asistente',exact:true}).click();await expect(page.getByRole('button',{name:'Preguntar',exact:true})).toBeDisabled();
  assert.equal(calls,0);assert.equal(starts,0);assert.equal(analyzeRequests,0);assert.deepEqual(errors,[]);
 }finally{await browser?.close();await vite?.close();await app?.close();await rm(dir,{recursive:true,force:true});await rm(cache,{recursive:true,force:true});if(!process.env.REJON_UI_EVIDENCE_DIR)await rm(evidence,{recursive:true,force:true});}
});
