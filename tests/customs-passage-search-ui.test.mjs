import test from 'node:test';import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';import {createServer} from 'vite';import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';import {access,mkdir} from 'node:fs/promises';import path from 'node:path';import {tmpdir} from 'node:os';
import {searchCustomsPassages} from '../server/corpus/customs-search.mjs';
import {customsDirectory} from '../server/corpus/customs-edition.mjs';
test('law passage search reaches pinned evidence, its article and existing question preparation with no generation',async()=>{
 const root=fileURLToPath(new URL('..',import.meta.url));const server=await createServer({root,configFile:false,plugins:[react()],logLevel:'error',server:{host:'127.0.0.1',port:0}});
 await server.listen();let options={headless:true};try{await access(chromium.executablePath());}catch{options={...options,channel:'chrome'};}
 const browser=await chromium.launch(options);
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'}),calls=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api',async route=>{
   const {action,payload}=route.request().postDataJSON();calls.push(action);
   if(action==='intake.customsDirectory')return route.fulfill({json:customsDirectory()});
   assert.equal(action,'intake.searchCustomsPassages');await route.fulfill({json:searchCustomsPassages(payload.text)});
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tests/fixtures/customs-passage-search/index.html#token=synthetic`);
  const query=page.getByRole('searchbox',{name:'Buscar palabras en pasajes cotejados'});
  await query.fill('REGALIAS');await query.press('Enter');
  const results=page.getByLabel('Resultados de pasajes cotejados');
  await expect(results.getByRole('status')).toContainText('pasaje cotejado');
  await expect(results).toContainText('Las regalías y derechos de licencia');
  await expect(results).toContainText('reforma posterior');
  const hit=searchCustomsPassages('regalías')[0];
  await expect(results.getByRole('link',{name:'Abrir página '+hit.page+' del pasaje'})).toHaveAttribute('href',hit.localUrl);
  await results.getByRole('button',{name:'Ver pasaje en el artículo '+hit.article,exact:true}).click();
  const heading=page.getByRole('heading',{name:'Artículo '+hit.article,exact:true});await expect(heading).toBeVisible();
  const article=heading.locator('..');await expect(article.locator('details[open]')).toContainText(hit.text);
  await article.getByRole('button',{name:'Preparar consulta de este artículo'}).click();
  await expect(page.getByLabel('Consulta preparada')).toHaveText(JSON.stringify({article:hit.article,topic:''}));
  await query.fill('vinculación');await query.press('Enter');
  await expect(results).toContainText('Artículo 67');await expect(results).toContainText('siempre que concurran');await expect(results).toContainText('artículo 71');
  await results.getByRole('button',{name:'Ver pasaje en el artículo 67',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Artículo 67',exact:true})).toBeVisible();
  await page.getByRole('heading',{name:'Artículo 67',exact:true}).locator('..').getByRole('button',{name:'Preparar consulta de este artículo'}).click();
  await expect(page.getByLabel('Consulta preparada')).toHaveText(JSON.stringify({article:'67',topic:''}));
  const evidence=process.env.REJON_UI_EVIDENCE_DIR||path.join(tmpdir(),'rejon-customs-search');await mkdir(evidence,{recursive:true});
  await page.screenshot({path:path.join(evidence,'search-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(evidence,'search-narrow.png'),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await query.fill('zzzterminoinexistente');await query.press('Enter');await expect(results.getByRole('status')).toContainText('No demuestra ausencia en la ley');
  assert.deepEqual(errors,[]);assert.deepEqual(calls,['intake.customsDirectory','intake.searchCustomsPassages','intake.searchCustomsPassages','intake.searchCustomsPassages']);
 }finally{await browser.close();await server.close();}
});
