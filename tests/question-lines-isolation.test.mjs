import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {mkdir,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

test('document lines and in-flight responses stay isolated by review', async () => {
 const root=fileURLToPath(new URL('..',import.meta.url));
 const server=await createServer({root,configFile:false,plugins:[react()],logLevel:'error',server:{host:'127.0.0.1',port:0}});
 await server.listen();
 let launchOptions={headless:true};
 try{await access(chromium.executablePath());}catch{launchOptions={...launchOptions,channel:'chrome'};}
 const browser=await chromium.launch(launchOptions);
 try {
  const page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'});
  const calls=[];
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  let delayed;
  let oldResponseHandled=false;
  await page.route('**/api',async route=>{
   const body=route.request().postDataJSON();
   calls.push(body);
   const review=body.payload.reviewId;
   if(review==='review-a'&&delayed) await delayed;
   await route.fulfill({json:[{id:review+'-line',text:review==='review-a'?'CONTENIDO ANTERIOR SINTETICO':'CONTENIDO NUEVO SINTETICO',cloud:false,label:'Soporte',line:1}]});
   if(review==='review-a'&&delayed) oldResponseHandled=true;
  });
  const url=`http://127.0.0.1:${server.httpServer.address().port}/tests/fixtures/question-lines-isolation/index.html#token=synthetic`;
  await page.goto(url);
  await page.getByRole('button',{name:'Elegir líneas de mis documentos'}).click();
  await expect(page.getByText('CONTENIDO ANTERIOR SINTETICO',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Cambiar revisión'}).click();
  await expect(page.getByText('CONTENIDO ANTERIOR SINTETICO',{exact:false})).toHaveCount(0);
  const toggle=page.getByRole('button',{name:'Elegir líneas de mis documentos'});
  if(await toggle.getAttribute('aria-expanded')==='false') await toggle.click();
  await expect(page.getByText('CONTENIDO NUEVO SINTETICO',{exact:false})).toBeVisible();
  assert.ok(calls.some(call=>call.payload.reviewId==='review-b'));
  const evidence=process.env.REJON_UI_EVIDENCE_DIR||path.join(tmpdir(),'rejon-question-lines-evidence');
  await mkdir(evidence,{recursive:true});
  await page.screenshot({path:path.join(evidence,'lines-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(evidence,'lines-narrow.png'),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  // Delay the old review's response until after the new review has rendered.
  let release;
  delayed=new Promise(resolve=>{release=resolve;});
  await page.reload();
  await page.getByRole('button',{name:'Elegir líneas de mis documentos'}).click();
  await expect.poll(()=>calls.filter(call=>call.payload.reviewId==='review-a').length).toBe(2);
  await page.getByRole('button',{name:'Cambiar revisión'}).click();
  release();
  await expect.poll(()=>oldResponseHandled).toBe(true);
  await expect(page.getByText('CONTENIDO ANTERIOR SINTETICO',{exact:false})).toHaveCount(0);
  if(await toggle.getAttribute('aria-expanded')==='false') await toggle.click();
  await expect(page.getByText('CONTENIDO NUEVO SINTETICO',{exact:false})).toBeVisible();
  await page.getByRole('checkbox').check();
  await expect(page.getByRole('checkbox')).toBeChecked();
  assert.deepEqual(errors,[]);
 } finally {await browser.close();await server.close();}
});
