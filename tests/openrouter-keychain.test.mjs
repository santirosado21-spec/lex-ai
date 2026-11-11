import test from 'node:test';
import assert from 'node:assert/strict';
import {createOpenRouterKeychain, OPENROUTER_PRODUCT_KEYCHAIN} from '../server/providers/openrouter-keychain.mjs';

const key = 'sk-or-v1-' + 'a'.repeat(32); // Synthetic only; never invoke real Keychain.
const rejects = (promise, code) => assert.rejects(promise, error => {
 assert.equal(error.name, 'OpenRouterKeychainError');
 assert.equal(error.code, code);
 assert.equal(error.cause, undefined);
 assert.doesNotMatch(error.stack + JSON.stringify(error), /CANARY|sk-or-v1-/);
 return true;
});
const configured = execFileImpl => createOpenRouterKeychain({enabled: true, platform: 'darwin', execFileImpl});

test('disabled and unsupported bridges never access credentials', async () => {
 let calls = 0;
 const execFileImpl = () => { calls++; throw Error('must not run'); };
 const disabled = createOpenRouterKeychain({platform: 'darwin', execFileImpl});
 assert.deepEqual(disabled.status(), {state: 'disabled', readOnly: true});
 await rejects(disabled.getApiKey(), 'disabled');
 for (const platform of ['linux', 'win32']) {
  const bridge = createOpenRouterKeychain({enabled: true, platform, execFileImpl});
  assert.equal(bridge.status().state, 'unsupported');
  await rejects(bridge.getApiKey(), 'unsupported_platform');
 }
 assert.equal(calls, 0);
});

test('product-only lookup uses no shell, inherited environment, secret arguments or cache', async () => {
 const calls = [], buffers = [];
 const bridge = configured((file, args, options, callback) => {
  calls.push({file, args, options});
  const stdout = Buffer.from(key + '\n'), stderr = Buffer.from('CANARY STDERR');
  buffers.push(stdout, stderr); callback(null, stdout, stderr);
 });
 assert.equal(await bridge.getApiKey(), key);
 assert.equal(await bridge.getApiKey(), key);
 assert.equal(calls.length, 2);
 assert.deepEqual(calls[0], {
  file: '/usr/bin/security',
  args: ['find-generic-password', '-s', 'LEX AI.product.openrouter', '-a', 'product-api-key', '-w'],
  options: {shell: false, env: {}, encoding: 'buffer', maxBuffer: 4096, timeout: 5000, killSignal: 'SIGKILL', windowsHide: true},
 });
 assert.doesNotMatch(JSON.stringify(calls) + JSON.stringify(bridge.status()), /sk-or-v1-|psf|dsystem/i);
 for (const buffer of buffers) assert.ok(buffer.every(byte => byte === 0));
 assert.ok(Object.isFrozen(OPENROUTER_PRODUCT_KEYCHAIN));
 assert.deepEqual(Object.keys(bridge), ['status', 'getApiKey']);
});

test('missing, denied, timeout, overflow and thrown process errors never expose child output', async () => {
 for (const code of [44, 36, 'ETIMEDOUT', 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER']) {
  const stdout = Buffer.from(key), stderr = Buffer.from('CANARY SECRET');
  const bridge = configured((_file, _args, _options, callback) => callback(
   Object.assign(Error('CANARY ' + key), {code, stdout: key, stderr: 'CANARY'}), stdout, stderr));
  await rejects(bridge.getApiKey(), 'credential_unavailable');
  assert.ok(stdout.every(byte => byte === 0));
  assert.ok(stderr.every(byte => byte === 0));
 }
 await rejects(configured(() => { throw Error('CANARY ' + key); }).getApiKey(), 'credential_unavailable');
});

test('malformed, multiline, oversized and non-buffer credentials are refused', async () => {
 for (const value of ['', ' '+key, key+' ', key+'\n\n', key+'\n'+key, key+'\0', 'sk-or-v1-short', 'sk-or-v1-'+'a'.repeat(257), key+'\uFFFD']) {
  const bridge = configured((_file, _args, _options, callback) => callback(null, Buffer.from(value), Buffer.alloc(0)));
  await rejects(bridge.getApiKey(), 'invalid_credential');
 }
 for (const value of [key, undefined, Buffer.alloc(4097, 'a')]) {
  await rejects(configured((_file, _args, _options, callback) => callback(null, value)).getApiKey(), 'credential_unavailable');
 }
});

test('concurrent reads are refused; failure releases guard without retries', async () => {
 let finish, calls = 0;
 const bridge = configured((_file, _args, _options, callback) => { calls++; finish = callback; });
 const first = bridge.getApiKey();
 await rejects(bridge.getApiKey(), 'busy');
 finish(Error('CANARY'), Buffer.from(key), Buffer.alloc(0));
 await rejects(first, 'credential_unavailable');
 assert.equal(calls, 1);
 const next = bridge.getApiKey();
 finish(null, Buffer.from(key), Buffer.alloc(0));
 assert.equal(await next, key);
 assert.equal(calls, 2);
});

test('invalid activation cannot coerce the bridge into enabling', () => {
 for (const options of [{enabled: 'true'}, {enabled: 1}, {platform: null}, {execFileImpl: null}]) {
  assert.throws(() => createOpenRouterKeychain(options), {name: 'OpenRouterKeychainError', code: 'invalid_configuration'});
 }
});
