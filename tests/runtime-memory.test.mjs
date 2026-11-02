import test from 'node:test';
import assert from 'node:assert/strict';
import {parseVmMemory,parseProcessTreeRss} from '../server/runtime-memory.mjs';
const sample=`Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free: 10000.
Pages inactive: 400000.
Pages speculative: 80000.
Pages purgeable: 200000.
File-backed pages: 300000.
Pages occupied by compressor: 500000.
`;
test('available estimate credits half inactive without overlapping counters',()=>{const m=parseVmMemory(sample,24*1024**3);assert.equal(m.freeBytes,10000*16384);assert.equal(m.availableBytes,210000*16384);assert.equal(m.estimated,true);assert.equal(parseVmMemory(sample.replace('200000.','999999.'),24*1024**3).availableBytes,m.availableBytes);});
test('supports Intel page size and rejects missing or impossible readings',()=>{assert.equal(parseVmMemory(sample.replace('16384','4096'),8*1024**3).availableBytes,210000*4096);assert.throws(()=>parseVmMemory('bad',24*1024**3));assert.throws(()=>parseVmMemory(sample,1024));});
test('RSS includes nested owned runners, excludes unrelated processes',()=>{assert.equal(parseProcessTreeRss('1 0 9000\n2 1 100\n3 2 200\n4 3 300\n5 1 99999',2),600*1024);assert.throws(()=>parseProcessTreeRss('1 0 100',2));assert.throws(()=>parseProcessTreeRss('2 1 nope',2));});
