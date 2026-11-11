import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {projectPrivacyCase,assertCandidateFreeze,candidateSourceHashes,CANDIDATE_ID,runCandidateBatch,startCandidateWorker} from '../scripts/run-privacy-detector.mjs';

test('candidate IPC excludes all answer labels, IDs and adversarial extra fields',()=>{
  const row={scope:{workspaceId:'A',matterId:'B',threadId:'C'},segments:[{id:'S',path:'content',text:'Texto sintético',originScope:{workspaceId:'A',matterId:'B',threadId:'C'},classification:'synthetic',assessment:'from-gold'}]};
  for(const field of ['id','split','templateGroup','synthetic','expectedStatus','blockReason','entities','preserve'])Object.defineProperty(row,field,{get(){throw Error('gold accessed');}});
  Object.defineProperty(row.scope,'expectedStatus',{get(){throw Error('nested gold accessed');},enumerable:true});
  Object.defineProperty(row.segments[0].originScope,'blockReason',{get(){throw Error('nested gold accessed');},enumerable:true});
  const result=projectPrivacyCase(row);
  assert.deepEqual(Object.keys(result),['scope','segments']);
  assert.deepEqual(Object.keys(result.segments[0]),['id','path','text','originScope','classification']);
  row.scope.matterId='MUTATED';row.segments[0].originScope.matterId='MUTATED';
  assert.equal(result.scope.matterId,'B');assert.equal(result.segments[0].originScope.matterId,'B');
});

test('isolated candidate executes real rules without gold and rejects overlapping IPC requests',async()=>{
  const scope={workspaceId:'A',matterId:'B',threadId:'C'};
  const input={scope,segments:[{id:'S',path:'content',text:'Correo ensayo@example.invalid',originScope:scope,classification:'synthetic'}]};
  const worker=startCandidateWorker();
  try{
    const pending=worker.request([input]);
    await assert.rejects(worker.request([input]),/unavailable/);
    const result=await pending;
    assert.equal(result.results[0].status,'complete');
    assert.ok(result.results[0].detections.some(item=>item.category==='email'));
    assert.ok(result.peakRssBytes>0);
  }finally{await worker.close();}
});

test('candidate process deadline rejects without inventing successful predictions',async()=>{
  await assert.rejects(runCandidateBatch([],{timeoutMs:1}),/timeout/);
});

test('heldout freeze rejects missing approval, changed source hashes and extra/missing sources',async()=>{
  const sourceHashes=await candidateSourceHashes();
  const manifest=JSON.parse(await readFile(new URL('../eval/privacy/manifest.json',import.meta.url),'utf8'));
  const freeze={candidateId:CANDIDATE_ID,approvedForSingleHeldoutRun:true,productionEnabled:false,sourceHashes,
    protocolSha256:manifest.protocol.sha256,heldoutSha256:manifest.splits.heldout.sha256};
  await assertCandidateFreeze(freeze);
  await assert.rejects(assertCandidateFreeze({...freeze,approvedForSingleHeldoutRun:false}));
  await assert.rejects(assertCandidateFreeze({...freeze,sourceHashes:{...sourceHashes,'evil.mjs':'0'.repeat(64)}}));
  await assert.rejects(assertCandidateFreeze({...freeze,sourceHashes:{...sourceHashes,'server/privacy/detector.mjs':'0'.repeat(64)}}));
  await assert.rejects(assertCandidateFreeze({...freeze,sourceHashes:{...sourceHashes,'server/canonical-json.mjs':'0'.repeat(64)}}));
  await assert.rejects(assertCandidateFreeze({...freeze,heldoutSha256:'0'.repeat(64)}));
});
