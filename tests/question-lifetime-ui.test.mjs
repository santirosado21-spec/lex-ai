import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {access} from 'node:fs/promises';

const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
test('late inspection results, errors and finally cannot affect the current question',async()=>{
 const root=fileURLToPath(new URL('..',import.meta.url));
 const server=await createServer({root,configFile:false,plugins:[react()],logLevel:'error',server:{host:'127.0.0.1',port:0}});
 await server.listen();const options={headless:true};try{await access(chromium.executablePath());}catch{options.channel='chrome';}
 const browser=await chromium.launch(options);
 try{
  const page=await browser.newPage(),errors=[];
  // Ignore abort deliberately. Mark browser consumption, not just route fulfillment.
  await page.addInitScript(()=>{const original=window.fetch;window.completedInspections=[];window.fetch=async(input,init)=>{const response=await original(input,init?{...init,signal:undefined}:init);if(String(input).includes('/api')){await response.clone().text();window.completedInspections.push(JSON.parse(init.body).payload.text);}return response;};});
  page.on('pageerror',e=>errors.push(e.message));
  let requests=[];
  const candidate={key:'OLD/0',citationId:'OLD',label:'Fundamento anterior sintético',locator:'Referencia anterior',text:'Texto público anterior sintético.',partial:false};
  const result={id:'old',masked:'Consulta anterior',count:0,suggestedAngle:'requisitos',candidates:[candidate]};
  await page.route('**/api',async route=>{
   assert.equal(route.request().postDataJSON().action,'intake.inspectQuestion');
   const release=deferred();requests.push({release});await release.promise;
   const text=route.request().postDataJSON().payload.text;
   await route.fulfill(text.includes('late failure')?{status:500,json:{error:'Old synthetic failure'}}:{json:result});
  });
  async function open(){requests=[];await page.goto('about:blank');await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tests/fixtures/question-lifetime/index.html#token=synthetic`);await page.getByRole('button',{name:'Consultar con una pregunta propia'}).click();}
  async function start(text,count){await page.getByLabel('Pregunta del expediente').fill(text);await page.getByRole('button',{name:'Buscar fundamentos en este equipo'}).click();await expect.poll(()=>requests.length).toBe(count);}
  async function finish(index,text){requests[index].release.resolve();await page.waitForFunction(text=>window.completedInspections.includes(text),text);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
  async function noOldState(){await expect(page.getByRole('alert')).toHaveCount(0);await expect(page.getByLabel('Pasaje que quieres consultar')).toHaveCount(0);await expect(page.getByRole('button',{name:'Preparar mensaje para revisión'})).toHaveCount(0);}
  for(const control of ['Cambiar reservas sintéticas','Cambiar artículo sintético']){
   await open();const text='Consulta anterior del artículo 97 de la Ley Aduanera.';await start(text,1);await page.getByRole('button',{name:control,exact:true}).click();await finish(0,text);await noOldState();
   if(control.includes('artículo'))await expect(page.getByLabel('Pregunta del expediente')).toHaveValue('Consulta nueva del artículo 117 de la Ley Aduanera.');
  }
  // A fails only after B is pending. A must neither show an error nor free B's busy state.
  await open();const old='Consulta late failure del artículo 97.';await start(old,1);
  await page.getByRole('button',{name:'Cambiar artículo sintético',exact:true}).click();
  const current='Consulta vigente del artículo 117 de la Ley Aduanera.';await start(current,2);
  await finish(0,old);await noOldState();
  await expect(page.getByLabel('Pregunta del expediente')).toBeDisabled();
  await expect(page.getByRole('button',{name:'Buscar fundamentos en este equipo'})).toBeDisabled();
  await finish(1,current);
  await expect(page.getByLabel('Pregunta del expediente')).toBeEnabled();
  await expect(page.getByLabel('Pasaje que quieres consultar')).toHaveCount(1);
  await expect(page.getByRole('alert')).toHaveCount(0);assert.deepEqual(errors,[]);
 }finally{await browser.close();await server.close();}
});
