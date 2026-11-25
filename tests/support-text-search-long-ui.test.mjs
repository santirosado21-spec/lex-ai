import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {mkdir,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
test('400-line support keeps distant active matches centered and visible at desktop and narrow widths',async()=>{
 const root=fileURLToPath(new URL('..',import.meta.url));
 const server=await createServer({root,configFile:false,plugins:[react()],logLevel:'error',server:{host:'127.0.0.1',port:0}});
 await server.listen();let launchOptions={headless:true};
 try{await access(chromium.executablePath());}catch{launchOptions={...launchOptions,channel:'chrome'};}
 const browser=await chromium.launch(launchOptions);
 try{
  for(const width of [1280,390]){
   const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
   const errors=[],calls=[];page.on('pageerror',error=>errors.push(error.message));
   const lines=Array.from({length:400},(_,i)=>`Línea ${i+1}: soporte sintético sin contenido jurídico.${[20,200,380].includes(i)?' Referencia distante.':''}`);
   const source=lines.join('\n');
   await page.route('**/api',async route=>{
    const {action}=route.request().postDataJSON();calls.push(action);assert.equal(action,'intake.readDocument');
    await route.fulfill({json:{masked:source,original:source,needsReview:false,tokens:[]}});
   });
   await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tests/fixtures/support-search/index.html#token=synthetic`);
   await page.getByRole('button',{name:'Consultar soporte local'}).click();
   await page.getByRole('searchbox').fill('Referencia distante');await page.getByRole('searchbox').press('Enter');
   const geometry=()=>page.locator('mark[aria-current=true]').evaluate(mark=>{
    const r=mark.getBoundingClientRect(),box=mark.closest('pre').getBoundingClientRect();
    return {centerError:Math.abs((r.top+r.bottom)/2-(box.top+box.bottom)/2),visible:r.top>=box.top&&r.bottom<=box.bottom&&r.top>=0&&r.bottom<=innerHeight};
   });
   for(const number of [1,2,3]){
    if(number>1)await page.getByRole('button',{name:'Siguiente coincidencia'}).click();
    await expect(page.getByRole('status')).toHaveText(`Coincidencia ${number} de 3`);
    await expect.poll(async()=> (await geometry()).centerError).toBeLessThan(30);
    assert.equal((await geometry()).visible,true);
   }
   const evidence=process.env.REJON_UI_EVIDENCE_DIR||path.join(tmpdir(),'rejon-support-long-evidence');await mkdir(evidence,{recursive:true});
   await page.screenshot({path:path.join(evidence,`long-${width}.png`),fullPage:true});
   await page.getByRole('button',{name:'Coincidencia anterior'}).click();
   await expect(page.getByRole('status')).toHaveText('Coincidencia 2 de 3');
   await expect.poll(async()=> (await geometry()).centerError).toBeLessThan(30);
   assert.equal(await page.getByLabel('Texto del soporte').textContent(),source);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert.deepEqual(calls,['intake.readDocument']);assert.deepEqual(errors,[]);await page.close();
  }
 }finally{await browser.close();await server.close();}
});
