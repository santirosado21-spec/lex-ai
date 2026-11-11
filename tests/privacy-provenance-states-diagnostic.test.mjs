// DIAGNOSTIC-ONLY harness: provenance extraction/assessment states vs detector status.
// These tests are development evidence. They do NOT score under eval/privacy/protocol.json,
// do NOT feed experimental gates, and are NOT eligibility, safe-egress or pilot evidence.
// They exist because the frozen dev corpus carries no per-segment extraction/assessment
// fields, leaving 4 of 6 block reasons unevaluable in the official fixture (see
// docs/proposals/privacy-fixture-estados-extraccion-2026-11-11.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalPrivacyDetector} from '../server/privacy/detector.mjs';
import {createProvenanceRegistry,privacyTextHash} from '../server/privacy/provenance.mjs';

const scope={workspaceId:'DIAG_FIRM',matterId:'DIAG_MATTER',threadId:'DIAG_THREAD'};
const other={workspaceId:'DIAG_FIRM',matterId:'DIAG_OTHER',threadId:'DIAG_THREAD'};
const person='Bruna Sintética Diagnóstico';

// Registers one synthetic segment with the given provenance states, then runs the real
// detector against the real registry. Mirrors privacy-candidate-worker.mjs but lets the
// case declare extraction/assessment instead of fixing them to complete/known.
function diagnose({text='Texto sintético sin entidades.',extractionStatus='complete',assessment='known',originScope=scope,classification='synthetic',requestScope=scope}) {
 const registry=createProvenanceRegistry();
 const segment={id:'SEG0',path:'content',text};
 const handle=registry.registerSource({objectId:'diag-0',version:'v1',scope:originScope,classification,
  extraction:{status:extractionStatus,extractorVersion:'diagnostic-fixture-v1',originalSha256:privacyTextHash(text)},
  segments:[segment],assessment}).segments[0];
 return createLocalPrivacyDetector({provenanceRegistry:registry}).detect({scope:requestScope,segments:[handle]});
}

test('diagnostic: complete/known synthetic segment without entities stays complete',async()=>{
 const result=await diagnose({});
 assert.equal(result.status,'complete');
 assert.equal(result.reasonCategory,null);
 assert.deepEqual(result.detections,[]);
});

test('diagnostic: scope_mismatch and unknown_provenance block and still scan (v4 contract)',async()=>{
 const mismatch=await diagnose({text:`Constancia de ${person}.`,originScope:other});
 assert.equal(mismatch.status,'blocked');
 assert.equal(mismatch.reasonCategory,'scope_mismatch');
 assert.ok(mismatch.detections.some(d=>d.category==='person'),'blocked segment must still yield detection evidence');
 const unknown=await diagnose({text:`Constancia de ${person}.`,classification:'unknown'});
 assert.equal(unknown.status,'blocked');
 assert.equal(unknown.reasonCategory,'unknown_provenance');
 assert.ok(unknown.detections.some(d=>d.category==='person'));
});

test('diagnostic: extraction states map to their frozen block reasons',async()=>{
 assert.equal((await diagnose({extractionStatus:'unsupported'})).reasonCategory,'unsupported_format');
 assert.equal((await diagnose({extractionStatus:'partial'})).reasonCategory,'partial_extraction');
 assert.equal((await diagnose({extractionStatus:'failed'})).reasonCategory,'detector_failure');
});

test('diagnostic: assessment states map to their frozen block reasons',async()=>{
 assert.equal((await diagnose({assessment:'ambiguous'})).reasonCategory,'ambiguous_context');
 assert.equal((await diagnose({assessment:'failed'})).reasonCategory,'detector_failure');
});

test('diagnostic: detection evidence survives a partial_extraction block',async()=>{
 const result=await diagnose({text:`Constancia de ${person}.`,extractionStatus:'partial'});
 assert.equal(result.status,'blocked');
 assert.equal(result.reasonCategory,'partial_extraction');
 const hit=result.detections.find(d=>d.category==='person');
 assert.ok(hit);
 // The v4 person rule may absorb the leading capitalized connector context; the
 // declared identity must be inside the reported range.
 assert.ok('Constancia de Bruna Sintética Diagnóstico.'.slice(hit.start,hit.end).includes(person));
});
