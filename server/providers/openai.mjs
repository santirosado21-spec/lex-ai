// Opt-in OpenAI chat transport for the pseudonymized cloud route. Off by default.
// It never decides what may leave the machine: a trusted egress gate must authorize
// the whole prepared envelope first. The API key is read server-side per call through
// getApiKey (never stored, logged or sent to the UI). A local call budget is the owner's
// spending cap: with the default budget of 0 no network request is ever made.
const URL_CHAT = 'https://api.openai.com/v1/chat/completions';
const error = code => Object.assign(new Error('OpenAI no está disponible para esta solicitud.'), {name:'OpenAiProviderError', code});
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keysOnly = (value, keys) => record(value) && Object.keys(value).every(key => keys.includes(key));
const validModel = value => typeof value === 'string' && /^[a-z0-9][a-z0-9._-]{0,63}$/.test(value);
const validKey = value => typeof value === 'string' && /^sk-[A-Za-z0-9_-]{20,}$/.test(value);
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;

function snapshotMessages(messages) {
 if (!Array.isArray(messages) || messages.length < 1 || messages.length > 16) throw error('invalid_request');
 let total = 0;
 const snapshot = [];
 for (const message of messages) {
  if (!keysOnly(message, ['role','content']) || Object.getOwnPropertySymbols(message).length) throw error('invalid_request');
  const role = Object.getOwnPropertyDescriptor(message, 'role'), content = Object.getOwnPropertyDescriptor(message, 'content');
  if (!role || !content || !Object.hasOwn(role, 'value') || !Object.hasOwn(content, 'value') ||
   !['system','user','assistant'].includes(role.value) || typeof content.value !== 'string' || !content.value.length) throw error('invalid_request');
  total += content.value.length;
  if (total > 7000) throw error('invalid_request');
  snapshot.push({role:role.value, content:content.value});
 }
 return snapshot;
}

async function boundedJson(response, limit = 262144) {
 if (!response?.body?.getReader) throw error('invalid_response');
 const reader = response.body.getReader();
 let size = 0;
 const chunks = [];
 try {
  while (true) {
   const {done, value} = await reader.read();
   if (done) break;
   if (!(value instanceof Uint8Array)) throw error('invalid_response');
   size += value.byteLength;
   if (size > limit) throw error('invalid_response');
   chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes));
 } catch { throw error('invalid_response'); } finally { await reader.cancel().catch(() => {}); }
}

