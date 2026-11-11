import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {createPseudonymStore} from '../server/privacy/pseudonyms.mjs';
import {createPseudonymSealer,PSEUDONYM_PERSISTENCE_VERSION} from '../server/privacy/pseudonym-persistence.mjs';

const a={workspaceId:'FIRM_A',matterId:'MATTER_A',threadId:'THREAD_A'};
const b={workspaceId:'FIRM_A',matterId:'MATTER_B',threadId:'THREAD_B'};
const pairOf=scope=>({workspaceId:scope.workspaceId,matterId:scope.matterId});
const name='Persona sintética Álvarez 🧪';
const org='Cooperativa Sintética del Desierto';
const key=randomBytes(32);
const assertCode=(fn,code)=>assert.throws(fn,error=>error.name==='PseudonymPersistenceError'&&error.code===code);

// Full restart cycle: protect in one store, seal the snapshot to bytes on disk,
// then recover markers in a brand-new store+sealer that only know the key.
function seedStore() {
 const store=createPseudonymStore();
 const out=store.protect({scope:a,messages:[{role:'user',content:`${name} demandó a ${org}. ${name} insistió.`}],entities:[name,org]});
 return {store,out};
}

test('sealed snapshot survives a real file round-trip and restores markers in a fresh store and sealer',()=>{
 const {store,out}=seedStore();
 const snapshot=store.exportSnapshot({scope:a});
 const sealed=createPseudonymSealer({key}).seal({scope:pairOf(a),snapshot});
 const file=path.join(mkdtempSync(path.join(tmpdir(),'h3-sealed-')),'snapshot.json');
 writeFileSync(file,JSON.stringify(sealed));
 const reopened=createPseudonymSealer({key}).open({scope:pairOf(a),sealed:JSON.parse(readFileSync(file,'utf8'))});
 const revived=createPseudonymStore();
 assert.deepEqual(revived.importSnapshot({scope:a,snapshot:reopened}),{mappingVersion:out.mappingVersion});
 assert.equal(revived.restore({scope:a,text:out.messages[0].content,mappingVersion:out.mappingVersion}),`${name} demandó a ${org}. ${name} insistió.`);
 // The revived store keeps working: same entities reuse the recovered mapping version.
 const again=revived.protect({scope:a,messages:[{role:'user',content:`${name} volvió.`}],entities:[name,org]});
 assert.equal(again.mappingVersion,out.mappingVersion);
 assert.match(again.messages[0].content,/^\[\[LEX_[a-f0-9]{32}_[a-f0-9]{32}\]\] volvió\.$/);
});

test('seal binds the snapshot-declared scope: a mismatched pair never reaches the cipher',()=>{
 const {store}=seedStore();
 const snapshot=store.exportSnapshot({scope:a});
 const sealer=createPseudonymSealer({key});
 assertCode(()=>sealer.seal({scope:pairOf(b),snapshot}),'scope_mismatch');
 assertCode(()=>sealer.seal({scope:{workspaceId:'FIRM_A'},snapshot}),'invalid_scope');
});

test('open validates the envelope and requested scope before any decryption',()=>{
 const {store}=seedStore();
 const sealed=createPseudonymSealer({key}).seal({scope:pairOf(a),snapshot:store.exportSnapshot({scope:a})});
 const sealer=createPseudonymSealer({key});
 assertCode(()=>sealer.open({scope:pairOf(b),sealed}),'scope_mismatch');
 assertCode(()=>sealer.open({scope:pairOf(a),sealed:{...sealed,version:'otro'}}),'invalid_sealed');
 assertCode(()=>sealer.open({scope:pairOf(a),sealed:{...sealed,extra:1}}),'invalid_sealed');
 assertCode(()=>sealer.open({scope:pairOf(a),sealed:{...sealed,iv:'!!'}}),'invalid_sealed');
 assertCode(()=>sealer.open({scope:pairOf(a),sealed:'no-es-objeto'}),'invalid_sealed');
 assertCode(()=>sealer.open({scope:pairOf(a),sealed:{format:1,version:PSEUDONYM_PERSISTENCE_VERSION,scope:pairOf(a),iv:sealed.iv,tag:sealed.tag,ciphertext:''}}),'invalid_sealed');
});

test('wrong key, flipped ciphertext/tag/iv bytes and outer-scope transplant all fail authentication with no plaintext',()=>{
 const {store,out}=seedStore();
 const sealed=createPseudonymSealer({key}).seal({scope:pairOf(a),snapshot:store.exportSnapshot({scope:a})});
 const flip=text=>{const bytes=Buffer.from(text,'base64');bytes[0]^=1;return bytes.toString('base64');};
 assertCode(()=>createPseudonymSealer({key:randomBytes(32)}).open({scope:pairOf(a),sealed}),'authentication_failed');
 assertCode(()=>createPseudonymSealer({key}).open({scope:pairOf(a),sealed:{...sealed,ciphertext:flip(sealed.ciphertext)}}),'authentication_failed');
 assertCode(()=>createPseudonymSealer({key}).open({scope:pairOf(a),sealed:{...sealed,tag:flip(sealed.tag)}}),'authentication_failed');
 assertCode(()=>createPseudonymSealer({key}).open({scope:pairOf(a),sealed:{...sealed,iv:flip(sealed.iv)}}),'authentication_failed');
 // Rewriting only the outer scope field to transplant the blob into matter B passes the
 // envelope check but must fail AAD authentication, never import foreign markers.
 const transplanted={...sealed,scope:pairOf(b)};
 assertCode(()=>createPseudonymSealer({key}).open({scope:pairOf(b),sealed:transplanted}),'authentication_failed');
 assert.throws(()=>store.restore({scope:a,text:out.messages[0].content,mappingVersion:'0'.repeat(32)}),/no disponible|inválida/);
});

test('failed opens never mutate the receiving store and keys are shape-checked',()=>{
 assertCode(()=>createPseudonymSealer({key:randomBytes(16)}),'invalid_key');
 assertCode(()=>createPseudonymSealer({key:'x'.repeat(32)}),'invalid_key');
 const revived=createPseudonymStore();
 const {store}=seedStore();
 const sealed=createPseudonymSealer({key}).seal({scope:pairOf(a),snapshot:store.exportSnapshot({scope:a})});
 assertCode(()=>createPseudonymSealer({key:randomBytes(32)}).open({scope:pairOf(a),sealed}),'authentication_failed');
 assert.throws(()=>revived.exportSnapshot({scope:a}),error=>error.name==='PseudonymError'&&error.code==='unknown_scope');
});

test('seal caps pathological snapshots and open caps pathological envelopes',()=>{
 const {store}=seedStore();
 const snapshot=store.exportSnapshot({scope:a});
 const huge={...snapshot,entries:[...snapshot.entries,{text:'x'.repeat(131073),marker:'[[LEX_'+'a'.repeat(32)+'_'+'b'.repeat(32)+']]'}]};
 assertCode(()=>createPseudonymSealer({key}).seal({scope:pairOf(a),snapshot:huge}),'capacity');
 const sealed=createPseudonymSealer({key}).seal({scope:pairOf(a),snapshot});
 assertCode(()=>createPseudonymSealer({key}).open({scope:pairOf(a),sealed:{...sealed,ciphertext:Buffer.alloc(262144).toString('base64')}}),'invalid_sealed');
});
