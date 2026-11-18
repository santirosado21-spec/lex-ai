// Pseudonymized cloud route: local detection -> local pseudonym map -> egress gate -> remote model -> local restore.
// Off unless every piece is supplied, a detector evaluation record verifies against the running code, AND the owner has granted that exact scope. Fail closed at each step:
// nothing is sent when detection is incomplete, any identifier remains after protection, the scope or
// provenance differs, no grant exists, the grant changes mid-call, or the detector has no validated attestation.
// Pseudonymization is NOT anonymization: structure, dates, amounts and context may still identify a person.
import {createEgressPolicy} from './egress-policy.mjs';
import {canonicalJson} from './canonical-json.mjs';
import {privacyTextHash, segmentsFromEnvelope, validPrivacyScope, createProvenanceRegistry} from './privacy/provenance.mjs';
import {createLocalPrivacyDetector} from './privacy/detector.mjs';
import {createVariantAwareDetector} from './privacy/detector-variants.mjs';
import {verifyDetectorEligibility} from './privacy/eligibility.mjs';

const failure = code => Object.assign(new Error('Ruta de nube no disponible para esta solicitud.'), {name:'CloudRouteError', code});
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(value);
const MARKER = /\[\[LEX_[a-f0-9]{32}_[a-f0-9]{32}\]\]/g;

/** Owner grants, visible and revocable. In memory only: persistence is a separate, explicit step. */
export function createCloudGrants() {
 const grants = new Map();
 let version = 0;
 const key = (scope, destination) => canonicalJson([scope.workspaceId, scope.matterId, scope.threadId, destination]);
 const check = (scope, destination) => { if (!validPrivacyScope(scope) || !identifier(destination)) throw failure('invalid_request'); };
 return Object.freeze({
  grant(scope, destination) { check(scope, destination); grants.set(key(scope, destination), {scope:{...scope}, destination}); version += 1; },
  revoke(scope, destination) { check(scope, destination); if (grants.delete(key(scope, destination))) version += 1; },
  list() { return [...grants.values()].map(item => ({scope:{...item.scope}, destination:item.destination, allowedCategories:['pseudonymized']})); },
  policy() { return {version:`G${version}`, grants:this.list()}; },
 });
}

function entitiesFor(segments, detections) {
 const found = [];
 for (const segment of segments) {
  const ranges = detections.filter(item => item.segmentId === segment.id).sort((a, b) => a.start - b.start || a.end - b.end), merged = [];
  for (const range of ranges) {
   const previous = merged.at(-1);
   if (previous && range.start < previous.end) previous.end = Math.max(previous.end, range.end); else merged.push({...range});
  }
  found.push(...merged.map(range => segment.text.slice(range.start, range.end)));
 }
 return [...new Set(found)];
}

// The route builds the detector itself from this closed list: a caller cannot hand in a lookalike object
// that claims a validated version. Eligibility is re-verified on every request against the files on disk.
const DETECTORS = Object.freeze({
 baseline:{create:createLocalPrivacyDetector, extraSources:[]},
 variants:{create:createVariantAwareDetector, extraSources:['server/privacy/detector-variants.mjs']},
});

