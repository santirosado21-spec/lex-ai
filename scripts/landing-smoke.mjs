/** Static product website only. Never invokes the desktop application. */
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium, expect} from '@playwright/test';

const root = path.resolve('landing');
const output = path.resolve('artifacts/landing/20261110-downloads-' + new Date().toISOString().replace(/[:.]/g,'-'));
const platformKeys=['mac-arm64','mac-x64','windows-x64'];
const card=(page,key)=>page.locator(`[data-platform="${key}"]`);
const field=(page,key,name)=>card(page,key).locator(`[data-field="${name}"]`);
async function assertInert(page,key){
 await expect(field(page,key,'download')).toHaveAttribute('aria-disabled','true');
 await expect(field(page,key,'download')).not.toHaveAttribute('href',/./);
 await expect(field(page,key,'download')).toHaveAttribute('tabindex','-1');
 await expect(field(page,key,'copy')).toBeDisabled();
 await expect(field(page,key,'sha')).toHaveText('Pendiente de publicación');
}

const config = JSON.parse(await readFile(path.join(root, 'vercel.json'), 'utf8'));
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.svg':'image/svg+xml','.json':'application/json','.woff2':'font/woff2','.txt':'text/plain'};
const server = createServer(async (req, res) => {
  try {
    let name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (name === '/') name = '/index.html';
    const file = path.resolve(root, '.' + name);
    if (!file.startsWith(root + path.sep)) throw Error('Invalid path');
    const bytes = await readFile(file);
    for (const header of config.headers[0].headers) res.setHeader(header.key, header.value);
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const local = `http://127.0.0.1:${server.address().port}`;
const base = process.env.LEX_LANDING_URL || local;
const report = {startedAt:new Date().toISOString(), mode:process.env.LEX_LANDING_URL ? 'deployed-public-site' : 'local-static-with-vercel-security-headers', checks:[]};
let browser;

async function assertNoOverflow(page, width) {
  await page.setViewportSize({width, height:844});
  await page.goto(base, {waitUntil:'networkidle'});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `horizontal overflow at ${width}px`);
  await page.screenshot({path:path.join(output,`${width}.png`), fullPage:true});
}

try {
  await mkdir(output, {recursive:true});
  report.output=output;
  browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:1440,height:1000}, reducedMotion:'reduce'});
  const errors = [];
  const requests = [];
  const failed = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  page.on('response', response => { if (response.status() >= 400) failed.push({url:response.url(), status:response.status()}); });

  const response = await page.goto(base, {waitUntil:'networkidle'});
  assert.equal(response.status(), 200);
  await expect(page.getByRole('heading', {level:1})).toContainText('Una respuesta');
  await expect(page.getByRole('heading', {name:'Un asunto, todas sus herramientas.'})).toBeVisible();
  for (const name of ['Asistente','Biblioteca federal','Escritos','Correo','Dictado','Asuntos','Pendientes','Checklist','Conflictos','Acciones propuestas','Tiempo y honorarios']) {
    await expect(page.locator('#herramientas dt', {hasText:name}).first()).toBeVisible();
  }
  // Integrations are labelled from the catalogue: 0.4.3 predates them.
  await expect(page.getByRole('heading', {name:'Donde ya trabajas.'})).toBeVisible();
  for (const name of ['Word','Excel','SharePoint Online','Mail']) await expect(page.locator('#integraciones dt', {hasText:name}).first()).toBeVisible();
  await expect(page.locator('#integrations-status')).toHaveText('Próxima versión');
  await expect(page.getByRole('heading', {name:'Primero la fuente, después la frase.'})).toBeVisible();
  await expect(page.locator('.method-steps li')).toHaveCount(3);
  await expect(page.getByRole('heading', {name:'Cada asunto, sus conversaciones.'})).toBeVisible();
  await expect(page.locator('[data-projects-status]')).toHaveText('Próxima versión');
  const faq = page.locator('#preguntas details').first();
  await faq.locator('summary').click();
  await expect(faq).toHaveAttribute('open', '');
  await expect(page.locator('#preguntas details')).toHaveCount(6);
  // Hero demo: keyboard tabs and citation link.
  const appTab = page.getByRole('tab', {name:'En Rejon.AI'});
  const wordTab = page.getByRole('tab', {name:'En Word'});
  await appTab.focus();
  await page.keyboard.press('ArrowRight');
  await expect(wordTab).toHaveAttribute('aria-selected', 'true');
  await expect(wordTab).toBeFocused();
  await expect(page.locator('#panel-word')).toBeVisible();
  await expect(page.locator('#panel-app')).toBeHidden();
  await page.keyboard.press('ArrowLeft');
  await expect(appTab).toHaveAttribute('aria-selected', 'true');
  await page.locator('#cite-d1').focus();
  await expect(page.locator('#demo')).toHaveAttribute('data-linked', 'true');
  assert.match(await page.locator('#link-path').getAttribute('d'), /^M [\d.]+ [\d.]+ C /);
  assert.doesNotMatch(await page.locator('body').innerText(), /\u2014/, 'no em dash in visible copy');
  assert.doesNotMatch(await page.title(), /\u2014/);
  // Published ARM asset remains an explicitly older local experimental release.
  await expect(page.locator('[data-platform]')).toHaveCount(3);
  await expect(field(page,'mac-arm64','download')).toHaveAttribute('aria-disabled','false');
  await expect(field(page,'mac-arm64','download')).toHaveAttribute('href', /^https:\/\/github\.com\/santirosado21-spec\/lex-ai-descargas\/releases\/download\/v0\.4\.3\/LEX-AI-0\.4\.3-arm64\.dmg$/);
  await expect(field(page,'mac-arm64','sha')).toHaveText('85526589575ed0ba6e4a267523e06d52fa8edf2d48895fd728d7995a7d1734e4');
  await expect(field(page,'mac-arm64','version')).toHaveText('Versión 0.4.3');
  await expect(field(page,'mac-arm64','state')).toContainText('anterior LEX AI, local y experimental');
  await assertInert(page,'mac-x64');await assertInert(page,'windows-x64');
  const catalogueResponse=await page.request.get(base+'/catalogue.json');
  assert.equal(catalogueResponse.status(),200);
  const catalogue=JSON.parse(await catalogueResponse.text());
  assert.equal(catalogue.schemaVersion,3);
  assert.equal(catalogue.platforms['mac-arm64'].version,'0.4.3');
  assert.equal(catalogue.platforms['mac-arm64'].bytes,401541849);
  assert.equal(catalogue.platforms['mac-arm64'].requirements.physical8GBValidated,false);
  assert.doesNotMatch(await page.locator('body').innerText(), /Gemma|Ollama/i);
  assert.equal(await page.evaluate(() => document.fonts.check('18px Newsreader')), true);
  assert.equal(await page.evaluate(() => document.fonts.check('18px "Schibsted Grotesk"')), true);
  const themeToggle=page.locator('#theme-toggle');
  await themeToggle.click();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.theme)).toBe('light');
  await expect(page.locator('.wordmark .theme-mark-light').first()).toBeVisible();
  await themeToggle.click();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.theme)).toBe('dark');
  await expect(page.locator('.wordmark .theme-mark-dark').first()).toBeVisible();
  await themeToggle.click();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.hasAttribute('data-theme'))).toBe(false);

  await page.reload({waitUntil:'networkidle'});
  await page.keyboard.press('Tab');
  await expect(page.getByText('Saltar al contenido', {exact:true})).toBeFocused();
  assert.equal(await page.getByText('Saltar al contenido', {exact:true}).evaluate(element => getComputedStyle(element).outlineStyle), 'solid');

  const broken = await page.locator('a[href^="#"]').evaluateAll(links => links.filter(link => !document.getElementById(link.getAttribute('href').slice(1))).map(link => link.getAttribute('href')));
  assert.deepEqual(broken, []);
  assert.equal(await page.locator('form,input[type="email"],input[type="file"]').count(), 0);
  assert.doesNotMatch(await readFile(path.join(root, 'styles.css'), 'utf8'), /gradient/i);
  assert.match(config.headers[0].headers.find(header => header.key === 'Content-Security-Policy').value, /connect-src 'self'/);
  await page.screenshot({path:path.join(output,'1440.png'), fullPage:true});

  const fixturePage=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  fixturePage.on('pageerror',error=>errors.push(error.message));
  fixturePage.on('request',request=>requests.push(request.url()));
  fixturePage.on('response',response=>{if(response.status()>=400)failed.push({url:response.url(),status:response.status()});});
  await fixturePage.addInitScript(()=>{
    window.testCopied=[];
    Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>window.testCopied.push(value)},configurable:true});
  });
  // Entirely route-only fixtures: no binary is requested, clicked or published.
  const future=structuredClone(catalogue);
  for(const [key,suffix] of [['mac-x64','x64.dmg'],['windows-x64','x64.exe']]) {
    future.platforms[key]={...catalogue.platforms['mac-arm64'],version:'9.8.7',status:'experimental',bytes:3221225472,sha256:'a'.repeat(64),
      downloadUrl:`https://github.com/santirosado21-spec/lex-ai-descargas/releases/download/v9.8.7/LEX-AI-9.8.7-${suffix}`};
  }
  let fixture=future,fetchFailure=false;
  await fixturePage.route('**/catalogue.json',route=>fetchFailure?route.abort('failed'):route.fulfill({contentType:'application/json',body:JSON.stringify(fixture)}));
  await fixturePage.goto(base,{waitUntil:'networkidle'});
  for(const key of platformKeys){
    await expect(field(fixturePage,key,'download')).toHaveAttribute('href',future.platforms[key].downloadUrl);
    await expect(field(fixturePage,key,'download')).toHaveAttribute('aria-disabled','false');
    await expect(field(fixturePage,key,'copy')).toBeEnabled();
    await field(fixturePage,key,'copy').click();
    await expect(field(fixturePage,key,'copy-status')).toContainText(`Versión ${future.platforms[key].version}`);
    assert.equal((await fixturePage.evaluate(()=>window.testCopied)).at(-1),future.platforms[key].sha256);
  }
  await expect(field(fixturePage,'mac-x64','size')).toHaveText('3.22 GB');
  // Independently corrupt each card while both other cards remain enabled.
  for(const key of platformKeys){
    const entry=future.platforms[key];
    const badEntries=[null,{...entry,sha256:'bad'},{...entry,bytes:0},{...entry,bytes:-1},
      {...entry,version:'<img src=x onerror="window.testXss=true">'},
      ...['javascript:alert(1)','/relative.dmg','https://evil.example/download',entry.downloadUrl+'?x=1',entry.downloadUrl+'#x',
        entry.downloadUrl.replace('santirosado21-spec','other-owner'),
        entry.downloadUrl.replace(/(arm64|x64)\.(dmg|exe)$/,(match,arch,ext)=>`${arch==='arm64'?'x64':'arm64'}.${ext}`)]
       .map(downloadUrl=>({...entry,downloadUrl}))];
    for(const bad of badEntries){
      fixture=structuredClone(future);fixture.platforms[key]=bad;
      await fixturePage.reload({waitUntil:'networkidle'});await assertInert(fixturePage,key);
      for(const other of platformKeys.filter(other=>other!==key))await expect(field(fixturePage,other,'download')).toHaveAttribute('href',future.platforms[other].downloadUrl);
      assert.equal(await fixturePage.evaluate(()=>Boolean(window.testXss)),false);
      assert.equal(await fixturePage.locator('[data-platform] img').count(),0);
    }
  }
  fixture=structuredClone(catalogue);
  for(const key of platformKeys)fixture.platforms[key]={version:null,status:'pending',downloadUrl:null,bytes:null,sha256:null,requirements:null};
  await fixturePage.reload({waitUntil:'networkidle'});
  for(const key of platformKeys){
    await assertInert(fixturePage,key);
    const link=field(fixturePage,key,'download');
    assert.equal(await link.evaluate(element=>{
      const click=new MouseEvent('click',{bubbles:true,cancelable:true});
      const enter=new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});
      const space=new KeyboardEvent('keydown',{key:' ',bubbles:true,cancelable:true});
      element.dispatchEvent(click);element.dispatchEvent(enter);element.dispatchEvent(space);
      return click.defaultPrevented&&enter.defaultPrevented&&space.defaultPrevented;
    }),true);
  }
  fetchFailure=true;await fixturePage.reload({waitUntil:'networkidle'});
  for(const key of platformKeys)await assertInert(fixturePage,key);
  await fixturePage.close();

  for (const width of [1440, 1024, 768, 390, 320]) await assertNoOverflow(page, width);
  // Clean viewport evidence follows real navigation from a fresh page, not
  // locator screenshots that scroll a clipped card under the sticky header.
  report.anchorNavigation=[];
  for(const width of [390,320]) {
    const clean=await browser.newPage({viewport:{width,height:844},reducedMotion:'reduce'});
    clean.on('pageerror',error=>errors.push(error.message));
    clean.on('request',request=>requests.push(request.url()));
    await clean.goto(base,{waitUntil:'networkidle'});
    await clean.keyboard.press('Tab');
    await expect(clean.getByText('Saltar al contenido',{exact:true})).toBeFocused();
    const skipClear=await clean.locator('.skip-link').evaluate(element=>{
      const box=element.getBoundingClientRect();
      return element===document.elementFromPoint(box.left+box.width/2,box.top+box.height/2);
    });
    assert.equal(skipClear,true,`skip link visually reachable at ${width}px`);
    await clean.screenshot({path:path.join(output,`${width}-skip-focused.png`)});
    // Leave the focused skip control through ordinary keyboard navigation;
    // its intentional overlay can cover header links at narrow widths.
    await clean.keyboard.press('Tab');
    await expect(clean.locator('.skip-link')).not.toBeFocused();
    await clean.locator('.nav-cta').click();
    await expect(clean).toHaveURL(/#descargar$/);
    await expect(clean.locator('.skip-link')).not.toBeFocused();
    const geometry=await clean.evaluate(()=>{
      const header=document.querySelector('.site-header').getBoundingClientRect();
      const title=document.querySelector('#download-title').getBoundingClientRect();
      return {headerBottom:header.bottom,titleTop:title.top,scrollY,activeElement:document.activeElement.className};
    });
    assert.ok(geometry.titleTop>=geometry.headerBottom,`download heading obscured at ${width}px`);
    await clean.screenshot({path:path.join(output,`${width}-downloads-anchor-viewport.png`)});
    await clean.locator('[data-platform="mac-arm64"] [data-field="download"]').focus();
    const focusClear=await clean.locator('[data-platform="mac-arm64"] [data-field="download"]').evaluate(element=>{
      const box=element.getBoundingClientRect(),header=document.querySelector('.site-header').getBoundingClientRect();
      return box.top>=header.bottom&&box.bottom<=innerHeight;
    });
    assert.equal(focusClear,true,`download focus obscured at ${width}px`);
    await clean.screenshot({path:path.join(output,`${width}-download-focused-viewport.png`)});
    report.anchorNavigation.push({width,skipClear,focusClear,...geometry});await clean.close();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  const origin = new URL(base).origin;
  assert.deepEqual(requests.filter(url => new URL(url).origin !== origin), []);
  report.checks.push('local Newsreader and Schibsted Grotesk load', 'landing theme toggle cycles Automatic, Light, and Dark with the matching mark', 'eleven tools grouped by task are visible', 'integrations show Próxima versión for catalogue 0.4.3', 'demo tabs work with arrow keys and the citation link draws on focus', 'no em dash in visible copy or title', 'answer method, matters-as-projects and FAQ sections render with honest release labels', 'schema3 keeps three explicit independent platform choices; only older ARM0.4.3 is published', 'route-only Intel/Windows valid fixtures enable without requesting binaries', 'all three cards independently reject null/hash/bytes/crossarch/repo/URL/XSS failures', 'all-null and catalogue-fetch failure disable every control', 'clipboard identifies platform/version and disabled links prevent pointer/Enter/Space', 'keyboard focus is visible', 'no horizontal overflow at 1440/1024/768/390/320', 'no failed resources, browser exceptions, or third-party requests');
  report.observed={browserExceptions:errors,failedHttpResponses:failed,thirdPartyRequests:requests.filter(url=>new URL(url).origin!==origin),intentionalCatalogueAbortCases:1,downloadRequests:requests.filter(url=>url.includes('/releases/download/'))};
  assert.deepEqual(report.observed.downloadRequests,[]);
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL';
  report.error = error.message;
  process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(output,'smoke.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
