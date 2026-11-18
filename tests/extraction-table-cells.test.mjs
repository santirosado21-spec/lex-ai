// Fictitious pedimento and commercial invoice (tests/fixtures/trade). They check that table cells stay separate after PDF extraction,
// because glued cells silently change amounts ('PZA' '1' '1,900,000.00' -> 'PZA11,900,000.00'). Extraction only: no model, no legal analysis.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractDocument} from '../server/extraction.mjs';
const load=async name=>(await extractDocument(name,readFileSync(new URL(`./fixtures/trade/${name}`,import.meta.url)).toString('base64'))).text;

test('pedimento table rows keep quantity and amounts as separate tokens', async () => {
 const text=await load('pedimento-ficticio.pdf');
 const row=text.split('\n').find(l=>l.includes('MAQUINA ENVASADORA'));
 assert.ok(row);
 assert.deepEqual(row.trim().split(/\s+/).slice(-5),['PZA','1','1,900,000.00','95,000.00','320,000.00']);
 assert.ok(!text.includes('PZA11,900,000.00'));
 assert.ok(text.includes('26 47 3999 6000123') && text.includes('MRS260102XY3'));
});

test('commercial invoice line keeps quantity, unit price and amount separate and the total readable', async () => {
 const text=await load('factura-ficticia.pdf');
 const line=text.split('\n').find(l=>l.includes('Packaging line'));
 assert.deepEqual(line.trim().split(/\s+/).slice(-3),['1','110,000.00','110,000.00']);
 assert.ok(text.split('\n').some(l=>/TOTAL USD\s+120,000\.00$/.test(l.trim())));
});
