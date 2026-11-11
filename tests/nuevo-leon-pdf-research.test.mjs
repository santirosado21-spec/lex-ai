import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('Nuevo León PDF research: exact capabilities, provenance and bounded offline capture',()=>{
  const result=spawnSync('python3',['-B','tests/capture_nuevo_leon_pdfs_test.py'],{
    cwd:fileURLToPath(new URL('../',import.meta.url)),encoding:'utf8',timeout:20_000,
  });
  assert.equal(result.status,0,result.stderr||result.error?.message);
  assert.match(result.stderr,/Ran 17 tests/);
  assert.match(result.stderr,/\bOK\b/);
});
