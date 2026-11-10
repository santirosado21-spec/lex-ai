// H5b.1 INACTIVE contract and memory fixture. No native bridge, encryption, or production store.
import { canonicalJson } from '../canonical-json.mjs';
import { searchTerms } from '../store.mjs';

export const VAULT_DAO_VERSION = 'h5b1-domain-fixture-v2';
export const VAULT_REMINDER_VERSION = 'h5b1-reminders-v1';
export const VAULT_PARITY_COMPLETE = false;
const rows = [
 ['get','partial','Exact scope; note/chat/document only; no unscoped legacy reads.'],
 ['list','partial','Exact scope; no workspace-wide enumeration or all legacy kinds.'],
 ['put','partial','Scoped note/chat CAS only; document mutations rejected.'],
 ['transaction','not-implemented','Callback RPC prohibited; each compound domain needs its own atomic operation.'],
 ['audit','not-implemented','Scoped audit domain/schema required.'],
 ...['createReminder','getReminder','listReminders','updateReminder'].map(name=>[name,'partial','Bounded matter-only reminder domain + internal atomic audit/CAS; canonical dates only, service authorization/planner integration pending.']),
 ...['createAgentProposal','getAgentProposal','listAgentProposals','updateAgentProposal','logAgentAction','listAgentActionLog'].map(name=>[name,'not-implemented','Proposal/decision/result/log compound atomic domain pending.']),
 ...['createTimeEntry','listTimeEntries','setTimeEntriesBillingStatus','getActiveTimer','putActiveTimer','deleteActiveTimer','getFeeArrangement','putFeeArrangement','getClientHourlyRate','putClientHourlyRate','getMatterResolution','putMatterResolution'].map(name=>[name,'not-implemented','Billing/timer/resolution constraints and compound atomic domains pending.']),
 ['insertDocument','partial','Atomic bytes/record/chunks/FTS; legacy audit and full provenance/manifest pending.'],
 ['original','supported-core','Exact bytes under exact scope; native SHA-256 check.'],
 ['search','partial','Native FTS5, scope-stable insertion order; fixture literal terms. Legacy BM25 ranking parity pending.'],
 ['firstChunks','supported-core','Scoped insertion-order chunks with bounded limit.'],
 ['close','supported-core','Native connection close; fixture state close. Product lock/cancellation is pending.'],
];
export const VAULT_STORE_PARITY = Object.freeze(rows.map(([api,status,reason])=>Object.freeze({api,status,reason})));
export const VAULT_REMOVED_ESCAPES = Object.freeze({db:'No raw SQL or connection handle.',createStore:'Replaced ONLY by fresh synthetic temp factory; no existing path allowed.',searchTerms:'Legacy helper reused in fixture; native normalization has a separate implementation pending exhaustive Unicode parity.'});

const fail=code=>{const e=Error(code);e.code=code;throw e;};
const identifier=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
function copy(value){try{return JSON.parse(canonicalJson(value));}catch{return fail('invalid_input');}}
function scope(value){const s=copy(value);if(!s||Array.isArray(s)||Object.keys(s).sort().join(',')!=='matterId,threadId,workspaceId'||!identifier(s.workspaceId)||!identifier(s.matterId)||(s.threadId!==null&&!identifier(s.threadId)))fail('invalid_scope');return s;}
const scopeKey=s=>JSON.stringify([s.workspaceId,s.matterId,s.threadId]);
function kind(k){if(!['note','chat','document'].includes(k))fail('not_implemented');return k;}
function id(value){if(!identifier(value))fail('invalid_input');return value;}
function limit(value){if(!Number.isInteger(value)||value<1||value>100)fail('invalid_input');return value;}
function record(s,entity){const e=copy(entity);if(!e||Array.isArray(e)||!identifier(e.id)||e.workspaceId!==s.workspaceId||e.matterId!==s.matterId||e.threadId!==s.threadId||Buffer.byteLength(canonicalJson(e))>2_000_000)fail('invalid_input');return e;}

function reminderScope(input){const s=scope(input);if(s.threadId!==null)fail('invalid_scope');return s;}
const reminderFields='createdAt,dueAt,id,kind,matterId,note,plannerRule,source,status,threadId,title,updatedAt,workspaceId';
function reminderDate(v,stamp=false){
 if(typeof v!=='string'||!(stamp?/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/:/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}\.\d{3}Z)?$/).test(v)||v.startsWith('0000'))return false;
 const iso=v.length===10?`${v}T00:00:00.000Z`:v;const n=Date.parse(iso);return Number.isFinite(n)&&new Date(n).toISOString()===iso;
}
function reminderText(v,min,max){return typeof v==='string'&&v.isWellFormed()&&!v.includes('\0')&&Buffer.byteLength(v)>=min&&Buffer.byteLength(v)<=max;}
function reminder(s,input){const r=record(s,input);if(Object.keys(r).sort().join(',')!==reminderFields||!['deadline','followup','draft-suggestion'].includes(r.kind)||!['proposed','approved','done','dismissed'].includes(r.status)||!['user','planner'].includes(r.source)||!reminderText(r.title,1,800)||!reminderText(r.note,0,16000)||(r.plannerRule!==null&&!reminderText(r.plannerRule,1,256))||(r.dueAt!==null&&!reminderDate(r.dueAt))||!reminderDate(r.createdAt,true)||!reminderDate(r.updatedAt,true))fail('invalid_input');return r;}
function page(count,offset){limit(count);if(!Number.isInteger(offset)||offset<0||offset>1_000_000)fail('invalid_input');}
const binary=(a,b)=>Buffer.compare(Buffer.from(a),Buffer.from(b));
function reminderOrder(a,b){return Number(a.dueAt===null)-Number(b.dueAt===null)||binary(a.dueAt??'',b.dueAt??'')||binary(a.title,b.title)||binary(a.id,b.id);}
function reminderAudit(s,r,revision,ordinal,update=false){return {workspaceId:s.workspaceId,matterId:s.matterId,revision,ordinal,operation:update?'reminder.update':r.source==='planner'?'planner.propose':'reminder.create',reminderId:r.id};}

