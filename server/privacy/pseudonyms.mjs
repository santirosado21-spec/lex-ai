// H3 synthetic-only memory prototype. No detector, disk persistence or encryption.
import {randomUUID} from 'node:crypto';
import {canonicalJson} from '../canonical-json.mjs';

const PREFIX = '[[LEX_';
const MAX_RESPONSE = 32768;
const error = code => Object.assign(new Error('Correspondencia sintética inválida o no disponible.'), {name:'PseudonymError', code});
const fail = code => { throw error(code); };
const clone = value => { try { return JSON.parse(canonicalJson(value)); } catch { fail('invalid_data'); } };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value, allowed) => object(value) && Object.keys(value).every(key => allowed.includes(key));
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(value);
const opaqueId = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
const freshId = () => randomUUID().replaceAll('-', '');
const pair = scope => {
 if (!keys(scope, ['workspaceId','matterId','threadId']) || !['workspaceId','matterId','threadId'].every(key => id(scope[key]))) fail('invalid_scope');
 return {workspaceId:scope.workspaceId, matterId:scope.matterId};
};
const pairKey = scope => canonicalJson(scope);
const validText = text => typeof text === 'string' && text.length > 0 && text.length <= 1024 && !text.includes(PREFIX);
const token = (namespace, entryId) => `${PREFIX}${namespace}_${entryId}]]`;

// Exact UTF-16 literal matching, no Unicode normalization or semantic entity detection.
// At each earliest occurrence, longest matching literal wins. Never replace generated text.
function protectText(text, entries) {
 if (text.includes(PREFIX)) fail('literal_marker');
 let cursor = 0, result = '';
 while (cursor < text.length) {
  let found, start = text.length;
  for (const entry of entries) {
   const index = text.indexOf(entry.text, cursor);
   if (index !== -1 && (index < start || index === start && (!found || entry.text.length > found.text.length))) { found = entry; start = index; }
  }
  if (!found) return result + text.slice(cursor);
  result += text.slice(cursor, start) + found.marker;
  cursor = start + found.text.length;
 }
 return result;
}

function protectMetadata(value, entries) {
 if (typeof value === 'string') return protectText(value, entries);
 if (Array.isArray(value)) return value.map(item => protectMetadata(item, entries));
 if (!object(value)) return value;
 return Object.fromEntries(Object.entries(value).map(([key, item]) => {
  // Renaming structural keys could merge fields or invalidate references: reject instead.
  if (key.includes(PREFIX) || entries.some(entry => key.includes(entry.text))) fail('sensitive_metadata_key');
  return [key, protectMetadata(item, entries)];
 }));
}

/**
 * Trusted application API for declared synthetic entities only (entities: string[]).
 * scope always requires workspaceId/matterId/threadId; thread is checked but is NOT a map key.
 * protect({scope,messages,entities,provenance?}) -> {messages,mappingVersion,provenance}.
 * Messages allow role/content/metadata. All content/metadata string values are transformed;
 * metadata keys containing declared entities fail closed. Existing active entries are reused.
 * provenance is copied separately, unchanged and LOCAL ONLY: it may contain original identities
 * and citations. Never spread the whole return value into a provider request. Only messages
 * are prepared text; policy/classification are still required for the entire outbound envelope.
 * H1's proposed `detections` port is deliberately `entities` here: no detector/range claims.
 *
 * restore({scope,text,mappingVersion}) only resolves exact known markers of the ACTIVE version.
 * Unknown/foreign/malformed reserved markers and stale versions reject; ordinary text stays text.
 * restoreStream({... ,chunks,signal?}) buffers <=32768 characters then emits ONE restored string.
 * No partial markers or partial restored output escape a failing stream; incremental UI is future work.
 * AbortSignal is checked around chunks; it cannot force an arbitrary stalled source to settle.
 *
 * exportSnapshot({scope}) and importSnapshot({scope,snapshot}) exchange LOCAL ONLY plaintext
 * synthetic objects in memory. Import requires an absent matter, matching scope and consistent
 * fields. Snapshots are NOT authenticated/encrypted: never accept untrusted files or client data.
 * rollback({scope,toVersion}) selects retained immutable entries. New markers and versions use fresh opaque IDs, including after stale snapshot import.
 * They cannot reuse a discarded numeric counter. Every operation validates/copies before committing. No persistence is implemented.
 */
