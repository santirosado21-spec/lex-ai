// The trade fixture is fictional. These checks keep its answer key honest and consistent. They test fixture integrity only, not model or detector quality.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const text = read('fixtures/demo/memorandum-importacion-ficticio.md'), key = JSON.parse(read('fixtures/demo/memorandum-importacion-ficticio-clave.json'));
const paragraph = n => text.split('\n').find(line => line.startsWith(`${n}. `)) || '';

test('each seeded citation defect is present in its paragraph and names its article', () => {
 for (const d of key.citationDefects) assert.match(paragraph(d.paragraph), new RegExp(`artículo ${d.article} de la Ley Aduanera`), d.id);
});

test('internal defect T4 is really present: declared value equals invoice while freight and insurance are stated as importer cost', () => {
 const p2 = paragraph(2);
 assert.ok(p2.includes('USD 120,000.00') && p2.includes('USD 9,500.00') && p2.includes('valor en aduana de USD 120,000.00'));
});

test('identifiers are declared synthetic and present', () => {
 for (const id of [...key.syntheticIdentifiers, ...key.syntheticAddresses]) assert.ok(text.includes(id), id);
 assert.match(text, /no es un caso real/);
});

test('the Ley Aduanera is not claimed to be in the shipped library', () => {
 const manifest = JSON.parse(read('resources/public-library.sqlite.manifest.json'));
 const ids = JSON.stringify(manifest);
 assert.ok(!ids.includes('MX-FED-LADUA'), 'if the library gains the law, update the key: the citations become checkable');
 assert.match(key.expectedCurrentBehavior, /sin verificar/);
});