export function createPseudonymizedCloudRoute({detector:detectorName = 'baseline', pseudonyms, provider, grants, destination = 'openai', evaluation = null} = {}) {
 const entry = Object.hasOwn(DETECTORS, detectorName) ? DETECTORS[detectorName] : null;
 if (!entry || typeof pseudonyms?.protect !== 'function' || typeof provider?.generate !== 'function' || typeof grants?.policy !== 'function' || !identifier(destination)) throw failure('invalid_configuration');
 const provenance = createProvenanceRegistry();
 const detector = entry.create({provenanceRegistry:provenance});
 const eligibility = () => evaluation ? verifyDetectorEligibility({root:evaluation.root, detectorVersion:detector.version, extraSources:entry.extraSources, record:evaluation.record}) : {eligible:false, reason:'missing_record'};
 let validated = eligibility().eligible;
 const pending = new Map();
 let sequence = 0;
 const gate = createEgressPolicy({destinations:{[destination]:provider}, getPolicy:() => grants.policy(), classify:async input => {
  const state = pending.get(input.serialized);
  const base = {scope:input.scope, destination:input.destination, policyVersion:input.policyVersion, serialized:input.serialized, category:'pseudonymized'};
  if (!state || !eligibility().eligible) return {...base, reliable:false, scopeVerified:false};
  // Only the exact markers of this matter's active map may remain; anything else reserved is a leak or forgery.
  let snapshot;
  try { snapshot = pseudonyms.exportSnapshot({scope:input.scope}); } catch { return {...base, reliable:false, scopeVerified:false}; }
  const known = new Set(snapshot.entries.map(entry => entry.marker));
  const envelope = JSON.parse(input.serialized);
  const mask = canonicalJson(envelope).replace(MARKER, found => known.has(found) ? 'MARKER' : found);
  if (mask.includes('[[LEX_')) return {...base, reliable:false, scopeVerified:false};
  const masked = JSON.parse(mask);
  const derived = provenance.deriveSource({objectId:`PREP_${(sequence += 1)}`, version:'v1', scope:input.scope, classification:'private', parents:[state.reference],
   extraction:{status:'complete', extractorVersion:'protection-v1', originalSha256:privacyTextHash(mask)}, segments:segmentsFromEnvelope(masked)});
  const final = await detector.detect({scope:input.scope, segments:derived.segments, signal:state.signal});
  return {...base, reliable:final.status === 'complete' && final.detections.length === 0, scopeVerified:state.scopeKey === canonicalJson(input.scope)};
 }});
 return Object.freeze({
  get audit() { return gate.audit; },
  status() { validated = eligibility().eligible; return {cloud:validated && provider.status?.().state === 'configured', destination, detectorValidated:validated, grants:grants.list(), provider:provider.status?.() ?? null}; },
  /** messages: [{role,content}] with local private text. Yields ONE restored string. */
  async *ask({scope, messages, signal}) {
   if (!validPrivacyScope(scope) || !Array.isArray(messages) || signal !== undefined && !(signal instanceof AbortSignal)) throw failure('invalid_request');
   validated = eligibility().eligible;
   if (!validated) throw failure('detector_not_validated');
   if (!grants.list().some(item => item.destination === destination && canonicalJson(item.scope) === canonicalJson(scope))) throw failure('cloud_not_granted');
   const envelope = {version:1, responseFormat:'text', messages};
   let serialized;
   try { serialized = canonicalJson(envelope); } catch { throw failure('invalid_request'); }
   if (messages.some(message => !message || Object.keys(message).some(name => !['role','content'].includes(name)))) throw failure('invalid_request');
   const source = provenance.registerSource({objectId:`SRC_${(sequence += 1)}`, version:'v1', scope, classification:'private',
    extraction:{status:'complete', extractorVersion:'canonical-envelope-v1', originalSha256:privacyTextHash(serialized)}, segments:segmentsFromEnvelope(envelope)});
   const initial = await detector.detect({scope, segments:source.segments, signal});
   if (initial.status !== 'complete') throw failure(`blocked_${initial.reasonCategory}`);
   const entities = entitiesFor(source.segments, initial.detections);
   const protectedData = pseudonyms.protect({scope, messages, entities});
   const prepared = {version:1, responseFormat:'text', messages:protectedData.messages};
   const pinned = canonicalJson(prepared);
   pending.set(pinned, {reference:source.reference, scopeKey:canonicalJson(scope), signal});
   const chunks = [];
   try {
    for await (const chunk of gate.generate(protectedData.messages, {scope, destination, responseFormat:'text', signal})) chunks.push(chunk);
   } finally { pending.delete(pinned); }
   // restore rejects unknown or fabricated markers: a tampered answer never reaches the user.
   yield pseudonyms.restore({scope, text:chunks.join(''), mappingVersion:protectedData.mappingVersion});
  },
 });
}
