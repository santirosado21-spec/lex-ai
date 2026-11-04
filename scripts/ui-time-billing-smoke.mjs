/** Browser smoke for Tiempo y honorarios. Uses only synthetic local data; requires the documented service/App wiring. */
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium,expect} from '@playwright/test';
import {createService} from '../server/service.mjs';
import {startServer} from '../server/main.mjs';

const root=process.cwd();
const dataDir=await mkdtemp(path.join(os.tmpdir(),'lex-time-billing-ui-'));
const inference={async status(){return {state:'ready',supported:true};},async stop(){},async *generate(){throw new Error('This smoke must not invoke inference.');}};
let app,browser;
const report={syntheticData:true,checks:[],startedAt:new Date().toISOString()};

try {
  const service=await createService({dataDir,corpusPath:path.join(root,'resources/legal-corpus.json'),inference});
  app=await startServer({dataDir,inference,service,monitorDir:path.join(dataDir,'monitor'),libraryPath:path.join(dataDir,'missing.sqlite')});
  const request=async(action,payload={})=>{
    const response=await fetch(`${app.connection.url}/api`,{method:'POST',headers:{Authorization:`Bearer ${app.connection.token}`,'Content-Type':'application/json'},body:JSON.stringify({action,payload})});
    assert.equal(response.status,200,`${action} should succeed`);return response.json();
  };
  await request('workspace.create',{name:'Despacho sintético honorarios',practiceAreas:['civil']});
  const matter=await request('matter.create',{title:'Asunto sintético honorarios',client:'Cliente sintético',jurisdiction:'MX-FED'});
  await request('billing.arrangement.set',{matterId:matter.id,arrangement:'hourly',hourlyRateCentavos:12_000,billingIncrementMinutes:6});
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce',colorScheme:'light',acceptDownloads:true});
  const exceptions=[],remote=[];page.on('pageerror',error=>exceptions.push(error.message));page.on('request',item=>{if(!item.url().startsWith(app.connection.url)&&!item.url().startsWith('data:'))remote.push(item.url());});
  await page.goto(`${app.connection.url}/#token=${app.connection.token}`);
  const nav=page.getByRole('navigation',{name:'Navegación principal'});
  await nav.getByRole('button',{name:'Herramientas jurídicas',exact:true}).click();
  await nav.getByRole('button',{name:'Tiempo y honorarios',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Tiempo y honorarios',exact:true})).toBeVisible();
  await page.getByRole('combobox',{name:/^AsuntoSelecciona|^Asunto$/}).selectOption(matter.id);
  await page.getByLabel('Descripción breve').fill('=Actividad sintética de prueba');
  await page.getByLabel('Minutos').fill('31');
  await page.getByRole('button',{name:'Guardar entrada',exact:true}).click();
  await expect(page.getByText('0 h 31 min',{exact:true}).first()).toBeVisible();
  await expect(page.getByText('$60.00',{exact:true}).first()).toBeVisible();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar CSV',exact:true}).click();
  assert.match((await download).suggestedFilename(),/\.csv$/);
  await page.getByRole('button',{name:'Marcar pendientes como cobradas',exact:true}).click();
  await expect(page.getByText('Cobrado',{exact:true}).last()).toBeVisible();
  await page.getByLabel('Resultado').selectOption('acuerdo');
  await page.getByRole('button',{name:'Registrar resolución',exact:true}).click();
  await expect(page.getByText('Resultado: acuerdo',{exact:true})).toBeVisible();
  for(const width of [1440,768,390]){await page.setViewportSize({width,height:1000});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
  assert.deepEqual(exceptions,[]);assert.deepEqual(remote,[]);
  report.checks.push('time entry rounds 31 minutes to six-minute billing increment','CSV downloads','unbilled entries can be marked billed','explicit resolution renders','no overflow at 1440/768/390','no browser errors or remote requests');report.status='PASS';
} catch(error) {report.status='FAIL';report.error=error.stack;process.exitCode=1;
} finally {await browser?.close();await app?.close();await rm(dataDir,{recursive:true,force:true});report.finishedAt=new Date().toISOString();console.log(JSON.stringify(report,null,2));}
