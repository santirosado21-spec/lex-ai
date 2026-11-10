// H5b.1 INACTIVE contract and memory fixture. No native bridge, encryption, or production store.
import { canonicalJson } from '../canonical-json.mjs';
import { searchTerms } from '../store.mjs';

export const VAULT_DAO_VERSION = 'h5b1-domain-fixture-v4';
export const VAULT_REMINDER_VERSION = 'h5b1-reminders-v1';
export const VAULT_PROPOSAL_VERSION = 'h5b1-proposals-v1';
export const VAULT_TIME_BILLING_VERSION = 'h5b1-time-billing-decimal-v1';
export const VAULT_PARITY_COMPLETE = false;
const rows = [
 ['get','partial','Exact scope; note/chat/document only; no unscoped legacy reads.'],
 ['list','partial','Exact scope; no workspace-wide enumeration or all legacy kinds.'],
 ['put','partial','Scoped note/chat CAS only; document mutations rejected.'],
 ['transaction','not-implemented','Callback RPC prohibited; each compound domain needs its own atomic operation.'],
 ['audit','not-implemented','Scoped audit domain/schema required.'],
 ...['createReminder','getReminder','listReminders','updateReminder'].map(name=>[name,'partial','Bounded matter-only reminder domain + internal atomic audit/CAS; canonical dates only, service authorization/planner integration pending.']),
 ...['createAgentProposal','getAgentProposal','listAgentProposals','updateAgentProposal','logAgentAction','listAgentActionLog'].map(name=>[name,'partial','Bounded matter-only proposals/decision/log atomic data domain; workspace-level scope and service side-effect transaction integration pending.']),
 ...['createTimeEntry','listTimeEntries','setTimeEntriesBillingStatus','getActiveTimer','putActiveTimer','deleteActiveTimer','getFeeArrangement','putFeeArrangement','getClientHourlyRate','putClientHourlyRate','getMatterResolution','putMatterResolution'].map(name=>[name,'partial','Exact matter-only decimal-string time/timer/fee/rate/resolution storage + atomic audit/CAS; legacy numeric conversion, workspace sharing and service calculations/integration pending.']),
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

const proposalFields='action,args,argsHash,createdAt,decidedAt,expiresAt,id,matterId,origin,result,status,threadId,workspaceId';
const actionFields='action,argsHash,createdAt,decision,matterId,origin,proposalId,threadId,workspaceId';
const writeActions=['reminder.create','document.import','answer.export','planner.propose'];
const readActions=['matter.list','research.search','reminder.list','planner.today'];
const argsHash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
function boundedData(v){let nodes=0;function visit(x,depth){if(++nodes>4096||depth>16)return false;if(typeof x==='string')return reminderText(x,0,16000);if(x===null||typeof x==='boolean'||typeof x==='number')return true;if(Array.isArray(x))return x.every(c=>visit(c,depth+1));return Object.entries(x).every(([k,c])=>reminderText(k,0,256)&&visit(c,depth+1));}return visit(v,0)&&Buffer.byteLength(canonicalJson(v))<=32000;}
function proposal(s,input){const p=record(s,input);if(Object.keys(p).sort().join(',')!==proposalFields||!writeActions.includes(p.action)||!p.args||typeof p.args!=='object'||Array.isArray(p.args)||!boundedData(p.args)||!argsHash(p.argsHash)||!['user','agent'].includes(p.origin)||!['pending','approved','rejected','expired'].includes(p.status)||!reminderDate(p.createdAt,true)||!reminderDate(p.expiresAt,true)||p.expiresAt<p.createdAt||(p.decidedAt!==null&&(!reminderDate(p.decidedAt,true)||p.decidedAt<p.createdAt))||(p.result!==null&&!boundedData(p.result))||((p.status==='pending')!==(p.decidedAt===null&&p.result===null))||(p.status!=='pending'&&p.decidedAt===null))fail('invalid_input');return p;}
function actionEntry(s,input){const a=copy(input);if(!a||Array.isArray(a)||Object.keys(a).sort().join(',')!==actionFields||a.workspaceId!==s.workspaceId||a.matterId!==s.matterId||a.threadId!==null||a.proposalId!==null||!readActions.includes(a.action)||!['user','agent'].includes(a.origin)||!argsHash(a.argsHash)||a.decision!=='auto-allowed'||!reminderDate(a.createdAt,true))fail('invalid_input');return a;}
function proposalImmutable(a,b){return ['id','workspaceId','matterId','threadId','action','args','argsHash','origin','createdAt','expiresAt'].every(k=>canonicalJson(a[k])===canonicalJson(b[k]));}
function proposalLog(p,revision,ordinal,update){return {workspaceId:p.workspaceId,matterId:p.matterId,threadId:null,proposalId:p.id,origin:p.origin,action:p.action,argsHash:p.argsHash,decision:p.status,createdAt:p.decidedAt??p.createdAt,revision,ordinal,operation:update?'proposal.update':'proposal.create'};}

const billingScopeFields=['workspaceId','matterId','threadId'];
const entryFields=[...billingScopeFields,'id','userId','startedAt','endedAt','manualMinutes','durationMinutes','billedMinutes','description','billable','rateAmount','amount','currency','source','billingStatus','createdAt'];
const timerFields=[...billingScopeFields,'userId','startedAt','accumulatedMinutes','pausedAt','state','rateAmount','billable','description','currency','createdAt','updatedAt'];
const feeFields=[...billingScopeFields,'arrangement','hourlyRateAmount','contingencyBasisPoints','billingIncrementMinutes','currency','createdAt','updatedAt'];
const rateFields=[...billingScopeFields,'clientId','clientName','hourlyRateAmount','currency','createdAt','updatedAt'];
const resolutionFields=[...billingScopeFields,'status','outcome','resolutionDate','notes','resolvedAt','createdAt','updatedAt'];
function exactBilling(v,fields){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join(',')!==[...fields].sort().join(','))fail('invalid_input');}
function billingObject(s,v,fields){exactBilling(v,fields);if(v.workspaceId!==s.workspaceId||v.matterId!==s.matterId||v.threadId!==null)fail('invalid_input');}
function validMoney(v){if(typeof v!=='string'||!/^(0|[1-9][0-9]{0,13})\.[0-9]{2}$/.test(v))return false;const [major,minor]=v.split('.');return BigInt(major)*100n+BigInt(minor)<=9007199254740991n;}
const minutes=v=>Number.isInteger(v)&&v>=0&&v<=10080;
const billingStatus=v=>['unbilled','billed'].includes(v);
const billingDates=v=>reminderDate(v.createdAt,true)&&reminderDate(v.updatedAt,true)&&v.updatedAt>=v.createdAt;
function timeEntry(s,e){
 billingObject(s,e,entryFields);
 if(!identifier(e.id)||!identifier(e.userId)||!reminderText(e.description,1,2400)||!minutes(e.durationMinutes)||!minutes(e.billedMinutes)||e.currency!=='MXN'||!billingStatus(e.billingStatus)||!reminderDate(e.createdAt,true)||typeof e.billable!=='boolean'||!validMoney(e.rateAmount)||!validMoney(e.amount)||!e.billable&&(e.billedMinutes!==0||e.rateAmount!=='0.00'||e.amount!=='0.00'))fail('invalid_input');
 if(e.source==='manual'){if(e.startedAt!==null||e.endedAt!==null||e.manualMinutes!==e.durationMinutes)fail('invalid_input');}
 else if(e.source==='timer'){if(e.manualMinutes!==null||!reminderDate(e.startedAt,true)||!reminderDate(e.endedAt,true)||e.endedAt<e.startedAt||e.createdAt<e.endedAt)fail('invalid_input');}
 else fail('invalid_input');
}
function activeTimer(s,t){billingObject(s,t,timerFields);if(!identifier(t.userId)||!reminderText(t.description,1,2400)||!minutes(t.accumulatedMinutes)||t.currency!=='MXN'||!billingDates(t)||!reminderDate(t.startedAt,true)||t.startedAt<t.createdAt||t.startedAt>t.updatedAt||typeof t.billable!=='boolean'||!validMoney(t.rateAmount)||!t.billable&&t.rateAmount!=='0.00'||(t.state==='running'?t.pausedAt!==null:t.state!=='paused'||!reminderDate(t.pausedAt,true)||t.pausedAt<t.startedAt||t.pausedAt>t.updatedAt))fail('invalid_input');}
function feeArrangement(s,f){billingObject(s,f,feeFields);if(!['hourly','fixed','retainer','contingency','pro-bono'].includes(f.arrangement)||![1,6,15].includes(f.billingIncrementMinutes)||f.currency!=='MXN'||!billingDates(f)||(f.hourlyRateAmount!==null&&!validMoney(f.hourlyRateAmount))||f.arrangement!=='hourly'&&f.hourlyRateAmount!==null||(f.arrangement==='contingency'?!Number.isInteger(f.contingencyBasisPoints)||f.contingencyBasisPoints<0||f.contingencyBasisPoints>10000:f.contingencyBasisPoints!==null))fail('invalid_input');}
function clientRate(s,r){billingObject(s,r,rateFields);if(!identifier(r.clientId)||!reminderText(r.clientName,1,800)||!validMoney(r.hourlyRateAmount)||r.currency!=='MXN'||!billingDates(r))fail('invalid_input');}
function matterResolution(s,r){billingObject(s,r,resolutionFields);if(!['abierto','en-espera','resuelto','archivado'].includes(r.status)||!billingDates(r)||(r.notes!==null&&!reminderText(r.notes,0,8000)))fail('invalid_input');if(r.status==='resuelto'){if(!['favorable','desfavorable','acuerdo','desistimiento','otro'].includes(r.outcome)||typeof r.resolutionDate!=='string'||r.resolutionDate.length!==10||!reminderDate(r.resolutionDate)||!reminderDate(r.resolvedAt,true)||r.resolvedAt<r.createdAt||r.resolvedAt>r.updatedAt)fail('invalid_input');}else if(r.outcome!==null||r.resolutionDate!==null||r.notes!==null||r.resolvedAt!==null)fail('invalid_input');}
function billingChange(s,c){exactBilling(c,['operation','item']);const v=c.item;switch(c.operation){
 case 'createEntry':timeEntry(s,v);break;
 case 'putTimer':activeTimer(s,v);break;
 case 'putFee':feeArrangement(s,v);break;
 case 'putRate':clientRate(s,v);break;
 case 'putResolution':matterResolution(s,v);break;
 case 'deleteTimer':exactBilling(v,['userId']);id(v.userId);break;
 case 'stopTimer':exactBilling(v,['userId','entry']);id(v.userId);timeEntry(s,v.entry);if(v.entry.userId!==v.userId||v.entry.source!=='timer')fail('invalid_input');break;
 case 'setBillingStatus':exactBilling(v,['entryIds','billingStatus']);if(!Array.isArray(v.entryIds)||!v.entryIds.length||v.entryIds.length>100||v.entryIds.some(v=>!identifier(v))||new Set(v.entryIds).size!==v.entryIds.length||!billingStatus(v.billingStatus))fail('invalid_input');return v.entryIds.length;
 default:fail('invalid_input');
}return 1;}
function billingImmutable(old,next){if(old&&(old.createdAt!==next.createdAt||next.updatedAt<old.updatedAt))fail('invalid_input');}

