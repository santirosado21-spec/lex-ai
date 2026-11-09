import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,mkdir,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {skills} from '../server/skills.mjs';
import {validatePublicCandidatePlan,readCandidateCatalogExcerpt} from '../scripts/check-public-agent-candidates.mjs';

const base=JSON.parse(await readFile(new URL('../resources/public-agent-candidates.json',import.meta.url),'utf8'));
const excerpt=await readCandidateCatalogExcerpt(base);
const cases=(await readFile(new URL('../eval/public-agents/cases.jsonl',import.meta.url),'utf8')).trim().split('\n').map(JSON.parse);
const copy=value=>structuredClone(value);
const run=promisify(execFile);
const validate=plan=>validatePublicCandidatePlan(plan,{excerpt});
const rejects=mutate=>{const plan=copy(base);mutate(plan);assert.throws(()=>validate(plan));};

test('inactive plan matches actual matter-capable skills and saved evidence without selecting or approving a model',()=>{
 const result=validate(base);
 assert.equal(result.status,'candidate-plan-valid-unmeasured');
 assert.equal(result.facts.candidateCount,4);assert.equal(result.facts.profileCount,2);
 assert.deepEqual(result.facts.excludedCurrentSkillIds,skills.map(skill=>skill.id));
 for(const key of ['productionEnabled','routingIntegrated','liveCapabilityOrPriceCheck','benchmarkPerformed','modelSelected','authorizationGranted'])assert.equal(result.facts[key],false);
 assert.equal(result.facts.savedExcerptCompared,true);
 assert.equal(result.facts.contentClassification,'not-performed');
 assert.match(result.limitations.join(' '),/not total cost/);
 assert.match(result.limitations.join(' '),/reasoning tokens.*cache.*tiers.*fees/);
});

test('all activation flags, active candidate and premature quality/access claims are rejected',()=>{
 for(const flag of ['productionEnabled','routingIntegrated','remoteToolsEnabled','fallbacksEnabled','automaticUpgradeEnabled']) {
  rejects(plan=>{plan[flag]=true;});rejects(plan=>{delete plan[flag];});
 }
 rejects(plan=>{plan.status='active';});
 rejects(plan=>{plan.profiles[0].activeCandidateKey='luna6';});
 for(const [field,value] of [['productionEnabled',true],['quality','validated'],['commercialAccess','authorized'],['endpointPinning','verified'],['retentionReview','complete']])rejects(plan=>{plan.candidates[0][field]=value;});
});

test('declared public task classes do not classify arbitrary prompts, histories or metadata',()=>{
 for(const dataClass of ['confidential','matter','unknown'])rejects(plan=>{plan.allowedDataClasses.push(dataClass);});
 rejects(plan=>{plan.allowedDataClasses=['public'];});
 const plan=copy(base);plan.arbitraryPrompt={text:'Synthetic example claiming confidential provenance',provenance:'confidential'};
 const result=validate(plan);
 assert.equal(result.facts.contentClassification,'not-performed');
 assert.equal(result.facts.authorizationGranted,false);
 assert.equal('arbitraryPrompt' in result,false);
 assert.match(result.limitations.join(' '),/actual H2 integration/);
});

test('matter-role exclusions track actual inventory and new public agent names cannot reuse existing skills',()=>{
 rejects(plan=>{plan.currentSkillsExcluded.pop();});
 rejects(plan=>{plan.currentSkillsExcluded.push('not-a-current-skill');});
 rejects(plan=>{plan.currentSkillsExcluded.push(plan.currentSkillsExcluded[0]);});
 for(const skill of skills)rejects(plan=>{plan.profiles[0].agentIds=[skill.id];});
 rejects(plan=>{plan.profiles[1].agentIds=[plan.profiles[0].agentIds[0]];});
 const changed=copy(skills);changed.push({...changed[0],id:'new-matter-capable-skill'});
 assert.throws(()=>validatePublicCandidatePlan(base,{skills:changed,excerpt}),/inventory/);
 changed[0].permissions=[];
 assert.throws(()=>validatePublicCandidatePlan(base,{skills:changed,excerpt}),/permissions/);
});

test('candidate and profile references are unique, complete and known',()=>{
 rejects(plan=>{plan.candidates[1].key=plan.candidates[0].key;});
 rejects(plan=>{plan.candidates.pop();});
 rejects(plan=>{plan.profiles[0].candidateKeys=['missing'];});
 rejects(plan=>{plan.profiles[1].candidateKeys.push(plan.profiles[0].candidateKeys[0]);});
 rejects(plan=>{plan.profiles[0].candidateKeys.pop();});
 rejects(plan=>{plan.profiles[1].id=plan.profiles[0].id;});
});

test('identifiers require explicit non-Claude, non-Auto and dated routes; no free/latest aliases',()=>{
 for(const value of ['anthropic/claude-test','openrouter/auto','qwen/test:free','openai/test-latest','Auto'])rejects(plan=>{plan.candidates[0].modelId=value;});
 rejects(plan=>{plan.candidates[0].canonicalSlug=plan.candidates[0].modelId;});
 rejects(plan=>{plan.candidates[0].proposedEndpointTag='auto';});
});

