// Sealed on-disk custody of the re-identification map, one file per matter. Reuses the existing AES-GCM sealer.
// The key comes from a caller-supplied getKey (the map-key Keychain item); this module never creates, stores or
// logs a key. Files hold only sealed bytes with names derived from a hash of the scope (no client text in names).
// Safe failure: writes go to a temp file (0600) and are renamed over the old file only after sealing, writing and a
// read-back check succeed, so an error or cancel leaves the previous sealed file untouched. A load that fails
// imports nothing and never deletes or rewrites the file. A missing key is an error, never a reason to make a new key
// or overwrite a map. remove() deletes only that matter's file; loss is permanent and nothing is recoverable.
// The directory must be an absolute, already-resolved path (no symlink in any component) that the current user owns
// with no group/other permission bits. An existing directory is checked, never chmod-ed, followed or repaired; an unsafe
// one is rejected (`unsafe_directory`) and nothing in it is touched. Only a missing leaf is created (0700) under a
// parent that passes the same checks. Sealed files must be regular, single-link, owner-only files, else `unsafe_file`.
// Offline: no network, no cloud, no real Keychain here.
import {mkdir, writeFile, rename, readFile, rm, lstat, realpath} from 'node:fs/promises';
import {createHash, randomBytes} from 'node:crypto';
import path from 'node:path';
import {createPseudonymSealer} from './pseudonym-persistence.mjs';
import {canonicalJson} from '../canonical-json.mjs';

const failure = code => Object.assign(new Error('Almacén cifrado de correspondencias no disponible.'), {name:'MapVaultStoreError', code});
const uid = typeof process.getuid === 'function' ? process.getuid() : null;
const MAX_BYTES = 262144 + 4096;
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(value);

export function createMapVaultStore({directory, getKey, pseudonyms} = {}) {
 if (typeof directory !== 'string' || !path.isAbsolute(directory) || typeof getKey !== 'function' || typeof pseudonyms?.exportSnapshot !== 'function' || typeof pseudonyms?.importSnapshot !== 'function') throw failure('invalid_configuration');
 // Callers pass the full scope the pseudonym store uses (workspace, matter, thread). The map belongs to the matter,
 // so files and sealing use only the workspace+matter pair.
 const full = scope => {
  if (!id(scope?.workspaceId) || !id(scope?.matterId) || !id(scope?.threadId) || Object.keys(scope).length !== 3) throw failure('invalid_scope');
  return {workspaceId:scope.workspaceId, matterId:scope.matterId, threadId:scope.threadId};
 };
 const pair = scope => { const f = full(scope); return {workspaceId:f.workspaceId, matterId:f.matterId}; };
 const trusted = info => info.isDirectory() && !info.isSymbolicLink() && (uid === null || info.uid === uid) && (info.mode & 0o077) === 0;
 const checkDirectory = async ({create}) => {
  try {
   if (await realpath(directory) !== directory) throw 0;
   if (!trusted(await lstat(directory))) throw 0;
   return;
  } catch (error) { if (error?.code !== 'ENOENT' || !create) throw failure(error?.code === 'ENOENT' ? 'no_sealed_map' : 'unsafe_directory'); }
  const parent = path.dirname(directory);
  try { if (await realpath(parent) !== parent) throw 0; const info = await lstat(parent); if (!info.isDirectory() || info.isSymbolicLink() || (uid !== null && info.uid !== uid) || (info.mode & 0o022) !== 0) throw 0; } catch { throw failure('unsafe_directory'); }
  try { await mkdir(directory, {mode:0o700}); } catch (error) { if (error?.code !== 'EEXIST') throw failure('unsafe_directory'); }
  try { if (await realpath(directory) !== directory || !trusted(await lstat(directory))) throw 0; } catch { throw failure('unsafe_directory'); }
 };
 const checkFile = async target => {
  let info;
  try { info = await lstat(target); } catch (error) { if (error?.code === 'ENOENT') return null; throw failure('unsafe_file'); }
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || (uid !== null && info.uid !== uid) || (info.mode & 0o077) !== 0 || info.size > MAX_BYTES) throw failure('unsafe_file');
  return info;
 };
 const fileFor = scopePair => path.join(directory, createHash('sha256').update(canonicalJson(['map-vault-v1', scopePair])).digest('hex') + '.sealed.json');
 const sealerFor = async signal => {
  if (signal?.aborted) throw failure('cancelled');
  let key;
  try { key = await getKey(); } catch { throw failure('key_unavailable'); }
  if (signal?.aborted) { if (Buffer.isBuffer(key)) key.fill(0); throw failure('cancelled'); }
  try { return {sealer:createPseudonymSealer({key}), key}; } catch { if (Buffer.isBuffer(key)) key.fill(0); throw failure('key_unavailable'); }
 };
 return Object.freeze({
  /** Seals the matter's active map and replaces the file atomically. Returns only {saved:true}. */
  async save({scope, signal} = {}) {
   const scopePair = pair(scope);
   let snapshot;
   try { snapshot = pseudonyms.exportSnapshot({scope:full(scope)}); } catch { throw failure('no_map'); }
   const {sealer, key} = await sealerFor(signal);
   const target = fileFor(scopePair), temp = `${target}.${randomBytes(8).toString('hex')}.tmp`;
   try {
    let sealed;
    try { sealed = sealer.seal({scope:scopePair, snapshot}); } catch { throw failure('seal_failed'); }
    const bytes = JSON.stringify(sealed);
    await checkDirectory({create:true});
    await checkFile(target);
    if (signal?.aborted) throw failure('cancelled');
    await writeFile(temp, bytes, {mode:0o600, flag:'wx'});
    // Read-back check: the new file must open with the same key before it replaces anything.
    try { sealer.open({scope:scopePair, sealed:JSON.parse(await readFile(temp, 'utf8'))}); } catch { throw failure('verify_failed'); }
    if (signal?.aborted) throw failure('cancelled');
    await rename(temp, target);
    return {saved:true};
   } catch (error) {
    await rm(temp, {force:true}).catch(() => {});
    throw error?.name === 'MapVaultStoreError' ? error : failure('write_failed');
   } finally { key.fill(0); }
  },
  /** Opens the matter's sealed file and imports it into an EMPTY matter slot. Changes no file. */
  async load({scope, signal} = {}) {
   const scopePair = pair(scope), target = fileFor(scopePair);
   await checkDirectory({create:false});
   if (!await checkFile(target)) throw failure('no_sealed_map');
   let raw;
   try { raw = await readFile(target, 'utf8'); } catch { throw failure('no_sealed_map'); }
   const {sealer, key} = await sealerFor(signal);
   try {
    let snapshot;
    try { snapshot = sealer.open({scope:scopePair, sealed:JSON.parse(raw)}); } catch { throw failure('open_failed'); }
    try { return pseudonyms.importSnapshot({scope:full(scope), snapshot}); } catch { throw failure('import_failed'); }
   } finally { key.fill(0); }
  },
  async exists({scope} = {}) { const target = fileFor(pair(scope)); try { await checkDirectory({create:false}); return (await checkFile(target)) !== null; } catch { return false; } },
  /** Deletes only this matter's sealed file. Permanent: no backup or recovery exists. */
  async remove({scope} = {}) {
   const target = fileFor(pair(scope));
   await checkDirectory({create:false}).catch(error => { if (error.code === 'no_sealed_map') return null; throw error; });
   if (!await checkFile(target)) return {removed:false};
   try { await rm(target); } catch { throw failure('remove_failed'); }
   return {removed:true, unrecoverable:true};
  },
 });
}
