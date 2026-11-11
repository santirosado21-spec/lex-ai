import {readFile,realpath} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve,relative,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {skills as actualSkills} from '../server/skills.mjs';

const defaultFile=new URL('../resources/public-agent-candidates.json',import.meta.url);
const repoRoot=fileURLToPath(new URL('../',import.meta.url));
const inactiveFlags=['productionEnabled','routingIntegrated','remoteToolsEnabled','fallbacksEnabled','automaticUpgradeEnabled'];
const excludedCharges=['reasoning tokens','cache reads/writes','context tiers','tools/search/media','retries','credit purchase fees','taxes','discount interpretation'];
const fail=message=>{throw new Error(message);};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const nonempty=value=>typeof value==='string'&&value.trim().length>0;
const uniqueStrings=value=>Array.isArray(value)&&value.length>0&&value.every(nonempty)&&new Set(value).size===value.length;
const sameSet=(a,b)=>uniqueStrings(a)&&uniqueStrings(b)&&a.length===b.length&&a.every(item=>b.includes(item));
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);
const timestamp=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value)&&Number.isFinite(Date.parse(value));
const unsafeRoute=value=>/(?:claude|(?:^|[/:_-])auto(?:$|[/:_-])|:free|latest)/i.test(value);

function evidenceUrl(value,path) {
  try {
    const url=new URL(value);
    return url.protocol==='https:'&&url.hostname==='openrouter.ai'&&!url.username&&!url.password&&!url.port&&!url.search&&!url.hash&&url.pathname===path;
  } catch {return false;}
}

function prices(value,label) {
  if(!object(value))fail(`${label}: missing price quote`);
  for(const field of ['prompt','completion']) {
    const price=value[field];
    if(typeof price!=='string'||!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(price)||!Number.isFinite(Number(price)))fail(`${label}.${field}: expected finite nonnegative decimal string`);
  }
}

// Exact decimal arithmetic for the two quoted components; no billing estimate.
function illustrativeComponents(quote) {
  const parts=[quote.prompt,quote.completion].map(value=>{const [whole,fraction='']=value.split('.');return {digits:BigInt(whole+fraction),scale:fraction.length};});
  const scale=Math.max(...parts.map(part=>part.scale));
  const units=parts.reduce((sum,part,index)=>sum+part.digits*(10n**BigInt(scale-part.scale))*BigInt([2000,500][index]),0n);
  if(!scale)return units.toString();
  const padded=units.toString().padStart(scale+1,'0');
  return `${padded.slice(0,-scale)}.${padded.slice(-scale)}`.replace(/0+$/,'').replace(/\.$/,'');
}

