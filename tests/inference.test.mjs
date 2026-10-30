import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {createInference} from '../server/inference.mjs';
test('cancel startup and concurrent stops converge without spawning a late runtime',async()=>{
 const dataDir=await mkdtemp(path.join(os.tmpdir(),'lex-lifecycle-'));
 const engine=createInference({dataDir,runtimePath:process.execPath});
 await engine.initialize();await Promise.all([engine.stop(),engine.stop()]);
 await new Promise(r=>setTimeout(r,300));assert.equal((await engine.status()).state,'stopped');
});
test('generation fails closed before verified initialization',async()=>{
 const engine=createInference({dataDir:os.tmpdir()});await assert.rejects(async()=>{for await(const _ of engine.generate([])){}},/Prepara LEX AI antes de analizar documentos/);
});
