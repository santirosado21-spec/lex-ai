import test from 'node:test';
import assert from 'node:assert/strict';
import {locateDirectoryArticle} from '../src/article-locator.js';
const entries=['97','36-A','15-BIS','15-BIS-1','15-TER'].map(article=>({article}));
test('exact number and explicit suffixes resolve only a listed directory entry',()=>{
 for(const [query,article] of [['97','97'],['Artículo 97.','97'],['art. 036-a','36-A'],['15 bis','15-BIS'],['15 bis 1','15-BIS-1'],['15-TER','15-TER']]) assert.deepEqual(locateDirectoryArticle(query,entries),{status:'found',article});
});
test('missing article never falls back to a nearby article',()=>{
 assert.deepEqual(locateDirectoryArticle('36',entries),{status:'missing',article:'36'});
 assert.deepEqual(locateDirectoryArticle('999',entries),{status:'missing',article:'999'});
});
test('ranges, legal text, multiple IDs, ambiguous or oversized input are invalid',()=>{
 for(const query of ['',null,97,'0','97 a 99','97, 98','97 y 98','97 sobre importación','artículo 15bis','a'.repeat(61)]) assert.deepEqual(locateDirectoryArticle(query,entries),{status:'invalid'});
});
