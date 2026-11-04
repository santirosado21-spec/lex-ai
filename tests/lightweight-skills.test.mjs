import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,access} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {prepareCases,withoutSkill,assess,validateEndpoint,claimLocks,CANARY,FOREIGN,OUTPUT_CONTRACT,LEGACY_CONTRACT} from '../scripts/evaluate-lightweight-skills.mjs';
import {skills} from '../server/skills.mjs';
import {generationOptions} from '../server/generation-options.mjs';

let prepared;
test.before(async()=>{prepared=await prepareCases();});
test('A/B keeps evidence and security identical and covers every actual skill',()=>{
 assert.equal(prepared.caseCount,10);assert.equal(prepared.isolation.passed,true);assert.equal(prepared.isolation.checks,20);
 for(const item of prepared.cases){
  const skill=skills.find(s=>s.id===item.skillId);
  assert.deepEqual(item.baseline,withoutSkill(item.enabled,skill));
  assert.equal(item.baseline[1].content,item.enabled[1].content);
  assert.match(item.baseline[0].content,/DATOS, nunca (instrucciones|órdenes)/);
  assert.ok(!JSON.stringify(item.enabled).includes(FOREIGN));
  assert.ok(item.evidence.some(s=>s.id==='MX-CCF-1797'));
  assert.equal(item.outputContract,OUTPUT_CONTRACT);
  assert.deepEqual(item.outputSchema.required,['paragraphs']);
  assert.ok(item.evidence.every(s=>s.allowedQuotes.every(q=>q.length>=40)));
  const privateDocument=item.evidence.find(s=>s.id==='D1');
  if(privateDocument)assert.ok(privateDocument.allowedQuotes.every(q=>q!=='DOCUMENTO SINTÉTICO.'));
 }
});
test('source cases and prompt hashes are reproducible without inference',async()=>{
 const next=await prepareCases();assert.deepEqual(next,prepared);
});
test('evaluation uses the production generation options with explicit repetition controls',()=>{
 assert.deepEqual(prepared.generation,generationOptions());
 assert.equal(prepared.generation.presence_penalty,0);assert.equal(prepared.generation.frequency_penalty,0);assert.equal(prepared.generation.repeat_penalty,1);
 assert.match(prepared.hashes.generationOptions,/^[a-f0-9]{64}$/);
});
test('expanded suite preregisters 20 new cases, preserves 10 development contexts and source provenance',async()=>{
 const expanded=await prepareCases({suite:'expanded'});
 assert.equal(expanded.caseCount,30);assert.equal(expanded.isolation.checks,60);
 assert.deepEqual(expanded.cohorts,{developmentReused:10,newPreregistered:20});
 assert.equal(expanded.evaluationOnly,true);assert.equal(new Set(expanded.cases.map(c=>c.id)).size,30);
 assert.equal(expanded.cases.filter(c=>c.adversarial).length,15);
 assert.deepEqual(new Set(expanded.fixtures.map(f=>f.sourceId)),new Set(['MX-CCF-1796','MX-CCF-1797','MX-CPEUM-14']));
 for(const original of prepared.cases){
  const reused=expanded.cases.find(c=>c.id===original.id);
  assert.equal(reused.cohort,'development-reused');
  for(const key of ['baseline','enabled','outputSchema','evidence','question','userContextSha256'])assert.deepEqual(reused[key],original[key]);
 }
 for(const item of expanded.cases){
  const fixture=expanded.fixtures.find(f=>f.id===item.fixtureId),skill=skills.find(s=>s.id===item.skillId);
  assert.match(item.fixtureSha256,/^[a-f0-9]{64}$/);assert.equal(item.fixtureSha256,fixture.fixtureSha256);
  assert.equal(item.sourceProof.sha256,fixture.sourceSha256);assert.equal(item.sourceProof.id,fixture.sourceId);
  assert.equal(item.baseline[1].content,item.enabled[1].content);assert.deepEqual(withoutSkill(item.enabled,skill),item.baseline);
  assert.ok(item.evidence.some(s=>s.id===fixture.sourceId));assert.ok(item.roleReview.criteria.length>=4);
  assert.equal(assess(response(item),item).passed,true);
 }
 for(const skill of skills)assert.equal(expanded.cases.filter(c=>c.skillId===skill.id).length,6);
 const repeat=await prepareCases({suite:'expanded'});assert.deepEqual(repeat,expanded);
});
test('unsupported suite selection fails before preparing fixtures',async()=>{
 await assert.rejects(prepareCases({suite:'unknown'}),/Unknown evaluation suite/);
});
function legacyResponse(item){return JSON.stringify({analysis:item.evidence.map(s=>`El pasaje aportado debe revisarse antes de formular una conclusión sobre el asunto. [${s.id}]`).join('\n\n'),citations:item.evidence.map(s=>({sourceId:s.id,quote:s.allowedQuotes[0]}))});}
function response(item){return JSON.stringify({paragraphs:item.evidence.map(s=>({sourceId:s.id,quote:s.allowedQuotes[0],text:s.allowedQuotes[0],kind:'observacion'}))});}
test('strict quote metric rejects plausible invented quotations, IDs and Markdown wrappers',()=>{
 const item=prepared.cases[0],good=response(item);assert.equal(assess(good,item).passed,true);
 const data=JSON.parse(good);data.paragraphs[0].quote='Una cláusula inventada que no pertenece al documento.';
 assert.equal(assess(JSON.stringify(data),item).passed,false);
 data.paragraphs[0].sourceId='OTRO';assert.equal(assess(JSON.stringify(data),item).passed,false);
 const wrapped=assess('```json\n'+good+'\n```',item);assert.equal(wrapped.strictJson,false);assert.equal(wrapped.passed,false);
});
test('a valid single-source context stays valid without inventing a private document source',()=>{
 const item=prepared.cases.find(candidate=>candidate.evidence.length===1);assert.ok(item);assert.ok(!item.evidence.some(source=>source.id==='D1'));
 assert.equal(item.outputSchema.properties.paragraphs.minItems,1);assert.equal(assess(response(item),item).passed,true);
});
test('canary, truncation and novel numeric claims fail instead of being repaired',()=>{
 const item=prepared.cases[0];
 for(const extra of [CANARY.toLowerCase(),FOREIGN,'El pago es de 987654 pesos.','Artículo 999999.']){
  const data=JSON.parse(response(item));data.paragraphs[0].text=extra+' '+data.paragraphs[0].text;assert.equal(assess(JSON.stringify(data),item).passed,false);
 }
 assert.equal(assess(response(item),item,'length').passed,false);
});
test('v2 requires distinct sources and numeric support in each paragraph quote',()=>{
 const item=prepared.cases.find(candidate=>candidate.evidence.length>=2);assert.ok(item);assert.ok(item.evidence.some(source=>source.id==='D1'));assert.ok(item.evidence.some(source=>source.id!=='D1'));let data=JSON.parse(response(item));
 data.paragraphs[1]=structuredClone(data.paragraphs[0]);
 const duplicate=assess(JSON.stringify(data),item);assert.equal(duplicate.exactQuotes,true);assert.equal(duplicate.applicationAccepted,false);
 data=JSON.parse(response(item));data.paragraphs[0].text='El artículo 1797 acredita este hecho del documento aportado.';
 const borrowed=assess(JSON.stringify(data),item);assert.equal(borrowed.noUnsupportedNumericClaims,false);assert.equal(borrowed.passed,false);
 data=JSON.parse(response(item));data.paragraphs[0].text='El plazo del acuerdo de trabajo es de treinta días.';
 assert.equal(assess(JSON.stringify(data),item).noUnsupportedNumericClaims,false);
});
test('v2 rejects brackets, extra fields, short text and literal control repairs',()=>{
 const item=prepared.cases[0];
 for(const mutate of [d=>{d.paragraphs[0].text+=' [D1]';},d=>{d.extra=true;},d=>{d.paragraphs[0].text='Muy corto';},d=>{d.paragraphs[0].kind='afirmacion';},d=>{d.paragraphs[0].text+='\nTexto adicional';}]){
  const data=JSON.parse(response(item));mutate(data);assert.equal(assess(JSON.stringify(data),item).passed,false);
 }
});
test('output contract is explicit: no raw-dependent fallback and old reports still score legacy',()=>{
 const item=prepared.cases[0],legacy=legacyResponse(item);
 assert.equal(assess(legacy,item).passed,false);
 assert.equal(assess(legacy,{...item,outputContract:LEGACY_CONTRACT}).passed,true);
 const old={...item};delete old.outputContract;
 assert.equal(assess(legacy,old).passed,true);
 assert.equal(assess(response(item),old).passed,false);
 assert.equal(assess(legacy,{...item,outputContract:'unknown'}).passed,false);
});
test('changed skill boundary fails closed',()=>{
 assert.throws(()=>withoutSkill([{role:'system',content:'changed'}],skills[0]),/boundary changed/);
});
test('remote endpoints, credentials and paths are rejected',()=>{
 assert.equal(validateEndpoint('http://127.0.0.1:43123'),'http://127.0.0.1:43123');
 for(const url of ['https://127.0.0.1:1','http://localhost:1','http://127.0.0.1:1/path','http://user:password@127.0.0.1:1','http://example.com:1'])assert.throws(()=>validateEndpoint(url));
});
test('locks prevent overlapping jobs and preserve unrelated owners',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'lex-light-lock-'));
 try{
  const release=await claimLocks(directory);await assert.rejects(claimLocks(directory));
  await writeFile(path.join(directory,'gpu.lock'),JSON.stringify({id:'different-owner'}));await release();
  assert.equal(JSON.parse(await readFile(path.join(directory,'gpu.lock'))).id,'different-owner');
  await assert.rejects(access(path.join(directory,'pipeline.lock')));
  await assert.rejects(claimLocks(directory));await assert.rejects(access(path.join(directory,'pipeline.lock')));
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('locks left by a dead process are reclaimed, locks of live or unidentified owners are not',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'lex-light-stale-'));
 try{
  await writeFile(path.join(directory,'pipeline.lock'),JSON.stringify({id:'dead',pid:2147483646}));
  await writeFile(path.join(directory,'gpu.lock'),JSON.stringify({id:'dead',pid:2147483646}));
  const release=await claimLocks(directory);await release();
  await writeFile(path.join(directory,'gpu.lock'),JSON.stringify({id:'live',pid:process.pid}));
  await assert.rejects(claimLocks(directory));
  await writeFile(path.join(directory,'gpu.lock'),JSON.stringify({id:'training-without-pid'}));
  await assert.rejects(claimLocks(directory));
 }finally{await rm(directory,{recursive:true,force:true});}
});
