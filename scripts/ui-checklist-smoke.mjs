/** Checklist UI against the real local API and synthetic records; no inference. */
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createService} from '../server/service.mjs';
import {startServer} from '../server/main.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dataDir=await mkdtemp(path.join(os.tmpdir(),'lex-checklist-ui-'));
const inference={async status(){return{state:'ready',supported:true};},async stop(){},async *generate(){throw Error('Checklist smoke must not invoke inference');}};
const service=await createService({dataDir,corpusPath:path.join(root,'resources/legal-corpus.json'),inference});
const app=await startServer({dataDir,inference,service,monitorDir:path.join(dataDir,'monitor'),libraryPath:path.join(dataDir,'missing.sqlite')});let browser;
const report={mode:'Synthetic development records on real local API; no inference',checks:[],startedAt:new Date().toISOString()};
const api=async(action,payload={})=>{const response=await fetch(app.connection.url+'/api',{method:'POST',headers:{Authorization:`Bearer ${app.connection.token}`,'Content-Type':'application/json'},body:JSON.stringify({action,payload})});assert.equal(response.status,200,`${action} returns 200`);return response.json();};

try {
  await mkdir('artifacts/ui-checklist',{recursive:true});
  await api('workspace.create',{name:'Despacho sintético checklist',practiceAreas:['Civil']});
  const current=await api('matter.create',{title:'Asunto actual sintético',client:'Cliente actual',jurisdiction:'MX-FED'});
  const other=await api('matter.create',{title:'Asunto aislado sintético',client:'Cliente aislado',jurisdiction:'MX-CMX'});
  await api('document.import',{matterId:other.id,name:'privado-sintetico.txt',base64:Buffer.from('SECRETO_DOCUMENTO_CHECKLIST no debe llegar a la checklist.').toString('base64')});

  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const errors=[],remote=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(!request.url().startsWith(app.connection.url)&&!request.url().startsWith('data:'))remote.push(request.url());});
  await page.goto(`${app.connection.url}/#token=${app.connection.token}`);
  const nav=page.getByRole('navigation',{name:'Navegación principal'});
  await nav.getByRole('button',{name:'Checklist',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Checklist',exact:true})).toBeVisible();
  await expect(nav.getByRole('button',{name:'Checklist',exact:true})).toHaveAttribute('aria-current','page');
  await expect(page.getByText(/sugerencias organizativas.*no declaran requisitos legales/i)).toBeVisible();

  await page.getByLabel('Plantilla organizativa',{exact:true}).selectOption('revision-inicial');
  await page.getByRole('button',{name:'Aplicar plantilla',exact:true}).click();
  await expect(page.getByLabel('Editar Definir el objetivo de la revisión',{exact:true})).toBeVisible();
  await page.getByLabel('Agregar elemento',{exact:true}).fill('Confirmar responsable de la revisión');
  await page.getByRole('button',{name:'Agregar',exact:true}).click();
  await page.getByLabel('Marcar Confirmar responsable de la revisión',{exact:true}).check();
  await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();
  await expect(page.getByText('Checklist guardada solo en este asunto y en este equipo.',{exact:true})).toBeVisible();
  const saved=await api('checklist.get',{matterId:current.id});
  assert.equal(saved.items.length,5);assert.equal(saved.items.find(item=>item.label==='Confirmar responsable de la revisión').completed,true);
  assert.equal((await api('checklist.get',{matterId:other.id})).items.length,0,'checklist does not cross matter boundary');
  await expect(page.getByText('SECRETO_DOCUMENTO_CHECKLIST',{exact:true})).toHaveCount(0);

  for(const width of [1440,1024,768,390]) {
    await page.setViewportSize({width,height:1000});
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),{message:`No horizontal overflow at ${width}px`}).toBe(false);
    for(const control of [page.getByRole('button',{name:'Aplicar plantilla',exact:true}),page.getByRole('button',{name:'Agregar',exact:true}),page.getByRole('button',{name:'Guardar cambios',exact:true}),page.getByLabel('Marcar Confirmar responsable de la revisión',{exact:true}),page.getByLabel('Editar Confirmar responsable de la revisión',{exact:true}),page.getByLabel('Eliminar Confirmar responsable de la revisión',{exact:true})]) {const rect=await control.boundingBox();assert.ok(rect&&rect.width>=44&&rect.height>=44,`44px checklist control at ${width}px`);}
    await page.screenshot({path:`artifacts/ui-checklist/checklist-${width}.png`,fullPage:true});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
  report.checks.push('Checklist is visible in Herramientas jurídicas and receives an active state','Generic templates clearly state they are organisational suggestions and not legal requirements','Checklist items save only in the active matter and do not cross the matter boundary','No document text enters the checklist DOM','1440/1024/768/390px have no horizontal overflow and controls are at least 44px','No inference, remote requests, or browser exceptions');report.status='PASS';
} catch(error) {
  report.status='FAIL';report.error=error.stack;process.exitCode=1;
} finally {
  await browser?.close();await app.close();report.finishedAt=new Date().toISOString();await writeFile('artifacts/ui-checklist/smoke.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
