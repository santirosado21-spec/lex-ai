/** Static product website only. Never invokes the desktop application. */
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium, expect} from '@playwright/test';

const root = path.resolve('landing');
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
  await page.screenshot({path:`artifacts/landing/${width}.png`, fullPage:true});
}

try {
  await mkdir('artifacts/landing', {recursive:true});
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
  await expect(page.getByRole('heading', {name:'Todas las herramientas, a la vista.'})).toBeVisible();
  for (const name of ['Asistente','Asuntos','Escritos','Biblioteca federal','Conflictos','Checklist','Pendientes','Acciones propuestas','Panel','Calidad del asistente']) {
    await expect(page.getByText(name, {exact:true})).toBeVisible();
  }
  // Live catalogue: the published release must be offered with its real hash.
  await expect(page.locator('#download-button')).toHaveText('Descargar LEX AI 0.4.3');
  await expect(page.locator('#download-button')).toHaveAttribute('aria-disabled', 'false');
  await expect(page.locator('#download-button')).toHaveAttribute('href', /^https:\/\/github\.com\/santirosado21-spec\/lex-ai-descargas\/releases\/download\/v0\.4\.3\/LEX-AI-0\.4\.3-arm64\.dmg$/);
  await expect(page.locator('#download-sha')).toHaveText('85526589575ed0ba6e4a267523e06d52fa8edf2d48895fd728d7995a7d1734e4');
  await expect(page.locator('#copy-sha')).toBeEnabled();

  const catalogueResponse = await page.request.get(base + '/catalogue.json');
  assert.equal(catalogueResponse.status(), 200);
  const catalogue = JSON.parse(await catalogueResponse.text());
  assert.equal(catalogue.schemaVersion, 2);
  assert.equal(catalogue.version, '0.4.3');
  assert.equal(catalogue.bytes, 401541849);
  assert.match(catalogue.sha256, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(await page.locator('body').innerText(), /Gemma|Ollama/i);
  assert.equal(await page.evaluate(() => document.fonts.check('18px Newsreader')), true);
  assert.equal(await page.evaluate(() => document.fonts.check('18px "Schibsted Grotesk"')), true);

  await page.keyboard.press('Tab');
  await expect(page.getByText('Saltar al contenido', {exact:true})).toBeFocused();
  assert.equal(await page.getByText('Saltar al contenido', {exact:true}).evaluate(element => getComputedStyle(element).outlineStyle), 'solid');

  const broken = await page.locator('a[href^="#"]').evaluateAll(links => links.filter(link => !document.getElementById(link.getAttribute('href').slice(1))).map(link => link.getAttribute('href')));
  assert.deepEqual(broken, []);
  assert.equal(await page.locator('form,input[type="email"],input[type="file"]').count(), 0);
  assert.doesNotMatch(await readFile(path.join(root, 'styles.css'), 'utf8'), /gradient/i);
  assert.match(config.headers[0].headers.find(header => header.key === 'Content-Security-Policy').value, /connect-src 'self'/);
  await page.screenshot({path:'artifacts/landing/1440.png', fullPage:true});

  const pendingPage = await browser.newPage({viewport:{width:1440,height:1000}, reducedMotion:'reduce'});
  await pendingPage.route('**/catalogue.json', route => route.fulfill({contentType:'application/json', body:JSON.stringify({...catalogue, downloadUrl:null, bytes:null, sha256:null})}));
  await pendingPage.goto(base, {waitUntil:'networkidle'});
  await expect(pendingPage.locator('#download-button')).toHaveText('Disponible muy pronto');
  await expect(pendingPage.locator('#download-button')).toHaveAttribute('aria-disabled', 'true');
  await expect(pendingPage.locator('#download-button')).not.toHaveAttribute('href', /./);
  await expect(pendingPage.locator('#copy-sha')).toBeDisabled();
  await expect(pendingPage.locator('#download-sha')).toHaveText('Pendiente de publicación');
  await pendingPage.close();

  const availablePage = await browser.newPage({viewport:{width:1440,height:1000}, reducedMotion:'reduce'});
  const testOnlyCatalogue = {
    ...catalogue,
    // Route-only fixture: it is never written to landing/catalogue.json or requested as a download.
    downloadUrl:'/test-only-available-download.dmg',
    bytes:3221225472,
    sha256:'a'.repeat(64)
  };
  await availablePage.route('**/catalogue.json', route => route.fulfill({contentType:'application/json', body:JSON.stringify(testOnlyCatalogue)}));
  await availablePage.goto(base, {waitUntil:'networkidle'});
  await expect(availablePage.locator('#download-button')).toHaveText('Descargar LEX AI 0.4.3');
  await expect(availablePage.locator('#download-button')).toHaveAttribute('aria-disabled', 'false');
  await expect(availablePage.locator('#download-button')).toHaveAttribute('href', /test-only-available-download\.dmg$/);
  await expect(availablePage.locator('#download-size')).toHaveText('3.22 GB');
  await expect(availablePage.locator('#download-sha')).toHaveText('a'.repeat(64));
  await expect(availablePage.locator('#copy-sha')).toBeEnabled();
  await availablePage.close();

  for (const width of [1440, 768, 390]) await assertNoOverflow(page, width);
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  const origin = new URL(base).origin;
  assert.deepEqual(requests.filter(url => new URL(url).origin !== origin), []);
  report.checks.push('local Newsreader and Schibsted Grotesk load', 'all ten product tools are visible', 'catalogue null state disables the download and copy controls', 'route-intercepted catalogue enables the button and renders URL, size, and SHA-256', 'keyboard focus is visible', 'no horizontal overflow at 1440/768/390', 'no failed resources, browser exceptions, or third-party requests');
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL';
  report.error = error.message;
  process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  report.finishedAt = new Date().toISOString();
  await writeFile('artifacts/landing/smoke.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
