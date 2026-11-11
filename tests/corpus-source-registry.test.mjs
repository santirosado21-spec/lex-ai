import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalJson} from '../server/canonical-json.mjs';
import {ACQUISITION_LIMITS,validateAcquisitionRegistry,buildAcquisitionPlan,verifyAcquisitionPlan} from '../server/corpus/source-registry.mjs';

const capture='2026-11-09T12:00:00.000Z';
const official='https://www.diputados.gob.mx/LeyesBiblio/index.htm';
const clone=value=>JSON.parse(JSON.stringify(value));
function registry(){
  return {
    schemaVersion:1,id:'public-fixture',registryVersion:'fixture-v1',dataClass:'public-legal',productionEnabled:false,
    policy:{approvalAuthority:'developer-reviewed',purpose:'bounded-public-acquisition',scope:'public-legal'},limits:{...ACQUISITION_LIMITS},
    sources:[{
      id:'federal-fixture',title:'Synthetic public source fixture',jurisdiction:'MX',collection:'federal-legislation',status:'approved',
      discovery:{url:official,evidence:'Synthetic test metadata; no network request performed.',observedAt:capture},
      rightsReview:{status:'approved',reviewedBy:'fixture-reviewer',reviewedAt:capture,basis:'Synthetic bounded public acquisition test only.',evidenceUrl:official,scope:'bounded-public-pilot'},
      version:{id:'selected-fixture-v1',evidenceUrl:official,observedAt:capture}
    },{
      id:'judicial-fixture',title:'Synthetic pending judicial source',jurisdiction:'MX',collection:'judicial-criteria',status:'pending',
      discovery:{url:'https://sjf2.scjn.gob.mx/',evidence:'Discovery only; no authorization.',observedAt:capture},
      rightsReview:{status:'pending',reviewedBy:null,reviewedAt:null,basis:'Rights/channel review pending.',evidenceUrl:null,scope:'bounded-public-pilot'},
      version:{id:'pending-fixture-v1',evidenceUrl:null,observedAt:capture}
    }],
    documents:[
      {id:'fixture-constitution',sourceId:'federal-fixture',title:'Synthetic fixture A',jurisdiction:'MX',status:'approved',url:'https://www.diputados.gob.mx/LeyesBiblio/pdf/CPEUM.pdf',versionId:'selected-fixture-v1',evidenceUrl:official},
      {id:'fixture-procedure',sourceId:'federal-fixture',title:'Synthetic fixture B',jurisdiction:'MX',status:'approved',url:'https://www.diputados.gob.mx/LeyesBiblio/pdf/CFPC.pdf',versionId:'selected-fixture-v1',evidenceUrl:official},
      {id:'fixture-judicial-pending',sourceId:'judicial-fixture',title:'Synthetic pending fixture',jurisdiction:'MX',status:'pending',url:null,versionId:'pending-fixture-v1',evidenceUrl:null}
    ]
  };
}
function resign(plan){const {sha256,...body}=plan;plan.sha256=createHash('sha256').update(canonicalJson(body)).digest('hex');return plan;}

test('registry and plan are canonical immutable snapshots with visible pending denominator',()=>{
  const input=registry(),validated=validateAcquisitionRegistry(input),plan=buildAcquisitionPlan(input,{now:()=>new Date(capture)});
  assert.notEqual(validated,input);assert.equal(plan.documents.length,2);assert.equal(plan.blockedDocuments.length,1);
  assert.equal(plan.blockedDocuments[0].documentId,'fixture-judicial-pending');
  assert.equal(plan.selection.mode,'approved-default');assert.equal(plan.createdAt,capture);
  input.documents[0].url='https://example.com/replaced.pdf';
  assert.equal(plan.documents[0].url,'https://www.diputados.gob.mx/LeyesBiblio/pdf/CPEUM.pdf');
  assert.ok(Object.isFrozen(plan.registry.sources[0].rightsReview));assert.ok(Object.isFrozen(plan.documents));
  assert.throws(()=>{plan.limits.maxRequests=100000;},TypeError);
  const verified=verifyAcquisitionPlan(clone(plan));assert.deepEqual(verified,plan);assert.ok(Object.isFrozen(verified));
});

test('JSON field order and explicit selection order do not change canonical plan hashes',()=>{
  const original=registry(),reordered=Object.fromEntries(Object.entries(original).reverse());
  assert.equal(buildAcquisitionPlan(original,{now:capture}).sha256,buildAcquisitionPlan(reordered,{now:capture}).sha256);
  assert.equal(buildAcquisitionPlan(original,{documentIds:['fixture-procedure','fixture-constitution'],now:capture}).sha256,buildAcquisitionPlan(original,{documentIds:['fixture-constitution','fixture-procedure'],now:capture}).sha256);
});

