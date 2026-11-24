import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync,mkdtempSync,copyFileSync,mkdirSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import path from'node:path';import{startServer}from'../server/main.mjs';import{openDofAppReview}from'../server/dof-app-review.mjs';
const directory=path.resolve('artifacts/library-expansion-20261124'),indexSha256=readFileSync(path.join(directory,'dev-index/review.sha256'),'utf8').trim();
async function server(t,enabled){const dataDir=mkdtempSync(path.join(tmpdir(),'dof-app-test-'));const app=await startServer({dataDir,port:0,autoInitialize:false,libraryPath:path.join(dataDir,'missing.sqlite'),dofReview:enabled?{directory,indexSha256}:undefined,inference:{stop:async()=>{}},service:{close(){},dispatch(){throw Error('No unrelated dispatch expected');}}});t.after(async()=>{await app.close();rmSync(dataDir,{recursive:true,force:true});});return app;}
function call(a,action,payload={},token=a.connection.token){return fetch(a.connection.url+'/api',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action,payload})});}
test('opt-in actual server preserves auth, library isolation, nine-text conditions and capture',async t=>{const a=await server(t,true);assert.equal((await call(a,'dofReview.status',{},'wrong')).status,401);const status=await(await call(a,'dofReview.status')).json();assert.equal(status.records,9);assert.equal(status.productionIndexed,false);const lib=await(await call(a,'library.status')).json();assert.equal(lib.available,false);const rows=await(await call(a,'dofReview.search',{query:'manifestación valor'})).json();assert.ok(rows.length);const r=await(await call(a,'dofReview.record',{id:'rgce-2026-transitory-eleventh-amendment'})).json();assert.equal(r.conditions.partialAmendmentOnly,true);assert.equal(r.conditions.isConsolidatedText,false);const capture=await fetch(a.connection.url+status.sourceCapturePath);assert.match(capture.headers.get('content-security-policy'),/sandbox/);assert.deepEqual(Buffer.from(await capture.arrayBuffer()),readFileSync(path.join(directory,'rgce3-final-dof-print.html')));assert.equal((await call(a,'dofReview.search',{query:'valor',purpose:'legal-search'})).status,400);assert.equal((await call(a,'dofReview.search',{query:'x'.repeat(201)})).status,400);assert.deepEqual(await(await call(a,'dofReview.search',{query:'zzznocoincide999'})).json(),[]);});
test('default application exposes no review capture or API',async t=>{const a=await server(t,false);assert.equal((await call(a,'dofReview.status')).status,400);assert.equal((await fetch(a.connection.url+'/dev/dof-review/source')).status,404);});
test('opening twice does not rebuild persisted index and wrong digest fails',()=>{const file=path.join(directory,'dev-index/dof-review.sqlite'),before=readFileSync(file);for(let i=0;i<2;i++){const r=openDofAppReview({directory,indexSha256});r.close();}assert.deepEqual(readFileSync(file),before);assert.throws(()=>openDofAppReview({directory,indexSha256:'0'.repeat(64)}));});
test('capture mismatch fails before serving',t=>{const d=mkdtempSync(path.join(tmpdir(),'dof-capture-test-'));t.after(()=>rmSync(d,{recursive:true,force:true}));mkdirSync(path.join(d,'dev-index'));copyFileSync(path.join(directory,'dev-index/dof-review.sqlite'),path.join(d,'dev-index/dof-review.sqlite'));copyFileSync('package.json',path.join(d,'rgce3-final-dof-print.html'));copyFileSync(path.join(directory,'rgce3-isolated-content-candidate.json'),path.join(d,'rgce3-isolated-content-candidate.json'));assert.throws(()=>openDofAppReview({directory:d,indexSha256}),/capture integrity/);});

