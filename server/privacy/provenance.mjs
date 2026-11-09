// Opt-in, in-memory H4b provenance. This is an application capability, never a tool
// exposed to documents or models. No storage, encryption, remote inference or grant.
import {createHash} from 'node:crypto';
import {canonicalJson} from '../canonical-json.mjs';

export const PROVENANCE_VERSION = 'local-provenance-v1';
const classes = ['public','synthetic','private','unknown'];
const fields = ['workspaceId','matterId','threadId'];
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const only = (value, keys) => object(value) && Object.keys(value).every(key => keys.includes(key));
export const validPrivacyScope = scope => only(scope,fields) && fields.every(key => identifier(scope[key]));
export const samePrivacyScope = (a,b) => validPrivacyScope(a) && validPrivacyScope(b) && fields.every(key => a[key] === b[key]);
export const privacyTextHash = text => createHash('sha256').update(text,'utf8').digest('hex');
const copy = value => JSON.parse(canonicalJson(value));
const freeze = value => { if (object(value) || Array.isArray(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const fail = code => { throw Object.assign(new Error('Procedencia local no verificable.'),{name:'PrivacyProvenanceError',code}); };
const digest = /^[a-f0-9]{64}$/;
const statuses = ['complete','partial','unsupported','failed'];
const assessments = ['known','ambiguous','failed'];
const boundary = (text,n) => !(n > 0 && n < text.length && /[\uD800-\uDBFF]/.test(text[n-1]) && /[\uDC00-\uDFFF]/.test(text[n]));
export const validPrivacyRange = (text,start,end) => Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end > start && end <= text.length && boundary(text,start) && boundary(text,end);

/**
 * Only trusted local application builders may hold this registry. Caller-supplied
 * originScope/classification flags are deliberately not segment authority. Each
 * registration binds original-byte hash, exact extracted text, extractor/version,
 * field path and immutable object version. Roots are local trust decisions, not
 * inferred public status. Derivatives cannot downgrade a parent's treatment.
 *
 * registerSource / deriveSource return {reference,segments,classification}; references
 * are local-only {objectId,version,hash}. Segment handles are copied and revalidated
 * on every resolve, including all current ancestors. Updating a root invalidates
 * outstanding old descendants rather than silently interpreting their old text.
 * Parent graphs are capped at 64 ancestors deep; an update cannot depend on an
 * older version of its own object (which would invalidate its own provenance).
 * No source can be overwritten or an old version made current again.
 */
export function createProvenanceRegistry() {
 const records = new Map(), current = new Map();
 const key = ref => canonicalJson([ref.objectId,ref.version]);
 const checkRef = ref => {
  if (!only(ref,['objectId','version','hash']) || !identifier(ref.objectId) || !identifier(ref.version) || !digest.test(ref.hash)) fail('unknown_provenance');
  const record = records.get(key(ref));
  if (!record || record.hash !== ref.hash || current.get(ref.objectId) !== ref.version) fail('unknown_provenance');
  return record;
 };
 const ancestry = (ref,scope,seen=new Set(),checked=new Set()) => {
  const record = checkRef(ref);
  if (!samePrivacyScope(record.scope,scope)) fail('scope_mismatch');
  if (seen.has(key(ref)) || seen.size >= 64) fail('unknown_provenance');
  if (checked.has(key(ref))) return record;
  seen.add(key(ref));
  for (const parent of record.parents) ancestry(parent,scope,seen,checked);
  seen.delete(key(ref));checked.add(key(ref));
  if (record.classification === 'unknown') fail('unknown_provenance');
  return record;
 };
 const register = (input,derived) => {
  let value;
  try { value=copy(input); } catch { fail('unknown_provenance'); }
  if (!only(value,['objectId','version','scope','classification','extraction','segments','parents','assessment']) ||
      !identifier(value.objectId) || !identifier(value.version) || !validPrivacyScope(value.scope) || !classes.includes(value.classification) ||
      !only(value.extraction,['status','extractorVersion','originalSha256']) || !statuses.includes(value.extraction.status) ||
      !identifier(value.extraction.extractorVersion) || !digest.test(value.extraction.originalSha256) ||
      !Array.isArray(value.segments) || !value.segments.length || value.segments.length > 256 ||
      !assessments.includes(value.assessment ?? 'known')) fail('unknown_provenance');
  if (records.has(key(value)) || records.size >= 2048) fail('unknown_provenance');
  if (derived ? !Array.isArray(value.parents) || !value.parents.length || value.parents.length > 64 : Object.hasOwn(value,'parents')) fail('unknown_provenance');
  const ids=new Set();
  let length=0;
  for (const segment of value.segments) {
   if (!only(segment,['id','path','text','structural','scalarType']) || !identifier(segment.id) || ids.has(segment.id) ||
       typeof segment.path !== 'string' || !segment.path.length || segment.path.length > 1024 ||
       typeof segment.text !== 'string' || Object.hasOwn(segment,'structural') && typeof segment.structural !== 'boolean' ||
       Object.hasOwn(segment,'scalarType') && !['number','boolean','null'].includes(segment.scalarType)) fail('unknown_provenance');
   if (Object.hasOwn(segment,'scalarType')) {
    let scalar;try {scalar=JSON.parse(segment.text);}catch {fail('unknown_provenance');}
    if (segment.scalarType==='null' ? scalar!==null : typeof scalar!==segment.scalarType) fail('unknown_provenance');
    if (canonicalJson(scalar)!==segment.text) fail('unknown_provenance');
   }
   ids.add(segment.id);length+=segment.text.length+segment.path.length;
   if (length > 65536) fail('unknown_provenance');
  }
  const parents=derived?value.parents:[];
  const parentRecords=parents.map(parent=>ancestry(parent,value.scope,new Set([key(value)])));
  const visitedParents=new Set();
  const checkLineage=ref=>{
   if(visitedParents.has(key(ref)))return;visitedParents.add(key(ref));
   const ancestor=checkRef(ref);
   if(ancestor.objectId===value.objectId)fail('unknown_provenance');
   ancestor.parents.forEach(checkLineage);
  };
  parents.forEach(checkLineage);
  const classification=classes[Math.max(classes.indexOf(value.classification),...parentRecords.map(parent=>classes.indexOf(parent.classification)))];
  const record={formatVersion:PROVENANCE_VERSION,objectId:value.objectId,version:value.version,scope:value.scope,classification,
   extraction:value.extraction,assessment:value.assessment ?? 'known',parents,
   segments:value.segments.map(segment=>({...segment,textSha256:privacyTextHash(segment.text)}))};
  const hash=privacyTextHash(canonicalJson(record));
  const reference={objectId:record.objectId,version:record.version,hash};
  const handles=record.segments.map(({textSha256,...segment})=>({...segment,provenance:{...reference,textSha256}}));
  records.set(key(reference),freeze({...record,hash}));current.set(record.objectId,record.version);
  return freeze({reference,segments:handles,classification});
 };
 return Object.freeze({
  registerSource: input => register(input,false),
  deriveSource: input => register(input,true),
  resolve({scope,segment}) {
   let handle,scopeCopy;
   try { handle=copy(segment);scopeCopy=copy(scope); } catch { fail('unknown_provenance'); }
   if (!validPrivacyScope(scopeCopy)) fail('scope_mismatch');
   if (!only(handle,['id','path','text','structural','scalarType','provenance']) || !only(handle.provenance,['objectId','version','hash','textSha256'])) fail('unknown_provenance');
   const {textSha256,...reference}=handle.provenance;
   const record=ancestry(reference,scopeCopy), stored=record.segments.find(item=>item.id===handle.id);
   if (!stored || !digest.test(textSha256) || stored.textSha256!==textSha256 || typeof handle.text !== 'string' || privacyTextHash(handle.text)!==textSha256) fail('unknown_provenance');
   // Explicit equality avoids trusting a recomputed digest alone for representation fields.
   if (handle.text!==stored.text || handle.path!==stored.path || handle.structural!==stored.structural || handle.scalarType!==stored.scalarType) fail('unknown_provenance');
   const ancestors=[];
   const collected=new Set();
   const collect=ref=>{if(collected.has(key(ref)))return;collected.add(key(ref));const item=checkRef(ref);ancestors.push(item);item.parents.forEach(collect);};
   collect(reference);
   const extractionStatus=ancestors.some(item=>item.extraction.status==='failed')?'failed':ancestors.some(item=>item.extraction.status==='unsupported')?'unsupported':ancestors.some(item=>item.extraction.status==='partial')?'partial':'complete';
   const assessment=ancestors.some(item=>item.assessment==='failed')?'failed':ancestors.some(item=>item.assessment==='ambiguous')?'ambiguous':'known';
   return freeze({scope:copy(record.scope),classification:record.classification,extractionStatus,assessment,reference:copy(reference),segment:copy(handle)});
  },
 });
}

/** Enumerate every JSON string/scalar value AND structural key; JSON Pointer paths preserve
 * identity without pretending keys are safe. Numeric segments describe the exact
 * JSON lexeme, never reconstructed account digits (leading zeroes/precision may
 * already have been lost before this boundary). Caller registers returned segments via
 * the trusted builder. This helper grants neither provenance nor public treatment. */
export function segmentsFromEnvelope(envelope) {
 const value=copy(envelope),segments=[];
 const escape=key=>key.replaceAll('~','~0').replaceAll('/','~1');
 const add=(path,text,structural=false,scalarType)=>segments.push({id:`SEG_${segments.length}`,path:path || '/',text,structural,...(scalarType?{scalarType}:{})});
 const walk=(item,path)=>{
  if (typeof item==='string') add(path,item);
  else if (item===null || typeof item==='number' || typeof item==='boolean') add(path,canonicalJson(item),false,item===null?'null':typeof item);
  else if (Array.isArray(item)) item.forEach((child,index)=>walk(child,`${path}/${index}`));
  else if (object(item)) for(const [name,child] of Object.entries(item)) {
   const childPath=`${path}/${escape(name)}`;
   add(`${childPath}/@key`,name,true);walk(child,childPath);
  }
 };
 walk(value,'');
 if (!segments.length || segments.length>256) fail('unknown_provenance');
 return segments;
}