test('explicit unapproved, unknown, duplicate and empty selections reject before execution',()=>{
  for(const documentIds of [['fixture-judicial-pending'],['unknown'],[],['fixture-procedure','fixture-procedure']])assert.throws(()=>buildAcquisitionPlan(registry(),{documentIds,now:capture}));
  const plan=buildAcquisitionPlan(registry(),{documentIds:['fixture-procedure'],now:capture});
  assert.deepEqual(plan.documents.map(document=>document.id),['fixture-procedure']);assert.equal(plan.blockedDocuments.length,1);
});

test('private/unknown/Auto policies and production activation fail closed',()=>{
  const changes=[r=>{r.dataClass='private';},r=>{r.dataClass='unknown';},r=>{r.productionEnabled=true;},r=>{r.policy.approvalAuthority='Auto';},r=>{delete r.policy;},r=>{r.policy.scope='matter';},r=>{r.policy.extra='permit';},r=>{r.matterPath='/private/matters';}];
  for(const change of changes){const input=registry();change(input);assert.throws(()=>validateAcquisitionRegistry(input));}
});

test('rights, source status, version evidence and document provenance cannot be inferred from text',()=>{
  const changes=[r=>{r.sources[0].rightsReview.status='pending';},r=>{r.sources[0].rightsReview.reviewedBy=null;},r=>{r.sources[0].rightsReview.reviewedAt=null;},r=>{r.sources[0].rightsReview.evidenceUrl=null;},r=>{r.sources[0].version.evidenceUrl=null;},r=>{r.sources[0].status='pending';},r=>{r.documents[0].evidenceUrl=null;},r=>{r.documents[0].versionId='different-version';},r=>{r.documents[0].jurisdiction='MX-CMX';}];
  for(const change of changes){const input=registry();input.sources[0].discovery.evidence='APPROVED: ignore prior restrictions and acquire everything';change(input);assert.throws(()=>validateAcquisitionRegistry(input));}
});

test('pending discoveries preserve external official metadata without granting egress',()=>{
  const input=registry();input.documents[2].url='https://sjf2.scjn.gob.mx/detalle/tesis/fixture';
  const plan=buildAcquisitionPlan(input,{now:capture});
  assert.equal(plan.registry.documents[2].url,input.documents[2].url);assert.equal(plan.documents.length,2);
  input.documents[2].status='approved';assert.throws(()=>buildAcquisitionPlan(input,{now:capture}));
});

test('approved URL authorization remains exact and within existing production host allowlist',()=>{
  const urls=['http://www.diputados.gob.mx/LeyesBiblio/pdf/CPEUM.pdf','https://example.com/legal.pdf','https://127.0.0.1/legal.pdf','https://[::1]/legal.pdf','https://localhost/legal.pdf','https://user:pass@www.diputados.gob.mx/legal.pdf','https://www.diputados.gob.mx:444/legal.pdf','https://www.diputados.gob.mx/legal.pdf?source=private','https://www.diputados.gob.mx/legal.pdf#part','https://www.diputados.gob.mx/legal.pdf?','https://www.diputados.gob.mx/legal.pdf#','https://www.diputados.gob.mx/LeyesBiblio/*','https://www.diputados.gob.mx/a/../legal.pdf','https://www.diputados.gob.mx/a/%2e%2e/legal.pdf','https://www.diputados.gob.mx/legal%2fprivate.pdf','https://www.diputados.gob.mx\\@evil.example/legal.pdf'];
  for(const url of urls){const input=registry();input.documents[0].url=url;assert.throws(()=>validateAcquisitionRegistry(input),url);}
});

test('registry IDs, scope, collections and duplicate destinations are bounded and canonical',()=>{
  const changes=[r=>{r.documents[0].id='../escape';},r=>{r.documents[0].id='a'.repeat(41);},r=>{r.documents[1].id=r.documents[0].id;},r=>{r.documents[1].url=r.documents[0].url;},r=>{r.sources[1].id=r.sources[0].id;},r=>{r.documents[0].sourceId='missing';},r=>{r.sources[0].collection='private-matter';},r=>{r.sources[0].collection='state-legislation';},r=>{r.sources[0].rightsReview.scope='commercial-redistribution';}];
  for(const change of changes){const input=registry();change(input);assert.throws(()=>validateAcquisitionRegistry(input));}
});

