// Inactive native-label diagnostics. No model, tokenizer, production detector or provider imports.
import { createHash } from 'node:crypto';
export const NYM_ID = 'nym-int8-native-decoder-v3';
export const NYM_PINS = Object.freeze({revision:'4348999cd3c2e20c49615e9af7c6bbb45b64cd85',modelSha256:'139006aea2cbd8e709d322f056232570de54661f624143be4893aaa387190286',tokenizerSha256:'c299144e68dfec1dc536204a7ae3712710c5c6cade9269a83f5042250d47d8de'});
export const NYM_KINDS = Object.freeze(['ACCOUNT_NUMBER','AGE','API_KEY','BUILDING_NUMBER','CITY','COMPANY_NAME','COUNTRY','CREDIT_DEBIT_CARD','CUSTOMER_ID','CVV','DATE','DATE_OF_BIRTH','DRIVERS_LICENSE','EMAIL','EMPLOYEE_ID','FAX_NUMBER','GENDER','GIVEN_NAME','GOVERNMENT_ID','IBAN','LICENSE_PLATE','MAC_ADDRESS','MEDICAL_RECORD_NUMBER','PASSPORT','PASSWORD','PHONE','PIN','ROUTING_NUMBER','SECONDARY_ADDRESS','SSN','STATE','STREET_ADDRESS','STREET_NAME','SURNAME','SWIFT_BIC','TAX_ID','TIME','URL','USERNAME','ZIP_CODE']);
export const NYM_LABELS = Object.freeze(['O',...NYM_KINDS.flatMap(k=>[`B-${k}`,`I-${k}`])]);
const codes = new Set(['INPUT','SHAPE','OVERFLOW','SPECIAL','UNK','CONTROL','OFFSET','OVERLAP','COVERAGE','NONFINITE','TIE','LOW_CONFIDENCE','BIO_ORPHAN','BIO_KIND','BIO_GAP','CONTENT','UNKNOWN']);
const fail = code => { throw Object.assign(new Error(code),{code}); };
const exact = (o,keys) => o && typeof o==='object' && !Array.isArray(o) && Object.keys(o).sort().join('|')===keys.toSorted().join('|');
const integer = x => Number.isSafeInteger(x);
const white = c => /^[\u0009-\u000d\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]$/u.test(c);
export function originalCoordinates(text) {
 if(typeof text!=='string'||!text.length||Buffer.byteLength(text)>16384)fail('INPUT');
 const chars=[...text],utf16=[0],utf8=[0];
 for(const c of chars){const n=c.codePointAt(0);if(n>=0xd800&&n<=0xdfff)fail('INPUT');utf16.push(utf16.at(-1)+c.length);utf8.push(utf8.at(-1)+Buffer.byteLength(c));}
 return {chars,utf16,utf8};
}
export function validateNymEncoding(text,e,inventory){
 const c=originalCoordinates(text);
 if(!exact(e,['ids','offsets','specialMask','attentionMask','typeIds','sequenceIds','overflowing','offsetUnit']))fail('SHAPE');
 if(e.offsetUnit!=='unicode-codepoint'||!Array.isArray(e.overflowing)||e.overflowing.length)fail('OVERFLOW');
 const n=e.ids?.length;if(!integer(n)||n<3||n>512)fail('OVERFLOW');
 for(const k of ['ids','offsets','specialMask','attentionMask','typeIds','sequenceIds'])if(!Array.isArray(e[k])||e[k].length!==n)fail('SHAPE');
 let last=0;const covered=new Set();
 for(let i=0;i<n;i++){
  const id=e.ids[i],pair=e.offsets[i],special=i===0||i===n-1;
  if(!integer(id)||id<0||id>198803)fail('SHAPE');
  if(e.attentionMask[i]!==1||e.typeIds[i]!==0||e.specialMask[i]!==Number(special)||e.sequenceIds[i] !== (special?null:0))fail('SPECIAL');
  if(!Array.isArray(pair)||pair.length!==2||!pair.every(integer))fail('OFFSET');
  const [a,b]=pair;
  if(special){if(id!==(i===0?2:1)||a!==0||b!==0)fail('SPECIAL');continue;}
  if(id===3)fail('UNK');
  // Actual pinned added-token metadata: placeholders/specials, toxicity marker, unused99.
  // Whitespace runs108..168/198773..198802 and ordinary markup169..216 are not all specials.
  if(id<=107||id===198772||id===198803)fail('CONTROL');
  if(!(0<=a&&a<b&&b<=c.chars.length))fail('OFFSET');
  if(a<last)fail('OVERLAP');last=b;
  for(let j=a;j<b;j++)covered.add(j);
  if(id>=108&&id<=138&&c.chars.slice(a,b).join('')!=='\n'.repeat(id-107))fail('OFFSET');
  if(id>=139&&id<=168&&c.chars.slice(a,b).join('')!==' '.repeat(id-137))fail('OFFSET');
  if(id>=198773&&id<=198802&&c.chars.slice(a,b).join('')!=='\t'.repeat(id-198771))fail('OFFSET');
 }
 if(c.chars.some((ch,i)=>!white(ch)&&!covered.has(i)))fail('COVERAGE');
 witnessContent(c,e,inventory);return c;
}
export function decodeNymNative({text,encoding,logits,inventory}={}){
 const prefix=[];let phase='INPUT';
 const base={version:1,candidateId:NYM_ID,diagnosticOnly:true,egressEligible:false,mappingApproved:false,protectionPlan:null,detections:[],offsetContractValidated:false};
 let provenance=null;
 try{
  phase='ENCODING';const c=validateNymEncoding(text,encoding,inventory);
  provenance={...NYM_PINS,textSha256:createHash('sha256').update(text).digest('hex')};
  phase='LOGITS';const n=encoding.ids.length;
  if(!Array.isArray(logits)||logits.length!==1||!Array.isArray(logits[0])||logits[0].length!==n)fail('SHAPE');
  let active=null;
  const flush=()=>{if(active){prefix.push({...active,provenance:{...provenance}});active=null;}};
  for(let i=0;i<n;i++){
   const row=logits[0][i];if(!Array.isArray(row)||row.length!==81)fail('SHAPE');
   if(row.some(x=>typeof x!=='number'||!Number.isFinite(x)))fail('NONFINITE');
   const max=Math.max(...row),winners=row.flatMap((x,j)=>x===max?[j]:[]);if(winners.length!==1)fail('TIE');
   if(encoding.specialMask[i]){flush();continue;}
   const denominator=row.reduce((sum,x)=>sum+Math.exp(x-max),0),score=1/denominator;
   if(!Number.isFinite(score)||score<0.4)fail('LOW_CONFIDENCE');
   const label=NYM_LABELS[winners[0]],[a,b]=encoding.offsets[i];
   phase='BIO';
   if(label==='O'){flush();continue;}
   const kind=label.slice(2);
   if(label.startsWith('B-')){flush();active={kind,start:c.utf16[a],end:c.utf16[b],codepointStart:a,codepointEnd:b,utf8Start:c.utf8[a],utf8End:c.utf8[b],tokenStart:i,tokenEnd:i+1,score};}
   else{
    if(!active)fail('BIO_ORPHAN');if(active.kind!==kind)fail('BIO_KIND');
    if(c.chars.slice(active.codepointEnd,a).some(ch=>!white(ch)))fail('BIO_GAP');
    Object.assign(active,{end:c.utf16[b],codepointEnd:b,utf8End:c.utf8[b],tokenEnd:i+1,score:Math.min(active.score,score)});
   }
  }
  flush();return {...base,status:'native-complete',failure:null,phase:'COMPLETE',nativeSpans:prefix,validatedPrefix:[],scannedTokens:n};
 }catch(error){return {...base,status:'blocked',failure:codes.has(error?.code)?error.code:'UNKNOWN',phase,nativeSpans:[],validatedPrefix:prefix,scannedTokens:null};}
}
// Parent reconstruction is from its immutable text/encoding/logits, never a model proof claim.
export function validateNymNativeResult(value,input){
 const expected=decodeNymNative(input);
 if(JSON.stringify(value)!==JSON.stringify(expected))throw Error('NATIVE_RESULT_MISMATCH');
 return expected;
}

