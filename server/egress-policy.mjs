// Opt-in H2 prototype. No production wiring, network, detector or tool execution.
import {canonicalJson} from './canonical-json.mjs';

const CATEGORIES = ['public', 'synthetic'];
const SCOPE_KEYS = ['workspaceId', 'matterId', 'threadId'];
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keysOnly = (value, keys) => object(value) && Object.keys(value).every(key => keys.includes(key));
const validScope = scope => keysOnly(scope, SCOPE_KEYS) && SCOPE_KEYS.every(key => identifier(scope[key]));
const sameScope = (a, b) => validScope(a) && validScope(b) && SCOPE_KEYS.every(key => a[key] === b[key]);
const freeze = value => {
 if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
 return value;
};
const copy = value => JSON.parse(canonicalJson(value));
const failure = code => Object.assign(new Error('Solicitud de salida bloqueada o interrumpida.'), {name:'EgressPolicyError', code});
const checkAbort = signal => { if (signal?.aborted) throw failure('cancelled'); };

async function classifyWithAbort(classify, input, signal) {
 checkAbort(signal);
 let abort;
 const cancelled = new Promise((_, reject) => {
  abort = () => reject(failure('cancelled'));
  signal?.addEventListener('abort', abort, {once:true});
 });
 try {
  return await Promise.race([Promise.resolve().then(() => { checkAbort(signal); return classify(input); }), cancelled]);
 } finally { signal?.removeEventListener('abort', abort); }
}

/**
 * Trusted application-owned ports, NEVER populated from documents or model output:
 * - destinations: closed registry of opaque IDs -> H1-compatible providers, bound at construction.
 * - getPolicy(): synchronous {version, grants:[{scope,destination,allowedCategories}]}.
 *   IDs/versions must be non-sensitive opaque application identifiers. No wildcard grants.
 * - classify(frozenInput): local async assessment of EVERY byte of `serialized`, including
 *   all history, metadata and schema. Return {serialized,scope,destination,policyVersion,
 *   reliable:true,scopeVerified:true,category:'public'|'synthetic'} only after checking both
 *   content classification and provenance against the authorized scope. This port does not
 *   implement detection; blindly echoing its input is only suitable for synthetic test doubles.
 *
 * generate(messages,{scope:{workspaceId,matterId,threadId},destination,...H1Options}) snapshots
 * input when consumption begins. Policy/classification are never accepted as request options.
 * All tools are disabled: message fields are role/content/metadata only. Tool results may be
 * inert metadata, still subject to whole-envelope classification; they cannot execute tools.
 * The gate owns no provider lifecycle. Initialize/stop mocks explicitly in the harness.
 * Revalidate before dispatch and stream advances. Already-dispatched bytes cannot be recalled.
 * Audit is in-memory, text-free metadata, not a durable/cryptographic audit log.
 */