test('exact condition contract rejects arbitrary scope, every extra field and every mutated value',async()=>{
 const {validateCandidate,REQUIRED_RECORDS}=await import('../server/dof-review-index.mjs');
 const input={htmlBytes:readFileSync(path.join(directory,'rgce3-final-dof-print.html')),cleanText:readFileSync(path.join(directory,'rgce3-candidate-source-clean.txt'),'utf8')};
 const base=JSON.parse(readFileSync(path.join(directory,'rgce3-isolated-content-candidate.json'),'utf8'));
 const check=c=>validateCandidate({...input,candidateBytes:JSON.stringify(c)});
 assert.equal(check(base).records.length,9);
 for(let i=0;i<base.records.length;i++){
  for(const [key,value]of Object.entries(base.records[i].conditions)){
   for(const replacement of [null,{},[],typeof value==='boolean'?!value:'arbitrary-changed-value']){
    const c=structuredClone(base);c.records[i].conditions[key]=replacement;assert.throws(()=>check(c),`${i}.${key} rejects altered value`);
   }
   const c=structuredClone(base);delete c.records[i].conditions[key];assert.throws(()=>check(c),`${i}.${key} required`);
  }
  for(const extra of ['unexpected','legalSearchEnabled','scope','__proto__']){
   if(Object.hasOwn(base.records[i].conditions,extra))continue;
   const c=structuredClone(base);Object.defineProperty(c.records[i].conditions,extra,{value:false,enumerable:true,configurable:true});assert.throws(()=>check(c),`${i} rejects extra ${extra}`);
  }
  const c=structuredClone(base);c.records[i].kind='changed';assert.throws(()=>check(c));
 }
 assert.throws(()=>{REQUIRED_RECORDS['rgce-2026-3.1.43'].flags.scope='changed';});
});

test('persisted index cannot hide extra or changed conditions even under a recalculated continuity digest',async t=>{
 const {DatabaseSync}=await import('node:sqlite');const {createHash}=await import('node:crypto');const {openDofReviewIndex}=await import('../server/dof-review-index.mjs');
 const root=mkdtempSync(path.join(tmpdir(),'dof-condition-open-'));t.after(()=>rmSync(root,{recursive:true,force:true}));mkdirSync(path.join(root,'dev-index'));const file=path.join(root,'dev-index/review.sqlite');
 for(const mutate of [r=>r.conditions.scope='arbitrary',r=>r.conditions.hiddenCondition=true]){
  copyFileSync(path.join(directory,'dev-index/dof-review.sqlite'),file);const db=new DatabaseSync(file);const id='rgce-2026-3.1.43';const r=JSON.parse(db.prepare('SELECT payload FROM records WHERE id=?').get(id).payload);mutate(r);db.prepare('UPDATE records SET payload=? WHERE id=?').run(JSON.stringify(r),id);db.close();
  const pin=createHash('sha256').update(readFileSync(file)).digest('hex');assert.throws(()=>openDofReviewIndex({file,expectedIndexSha256:pin}),/conditions mismatch/);
 }
});

test('fixed independently checked dev pin rejects every altered artifact and recomputed replacement pin',async t=>{
 const {DatabaseSync}=await import('node:sqlite');const {createHash}=await import('node:crypto');const {REVIEWED_DEV_PIN}=await import('../server/dof-app-review.mjs');const {writeFileSync}=await import('node:fs');
 const d=mkdtempSync(path.join(tmpdir(),'dof-fixed-pin-'));t.after(()=>rmSync(d,{recursive:true,force:true}));mkdirSync(path.join(d,'dev-index'));
 const reset=()=>{for(const n of ['rgce3-isolated-content-candidate.json','rgce3-final-dof-print.html'])copyFileSync(path.join(directory,n),path.join(d,n));copyFileSync(path.join(directory,'dev-index/dof-review.sqlite'),path.join(d,'dev-index/dof-review.sqlite'));};
 reset();const a=openDofAppReview({directory:d});a.close();assert.equal(Object.isFrozen(REVIEWED_DEV_PIN),true);
 for(const field of ['text','sourceAnchor','state','sourceUrl','fts']){
  reset();const file=path.join(d,'dev-index/dof-review.sqlite'),db=new DatabaseSync(file),id='rgce-2026-3.1.43';
  if(field==='fts')db.prepare('UPDATE fts SET text=? WHERE id=?').run('altered searchable content',id);
  else{const r=JSON.parse(db.prepare('SELECT payload FROM records WHERE id=?').get(id).payload);r[field]=field==='sourceAnchor'?{start:0,end:1}:'altered';db.prepare('UPDATE records SET payload=? WHERE id=?').run(JSON.stringify(r),id);}
  db.close();const replacement=createHash('sha256').update(readFileSync(file)).digest('hex');assert.notEqual(replacement,REVIEWED_DEV_PIN.indexSha256);assert.throws(()=>openDofAppReview({directory:d}),/integrity mismatch/);assert.throws(()=>openDofAppReview({directory:d,indexSha256:replacement}),/override/);
 }
 reset();writeFileSync(path.join(d,'rgce3-isolated-content-candidate.json'),'{}');assert.throws(()=>openDofAppReview({directory:d}),/candidate integrity/);
 reset();writeFileSync(path.join(d,'rgce3-final-dof-print.html'),'changed capture');assert.throws(()=>openDofAppReview({directory:d}),/capture integrity/);
});