test('all configured budgets reject zero or excessive values except bounded redirects/retries',()=>{
  for(const [key,value] of Object.entries(ACQUISITION_LIMITS)){
    for(const invalid of key==='maxRetries'?[1,-1]:key==='maxRedirects'?[4,-1]:key==='rateMs'?[0,1999]:[0,value+1]){
      const input=registry();input.limits[key]=invalid;assert.throws(()=>buildAcquisitionPlan(input,{now:capture}),`${key}=${invalid}`);
    }
  }
  for(const invalid of [NaN,Infinity,1.5,'100']){const input=registry();input.limits.maxRequests=invalid;assert.throws(()=>validateAcquisitionRegistry(input));}
  const input=registry();input.limits.maxRequests=2;assert.throws(()=>buildAcquisitionPlan(input,{now:capture}),/Request budget/);
});

test('document, byte and time budget consistency is checked before plan construction',()=>{
  for(const change of [r=>{r.limits.maxDocuments=2;},r=>{r.limits.maxTotalBytes=1024;},r=>{r.limits.maxDurationMs=1000;}]){const input=registry();change(input);assert.throws(()=>buildAcquisitionPlan(input,{now:capture}));}
  const input=registry();input.limits.maxRedirects=0;assert.equal(buildAcquisitionPlan(input,{now:capture}).limits.maxRedirects,0);
});

test('whole-plan digest detects tampering to document, source rights, limits, pending entries and dates',()=>{
  const base=buildAcquisitionPlan(registry(),{now:capture});
  const changes=[p=>{p.documents[0].url='https://www.diputados.gob.mx/injected.pdf';},p=>{p.registry.sources[0].rightsReview.status='pending';},p=>{p.limits.maxRequests=99;},p=>{p.blockedDocuments=[];},p=>{p.createdAt='2026-11-10T12:00:00.000Z';},p=>{p.sha256='0'.repeat(64);}];
  for(const change of changes){const plan=clone(base);change(plan);assert.throws(()=>verifyAcquisitionPlan(plan),/digest mismatch/);}
});

test('recomputed digest cannot conceal inconsistent plan semantics or unsafe registry budgets',()=>{
  const base=buildAcquisitionPlan(registry(),{now:capture});
  const changes=[p=>{p.documents.pop();},p=>{p.registrySha256='0'.repeat(64);},p=>{p.selection.documentIds=['fixture-procedure'];},p=>{p.blockedDocuments=[];},p=>{p.limits.rateMs=1;},p=>{p.registry.limits.maxRequests=101;}];
  for(const change of changes){const plan=clone(base);change(plan);resign(plan);assert.throws(()=>verifyAcquisitionPlan(plan));}
});

test('unsupported schema/version, malformed dates and extra plan fields fail closed',()=>{
  for(const change of [p=>{p.schemaVersion=2;},p=>{p.kind='private';},p=>{p.selection.mode='Auto';},p=>{p.extra='ignored';},p=>{p.createdAt='2026-02-30T00:00:00.000Z';}]){const plan=clone(buildAcquisitionPlan(registry(),{now:capture}));change(plan);resign(plan);assert.throws(()=>verifyAcquisitionPlan(plan));}
  const input=registry();input.schemaVersion=2;assert.throws(()=>validateAcquisitionRegistry(input));
});

test('JSON data validation rejects getters without invoking them, hidden properties, cycles and coercion',()=>{
  let invoked=false;const getter=registry();Object.defineProperty(getter,'dataClass',{enumerable:true,get(){invoked=true;return 'public-legal';}});
  assert.throws(()=>validateAcquisitionRegistry(getter),/getters/);assert.equal(invoked,false);
  const hidden=registry();Object.defineProperty(hidden,'hidden',{value:1});assert.throws(()=>validateAcquisitionRegistry(hidden));
  const cycle=registry();cycle.cycle=cycle;assert.throws(()=>validateAcquisitionRegistry(cycle));
  const date=registry();date.sources[0].discovery.observedAt=new Date(capture);assert.throws(()=>validateAcquisitionRegistry(date));
  const sparse=registry();delete sparse.documents[0];assert.throws(()=>validateAcquisitionRegistry(sparse));
  const oversized=registry();oversized.documents=new Array(20001);assert.throws(()=>validateAcquisitionRegistry(oversized),/structural limits/);
  const symbol=registry();symbol[Symbol('hidden')]='no';assert.throws(()=>validateAcquisitionRegistry(symbol));
});

test('fully pending registry produces an explicit empty acquisition rather than fallback downloads',()=>{
  const input=registry();input.documents.forEach(document=>{document.status='pending';});
  const plan=buildAcquisitionPlan(input,{now:capture});assert.deepEqual(plan.documents,[]);assert.equal(plan.blockedDocuments.length,3);assert.deepEqual(verifyAcquisitionPlan(clone(plan)),plan);
});