/** Explicit in-memory fixture; not a persistence/encryption adapter. No key/path/SQL inputs. */
export function createVaultFixtureDao(){
 const scopes=new Map();let closed=false;
 function check(){if(closed)fail('closed');}
 function read(s){check();return scopes.get(scopeKey(s))??{revision:0,records:new Map(),originals:new Map(),chunks:[],reminders:new Map(),reminderAudits:[]};}
 function staged(s,expectedRevision){check();if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||expectedRevision>=Number.MAX_SAFE_INTEGER)fail('invalid_input');const old=read(s);if(old.revision!==expectedRevision)fail('conflict');return {revision:old.revision+1,records:new Map(old.records),originals:new Map(old.originals),chunks:old.chunks.slice(),reminders:new Map(old.reminders),reminderAudits:old.reminderAudits.slice()};}
 function publish(s,next){scopes.set(scopeKey(s),next);return next.revision;}
 return Object.freeze({
  async revision({scope:input}){return read(scope(input)).revision;},
  async get({scope:input,kind:k,id:identifier}){return copy(read(scope(input)).records.get(`${kind(k)}:${id(identifier)}`)??null);},
  async list({scope:input,kind:k}){const prefix=`${kind(k)}:`;return [...read(scope(input)).records].filter(([key])=>key.startsWith(prefix)).map(([,v])=>copy(v));},
  async put({scope:input,kind:k,entity,expectedRevision}){check();const s=scope(input);kind(k);if(k==='document')fail('invalid_input');const e=record(s,entity),next=staged(s,expectedRevision);next.records.set(`${k}:${e.id}`,e);return publish(s,next);},
  async insertDocument({scope:input,document,bytes,chunks,expectedRevision}){
   check();const s=scope(input),e=record(s,document),cs=copy(chunks);if(!(bytes instanceof Uint8Array)||bytes.byteLength>10*1024*1024||!Array.isArray(cs)||cs.length>1000||cs.some(c=>!c||!identifier(c.id)||typeof c.text!=='string'||Buffer.byteLength(c.text)>16_000||Object.keys(c).sort().join(',')!=='id,text'))fail('invalid_input');
   const next=staged(s,expectedRevision);if(next.records.has(`document:${e.id}`))fail('storage');next.records.set(`document:${e.id}`,e);next.originals.set(e.id,Buffer.from(bytes));
   for(const c of cs){if(next.chunks.some(existing=>existing.id===c.id))fail('storage');next.chunks.push({...c,documentId:e.id});}
   return publish(s,next);
  },
  async original({scope:input,documentId}){const b=read(scope(input)).originals.get(id(documentId));return b?Buffer.from(b):null;},
  async firstChunks({scope:input,limit:count=6}){return copy(read(scope(input)).chunks.slice(0,limit(count)));},
  async search({scope:input,query,limit:count=6}){const data=read(scope(input));limit(count);if(typeof query!=='string'||Buffer.byteLength(query)>16_000)fail('invalid_input');const terms=searchTerms(query);return copy(data.chunks.filter(c=>{const words=new Set(searchTerms(c.text));return terms.some(t=>words.has(t));}).slice(0,count));},
  async createReminders({scope:input,items,expectedRevision}){
   check();const s=reminderScope(input),batch=copy(items);if(!Array.isArray(batch)||batch.length<1||batch.length>100)fail('invalid_input');const rs=batch.map(r=>reminder(s,r)),next=staged(s,expectedRevision);
   for(const [ordinal,r] of rs.entries()){if(next.reminders.has(r.id))fail('storage');next.reminders.set(r.id,r);next.reminderAudits.push(reminderAudit(s,r,next.revision,ordinal));}return publish(s,next);
  },
  async getReminder({scope:input,id:identifier}){check();const s=reminderScope(input);return copy(read(s).reminders.get(id(identifier))??null);},
  async listReminders({scope:input,limit:count=100,offset=0}){check();const s=reminderScope(input);page(count,offset);return copy([...read(s).reminders.values()].sort(reminderOrder).slice(offset,offset+count));},
  async updateReminder({scope:input,reminder:item,expectedRevision}){check();const s=reminderScope(input),r=reminder(s,item),next=staged(s,expectedRevision),old=next.reminders.get(r.id);if(!old)fail('not_found');if(old.createdAt!==r.createdAt)fail('invalid_input');next.reminders.set(r.id,r);next.reminderAudits.push(reminderAudit(s,r,next.revision,0,true));return publish(s,next);},
  async listReminderAudits({scope:input,limit:count=100,offset=0}){check();const s=reminderScope(input);page(count,offset);return copy(read(s).reminderAudits.slice(offset,offset+count));},
  async close(){closed=true;scopes.clear();},
 });
}