export function createPseudonymStore() {
 const matters = new Map();
 const locate = scope => {
  const scopePair = pair(scope), key = pairKey(scopePair), state = matters.get(key);
  if (!state) fail('unknown_scope');
  return {state, scopePair, key};
 };
 const active = (scope, mappingVersion) => {
  const {state} = locate(scope);
  if (!opaqueId(mappingVersion) || mappingVersion !== state.activeVersion) fail('stale_version');
  return state;
 };
 const api = {
  protect(input) {
   const request = clone(input);
   if (!keys(request, ['scope','messages','entities','provenance'])) fail('invalid_request');
   const scopePair = pair(request.scope), key = pairKey(scopePair), previous = matters.get(key);
   if (!previous && matters.size >= 64) fail('capacity');
   if (!Array.isArray(request.entities) || request.entities.length > 128 || request.entities.some(entity => !validText(entity))) fail('invalid_entities');
   if (!Array.isArray(request.messages) || !request.messages.length || request.messages.length > 16 ||
       request.messages.some(message => !keys(message, ['role','content','metadata']) || !['system','user','assistant'].includes(message.role) || typeof message.content !== 'string') ||
       request.messages.reduce((n, message) => n + message.content.length, 0) > 7000 || canonicalJson(request.messages).length > 65536) fail('invalid_messages');
   const state = previous ?? {scope:scopePair, namespace:freshId(), activeVersion:null, versions:new Map()};
   const entries = (state.versions.get(state.activeVersion) ?? []).map(entry => ({...entry}));
   for (const text of request.entities) if (!entries.some(entry => entry.text === text)) {
    const marker = token(state.namespace,freshId());
    if ([...state.versions.values()].some(version => version.some(entry => entry.marker === marker)) || entries.some(entry => entry.marker === marker)) fail('id_collision');
    entries.push({text,marker});
   }
   if (entries.length > 256) fail('capacity');
   const messages = request.messages.map(message => ({role:message.role,content:protectText(message.content,entries),
    ...(Object.hasOwn(message,'metadata') ? {metadata:protectMetadata(message.metadata,entries)} : {})}));
   if (canonicalJson(messages).length > 65536 || messages.reduce((n, message) => n + message.content.length, 0) > 7000) fail('capacity');
   const changed = !previous || entries.length !== state.versions.get(state.activeVersion).length;
   if (changed && state.versions.size >= 64) fail('capacity');
   // All possible validation failures precede this commit. No caller-owned references are retained.
   if (changed) {
    const version = freshId();
    if (state.versions.has(version)) fail('id_collision');
    state.activeVersion = version; state.versions.set(version, entries);
   }
   matters.set(key,state);
   return {messages,mappingVersion:state.activeVersion,provenance:request.provenance ?? null};
  },
  restore(input) {
   const request = clone(input);
   if (!keys(request,['scope','text','mappingVersion']) || typeof request.text !== 'string' || request.text.length > MAX_RESPONSE) fail('invalid_request');
   const state = active(request.scope,request.mappingVersion), entries = state.versions.get(state.activeVersion);
   const byMarker = new Map(entries.map(entry => [entry.marker,entry.text]));
   let cursor = 0, result = '';
   while (cursor < request.text.length) {
    const start = request.text.indexOf(PREFIX,cursor);
    if (start === -1) { result += request.text.slice(cursor); break; }
    result += request.text.slice(cursor,start);
    const end = request.text.indexOf(']]',start + PREFIX.length);
    if (end === -1) fail('unknown_marker');
    const marker = request.text.slice(start,end + 2);
    if (!byMarker.has(marker)) fail('unknown_marker');
    result += byMarker.get(marker); cursor = end + 2;
   }
   // A truncated reserved prefix must not be rendered as an unfinished marker.
   for (let size = 1; size < PREFIX.length; size++) if (request.text.endsWith(PREFIX.slice(0,size))) fail('unknown_marker');
   if (result.length > MAX_RESPONSE) fail('capacity');
   return result;
  },
  async *restoreStream({scope,mappingVersion,chunks,signal}) {
   if (signal !== undefined && !(signal instanceof AbortSignal)) fail('invalid_request');
   const checkAbort = () => { if (signal?.aborted) fail('cancelled'); };
   checkAbort();
   const scopeCopy = clone(scope); active(scopeCopy,mappingVersion);
   let text = '';
   for await (const chunk of chunks) {
    checkAbort();
    if (typeof chunk !== 'string' || text.length + chunk.length > MAX_RESPONSE) fail('capacity');
    text += chunk;
   }
   checkAbort();
   // Revalidates active version after every asynchronous source has finished.
   yield api.restore({scope:scopeCopy,mappingVersion,text});
  },
  exportSnapshot(input) {
   const request = clone(input);
   if (!keys(request,['scope'])) fail('invalid_request');
   const {state} = locate(request.scope);
   return clone({format:1,scope:state.scope,namespace:state.namespace,mappingVersion:state.activeVersion,
    entries:state.versions.get(state.activeVersion)});
  },
  importSnapshot(input) {
   const request = clone(input);
   if (!keys(request,['scope','snapshot'])) fail('invalid_request');
   const scopePair = pair(request.scope), key = pairKey(scopePair), snapshot = request.snapshot;
   if (matters.has(key)) fail('import_conflict');
   if (matters.size >= 64) fail('capacity');
   if (!keys(snapshot,['format','scope','namespace','mappingVersion','entries']) || snapshot.format !== 1 ||
       !keys(snapshot.scope,['workspaceId','matterId']) || canonicalJson(snapshot.scope) !== canonicalJson(scopePair) || !opaqueId(snapshot.namespace) || !opaqueId(snapshot.mappingVersion) || !Array.isArray(snapshot.entries) || snapshot.entries.length > 256) fail('invalid_snapshot');
   if ([...matters.values()].some(state => state.namespace === snapshot.namespace)) fail('invalid_snapshot');
   const texts = new Set(), markers = new Set();
   for (const entry of snapshot.entries) {
    if (!keys(entry,['text','marker']) || !validText(entry.text) || typeof entry.marker !== 'string') fail('invalid_snapshot');
    const match = /^\[\[LEX_([a-f0-9]{32})_([a-f0-9]{32})\]\]$/.exec(entry.marker);
    if (!match || match[1] !== snapshot.namespace || texts.has(entry.text) || markers.has(entry.marker)) fail('invalid_snapshot');
    texts.add(entry.text);markers.add(entry.marker);
   }
   matters.set(key,{scope:scopePair,namespace:snapshot.namespace,activeVersion:snapshot.mappingVersion,versions:new Map([[snapshot.mappingVersion,snapshot.entries]])});
   return {mappingVersion:snapshot.mappingVersion};
  },
  rollback(input) {
   const request = clone(input);
   if (!keys(request,['scope','toVersion'])) fail('invalid_request');
   const {state} = locate(request.scope);
   if (!opaqueId(request.toVersion) || !state.versions.has(request.toVersion)) fail('stale_version');
   state.activeVersion = request.toVersion;
   return {mappingVersion:state.activeVersion};
  }
 };
 return api;
}