test('official evidence paths, hashes and timestamps are mandatory and cannot use lookalike domains',()=>{
 rejects(plan=>{delete plan.candidates[0].evidence;});
 for(const field of ['catalogSha256','endpointSha256'])for(const value of ['','abc','g'.repeat(64)])rejects(plan=>{plan.candidates[0].evidence[field]=value;});
 for(const url of ['http://openrouter.ai/api/v1/models','https://openrouter.ai.example.com/api/v1/models','https://user@openrouter.ai/api/v1/models','https://openrouter.ai/api/v1/models?claim=official'])rejects(plan=>{plan.candidates[0].evidence.catalogUrl=url;});
 rejects(plan=>{plan.candidates[0].evidence.endpointUrl=plan.candidates[1].evidence.endpointUrl;});
 rejects(plan=>{plan.checkedAt='not-a-date';});
});

test('finite decimal price strings are required in endpoint and aggregate quotes',()=>{
 for(const quote of ['pricingUsdPerToken','catalogPricingUsdPerToken'])for(const field of ['prompt','completion'])for(const value of [undefined,-1,0,'-0.1','NaN','Infinity','1e-7','', '9'.repeat(400)])rejects(plan=>{plan.candidates[0][quote][field]=value;});
});

test('bounds and advertised structured output parameters must be explicit',()=>{
 for(const field of ['response_format','structured_outputs','max_tokens'])rejects(plan=>{plan.candidates[0].advertisedParameters=plan.candidates[0].advertisedParameters.filter(value=>value!==field);});
 for(const [field,value] of [['maximumInputUtf16',7001],['maximumInputUtf16',0],['maximumInputUtf16',1.5],['maximumOutputTokens',Infinity],['maximumOutputTokens',1201],['maximumOutputTokens',0]])rejects(plan=>{plan.profiles[0][field]=value;});
});

test('sample prompt/output components use endpoint price, preserve catalog quote and do not apply discount twice',()=>{
 const original=JSON.stringify(base),result=validate(base);
 assert.equal(result.illustrativeCosts.find(row=>row.candidateKey==='luna6').illustrativePromptAndCompletionUsd,'0.00045');
 assert.equal(result.illustrativeCosts.find(row=>row.candidateKey==='qwen38flash').illustrativePromptAndCompletionUsd,'0.000535');
 assert.equal(result.illustrativeCosts.find(row=>row.candidateKey==='terra61').illustrativePromptAndCompletionUsd,'0.0045');
 const google=result.illustrativeCosts.find(row=>row.candidateKey==='gemini38flash');
 assert.equal(google.illustrativePromptAndCompletionUsd,'0.003375');
 assert.notEqual(google.illustrativePromptAndCompletionUsd,String(2000*Number(base.candidates[3].catalogPricingUsdPerToken.prompt)+500*Number(base.candidates[3].catalogPricingUsdPerToken.completion)));
 for(const row of result.illustrativeCosts){assert.equal(row.inputTokens,2000);assert.equal(row.outputTokens,500);assert.match(row.quoteSource,/endpoint snapshot/);}
 assert.equal(JSON.stringify(base),original);
});

test('saved record comparison detects edits to identity, endpoint, price, schema and source hashes',()=>{
 for(const mutate of [
  plan=>{plan.candidates[0].pricingUsdPerToken.prompt='0';},
  plan=>{plan.candidates[0].catalogPricingUsdPerToken.completion='0';},
  plan=>{plan.candidates[0].proposedEndpointTag='another-explicit-provider';},
  plan=>{plan.candidates[0].providerName='Another Provider';},
  plan=>{plan.candidates[0].contextLength=8000;},
  plan=>{plan.candidates[0].advertisedParameters.push('invented_parameter');},
  plan=>{plan.candidates[0].evidence.endpointSha256='a'.repeat(64);},
 ])rejects(mutate);
 for(const mutate of [value=>{value.records[0].model.id='other/model';},value=>{value.records[0].selectedEndpoint.supported_parameters=[];},value=>{value.records[0].model.pricing=null;},value=>{value.records[1]=copy(value.records[0]);},value=>{value.fetchedAt='2000-01-01T00:00:00Z';}]) {
  const bad=copy(excerpt);mutate(bad);assert.throws(()=>validatePublicCandidatePlan(base,{excerpt:bad}));
 }
});

