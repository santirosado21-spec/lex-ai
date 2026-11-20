// Local UI acceptance. The two credentials and all provider responses are fixtures.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {startServer} from '../server/main.mjs';
import {createIntakeGenerator} from '../server/intake-pilot.mjs';
import {selectPilotCredential} from '../server/providers/pilot-credentials.mjs';
import {openPilotUsage} from '../server/providers/pilot-usage.mjs';

const folder=await mkdtemp(path.join(tmpdir(),'rejon-r8-'));
const output=path.resolve('artifacts','cuentas-r8');
await mkdir(output,{recursive:true});
const ledger=await openPilotUsage(folder,'backup');
let account;
const calls=[];
const generate=createIntakeGenerator({
 getApiKey:selectPilotCredential('backup',slot=>'sk-'+(slot==='primary'?'a':'b').repeat(30),slot=>{account=slot;}),
 usageStatus:ledger.status,onAttempt:attempt=>ledger.record(account,attempt),fetchImpl:async(_url,options)=>{
  calls.push({account,body:options.body});
  if(calls.length===1)return Response.json({error:{code:'insufficient_quota'}},{status:429});
  if(calls.length===2)return Response.json({model:'gpt-6-luna',usage:{prompt_tokens:70,completion_tokens:13},
   choices:[{finish_reason:'stop',message:{content:'Acuse para [[CLIENTE]] sobre [[ASUNTO]].'}}]});
  throw Error('simulated disconnect');
 },
});
const browser=await chromium.launch();
let app;
try{
 app=await startServer({dataDir:folder,intakePilot:true,intakeGenerate:generate,autoInitialize:false,
  pilotPassphrase:Buffer.from('frase de ensayo para consumos')});
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const external=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(r.url().startsWith('http')&&new URL(r.url()).origin!==new URL(app.connection.url).origin)external.push(r.url());});
 await page.goto(app.connection.url+'/#pilot=intake&token='+app.connection.token);
 await page.getByText('Uso de OpenAI',{exact:true}).click();
 const table=page.getByRole('table',{name:'Consumo registrado en este expediente'});
 await table.waitFor();
 await page.locator('#intake-firm').fill('Firma Sintética');await page.getByRole('button',{name:'Continuar'}).click();
 await page.locator('#intake-client').fill('Persona Sintética');await page.locator('#intake-title').fill('Asunto Sintético');
 await page.getByRole('button',{name:'Guardar en este equipo'}).click();
 await page.locator('#intake-task').selectOption('opening');
 const send=page.getByRole('button',{name:'Enviar y generar borrador'});
 await send.click();await page.getByText('Último envío de Lorenzo: respuesta recibida.').waitFor();
 assert.deepEqual(await table.getByRole('row').nth(2).allTextContents(),['Lorenzo17013']);
 await page.locator('#intake-task').selectOption('documents');
 await send.click();await page.getByText('Último envío de Principal: resultado sin confirmar.').waitFor();
 assert.equal(await send.isDisabled(),true);
 assert.match(await table.getByRole('row').nth(1).innerText(),/Principal\s+2\s+0\s+0/);
 for(const width of [320,390,768,1280]){
  await page.setViewportSize({width,height:900});
  assert.ok(await table.evaluate(el=>el.getBoundingClientRect().right<=window.innerWidth));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 }
 await table.scrollIntoViewIfNeeded();
 await page.locator('.rp-usage').screenshot({path:path.join(output,'consumo-por-cuenta.png')});
 await page.reload();await page.getByText('Uso de OpenAI',{exact:true}).click();await table.waitFor();
 assert.ok((await page.locator('.rp-usage').innerText()).includes('sin desglose completo de tokens: 2'));
 assert.deepEqual(calls.map(c=>c.account),['primary','lorenzo','primary']);
 assert.equal(calls[0].body,calls[1].body);assert.ok(calls.every(c=>!c.body.includes('Sintétic')));
 assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 console.log('Respaldo y contabilidad visibles en Chromium. Tres intentos simulados, un borrador, cuatro anchos y cero solicitudes externas.');
}finally{await browser.close();await app?.close();await rm(folder,{recursive:true,force:true});}
