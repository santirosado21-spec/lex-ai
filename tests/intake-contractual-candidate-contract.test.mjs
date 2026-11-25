// Format evidence only. Never invokes a model/candidate, opens heldout, constructs
// an eligible record or changes scorer/eligibility/runtime behavior.
import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import path from 'node:path';
import {projectPrivacyCase,validateOperationalInput} from '../server/privacy/operational-v2.mjs';
import {validateCases,scorePredictions,validatePredictionArtifact} from '../scripts/eval-privacy-v2.mjs';
import {verifyDetectorEligibility} from '../server/privacy/eligibility.mjs';
import {extractDocument} from '../server/extraction.mjs';
const root=new URL('../',import.meta.url);
const protocol=JSON.parse(await readFile(new URL('eval/privacy-v2/protocol.json',root),'utf8'));
const dev=(await readFile(new URL('eval/privacy-v2/dev.jsonl',root),'utf8')).trimEnd().split('\n').map(JSON.parse);
const hashes={protocolSha256:'0'.repeat(64),corpusSha256:'1'.repeat(64)}; // inert scorer metadata, NOT source identity
const artifact={candidateId:'FORMAT-ONLY-NO-CANDIDATE',...hashes,predictions:dev.map(row=>({id:row.id,status:'blocked',reasonCategory:'detector_failure',detections:[]}))};
const options={protocol,cases:dev,split:'dev',artifact,...hashes};
test('existing dev projects exact input with gold excluded and remains diagnostic when all blocked',()=>{
 assert.doesNotThrow(()=>validateCases(dev,{protocol,split:'dev'}));
 for(const row of dev){const input=projectPrivacyCase(row);assert.deepEqual(Object.keys(input).sort(),['operational','scope','segments']);for(const key of ['id','entities','blockReason','preserve','expectedStatus','split','templateGroup'])assert.ok(!Object.hasOwn(input,key));const changed={...row,entities:[],preserve:[],expectedStatus:'anything',blockReason:'anything',id:'different',templateGroup:'different'};assert.deepEqual(projectPrivacyCase(changed),input);}
 const result=scorePredictions(options);assert.equal(result.version,2);assert.equal(result.split,'dev');assert.equal(result.experimentalGate.status,'diagnostic-only');assert.equal(result.experimentalGate.minimumsApplied,false);
 assert.deepEqual(verifyDetectorEligibility({}),{eligible:false,reason:'missing_record'});
});
test('scorer rejects unknown categories, malformed UTF16 ranges, extra fields and wrong reason format',()=>{
 const row=dev.find(r=>r.segments.some(s=>s.text.length>=2));const segment=row.segments.find(s=>s.text.length>=2);
 for(const detection of [{segmentId:segment.id,start:0,end:1,category:'Dato1'},{segmentId:segment.id,start:-1,end:1,category:'person'},{segmentId:'foreign',start:0,end:1,category:'person'}]){
  const candidate=structuredClone(artifact);candidate.predictions.find(p=>p.id===row.id).detections=[detection];assert.throws(()=>validatePredictionArtifact(candidate,options));
 }
 const candidate=structuredClone(artifact);candidate.predictions[0].reasonCategory='unknown';assert.throws(()=>validatePredictionArtifact(candidate,options));
 const extra=structuredClone(artifact);extra.predictions[0].rawText='not allowed';assert.throws(()=>validatePredictionArtifact(extra,options));
 const input=projectPrivacyCase(dev[0]);assert.throws(()=>validateOperationalInput({...input,entities:[]}));
 const oversized=structuredClone(input);oversized.segments[0].text='x'.repeat(7001);assert.throws(()=>validateOperationalInput(oversized));
 const cases=structuredClone(dev);const first=cases[0];first.entities=[];first.preserve=[];first.segments[0].text='🚢 Consulta ficticia.';
 const bad=structuredClone(artifact);bad.predictions[0].detections=[{segmentId:first.segments[0].id,start:1,end:2,category:'person'}];
 assert.throws(()=>validatePredictionArtifact(bad,{...options,cases}));
});
test('current extraction normalizes text and cannot be the original-offset candidate adapter',async()=>{
 const text='  Consulta ficticia\r\ncon dato\u0000 y condición.  ';const extracted=await extractDocument('entrada.txt',Buffer.from(text).toString('base64'));
 assert.notEqual(extracted.text,text);assert.equal(extracted.text,'Consulta ficticia\ncon dato y condición.');
});
test('ALARM, not a freeze: new core transitive imports require review with the delta',async()=>{
 const expected=['server/canonical-json.mjs','server/extraction.mjs','server/intake-import.mjs','server/pilot-trade-scenario.mjs','server/privacy/detector-variants.mjs','server/privacy/detector.mjs','server/privacy/intake-context-review.mjs','server/privacy/intake-document-review.mjs','server/privacy/intake-windows.mjs','server/privacy/local-reader-status.mjs','server/privacy/matter-reservations.mjs','server/privacy/origin-evidence.mjs','server/privacy/provenance.mjs','server/privacy/pseudonyms.mjs','server/privacy/shipment-context.mjs','server/privacy/trade-document-structure.mjs','server/privacy/trade-site-description.mjs'];
 const seen=new Set();async function visit(file){if(seen.has(file))return;seen.add(file);const source=await readFile(new URL(file,root),'utf8');for(const match of source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/gu)){if(match[1].startsWith('.')){const relative=path.posix.normalize(path.posix.join(path.posix.dirname(file),match[1]));if(relative.endsWith('.mjs'))await visit(relative);}}}
 await visit('server/intake-import.mjs');assert.deepEqual([...seen].sort(),expected);
});