test('excerpt loader detects tamper, traversal and symlink escape without fetching',async()=>{
 const root=await mkdtemp(join(tmpdir(),'lex-public-candidates-'));
 try {
  await mkdir(join(root,'eval/public-agents'),{recursive:true});
  const filename=join(root,base.catalogExcerpt.file),raw=JSON.stringify(excerpt);
  await writeFile(filename,raw);
  const plan=copy(base);plan.catalogExcerpt.sha256=createHash('sha256').update(raw).digest('hex');
  assert.deepEqual(await readCandidateCatalogExcerpt(plan,{rootDirectory:root}),excerpt);
  await writeFile(filename,`${raw}\n`);
  await assert.rejects(readCandidateCatalogExcerpt(plan,{rootDirectory:root}),/hash mismatch/);
  plan.catalogExcerpt.file='../outside.json';
  await assert.rejects(readCandidateCatalogExcerpt(plan,{rootDirectory:root}),/Confined/);
  plan.catalogExcerpt.file=base.catalogExcerpt.file;
  await rm(filename);const outside=join(root,'outside.json');await writeFile(outside,raw);await symlink(outside,filename);
  await assert.rejects(readCandidateCatalogExcerpt(plan,{rootDirectory:root}),/escapes/);
 } finally {await rm(root,{recursive:true,force:true});}
});

test('offline CLI supports default and explicit file, while invalid flags/config exit nonzero',async()=>{
 for(const args of [[],['--file',fileURLToPath(new URL('../resources/public-agent-candidates.json',import.meta.url))]]) {
  const {stdout,stderr}=await run(process.execPath,['scripts/check-public-agent-candidates.mjs',...args]);
  assert.equal(stderr,'');assert.equal(JSON.parse(stdout).status,'candidate-plan-valid-unmeasured');
 }
 await assert.rejects(run(process.execPath,['scripts/check-public-agent-candidates.mjs','--activate']),error=>{assert.equal(error.code,1);assert.match(error.stderr,/Usage/);return true;});
 const root=await mkdtemp(join(tmpdir(),'lex-invalid-plan-'));
 try {const plan=copy(base);plan.productionEnabled=true;const file=join(root,'plan.json');await writeFile(file,JSON.stringify(plan));await assert.rejects(run(process.execPath,['scripts/check-public-agent-candidates.mjs','--file',file]),error=>{assert.equal(error.code,1);assert.match(error.stderr,/productionEnabled/);return true;});}
 finally {await rm(root,{recursive:true,force:true});}
});

test('28 wholly synthetic task cases have disjoint variant IDs, blind ordering and bounded input',()=>{
 assert.equal(cases.length,28);
 const ids=new Set(),groups=new Set(),orders=new Set(),inputs=new Set();
 for(const row of cases) {
  assert.deepEqual(Object.keys(row).sort(),['id','profileId','dataClass','task','input','expected','rubric'].sort());
  assert.equal(row.dataClass,'synthetic');assert.ok(!ids.has(row.id));ids.add(row.id);
  assert.ok(!groups.has(row.rubric.variantGroup));groups.add(row.rubric.variantGroup);
  assert.ok(Number.isInteger(row.rubric.blindOrder)&&row.rubric.blindOrder>=1&&row.rubric.blindOrder<=cases.length);assert.ok(!orders.has(row.rubric.blindOrder));orders.add(row.rubric.blindOrder);
  assert.ok(row.rubric.checks.length>=2);assert.ok(row.rubric.checks.every(value=>typeof value==='string'&&value.length>8));
  const profile=base.profiles.find(profile=>profile.id===row.profileId);assert.ok(profile);
  const input=JSON.stringify(row.input);assert.ok(input.length<=profile.maximumInputUtf16);assert.ok(!inputs.has(input));inputs.add(input);
  assert.match(row.input.syntheticNotice,/SINTÉTICO/);assert.match(row.input.syntheticNotice,/no es ley real/);
  assert.equal(typeof row.expected,'object');assert.ok(Object.keys(row.expected).length);
  for(const source of row.input.sources??[])assert.match(source.text,/SINTÉTIC[OA].*NO LEY REAL/);
  if(row.expected.quote)assert.ok((row.input.sources??[]).some(source=>source.id===row.expected.sourceId&&source.text.includes(row.expected.quote)));
 }
 assert.equal(cases.filter(row=>row.profileId==='public-light').length,14);
 assert.equal(cases.filter(row=>row.profileId==='public-evidence').length,14);
});

test('task corpus includes abstention, unsupported citation, injection, preservation and separate privacy-proof expectations',()=>{
 for(const status of ['abstain','reject-unknown-citation','reject-nonverbatim-quote'])assert.ok(cases.some(row=>row.expected.status===status));
 for(const task of ['extract-bulletin-metadata','spanish-two-sentences','preserve-two-dates','source-injection-as-data','source-injection-preserve-boundary','exact-date-amount-quote','conflicting-passages-abstention'])assert.ok(cases.some(row=>row.task===task));
 const blocked=cases.filter(row=>row.expected.decision==='reject-not-send');assert.equal(blocked.length,4);
 for(const row of blocked)assert.equal(row.expected.safetyProof,'requires-separate-actual-H2-integration');
 const unknown=cases.filter(row=>row.expected.status==='reject-unknown-citation');
 for(const row of unknown)for(const sourceId of row.expected.forbiddenSourceIds)assert.ok(!(row.input.sources??[]).some(source=>source.id===sourceId));
 assert.equal(cases.find(row=>row.id==='PL01').expected.importe,'MXN 1,250.50');
 assert.equal(cases.find(row=>row.id==='PE08').expected.fecha,'2035-11-02');
});
