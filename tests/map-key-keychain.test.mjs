// Fakes only: the real Keychain is never touched.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createMapKeyKeychain, MAP_KEY_KEYCHAIN} from '../server/privacy/map-key-keychain.mjs';
import {OPENAI_PRODUCT_KEYCHAIN} from '../server/providers/openai-keychain.mjs';
import {createPseudonymSealer} from '../server/privacy/pseudonym-persistence.mjs';

const fakeKeychain = () => {
 const store = new Map(), calls = [];
 const execFileImpl = (file, args, options, callback) => {
  calls.push({file, args, options});
  const child = {stdin:{on() {}, end(input) {
   const m = /add-generic-password -s "([^"]+)" -a "([^"]+)" -w ([a-f0-9]+)\n/.exec(input);
   if (!m || store.has(m[1] + '|' + m[2])) return callback(Error('fail'), Buffer.alloc(0), Buffer.alloc(0));
   store.set(m[1] + '|' + m[2], m[3]); callback(null, Buffer.alloc(0), Buffer.alloc(0));
  }}};
  if (args[0] === 'find-generic-password') {
   const v = store.get(args[2] + '|' + args[4]);
   queueMicrotask(() => v ? callback(null, Buffer.from(v + '\n'), Buffer.alloc(0)) : callback(Error('nf'), Buffer.alloc(0), Buffer.alloc(0)));
  } else if (args[0] === 'delete-generic-password') { store.delete(args[2] + '|' + args[4]); queueMicrotask(() => callback(null, Buffer.alloc(0), Buffer.alloc(0))); }
  return child;
 };
 return {store, calls, execFileImpl};
};
const rejects = (promise, code) => assert.rejects(promise, e => e.name === 'MapKeyKeychainError' && e.code === code && e.cause === undefined);
const mac = execFileImpl => createMapKeyKeychain({enabled:true, platform:'darwin', execFileImpl});

test('disabled and non-mac never run a process', async () => {
 let n = 0; const execFileImpl = () => { n++; throw Error('no'); };
 await rejects(createMapKeyKeychain({execFileImpl}).getKey(), 'disabled');
 await rejects(createMapKeyKeychain({enabled:true, platform:'linux', execFileImpl}).create(), 'unsupported_platform');
 assert.equal(n, 0);
});

test('item is distinct from the OpenAI API key item', () => {
 assert.notEqual(MAP_KEY_KEYCHAIN.service, OPENAI_PRODUCT_KEYCHAIN.service);
 assert.notEqual(MAP_KEY_KEYCHAIN.account, OPENAI_PRODUCT_KEYCHAIN.account);
});

test('create stores 64 hex over stdin only, never in argv or env; getKey returns a usable 32-byte sealing key', async () => {
 const fake = fakeKeychain(), bridge = mac(fake.execFileImpl);
 assert.deepEqual(await bridge.create(), {created:true});
 const hex = [...fake.store.values()][0];
 assert.match(hex, /^[a-f0-9]{64}$/);
 for (const c of fake.calls) { assert.equal(c.file, '/usr/bin/security'); assert.equal(c.options.shell, false); assert.deepEqual(c.options.env, {}); assert.ok(!c.args.join(' ').includes(hex)); }
 const key = await bridge.getKey();
 assert.equal(key.length, 32); assert.doesNotThrow(() => createPseudonymSealer({key}));
});

test('create never overwrites an existing key', async () => {
 const fake = fakeKeychain(), bridge = mac(fake.execFileImpl);
 await bridge.create(); const before = [...fake.store.values()][0];
 await rejects(bridge.create(), 'key_exists');
 assert.equal([...fake.store.values()][0], before);
});

test('missing or malformed item is an error, never silently recreated', async () => {
 const fake = fakeKeychain(), bridge = mac(fake.execFileImpl);
 await rejects(bridge.getKey(), 'key_missing');
 assert.equal(fake.store.size, 0);
 fake.store.set(MAP_KEY_KEYCHAIN.service + '|' + MAP_KEY_KEYCHAIN.account, 'not-hex');
 await rejects(bridge.getKey(), 'invalid_key_item');
 await rejects(bridge.create(), 'key_exists');
});

test('remove states the loss is permanent and the old map can no longer be opened by a new key', async () => {
 const fake = fakeKeychain(), bridge = mac(fake.execFileImpl);
 await bridge.create(); const old = await bridge.getKey();
 const scope = {workspaceId:'W', matterId:'M'};
 const sealed = createPseudonymSealer({key:old}).seal({scope, snapshot:{format:1, scope, namespace:'a'.repeat(32), mappingVersion:'b'.repeat(32), entries:[]}});
 assert.deepEqual(await bridge.remove(), {removed:true, sealedMapsUnrecoverable:true});
 await rejects(bridge.getKey(), 'key_missing');
 await bridge.create();
 assert.throws(() => createPseudonymSealer({key:await_free(bridge)}).open({scope, sealed}), {code:'authentication_failed'});
 function await_free() { return Buffer.from([...fake.store.values()][0], 'hex'); }
});

test('a failing process gives one fixed error with no detail', async () => {
 const bridge = mac((f, a, o, cb) => { cb(Error('secret detail ' + 'a'.repeat(64)), Buffer.alloc(0), Buffer.alloc(0)); return {stdin:{on() {}, end() {}}}; });
 await assert.rejects(bridge.getKey(), e => { assert.doesNotMatch(e.stack + JSON.stringify(e), /secret detail/); return true; });
});
