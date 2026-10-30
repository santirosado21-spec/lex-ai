/** Static product website only. Never invokes the desktop or model. */
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
const root=path.resolve('landing');
const config=JSON.parse(await readFile(path.join(root,'vercel.json'),'utf8'));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json','.woff2':'font/woff2','.txt':'text/plain'};
const server=createServer(async(req,res)=>{try{let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(name==='/')name='/index.html';const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep))throw Error();const bytes=await readFile(file);for(const h of config.headers[0].headers)res.setHeader(h.key,h.value);res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(bytes);}catch{res.writeHead(404);res.end('Not found');}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const local=`http://127.0.0.1:${server.address().port}`;
const base=process.env.LEX_LANDING_URL||local;
const report={startedAt:new Date().toISOString(),mode:process.env.LEX_LANDING_URL?'deployed-public-site':'local-static-with-vercel-security-headers',checks:[]};let browser;
try{
 await mkdir('artifacts/landing',{recursive:true});browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const errors=[],requests=[],failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));page.on('response',r=>{if(r.status()>=400)failed.push({url:r.url(),status:r.status()});});
 const response=await page.goto(base,{waitUntil:'networkidle'});assert.equal(response.status(),200);
 await expect(page.getByRole('heading',{level:1})).toContainText('Cada respuesta');
 assert.doesNotMatch(await page.locator('body').innerText(),/Gemma|Ollama/i);const catalogue=await page.request.get(base+'/catalogue.json');assert.equal(catalogue.status(),200);const catalogueText=await catalogue.text();assert.doesNotMatch(catalogueText,/Gemma|Ollama/i);assert.equal(JSON.parse(catalogueText).assistantName,'LEX AI');
 await expect.poll(()=>page.locator('.hero-photo img').evaluate(img=>img.complete&&img.naturalWidth===1536)).toBe(true);
 assert.equal(await page.evaluate(()=>document.fonts.check('18px "IBM Plex Sans"')),true);
 await page.screenshot({path:'artifacts/landing/desktop.png'});await page.screenshot({path:'artifacts/landing/full-page.png',fullPage:true});
 const tabs=page.getByRole('tab');await expect(tabs).toHaveCount(5);await tabs.first().focus();await page.keyboard.press('ArrowDown');await expect(tabs.nth(1)).toHaveAttribute('aria-selected','true');await expect(page.locator('#panel-recuperar')).toBeVisible();await page.keyboard.press('End');await expect(tabs.last()).toHaveAttribute('aria-selected','true');await expect(page.locator('#panel-exportar')).toBeVisible();await page.keyboard.press('Home');await expect(tabs.first()).toHaveAttribute('aria-selected','true');
 await page.getByRole('button',{name:'Privacidad de este sitio',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.getByRole('button',{name:'Privacidad de este sitio',exact:true})).toBeFocused();
 const broken=await page.locator('a[href^="#"]').evaluateAll(links=>links.filter(a=>!document.getElementById(a.getAttribute('href').slice(1))).map(a=>a.getAttribute('href')));assert.deepEqual(broken,[]);
 assert.equal(await page.locator('input[type="email"],input[type="file"],form').count(),0);await expect(page.locator('#requisitos')).toContainText('todavía no ofrece una descarga pública');
 for(const width of [390,768]){await page.setViewportSize({width,height:844});await page.goto(base,{waitUntil:'networkidle'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`artifacts/landing/mobile-${width}.png`,fullPage:true});}
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);const origin=new URL(base).origin;assert.deepEqual(requests.filter(url=>new URL(url).origin!==origin),[]);
 report.checks.push('cover and local fonts loaded with production CSP','five workflow tabs support arrows/Home/End','privacy dialog opens, Escape closes and focus returns','all fragment links resolve; no upload/signup forms or fake download','1440/768/390 layouts; no mobile horizontal overflow','no browser exceptions, failed resources or third-party requests');report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.message;process.exitCode=1;}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));report.finishedAt=new Date().toISOString();await writeFile('artifacts/landing/smoke.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
