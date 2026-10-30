/** Avatar lifecycle on real local routes, with gated synthetic inference only. */
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';
import {startServer} from '../server/main.mjs';
const dataDir=await mkdtemp(path.join(os.tmpdir(),'lex-avatar-'));
let release=null,fail=false,completed=0;
const inference={async status(){return{state:'ready',model:'TEST DOUBLE',supported:true};},async stop(){release?.();},async *generate(messages){
 try{await new Promise(resolve=>{release=resolve;});release=null;if(fail)throw Error('Fallo sintético del motor');
 const {sources}=JSON.parse(messages.at(-1).content),document=sources.find(s=>s.category==='internal-firm-document');assert.ok(document);
 yield JSON.stringify({analysis:`El contrato sintético requiere revisión de sus obligaciones. [${document.id}]`,citations:[{sourceId:document.id,quote:document.text.slice(0,100)}]});
 }finally{completed++;}
}};
const app=await startServer({dataDir,inference,monitorDir:path.join(dataDir,'monitor'),libraryPath:path.join(dataDir,'absent.sqlite')});let browser;
const report={mode:'synthetic inference test double; no Gemma execution',checks:[],startedAt:new Date().toISOString()};
const api=async(action,payload={})=>{const response=await fetch(app.connection.url+'/api',{method:'POST',headers:{Authorization:`Bearer ${app.connection.token}`,'Content-Type':'application/json'},body:JSON.stringify({action,payload})});assert.equal(response.status,200);return response.json();};
try{
 await mkdir('artifacts/ui-avatar',{recursive:true});await api('workspace.create',{name:'Despacho sintético avatar',practiceAreas:['Civil']});const matter=await api('matter.create',{title:'Contrato sintético avatar',client:'Cliente ficticio',jurisdiction:'MX-FED'});
 await api('document.import',{matterId:matter.id,name:'contrato-sintetico.txt',base64:Buffer.from('CONTRATO SINTÉTICO. Las partes acuerdan obligaciones de pago por servicios. El contrato se perfecciona por consentimiento. Solo prueba.').toString('base64')});
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[],remote=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(app.connection.url)&&!r.url().startsWith('data:'))remote.push(r.url());});
 await page.goto(`${app.connection.url}/#token=${app.connection.token}`);await expect(page.locator('.lex-bento')).toBeVisible();await expect(page.locator('.lex-avatar')).toHaveCount(0);await page.getByRole('button',{name:'Asistente',exact:true}).click();
 const avatar=page.locator('.lex-avatar');await expect(avatar).toHaveCount(1);await expect(avatar).toHaveAttribute('data-state','idle');await expect(avatar).toHaveAttribute('aria-hidden','true');assert.equal((await avatar.boundingBox()).width,64);assert.equal(await avatar.locator('.lex-avatar-eye').first().evaluate(el=>getComputedStyle(el).animationName),'none');
 assert.equal(await avatar.evaluate(el=>el.tabIndex),-1);await page.screenshot({path:'artifacts/ui-avatar/assistant-desktop.png',fullPage:true});
 for(const width of [390,320]){await page.setViewportSize({width,height:900});await expect(page.locator('.lex-dock')).toBeVisible();assert.equal((await avatar.boundingBox()).width,48);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`artifacts/ui-avatar/assistant-${width}.png`,fullPage:true});}
 await page.setViewportSize({width:1440,height:1000});
 const begin=async()=>{await page.getByLabel('Pregunta sobre el asunto').fill('¿Qué obligaciones establece el contrato?');await page.getByRole('button',{name:'Preguntar',exact:true}).click();await expect(page.locator('.generation-state .lex-avatar')).toHaveAttribute('data-state','processing');await expect.poll(()=>typeof release).toBe('function');};
 await begin();assert.equal((await avatar.boundingBox()).width,32);assert.equal(await avatar.locator('.lex-avatar-eye').first().evaluate(el=>getComputedStyle(el).animationName),'lex-avatar-blink');await expect(page.locator('.generation-state')).toHaveAttribute('role','status');await page.screenshot({path:'artifacts/ui-avatar/processing.png',fullPage:true});
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await avatar.locator('.lex-avatar-eye').first().evaluate(el=>getComputedStyle(el).animationName),'none');assert.equal(await avatar.locator('.lex-avatar-shine').evaluate(el=>getComputedStyle(el).animationName),'none');
 release();await expect(page.getByRole('button',{name:'Exportar DOCX',exact:true})).toBeVisible();await expect(page.locator('.answer-byline .lex-avatar')).toHaveAttribute('data-state','idle');await expect(page.locator('.generation-state')).toHaveCount(0);await page.screenshot({path:'artifacts/ui-avatar/answer.png',fullPage:true});
 await page.emulateMedia({reducedMotion:'no-preference'});fail=true;await begin();release();await expect(page.getByRole('alert')).toContainText('Fallo sintético del motor');await expect(page.locator('.lex-avatar[data-state="processing"]')).toHaveCount(0);
 fail=false;await begin();await page.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(page.locator('.lex-avatar[data-state="processing"]')).toHaveCount(0);release?.();await expect.poll(()=>completed).toBe(3);
 await page.getByRole('button',{name:'Inicio',exact:true}).click();await expect(page.locator('.lex-avatar')).toHaveCount(0);assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
 report.checks.push('avatar only in assistant: static empty and answer, absent from home','64px desktop/48px mobile empty identity; 32px processing and answer','processing follows real request lifecycle; completion/error/cancel stop animation','reduced motion disables eye and light animation; decorative nonfocusable avatar; status text retained','390/320px no horizontal overflow; no remote requests or page errors');report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.message;process.exitCode=1;}finally{release?.();await browser?.close();await app.close();report.finishedAt=new Date().toISOString();await writeFile('artifacts/ui-avatar/smoke.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
