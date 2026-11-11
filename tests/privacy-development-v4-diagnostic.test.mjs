// DIAGNOSTIC-ONLY harness: frozen v2 segment states (privacy-eval-v2-annotation-2,
// extractionStatus/assessment) through the REAL adapted local candidate path on the
// development corpus eval/privacy-development-v4. Development evidence only: NOT a
// scored run under eval/privacy/protocol.json, never gate, heldout, safe-egress or
// pilot evidence. The frozen v2 contract files are NOT in this repository; this test
// only exercises the additive, not-activated runner support. Synthetic content.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {validateCases} from '../scripts/eval-privacy.mjs';
import {projectPrivacyCase,startCandidateWorker} from '../scripts/run-privacy-detector.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const load=async relative=>JSON.parse(await readFile(path.join(root,relative),'utf8'));

// DEV4 carries v2-only segment states: it validates against the FROZEN v2 contract
// (eval/privacy/protocol-v2.json), never against v1 (v1 rejects state fields).
const protocol=await load('eval/privacy/protocol-v2.json');
const corpusBytes=await readFile(path.join(root,'eval/privacy-development-v4/cases.jsonl'));
const rows=corpusBytes.toString('utf8').trimEnd().split('\n').map(line=>JSON.parse(line));

test('diagnostic: DEV4 corpus validates under the frozen v2 contract',()=>{
 const {coverage}=validateCases(rows,{protocol,split:'dev'});
 assert.equal(coverage.cases,16);
 assert.deepEqual(coverage.blocked,{scope_mismatch:0,unknown_provenance:0,unsupported_format:3,partial_extraction:3,ambiguous_context:3,detector_failure:3});
 assert.equal(coverage.cleanCases,4);
});

test('diagnostic: DEV4 corpus hash matches its provenance record',async()=>{
 const provenance=await load('eval/privacy-development-v4/provenance.json');
 assert.equal(createHash('sha256').update(corpusBytes).digest('hex'),provenance.casesSha256);
});

test('diagnostic: adapted candidate maps every v2 operational state to its expected blocked reason',async()=>{
 const worker=startCandidateWorker();
 try{
  const {results}=await worker.request(rows.map(projectPrivacyCase));
  assert.equal(results.length,rows.length);
  for(const [index,row] of rows.entries()){
   assert.equal(results[index].status,row.expectedStatus,`${row.id} status`);
   if(row.expectedStatus==='blocked')assert.equal(results[index].reasonCategory,row.blockReason,`${row.id} reason`);
  }
 }finally{await worker.close();}
});

test('diagnostic: detections survive operational blocks at exact gold spans',async()=>{
 const worker=startCandidateWorker();
 try{
  const {results}=await worker.request(rows.map(projectPrivacyCase));
  for(const [index,row] of rows.entries()){
   const detections=results[index].detections;
   assert.equal(detections.length,row.entities.length,`${row.id} detection count`);
   for(const entity of row.entities)
    assert.ok(detections.some(d=>d.segmentId===entity.segmentId&&d.start===entity.start&&d.end===entity.end&&d.category===entity.category),
     `${row.id} must keep ${entity.category} at ${entity.start}-${entity.end}`);
  }
 }finally{await worker.close();}
});

test('diagnostic: v1 regression - adapted harness leaves v1 dev projections without state fields',async()=>{
 const v1=(await readFile(path.join(root,'eval/privacy/dev.jsonl'),'utf8')).trimEnd().split('\n').map(line=>JSON.parse(line));
 for(const row of v1){
  const projected=projectPrivacyCase(row);
  for(const segment of projected.segments){
   assert.ok(!('extractionStatus' in segment),'v1 segments gain no extractionStatus');
   assert.ok(!('assessment' in segment),'v1 segments gain no assessment');
  }
 }
});