export function createEgressPolicy({destinations = {}, getPolicy = () => null, classify} = {}) {
 const registry = new Map();
 for (const [id, provider] of Object.entries(destinations)) {
  if (!identifier(id) || typeof provider?.generate !== 'function') throw failure('invalid_configuration');
  registry.set(id, provider.generate.bind(provider));
 }
 const audit = [];
 const readPolicy = () => {
  let policy;
  try { policy = copy(getPolicy()); } catch { throw failure('policy_unavailable'); }
  if (!keysOnly(policy, ['version','grants']) || !identifier(policy.version) || !Array.isArray(policy.grants) ||
      policy.grants.some(grant => !keysOnly(grant, ['scope','destination','allowedCategories']) || !validScope(grant.scope) ||
       !identifier(grant.destination) || !Array.isArray(grant.allowedCategories) || !grant.allowedCategories.length ||
       grant.allowedCategories.some(category => !CATEGORIES.includes(category)))) throw failure('policy_unavailable');
  return policy;
 };
 return {
  get audit() { return structuredClone(audit); },
  async *generate(messages, options = {}) {
   let category = 'unclassified', scope = null, destination = null, policyVersion = null;
   let result = 'invalid_request', signal, iterator, completed = false;
   try {
    // Separate the non-JSON AbortSignal without invoking request getters.
    if (!keysOnly(options, ['scope','destination','responseFormat','outputSchema','signal']) || Object.getOwnPropertySymbols(options).length) throw failure('invalid_request');
    const jsonOptions = {};
    for (const key of Object.keys(options)) {
     const descriptor = Object.getOwnPropertyDescriptor(options, key);
     if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw failure('invalid_request');
     if (key === 'signal') signal = descriptor.value;
     else jsonOptions[key] = descriptor.value;
    }
    if (signal !== undefined && !(signal instanceof AbortSignal)) throw failure('invalid_request');
    checkAbort(signal);
    const requestOptions = copy(jsonOptions);
    if (!validScope(requestOptions.scope) || !identifier(requestOptions.destination)) throw failure('invalid_request');
    const responseFormat = Object.hasOwn(requestOptions, 'responseFormat') ? requestOptions.responseFormat : 'json';
    if (!['json','text'].includes(responseFormat) || responseFormat === 'text' && requestOptions.outputSchema) throw failure('invalid_request');
    const serialized = canonicalJson({version:1, messages, responseFormat,
     ...(Object.hasOwn(requestOptions, 'outputSchema') ? {outputSchema:requestOptions.outputSchema} : {})});
    const envelope = freeze(JSON.parse(serialized));
    if (!Array.isArray(envelope.messages) || !envelope.messages.length || envelope.messages.length > 16 ||
        envelope.messages.some(message => !keysOnly(message, ['role','content','metadata']) ||
         !['system','user','assistant'].includes(message.role) || typeof message.content !== 'string') ||
        envelope.messages.reduce((n, message) => n + message.content.length, 0) > 7000 ||
        JSON.stringify(envelope.outputSchema || {}).length > 16000) throw failure('invalid_request');

    const policy = readPolicy();
    policyVersion = policy.version;
    const grant = policy.grants.find(item => sameScope(item.scope, requestOptions.scope) && item.destination === requestOptions.destination);
    if (!grant || !registry.has(grant.destination)) throw failure('scope_denied');
    // Only identifiers from a matched trusted policy enter audit. Never log denied input IDs.
    scope = freeze(grant.scope); destination = grant.destination;
    if (typeof classify !== 'function') throw failure('classification_unavailable');
    const input = freeze({scope, destination, policyVersion, envelope, serialized});
    let assessment;
    try { assessment = copy(await classifyWithAbort(classify, input, signal)); }
    catch { checkAbort(signal); throw failure('classification_unavailable'); }
    checkAbort(signal);
    if (!keysOnly(assessment, ['serialized','scope','destination','policyVersion','reliable','scopeVerified','category']) ||
        assessment.serialized !== serialized || !sameScope(assessment.scope, scope) || assessment.destination !== destination ||
        assessment.policyVersion !== policyVersion || assessment.reliable !== true || assessment.scopeVerified !== true ||
        !CATEGORIES.includes(assessment.category) || !grant.allowedCategories.includes(assessment.category)) throw failure('classification_denied');
    category = assessment.category;
    const policySnapshot = canonicalJson(policy);
    const revalidate = () => {
     checkAbort(signal);
     if (canonicalJson(readPolicy()) !== policySnapshot) throw failure('policy_changed');
     // A trusted callback may synchronously abort while returning a policy.
     checkAbort(signal);
    };
    const providerOptions = {responseFormat, signal, ...(Object.hasOwn(envelope, 'outputSchema') ? {outputSchema:envelope.outputSchema} : {})};
    // No await or user-controlled callback between revalidation and dispatch/next().
    revalidate();
    result = 'provider_failed';
    iterator = registry.get(destination)(envelope.messages, providerOptions);
    while (true) {
     revalidate();
     const chunk = await iterator.next();
     revalidate();
     if (chunk.done) { completed = true; result = 'completed'; break; }
     result = 'interrupted';
     yield chunk.value;
     result = 'provider_failed';
    }
   } catch (error) {
    // Only our own fixed codes may leave this boundary; never pass provider/detector text.
    const codes = ['invalid_request','cancelled','policy_unavailable','scope_denied','classification_unavailable','classification_denied','policy_changed'];
    result = signal?.aborted ? 'cancelled' : error?.name === 'EgressPolicyError' && codes.includes(error.code) ? error.code : result;
    throw failure(result);
   } finally {
    if (iterator && !completed) {
     try { await iterator.return?.(); } catch { /* No retry/fallback or raw diagnostic. */ }
    }
    audit.push({category, scope, destination, time:new Date().toISOString(), result, policyVersion});
   }
  }
 };
}
