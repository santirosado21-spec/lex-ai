import test from 'node:test';
import assert from 'node:assert/strict';
import {loadFixtures,validateFixtures,corpusForCase} from '../scripts/run-public-cases.mjs';

test('public-law case fixtures are complete, bounded, official and model-free',async()=>{
 const fixtures=await loadFixtures();const summary=validateFixtures(fixtures);
 assert.ok(summary.cases>=16);assert.ok(summary.matters.length>=6);assert.equal(summary.skills.length,5);assert.ok(summary.abstentions>=3);assert.ok(summary.injections>=2);
 for(const item of fixtures.cases){
  const [source]=corpusForCase(item);assert.equal(source.text,item.source.excerpt);assert.ok(source.text.includes(item.source.quote));assert.match(source.sha256,/^[a-f0-9]{64}$/);
 }
});

test('fixture validation rejects an unofficial URL and missing abstention coverage',async()=>{
 const fixtures=await loadFixtures();const unofficial=structuredClone(fixtures);unofficial.cases[0].source.url='https://example.com/law.pdf';assert.throws(()=>validateFixtures(unofficial),/Non-official/);
 const noAbstention=structuredClone(fixtures);for(const item of noAbstention.cases)item.expected.abstain=false;assert.throws(()=>validateFixtures(noAbstention),/three abstention/);
});
