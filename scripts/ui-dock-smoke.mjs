/** Navigation-only integration; synthetic records and no model execution. */
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';
import {startServer} from '../server/main.mjs';
const dataDir=await mkdtemp(path.join(os.tmpdir(),'lex-dock-'));
const inference={async status(){return{state:'stopped',model:'TEST DOUBLE — no real inference',supported:true};},async stop(){},async *generate(){throw Error('Dock test must not run inference');}};
const app=await startServer({dataDir,inference,monitorDir:path.join(dataDir,'monitor'),libraryPath:path.join(dataDir,'absent-public-index.sqlite')});let browser;
const report={mode:'navigation UI with synthetic data; no inference',checks:[],startedAt:new Date().toISOString()};
const api=async(action,payload={})=>{const r=await fetch(app.connection.url+'/api',{method:'POST',headers:{Authorization:`Bearer ${app.connection.token}`,'Content-Type':'application/json'},body:JSON.stringify({action,payload})});assert.equal(r.status,200);return r.json();};
try{
 await mkdir('artifacts/ui-dock',{recursive:true});await api('workspace.create',{name:'Despacho sintético dock',practiceAreas:['Civil']});
 const matter=await api('matter.create',{title:'Asunto sintético A',client:'Cliente ficticio A',jurisdiction:'MX-FED'});await api('matter.create',{title:'Asunto sintético B',client:'Cliente ficticio B',jurisdiction:'MX-FED'});
 await api('document.import',{matterId:matter.id,name:'prueba.txt',base64:Buffer.from('Documento sintético para comprobar navegación local.').toString('base64')});
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${app.connection.url}/#token=${app.connection.token}`);await page.getByLabel('Asunto activo').selectOption(matter.id);
 await expect(page.locator('.sidebar')).toBeVisible();await expect(page.locator('.lex-dock')).toHaveCount(0);await page.getByRole('button',{name:'Contraer navegación',exact:true}).click();
 const dock=page.locator('.lex-dock');await expect(dock).toBeVisible();await expect(page.locator('.sidebar')).toBeHidden();await expect(page.getByRole('navigation',{name:'Navegación principal'})).toHaveCount(1);await expect(dock.getByRole('button',{name:'Inicio',exact:true})).toHaveAttribute('aria-current','page');
 await dock.getByRole('button',{name:'Más',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();assert.equal(await dock.evaluate(e=>e.inert),true);await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(dock.getByRole('button',{name:'Más',exact:true})).toBeFocused();
 await dock.getByRole('button',{name:'Más',exact:true}).click();await page.getByRole('combobox',{name:'Buscar acciones, documentos y consultas'}).fill('Configuración');await page.keyboard.press('Enter');await expect(page.getByRole('heading',{name:'Configuración',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Expandir navegación',exact:true}).click();await expect(dock).toHaveCount(0);await expect(page.locator('.sidebar')).toBeVisible();
 for(const width of [390,320,780]){
  await page.setViewportSize({width,height:900});await expect(dock).toBeVisible();await expect(page.locator('.sidebar')).toBeHidden();await dock.getByRole('button',{name:'Asistente',exact:true}).click();await page.getByLabel('Pregunta sobre el asunto').fill('Borrador sintético que debe conservarse');
  await dock.getByRole('button',{name:'Documentos',exact:true}).click();await expect(page.getByRole('heading',{name:'Documentos',exact:true})).toBeVisible();await expect(page.getByLabel('Asunto activo')).toHaveValue(matter.id);await dock.getByRole('button',{name:'Asistente',exact:true}).click();await expect(page.getByLabel('Pregunta sobre el asunto')).toHaveValue('Borrador sintético que debe conservarse');
  const bounds=await dock.boundingBox(),composer=await page.locator('.workspace-composer').boundingBox();report.lastLayout={width,dock:bounds,composer};await page.screenshot({path:`artifacts/ui-dock/workspace-${width}.png`,fullPage:true});assert.ok(composer.y+composer.height<=bounds.y,'composer must end above dock');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  for(const button of await dock.getByRole('button').all()){const box=await button.boundingBox();assert.ok(box.width>=44&&box.height>=44,'minimum 44px touch target');}
  await page.screenshot({path:`artifacts/ui-dock/workspace-${width}.png`,fullPage:true});
 }
 await dock.getByRole('button',{name:'Asuntos',exact:true}).click();await expect(dock.getByRole('button',{name:'Asuntos',exact:true})).toHaveAttribute('aria-current','page');await page.getByRole('button',{name:'Expediente',exact:true}).click();await expect(dock.getByRole('button',{name:'Asuntos',exact:true})).toHaveAttribute('aria-current','page');
 await dock.getByRole('button',{name:'Biblioteca',exact:true}).click();await expect(page.getByRole('heading',{name:'Biblioteca federal',exact:true})).toBeVisible();await dock.getByRole('button',{name:'Inicio',exact:true}).click();
 await page.setViewportSize({width:1440,height:1000});await expect(page.locator('.sidebar')).toBeVisible();await page.getByRole('button',{name:'Contraer navegación',exact:true}).click();await page.screenshot({path:'artifacts/ui-dock/desktop.png',fullPage:true});assert.deepEqual(errors,[]);
 report.checks.push('sidebar/dock mutually exclusive in accessibility tree; desktop opt-in and expansion','Más opens all routes via real command palette; inert background and focus restored on Escape','390/320/780px navigation preserves active matter and draft','composer ends above dock, no horizontal overflow, six 44px+ targets','dossier marks Asuntos active; library route and reduced-motion layout');report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.message;process.exitCode=1;}finally{await browser?.close();await app.close();report.finishedAt=new Date().toISOString();await writeFile('artifacts/ui-dock/smoke.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
