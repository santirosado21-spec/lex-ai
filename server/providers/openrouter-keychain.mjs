import {execFile} from 'node:child_process';

// H6b read-only prototype. Never imported by the active product entry point.
// These identifiers deliberately cannot be overridden to point at PSF storage.
export const OPENROUTER_PRODUCT_KEYCHAIN = Object.freeze({
 service: 'LEX AI.product.openrouter',
 account: 'product-api-key',
});

const failure = code => Object.assign(new Error('La credencial local no está disponible.'), {
 name: 'OpenRouterKeychainError', code,
});

// Provisioning/revocation is intentionally absent. `security add-generic-password
// -w <key>` exposes the key in argv. A reviewed native UI/Keychain Access flow is
// required before real setup; no file/env/development-credential fallback exists.
// This is credential custody only, not authorization for cloud egress or spending.
export function createOpenRouterKeychain({enabled = false, platform = process.platform, execFileImpl = execFile} = {}) {
 if (typeof enabled !== 'boolean' || typeof platform !== 'string' || typeof execFileImpl !== 'function') {
  throw failure('invalid_configuration');
 }
 let busy = false;
 return Object.freeze({
  status() {
   return {state: !enabled ? 'disabled' : platform !== 'darwin' ? 'unsupported' : 'configured', readOnly: true};
  },
  async getApiKey() {
   if (!enabled) throw failure('disabled');
   if (platform !== 'darwin') throw failure('unsupported_platform');
   if (busy) throw failure('busy');
   busy = true;
   try {
    return await new Promise((resolve, reject) => {
     const args = ['find-generic-password', '-s', OPENROUTER_PRODUCT_KEYCHAIN.service,
      '-a', OPENROUTER_PRODUCT_KEYCHAIN.account, '-w'];
     try {
      execFileImpl('/usr/bin/security', args, {
       shell: false, env: {}, encoding: 'buffer', maxBuffer: 4096,
       timeout: 5000, killSignal: 'SIGKILL', windowsHide: true,
      }, (error, stdout, stderr) => {
       try {
        // Never expose child errors, stderr, partial stdout or their properties.
        if (error || !Buffer.isBuffer(stdout) || stdout.length > 4096) {
         reject(failure('credential_unavailable')); return;
        }
        // Permit only the single newline emitted by security, not arbitrary
        // trimming that could conceal malformed/multiple credentials.
        const value = stdout.toString('utf8').replace(/\r?\n$/, '');
        if (!/^sk-or-v1-[A-Za-z0-9_-]{20,256}$/.test(value)) {
         reject(failure('invalid_credential')); return;
        }
        resolve(value);
       } catch {
        reject(failure('credential_unavailable'));
       } finally {
        if (Buffer.isBuffer(stdout)) stdout.fill(0);
        if (Buffer.isBuffer(stderr)) stderr.fill(0);
       }
      });
     } catch {
      reject(failure('credential_unavailable'));
     }
    });
   } finally {
    busy = false;
   }
  },
 });
}

// Returned JavaScript strings cannot be reliably erased. Keep the result only
// for the immediate authenticated request; callers must never log or persist it.
