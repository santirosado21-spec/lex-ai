import {createHash} from 'node:crypto';
import {canonicalJson} from '../canonical-json.mjs';
import {validateSourceUrl} from '../legal-sync.mjs';

// Developer-reviewed acquisition metadata, never instructions extracted from a document.
export const ACQUISITION_LIMITS = Object.freeze({maxDocuments:30,maxRequests:100,maxTotalBytes:100*1024*1024,maxDocumentBytes:20*1024*1024,maxDurationMs:30*60*1000,rateMs:2000,concurrency:1,timeoutMs:45000,maxRetries:0,maxRedirects:3});
const fail = message => {throw new Error(`Acquisition registry: ${message}`);};
const digest = value => createHash('sha256').update(canonicalJson(value)).digest('hex');
const idPattern = /^[a-z][a-z0-9-]{0,79}$/;
const statuses = ['approved','pending','blocked'];
const freeze = value => {if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};

function jsonClone(input){
  // canonicalJson rejects JSON coercions. Check every descriptor first, including hidden getters.
  const ancestors=new Set();let nodes=0;
  function inspect(value,depth=0){
    if(++nodes>20000||depth>30)fail('JSON input exceeds structural limits.');
    if(value===null||typeof value!=='object')return;
    if(Array.isArray(value)&&value.length>20000)fail('JSON array exceeds structural limits.');
    if(ancestors.has(value))fail('JSON cycles are forbidden.');
    ancestors.add(value);
    for(const key of Reflect.ownKeys(value)){
      if(Array.isArray(value)&&key==='length')continue;
      const descriptor=Object.getOwnPropertyDescriptor(value,key);
      if(typeof key!=='string'||!descriptor.enumerable||!Object.hasOwn(descriptor,'value'))fail('Only enumerable JSON data fields are accepted; no getters.');
      inspect(descriptor.value,depth+1);
    }
    ancestors.delete(value);
  }
  inspect(input);
  const encoded=canonicalJson(input);
  if(Buffer.byteLength(encoded)>1024*1024)fail('JSON input exceeds size limit.');
  return JSON.parse(encoded);
}
function fields(value,keys,label){
  if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).sort().join('|')!==[...keys].sort().join('|'))fail(`${label} has missing or unknown fields.`);
}
function text(value,label,max=4096){if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u001f\u007f]/.test(value))fail(`${label} must be bounded nonempty text.`);}
function identifier(value,label){if(typeof value!=='string'||!idPattern.test(value))fail(`${label} is not a canonical identifier.`);}
function timestamp(value,label){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value)fail(`${label} must be an ISO UTC timestamp.`);}
function status(value,label){if(!statuses.includes(value))fail(`${label} must be approved, pending or blocked.`);}
function jurisdiction(value,label){if(typeof value!=='string'||!/^MX(?:-[A-Z]{2,3})?$/.test(value))fail(`${label} must be an explicit Mexican jurisdiction.`);}
function publicUrl(value,label,egress=false){
  if(typeof value!=='string'||value.length>2048)fail(`${label} must be an exact HTTPS URL.`);
  let url;try{url=new URL(value);}catch{fail(`${label} is not a valid URL.`);}
  if(url.protocol!=='https:'||url.username||url.password||url.port||/[?#]/.test(value)||url.href!==value||!url.hostname.includes('.')||/[:\[\]]/.test(url.hostname)||/^[\d.]+$/.test(url.hostname)||/\.(?:local|localhost|internal|test|invalid)$/.test(url.hostname)||/[\\*]/.test(value)||/%(?:2e|2f|5c|00)/i.test(url.pathname))fail(`${label} must be an exact public HTTPS origin/path without query, credentials, fragment or wildcard.`);
  if(egress)validateSourceUrl(value); // Do not widen the production allowlist.
  return url;
}
function limits(value){
  fields(value,Object.keys(ACQUISITION_LIMITS),'limits');
  for(const [key,ceiling] of Object.entries(ACQUISITION_LIMITS)){
    const number=value[key];
    if(!Number.isSafeInteger(number))fail(`limits.${key} must be an integer.`);
    if(key==='rateMs'){if(number<ceiling)fail('limits.rateMs must be at least 2000.');}
    else if(key==='maxRetries'){if(number!==0)fail('limits.maxRetries must be zero.');}
    else if(key==='maxRedirects'){if(number<0||number>ceiling)fail('limits.maxRedirects exceeds the bounded policy.');}
    else if(number<=0||number>ceiling)fail(`limits.${key} is zero or exceeds the bounded policy.`);
  }
  if(value.maxDocumentBytes>value.maxTotalBytes||value.timeoutMs>value.maxDurationMs||value.rateMs>value.maxDurationMs)fail('limits contain inconsistent byte/time budgets.');
}

export function validateAcquisitionRegistry(input){
  const registry=jsonClone(input);
  fields(registry,['schemaVersion','id','registryVersion','dataClass','productionEnabled','policy','limits','sources','documents'],'registry');
  if(registry.schemaVersion!==1)fail('Unsupported registry schemaVersion.');
  identifier(registry.id,'registry.id');identifier(registry.registryVersion,'registry.registryVersion');
  if(registry.dataClass!=='public-legal'||registry.productionEnabled!==false)fail('Only inactive public-legal acquisition is authorized.');
  fields(registry.policy,['approvalAuthority','purpose','scope'],'policy');
  if(registry.policy.approvalAuthority!=='developer-reviewed'||registry.policy.purpose!=='bounded-public-acquisition'||registry.policy.scope!=='public-legal')fail('Explicit developer-reviewed public acquisition policy is required.');
  limits(registry.limits);
  if(!Array.isArray(registry.sources)||!registry.sources.length||registry.sources.length>30)fail('sources must contain 1–30 reviewed source records.');
  if(!Array.isArray(registry.documents)||!registry.documents.length||registry.documents.length>registry.limits.maxDocuments)fail('documents exceed maxDocuments or are empty.');
  const sources=new Map();
  for(const source of registry.sources){
    fields(source,['id','title','jurisdiction','collection','status','discovery','rightsReview','version'],'source');
    identifier(source.id,'source.id');if(sources.has(source.id))fail('Duplicate source.id.');
    text(source.title,'source.title',512);jurisdiction(source.jurisdiction,'source.jurisdiction');status(source.status,'source.status');
    if(!['federal-legislation','state-legislation','judicial-criteria'].includes(source.collection))fail('Unknown source.collection.');
    if(source.collection==='state-legislation'?['MX','MX-FED'].includes(source.jurisdiction):!['MX','MX-FED'].includes(source.jurisdiction))fail('Source collection and jurisdiction disagree.');
    fields(source.discovery,['url','evidence','observedAt'],'source.discovery');
    publicUrl(source.discovery.url,'source.discovery.url');text(source.discovery.evidence,'source.discovery.evidence');timestamp(source.discovery.observedAt,'source.discovery.observedAt');
    const review=source.rightsReview;
    fields(review,['status','reviewedBy','reviewedAt','basis','evidenceUrl','scope'],'source.rightsReview');
    status(review.status,'rightsReview.status');text(review.basis,'rightsReview.basis');
    if(review.scope!=='bounded-public-pilot')fail('rightsReview.scope must be bounded-public-pilot.');
    if(review.reviewedBy!==null)text(review.reviewedBy,'rightsReview.reviewedBy',128);
    if(review.reviewedAt!==null)timestamp(review.reviewedAt,'rightsReview.reviewedAt');
    if(review.evidenceUrl!==null)publicUrl(review.evidenceUrl,'rightsReview.evidenceUrl');
    if(review.status==='approved'&&(!review.reviewedBy||!review.reviewedAt||!review.evidenceUrl))fail('Approved rights require explicit reviewer, timestamp and evidence.');
    if(source.status==='approved'&&review.status!=='approved')fail('Approved source requires approved rights review.');
    fields(source.version,['id','evidenceUrl','observedAt'],'source.version');
    identifier(source.version.id,'source.version.id');timestamp(source.version.observedAt,'source.version.observedAt');
    if(source.version.evidenceUrl!==null)publicUrl(source.version.evidenceUrl,'source.version.evidenceUrl');
    if(source.status==='approved'&&!source.version.evidenceUrl)fail('Approved source requires version evidence.');
    sources.set(source.id,source);
  }
  const documentIds=new Set(),destinations=new Set();
  for(const document of registry.documents){
    fields(document,['id','sourceId','title','jurisdiction','status','url','versionId','evidenceUrl'],'document');
    identifier(document.id,'document.id');identifier(document.sourceId,'document.sourceId');identifier(document.versionId,'document.versionId');
    if(documentIds.has(document.id))fail('Duplicate document.id.');documentIds.add(document.id);
    const source=sources.get(document.sourceId);if(!source)fail('Unknown document.sourceId.');
    text(document.title,'document.title',512);jurisdiction(document.jurisdiction,'document.jurisdiction');status(document.status,'document.status');
    if(document.jurisdiction!==source.jurisdiction||document.versionId!==source.version.id)fail('Document jurisdiction/version drifts from its reviewed source.');
    if(document.url!==null)publicUrl(document.url,'document.url',document.status==='approved');
    if(document.evidenceUrl!==null)publicUrl(document.evidenceUrl,'document.evidenceUrl');
    if(document.status==='approved'){
      if(!/^[a-z][a-z0-9-]{0,39}$/.test(document.id))fail('Approved document.id exceeds the downloader identifier policy.');
      if(source.status!=='approved'||source.rightsReview.status!=='approved'||!document.url||!document.evidenceUrl)fail('Approved document requires approved source/rights, exact URL and evidence.');
      if(destinations.has(document.url))fail('Duplicate approved document URL.');destinations.add(document.url);
    }
  }
  return freeze(registry);
}

function planBody(registry,documentIds,createdAt){
  const explicit=documentIds!==undefined;
  if(explicit&&(!Array.isArray(documentIds)||!documentIds.length||new Set(documentIds).size!==documentIds.length))fail('documentIds must be a nonempty unique selection.');
  const selected=explicit?documentIds:registry.documents.filter(document=>document.status==='approved').map(document=>document.id);
  const byId=new Map(registry.documents.map(document=>[document.id,document]));
  for(const id of selected){identifier(id,'selected documentId');const document=byId.get(id);if(!document||document.status!=='approved')fail(`Selected document ${id} is unknown or not approved; no acquisition is authorized.`);}
  const selectedIds=[...selected].sort(),documents=selectedIds.map(id=>byId.get(id));
  const origins=new Set(documents.map(document=>new URL(document.url).origin));
  if(documents.length+origins.size>registry.limits.maxRequests)fail('Request budget cannot cover selected documents and robots checks.');
  const blockedDocuments=registry.documents.filter(document=>document.status!=='approved').map(document=>({documentId:document.id,sourceId:document.sourceId,status:document.status,reason:document.status==='pending'?'Pending source/document authorization; discovery grants no egress.':'Explicitly blocked by the reviewed registry.'})).sort((a,b)=>a.documentId.localeCompare(b.documentId,'en'));
  return {schemaVersion:1,kind:'public-legal-acquisition-plan',registry,registrySha256:digest(registry),createdAt,selection:{mode:explicit?'explicit':'approved-default',documentIds:selectedIds},limits:registry.limits,documents,blockedDocuments};
}

export function buildAcquisitionPlan(input,{documentIds,now}={}){
  const registry=validateAcquisitionRegistry(input);
  const clock=now===undefined?new Date():typeof now==='function'?now():now;
  const createdAt=clock instanceof Date?clock.toISOString():clock;timestamp(createdAt,'plan.createdAt');
  // Clone the selection as well: no caller-owned arrays or accessors enter a plan.
  const selection=documentIds===undefined?undefined:jsonClone(documentIds);
  const body=planBody(registry,selection,createdAt);
  return freeze({...body,sha256:digest(body)});
}

export function verifyAcquisitionPlan(input){
  const plan=jsonClone(input);
  fields(plan,['schemaVersion','kind','registry','registrySha256','createdAt','selection','limits','documents','blockedDocuments','sha256'],'plan');
  if(plan.schemaVersion!==1||plan.kind!=='public-legal-acquisition-plan')fail('Unsupported acquisition plan version/kind.');
  timestamp(plan.createdAt,'plan.createdAt');
  if(typeof plan.sha256!=='string'||!/^[a-f0-9]{64}$/.test(plan.sha256))fail('Invalid plan SHA-256.');
  const {sha256,...body}=plan;if(digest(body)!==sha256)fail('Acquisition plan digest mismatch.');
  fields(plan.selection,['mode','documentIds'],'plan.selection');
  if(!['explicit','approved-default'].includes(plan.selection.mode))fail('Invalid plan selection mode.');
  const registry=validateAcquisitionRegistry(plan.registry);
  const expected=planBody(registry,plan.selection.mode==='explicit'?plan.selection.documentIds:undefined,plan.createdAt);
  if(canonicalJson(expected)!==canonicalJson(body))fail('Acquisition plan differs from reviewed registry, selection or limits.');
  return freeze(plan);
}
