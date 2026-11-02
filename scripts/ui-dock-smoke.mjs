/** Current Apple-HIG shell navigation with synthetic records and no model execution. */
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';
import {startServer} from '../server/main.mjs';
const dataDir=await mkdtemp(path.join(os.tmpdir(),'lex-navigation-'));
const inference={async status(){return{state:'stopped',model:'TEST DOUBLE — no real inference',supported:true};},async stop(){},async *generate(){throw Error('Navigation test must not run inference');}};
const app=await startServer({dataDir,inference,monitorDir:path.join(dataDir,'monitor'),libraryPath:path.join(dataDir,'absent-public-index.sqlite')});let browser;
const report={mode:'Apple-HIG navigation UI with synthetic data; no inference',checks:[],startedAt:new Date().toISOString()};
const api=async(action,payload={})=>{const r=await fetch(app.connection.url+'/api',{method:'POST',headers:{Authorization:`Bearer ${app.connection.token}`,'Content-Type':'application/json'},body:JSON.stringify({action,payload})});assert.equal(r.status,200);return r.json();};
try{
 await mkdir('artifacts/ui-dock',{recursive:true});await api('workspace.create',{name:'Despacho sintético navegación',practiceAreas:['Civil']});
 const matter=await api('matter.create',{title:'Asunto sintético A',client:'Cliente ficticio A',jurisdiction:'MX-FED'});await api('matter.create',{title:'Asunto sintético B',client:'Cliente ficticio B',jurisdiction:'MX-FED'});
 await api('document.import',{matterId:matter.id,name:'prueba.txt',base64:Buffer.from('Documento sintético para comprobar navegación local.').toString('base64')});
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const nav=page.getByRole('navigation',{name:'Navegación principal'});
 const openTool=async label=>{await page.getByRole('button',{name:'Buscar y ejecutar acciones'}).click();const search=page.getByRole('combobox',{name:'Buscar acciones, documentos y consultas'});await search.fill(label);await search.press('Enter');};
 await page.goto(`${app.connection.url}/#token=${app.connection.token}`);await page.getByLabel('Asunto activo').selectOption(matter.id);
 await expect(nav).toBeVisible();await expect(nav.getByRole('button')).toHaveCount(3);for(const label of ['Asistente','Asuntos','Escritos'])await expect(nav.getByRole('button',{name:label,exact:true})).toBeVisible();await expect(page.locator('.lex-dock')).toHaveCount(0);await expect(nav.getByRole('button',{name:'Asistente',exact:true})).toHaveAttribute('aria-current','page');
 await page.getByRole('button',{name:'Ocultar barra lateral',exact:true}).click();await expect(nav).toBeHidden();await page.getByRole('button',{name:'Mostrar barra lateral',exact:true}).click();await expect(nav).toBeVisible();
 await page.getByRole('button',{name:'Buscar y ejecutar acciones'}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:'Buscar y ejecutar acciones'})).toBeFocused();
 // Secondary routes deliberately live behind Más herramientas rather than the primary shell.
 await openTool('Documentos');await expect(page.getByRole('heading',{name:'Documentos',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Abrir original',exact:true})).toBeVisible();
 await nav.getByRole('button',{name:'Asistente',exact:true}).click();await page.getByLabel('Pregunta sobre el asunto').fill('Borrador sintético que debe conservarse');
 for(const width of [390,320,780]){
  await page.setViewportSize({width,height:900});await expect(nav).toBeVisible();await expect(nav.getByRole('button')).toHaveCount(3);await nav.getByRole('button',{name:'Asuntos',exact:true}).click();await expect(page.getByRole('heading',{name:'Asuntos',exact:true})).toBeVisible();await expect(page.getByLabel('Asunto activo')).toHaveValue(matter.id);await nav.getByRole('button',{name:'Asistente',exact:true}).click();await expect(page.getByLabel('Pregunta sobre el asunto')).toHaveValue('Borrador sintético que debe conservarse');
  const composer=page.locator('.workspace-composer');await expect(composer).toBeInViewport();await page.screenshot({path:`artifacts/ui-dock/workspace-${width}.png`,fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  for(const button of await nav.getByRole('button').all()){const box=await button.boundingBox();assert.ok(box.width>=44&&box.height>=44,'minimum 44px touch target');}
 }
 await page.setViewportSize({width:1440,height:1000});await nav.getByRole('button',{name:'Asuntos',exact:true}).click();await expect(nav.getByRole('button',{name:'Asuntos',exact:true})).toHaveAttribute('aria-current','page');await page.getByRole('button',{name:'Expediente',exact:true}).click();await expect(nav.getByRole('button',{name:'Asuntos',exact:true})).toHaveClass(/active/);
 await openTool('Biblioteca federal');await expect(page.getByRole('heading',{name:'Biblioteca federal',exact:true})).toBeVisible();await nav.getByRole('button',{name:'Asistente',exact:true}).click();
 await page.setViewportSize({width:1440,height:1000});await expect(nav).toBeVisible();await page.screenshot({path:'artifacts/ui-dock/desktop.png',fullPage:true});assert.deepEqual(errors,[]);
 report.checks.push('desktop and responsive primary shell has only Asistente, Asuntos and Escritos; obsolete dock is absent','sidebar toolbar hides and restores the primary navigation; command palette Escape returns focus','Documentos and Biblioteca federal remain reachable through Más herramientas','390/320/780px navigation preserves active matter and assistant draft','no horizontal overflow and every primary navigation target is at least 44px; dossier retains Asuntos visual state');report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.message;process.exitCode=1;}finally{await browser?.close();await app.close();report.finishedAt=new Date().toISOString();await writeFile('artifacts/ui-dock/smoke.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
