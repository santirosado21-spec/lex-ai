// v2 protocol support (frozen privacy-eval-v2-annotation-2) — validation-logic tests.
// Adapted from the independent auditor's proposed suite: same checks, repo-relative
// imports, self-contained scorer equivalence (v1 vs v2 through the SAME module), and
// cleanup of the temporary v2 manifest copy. All inputs are synthetic constructions
// for validation-logic testing only: no heldout, no dev corpus content, no exam material.
// Gates and primary scoring are NOT modified by the v2 support; these tests prove it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,copyFile,unlink} from 'node:fs/promises';
import {validateProtocol,validateCases,validateCorpus,scorePredictions} from '../scripts/eval-privacy.mjs';
import {assertCandidateFreeze,candidateSourceHashes,CANDIDATE_ID} from '../scripts/run-privacy-detector.mjs';

const protocolV1=JSON.parse(await readFile(new URL('../eval/privacy/protocol.json',import.meta.url),'utf8'));
const protocolV2=JSON.parse(await readFile(new URL('../eval/privacy/protocol-v2.json',import.meta.url),'utf8'));
const SCOPE={workspaceId:'W1',matterId:'M1',threadId:'T1'};
const seg=(id,extra={})=>({id,path:'content',text:`texto sintetico ${id} sin entidades`,originScope:{...SCOPE},classification:'synthetic',...extra});
const kase=(id,segments,expectedStatus,blockReason,split='heldout')=>({id,split,templateGroup:`TG-${id}`,synthetic:true,scope:{...SCOPE},segments:segments.map((s,i)=>({...s,id:`${id}-S${i}`,text:`texto sintetico ${id}-${i} sin entidades`})),entities:[],expectedStatus,blockReason,preserve:[]});
const stripStates=row=>({...row,segments:row.segments.map(({id,path,text,originScope,classification})=>({id,path,text,originScope,classification}))});

test('validateProtocol: v1 accepted unchanged, v2 frozen accepted, others rejected',()=>{
  assert.ok(validateProtocol(protocolV1));
  assert.ok(validateProtocol(protocolV2));
  assert.throws(()=>validateProtocol({...protocolV2,version:3}),/Unsupported protocol/);
  assert.throws(()=>validateProtocol({...protocolV2,corpusRules:{...protocolV2.corpusRules,heldoutOperationalStateCoverage:undefined}}),/operational state coverage/);
  assert.throws(()=>validateProtocol({...protocolV2,annotationGuideRef:''}),/annotation guide reference/);
  const noCaseRules=JSON.parse(JSON.stringify(protocolV2));delete noCaseRules.caseContract.blockingConditionUniqueness;
  assert.throws(()=>validateProtocol(noCaseRules),/case contract rule/);
});

test('v2 cases: conforming operational states validate',()=>{
  const cases=[
    kase('C1',[seg('S1')],'complete',null),
    kase('B1',[seg('S1',{extractionStatus:'partial'})],'blocked','partial_extraction'),
    kase('B2',[seg('S1',{extractionStatus:'partial'}),seg('S2',{extractionStatus:'partial'})],'blocked','partial_extraction'), // same reason twice: allowed
    kase('B3',[seg('S1',{extractionStatus:'unsupported'})],'blocked','unsupported_format'),
    kase('B4',[seg('S1',{assessment:'ambiguous'})],'blocked','ambiguous_context'),
    kase('B5',[seg('S1',{extractionStatus:'failed'})],'blocked','detector_failure'),
  ];
  assert.doesNotThrow(()=>validateCases(cases,{protocol:protocolV2,split:'heldout'}));
});

test('v2 cases: uniqueness and defaults enforced fail-closed',()=>{
  const bad=[
    ['partial + unsupported = two reasons',kase('X1',[seg('S1',{extractionStatus:'partial'}),seg('S2',{extractionStatus:'unsupported'})],'blocked','partial_extraction')],
    ['blocked reason without the state',kase('X2',[seg('S1')],'blocked','partial_extraction')],
    ['state mismatches declared reason',kase('X3',[seg('S1',{extractionStatus:'partial'})],'blocked','unsupported_format')],
    ['complete case with non-default state',kase('X4',[seg('S1',{extractionStatus:'partial'})],'complete',null)],
    ['reserved assessment=failed barred',kase('X5',[seg('S1',{assessment:'failed'})],'blocked','detector_failure')],
    ['scope condition + state = two reasons',kase('X6',[seg('S1',{originScope:{workspaceId:'W9',matterId:'M9',threadId:'T9'},extractionStatus:'partial'})],'blocked','scope_mismatch')],
  ];
  for(const [label,row] of bad)assert.throws(()=>validateCases([row],{protocol:protocolV2,split:'heldout'}),null,label);
});

