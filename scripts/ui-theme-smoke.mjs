/** Theme preference UI against a synthetic local workspace; no inference or external requests. */
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createService} from '../server/service.mjs';
import {startServer} from '../server/main.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dataDir=await mkdtemp(path.join(os.tmpdir(),'lex-theme-ui-'));
const inference={async status(){return{state:'ready',supported:true};},async stop(){},async *generate(){throw Error('Theme smoke must not invoke inference');}};
const service=await createService({dataDir,corpusPath:path.join(root,'resources/legal-corpus.json'),inference});
const app=await startServer({dataDir,inference,service,monitorDir:path.join(dataDir,'monitor'),libraryPath:path.join(dataDir,'missing.sqlite')});let browser;
const report={mode:'Synthetic local workspace; no inference',checks:[],startedAt:new Date().toISOString()};
const api=async(action,payload={})=>{const response=await fetch(app.connection.url+'/api',{method:'POST',headers:{Authorization:`Bearer ${app.connection.token}`,'Content-Type':'application/json'},body:JSON.stringify({action,payload})});assert.equal(response.status,200,`${action} returns 200`);return response.json();};

try {
  await mkdir('artifacts/ui-theme',{recursive:true});
  await api('workspace.create',{name:'Despacho sintético apariencia',practiceAreas:['Civil']});
  await api('matter.create',{title:'Asunto sintético apariencia',client:'Cliente de prueba',jurisdiction:'MX-FED'});
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce',colorScheme:'light'});
  const errors=[],remote=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(!request.url().startsWith(app.connection.url)&&!request.url().startsWith('data:'))remote.push(request.url());});
  await page.goto(`${app.connection.url}/#token=${app.connection.token}`);
  const nav=page.getByRole('navigation',{name:'Navegación principal'});
  await nav.getByRole('button',{name:'Configuración',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Configuración',exact:true})).toBeVisible();
  await page.getByRole('radio',{name:'Oscuro',exact:true}).check();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.theme)).toBe('dark');
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('lex-ai.appearance'))).toBe('dark');
  await expect(page.locator('.brand .theme-mark-dark')).toBeVisible();
  await expect(page.locator('.brand .theme-mark-light')).toBeHidden();
  await page.reload({waitUntil:'networkidle'});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.theme)).toBe('dark');
  await page.getByRole('navigation',{name:'Navegación principal'}).getByRole('button',{name:'Configuración',exact:true}).click();
  await expect(page.getByRole('radio',{name:'Oscuro',exact:true})).toBeChecked();
  await page.getByRole('radio',{name:'Claro',exact:true}).check();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.theme)).toBe('light');
  // The sidebar rail stays dark in light appearance (commit 3884148), so the rail brand keeps the dark-theme mark.
  await expect(page.locator('.brand .theme-mark-dark')).toBeVisible();
  await expect(page.locator('.brand .theme-mark-light')).toBeHidden();
  await page.getByRole('radio',{name:'Automático',exact:true}).check();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.hasAttribute('data-theme'))).toBe(false);
  for(const theme of ['light','dark']) {
    await page.getByRole('radio',{name:theme==='light'?'Claro':'Oscuro',exact:true}).check();
    for(const width of [1440,768,390]) {
      await page.setViewportSize({width,height:1000});
      await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),{message:`No horizontal overflow at ${width}px in ${theme}`}).toBe(false);
      await page.screenshot({path:`artifacts/ui-theme/settings-${theme}-${width}.png`,fullPage:true});
    }
  }
  assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
  report.checks.push('manual dark and light set data-theme and update the two-image mark (dark rail keeps dark-theme mark in both explicit themes)','preference persists across reload','Automatic removes data-theme and returns control to the OS','settings has no horizontal overflow at 1440/768/390 in either explicit theme','no browser exceptions, remote requests, or inference');report.status='PASS';
} catch(error) {
  report.status='FAIL';report.error=error.stack;process.exitCode=1;
} finally {
  await browser?.close();await app.close();report.finishedAt=new Date().toISOString();await writeFile('artifacts/ui-theme/smoke.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
