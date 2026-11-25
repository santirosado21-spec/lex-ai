import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {access,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
test('directory locator changes the real article view without claiming full-text search or missing law',async()=>{
 const root=fileURLToPath(new URL('..',import.meta.url));
 const server=await createServer({root,configFile:false,plugins:[react()],logLevel:'error',server:{host:'127.0.0.1',port:0}});
 await server.listen();let options={headless:true};
 try{await access(chromium.executablePath());}catch{options={...options,channel:'chrome'};}
 const browser=await chromium.launch(options);
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'}),errors=[],calls=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api',async route=>{
   const {action}=route.request().postDataJSON();calls.push(action);assert.equal(action,'intake.customsDirectory');
   await route.fulfill({json:[
    {article:'97',page:1,localUrl:'/synthetic.pdf#page=1',passages:[{page:1,locator:'Pasaje sintético',text:'Texto inventado para probar navegación.'}]},
    {article:'36-A',page:2,localUrl:'/synthetic.pdf#page=2',passages:[]},
    {article:'15-BIS',page:3,localUrl:'/synthetic.pdf#page=3',repealed:true,passages:[]},
   ]});
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tests/fixtures/customs-article-locator/index.html#token=synthetic`);
  const input=page.getByRole('searchbox',{name:'Ir al artículo de la Ley Aduanera'}),go=page.getByRole('button',{name:'Localizar artículo'});
  await expect(page.getByRole('heading',{name:'Artículo 97',exact:true})).toBeVisible();
  await input.fill('36-a');await go.click();
  await expect(page.getByRole('heading',{name:'Artículo 36-A',exact:true})).toBeVisible();
  await expect(page.getByText('No hay pasajes cotejados',{exact:false})).toBeVisible();
  await expect(page.getByRole('button',{name:'Preparar consulta de este artículo'})).toHaveCount(0);
  await input.fill('999');await go.click();
  await expect(page.getByRole('status')).toContainText('No se concluye que no exista en otra edición.');
  await expect(page.getByRole('heading',{name:'Artículo 36-A',exact:true})).toBeVisible();
  await input.fill('15 bis');await go.click();
  await expect(page.getByText('Derogado en esta edición.',{exact:true})).toBeVisible();
  await input.fill('97 y 98');await go.click();
  await expect(page.getByRole('status')).toContainText('Escribe un número de artículo');
  await input.fill('36-A');await go.click();
  const evidence=process.env.REJON_UI_EVIDENCE_DIR||path.join(tmpdir(),'rejon-customs-evidence');await mkdir(evidence,{recursive:true});
  await page.screenshot({path:path.join(evidence,'locator-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(evidence,'locator-narrow.png'),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);assert.deepEqual(calls,['intake.customsDirectory']);
 }finally{await browser.close();await server.close();}
});
