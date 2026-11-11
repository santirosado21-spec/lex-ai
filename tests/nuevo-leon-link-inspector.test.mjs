import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('bounded Nuevo León link inspector: Python offline safety and capture contract',()=>{
  const cwd=fileURLToPath(new URL('../',import.meta.url));
  const result=spawnSync('python3',['-B','tests/inspect_nuevo_leon_links_test.py'],{cwd,encoding:'utf8',timeout:20_000});
  assert.equal(result.status,0,result.stderr||result.error?.message);
  assert.match(result.stderr,/Ran 17 tests/);
  assert.match(result.stderr,/\bOK\b/);
});
