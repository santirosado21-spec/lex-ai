import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {mkdir,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
test('local support search highlights only the visible source and clears private queries between views',async()=>{
 const root=fileURLToPath(new URL('..',import.meta.url));
 const server=await createServer({root,configFile:false,plugins:[react()],logLevel:'error',server:{host:'127.0.0.1',port:0}});
 await server.listen();
 let launchOptions={headless:true};
 try{await access(chromium.executablePath());}catch{launchOptions={...launchOptions,channel:'chrome'};}
 const browser=await chromium.launch(launchOptions);
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'}),errors=[],calls=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api',async route=>{
   const {action,payload}=route.request().postDataJSON();calls.push({action,payload});assert.equal(action,'intake.readDocument');
   await route.fulfill({json:payload.id==='two'?{masked:'Contrato sin pago.',original:'Contrato original sin pago.',needsReview:false,tokens:[]}:{masked:'Factura de [[CLIENTE]].\nEl flete se declaró en la factura.\nOtro flete consta en el soporte.\nPago no es pago.\nLiteral .* disponible.',original:'Factura de Persona Sintética.\nEl flete se declaró en la factura.\nOtro flete consta en el soporte.',needsReview:false,tokens:[]}});
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tests/fixtures/support-search/index.html#token=synthetic`);
  await page.getByRole('button',{name:'Consultar soporte local'}).click();
  const query=page.getByRole('searchbox',{name:'Buscar texto exacto en este soporte'}),text=page.getByLabel('Texto del soporte');
  const original=await text.textContent();
  await query.fill('flete');await query.press('Enter');
  await expect(page.getByRole('status')).toHaveText('Coincidencia 1 de 2');
  await expect(text.locator('mark')).toHaveCount(2);
  await page.getByRole('button',{name:'Siguiente coincidencia'}).click();
  await expect(page.getByRole('status')).toHaveText('Coincidencia 2 de 2');
  await expect(page.getByRole('button',{name:'Siguiente coincidencia'})).toBeDisabled();
  await expect(text.locator('mark[aria-current=true]')).toHaveCount(1);
  assert.equal(await text.textContent(),original,'highlighting must not alter source text');
  const evidence=process.env.REJON_UI_EVIDENCE_DIR||path.join(tmpdir(),'rejon-support-search-evidence');await mkdir(evidence,{recursive:true});
  await page.screenshot({path:path.join(evidence,'search-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(evidence,'search-narrow.png'),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await query.fill('.*');await page.getByRole('button',{name:'Buscar en el soporte',exact:true}).click();
  await expect(text.locator('mark')).toHaveText('.*');
  await query.fill('Pago');await query.press('Enter');await expect(text.locator('mark')).toHaveCount(1);
  await query.fill('ausente');await query.press('Enter');await expect(page.getByRole('status')).toHaveText('Sin coincidencias exactas en esta vista.');
  await page.getByRole('button',{name:'Ver texto restituido'}).click();await expect(query).toHaveValue('');await expect(text.locator('mark')).toHaveCount(0);
  await query.fill('Persona Sintética');await query.press('Enter');await expect(text.locator('mark')).toHaveCount(1);
  await page.getByRole('combobox',{name:'Soporte que quieres leer'}).selectOption('two');await expect(query).toHaveValue('');await expect(text).toHaveText('Contrato sin pago.');
  await query.fill('Contrato');await query.press('Enter');
  await page.getByRole('button',{name:'Cerrar soporte'}).click();await page.getByRole('button',{name:'Consultar soporte local'}).click();
  await expect(query).toHaveValue('');await expect(text.locator('mark')).toHaveCount(0);
  assert.deepEqual(calls.map(call=>call.action),Array(3).fill('intake.readDocument'));
  assert.ok(calls.every(call=>!('query' in call.payload)));
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await server.close();}
});
