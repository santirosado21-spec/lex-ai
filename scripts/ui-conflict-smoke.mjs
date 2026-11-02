/** Conflict UI against the real local API and synthetic records; no inference. */
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createService} from '../server/service.mjs';
import {startServer} from '../server/main.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dataDir=await mkdtemp(path.join(os.tmpdir(),'lex-conflicts-ui-'));
const inference={async status(){return{state:'ready',supported:true};},async stop(){},async *generate(){throw Error('Conflict smoke must not invoke inference');}};
const service=await createService({dataDir,corpusPath:path.join(root,'resources/legal-corpus.json'),inference});
const app=await startServer({dataDir,inference,service,monitorDir:path.join(dataDir,'monitor'),libraryPath:path.join(dataDir,'missing.sqlite')});let browser;
const report={mode:'Synthetic development records on real local API; no inference',checks:[],startedAt:new Date().toISOString()};
const api=async(action,payload={})=>{const response=await fetch(app.connection.url+'/api',{method:'POST',headers:{Authorization:`Bearer ${app.connection.token}`,'Content-Type':'application/json'},body:JSON.stringify({action,payload})});assert.equal(response.status,200,`${action} returns 200`);return response.json();};

try {
  await mkdir('artifacts/ui-conflicts',{recursive:true});
  await api('workspace.create',{name:'Despacho sintético conflictos',practiceAreas:['Civil']});
  const current=await api('matter.create',{title:'Asunto actual sintético',client:'Cliente actual',jurisdiction:'MX-FED'});
  await api('matter.create',{title:'Asunto de contraparte sintético',client:'Cliente separado',jurisdiction:'MX-FED',counterparties:['Contraparte Global, S.A. de C.V.']});
  const other=await api('matter.create',{title:'Asunto aislado sintético',client:'Cliente aislado',jurisdiction:'MX-CMX'});
  await api('document.import',{matterId:other.id,name:'privado-sintetico.txt',base64:Buffer.from('SECRETO_DOCUMENTO_CONTRAPARTE no debe llegar a la vista.').toString('base64')});

  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const errors=[],remote=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(!request.url().startsWith(app.connection.url)&&!request.url().startsWith('data:'))remote.push(request.url());});
  await page.goto(`${app.connection.url}/#token=${app.connection.token}`);
  await page.getByRole('button',{name:'Buscar y ejecutar acciones'}).click();
  const search=page.getByRole('combobox',{name:'Buscar acciones, documentos y consultas'});
  await search.fill('Conflictos');await search.press('Enter');
  await expect(page.getByRole('heading',{name:'Conflictos',exact:true})).toBeVisible();
  await expect(page.getByRole('navigation',{name:'Navegación principal'}).getByText('Conflictos',{exact:true})).toHaveCount(0);

  await page.getByLabel('Agregar contraparte',{exact:true}).fill(' Contraparte actual ');
  await page.getByRole('button',{name:'Agregar',exact:true}).click();
  await expect(page.getByText('Contraparte actual',{exact:true})).toBeVisible();
  assert.deepEqual((await api('state')).matters.find(item=>item.id===current.id).counterparties,['Contraparte actual'],'counterparties persist only in the active matter');

  await page.getByLabel('Nombre para revisar',{exact:true}).fill('contraparte global');
  await page.getByRole('button',{name:'Revisar',exact:true}).click();
  const result=page.locator('.conflict-match').filter({hasText:'Asunto de contraparte sintético'});
  await expect(result).toBeVisible();await expect(result.getByText('Contraparte',{exact:true})).toBeVisible();await expect(result.getByText('Exacta',{exact:true})).toBeVisible();
  await expect(page.getByText(/chequeo léxico.*no una determinación jurídica/i).last()).toBeVisible();
  await expect(page.getByText('SECRETO_DOCUMENTO_CONTRAPARTE',{exact:true})).toHaveCount(0);

  await page.getByLabel('Nombre para revisar',{exact:true}).fill('Nombre sin coincidencia sintético');
  await page.getByRole('button',{name:'Revisar',exact:true}).click();
  await expect(page.getByText('Sin coincidencias en los datos de este equipo',{exact:true})).toBeVisible();
  await expect(page.getByText(/ausencia de coincidencias no es autorización ni clearance/i).last()).toBeVisible();

  for(const width of [1440,1024,768,390]) {
    await page.setViewportSize({width,height:1000});
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),{message:`No horizontal overflow at ${width}px`}).toBe(false);
    for(const control of [page.getByRole('button',{name:'Revisar',exact:true}),page.getByRole('button',{name:'Agregar',exact:true}),page.getByLabel('Eliminar contraparte Contraparte actual',{exact:true})]) {const rect=await control.boundingBox();assert.ok(rect&&rect.width>=44&&rect.height>=44,`44px conflict control at ${width}px`);}
    await page.screenshot({path:`artifacts/ui-conflicts/conflicts-${width}.png`,fullPage:true});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
  report.checks.push('Route is reached through Más herramientas without a fourth primary navigation item','Counterparties add and persist in the active matter','Counterparty results show Spanish field, exact badge and prominent no-clearance notice','Empty results retain the not-clearance note','No document text enters the view','1440/1024/768/390px have no horizontal overflow and controls are at least 44px','No inference, remote requests, or browser exceptions');report.status='PASS';
} catch(error) {
  report.status='FAIL';report.error=error.stack;process.exitCode=1;
} finally {
  await browser?.close();await app.close();report.finishedAt=new Date().toISOString();await writeFile('artifacts/ui-conflicts/smoke.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
