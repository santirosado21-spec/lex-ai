import test from 'node:test';
import assert from 'node:assert/strict';
import { auditOfficeDocument, createOfficeBridge } from '../server/office-bridge.mjs';

const origin='https://localhost:48765';
const matterId='synthetic-matter-1';
const fakeService=()=>{const calls=[];return {calls,service:{async agentChannel(action,payload){calls.push({action,payload});return {status:'completed',action};}}};};
function request(bridge,{url,body={},token,requestOrigin=origin,address='127.0.0.1'}={}) {
  const content=Buffer.from(JSON.stringify(body));const headers={origin:requestOrigin,'content-type':'application/json'};if(token)headers.authorization=`Bearer ${token}`;
  const req={method:'POST',url,headers,socket:{remoteAddress:address},async *[Symbol.asyncIterator](){yield content;}};
  const headersOut={};let status;let raw='';const res={setHeader(name,value){headersOut[name.toLowerCase()]=value;},writeHead(value,extra={}){status=value;Object.assign(headersOut,Object.fromEntries(Object.entries(extra).map(([key,item])=>[key.toLowerCase(),item])));},end(value=''){raw+=value;}};
  return bridge.handle(req,res).then(()=>({status,headers:headersOut,body:raw?JSON.parse(raw):null}));
}
function bridgeWith({clock=()=>1_000,rateLimit}={}) {const fake=fakeService();let seed=7;return {fake,...fake,bridge:createOfficeBridge({service:fake.service,dataDir:'/synthetic',clock,randomBytes:length=>Buffer.alloc(length,seed++),rateLimit})};}
async function paired(instance,{ttlMs=60_000,tokenTtlMs=60_000}={}) {const pairing=instance.bridge.createPairing({matterId,ttlMs,tokenTtlMs});const response=await request(instance.bridge,{url:'/v1/pair',body:{code:pairing.code}});assert.equal(response.status,200);return response.body.token;}

test('passive audit finds synthetic placeholders, organisational notes, broken references, and draft fields',()=>{
  const result=auditOfficeDocument('CLÁUSULA 1. Objeto\nEntre ACME, S.A. de C.V. y BETA, S.A. de C.V.\nLa cláusula 2 rige desde 10/10/2026 por $1,000.00. [FECHA] ____',{documentType:'contrato'});
  assert.ok(result.suggestions.some(item=>item.kind==='placeholder'));
  assert.ok(result.suggestions.some(item=>item.kind==='cross-reference'&&item.message.includes('2')));
  assert.ok(result.suggestions.some(item=>item.kind==='organisational'&&item.message.includes('no es un requisito legal')));
  assert.ok(result.fields.some(item=>item.kind==='fecha'&&item.value==='10/10/2026'));
  assert.ok(result.fields.some(item=>item.kind==='importe'&&item.value==='$1,000.00'));
  assert.ok(result.fields.some(item=>item.kind==='parte'&&item.value.includes('ACME')));
});

test('pairing is single-use, expires, and issued tokens expire or can be revoked',async()=>{
  let now=1_000;const instance=bridgeWith({clock:()=>now});const first=instance.bridge.createPairing({matterId,ttlMs:60_000,tokenTtlMs:60_000});
  const issued=await request(instance.bridge,{url:'/v1/pair',body:{code:first.code}});assert.equal(issued.status,200);
  assert.equal((await request(instance.bridge,{url:'/v1/pair',body:{code:first.code}})).status,401);
  const expiring=instance.bridge.createPairing({matterId,ttlMs:60_000});now+=60_001;
  assert.equal((await request(instance.bridge,{url:'/v1/pair',body:{code:expiring.code}})).status,401);
  assert.equal((await request(instance.bridge,{url:'/v1/audit',token:issued.body.token,body:{text:'texto sintético'}})).status,401);
  now=1_000;const token=await paired(instance);assert.equal(instance.bridge.revoke(token),true);
  assert.equal((await request(instance.bridge,{url:'/v1/audit',token,body:{text:'texto sintético'}})).status,401);
});

test('paired tokens cannot approve or cross a matter and agent calls use only the restricted channel',async()=>{
  const instance=bridgeWith();const token=await paired(instance);
  const approval=await request(instance.bridge,{url:'/v1/agent',token,body:{action:'agent.approve',payload:{matterId,proposalId:'proposal-1'}}});assert.equal(approval.status,403);
  const other=await request(instance.bridge,{url:'/v1/agent',token,body:{action:'agent.pending',payload:{matterId:'other-matter'}}});assert.equal(other.status,403);
  const okay=await request(instance.bridge,{url:'/v1/agent',token,body:{action:'agent.pending',payload:{matterId}}});assert.equal(okay.status,200);
  assert.deepEqual(instance.fake.calls,[{action:'agent.pending',payload:{matterId}}]);
});

test('rate, request-size, CORS, and no-text audit-log boundaries are enforced without a socket',async()=>{
  const instance=bridgeWith({rateLimit:{count:1,windowMs:60_000}});const token=await paired(instance);
  const first=await request(instance.bridge,{url:'/v1/audit',token,body:{text:'SYNTHETIC PRIVATE DOCUMENT TEXT'}});assert.equal(first.status,200);
  assert.equal((await request(instance.bridge,{url:'/v1/audit',token,body:{text:'otro texto'}})).status,429);
  const cors=await request(instance.bridge,{url:'/v1/pair',requestOrigin:'https://evil.invalid',body:{code:'AAAAAA'}});assert.equal(cors.status,403);assert.equal(cors.headers['access-control-allow-origin'],undefined);
  const sizeInstance=bridgeWith();const sizeToken=await paired(sizeInstance);const oversized='x'.repeat(256*1024);
  assert.equal((await request(sizeInstance.bridge,{url:'/v1/audit',token:sizeToken,body:{text:oversized}})).status,413);
  const serialized=JSON.stringify(instance.bridge.getAuditLog());assert.equal(serialized.includes('SYNTHETIC PRIVATE DOCUMENT TEXT'),false);
});

test('the HTTPS listener and file access are injectable, so startup tests do not open loopback sockets',async()=>{
  const fake=fakeService();let created=0;const listener={once(){},listen(port,host,done){assert.equal(port,48765);assert.equal(host,'127.0.0.1');done();},address(){return {port:48765};},close(done){done();}};
  const bridge=createOfficeBridge({service:fake.service,dataDir:'/synthetic',fs:{async readFile(){return Buffer.from('synthetic certificate');}},listenerFactory:options=>{created++;assert.equal(typeof options.handler,'function');return listener;}});
  assert.deepEqual(await bridge.start(),{url:'https://localhost:48765'});assert.equal(created,1);await bridge.close();
});
