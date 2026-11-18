// Verifies that a detector evaluation record really covers the code that is about to run.
// The record is the scorer's own output (scripts/eval-privacy.mjs, split heldout). Binding is by hash:
// candidate version, source-file hashes, protocol hash (which holds the thresholds) and the corpus hash
// recorded in the manifest. Records are NOT signed: whoever can write the repo can forge one, so the
// real control is that the record is a reviewed commit. Any mismatch fails closed with a fixed code.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';

export const CORE_SOURCES = Object.freeze(['server/privacy/detector.mjs', 'server/privacy/provenance.mjs', 'server/canonical-json.mjs']);
const digest = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function verifyDetectorEligibility({root, detectorVersion, extraSources = [], record} = {}) {
 const no = reason => ({eligible:false, reason});
 try {
  if (typeof root !== 'string' || typeof detectorVersion !== 'string' || !object(record)) return no('missing_record');
  if (record.retiredForFutureTuning === true) return no('record_retired');
  const score = record.score, execution = record.execution;
  if (!object(score) || !object(execution)) return no('malformed_record');
  if (score.split !== 'heldout' || score.candidateId !== detectorVersion || execution.candidateVersion !== detectorVersion) return no('candidate_mismatch');
  const gate = score.experimentalGate;
  if (!object(gate) || gate.status !== 'eligible-for-integration-evaluation' || gate.minimumsApplied !== true ||
   !Array.isArray(gate.failures) || gate.failures.length || !Array.isArray(gate.minimumFailures) || gate.minimumFailures.length) return no('gate_not_passed');
  const protocolFile = path.join(root, 'eval/privacy/protocol.json'), manifest = JSON.parse(readFileSync(path.join(root, 'eval/privacy/manifest.json'), 'utf8'));
  if (score.protocolSha256 !== digest(protocolFile) || manifest.protocol?.sha256 !== score.protocolSha256) return no('protocol_changed');
  if (score.corpusSha256 !== manifest.splits?.heldout?.sha256 || digest(path.join(root, 'eval/privacy', manifest.splits.heldout.file)) !== score.corpusSha256) return no('corpus_changed');
  const sources = [...new Set([...CORE_SOURCES, ...extraSources])];
  const recorded = execution.sourceHashes;
  if (!object(recorded) || Object.keys(recorded).length < sources.length) return no('sources_not_recorded');
  for (const file of sources) if (recorded[file] !== digest(path.join(root, file))) return no('detector_changed');
  return {eligible:true, reason:null, candidateId:detectorVersion};
 } catch { return no('verification_failed'); }
}
