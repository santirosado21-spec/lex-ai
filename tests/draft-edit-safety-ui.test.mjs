import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {mkdir,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
test('real pilot protects unsaved draft edits without persistence or a cloud call',async()=>{
 const root=fileURLToPath(new URL('..',import.meta.url));
 const server=await createServer({root,configFile:false,plugins:[react()],logLevel:'error',server:{host:'127.0.0.1',port:0}});
 await server.listen();
 let launchOptions={headless:true};
 try{await access(chromium.executablePath());}catch{launchOptions={...launchOptions,channel:'chrome'};}
 const browser=await chromium.launch(launchOptions);
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'}),errors=[],calls=[];
  page.on('pageerror',error=>errors.push(error.message));
  const original='Nota sintética para [[CLIENTE]] sobre [[ASUNTO]].';
  let status={saved:true,protectedRecords:false,tasks:[{id:'trade',title:'Nota sintética',preview:'Consulta pública sintética'}],drafts:{trade:original}};
  let failSave=false;
  await page.route('**/api',async route=>{
   const {action,payload}=route.request().postDataJSON();calls.push(action);
   if(action==='intake.edit'){
    if(failSave){await route.fulfill({status:500,json:{error:'Fallo sintético al guardar.'}});return;}
    status={...status,drafts:{trade:payload.text}};
   }else assert.equal(action,'intake.status');
   await route.fulfill({json:status});
  });
  const url=`http://127.0.0.1:${server.httpServer.address().port}/tests/fixtures/draft-edit-safety/index.html#token=synthetic`;
  await page.goto(url);
  const unloadBlocked=()=>page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;});
  await page.getByRole('button',{name:'Editar borrador',exact:true}).click();
  const editor=page.getByRole('textbox',{name:'Editar en este equipo'});
  assert.equal(await unloadBlocked(),false,'entering edit with no changes must not block navigation');
  await editor.fill(original+' Revisión sintética pendiente.');
  assert.equal(await unloadBlocked(),true,'changed edits need an unload guard');
  await expect(page.getByRole('status').filter({hasText:'Cambios sin guardar'})).toBeVisible();
  const reloadDialog=page.waitForEvent('dialog');
  const reload=page.reload({timeout:1000}).catch(error=>{assert.match(error.message,/ERR_ABORTED|Timeout 1000ms exceeded/);});
  const dialog=await reloadDialog;assert.equal(dialog.type(),'beforeunload');await dialog.dismiss();await reload;
  await expect(editor).toHaveValue(original+' Revisión sintética pendiente.');
  await expect(page.getByRole('combobox',{name:'Tarea del despacho'})).toBeDisabled();
  page.once('dialog',dialog=>dialog.dismiss());
  await page.getByRole('button',{name:'Descartar edición',exact:true}).click();
  await expect(editor).toHaveValue(original+' Revisión sintética pendiente.');
  failSave=true;
  await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Fallo sintético');
  assert.equal(await unloadBlocked(),true,'failed save must retain the guard');
  failSave=false;
  const evidence=process.env.REJON_UI_EVIDENCE_DIR||path.join(tmpdir(),'rejon-draft-evidence');await mkdir(evidence,{recursive:true});
  await page.screenshot({path:path.join(evidence,'draft-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(evidence,'draft-narrow.png'),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();
  await expect(editor).toHaveCount(0);
  assert.equal(await unloadBlocked(),false,'successful save removes the guard');
  await page.getByRole('button',{name:'Editar borrador',exact:true}).click();
  await editor.fill(original+' Otra edición.');
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Descartar edición',exact:true}).click();
  await expect(editor).toHaveCount(0);
  assert.equal(await unloadBlocked(),false);
  await expect(page.locator('.rp-document')).toContainText('Revisión sintética pendiente.');
  await page.getByRole('button',{name:'Editar borrador',exact:true}).click();
  await editor.fill(original);
  await editor.fill(status.drafts.trade);
  assert.equal(await unloadBlocked(),false,'reverting to saved text removes the guard');
  await page.getByRole('button',{name:'Descartar edición',exact:true}).click();
  assert.deepEqual(calls,['intake.status','intake.edit','intake.edit']);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await server.close();}
});
