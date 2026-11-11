import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, chmod, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { missingPrerequisite, fidelityGate } from './helpers/fidelity.mjs';
import { openPublicLibrary } from '../server/public-library.mjs';

const stub = () => ({ skipped: null, skip(reason) { this.skipped = reason; } });

test('absent path: default mode skips with reason, required mode fails naming the prerequisite', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fidelity-gate-'));
  try {
    const absent = path.join(dir, 'absent-index.sqlite');
    const prereq = await missingPrerequisite(absent, 'test index unavailable');
    assert.equal(prereq, 'test index unavailable');
    const t = stub();
    assert.equal(fidelityGate(t, prereq, 'assertion stays pending', false), true);
    assert.equal(t.skipped, 'test index unavailable; assertion stays pending');
    assert.throws(() => fidelityGate(stub(), prereq, 'assertion stays pending', true),
      /FIDELITY PREREQUISITE MISSING: test index unavailable/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('present path: gate passes without skip in both modes (synthetic-present path)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fidelity-gate-'));
  try {
    const present = path.join(dir, 'present.bin');
    await writeFile(present, 'synthetic fixture bytes');
    assert.equal(await missingPrerequisite(present, 'test asset unavailable'), null);
    for (const required of [false, true]) {
      const t = stub();
      assert.equal(fidelityGate(t, null, 'assertion stays pending', required), false);
      assert.equal(t.skipped, null);
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('unreadable asset is not masked as missing prerequisite', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fidelity-gate-'));
  try {
    const locked = path.join(dir, 'locked.bin');
    await writeFile(locked, 'synthetic fixture bytes');
    await chmod(locked, 0o000);
    let readable = true;
    try { await readFile(locked); } catch { readable = false; }
    if (readable) { t.skip('filesystem does not enforce mode bits for this user'); return; }
    await assert.rejects(missingPrerequisite(locked, 'test asset unavailable'),
      (error) => { assert.notEqual(error.code, 'ENOENT'); return true; });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('corrupt index bytes surface as integrity failure, never as a skippable missing asset', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fidelity-gate-'));
  try {
    const corrupt = path.join(dir, 'corrupt.sqlite');
    await writeFile(corrupt, Buffer.from('not a sqlite database at all'.repeat(8)));
    assert.equal(await missingPrerequisite(corrupt, 'test index unavailable'), null,
      'an existing corrupt file is not a missing prerequisite');
    await assert.rejects(openPublicLibrary(corrupt),
      'corrupt bytes must fail as an integrity error on the real open path');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
