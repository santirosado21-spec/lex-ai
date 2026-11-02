/** Avatar lifecycle on real local routes, with gated synthetic inference only. */
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';
import {startServer} from '../server/main.mjs';
const outputDir=process.env.LEX_UI_AVATAR_REPORT_DIR||'artifacts/ui-avatar';
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
 await mkdir(outputDir,{recursive:true});await api('workspace.create',{name:'Despacho sintético avatar',practiceAreas:['Civil']});const matter=await api('matter.create',{title:'Contrato sintético avatar',client:'Cliente ficticio',jurisdiction:'MX-FED'});
 await api('document.import',{matterId:matter.id,name:'contrato-sintetico.txt',base64:Buffer.from('CONTRATO SINTÉTICO. Las partes acuerdan obligaciones de pago por servicios. El contrato se perfecciona por consentimiento. Solo prueba.').toString('base64')});
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[],remote=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(app.connection.url)&&!r.url().startsWith('data:'))remote.push(r.url());});
 await page.goto(`${app.connection.url}/#token=${app.connection.token}`);await expect(page.getByRole('heading',{name:'Asistente',exact:true})).toBeVisible();await expect(page.locator('.lex-avatar')).toHaveCount(0);
 const avatar=page.locator('.assistant-identity img[alt=""]');await expect(avatar).toHaveCount(1);assert.equal((await avatar.boundingBox()).width,56);await expect(avatar).toHaveAttribute('src',/lex-figma-mark|^data:image\/svg\+xml/);
 assert.equal(await avatar.evaluate(el=>el.tabIndex),-1);await page.screenshot({path:path.join(outputDir,'assistant-desktop.png'),fullPage:true});
 for(const width of [390,320]){await page.setViewportSize({width,height:900});await expect(page.getByRole('navigation',{name:'Navegación principal'})).toBeVisible();assert.equal((await avatar.boundingBox()).width,56);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(outputDir,`assistant-${width}.png`),fullPage:true});}
 await page.setViewportSize({width:1440,height:1000});
 const begin=async()=>{await page.getByLabel('Pregunta sobre el asunto').fill('¿Qué obligaciones establece el contrato?');await page.getByRole('button',{name:'Preguntar',exact:true}).click();await expect(page.locator('.generation-state .lex-ai-loader')).toBeVisible();await expect.poll(()=>typeof release).toBe('function');};
 await begin();const loaderAvatar=page.locator('.generation-state .lex-ai-loader-center img[alt=""]');await expect(loaderAvatar).toHaveCount(1);assert.equal((await loaderAvatar.boundingBox()).width,28);assert.equal(await page.locator('.lex-ai-loader-ring').evaluate(el=>getComputedStyle(el).animationName),'lex-loader-circle');await expect(page.locator('.lex-ai-loader')).toHaveAttribute('aria-hidden','true');await expect(page.locator('.generation-state')).toHaveAttribute('role','status');await page.screenshot({path:path.join(outputDir,'processing.png'),fullPage:true});
 for(const width of [390,320]){await page.setViewportSize({width,height:900});const cancel=page.getByRole('button',{name:'Cancelar',exact:true});await expect(cancel).toBeInViewport();const bounds=await cancel.boundingBox();assert.ok(bounds.y+bounds.height<=900,'Cancel remains in the viewport');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(outputDir,`processing-${width}.png`),fullPage:true});}
 await page.setViewportSize({width:1440,height:1000});
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.lex-ai-loader-ring').evaluate(el=>getComputedStyle(el).animationName),'none');assert.equal(await page.locator('.lex-ai-loader-letter').first().evaluate(el=>getComputedStyle(el).animationName),'none');
 release();await expect(page.getByRole('button',{name:'Exportar DOCX',exact:true})).toBeVisible();await expect(page.locator('.answer-byline img[alt=""]')).toHaveCount(1);await expect(page.locator('.generation-state')).toHaveCount(0);await page.screenshot({path:path.join(outputDir,'answer.png'),fullPage:true});
 await page.emulateMedia({reducedMotion:'no-preference'});fail=true;await begin();release();await expect(page.getByRole('alert')).toContainText('Fallo sintético del motor');await expect(page.locator('.lex-ai-loader')).toHaveCount(0);await expect(page.locator('.lex-avatar[data-state="processing"]')).toHaveCount(0);
 fail=false;await begin();await page.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(page.locator('.lex-ai-loader')).toHaveCount(0);await expect(page.locator('.lex-avatar[data-state="processing"]')).toHaveCount(0);release?.();await expect.poll(()=>completed).toBe(3);
 await page.getByRole('button',{name:'Escritos',exact:true}).click();await expect(page.locator('.assistant-identity img')).toHaveCount(0);assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
 report.checks.push('current LEX mark appears only in assistant empty, processing and answer states; legacy animated avatar is absent','56px desktop/mobile empty identity and 28px processing/answer mark','inline ring/letters loader follows real request lifecycle; completion/error/cancel removes loader','reduced motion disables ring and letters; single status region; Cancel remains visible at 390/320px','390/320px no horizontal overflow; no remote requests or page errors');report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.message;process.exitCode=1;}finally{release?.();await browser?.close();await app.close();report.finishedAt=new Date().toISOString();await writeFile(path.join(outputDir,'smoke.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