/** Offline structural research check. Does not classify a prompt, grant scope, or authenticate evidence. */
export function validatePublicCandidatePlan(plan,{skills=actualSkills,excerpt}={}) {
  if(!object(plan)||plan.version!==1||plan.status!=='candidates-only')fail('Expected version 1 candidates-only plan');
  for(const flag of inactiveFlags)if(plan[flag]!==false)fail(`${flag} must remain false`);
  if(!sameSet(plan.allowedDataClasses,['public','synthetic']))fail('allowedDataClasses must be exactly public and synthetic');
  if(!timestamp(plan.checkedAt))fail('checkedAt must be an evidence snapshot timestamp');
  if(!object(plan.catalogExcerpt)||!/^eval\/public-agents\/catalog-snapshot-\d{4}-\d{2}-\d{2}\.json$/.test(plan.catalogExcerpt.file)||!hash(plan.catalogExcerpt.sha256)||!nonempty(plan.catalogExcerpt.scope))fail('Confined catalogExcerpt file, hash and scope required');
  if(!Array.isArray(skills)||!skills.length||!skills.every(skill=>nonempty(skill?.id)&&Array.isArray(skill.permissions)&&skill.permissions.includes('read:current-matter'))||new Set(skills.map(skill=>skill.id)).size!==skills.length)fail('Current skill inventory changed; review matter-capable permissions');
  const excluded=skills.map(skill=>skill.id);
  if(!sameSet(plan.currentSkillsExcluded,excluded))fail('currentSkillsExcluded must exactly match the actual current skill inventory');
  if(!Array.isArray(plan.candidates)||plan.candidates.length!==4)fail('Expected four evidence-backed candidates');
  const candidates=new Map(),modelIds=new Set(),slugs=new Set();
  for(const candidate of plan.candidates) {
    if(!object(candidate)||!nonempty(candidate.key)||candidates.has(candidate.key))fail('Candidate keys must be unique');
    for(const field of ['modelId','canonicalSlug','proposedEndpointTag','providerName'])if(!nonempty(candidate[field])||unsafeRoute(candidate[field]))fail(`Candidate ${candidate.key}: invalid or unpinned ${field}`);
    if(!/^[a-z0-9.-]+\/[a-z0-9._-]+$/i.test(candidate.modelId)||!candidate.canonicalSlug.startsWith(`${candidate.modelId}-`)||!/-\d{8}$/.test(candidate.canonicalSlug))fail(`Candidate ${candidate.key}: explicit model ID and dated canonical slug required`);
    if(modelIds.has(candidate.modelId)||slugs.has(candidate.canonicalSlug))fail('Duplicate candidate model or canonical slug');
    modelIds.add(candidate.modelId);slugs.add(candidate.canonicalSlug);
    if(candidate.productionEnabled!==false||candidate.quality!=='not-evaluated'||candidate.commercialAccess!=='not-authorized'||candidate.endpointPinning!=='not-verified-by-live-generation'||candidate.retentionReview!=='pending')fail(`Candidate ${candidate.key}: inactive and unmeasured status required`);
    if(!Number.isSafeInteger(candidate.contextLength)||candidate.contextLength<2000)fail(`Candidate ${candidate.key}: invalid advertised context length`);
    if(!uniqueStrings(candidate.advertisedParameters)||!['response_format','structured_outputs','max_tokens'].every(parameter=>candidate.advertisedParameters.includes(parameter)))fail(`Candidate ${candidate.key}: missing required advertised parameter`);
    prices(candidate.pricingUsdPerToken,`${candidate.key}.endpoint`);
    prices(candidate.catalogPricingUsdPerToken,`${candidate.key}.catalog`);
    const evidence=candidate.evidence;
    if(!object(evidence)||!hash(evidence.catalogSha256)||!hash(evidence.endpointSha256)||!evidenceUrl(evidence.catalogUrl,'/api/v1/models')||!evidenceUrl(evidence.endpointUrl,`/api/v1/models/${candidate.canonicalSlug}/endpoints`)||!evidenceUrl(evidence.modelPageUrl,`/${candidate.modelId}`))fail(`Candidate ${candidate.key}: missing or invalid official snapshot evidence`);
    candidates.set(candidate.key,candidate);
  }
  if(!Array.isArray(plan.profiles)||plan.profiles.length!==2)fail('Expected two inactive public task profiles');
  const profileIds=new Set(),agentIds=new Set(),references=new Set(),illustrativeCosts=[];
  for(const profile of plan.profiles) {
    if(!object(profile)||!nonempty(profile.id)||profileIds.has(profile.id))fail('Profile IDs must be unique');
    profileIds.add(profile.id);
    if(profile.activeCandidateKey!==null)fail(`Profile ${profile.id}: no active candidate allowed`);
    if(!uniqueStrings(profile.agentIds)||profile.agentIds.some(id=>excluded.includes(id)||agentIds.has(id)))fail(`Profile ${profile.id}: proposed agent IDs must be distinct and exclude current matter-capable skills`);
    profile.agentIds.forEach(id=>agentIds.add(id));
    if(!Number.isSafeInteger(profile.maximumInputUtf16)||profile.maximumInputUtf16<1||profile.maximumInputUtf16>7000||!Number.isSafeInteger(profile.maximumOutputTokens)||profile.maximumOutputTokens<500||profile.maximumOutputTokens>1200)fail(`Profile ${profile.id}: input/output bounds exceeded or absent`);
    if(!uniqueStrings(profile.criteria)||!uniqueStrings(profile.candidateKeys))fail(`Profile ${profile.id}: criteria and candidate keys required`);
    for(const key of profile.candidateKeys) {
      if(!candidates.has(key)||references.has(key))fail(`Profile ${profile.id}: unknown or repeated candidate reference`);
      references.add(key);
      const candidate=candidates.get(key);
      illustrativeCosts.push({profileId:profile.id,candidateKey:key,endpointTag:candidate.proposedEndpointTag,inputTokens:2000,outputTokens:500,illustrativePromptAndCompletionUsd:illustrativeComponents(candidate.pricingUsdPerToken),quoteSource:'endpoint snapshot; catalog aggregate quote kept separate'});
    }
  }
  if(references.size!==candidates.size)fail('Every candidate must be referenced exactly once across profiles');
  if(excerpt!==undefined) {
    if(!object(excerpt)||excerpt.version!==1||excerpt.fetchedAt!==plan.checkedAt||!evidenceUrl(excerpt.source,'/api/v1/models')||!Array.isArray(excerpt.records)||excerpt.records.length!==candidates.size||new Set(excerpt.records.map(record=>record?.key)).size!==candidates.size)fail('Catalog excerpt metadata or record inventory mismatch');
    for(const record of excerpt.records) {
      const candidate=candidates.get(record?.key),model=record?.model,endpoint=record?.selectedEndpoint;
      if(!candidate||!object(model)||!object(endpoint)||model.id!==candidate.modelId||endpoint.model_id!==candidate.modelId||model.canonical_slug!==candidate.canonicalSlug||model.context_length!==candidate.contextLength||endpoint.context_length!==candidate.contextLength||endpoint.tag!==candidate.proposedEndpointTag||endpoint.provider_name!==candidate.providerName||!sameSet(endpoint.supported_parameters,candidate.advertisedParameters)||!isDeepStrictEqual(endpoint.pricing,candidate.pricingUsdPerToken)||!isDeepStrictEqual(model.pricing,candidate.catalogPricingUsdPerToken)||record.catalogSourceSha256!==candidate.evidence.catalogSha256||record.endpointSourceSha256!==candidate.evidence.endpointSha256)fail(`Catalog excerpt mismatch for ${record?.key}`);
    }
  }
  return {
    status:'candidate-plan-valid-unmeasured',
    facts:{candidateCount:candidates.size,profileCount:profileIds.size,excludedCurrentSkillIds:excluded,evidenceCheckedAt:plan.checkedAt,savedExcerptCompared:excerpt!==undefined,productionEnabled:false,routingIntegrated:false,contentClassification:'not-performed',evidenceAuthentication:'not-performed-offline',liveCapabilityOrPriceCheck:false,benchmarkPerformed:false,modelSelected:false,authorizationGranted:false},
    illustrativeCosts,
    limitations:['Snapshot capabilities and prices are evidence declarations, not a live benchmark.','Illustrative prompt/completion components are not total cost, a budget, a quality result, or an approval.','Input UTF16 limits are not tokenizer measurements. Arbitrary prompt provenance is not established by this checker.',`Excluded charges and billing effects: ${excludedCharges.join(', ')}.`, 'Private-data rejection requires separate actual H2 integration tests; this file provides no transport or privacy enforcement.'],
  };
}

