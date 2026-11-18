// Custody of the re-identification map KEY on macOS Keychain. A different item from the OpenAI API key.
// The key is 32 random bytes made locally, stored as 64 hex characters through `security -i` STDIN (never argv,
// env, logs, files or the front end), read back with an empty environment. Disabled by default, darwin only.
// Safe failures: create() never overwrites an existing item (no -U), a missing or malformed item is an error and is
// never silently replaced, and remove() reports that sealed maps become UNRECOVERABLE. No backup or recovery exists:
// losing this item loses the ability to re-identify answers already received.
// NOT verified on a real Mac: tests use fakes only. This module authorizes nothing: no cloud egress, no spending.
import {execFile} from 'node:child_process';
import {randomBytes} from 'node:crypto';

export const MAP_KEY_KEYCHAIN = Object.freeze({service:'LEX AI.product.reidentification-map', account:'map-seal-key-v1'});
const HEX = /^[a-f0-9]{64}$/;
const failure = code => Object.assign(new Error('La clave local del mapa no está disponible.'), {name:'MapKeyKeychainError', code});
const SECURITY = '/usr/bin/security';
const OPTIONS = {shell:false, env:{}, encoding:'buffer', maxBuffer:4096, timeout:5000, killSignal:'SIGKILL', windowsHide:true};

function run(execFileImpl, args, {input} = {}) {
 return new Promise((resolve, reject) => {
  try {
   const child = execFileImpl(SECURITY, args, OPTIONS, (error, stdout, stderr) => {
    try {
     if (error || !Buffer.isBuffer(stdout) || stdout.length > 4096) { reject(failure('keychain_unavailable')); return; }
     resolve(stdout.toString('utf8'));
    } catch { reject(failure('keychain_unavailable')); }
    finally { if (Buffer.isBuffer(stdout)) stdout.fill(0); if (Buffer.isBuffer(stderr)) stderr.fill(0); }
   });
   if (input !== undefined) { child?.stdin?.on?.('error', () => {}); child.stdin.end(input); }
  } catch { reject(failure('keychain_unavailable')); }
 });
}

export function createMapKeyKeychain({enabled = false, platform = process.platform, execFileImpl = execFile, randomImpl = randomBytes} = {}) {
 if (typeof enabled !== 'boolean' || typeof platform !== 'string' || typeof execFileImpl !== 'function' || typeof randomImpl !== 'function') throw failure('invalid_configuration');
 let busy = false;
 const guard = async work => {
  if (!enabled) throw failure('disabled');
  if (platform !== 'darwin') throw failure('unsupported_platform');
  if (busy) throw failure('busy');
  busy = true;
  try { return await work(); } finally { busy = false; }
 };
 const {service, account} = MAP_KEY_KEYCHAIN;
 const read = async () => (await run(execFileImpl, ['find-generic-password', '-s', service, '-a', account, '-w'])).replace(/\r?\n$/, '');
 return Object.freeze({
  status() { return {state:!enabled ? 'disabled' : platform !== 'darwin' ? 'unsupported' : 'configured'}; },
  /** Returns the 32-byte key as a Buffer the caller should zero after use. Never creates a key. */
  getKey() {
   return guard(async () => {
    let value;
    try { value = await read(); } catch { throw failure('key_missing'); }
    if (!HEX.test(value)) throw failure('invalid_key_item');
    return Buffer.from(value, 'hex');
   });
  },
  /** Creates the key only when none exists. An existing item is never overwritten. Returns only {created:true}. */
  create() {
   return guard(async () => {
    let exists = true;
    try { await read(); } catch { exists = false; }
    if (exists) throw failure('key_exists');
    const bytes = randomImpl(32);
    if (!Buffer.isBuffer(bytes) || bytes.length !== 32) throw failure('invalid_random');
    const hex = bytes.toString('hex');
    bytes.fill(0);
    // Hex-only charset makes the stdin command injection-proof. No -U: a race cannot overwrite a key.
    await run(execFileImpl, ['-i'], {input:`add-generic-password -s "${service}" -a "${account}" -w ${hex}\n`});
    return {created:true};
   });
  },
  /** Deletes the item. Sealed maps can no longer be opened: the loss is permanent and there is no recovery. */
  remove() {
   return guard(async () => { await run(execFileImpl, ['delete-generic-password', '-s', service, '-a', account]); return {removed:true, sealedMapsUnrecoverable:true}; });
  },
 });
}
