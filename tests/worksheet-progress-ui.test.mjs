import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {mkdir,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
test('worksheet shows saved manual progress and pending navigation, updating only after save',async()=>{
 const root=fileURLToPath(new URL('..',import.meta.url));
 const server=await createServer({root,configFile:false,plugins:[react()],logLevel:'error',server:{host:'127.0.0.1',port:0}});
 await server.listen();
 let launchOptions={headless:true};
 try{await access(chromium.executablePath());}catch{launchOptions={...launchOptions,channel:'chrome'};}
 const browser=await chromium.launch(launchOptions);
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const statuses=['Por revisar','Solicitado','Recibido','Cotejado','No aplica'];
  let sheet={title:'Control de valoración',monetary:true,statuses,proposals:{},rows:statuses.map((status,i)=>({id:String(i),base:String(i),revision:0,label:'Concepto sintético '+i,check:'Revisión documental de prueba.',source:'Fuente sintética',status,amount:'',currency:'',reference:'',note:''}))};
  await page.route('**/api',async route=>{
   const {action,payload}=route.request().postDataJSON();
   if(action==='intake.saveWorksheetRow') sheet={...sheet,rows:sheet.rows.map(row=>row.id===payload.id?{...row,...payload.values,revision:row.revision+1}:row)};
   else assert.equal(action,'intake.readWorksheet');
   await route.fulfill({json:sheet});
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tests/fixtures/worksheet-progress/index.html#token=synthetic`);
  await page.getByRole('button',{name:'Control de valoración',exact:true}).click();
  const progress=page.getByRole('region',{name:'Seguimiento documental'});
  await expect(progress).toContainText('Por atender: 3 de 5 renglones · Cotejados: 1 · No aplica: 1.');
  await page.getByText('Ver renglones por atender',{exact:true}).click();
  await page.getByRole('button',{name:'Concepto sintético 2 · Recibido'}).click();
  await expect(page.getByRole('combobox').nth(0)).toHaveValue('2');
  await page.getByRole('combobox').nth(1).selectOption('Cotejado');
  await expect(progress).toContainText('Por atender: 3');
  await expect(progress).toContainText('Hay cambios sin guardar');
  await expect(page.getByRole('button',{name:'Concepto sintético 0 · Por revisar'})).toBeDisabled();
  await page.getByRole('button',{name:'Guardar renglón',exact:true}).click();
  await expect(progress).toContainText('Por atender: 2 de 5 renglones · Cotejados: 2 · No aplica: 1.');
  await expect(progress).not.toContainText('Hay cambios sin guardar');
  await page.getByRole('button',{name:'Control de valoración',exact:true}).click();
  await page.getByRole('button',{name:'Control de valoración',exact:true}).click();
  await expect(progress).toContainText('Por atender: 2 de 5');
  await expect(progress).toContainText('No acreditan cumplimiento jurídico');
  await page.getByText('Ver renglones por atender',{exact:true}).click();
  const evidence=process.env.REJON_UI_EVIDENCE_DIR||path.join(tmpdir(),'rejon-worksheet-evidence');
  await mkdir(evidence,{recursive:true});
  await page.screenshot({path:path.join(evidence,'progress-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(evidence,'progress-narrow.png'),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await server.close();}
});
