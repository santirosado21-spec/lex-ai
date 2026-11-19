// OpenAI product key custody on macOS Keychain. Disabled by default, darwin only, no file/env/dev fallback.
// Read: `security find-generic-password -w` with an empty environment, no shell, bounded output.
// Provision: the key is typed by the user into a native hidden-answer dialog (osascript) and goes to
// `security -i` through STDIN, so it never appears in argv, the environment, logs, files or the front end.
// The key passes through process memory and strings cannot be reliably erased: callers keep it only for the
// immediate request. This module authorizes nothing: no cloud egress, no spending.
// NOT verified on a real Mac: tests use fakes only. A real run belongs to the Mac bridge script.
import {execFile} from 'node:child_process';

export const OPENAI_PRODUCT_KEYCHAIN = Object.freeze({service:'LEX AI.product.openai', account:'product-api-key'});
const KEY = /^sk-[A-Za-z0-9_-]{20,256}$/;
const failure = code => Object.assign(new Error('La credencial local no está disponible.'), {name:'OpenAiKeychainError', code});
const SECURITY = '/usr/bin/security', OSASCRIPT = '/usr/bin/osascript';
const OPTIONS = {shell:false, env:{}, encoding:'buffer', maxBuffer:4096, timeout:5000, killSignal:'SIGKILL', windowsHide:true};

function run(execFileImpl, file, args, {input, timeout = 5000} = {}) {
 return new Promise((resolve, reject) => {
  try {
   const child = execFileImpl(file, args, {...OPTIONS, timeout}, (error, stdout, stderr) => {
    try {
     if (error || !Buffer.isBuffer(stdout) || stdout.length > 4096) { reject(failure('credential_unavailable')); return; }
     resolve(stdout.toString('utf8'));
    } catch { reject(failure('credential_unavailable')); }
    finally { if (Buffer.isBuffer(stdout)) stdout.fill(0); if (Buffer.isBuffer(stderr)) stderr.fill(0); }
   });
   if (input !== undefined) { child?.stdin?.on?.('error', () => {}); child.stdin.end(input); }
  } catch { reject(failure('credential_unavailable')); }
 });
}

export function createOpenAiKeychain({enabled = false, platform = process.platform, execFileImpl = execFile, slot = 'primary'} = {}) {
 if (!['primary','lorenzo'].includes(slot) || typeof enabled !== 'boolean' || typeof platform !== 'string' || typeof execFileImpl !== 'function') throw failure('invalid_configuration');
 let busy = false;
 const guard = async work => {
  if (!enabled) throw failure('disabled');
  if (platform !== 'darwin') throw failure('unsupported_platform');
  if (busy) throw failure('busy');
  busy = true;
  try { return await work(); } finally { busy = false; }
 };
 const {service} = OPENAI_PRODUCT_KEYCHAIN;
 const account = slot === 'primary' ? OPENAI_PRODUCT_KEYCHAIN.account : 'product-api-key-lorenzo';
 return Object.freeze({
  status() { return {state:!enabled ? 'disabled' : platform !== 'darwin' ? 'unsupported' : 'configured'}; },
  getApiKey() {
   return guard(async () => {
    const value = (await run(execFileImpl, SECURITY, ['find-generic-password', '-s', service, '-a', account, '-w'])).replace(/\r?\n$/, '');
    if (!KEY.test(value)) throw failure('invalid_credential');
    return value;
   });
  },
  /** Opens the native hidden-answer dialog, validates the answer, stores it via stdin. Returns only {stored:true}. */
  provision() {
   return guard(async () => {
    const script = 'text returned of (display dialog "Pega tu clave de API de OpenAI para Rejon. Se guardará en el Llavero de este equipo." default answer "" with hidden answer buttons {"Cancelar","Guardar"} default button "Guardar" with title "Rejon")';
    const answer = (await run(execFileImpl, OSASCRIPT, ['-e', script], {timeout:120000})).replace(/\r?\n$/, '');
    // The charset check also makes the stdin command injection-proof: no quotes, spaces or newlines can pass.
    if (!KEY.test(answer)) throw failure('invalid_credential');
    await run(execFileImpl, SECURITY, ['-i'], {input:`add-generic-password -U -s "${service}" -a "${account}" -w ${answer}\n`});
    return {stored:true};
   });
  },
  remove() {
   return guard(async () => { await run(execFileImpl, SECURITY, ['delete-generic-password', '-s', service, '-a', account]); return {removed:true}; });
  },
 });
}
