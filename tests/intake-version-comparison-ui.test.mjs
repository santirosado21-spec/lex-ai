import test from 'node:test';import assert from 'node:assert/strict';import {chromium,expect} from '@playwright/test';import {createServer} from 'vite';import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';import {access,mkdir} from 'node:fs/promises';import path from 'node:path';import {tmpdir} from 'node:os';import {createHash} from 'node:crypto';import {compareTexts} from '../server/doc-compare.mjs';
test('sealed document UI selects versions, reads actual local redline and clears stale comparison when selection changes',async()=>{
 const root=fileURLToPath(new URL('..',import.meta.url));const server=await createServer({root,configFile:false,plugins:[react()],logLevel:'error',server:{host:'127.0.0.1',port:0}});await server.listen();let options={headless:true};try{await access(chromium.executablePath());}catch{options={...options,channel:'chrome'};}
 const browser=await chromium.launch(options);
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'}),calls=[],errors=[];let releaseDelayed;const delayed=new Promise(resolve=>{releaseDelayed=resolve;});
  const a='Entrega en 20 días. El comprador acepta la revisión.',b='Entrega en 30 días. El comprador no acepta la revisión.';
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api',async route=>{const {action,payload}=route.request().postDataJSON();calls.push(action);assert.equal(action,'intake.compareVersions');assert.deepEqual(payload.ids,['a','b']);if(calls.length===3){await route.fulfill({status:500,json:{error:'Comparación no disponible para ensayo.'}});return;}if(calls.length===4)await delayed;await route.fulfill({json:{documents:[a,b].map((text,i)=>({id:i?'b':'a',label:i?'Contrato revisado sintético':'Contrato base sintético',sha256:createHash('sha256').update(text).digest('hex'),characters:text.length})),result:{...compareTexts(a,b),truncated:calls.length===2}}});});
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tests/fixtures/intake-version-comparison/index.html#token=synthetic`);
  await page.getByRole('button',{name:'Documentos del expediente (2)'}).click();
  const compare=page.getByRole('button',{name:'Comparar versiones en este equipo'});await compare.click();
  const view=page.getByRole('region',{name:'Comparación local de versiones'});
  await expect(view).toContainText('No es análisis jurídico');await expect(view.locator('del')).toContainText('20');await expect(view.locator('ins')).toHaveText(['30 ','no ']);
  await expect(view.getByLabel('Versiones comparadas')).toContainText('A · Base: Contrato base sintético');
  const evidence=process.env.REJON_UI_EVIDENCE_DIR||path.join(tmpdir(),'rejon-version-evidence');await mkdir(evidence,{recursive:true});await page.screenshot({path:path.join(evidence,'versions-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(evidence,'versions-narrow.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await view.getByRole('button',{name:'Cerrar comparación y limpiar texto'}).click();await expect(view.getByLabel('Cambios entre versiones')).toHaveCount(0);
  await compare.click();await expect(view.getByRole('alert')).toContainText('Comparación parcial');await page.getByRole('combobox').nth(1).selectOption('a');await expect(view.getByLabel('Cambios entre versiones')).toHaveCount(0);await expect(compare).toBeDisabled();
  await page.getByRole('combobox').nth(1).selectOption('b');await compare.click();await expect(view.getByRole('alert')).toContainText('Comparación no disponible');await expect(view.getByLabel('Cambios entre versiones')).toHaveCount(0);
  await compare.click();await expect.poll(()=>calls.length).toBe(4);await page.getByRole('combobox').nth(1).selectOption('a');releaseDelayed();await expect(compare).toBeDisabled();await page.waitForTimeout(100);await expect(view.getByLabel('Cambios entre versiones')).toHaveCount(0);await expect(view.getByRole('alert')).toHaveCount(0);
  assert.deepEqual(calls,Array(4).fill('intake.compareVersions'));assert.deepEqual(errors,[]);
 }finally{await browser.close();await server.close();}
});
