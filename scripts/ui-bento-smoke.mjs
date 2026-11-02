/** Home integration with synthetic data and fixture answers; never model-quality evidence. */
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';
import {startServer} from '../server/main.mjs';
import {createStore} from '../server/store.mjs';
const dataDir=await mkdtemp(path.join(os.tmpdir(),'lex-bento-'));
let engineState='stopped';
const inference={async status(){return{state:engineState,model:'TEST DOUBLE',supported:true};},async stop(){},async *generate(){throw Error('Bento test must not run inference');}};
const app=await startServer({dataDir,inference,monitorDir:path.join(dataDir,'monitor'),libraryPath:path.join(dataDir,'absent.sqlite')});let browser;
const report={mode:'synthetic local UI, seeded answers; no inference',checks:[],startedAt:new Date().toISOString()};
const api=async(action,payload={})=>{const r=await fetch(app.connection.url+'/api',{method:'POST',headers:{Authorization:`Bearer ${app.connection.token}`,'Content-Type':'application/json'},body:JSON.stringify({action,payload})});assert.equal(r.status,200);return r.json();};
try{
 await mkdir('artifacts/ui-bento',{recursive:true});await api('workspace.create',{name:'Despacho sintético bento',practiceAreas:['Civil']});
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];const remote=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(app.connection.url)&&!r.url().startsWith('data:'))remote.push(r.url());});
 const openHome=async()=>{await page.getByRole('button',{name:'Buscar y ejecutar acciones'}).click();const search=page.getByRole('combobox',{name:'Buscar acciones, documentos y consultas'});await search.fill('Inicio');await search.press('Enter');await expect(page.locator('.lex-bento')).toBeVisible();};
 // Inicio is visible in Sistema; retain this palette path as a keyboard regression.
 const home=async()=>{await page.goto(`${app.connection.url}/#token=${app.connection.token}`);await page.reload();await openHome();};
 await home();const bento=page.locator('.lex-bento');const card=id=>bento.locator(`[data-card="${id}"]`);
 await expect(bento.locator('.lex-bento-card')).toHaveCount(5);await expect(card('matter')).toContainText('Sin asunto');await page.screenshot({path:'artifacts/ui-bento/empty.png',fullPage:true});
 const matter=await api('matter.create',{title:'Contrato sintético A',client:'Cliente ficticio A',jurisdiction:'MX-FED'});
 const other=await api('matter.create',{title:'Asunto sintético B',client:'Cliente ficticio B',jurisdiction:'MX-CMX'});
 const longName='documento-sintetico-'+ 'nombre-largo-'.repeat(10)+'.txt';
 await api('document.import',{matterId:matter.id,name:longName,base64:Buffer.from('CONTENIDO SINTÉTICO A para comprobar apertura y alcance.').toString('base64')});
 await api('document.import',{matterId:other.id,name:'solo-asunto-B.txt',base64:Buffer.from('CONTENIDO SINTÉTICO B.').toString('base64')});
 const store=createStore(dataDir);
 for(const [id,mid,question] of [['answer-a',matter.id,'Consulta sintética exclusiva A'],['answer-b',other.id,'Consulta sintética exclusiva B']])store.put('answer',{id,matterId:mid,question,text:'Respuesta de fixture sintético; no generada por modelo.',citations:[],createdAt:new Date().toISOString()});
 store.close();await home();await page.getByLabel('Asunto activo').selectOption(matter.id);
 await expect(card('documents')).toContainText(longName);await expect(card('documents')).not.toContainText('solo-asunto-B');await expect(card('answers')).toContainText('Consulta sintética exclusiva A');await expect(card('answers')).not.toContainText('Consulta sintética exclusiva B');
 await card('documents').getByRole('button',{name:new RegExp('documento-sintetico-')}).click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.locator('.document-reading')).toContainText('CONTENIDO SINTÉTICO A');await page.keyboard.press('Escape');
 await card('answers').getByRole('button',{name:/Consulta sintética exclusiva A/}).click();await expect(page.locator('.reading-text')).toContainText('Respuesta de fixture');
 await home();await card('matters').getByRole('button',{name:/Asunto sintético B/}).click();await expect(page.getByLabel('Asunto activo')).toHaveValue(other.id);
 // The Sistema Inicio view reached through the command palette keeps the newly activated scope.
 await openHome();await expect(card('documents')).toContainText('solo-asunto-B.txt');await expect(card('documents')).not.toContainText(longName);await expect(card('answers')).toContainText('Consulta sintética exclusiva B');
 await page.getByLabel('Asunto activo').selectOption(matter.id);
 await card('matter').hover();await expect(card('matter')).toHaveAttribute('data-pointer','active');
 for(const width of [1440,1000,780,390,320]){
  await page.setViewportSize({width,height:1100});await expect(bento).toBeVisible();await page.screenshot({path:`artifacts/ui-bento/home-${width}.png`,fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow at ${width}`);
  for(const button of await bento.getByRole('button').all()){const rect=await button.boundingBox();assert.ok(rect.width>=44&&rect.height>=44,`touch target at ${width}`);}
 }
 engineState='error';await home();await expect(card('engine')).toContainText('Revisar LEX AI');engineState='ready';await home();await expect(card('engine')).toContainText('LEX AI listo');
 await page.emulateMedia({reducedMotion:'reduce'});await card('matter').hover();await expect(card('matter')).not.toHaveAttribute('data-pointer','active');await card('matter').getByRole('button').first().focus();await expect(card('matter').getByRole('button').first()).toBeFocused();
 const motions=await bento.evaluate(el=>[...el.querySelectorAll('*')].map(e=>getComputedStyle(e).animationName).filter(n=>n!=='none'));assert.deepEqual(motions,[]);
 await card('engine').scrollIntoViewIfNeeded();
 await card('engine').scrollIntoViewIfNeeded();const engineBox=await card('engine').boundingBox();assert.ok(engineBox.y+engineBox.height<=1100,'last card reachable in the viewport');
 await page.screenshot({path:'artifacts/ui-bento/mobile-bottom.png'});
 assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
 report.checks.push('Inicio is visible in Sistema; five cards and no-matter empty state','document and answer content restricted to selected matter; switching refreshes scope','document opens real viewer; answer opens saved response','1440/1000/768/390/320px no horizontal overflow and 44px targets','engine error/ready reflects backend state on load; pointer spotlight, keyboard focus and reduced motion; last card reachable in the viewport','no page errors or remote requests');report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.message;process.exitCode=1;}finally{await browser?.close();await app.close();report.finishedAt=new Date().toISOString();await writeFile('artifacts/ui-bento/smoke.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
