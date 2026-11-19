// Measurement harness (adapted from QA route probe; synthetic stand-in, fake fetch, real heldout never opened).
import {createOpenAiProvider} from '../server/providers/openai.mjs';
import {createCloudGrants, createPseudonymizedCloudRoute} from '../server/cloud-route.mjs';
import {createVariantAwareDetector} from '../server/privacy/detector-variants.mjs';
import {createPseudonymStore} from '../server/privacy/pseudonyms.mjs';
import {verifyDetectorEligibility, CORE_SOURCES} from '../server/privacy/eligibility.mjs';
import {mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import path from 'node:path';

const REPO = new URL('..', import.meta.url).pathname;
const EXTRA = ['server/privacy/detector-variants.mjs'];
const scope = {workspaceId:'W', matterId:'M', threadId:'T'};
const KEY = 'sk-test-' + 'x'.repeat(30);
const sha = f => createHash('sha256').update(readFileSync(f)).digest('hex');

function fixtureRoot() {
 const root = mkdtempSync(path.join(tmpdir(), 'elig-'));
 mkdirSync(path.join(root, 'eval/privacy-v2'), {recursive:true});
 for (const file of [...CORE_SOURCES, ...EXTRA, 'eval/privacy-v2/protocol.json']) { mkdirSync(path.dirname(path.join(root, file)), {recursive:true}); copyFileSync(path.join(REPO, file), path.join(root, file)); }
 writeFileSync(path.join(root, 'eval/privacy-v2/heldout-standin.jsonl'), 'synthetic stand-in\n');
 writeFileSync(path.join(root, 'eval/privacy-v2/manifest.json'), JSON.stringify({version:2, protocol:{file:'protocol.json', sha256:sha(path.join(root, 'eval/privacy-v2/protocol.json'))},
  splits:{heldout:{file:'heldout-standin.jsonl', sha256:sha(path.join(root, 'eval/privacy-v2/heldout-standin.jsonl'))}}}));
 return root;
}
const VERSION = createVariantAwareDetector({provenanceRegistry:{resolve(){}}}).version;
function fixtureRecord(root) {
 const sourceHashes = Object.fromEntries([...CORE_SOURCES, ...EXTRA].map(f => [f, sha(path.join(root, f))]));
 return {score:{version:2, split:'heldout', candidateId:VERSION, correctBlockReason:{numerator:48, denominator:48, rate:1}, protocolSha256:sha(path.join(root, 'eval/privacy-v2/protocol.json')),
  corpusSha256:sha(path.join(root, 'eval/privacy-v2/heldout-standin.jsonl')), experimentalGate:{status:'eligible-for-integration-evaluation', failures:[], minimumFailures:[], minimumsApplied:true}},
 execution:{candidateVersion:VERSION, sourceHashes}};
}
function setup() {
 const sent = [];
 const root = fixtureRoot();
 const record = fixtureRecord(root);
 const fetchImpl = async (url, init) => {
  sent.push({url, raw:init.body});
  const body = JSON.parse(init.body);
  return new Response(JSON.stringify({model:'test-model', choices:[{finish_reason:'stop', message:{content:body.messages.at(-1).content}}], usage:{prompt_tokens:1, completion_tokens:1}}), {status:200});
 };
 const provider = createOpenAiProvider({enabled:true, getApiKey:async () => KEY, model:'test-model', fetchImpl, maxCalls:50});
 const grants = createCloudGrants();
 grants.grant(scope, 'openai');
 const route = createPseudonymizedCloudRoute({detector:'variants', pseudonyms:createPseudonymStore(), provider, grants, evaluation:{root, record}});
 const ask = async content => { const out = []; for await (const chunk of route.ask({scope, messages:[{role:'user', content}]})) out.push(chunk); return out.join(''); };
 return {sent, route, ask};
}

export {setup};
