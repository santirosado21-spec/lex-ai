import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,access,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';
import {auditOfficeDocument} from '../server/office-bridge.mjs';

test('Word review applies only an explicit replacement to an exact selection in the reviewed document',async()=>{
 const root=fileURLToPath(new URL('..',import.meta.url)),cacheDir=await mkdtemp(path.join(tmpdir(),'word-safe-'));let server,browser;
 try{
 server=await createServer({root,cacheDir,configFile:false,server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();
 let options={headless:true};try{await access(chromium.executablePath());}catch{options.channel='chrome';}browser=await chromium.launch(options);
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://appsforoffice.microsoft.com/**',route=>route.fulfill({contentType:'text/javascript',body:`window.wordState={text:'Contrato sintético. [FECHA]',selection:'[FECHA]',writes:[],tracking:[],syncs:0};window.Office={onReady:callback=>callback(),context:{}};window.Word={ChangeTrackingMode:{trackAll:'trackAll'},InsertLocation:{replace:'replace',after:'after'},run:async callback=>{const s=window.wordState;const range={load(){},get text(){return s.selection;},insertText(text,where){s.writes.push({text,where});}};const body={load(){},get text(){return s.text;}};const document={body,getSelection:()=>range,set changeTrackingMode(value){s.tracking.push(value);}};return callback({document,sync:async()=>{s.syncs++;if(s.onSync)s.onSync();if(s.failWrite&&s.writes.length>=s.failWrite)throw Error('sync failed');}});}};`}));
 let fail=false,hold=false,release;const calls=[];
 await page.route('**/v1/audit',async route=>{calls.push(route.request().postDataJSON());if(hold)await new Promise(resolve=>{release=resolve;});if(fail){await route.fulfill({status:500,json:{error:'Fallo sintético'}});return;}await route.fulfill({json:auditOfficeDocument(calls.at(-1).text,{documentType:calls.at(-1).documentType})});});
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/office-addin/word.html`);
 await page.evaluate(()=>{sessionStorage.setItem('lex-office-context',location.pathname+location.search);sessionStorage.setItem('lex-office-token','synthetic-token');});await page.reload();
 const review=page.getByRole('button',{name:'Revisar documento',exact:true}),apply=page.getByRole('button',{name:'Aplicar con control de cambios',exact:true});
 const pick=async()=>{await page.locator('.suggestion').filter({hasText:'Dato pendiente detectado'}).click();};
 const writes=()=>page.evaluate(()=>window.wordState.writes);
 await review.click();await pick();await expect(apply).toBeEnabled();
 // The old implementation replaces an unrelated clause and changes tracking mode.
 await page.evaluate(()=>window.wordState.selection='Cláusula ajena');await apply.click();assert.deepEqual(await writes(),[]);assert.deepEqual(await page.evaluate(()=>wordState.tracking),[]);await expect(page.locator('#apply-status')).toContainText('exactamente');
 await page.evaluate(()=>window.wordState.selection='[FECHA]');await apply.click();assert.deepEqual(await writes(),[{text:'PENDIENTE: completar',where:'replace'}]);await expect(apply).toBeDisabled();
 await review.click();await page.locator('.suggestion').filter({hasText:'Sugerencia organizativa'}).first().click();await expect(apply).toBeDisabled();await expect(page.locator('#apply-status')).toContainText('No incluye');assert.equal((await writes()).length,1);
 await pick();await page.evaluate(()=>wordState.text+=' Documento cambiado.');await apply.click();assert.equal((await writes()).length,1);await expect(page.locator('#apply-status')).toContainText('cambió');await expect(apply).toBeDisabled();
 await review.click();await pick();fail=true;await review.click();await expect(page.locator('#review-status')).toContainText('Fallo sintético');await expect(apply).toBeDisabled();await expect(page.locator('.suggestion')).toHaveCount(0);fail=false;
 await review.click();await pick();hold=true;await review.click();await expect(apply).toBeDisabled();await expect(review).toBeDisabled();await expect(page.locator('.suggestion')).toHaveCount(0);await expect.poll(()=>Boolean(release)).toBe(true);release();hold=false;await expect(review).toBeEnabled();
 // A late response must not repopulate results after the document type changed.
 hold=true;release=null;await review.click();await expect.poll(()=>Boolean(release)).toBe(true);await page.selectOption('#document-type','escrito');release();hold=false;await expect(review).toBeEnabled();await expect(page.locator('.suggestion')).toHaveCount(0);await expect(apply).toBeDisabled();await review.click();
 await pick();await page.selectOption('#document-type','general');await expect(apply).toBeDisabled();await expect(page.locator('.suggestion')).toHaveCount(0);
 await review.click();await pick();await page.evaluate(()=>{let count=0;wordState.onSync=()=>{if(++count===1)wordState.text+=' edit during read';};});await apply.click();assert.equal((await writes()).length,1);await expect(page.locator('#apply-status')).toContainText('cambió');
 await page.evaluate(()=>{wordState.onSync=null;});await review.click();await pick();await page.evaluate(()=>{wordState.failWrite=2;});await apply.click();assert.equal((await writes()).length,2);await expect(apply).toBeDisabled();await expect(page.locator('#apply-status')).toContainText('No se pudo confirmar');await page.evaluate(()=>wordState.failWrite=false);
 await page.evaluate(()=>{wordState.text='Cláusula 8 sin encabezado.';});await review.click();await page.locator('.suggestion').filter({hasText:'Referencia posiblemente rota'}).click();await expect(apply).toBeDisabled();
 await page.evaluate(()=>{wordState.text='Contrato sintético. [FECHA]';});await review.click();await pick();await expect(page.locator('#apply-preview')).toContainText('PENDIENTE: completar');await expect(apply).toBeEnabled();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const evidence=process.env.REJON_UI_EVIDENCE_DIR;if(evidence){await mkdir(evidence,{recursive:true});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(evidence,'word-safe-narrow.png'),fullPage:true});await page.setViewportSize({width:1280,height:900});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(evidence,'word-safe-desktop.png'),fullPage:true});}
 assert.deepEqual(errors,[]);assert.ok(calls.length>=6);
 }finally{await browser?.close();await server?.close();await rm(cacheDir,{recursive:true,force:true});}
});
