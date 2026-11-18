// Verifies that a detector evaluation record really covers the code that is about to run.
// Only the v2 operational protocol (eval/privacy-v2, id privacy-eval-v2-operational-1) is accepted. The v1 tree
// and every v1 record are retired and always fail. The record is the v2 scorer's own report for split heldout
// (scripts/eval-privacy-v2.mjs). Binding is by hash: candidate version, source-file hashes, protocol hash, corpus
// hash from the manifest. Gate floors are ALSO hardcoded here, so editing the protocol cannot loosen them.
// Records are NOT signed: whoever can write the repo can forge one, so the real control is that the record
// is a reviewed commit. The reserved heldout file is only hashed, and only after a record already matched
// everything else; it is never parsed or scored here. Any mismatch fails closed with a fixed code.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';

export const CORE_SOURCES = Object.freeze(['server/privacy/detector.mjs', 'server/privacy/provenance.mjs', 'server/canonical-json.mjs']);
export const EVAL_TREE = 'eval/privacy-v2';
export const PROTOCOL_ID = 'privacy-eval-v2-operational-1';
const MIN_HELDOUT_CASES = 300;
const digest = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function verifyDetectorEligibility({root, detectorVersion, extraSources = [], record} = {}) {
 const no = reason => ({eligible:false, reason});
 try {
  if (typeof root !== 'string' || typeof detectorVersion !== 'string' || !object(record)) return no('missing_record');
  if (record.retiredForFutureTuning === true) return no('record_retired');
  const score = record.score, execution = record.execution;
  if (!object(score) || !object(execution)) return no('malformed_record');
  if (score.version !== 2 || !object(score.correctBlockReason)) return no('record_not_v2');
  if (score.split !== 'heldout' || score.candidateId !== detectorVersion || execution.candidateVersion !== detectorVersion) return no('candidate_mismatch');
  const gate = score.experimentalGate;
  if (!object(gate) || gate.status !== 'eligible-for-integration-evaluation' || gate.minimumsApplied !== true ||
   !Array.isArray(gate.failures) || gate.failures.length || !Array.isArray(gate.minimumFailures) || gate.minimumFailures.length) return no('gate_not_passed');
  const block = score.correctBlockReason;
  if (!Number.isInteger(block.denominator) || block.denominator < 1 || block.rate !== 1) return no('block_reason_rate');
  const protocol = JSON.parse(readFileSync(path.join(root, EVAL_TREE, 'protocol.json'), 'utf8'));
  const gates = protocol.experimentalGates, rules = protocol.corpusRules;
  if (protocol.id !== PROTOCOL_ID || protocol.version !== 2 || !object(gates) || !object(rules)) return no('wrong_protocol');
  // Floors that a protocol edit must not be able to weaken, independent of the hash.
  if (gates.mandatoryExactRecall !== 1 || !(gates.otherCategoryExactRecallMinimum >= 0.95) || !(gates.exactPrecisionMinimumPerCategory >= 0.9) ||
   !(gates.cleanCompleteRateMinimum >= 0.9) || gates.requiredBlockedStatusRate !== 1 || gates.requiredCorrectBlockReasonRate !== 1 ||
   gates.minimumDenominatorsMustPass !== true || gates.blockedEntityCasesStillCountAsMisses !== true || !(rules.heldoutCaseCount >= MIN_HELDOUT_CASES)) return no('gates_weakened');
  const manifest = JSON.parse(readFileSync(path.join(root, EVAL_TREE, 'manifest.json'), 'utf8'));
  if (manifest.version !== 2 || score.protocolSha256 !== digest(path.join(root, EVAL_TREE, 'protocol.json')) || manifest.protocol?.sha256 !== score.protocolSha256) return no('protocol_changed');
  const sources = [...new Set([...CORE_SOURCES, ...extraSources])];
  const recorded = execution.sourceHashes;
  if (!object(recorded) || Object.keys(recorded).length < sources.length) return no('sources_not_recorded');
  for (const file of sources) if (recorded[file] !== digest(path.join(root, file))) return no('detector_changed');
  if (score.corpusSha256 !== manifest.splits?.heldout?.sha256 || digest(path.join(root, EVAL_TREE, manifest.splits.heldout.file)) !== score.corpusSha256) return no('corpus_changed');
  return {eligible:true, reason:null, candidateId:detectorVersion};
 } catch { return no('verification_failed'); }
}
