// Fakes only: the real Keychain is never touched and no real key exists in this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough} from 'node:stream';
import {createOpenAiKeychain,OPENAI_PRODUCT_KEYCHAIN} from '../server/providers/openai-keychain.mjs';

const CANARY = 'sk-CANARY' + 'a'.repeat(30);
const rejects = (promise, code) => assert.rejects(promise, error => {
 assert.equal(error.name, 'OpenAiKeychainError'); assert.equal(error.code, code); assert.equal(error.cause, undefined);
 assert.doesNotMatch(error.stack + JSON.stringify(error), /CANARY/); return true;
});
const configured = execFileImpl => createOpenAiKeychain({enabled:true, platform:'darwin', execFileImpl});

test('disabled and non-mac never run any process', async () => {
 let calls = 0;
 const execFileImpl = () => { calls++; throw Error('must not run'); };
 await rejects(createOpenAiKeychain({execFileImpl}).getApiKey(), 'disabled');
 await rejects(createOpenAiKeychain({execFileImpl}).provision(), 'disabled');
 for (const platform of ['linux', 'win32']) {
  const bridge = createOpenAiKeychain({enabled:true, platform, execFileImpl});
  await rejects(bridge.getApiKey(), 'unsupported_platform'); await rejects(bridge.provision(), 'unsupported_platform'); await rejects(bridge.remove(), 'unsupported_platform');
 }
 assert.equal(calls, 0);
});

test('read uses fixed binary, no shell, empty env, product-only names, and returns only a well-formed key', async () => {
 const calls = [];
 const bridge = configured((file, args, options, callback) => { calls.push({file, args, options}); callback(null, Buffer.from(CANARY + '\n'), Buffer.alloc(0)); });
 assert.equal(await bridge.getApiKey(), CANARY);
 assert.equal(calls[0].file, '/usr/bin/security');
 assert.deepEqual(calls[0].args, ['find-generic-password', '-s', OPENAI_PRODUCT_KEYCHAIN.service, '-a', OPENAI_PRODUCT_KEYCHAIN.account, '-w']);
 assert.equal(calls[0].options.shell, false); assert.deepEqual(calls[0].options.env, {});
 assert.ok(!JSON.stringify(calls[0].args).includes('CANARY'));
 const bad = configured((file, args, options, callback) => callback(null, Buffer.from('not-a-key\n'), Buffer.alloc(0)));
 await rejects(bad.getApiKey(), 'invalid_credential');
 const failing = configured((file, args, options, callback) => callback(Object.assign(Error('CANARY stderr'), {stderr:CANARY}), Buffer.alloc(0), Buffer.from(CANARY)));
 await rejects(failing.getApiKey(), 'credential_unavailable');
});

test('provision: key comes from the native dialog and reaches security only through stdin, never argv/env', async () => {
 const calls = [];
 let stdinText = '';
 const bridge = configured((file, args, options, callback) => {
  calls.push({file, args, options});
  if (file === '/usr/bin/osascript') { callback(null, Buffer.from(CANARY + '\n'), Buffer.alloc(0)); return {stdin:new PassThrough()}; }
  const stdin = new PassThrough(); stdin.on('data', chunk => { stdinText += chunk; });
  stdin.on('end', () => callback(null, Buffer.alloc(0), Buffer.alloc(0)));
  return {stdin};
 });
 assert.deepEqual(await bridge.provision(), {stored:true});
 assert.deepEqual(calls.map(c => c.file), ['/usr/bin/osascript', '/usr/bin/security']);
 assert.deepEqual(calls[1].args, ['-i']);
 for (const call of calls) { assert.equal(call.options.shell, false); assert.deepEqual(call.options.env, {}); assert.ok(!JSON.stringify(call.args).includes('CANARY')); }
 assert.match(calls[0].args[1], /hidden answer/);
 assert.match(stdinText, /^add-generic-password -U -s "LEX AI\.product\.openai" -a "product-api-key" -w sk-CANARY/);
});

test('provision rejects malformed or injection-shaped answers before any write', async () => {
 for (const answer of ['', 'short', 'sk-' + 'a'.repeat(30) + '"; delete-generic-password', 'sk-' + 'a'.repeat(20) + '\nquit', 'sk-aaaa aaaaaaaaaaaaaaaaaaaaaaaa']) {
  const files = [];
  const bridge = configured((file, args, options, callback) => { files.push(file); callback(null, Buffer.from(answer), Buffer.alloc(0)); return {stdin:new PassThrough()}; });
  await rejects(bridge.provision(), 'invalid_credential');
  assert.deepEqual(files, ['/usr/bin/osascript']);
 }
});

test('cancelled dialog is a fixed error, concurrent use is refused, remove targets only the product entry', async () => {
 const cancelled = configured((file, args, options, callback) => callback(Object.assign(Error('User canceled'), {code:1}), Buffer.alloc(0), Buffer.alloc(0)));
 await rejects(cancelled.provision(), 'credential_unavailable');
 let release; const waiting = new Promise(resolve => { release = resolve; });
 const slow = configured((file, args, options, callback) => { waiting.then(() => callback(null, Buffer.from(CANARY), Buffer.alloc(0))); });
 const first = slow.getApiKey();
 await rejects(slow.getApiKey(), 'busy'); release(); await first;
 const seen = [];
 await configured((file, args, options, callback) => { seen.push(args); callback(null, Buffer.alloc(0), Buffer.alloc(0)); }).remove();
 assert.deepEqual(seen[0], ['delete-generic-password', '-s', OPENAI_PRODUCT_KEYCHAIN.service, '-a', OPENAI_PRODUCT_KEYCHAIN.account]);
});
