import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/support-text-search.ts',import.meta.url),'utf8');
const {supportTextMatches:matches}=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));
test('exact local offsets preserve case, accents, punctuation and UTF16',()=>{
 assert.deepEqual(matches('pago Pago pagó pago','pago'),[0,15]);
 assert.deepEqual(matches('a.*b .* .*','.*'),[1,5,8]);
 assert.deepEqual(matches('😀flete😀flete','flete'),[2,9]);
 assert.deepEqual(matches('aaaa','aa'),[0,2]);
 assert.deepEqual(matches('texto','   '),[]);
 assert.deepEqual(matches('texto','ausente'),[]);
 assert.equal(matches('a'.repeat(10000),'a').length,200);
});
