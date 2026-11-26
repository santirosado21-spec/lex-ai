/** Synthetic persisted history/transport only. Reasoning stays OFF; no real Mail accounts or recipients. */
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';import mammoth from 'mammoth';
import {mkdtemp,mkdir,writeFile,rm,access,realpath} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';import react from '@vitejs/plugin-react';
import {createService} from '../server/service.mjs';import {startServer} from '../server/main.mjs';
import {createStore} from '../server/store.mjs';import {createReasoningBoundary} from '../server/reasoning-boundary.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const dir=await mkdtemp(path.join(os.tmpdir(),'lex-writing-email-ui-')),cache=await mkdtemp(path.join(os.tmpdir(),'lex-writing-vite-'));
const evidence=process.env.REJON_UI_EVIDENCE_DIR||path.resolve('artifacts/ui-writing-email');
let modelCalls=0,modelStarts=0,analyzeRequests=0;const sent=[];
const inference=createReasoningBoundary({async status(){return {state:'ready'};},async initialize(){modelStarts++;throw Error('Unexpected model start');},async stop(){},async *generate(){modelCalls++;throw Error('Unexpected generation');}});
const transport={supported:true,async accounts(){return {accounts:[{id:'TEST',name:'Cuenta sintética',addresses:['owner@example.test']}]};},async send(message){sent.push(structuredClone(message));return {accepted:true};}};
const service=await createService({dataDir:dir,corpusPath:path.join(root,'resources/legal-corpus.json'),inference,mailTransport:transport,schedulerEnabled:false,clock:()=>new Date('2026-11-03T12:00:00Z'),openFile:async()=>({opened:true})});
const app=await startServer({dataDir:dir,inference,service,libraryPath:path.join(dir,'missing.sqlite')});
const api=async(action,payload={})=>{const res=await fetch(app.connection.url+'/api',{method:'POST',headers:{Authorization:`Bearer ${app.connection.token}`,'Content-Type':'application/json'},body:JSON.stringify({action,payload})});assert.equal(res.status,200);return res.json();};
const report={mode:'persisted synthetic history, reasoning OFF, fake Mail transport only; no real email',checks:[]};let browser,vite;
try{
 await mkdir(evidence,{recursive:true});
 await api('workspace.create',{name:'Despacho sintético de escritos',practiceAreas:['civil']});
 const matter=await api('matter.create',{title:'Asunto sintético',client:'Parte ficticia',jurisdiction:'MX-FED'});
 await api('reminder.create',{matterId:matter.id,title:'Seguimiento aprobado',kind:'followup',dueAt:'2026-11-03T10:00:00Z',note:'Solo dato sintético'});
 // Historical fixture only, never a generated provider result.
 const workspace=(await api('state')).workspace,store=createStore(dir);
 store.put('chat',{id:'synthetic-history',workspaceId:workspace.id,matterId:matter.id,kind:'chat',question:'Consulta histórica sintética',text:'Texto histórico sintético del asistente para revisión y edición.',citations:[],createdAt:'2026-11-02T12:00:00Z',validation:{citationIntegrity:false}});store.close();
 vite=await createServer({root,cacheDir:cache,configFile:false,plugins:[react()],server:{host:'127.0.0.1',port:0,fs:{allow:[root,await realpath(path.join(root,'node_modules'))]}},logLevel:'error'});await vite.listen();
 const options={headless:true};try{await access(chromium.executablePath());}catch{options.channel='chrome';}
 browser=await chromium.launch(options);const page=await browser.newPage({viewport:{width:1440,height:1100},timezoneId:'America/Mexico_City',reducedMotion:'reduce'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api',async route=>{const response=await route.fetch({url:app.connection.url+'/api',headers:{Authorization:'Bearer '+app.connection.token,'Content-Type':'application/json'}});await route.fulfill({response});});
 await page.route('**/analyze',async route=>{analyzeRequests++;await route.abort();});
 await page.clock.setFixedTime(new Date('2026-11-03T12:00:00Z'));
 await page.goto('http://127.0.0.1:'+vite.httpServer.address().port+'/#token=synthetic');
 await page.getByRole('button',{name:'Asistente',exact:true}).click();await page.getByRole('combobox',{name:'Asunto activo',exact:true}).selectOption(matter.id);
 assert.equal((await api('state')).reasoning.available,false);assert.equal((await api('engine.status')).reasoning.available,false);
 const question=page.getByLabel('Pregunta sobre el asunto');await question.fill('Pregunta conservada sin generación');await question.press('Enter');await expect(question).toHaveValue('Pregunta conservada sin generación');await expect(page.getByRole('button',{name:'Preguntar',exact:true})).toBeDisabled();
 const original=(await api('state')).chatTurns[0];assert.equal(original.id,'synthetic-history');
 await page.getByRole('button',{name:'Editar escrito',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog.getByLabel('Texto editable')).toHaveValue(original.text);
 await dialog.getByLabel('Título del escrito').fill('Escrito editado sintético');await dialog.getByLabel('Texto editable').fill('Versión editada sintética para enviar a revisión.');await dialog.getByRole('button',{name:'Guardar nueva versión',exact:true}).click();await expect(dialog).toContainText('Nueva versión guardada.');
 let draft=await api('draft.get',{replyId:original.id,matterId:matter.id});assert.equal(draft.version,2);assert.equal((await api('state')).chatTurns[0].text,'Versión editada sintética para enviar a revisión.');assert.equal((await api('state')).chatTurns[0].validation.citationIntegrity,false);assert.equal(draft.original.text,original.text);
 await page.getByRole('button',{name:'Cerrar diálogo',exact:true}).click();await expect(page.locator('.thread-turn').first()).toContainText('Versión editada sintética para enviar a revisión.');await expect(page.locator('.thread-turn').first()).toContainText('Editada por ti · Versión 2.');await page.getByRole('button',{name:'Editar escrito',exact:true}).click();await expect(dialog.getByLabel('Texto editable')).toHaveValue('Versión editada sintética para enviar a revisión.');
 await dialog.getByLabel('Versión para revisar').selectOption('1');await dialog.getByRole('button',{name:'Restaurar como nueva versión',exact:true}).click();await expect(dialog.getByLabel('Texto editable')).toHaveValue(original.text);draft=await api('draft.get',{replyId:original.id,matterId:matter.id});assert.equal(draft.version,3);assert.equal(draft.versions[1].text,'Versión editada sintética para enviar a revisión.');
 const downloadPromise=page.waitForEvent('download');await dialog.getByRole('button',{name:'Exportar versión DOCX',exact:true}).click();const download=await downloadPromise;assert.match(download.suggestedFilename(),/v3\.docx$/);await download.saveAs(path.join(evidence,'edited-synthetic-v3.docx'));assert.equal((await mammoth.extractRawText({path:path.join(evidence,'edited-synthetic-v3.docx')})).value.includes(original.text),true);
 await dialog.getByRole('button',{name:'Preparar correo',exact:true}).click();await expect(page.getByRole('heading',{name:'Correo y seguimiento',exact:true})).toBeVisible();await expect(page.getByLabel('Mensaje exacto')).toHaveValue(original.text);assert.equal(sent.length,0);
 report.checks.push('persisted synthetic chat history remains editable with reasoning OFF; save/restore append immutable versions and preserve original; actual DOCX download has v3 filename and restored text; email preparation does not send');
 await page.getByRole('button',{name:'Conectar Mail',exact:true}).click();await expect(page.getByRole('button',{name:'Actualizar cuentas de Mail',exact:true})).toBeVisible();await page.getByLabel('Para',{exact:true}).fill('client@example.test');await page.getByRole('button',{name:'Revisar mensaje antes de enviar',exact:true}).click();
 const first=page.locator('.workflow-card').filter({has:page.getByRole('heading',{name:draft.current.title,exact:true})});await expect(first.getByRole('button',{name:'Aprobar y enviar este mensaje',exact:true})).toBeDisabled();assert.equal(sent.length,0);
 await first.getByRole('checkbox').check();await first.getByRole('button',{name:'Aprobar y enviar este mensaje',exact:true}).click();await expect(first).toContainText('Aceptado por Mail');assert.equal(sent.length,1);assert.equal(sent[0].body,original.text);assert.deepEqual(sent[0].to,['client@example.test']);
 await page.getByLabel('Asunto del correo',{exact:true}).fill('Envío programado sintético');await page.getByLabel('Programar envío (hora de este equipo)').fill('2030-01-01T12:00');await page.getByRole('button',{name:'Revisar mensaje antes de enviar',exact:true}).click();const scheduled=page.locator('.workflow-card').filter({has:page.getByRole('heading',{name:'Envío programado sintético',exact:true})});await scheduled.getByRole('checkbox').check();await scheduled.getByRole('button',{name:'Aprobar envío programado',exact:true}).click();assert.equal(sent.length,1);await scheduled.getByRole('button',{name:'Revocar este correo',exact:true}).click();await expect(scheduled).toContainText('Revocado');
 report.checks.push('Mail uses injected fake transport; exact recipients/body remain pending until checked approval; scheduled approval can be revoked before send');
 await page.getByLabel('Asunto de la regla').selectOption(matter.id);await page.getByRole('checkbox',{name:'Autorizo preparar estos borradores localmente para este asunto.',exact:true}).check();await page.getByRole('button',{name:'Activar regla de borradores',exact:true}).click();await expect(page.getByText('Regla guardada. Las propuestas aparecerán aquí para revisión.',{exact:true})).toBeVisible();
 for(let i=0;i<2;i++){
  const tick=page.waitForResponse(response=>response.url().endsWith('/api')&&response.request().postDataJSON()?.action==='scheduler.tick');
  await page.getByRole('button',{name:'Revisar pendientes ahora',exact:true}).click();const result=await (await tick).json();assert.equal(result.proactive.generated,0);assert.equal(result.proactive.waitingForAssistant,true);
  await expect(page.getByText('Revisión local completada.',{exact:true})).toBeVisible();assert.equal((await api('proactive.list')).jobs.length,0);
 }
 assert.equal((await api('proactive.list')).rules.length,1);assert.equal((await api('proactive.list')).rules[0].enabled,true);await expect(page.getByRole('button',{name:'Revisar y editar borrador',exact:true})).toHaveCount(0);assert.equal(sent.length,1);
 for(const width of [1440,390]){await page.setViewportSize({width,height:1100});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.screenshot({path:path.join(evidence,`workflow-${width}.png`),fullPage:true});if(width===390){await page.getByRole('heading',{name:'Borradores proactivos',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(evidence,'workflow-390-rules.png')});}}
 assert.deepEqual(errors,[]);assert.equal(modelCalls,0);assert.equal(modelStarts,0);assert.equal(analyzeRequests,0);report.counters={modelCalls,modelStarts,analyzeRequests,fakeMailSends:sent.length};report.checks.push('opt-in rule retained but repeated scheduler checks create no drafts while reasoning OFF; zero generation/start/analyze; desktop/mobile no overflow');report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.stack;process.exitCode=1;}finally{await browser?.close();await vite?.close();await app.close();await rm(dir,{recursive:true,force:true});await rm(cache,{recursive:true,force:true});await writeFile(path.join(evidence,'smoke.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
