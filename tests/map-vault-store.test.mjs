// Temp directories, random keys and synthetic data only. No real Keychain, no user files, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readdirSync, readFileSync, writeFileSync, statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {createPseudonymStore} from '../server/privacy/pseudonyms.mjs';
import {createMapVaultStore} from '../server/privacy/map-vault-store.mjs';

const full = {workspaceId:'W1', matterId:'M1', threadId:'T1'}, scope = {workspaceId:'W1', matterId:'M1'};
const NAME = 'Zoilo Hernández Barrientos';
const holder = {key:randomBytes(32)};
const getKey = async () => { if (!holder.key) throw new Error('missing'); return Buffer.from(holder.key); };
const dirOf = () => path.join(mkdtempSync(path.join(tmpdir(), 'mapvault-')), 'maps');
function seeded(dir = dirOf()) {
 const pseudonyms = createPseudonymStore();
 const out = pseudonyms.protect({scope:full, messages:[{role:'user', content:`Cliente ${NAME}`}], entities:[NAME]});
 return {dir, pseudonyms, out, store:createMapVaultStore({directory:dir, pseudonyms, getKey})};
}
const rejects = (p, code) => assert.rejects(p, e => e.name === 'MapVaultStoreError' && e.code === code && e.cause === undefined);

test('save writes one 0600 file with no client text, and a fresh process restores the map', async () => {
 holder.key = randomBytes(32);
 const {dir, store, out} = seeded();
 assert.deepEqual(await store.save({scope:full}), {saved:true});
 const files = readdirSync(dir); assert.equal(files.length, 1); assert.match(files[0], /^[a-f0-9]{64}\.sealed\.json$/);
 assert.equal(statSync(path.join(dir, files[0])).mode & 0o777, 0o600);
 assert.ok(!readFileSync(path.join(dir, files[0]), 'utf8').includes('Zoilo'));
 const fresh = createPseudonymStore();
 await createMapVaultStore({directory:dir, pseudonyms:fresh, getKey}).load({scope:full});
 assert.equal(fresh.restore({scope:full, text:out.messages[0].content, mappingVersion:out.mappingVersion}), `Cliente ${NAME}`);
});

test('missing key is an error: no file written, no key invented, existing file untouched', async () => {
 holder.key = randomBytes(32);
 const {dir, store} = seeded(); await store.save({scope:full});
 const file = path.join(dir, readdirSync(dir)[0]), before = readFileSync(file, 'utf8');
 holder.key = null;
 await rejects(store.save({scope:full}), 'key_unavailable');
 await rejects(createMapVaultStore({directory:dir, pseudonyms:createPseudonymStore(), getKey}).load({scope:full}), 'key_unavailable');
 assert.equal(readFileSync(file, 'utf8'), before); assert.deepEqual(readdirSync(dir), [path.basename(file)]);
});

test('a wrong key or tampered file imports nothing and never rewrites the file', async () => {
 holder.key = randomBytes(32);
 const {dir, store} = seeded(); await store.save({scope:full});
 const file = path.join(dir, readdirSync(dir)[0]), before = readFileSync(file, 'utf8');
 const target = createPseudonymStore();
 holder.key = randomBytes(32);
 await rejects(createMapVaultStore({directory:dir, pseudonyms:target, getKey}).load({scope:full}), 'open_failed');
 assert.throws(() => target.exportSnapshot({scope:full}), {code:'unknown_scope'});
 holder.key = null;
 const mid = JSON.parse(before); mid.ciphertext = Buffer.from('x').toString('base64'); writeFileSync(file, JSON.stringify(mid));
 const tampered = readFileSync(file, 'utf8');
 holder.key = Buffer.from(randomBytes(32));
 await rejects(createMapVaultStore({directory:dir, pseudonyms:createPseudonymStore(), getKey}).load({scope:full}), 'open_failed');
 assert.equal(readFileSync(file, 'utf8'), tampered);
});

test('a file for another matter is not read, and loading into an occupied matter fails without changes', async () => {
 holder.key = randomBytes(32);
 const {dir, store, pseudonyms} = seeded(); await store.save({scope:full});
 await rejects(store.load({scope:{workspaceId:'W1', matterId:'M2', threadId:'T1'}}), 'no_sealed_map');
 await rejects(store.load({scope:full}), 'import_failed');
 assert.ok(pseudonyms.exportSnapshot({scope:full}).entries.length === 1);
});

test('cancel before write leaves the previous sealed file intact and no temp file behind', async () => {
 holder.key = randomBytes(32);
 const {dir, store, pseudonyms} = seeded(); await store.save({scope:full});
 const file = path.join(dir, readdirSync(dir)[0]), before = readFileSync(file, 'utf8');
 pseudonyms.protect({scope:full, messages:[{role:'user', content:'Otro Nombre Largo'}], entities:['Otro Nombre Largo']});
 const controller = new AbortController(); controller.abort();
 await rejects(store.save({scope:full, signal:controller.signal}), 'cancelled');
 assert.equal(readFileSync(file, 'utf8'), before); assert.deepEqual(readdirSync(dir), [path.basename(file)]);
 await store.save({scope:full});
 assert.notEqual(readFileSync(file, 'utf8'), before); assert.equal(readdirSync(dir).length, 1);
});

test('remove deletes only this matter file, reports permanence, and is idempotent', async () => {
 holder.key = randomBytes(32);
 const {dir, store, pseudonyms} = seeded(); await store.save({scope:full});
 const other = {workspaceId:'W1', matterId:'M2'};
 pseudonyms.protect({scope:{...other, threadId:'T1'}, messages:[{role:'user', content:'Cliente Maria Soto Reyes'}], entities:['Maria Soto Reyes']});
 await store.save({scope:{...other, threadId:'T1'}}); assert.equal(readdirSync(dir).length, 2);
 assert.deepEqual(await store.remove({scope:full}), {removed:true, unrecoverable:true});
 assert.equal(readdirSync(dir).length, 1); assert.equal(await store.exists({scope:full}), false); assert.equal(await store.exists({scope:{...other, threadId:'T1'}}), true);
 assert.deepEqual(await store.remove({scope:full}), {removed:false});
});

test('invalid configuration and scopes are rejected', async () => {
 assert.throws(() => createMapVaultStore({directory:'relative', getKey, pseudonyms:createPseudonymStore()}), {code:'invalid_configuration'});
 await rejects(seeded().store.save({scope:{workspaceId:'../x', matterId:'M1', threadId:'T1'}}), 'invalid_scope');
});
