import test from 'node:test';
import assert from 'node:assert/strict';
import {access,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';

for(const host of ['word','excel','sharepoint'])test(`Office ${host} shared assistant preserves unsaved edits on history, save races and failed save`,async()=>{
 const root=fileURLToPath(new URL('..',import.meta.url)),cacheDir=await mkdtemp(path.join(tmpdir(),'office-draft-'));let server,browser;
 try{
 server=await createServer({root,cacheDir,configFile:false,server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();let options={headless:true};try{await access(chromium.executablePath());}catch{options.channel='chrome';}browser=await chromium.launch(options);const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.route('https://appsforoffice.microsoft.com/**',route=>route.fulfill({contentType:'text/javascript',body:'window.Office={onReady:callback=>callback(),context:{}};'}));
 const answer={id:'synthetic-reply',question:'Agenda sintética',text:'Original guardado.',citations:[]};let version=1,holdSave=false,releaseSave,failSave=false,holdHistory=false,releaseHistory;const saves=[];
 await page.route('**/v1/thread',async route=>{if(holdHistory)await new Promise(r=>releaseHistory=r);await route.fulfill({json:[answer]});});
 await page.route('**/v1/draft',route=>route.fulfill({json:{id:'synthetic-draft',version,title:'Agenda',text:'Borrador guardado.'}}));
 await page.route('**/v1/draft/save',async route=>{const body=route.request().postDataJSON();saves.push(body);if(holdSave)await new Promise(r=>releaseSave=r);if(failSave){await route.fulfill({status:500,json:{error:'Fallo sintético de guardado'}});return;}version++;await route.fulfill({json:{...body,version,text:body.text}});});
 if(host==='sharepoint')await page.addInitScript(()=>Object.defineProperty(window,'opener',{value:{postMessage(){}},configurable:true}));
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/office-addin/${host}.html${host==='sharepoint'?'?tenant=https://synthetic.sharepoint.com':''}`);await page.evaluate(()=>{sessionStorage.setItem('lex-office-context',location.pathname+location.search);sessionStorage.setItem('lex-office-token','synthetic');});await page.reload();
 const history=page.getByRole('button',{name:'Ver conversación del asunto'}),edit=()=>page.getByRole('button',{name:/Editar versión|Guardar versión en el asunto/}),editor=()=>page.locator('.reply textarea'),status=page.locator('.pane-status');
 await history.click();await edit().click();await editor().fill('Edición local no guardada.');let dialogs=0;page.once('dialog',async d=>{dialogs++;await d.dismiss();});await history.click();assert.equal(dialogs,1);await expect(editor()).toHaveValue('Edición local no guardada.');await expect(status).toContainText('conserva');
 // A history request begun before typing still checks dirty state at completion.
 page.once('dialog',d=>d.accept());await history.click();await edit().click();
 holdHistory=true;releaseHistory=null;const pendingHistory=history.click();await expect.poll(()=>Boolean(releaseHistory)).toBe(true);await editor().fill('Edición durante historial.');page.once('dialog',d=>d.dismiss());releaseHistory();holdHistory=false;await pendingHistory;await expect(editor()).toHaveValue('Edición durante historial.');
 holdSave=true;releaseSave=null;await edit().click();await expect.poll(()=>Boolean(releaseSave)).toBe(true);await history.click();await expect(status).toContainText('Espera');await editor().fill('Edición posterior al envío.');releaseSave();holdSave=false;await expect(edit()).toBeEnabled();await expect(status).toContainText('Se conserva tu edición posterior, aún sin guardar.');await expect(editor()).toHaveValue('Edición posterior al envío.');assert.equal(saves[0].text,'Edición durante historial.');
 failSave=true;await edit().click();await expect(status).toContainText('Fallo sintético');await expect(editor()).toHaveValue('Edición posterior al envío.');failSave=false;
 await edit().click();await expect(status).toContainText('guardada');assert.equal(saves.at(-1).expectedVersion,2);assert.equal(saves.at(-1).text,'Edición posterior al envío.');
 // Clean editor permits history refresh without asking.
 await history.click();await expect(editor()).toHaveValue('Original guardado.');
 // History completes while a version-opening request is still pending.
 holdHistory=true;releaseHistory=null;const racingHistory=history.click();await expect.poll(()=>Boolean(releaseHistory)).toBe(true);
 let releaseDraft;await page.route('**/v1/draft',async route=>{await new Promise(r=>releaseDraft=r);await route.fulfill({json:{id:'synthetic-draft',version,title:'Agenda',text:'Borrador guardado.'}});});
 await edit().click();await expect.poll(()=>Boolean(releaseDraft)).toBe(true);releaseHistory();holdHistory=false;await racingHistory;await expect(status).toContainText('versión en proceso');await expect(edit()).toBeDisabled();releaseDraft();await expect(edit()).toBeEnabled();await expect(editor()).toHaveValue('Borrador guardado.');await page.unroute('**/v1/draft');await page.route('**/v1/draft',route=>route.fulfill({json:{id:'synthetic-draft',version,title:'Agenda',text:'Borrador guardado.'}}));
 await editor().fill('Edición que se descarta explícitamente.');page.once('dialog',d=>d.accept());await history.click();await expect(editor()).toHaveValue('Original guardado.');
 await edit().click();await editor().fill('Edición protegida al recargar.');page.once('dialog',d=>d.dismiss());await page.reload({timeout:3000}).catch(e=>assert.match(e.message,/ERR_ABORTED|Timeout/));await expect(editor()).toHaveValue('Edición protegida al recargar.');
 const evidence=process.env.REJON_UI_EVIDENCE_DIR;if(evidence){const fs=await import('node:fs/promises');await fs.mkdir(evidence,{recursive:true});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(evidence,`office-draft-${host}-narrow.png`),fullPage:true});await page.setViewportSize({width:1280,height:900});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(evidence,`office-draft-${host}-desktop.png`),fullPage:true});}assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }finally{await browser?.close();await server?.close();await rm(cacheDir,{recursive:true,force:true});}
});
