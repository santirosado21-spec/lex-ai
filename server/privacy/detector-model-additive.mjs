// Additive local-model composition for the cloud route. Rules/variants run first. The local model (an injected
// backend with the existing token-NER contract) may only ADD spans or BLOCK; it can never remove or shrink a rule span.
// Any model error, timeout, abort, invalid output, late answer, or an uncovered kind we cannot map blocks the text.
// This module loads no weights and starts no runtime: the caller supplies the backend. Without a real backend the
// route simply has no usable detector. Diagnostic spans here grant nothing; egress still needs an eligible record.
import {createVariantAwareDetector} from './detector-variants.mjs';
import {validateNativeOutput} from './token-ner-composition-v2.mjs';

export const MODEL_ADDITIVE_VERSION = 'variants-plus-local-token-ner-additive-v1';
const KIND_TO_CATEGORY = Object.freeze({GIVEN_NAME:'person', SURNAME:'person', EMAIL:'email', PHONE:'phone', BANK_ACCOUNT:'account',
 BUILDING_NUMBER:'address', STREET_NAME:'address', SECONDARY_ADDRESS:'address', ZIP_CODE:'address'});
const TIMEOUT_MAX = 15000;
const blocked = (reasonCategory, detections = []) => ({status:'blocked', reasonCategory, detections});

export function createModelAdditiveDetector({provenanceRegistry, backend, timeoutMs = TIMEOUT_MAX} = {}) {
 if (typeof backend?.detect !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > TIMEOUT_MAX) throw new Error('invalid_backend');
 const rules = createVariantAwareDetector({provenanceRegistry});
 return Object.freeze({
  version: MODEL_ADDITIVE_VERSION,
  async detect(input) {
   const base = await rules.detect(input);
   if (base.status !== 'complete') return base;
   const signal = input?.signal;
   const texts = (input?.segments ?? []).map(segment => ({id:segment.id, text:segment.text}));
   if (signal !== undefined && !(signal instanceof AbortSignal) || signal?.aborted || !texts.length || texts.some(t => typeof t.text !== 'string' || !t.text.isWellFormed())) return blocked('detector_failure', base.detections);
   const controller = new AbortController();
   let timer, onAbort;
   try {
    const stopped = new Promise((_, reject) => {
     onAbort = () => { controller.abort(); reject(new Error('stopped')); };
     signal?.addEventListener('abort', onAbort, {once:true});
     timer = setTimeout(onAbort, timeoutMs);
    });
    const output = await Promise.race([backend.detect({segments:texts}, {signal:controller.signal}), stopped]);
    if (controller.signal.aborted || signal?.aborted) return blocked('detector_failure', base.detections);
    if (output?.status === 'blocked') return blocked(output.reasonCategory === 'ambiguous_context' ? 'ambiguous_context' : 'detector_failure', base.detections);
    const native = validateNativeOutput(output, texts);
    const added = [];
    for (const span of native) {
     const category = KIND_TO_CATEGORY[span.kind];
     if (category) { added.push({segmentId:span.segmentId, start:span.start, end:span.end, category}); continue; }
     // A kind we cannot map to a category is kept only if an existing rule span already covers it entirely.
     if (!base.detections.some(d => d.segmentId === span.segmentId && d.start <= span.start && d.end >= span.end)) return blocked('ambiguous_context', base.detections);
    }
    const merged = new Map([...base.detections, ...added].map(d => [`${d.segmentId}:${d.start}:${d.end}:${d.category}`, d]));
    return {...base, detections:[...merged.values()].sort((a, b) => a.segmentId.localeCompare(b.segmentId) || a.start - b.start || a.end - b.end)};
   } catch { return blocked('detector_failure', base.detections); }
   finally { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); }
  },
 });
}
