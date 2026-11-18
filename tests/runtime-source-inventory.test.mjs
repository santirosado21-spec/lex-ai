import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSourceInventory} from '../scripts/runtime-source-inventory.mjs';

test('the generated inventory is deterministic, hash-complete, and approves no runtime binary', async () => {
 const a = await buildSourceInventory(), b = await buildSourceInventory();
 assert.deepEqual(a, b);
 assert.equal(a.reviewStatus, 'generated-unreviewed-no-runtime-approved');
 assert.deepEqual(a.files, []);
 assert.ok(a.sourceFiles.length > 10);
 for (const file of a.sourceFiles) { assert.match(file.sha256, /^[a-f0-9]{64}$/); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0); assert.ok(!file.path.startsWith('/') && !file.path.includes('..')); }
 for (const required of ['server/main.mjs', 'package-lock.json']) assert.ok(a.sourceFiles.some(f => f.path === required));
 assert.ok(!a.sourceFiles.some(f => /^(?:resources\/)?runtime\//.test(f.path)), 'no runtime binaries in sourceFiles');
});

test('a failing git listing fails closed', async () => {
 await assert.rejects(buildSourceInventory({run:() => ({status:1, stdout:''})}), /git ls-files failed/);
});
