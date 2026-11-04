/** Real UI/API; synthetic dictation and audio only. Never loads a model or records a microphone. */
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {startServer} from '../server/main.mjs';

const output='artifacts/memory-training-20261103/prompt-limit';
await mkdir(output,{recursive:true});
const dataDir=await mkdtemp(path.join(os.tmpdir(),'lex-prompt-limit-'));
const inference={async status(){return {state:'ready',supported:true};},async stop(){},async *generate(){throw Error('This smoke must not invoke inference');}};
const app=await startServer({dataDir,inference,libraryPath:path.join(dataDir,'missing.sqlite')});
let browser;
try{
 const response=await fetch(app.connection.url+'/api',{method:'POST',headers:{Authorization:`Bearer ${app.connection.token}`,'Content-Type':'application/json'},body:JSON.stringify({action:'workspace.create',payload:{name:'Despacho sintético de límites',practiceAreas:['civil']}})});
 assert.equal(response.status,200);
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:900},reducedMotion:'reduce'});
 await context.addInitScript(()=>{
  class Node{constructor(){this.port={onmessage:null};}disconnect(){}}
  class Context{sampleRate=16000;audioWorklet={addModule:async()=>{}};createMediaStreamSource(){return {connect:node=>setTimeout(()=>node.port.onmessage?.({data:new Float32Array(160).buffer}),0)};}close(){return Promise.resolve();}}
  Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})},configurable:true});
  Object.defineProperty(window,'AudioContext',{value:Context,configurable:true});
  Object.defineProperty(window,'AudioWorkletNode',{value:Node,configurable:true});
 });
 const page=await context.newPage(),errors=[];let analysisRequests=0;
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(r.url().endsWith('/analyze'))analysisRequests++;});
 await page.route('**/api',async route=>{
  const body=route.request().postDataJSON();
  if(body?.action==='stt.status')return route.fulfill({json:{state:'ready',ready:true,installed:true}});
  if(body?.action==='stt.transcribe')return route.fulfill({json:{text:'x'.repeat(900)}});
  return route.continue();
 });
 await page.goto(`${app.connection.url}/#token=${app.connection.token}`);
 const input=page.getByLabel('Pregunta sobre el asunto'),send=page.getByRole('button',{name:'Preguntar',exact:true}),status=page.locator('#lex-prompt-limit'),counter=page.locator('.lex-prompt-limit');
 await expect(input).toBeVisible();
 await input.fill('a'.repeat(3199));await expect(counter).toHaveCount(0);await expect(status).toHaveText('');
 await input.fill('a'.repeat(3200));await expect(counter).toContainText('3,200');await expect(status).toContainText('Te acercas');
 const announcement=await status.textContent();await input.fill('a'.repeat(3500));assert.equal(await status.textContent(),announcement);
 await page.getByRole('button',{name:'Dictar texto',exact:true}).click();
 await page.getByRole('button',{name:'Finalizar dictado',exact:true}).click();
 const draft='a'.repeat(3500)+' '+'x'.repeat(900);
 await expect(input).toHaveValue(draft);await expect(input).toHaveAttribute('aria-invalid','true');
 await expect(counter).toContainText('Excede el límite por 401');await expect(status).toContainText('Acórtala');await expect(send).toBeDisabled();
 assert.match(await input.getAttribute('aria-describedby'),/lex-prompt-limit/);
 for(const [theme,color] of [['light','rgb(161, 39, 28)'],['dark','rgb(238, 123, 111)']]){
  await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
  await expect(counter).toHaveCSS('color',color);
  await page.screenshot({path:`${output}/${theme}.png`,fullPage:true});
 }
 await page.setViewportSize({width:320,height:850});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await input.fill('Texto corregido que se conserva completo.');await expect(input).not.toHaveAttribute('aria-invalid','true');await expect(send).toBeEnabled();await expect(counter).toHaveCount(0);
 assert.equal(analysisRequests,0);assert.deepEqual(errors,[]);
 await writeFile(`${output}/report.json`,JSON.stringify({passed:true,mode:'synthetic audio/transcript; actual UI and local API; no inference',checks:['near-limit status remains stable while typing','oversized dictation preserved, explained and blocked','editing restores submission','explicit light/dark themes use product tokens','320px without horizontal overflow','no automatic submission or inference']},null,2));
 console.log('Prompt limit smoke PASS: oversized dictation preserved, accessible explanation, correction, themes and 320px.');
}finally{await browser?.close();await app.close();await rm(dataDir,{recursive:true,force:true});}
