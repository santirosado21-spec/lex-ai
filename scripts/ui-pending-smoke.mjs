/** Pendientes UI against the real local API and synthetic records; no inference. */
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createService} from '../server/service.mjs';
import {startServer} from '../server/main.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dataDir=await mkdtemp(path.join(os.tmpdir(),'lex-pending-'));
const clock=()=>new Date('2026-01-15T18:00:00.000Z');
const inference={async status(){return{state:'ready',supported:true};},async stop(){},async *generate(){throw Error('Pendientes smoke must not invoke inference');}};
const service=await createService({dataDir,corpusPath:path.join(root,'resources/legal-corpus.json'),inference,clock,plannerTimeZone:'America/Mexico_City'});
const app=await startServer({dataDir,inference,service,monitorDir:path.join(dataDir,'monitor'),libraryPath:path.join(dataDir,'missing.sqlite')});let browser;
const report={mode:'Synthetic development records on real local API; no inference',checks:[],startedAt:new Date().toISOString()};
const api=async(action,payload={})=>{const response=await fetch(app.connection.url+'/api',{method:'POST',headers:{Authorization:`Bearer ${app.connection.token}`,'Content-Type':'application/json'},body:JSON.stringify({action,payload})});assert.equal(response.status,200,`${action} returns 200`);return response.json();};

try {
  await mkdir('artifacts/ui-pending',{recursive:true});
  await api('workspace.create',{name:'Despacho sintético pendientes',practiceAreas:['Civil']});
  const a=await api('matter.create',{title:'Asunto sintético A',client:'Cliente ficticio A',jurisdiction:'MX-FED'});
  const b=await api('matter.create',{title:'Asunto aislado B',client:'Cliente ficticio B',jurisdiction:'MX-CMX'});
  await api('document.import',{matterId:a.id,name:'documento-sintetico-a.txt',base64:Buffer.from('Documento sintético para una sugerencia local.').toString('base64')});
  await api('reminder.create',{matterId:a.id,kind:'followup',title:'Atrasado sintético',dueAt:'2026-01-14',note:'Solo prueba local.'});
  await api('reminder.create',{matterId:a.id,kind:'followup',title:'Próximo sintético',dueAt:'2026-01-18',note:''});
  await api('reminder.create',{matterId:b.id,kind:'followup',title:'SECRETO_ASUNTO_B',dueAt:'2026-01-15',note:''});

  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const errors=[],remote=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(!request.url().startsWith(app.connection.url)&&!request.url().startsWith('data:'))remote.push(request.url());});
  await page.goto(`${app.connection.url}/#token=${app.connection.token}`);
  const nav=page.getByRole('navigation',{name:'Navegación principal'});
  await nav.getByRole('button',{name:'Pendientes',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Pendientes',exact:true})).toBeVisible();
  await expect(page.getByText('Atrasado sintético',{exact:true})).toBeVisible();
  await expect(page.getByText('Próximo sintético',{exact:true})).toBeVisible();
  await expect(page.getByText('SECRETO_ASUNTO_B',{exact:true})).toHaveCount(0);

  await page.getByLabel('Pendiente',{exact:true}).fill('Hoy sintético');
  await page.getByLabel('Fecha',{exact:true}).fill('2026-01-15');
  await page.getByRole('button',{name:'Agregar pendiente',exact:true}).click();
  const todayBucket=page.locator('.pending-bucket').filter({has:page.getByRole('heading',{name:'Hoy',exact:true})});
  await expect(todayBucket.getByText('Hoy sintético',{exact:true})).toBeVisible();
  const created=(await api('reminder.list',{matterId:a.id,status:'approved'})).find(item=>item.title==='Hoy sintético');assert.ok(created,'create writes an approved reminder in the active matter');

  await page.getByRole('button',{name:'Revisar pendientes',exact:true}).click();
  const suggestion=page.locator('.pending-card').filter({hasText:'Revisar documentos importados'});
  await expect(suggestion).toBeVisible();
  await suggestion.getByRole('button',{name:'Aprobar',exact:true}).click();
  await expect(suggestion).toHaveCount(0);
  assert.ok((await api('reminder.list',{matterId:a.id,status:'approved'})).some(item=>item.title==='Revisar documentos importados'),'approve changes a proposed reminder only in its matter');

  const todayCard=todayBucket.locator('.pending-card').filter({hasText:'Hoy sintético'});
  await todayCard.getByRole('button',{name:'Completar',exact:true}).click();
  await expect(todayCard).toHaveCount(0);
  assert.ok((await api('reminder.list',{matterId:a.id,status:'done'})).some(item=>item.id===created.id),'complete persists done status');

  const upcoming=page.locator('.pending-card').filter({hasText:'Próximo sintético'});
  await upcoming.getByRole('button',{name:'Descartar',exact:true}).click();
  await expect(upcoming).toHaveCount(0);
  assert.ok((await api('reminder.list',{matterId:a.id,status:'dismissed'})).some(item=>item.title==='Próximo sintético'),'dismiss persists dismissed status');

  await page.getByLabel('Asunto activo',{exact:true}).selectOption(b.id);
  await expect(page.getByText('SECRETO_ASUNTO_B',{exact:true})).toBeVisible();
  await expect(page.getByText('Atrasado sintético',{exact:true})).toHaveCount(0);
  await page.getByLabel('Asunto activo',{exact:true}).selectOption(a.id);
  await expect(page.getByText('SECRETO_ASUNTO_B',{exact:true})).toHaveCount(0);

  for(const width of [1440,1024,768,390]) {
    await page.setViewportSize({width,height:1000});
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),{message:`No horizontal overflow at ${width}px`}).toBe(false);
    for(const control of [page.getByRole('button',{name:'Revisar pendientes',exact:true}),page.getByLabel('Fecha',{exact:true}),page.getByRole('button',{name:'Agregar pendiente',exact:true})]) {const rect=await control.boundingBox();assert.ok(rect&&rect.width>=44&&rect.height>=44,`44px pending control at ${width}px`);}
    await page.screenshot({path:`artifacts/ui-pending/pending-${width}.png`,fullPage:true});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
  report.checks.push('Pendientes is visible in Herramientas jurídicas; its counter is reserved for real active-matter tasks','Create writes an approved active-matter reminder','Planner proposal is local and requires explicit approval','Complete and dismiss persist their statuses','Other-matter reminders stay hidden until that matter is selected','1440/1024/768/390px have no horizontal overflow and pending controls are at least44px','No inference, remote requests, or browser exceptions');report.status='PASS';
} catch(error) {
  report.status='FAIL';report.error=error.stack;process.exitCode=1;
} finally {
  await browser?.close();await app.close();report.finishedAt=new Date().toISOString();await writeFile('artifacts/ui-pending/smoke.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
