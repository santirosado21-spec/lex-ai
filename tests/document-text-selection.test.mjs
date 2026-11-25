/**
 * Repro for a suspected stale-selection bug in src/DocumentText.tsx.
 *
 * Mounts the REAL component (no reimplementation) inside a throwaway Vite
 * harness (tests/fixtures/document-text-selection/) and drives it with a
 * real local Chromium via Playwright. Requires npm ci and either
 * `npx playwright install chromium` or a local Chrome channel. CI explicitly
 * installs Chromium with system dependencies, never skips this regression.
 * The harness uses an ephemeral 127.0.0.1 server; text is entirely
 * synthetic/invented; no client or corpus data.
 *
 * Hypothesis under test: the `selectionchange` listener in DocumentText
 * only ever *writes* `selection` while both selection endpoints remain
 * inside `.document-reading`, and never clears it when the selection
 * becomes empty/removed or moves outside the container, and never resets
 * it when the `text` prop changes. The toolbar and the Ctrl/Cmd+Shift+A
 * shortcut both read that same `selection` state, so a previous excerpt
 * can keep being offered/sent as if it were the current selection.
 *
 * This test intentionally asserts the CORRECT (non-stale) behavior, so it
 * is expected to FAIL on the unmodified component if the hypothesis holds,
 * and to PASS once DocumentText.tsx clears/resets `selection` correctly.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir,readFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const harnessUrlPath = '/tests/fixtures/document-text-selection/index.html';

test('DocumentText selection does not go stale on deselect, external selection, or text-prop change', async () => {
  const viteServer = await createServer({
    root: repoRoot,
    configFile: false, // isolate from vite.config.ts (dev port/proxy to server/); harness needs no backend
    logLevel: 'error',
    clearScreen: false,
    plugins: [react()],
    server: { host: '127.0.0.1', port: 0, strictPort: false },
  });
  await viteServer.listen();
  const address = viteServer.httpServer.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  let launchOptions = { headless: true };
  try { await access(chromium.executablePath()); } catch { launchOptions = { ...launchOptions, channel: 'chrome' }; }
  let browser;
  try {
    browser = await chromium.launch(launchOptions);
    const page = await browser.newPage();
    const exceptions = [];
    page.on('pageerror', error => exceptions.push(error.message));
    await page.goto(`${baseUrl}${harnessUrlPath}`);

    const reading = page.locator('.document-reading');
    const toolbar = page.locator('.extract-toolbar');
    const T1 = 'TEXTO SINTETICO INICIAL. Parte A del documento de prueba.';
    await expect(reading).toHaveText(T1);

    const selectWithin = selector => page.locator(selector).evaluate(element => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    });
    const deselectAll = () => page.evaluate(() => {
      window.getSelection().removeAllRanges();
      document.dispatchEvent(new Event('selectionchange'));
    });
    const extractCount = () => page.evaluate(() => window.__extracts.length);
    const lastExtract = () => page.evaluate(() => window.__extracts.at(-1));
    const pressShortcut = () => page.keyboard.press('Control+Shift+A');

    // --- Scenario 1: internal selection — baseline, both consumers read it correctly ---
    await selectWithin('.document-reading');
    await expect(toolbar).toBeVisible();
    await expect(page.getByText(`Extracto seleccionado · ${T1.length} caracteres`)).toBeVisible();
    await page.getByRole('button', { name: 'Preguntar al Asistente' }).click();
    assert.equal(await lastExtract(), T1, 'toolbar click must send the real current internal selection');

    await selectWithin('.document-reading'); // re-select: the prior click may have moved focus/selection
    await pressShortcut();
    assert.equal(await lastExtract(), T1, 'Ctrl+Shift+A must send the real current internal selection');

    // --- Scenario 2: deselection must clear the stale excerpt, not keep offering it ---
    await selectWithin('.document-reading');
    await expect(toolbar).toBeVisible();
    const beforeDeselect = await extractCount();
    await deselectAll();
    if(process.env.SELECTION_SCREENSHOT_DIR){await mkdir(process.env.SELECTION_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:process.env.SELECTION_SCREENSHOT_DIR+'/deselected.png',fullPage:true});}
    await expect(toolbar, 'toolbar kept showing a stale excerpt after the real selection was removed').toHaveCount(0);
    await pressShortcut();
    assert.equal(await extractCount(), beforeDeselect,
      'Ctrl+Shift+A sent a stale excerpt even though nothing is currently selected');

    // --- Scenario 3: selecting text OUTSIDE the document must not reuse the old excerpt ---
    await selectWithin('.document-reading');
    await expect(toolbar).toBeVisible();
    await selectWithin('#outside-text');
    await expect(toolbar, 'toolbar kept offering the prior internal excerpt after the real selection moved outside the document').toHaveCount(0);
    const beforeExternal = await extractCount();
    await pressShortcut();
    assert.equal(await extractCount(), beforeExternal,
      'Ctrl+Shift+A sent the stale internal excerpt while the actual selection is outside the document');

    // --- Scenario 4: changing the `text` prop (e.g. opening another document) must reset selection ---
    await selectWithin('.document-reading');
    await expect(toolbar).toBeVisible();
    const T2 = 'TEXTO SINTETICO DE OTRO DOCUMENTO. Parte B, contenido completamente distinto.';
    await page.evaluate(next => window.__setText(next), T2);
    await expect(reading).toHaveText(T2);
    await expect(toolbar, 'toolbar kept the previous document\'s excerpt selected after the text prop changed').toHaveCount(0);
    const beforeSwap = await extractCount();
    await pressShortcut();
    assert.equal(await extractCount(), beforeSwap,
      'Ctrl+Shift+A sent the previous document\'s excerpt after the text prop changed to a new document');

    // Search offsets must remain in the original source despite expanding lowercase.
    const unicode='İSTANBUL. El contrato termina mañana. Otro CONTRATO. İ';
    await page.evaluate(next=>window.__setText(next),unicode);
    const search=page.getByLabel('Buscar dentro del documento');await search.fill('contrato');
    await expect(reading.locator('mark')).toHaveText(['contrato','CONTRATO']);
    assert.equal(await reading.textContent(),unicode);
    await expect(reading.locator('mark[data-current=true]')).toHaveText('contrato');
    await page.getByRole('button',{name:'Siguiente coincidencia'}).click();await expect(reading.locator('mark[data-current=true]')).toHaveText('CONTRATO');
    await page.getByRole('button',{name:'Siguiente coincidencia'}).click();await expect(reading.locator('mark[data-current=true]')).toHaveText('contrato');
    await page.getByRole('button',{name:'Coincidencia anterior'}).click();await expect(reading.locator('mark[data-current=true]')).toHaveText('CONTRATO');
    await selectWithin('mark[data-current=true]');await page.getByRole('button',{name:'Preguntar al Asistente'}).click();assert.equal(await lastExtract(),'CONTRATO');
    const offsets=await reading.evaluate(el=>{const r=window.getSelection().getRangeAt(0),prefix=document.createRange();prefix.selectNodeContents(el);prefix.setEnd(r.startContainer,r.startOffset);return {start:prefix.toString().length,end:prefix.toString().length+r.toString().length};});
    assert.deepEqual(offsets,{start:unicode.indexOf('CONTRATO'),end:unicode.indexOf('CONTRATO')+8});assert.equal(unicode.slice(offsets.start,offsets.end),await lastExtract());
    await deselectAll();await search.fill('İ');await expect(reading.locator('mark')).toHaveText(['İ','İ']);assert.equal(await reading.textContent(),unicode);
    await page.evaluate(()=>window.__setText('İSTANBUL. El contrato termina mañana.'));
    await search.fill('contrato');
    if(process.env.SELECTION_SCREENSHOT_DIR){await mkdir(process.env.SELECTION_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:process.env.SELECTION_SCREENSHOT_DIR+'/unicode-after.png',fullPage:true});}
    await page.evaluate(()=>window.__setText('Contrato '.repeat(501)));await search.fill('contrato');await expect(reading.locator('mark')).toHaveCount(500);await expect(page.getByRole('status')).toHaveText('1/500+');
    await page.getByRole('button',{name:'Coincidencia anterior'}).click();await expect(page.getByRole('status')).toHaveText('500/500+');assert.equal(await reading.textContent(),'Contrato '.repeat(501));
    assert.deepEqual(exceptions, [], 'no browser runtime exceptions');
  } finally {
    await browser?.close();
    await viteServer.close();
  }
});

// The helper is shared by the real component, tested without a browser too.
test('folded search preserves original UTF16 spans, accents, literals and complete expansion boundaries',async()=>{
 const ts=(await import('typescript')).default,source=await readFile(new URL('../src/document-text-matches.ts',import.meta.url),'utf8');
 const {documentTextMatches:m}=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));
 assert.deepEqual(m('İ😀PAGO pagó','pago'),[{start:3,end:7}]);
 assert.deepEqual(m('İİ','İ'),[{start:0,end:1},{start:1,end:2}]);assert.deepEqual(m('İ','i'),[],'do not highlight a partial lowercase expansion');
 for(const [text,q,expected] of [['.* İ .*','.*',['.*','.*']],['ΟΣ ΟΣ','ος',['ΟΣ','ΟΣ']],['é É','é',['é','É']],['😀😀','😀',['😀','😀']]])assert.deepEqual(m(text,q).map(({start,end})=>text.slice(start,end)),expected);
 assert.deepEqual(m('texto','   '),[]);assert.equal(m('İ '+'a'.repeat(501),'a').length,500);assert.deepEqual(m('aaaa','aa'),[{start:0,end:2},{start:2,end:4}]);
});