/** Explicit in-memory fixture; not a persistence/encryption adapter. No key/path/SQL inputs. */
export function createVaultFixtureDao(){
 const scopes=new Map();let closed=false;
 function check(){if(closed)fail('closed');}
 function read(s){check();return scopes.get(scopeKey(s))??{revision:0,records:new Map(),originals:new Map(),chunks:[],reminders:new Map(),reminderAudits:[],proposals:new Map(),actionLog:[],billingRecords:new Map(),billingAudit:[]};}
 function staged(s,expectedRevision){check();if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||expectedRevision>=Number.MAX_SAFE_INTEGER)fail('invalid_input');const old=read(s);if(old.revision!==expectedRevision)fail('conflict');return {revision:old.revision+1,records:new Map(old.records),originals:new Map(old.originals),chunks:old.chunks.slice(),reminders:new Map(old.reminders),reminderAudits:old.reminderAudits.slice(),proposals:new Map(old.proposals),actionLog:old.actionLog.slice(),billingRecords:new Map(old.billingRecords),billingAudit:old.billingAudit.slice()};}
 function publish(s,next){scopes.set(scopeKey(s),next);return next.revision;}
 function commitAgentChanges({scope:input,creates=[],updates=[],actions=[],expectedRevision}){
  check();const s=reminderScope(input),cs=copy(creates),us=copy(updates),as=copy(actions);if(![cs,us,as].every(Array.isArray)||cs.length+us.length+as.length<1||cs.length+us.length+as.length>100)fail('invalid_input');
  const ps=cs.map(p=>proposal(s,p)),qs=us.map(p=>proposal(s,p)),logs=as.map(a=>actionEntry(s,a));if(ps.some(p=>p.status!=='pending')||qs.some(p=>p.status==='pending')||new Set([...ps,...qs].map(p=>p.id)).size!==ps.length+qs.length)fail('invalid_input');
  const next=staged(s,expectedRevision);let ordinal=0;
  for(const p of ps){if(next.proposals.has(p.id))fail('storage');next.proposals.set(p.id,p);next.actionLog.push(proposalLog(p,next.revision,ordinal++,false));}
  for(const p of qs){const old=next.proposals.get(p.id);if(!old)fail('not_found');if(!proposalImmutable(old,p))fail('invalid_input');if(old.status!=='pending')fail('conflict');next.proposals.set(p.id,p);next.actionLog.push(proposalLog(p,next.revision,ordinal++,true));}
  for(const a of logs)next.actionLog.push({...a,revision:next.revision,ordinal:ordinal++,operation:'action.read'});
  return publish(s,next);
 }

 function commitTimeBilling({scope:input,changes,expectedRevision}){
  check();const s=reminderScope(input),cs=copy(changes);if(!Array.isArray(cs)||!cs.length||cs.length>100)fail('invalid_input');if(cs.reduce((n,c)=>n+billingChange(s,c),0)>100)fail('invalid_input');
  const next=staged(s,expectedRevision);let ordinal=0;
  const audit=(operation,recordId)=>next.billingAudit.push({workspaceId:s.workspaceId,matterId:s.matterId,revision:next.revision,ordinal:ordinal++,operation,recordId});
  const insert=e=>{if(next.billingRecords.has(`entry:${e.id}`))fail('storage');next.billingRecords.set(`entry:${e.id}`,e);};
  const remove=user=>{if(!next.billingRecords.delete(`timer:${user}`))fail('not_found');};
  const upsert=(kind,key,item)=>{billingImmutable(next.billingRecords.get(`${kind}:${key}`),item);next.billingRecords.set(`${kind}:${key}`,item);};
  for(const {operation,item:v} of cs)switch(operation){
   case 'createEntry':insert(v);audit('time.create',v.id);break;
   case 'setBillingStatus':for(const id of v.entryIds){const old=next.billingRecords.get(`entry:${id}`);if(!old)fail('not_found');next.billingRecords.set(`entry:${id}`,{...old,billingStatus:v.billingStatus});audit('time.status',id);}break;
   case 'putTimer':upsert('timer',v.userId,v);audit('timer.put',v.userId);break;
   case 'deleteTimer':remove(v.userId);audit('timer.delete',v.userId);break;
   case 'stopTimer':{const t=next.billingRecords.get(`timer:${v.userId}`),e=v.entry;if(!t)fail('not_found');if(e.startedAt!==t.startedAt||e.rateAmount!==t.rateAmount||e.billable!==t.billable||e.currency!==t.currency||e.durationMinutes<t.accumulatedMinutes||e.endedAt<t.updatedAt)fail('invalid_input');insert(e);remove(v.userId);audit('timer.stop',e.id);break;}
   case 'putFee':upsert('fee','singleton',v);audit('fee.put','singleton');break;
   case 'putRate':upsert('rate',v.clientId,v);audit('rate.put',v.clientId);break;
   case 'putResolution':upsert('resolution','singleton',v);audit('resolution.put','singleton');break;
  }
  return publish(s,next);
 }
 function getBilling(input,kind,key){check();const s=reminderScope(input);id(key);return copy(read(s).billingRecords.get(`${kind}:${key}`)??null);}

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
  async commitAgentChanges(request){return commitAgentChanges(request);},
  async createAgentProposals({scope,items,expectedRevision}){return commitAgentChanges({scope,creates:items,expectedRevision});},
  async createAgentProposal({scope,proposal,expectedRevision}){return commitAgentChanges({scope,creates:[proposal],expectedRevision});},
  async updateAgentProposal({scope,proposal,expectedRevision}){return commitAgentChanges({scope,updates:[proposal],expectedRevision});},
  async logAgentAction({scope,entry,expectedRevision}){return commitAgentChanges({scope,actions:[entry],expectedRevision});},
  async getAgentProposal({scope:input,id:identifier}){check();const s=reminderScope(input);return copy(read(s).proposals.get(id(identifier))??null);},
  async listAgentProposals({scope:input,limit:count=100,offset=0}){check();const s=reminderScope(input);page(count,offset);return copy([...read(s).proposals.values()].sort((a,b)=>binary(a.createdAt,b.createdAt)||binary(a.id,b.id)).slice(offset,offset+count));},
  async listAgentActionLog({scope:input,limit:count=100,offset=0}){check();const s=reminderScope(input);page(count,offset);return copy(read(s).actionLog.slice(offset,offset+count));},
  async commitTimeBilling(request){return commitTimeBilling(request);},
  async createTimeEntry({scope,entry,expectedRevision}){return commitTimeBilling({scope,changes:[{operation:'createEntry',item:entry}],expectedRevision});},
  async setTimeEntriesBillingStatus({scope,entryIds,billingStatus,expectedRevision}){return commitTimeBilling({scope,changes:[{operation:'setBillingStatus',item:{entryIds,billingStatus}}],expectedRevision});},
  async putActiveTimer({scope,timer,expectedRevision}){return commitTimeBilling({scope,changes:[{operation:'putTimer',item:timer}],expectedRevision});},
  async deleteActiveTimer({scope,userId,expectedRevision}){return commitTimeBilling({scope,changes:[{operation:'deleteTimer',item:{userId}}],expectedRevision});},
  async stopTimer({scope,userId,entry,expectedRevision}){return commitTimeBilling({scope,changes:[{operation:'stopTimer',item:{userId,entry}}],expectedRevision});},
  async putFeeArrangement({scope,fee,expectedRevision}){return commitTimeBilling({scope,changes:[{operation:'putFee',item:fee}],expectedRevision});},
  async putClientHourlyRate({scope,rate,expectedRevision}){return commitTimeBilling({scope,changes:[{operation:'putRate',item:rate}],expectedRevision});},
  async putMatterResolution({scope,resolution,expectedRevision}){return commitTimeBilling({scope,changes:[{operation:'putResolution',item:resolution}],expectedRevision});},
  async getTimeEntry({scope,id}){return getBilling(scope,'entry',id);},
  async getActiveTimer({scope,userId}){return getBilling(scope,'timer',userId);},
  async getFeeArrangement({scope}){return getBilling(scope,'fee','singleton');},
  async getClientHourlyRate({scope,clientId}){return getBilling(scope,'rate',clientId);},
  async getMatterResolution({scope}){return getBilling(scope,'resolution','singleton');},
  async listTimeEntries({scope:input,billingStatus:status=null,limit:count=100,offset=0}){check();const s=reminderScope(input);page(count,offset);if(status!==null&&!billingStatus(status))fail('invalid_input');return copy([...read(s).billingRecords].filter(([k,v])=>k.startsWith('entry:')&&(status===null||v.billingStatus===status)).map(([,v])=>v).sort((a,b)=>binary(b.createdAt,a.createdAt)||binary(b.id,a.id)).slice(offset,offset+count));},
  async listTimeBillingAudits({scope:input,limit:count=100,offset=0}){check();const s=reminderScope(input);page(count,offset);return copy(read(s).billingAudit.slice(offset,offset+count));},
  async close(){closed=true;scopes.clear();},
 });
}