// Inventory handles cannot be supplied as ordinary IPC objects. Tests have an explicit
// separate tiny factory; deployed loading admits only exact pinned full bytes.
const inventories=new WeakMap();
function inventoryHandle(vocab,added){
 const raw=new Map(),extras=new Map();
 for(const [token,id] of Object.entries(vocab)){if(!integer(id)||raw.has(id)||typeof token!=='string')fail('CONTENT');raw.set(id,token);}
 for(const entry of added){if(!integer(entry.id)||extras.has(entry.id)||raw.get(entry.id)!==entry.content)fail('CONTENT');extras.set(entry.id,Object.freeze({...entry}));}
 const handle=Object.freeze({});inventories.set(handle,{raw,extras});return handle;
}
export function tinyInventoryForTests(vocab,added=[]){if(Object.keys(vocab).length>64)fail('CONTENT');return inventoryHandle(vocab,added);}
// This pure module has no filesystem/runtime route. Production inventory is loaded
// by the supervised Python stream reader. Explicit bytes API remains reject-only.
export function pinnedInventoryFromBytes(){fail('CONTENT');}

function witnessContent(c,e,handle){
 const inv=inventories.get(handle);if(!inv||c.chars.includes('▁'))fail('CONTENT');
 let pieceStart=0,first=true;
 for(let i=1;i<e.ids.length-1;i++){
  const id=e.ids[i],[a,b]=e.offsets[i],slice=c.chars.slice(a,b).join(''),raw=inv.raw.get(id),added=inv.extras.get(id);
  if(typeof raw!=='string')fail('CONTENT');
  const ordinarySpaceRun=id>=139&&id<=168&&added&&['special','normalized','lstrip','rstrip','single_word'].every(k=>added[k]===false)&&added.id===id&&added.content===raw&&raw==='▁'.repeat(id-137)&&slice===' '.repeat(id-137);
  if(added&&!ordinarySpaceRun){
   if(!['special','normalized','lstrip','rstrip','single_word'].every(k=>added[k]===false)||![...added.content].length||![...added.content].every(white)||slice!==added.content)fail('CONTENT');
   pieceStart=b;first=true;continue;
  }
  if(/^<0x[0-9A-F]{2}>$/.test(raw)){
   const byte=parseInt(raw.slice(3,5),16);
   if(first||byte>127||slice!==String.fromCharCode(byte))fail('CONTENT');continue;
  }
  const normalized=slice.replaceAll(' ','▁');
  if(first){if(a!==pieceStart||raw!==(slice.startsWith(' ')?normalized:'▁'+normalized))fail('CONTENT');first=false;}
  else if(raw!==normalized)fail('CONTENT');
 }
}
