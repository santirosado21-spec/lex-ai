// H3 sealed-snapshot persistence prep. AES-256-GCM over canonical JSON snapshots
// with scope-bound AAD. The trusted caller owns the key (provisioning/storage is
// H6b, out of scope here) and decides where sealed bytes live; this module only
// produces and opens the sealed representation. Synthetic-only, like H3 itself.
// No disk, network, product wiring, key derivation from passwords, or key storage.
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {canonicalJson} from '../canonical-json.mjs';

export const PSEUDONYM_PERSISTENCE_VERSION = 'h3-sealed-snapshot-v1';
// H3 snapshots are bounded by the store itself (<=256 entries, text <=1024 each),
// so canonical plaintext stays far below this ceiling. Sealed input beyond it is garbage.
const MAX_PLAINTEXT_CHARS = 131072;
const MAX_SEALED_CHARS = 262144;
const error = code => Object.assign(new Error('Persistencia cifrada de correspondencias no disponible o inválida.'),{name:'PseudonymPersistenceError',code});
const fail = code => { throw error(code); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value,allowed) => object(value) && Object.keys(value).every(key => allowed.includes(key));
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(value);
const strictB64 = value => typeof value === 'string' && value.length > 0 && value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value) && Buffer.from(value,'base64').toString('base64') === value;
const pair = scope => {
 if (!keys(scope,['workspaceId','matterId']) || !['workspaceId','matterId'].every(key => id(scope[key]))) fail('invalid_scope');
 return {workspaceId:scope.workspaceId, matterId:scope.matterId};
};
const copy = value => { try { return JSON.parse(canonicalJson(value)); } catch { fail('invalid_sealed'); } };

/**
 * seal({scope,snapshot}) authenticates and encrypts an exportSnapshot() plaintext object.
 * The snapshot's own declared scope must equal the requested {workspaceId,matterId} pair,
 * and that pair is ALSO bound as GCM AAD: rewriting the outer scope field of a sealed
 * blob to transplant it into another matter fails authentication, not just comparison.
 *
 * open({scope,sealed}) validates the envelope shape and scope BEFORE touching the key,
 * then authenticates and decrypts. Structural problems are fixed-code invalid_sealed /
 * scope_mismatch; any authentication or decryption failure is a single fixed
 * authentication_failed with no partial plaintext, no imported state and no detail.
 */
export function createPseudonymSealer({key} = {}) {
 if (!Buffer.isBuffer(key) || key.length !== 32) fail('invalid_key');
 const aad = scopePair => Buffer.from(canonicalJson([PSEUDONYM_PERSISTENCE_VERSION,scopePair]),'utf8');
 return Object.freeze({
  version: PSEUDONYM_PERSISTENCE_VERSION,
  seal(input) {
   if (!keys(input,['scope','snapshot'])) fail('invalid_request');
   const scopePair = pair(input.scope);
   let plaintext;
   try { plaintext = canonicalJson(input.snapshot); } catch { fail('invalid_snapshot'); }
   if (plaintext.length > MAX_PLAINTEXT_CHARS) fail('capacity');
   let declared;
   try { declared = JSON.parse(plaintext); } catch { fail('invalid_snapshot'); }
   if (!object(declared) || canonicalJson(declared.scope) !== canonicalJson(scopePair)) fail('scope_mismatch');
   const iv = randomBytes(12);
   const cipher = createCipheriv('aes-256-gcm',key,iv);
   cipher.setAAD(aad(scopePair));
   const ciphertext = Buffer.concat([cipher.update(plaintext,'utf8'),cipher.final()]);
   return Object.freeze({format:1,version:PSEUDONYM_PERSISTENCE_VERSION,scope:scopePair,
    iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')});
  },
  open(input) {
   if (!keys(input,['scope','sealed'])) fail('invalid_request');
   const scopePair = pair(input.scope);
   const sealed = copy(input.sealed);
   if (canonicalJson(sealed).length > MAX_SEALED_CHARS) fail('invalid_sealed');
   if (!keys(sealed,['format','version','scope','iv','tag','ciphertext']) || Object.keys(sealed).length !== 6 ||
       sealed.format !== 1 || sealed.version !== PSEUDONYM_PERSISTENCE_VERSION) fail('invalid_sealed');
   if (canonicalJson(sealed.scope) !== canonicalJson(scopePair)) fail('scope_mismatch');
   if (!strictB64(sealed.iv) || !strictB64(sealed.tag) || !strictB64(sealed.ciphertext)) fail('invalid_sealed');
   const iv = Buffer.from(sealed.iv,'base64'), tag = Buffer.from(sealed.tag,'base64'), ciphertext = Buffer.from(sealed.ciphertext,'base64');
   if (iv.length !== 12 || tag.length !== 16 || ciphertext.length < 1) fail('invalid_sealed');
   let plaintext;
   try {
    const decipher = createDecipheriv('aes-256-gcm',key,iv);
    decipher.setAAD(aad(scopePair));
    decipher.setAuthTag(tag);
    plaintext = Buffer.concat([decipher.update(ciphertext),decipher.final()]).toString('utf8');
   } catch { fail('authentication_failed'); }
   let snapshot;
   try { snapshot = JSON.parse(plaintext); } catch { fail('invalid_snapshot'); }
   if (!object(snapshot) || canonicalJson(snapshot.scope) !== canonicalJson(scopePair)) fail('invalid_snapshot');
   return snapshot;
  }
 });
}
