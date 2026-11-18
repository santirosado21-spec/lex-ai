// F3 offline checks: the re-identification map is sealed with its own key, never the OpenAI API key.
// Synthetic data and random keys only. No disk, network, Keychain or product wiring.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createPseudonymStore} from '../server/privacy/pseudonyms.mjs';
import {createPseudonymSealer} from '../server/privacy/pseudonym-persistence.mjs';
import {createOpenAiProvider} from '../server/providers/openai.mjs';

const full = {workspaceId:'W1', matterId:'M1', threadId:'T1'};
const scope = {workspaceId:'W1', matterId:'M1'};
const NAME = 'Maria Fernanda Ortega Quintero';
function sealedSnapshot(key) {
 const store = createPseudonymStore();
 store.protect({scope:full, messages:[{role:'user', content:`Cliente ${NAME}`}], entities:[NAME]});
 return createPseudonymSealer({key}).seal({scope, snapshot:store.exportSnapshot({scope:full})});
}

test('sealed map holds no original text, and only its own key opens it', () => {
 const mapKey = randomBytes(32), sealed = sealedSnapshot(mapKey);
 assert.ok(!JSON.stringify(sealed).includes('Ortega') && !JSON.stringify(sealed).includes('Maria'));
 assert.equal(createPseudonymSealer({key:mapKey}).open({scope, sealed}).entries[0].text, NAME);
 assert.throws(() => createPseudonymSealer({key:randomBytes(32)}).open({scope, sealed}), {code:'authentication_failed'});
});

test('an API-key-shaped secret can never be used as the map key', () => {
 const apiKey = 'sk-' + 'a'.repeat(48);
 for (const bad of [apiKey, Buffer.from(apiKey), Buffer.from(apiKey).toString('hex')]) {
  assert.throws(() => createPseudonymSealer({key:bad}), {code:'invalid_key'});
 }
});

test('the sealed map is bound to its matter and cannot be transplanted', () => {
 const key = randomBytes(32), sealed = sealedSnapshot(key), other = {workspaceId:'W1', matterId:'M2'};
 assert.throws(() => createPseudonymSealer({key}).open({scope:other, sealed}), {code:'scope_mismatch'});
 assert.throws(() => createPseudonymSealer({key}).open({scope, sealed:{...sealed, scope:other}}), {code:'scope_mismatch'});
});

test('the OpenAI provider exposes no map material and takes no map key', () => {
 const provider = createOpenAiProvider({enabled:false, model:'test-model', getApiKey:async () => { throw new Error('must not be read'); }});
 assert.deepEqual(Object.keys(provider).filter(k => /map|seal|snapshot|pseudonym/i.test(k)), []);
});
