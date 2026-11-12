import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 normalizePublicRadarObservation as normalize,
 aggregatePublicRadarObservations as aggregate,
 normalizePublicRadarSignal as signal
} from '../server/public-radar-observations.mjs';

const now=Date.parse('2026-11-12T01:00:00Z');
const base=()=>({source:'dof',sourceUrl:'https://dof.gob.mx/publicaciones/123',
 title:'Acuerdo jurídico ficticio para las pruebas públicas',publishedDate:'2026-11-11',
 observedAt:'2026-11-11T23:40:00Z',revision:'v1',digest:'a'.repeat(64)});
const check=(value)=>normalize(value,{now});

test('01. deterministic public event, unverified and legal accuracy unset',()=>{
 const event=check(base());
 assert.match(event.eventId,/^[a-f0-9]{64}$/);
 assert.equal(event.verification,'unverified');
 assert.equal(event.legalAccuracy,'not-evaluated');
 assert.equal(event.scope,'public-only');
 assert.deepEqual(check(base()),event);
});
test('02. no client/matter/payload/verified fields allowed',()=>{
 for(const field of ['client','matterId','body','rawText','verified','network','webhook','credentials']){
  assert.throws(()=>check({...base(),[field]:'never'}),{code:'INVALID_PUBLIC_ENVELOPE'});
 }
});
test('03. configured official hosts only, no subdomains by suffix trick',()=>{
 assert.equal(check({...base(),source:'sjf',sourceUrl:'https://sjf2.scjn.gob.mx/tesis/123'}).source,'sjf');
 for(const sourceUrl of ['http://dof.gob.mx/nota','https://dof.gob.mx.evil.example/nota',
  'https://evil.example/nota','https://user:pass@dof.gob.mx/nota',
  'https://dof.gob.mx/nota#fragment','https://dof.gob.mx/nota?q=cliente',
  'file:///tmp/secreto','https://localhost/nota','https://dof.gob.mx/%41']){
  assert.throws(()=>check({...base(),sourceUrl}),undefined,sourceUrl);
 }
});
test('04. source list is closed; no caller can create an arbitrary endpoint',()=>{
 assert.throws(()=>check({...base(),source:'any-government-site'}),{code:'UNKNOWN_PUBLIC_SOURCE'});
 assert.throws(()=>signal({source:'unapproved',state:'ok-empty',observedAt:base().observedAt},{now}),{code:'UNKNOWN_PUBLIC_SOURCE'});
});
test('05. invalid publication dates and future publication fail closed',()=>{
 for(const date of ['2026-02-30','2026-13-03','2026-1-1','2026-11-14','yesterday']){
  assert.throws(()=>check({...base(),publishedDate:date}),undefined,date);
 }
});
test('06. clock and observedAt require UTC and no future observations',()=>{
 for(const timestamp of ['2026-11-11','2026-11-11T23:40:00-06:00','2026-11-12T04:00:00Z','bad']){
  assert.throws(()=>check({...base(),observedAt:timestamp}),undefined,timestamp);
 }
 assert.throws(()=>normalize(base(),{now:NaN}),{code:'INVALID_CLOCK'});
});
test('07. revision and digest cannot be unvalidated user text',()=>{
 for(const revision of ['', 'firma privada', 'x'.repeat(81), 'v1/../../secret']){
  assert.throws(()=>check({...base(),revision}),{code:'INVALID_PUBLIC_REVISION'});
 }
 for(const digest of ['ABC','a'.repeat(63),'A'.repeat(64)]){
  assert.throws(()=>check({...base(),digest}),{code:'INVALID_PUBLIC_DIGEST'});
 }
});
test('08. visible title controls and bounds are enforced',()=>{
 for(const title of ['corto','   ','X'.repeat(241),'Texto\nsecreto']){
  assert.throws(()=>check({...base(),title}),undefined,title);
 }
});
test('09. revision or source content digest changes create distinct event IDs',()=>{
 const first=check(base());
 assert.notEqual(check({...base(),revision:'v2'}).eventId,first.eventId);
 assert.notEqual(check({...base(),digest:'b'.repeat(64)}).eventId,first.eventId);
 assert.notEqual(check({...base(),sourceUrl:'https://dof.gob.mx/otra/nota'}).eventId,first.eventId);
});
test('10. headline changes alone do not falsely turn same revision into new event',()=>{
 const first=check(base());
 assert.equal(check({...base(),title:'Nueva versión del título ficticio para el mismo documento'}).eventId,first.eventId);
});
test('11. duplicates in the same batch are reported separately and not emitted',()=>{
 const b=base();
 const result=aggregate([b,b],{now});
 assert.equal(result.observed,2);
 assert.equal(result.fresh.length,1);
 assert.equal(result.duplicates.length,1);
 assert.equal(result.action,'none');
 assert.equal(result.mode,'report-only');
});
test('12. previously seen public IDs do not re-enter the fresh batch',()=>{
 const event=check(base());
 const result=aggregate([base()],{now,seen:[event.eventId]});
 assert.equal(result.fresh.length,0);
 assert.deepEqual(result.duplicates,[event.eventId]);
});
test('13. empty success and source failure have distinct, explicit statuses',()=>{
 const empty=signal({source:'dof',state:'ok-empty',observedAt:base().observedAt},{now});
 const failed=signal({source:'dof',state:'failed',observedAt:base().observedAt},{now});
 assert.notDeepEqual(empty,failed);
 assert.equal(failed.scope,'public-only');
 assert.throws(()=>signal({source:'dof',state:'running',observedAt:base().observedAt},{now}),{code:'INVALID_RADAR_SIGNAL_STATE'});
});
test('14. signal never accepts private details, arbitrary data or a success claim',()=>{
 assert.throws(()=>signal({...{source:'dof',state:'failed',observedAt:base().observedAt},errorDetails:'client'}, {now}),{code:'INVALID_RADAR_SIGNAL'});
});
test('15. bounded batches and previous IDs are required',()=>{
 assert.throws(()=>aggregate(Array(201).fill(base()),{now}),{code:'RADAR_BATCH_LIMIT'});
 assert.throws(()=>aggregate([base()],{now,seen:['not-hash']}),{code:'INVALID_SEEN_ID'});
 assert.throws(()=>aggregate({}, {now}),{code:'RADAR_BATCH_LIMIT'});
});
test('16. module imports crypto only and performs no network, shell or file reads',()=>{
 const contents=readFileSync(new URL('../server/public-radar-observations.mjs',import.meta.url),'utf8');
 assert(!/(^|\n)\s*import .*?from ['"](?:node:(?:fs|http|https|net|child_process)|axios|undici)/.test(contents));
 assert(!/\b(?:fetch|spawn|execFile|execSync|eval|Function)\s*\(/.test(contents));
});