test('v1 protocol rejects v2-only segment state fields (tightening)',()=>{
  assert.throws(()=>validateCases([kase('V1',[seg('S1',{extractionStatus:'partial'})],'blocked','partial_extraction','dev')],{protocol:protocolV1,split:'dev'}),/requires protocol version 2/);
  assert.doesNotThrow(()=>validateCases([kase('V2',[seg('S1')],'complete',null,'dev')],{protocol:protocolV1,split:'dev'}));
});

test('v2 heldout operational coverage counted against minimums',()=>{
  const dev=[kase('D1',[seg('S1')],'complete',null,'dev')];
  // heldout below every minimum; operational reasons must be named distinctly
  const heldout=[kase('H1',[seg('S1',{extractionStatus:'partial'})],'blocked','partial_extraction')];
  const {heldoutMinimumFailures}=validateCorpus({protocol:protocolV2,splits:{dev,heldout}});
  for(const reason of ['unsupported_format','partial_extraction','ambiguous_context','detector_failure'])
    assert.ok(heldoutMinimumFailures.includes(`operationalState:${reason}`),`missing operationalState:${reason}`);
});

test('scorer: stratified report added; gates and verdict identical between protocols in the same module',()=>{
  const cases=[
    kase('C1',[seg('S1')],'complete',null,'dev'),
    kase('B1',[seg('S1',{extractionStatus:'partial'})],'blocked','partial_extraction','dev'),
  ];
  const artifact={candidateId:'auditor-synthetic',protocolSha256:'0'.repeat(64),corpusSha256:'1'.repeat(64),
    predictions:[{id:'C1',status:'complete',detections:[]},{id:'B1',status:'blocked',detections:[]}]};
  const base={split:'dev',artifact,protocolSha256:'0'.repeat(64),corpusSha256:'1'.repeat(64)};
  const patched=scorePredictions({...base,protocol:protocolV2,cases});
  // Same module, same cases minus v2-only fields, frozen v1 protocol: gate and
  // primary metrics must be identical — v2 additions never move the verdict.
  const pristine=scorePredictions({...base,protocol:protocolV1,cases:cases.map(stripStates)});
  assert.deepEqual(patched.stratifiedByExpectedStatus.completeOnly.fn,0);
  assert.ok(patched.stratifiedByExpectedStatus.blockedOnly.recallInsufficient);
  assert.equal(patched.experimentalGate.status,pristine.experimentalGate.status);
  assert.deepEqual(patched.experimentalGate.failures,pristine.experimentalGate.failures);
  assert.deepEqual(patched.metrics,pristine.metrics); // scorer math untouched
  assert.equal(patched.cleanComplete.rate,pristine.cleanComplete.rate);
  assert.equal(patched.blockedStatus.rate,pristine.blockedStatus.rate);
});

test('freeze: manifest binding fails closed; v1 freeze gains manifest field',async()=>{
  const sourceHashes=await candidateSourceHashes();
  const manifest=JSON.parse(await readFile(new URL('../eval/privacy/manifest.json',import.meta.url),'utf8'));
  const freeze={candidateId:CANDIDATE_ID,approvedForSingleHeldoutRun:true,productionEnabled:false,manifest:'manifest.json',sourceHashes,
    protocolSha256:manifest.protocol.sha256,heldoutSha256:manifest.splits.heldout.sha256};
  // A versioned v2 manifest file (separate, v1 untouched) so the binding check itself is exercised.
  const v2url=new URL('../eval/privacy/manifest-v2.json',import.meta.url);
  await copyFile(new URL('../eval/privacy/manifest.json',import.meta.url),v2url);
  try{
    await assertCandidateFreeze(freeze,'manifest.json');
    await assert.rejects(assertCandidateFreeze(freeze,'manifest-v2.json'),/candidate_not_frozen/); // freeze names another file
    await assertCandidateFreeze({...freeze,manifest:'manifest-v2.json'},'manifest-v2.json'); // matching v2 binding passes
    const noBinding={...freeze};delete noBinding.manifest;
    await assert.rejects(assertCandidateFreeze(noBinding,'manifest.json'),/candidate_not_frozen/); // legacy shape without binding rejected
    await assert.rejects(assertCandidateFreeze({...freeze,manifest:'manifest-v2.json'},'manifest.json'),/candidate_not_frozen/);
  }finally{await unlink(v2url).catch(()=>{});}
});