export function createOpenAiProvider({enabled = false, getApiKey, model, fetchImpl = globalThis.fetch, timeoutMs = 30000,
  maxOutputTokens = 512, maxCalls = 0, maxTotalTokens = 0, reasoningEffort, pricing, maxUsd = 0} = {}) {
 if (typeof enabled !== 'boolean' || typeof getApiKey !== 'function' || !validModel(model) || typeof fetchImpl !== 'function' ||
  !Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120000 ||
  !Number.isInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > 4096 ||
  !Number.isInteger(maxCalls) || maxCalls < 0 || maxCalls > 100000 ||
  !Number.isInteger(maxTotalTokens) || maxTotalTokens < 0 || maxTotalTokens > 1e9 ||
  reasoningEffort !== undefined && !['none','minimal','low','medium','high'].includes(reasoningEffort) ||
  pricing !== undefined && !(Number.isFinite(pricing?.inputPerMillion) && pricing.inputPerMillion >= 0 && Number.isFinite(pricing?.outputPerMillion) && pricing.outputPerMillion >= 0) ||
  !Number.isFinite(maxUsd) || maxUsd < 0 || maxUsd > 1000 || maxUsd > 0 && pricing === undefined) throw error('invalid_configuration');
 // maxUsd is a LOCAL ESTIMATE under the fixed tariff passed in `pricing`; it is not an account spending limit.
 let spentUsd = 0;
 const usd = (promptTokens, outputTokens) => pricing ? (promptTokens * pricing.inputPerMillion + outputTokens * pricing.outputPerMillion) / 1e6 : 0;
 let busy = false, calls = 0, tokens = 0, lastReceipt = null;
 return {
  outputContract: 'paragraph-citations-v1',
  status() {
   return {state:enabled ? 'configured' : 'disabled', busy, model:'OpenAI', remote:true,
    callsRemaining:Math.max(0, maxCalls - calls), estimatedSpentUsd:pricing ? Number(spentUsd.toFixed(6)) : null, usdIsEstimate:true, tokensRemaining:maxTotalTokens ? Math.max(0, maxTotalTokens - tokens) : null};
  },
  get lastReceipt() { return lastReceipt ? {...lastReceipt} : null; },
  async *generate(messages, {responseFormat = 'text', signal} = {}) {
   if (!enabled) throw error('disabled');
   if (busy) throw error('busy');
   if (!['text','json'].includes(responseFormat) || signal !== undefined && !(signal instanceof AbortSignal)) throw error('invalid_request');
   const prepared = snapshotMessages(messages);
   const body = JSON.stringify({model, messages:prepared, max_completion_tokens:maxOutputTokens, stream:false, store:false,
    ...(reasoningEffort !== undefined ? {reasoning_effort:reasoningEffort} : {}),
    ...(responseFormat === 'json' ? {response_format:{type:'json_object'}} : {})});
   if (new TextEncoder().encode(body).byteLength > 32768) throw error('invalid_request');
   if (signal?.aborted) throw error('cancelled');
   // Everything from here to the reservation is synchronous: busy, budget and the call counter are claimed
   // before ANY await, so concurrent generators cannot both pass the cap. Tokens are reserved conservatively
   // (prompt estimated at one token per two characters plus the full output allowance).
   if (busy) throw error('busy');
   const reserve = Math.ceil(body.length / 2) + maxOutputTokens;
   // Worst case for prompt tokens: one token per body byte.
   const reserveUsd = usd(new TextEncoder().encode(body).byteLength, maxOutputTokens);
   if (calls >= maxCalls || maxTotalTokens && tokens + reserve > maxTotalTokens || maxUsd && spentUsd + reserveUsd > maxUsd) throw error('budget_exhausted');
   busy = true; lastReceipt = null; calls += 1; spentUsd += reserveUsd; tokens += reserve;
   let key;
   try {
    try { key = await getApiKey(); } catch { throw error('missing_credential'); }
    if (!validKey(key)) throw error('missing_credential');
    if (signal?.aborted) throw error('cancelled');
   } catch (cause) {
    // Nothing was dispatched: give the reservation back.
    calls -= 1; spentUsd -= reserveUsd; tokens -= reserve; busy = false;
    throw cause;
   }
   const timeout = AbortSignal.timeout(timeoutMs), combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
   try {
    let response;
    try {
     response = await fetchImpl(URL_CHAT, {method:'POST', headers:{Authorization:`Bearer ${key}`, 'Content-Type':'application/json', Accept:'application/json'},
      body, signal:combined, redirect:'error', credentials:'omit', cache:'no-store'});
    } catch { if (signal?.aborted) throw error('cancelled'); if (timeout.aborted) throw error('timeout'); throw error('network'); }
    if (response.status === 401 || response.status === 403) { await response.body?.cancel?.().catch(() => {}); throw error('auth'); }
    if (response.status === 402 || response.status === 429) { await response.body?.cancel?.().catch(() => {}); throw error('quota'); }
    if (!response.ok) { await response.body?.cancel?.().catch(() => {}); throw error('provider_failed'); }
    const result = await boundedJson(response);
    const choice = Array.isArray(result?.choices) && result.choices.length === 1 ? result.choices[0] : null;
    const usage = record(result?.usage) ? {promptTokens:count(result.usage.prompt_tokens), completionTokens:count(result.usage.completion_tokens)} : null;
    // The conservative reservation stays charged unless the response reports complete usage: a missing or partial
    // usage block never lets the aggregate cap be exceeded.
    if (usage && usage.promptTokens !== null && usage.completionTokens !== null) { tokens += usage.promptTokens + usage.completionTokens - reserve; spentUsd += usd(usage.promptTokens, usage.completionTokens) - reserveUsd; }
    lastReceipt = Object.freeze({requestedModel:model, observedModel:typeof result?.model === 'string' ? result.model.slice(0, 80) : null, usage});
    // A length stop is an incomplete answer: never present it as complete.
    if (!choice) throw error('invalid_response');
    if (choice.finish_reason === 'length') throw error('incomplete_response');
    if (choice.finish_reason !== 'stop' || typeof choice.message?.content !== 'string' || !choice.message.content.length ||
     choice.message.content.length > 32768 || choice.message.tool_calls !== undefined || choice.message.refusal) throw error('invalid_response');
    if (combined.aborted) throw error('cancelled');
    busy = false;
    yield choice.message.content;
   } catch (cause) {
    if (signal?.aborted) throw error('cancelled');
    if (cause?.name === 'OpenAiProviderError') throw cause;
    throw error('provider_failed');
   } finally { busy = false; }
  },
 };
}