export async function readCandidateCatalogExcerpt(plan,{rootDirectory=repoRoot}={}) {
  const reference=plan?.catalogExcerpt;
  if(!object(reference)||typeof reference.file!=='string'||!/^eval\/public-agents\/catalog-snapshot-\d{4}-\d{2}-\d{2}\.json$/.test(reference.file)||!hash(reference.sha256))fail('Confined catalogExcerpt file and hash required');
  const directory=await realpath(resolve(rootDirectory,'eval/public-agents'));
  const filename=await realpath(resolve(rootDirectory,reference.file));
  const fromDirectory=relative(directory,filename);
  if(!fromDirectory||fromDirectory==='..'||fromDirectory.startsWith(`..${sep}`)||resolve(directory,fromDirectory)!==filename)fail('Catalog excerpt escapes its confined directory');
  const raw=await readFile(filename);
  if(createHash('sha256').update(raw).digest('hex')!==reference.sha256)fail('Catalog excerpt hash mismatch');
  return JSON.parse(raw.toString('utf8'));
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
  try {
    const args=process.argv.slice(2);
    if(args.length&&!(args.length===2&&args[0]==='--file'))fail('Usage: node scripts/check-public-agent-candidates.mjs [--file path]');
    const plan=JSON.parse(await readFile(args.length?resolve(args[1]):defaultFile,'utf8'));
    const excerpt=await readCandidateCatalogExcerpt(plan);
    console.log(JSON.stringify(validatePublicCandidatePlan(plan,{excerpt}),null,2));
  } catch(error) {console.error(JSON.stringify({status:'candidate-plan-invalid',error:error.message}));process.exitCode=1;}
}
