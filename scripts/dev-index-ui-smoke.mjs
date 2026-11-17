import {chromium} from '@playwright/test';import {startDevUi} from './dev-index-ui.mjs';import assert from 'node:assert/strict';import {mkdirSync,writeFileSync} from 'node:fs';
const ui=await startDevUi();mkdirSync('artifacts/dev-index/screens',{recursive:true});
const b=await chromium.launch({headless:true,channel:'chrome'});const p=await b.newPage({viewport:{width:1100,height:900}});const out={checks:[]};
try{
 await p.goto(ui.url);await p.getByRole('note').waitFor();assert.match(await p.getByRole('note').innerText(),/EXPERIMENTAL · EN CUARENTENA/);assert.match(await p.getByRole('note').innerText(),/pending/);
 assert.equal(await p.getByRole('checkbox',{name:'Artículos'}).isChecked(),true);assert.equal(await p.getByRole('checkbox',{name:'Transitorios'}).isChecked(),false);
 await p.screenshot({path:'artifacts/dev-index/screens/01-inicio.png'});out.checks.push('banner experimental + filtro por defecto solo articulos');
 await p.getByLabel('Buscar').fill('entrará en vigor al día siguiente de su publicación');await p.getByRole('button',{name:'Buscar'}).click();await p.locator('.hit').first().waitFor();
 const tags=await p.locator('.hit .tag').allInnerTexts();assert.ok(tags.length>0&&tags.every(t=>t==='Artículos'));assert.match(await p.locator('.hit .meta').first().innerText(),/capa .* pp\. .* revisión legal pending .* PDF sha256/);
 await p.screenshot({path:'artifacts/dev-index/screens/02-articulos.png'});out.checks.push('resultados solo articulos, con procedencia y estado');
 await p.getByRole('checkbox',{name:'Artículos'}).uncheck();await p.getByRole('checkbox',{name:'Transitorios'}).check();await p.getByRole('button',{name:'Buscar'}).click();await p.locator('.hit').first().waitFor();
 const t2=await p.locator('.hit .tag').allInnerTexts();assert.ok(t2.every(t=>t==='Transitorios'));await p.screenshot({path:'artifacts/dev-index/screens/03-transitorios.png'});out.checks.push('transitorios separados, solo al pedirlos');
 await p.getByLabel('Buscar').fill('atribuciones Legislatura');await p.getByRole('checkbox',{name:'Transitorios'}).uncheck();await p.getByRole('checkbox',{name:/Prefacio/}).check();await p.getByRole('button',{name:'Buscar'}).click();await p.locator('.hit').first().waitFor();
 assert.ok((await p.locator('.hit .tag').allInnerTexts()).every(t=>/Prefacio/.test(t)));await p.screenshot({path:'artifacts/dev-index/screens/04-prefacio.png'});out.checks.push('prefacio separado');
 out.status='PASS';
}catch(e){out.status='FAIL';out.error=e.message;process.exitCode=1}finally{await b.close();ui.close();writeFileSync('artifacts/dev-index/ui-smoke-report.json',JSON.stringify(out,null,1));console.log(JSON.stringify(out))}
