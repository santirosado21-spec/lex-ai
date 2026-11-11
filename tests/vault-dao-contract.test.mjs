import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStore} from '../server/store.mjs';
import {createVaultFixtureDao,VAULT_STORE_PARITY,VAULT_PARITY_COMPLETE,VAULT_REMOVED_ESCAPES} from '../server/privacy/vault-dao-contract.mjs';
const a={workspaceId:'firm_a',matterId:'matter_a',threadId:'thread_a'};
const doc={...a,id:'doc_a',name:'Sintético 🧑🏽‍⚖️',text:'contrato obligación José e\u0301'};
const bytes=Buffer.from([0,255,10,13,34,90]);
const chunks=[{id:'chunk_a',text:doc.text}];
const request=()=>({scope:a,document:doc,bytes,chunks,expectedRevision:0});
const code=expected=>error=>error.code===expected;

test('matrix enumerates every current store method and keeps parity gate closed',()=>{
 const source=readFileSync(new URL('../server/store.mjs',import.meta.url),'utf8');const names=[...source.matchAll(/^    (\w+)\(/gm)].map(m=>m[1]);assert.deepEqual(VAULT_STORE_PARITY.map(r=>r.api).sort(),names.sort());assert.equal(VAULT_PARITY_COMPLETE,false);assert.ok(VAULT_STORE_PARITY.some(r=>r.status==='not-implemented'));assert.equal(new Set(VAULT_STORE_PARITY.map(r=>r.api)).size,names.length);assert.ok(VAULT_REMOVED_ESCAPES.db);
});
test('vault README current matrix counts agree with the code parity gate',()=>{
 const readme=readFileSync(new URL('../crates/lex-vault/README.md',import.meta.url),'utf8');const documented=[...readme.matchAll(/\*\*(\d+) supported-core \/ (\d+) partial \/ (\d+) not-implemented\*\*/g)].map(m=>m.slice(1).map(Number));assert.ok(documented.length>=1,'vault README must state the current matrix counts');const latest=documented[documented.length-1];
 const counts={'supported-core':0,'partial':0,'not-implemented':0};for(const row of VAULT_STORE_PARITY)counts[row.status]+=1;assert.equal(VAULT_STORE_PARITY.length,32,'matrix must keep exactly 32 rows');assert.deepEqual([counts['supported-core'],counts.partial,counts['not-implemented']],latest,'code matrix drifted from the latest documented vault README counts');assert.equal(VAULT_PARITY_COMPLETE,false);
});
test('async supported core agrees with synthetic legacy fixture for original/record/chunks/search',async t=>{
 const root=mkdtempSync(join(tmpdir(),'lex-vault-dao-synthetic-'));const legacy=createStore(root);t.after(()=>{legacy.close();rmSync(root,{recursive:true,force:true});});const dao=createVaultFixtureDao();t.after(()=>dao.close());legacy.insertDocument(doc,bytes,chunks);const promise=dao.insertDocument(request());assert.ok(promise instanceof Promise);assert.equal(await promise,1);
 assert.deepEqual(await dao.get({scope:a,kind:'document',id:doc.id}),legacy.get('document',doc.id,a.matterId));assert.deepEqual(await dao.list({scope:a,kind:'document'}),legacy.list('document',a.matterId));assert.deepEqual(await dao.original({scope:a,documentId:doc.id}),legacy.original(doc.id,a.matterId));assert.deepEqual(await dao.firstChunks({scope:a}),JSON.parse(JSON.stringify(legacy.firstChunks(a.matterId))));assert.deepEqual(await dao.search({scope:a,query:'obligación'}),JSON.parse(JSON.stringify(legacy.search(a.matterId,'obligación'))));
});
test('every read requires exact workspace/matter/thread and no absent/wildcard scope',async()=>{
 const dao=createVaultFixtureDao();await dao.insertDocument(request());for(const scope of [{...a,workspaceId:'firm_b'},{...a,matterId:'matter_b'},{...a,threadId:'thread_b'},{...a,threadId:null}]){assert.equal(await dao.get({scope,kind:'document',id:doc.id}),null);assert.deepEqual(await dao.list({scope,kind:'document'}),[]);assert.equal(await dao.original({scope,documentId:doc.id}),null);assert.deepEqual(await dao.firstChunks({scope}),[]);assert.deepEqual(await dao.search({scope,query:'contrato'}),[]);assert.equal(await dao.revision({scope}),0);await assert.rejects(dao.put({scope,kind:'chat',entity:doc,expectedRevision:0}),code('invalid_input'));}
 for(const scope of [undefined,{workspaceId:'firm_a',matterId:'matter_a'},{...a,matterId:'*'},{...a,workspaceId:''}])await assert.rejects(dao.get({scope,kind:'document',id:doc.id}));await dao.close();
});
test('compound import rollback and CAS do not publish partial records or search data',async()=>{
 const dao=createVaultFixtureDao();await assert.rejects(dao.insertDocument({...request(),chunks:[chunks[0],chunks[0]]}),code('storage'));assert.equal(await dao.revision({scope:a}),0);assert.deepEqual(await dao.list({scope:a,kind:'document'}),[]);assert.equal(await dao.original({scope:a,documentId:doc.id}),null);assert.deepEqual(await dao.search({scope:a,query:'contrato'}),[]);
 const results=await Promise.allSettled([dao.insertDocument(request()),dao.insertDocument(request())]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'conflict');assert.equal(await dao.revision({scope:a}),1);await dao.close();
});
test('copies bytes/objects and closes all domain reads including empty search',async()=>{
 const dao=createVaultFixtureDao();await dao.insertDocument(request());const got=await dao.get({scope:a,kind:'document',id:doc.id});got.name='changed';const original=await dao.original({scope:a,documentId:doc.id});original[0]=99;assert.deepEqual(await dao.get({scope:a,kind:'document',id:doc.id}),doc);assert.deepEqual(await dao.original({scope:a,documentId:doc.id}),bytes);await dao.close();for(const run of [()=>dao.revision({scope:a}),()=>dao.get({scope:a,kind:'document',id:doc.id}),()=>dao.list({scope:a,kind:'document'}),()=>dao.original({scope:a,documentId:doc.id}),()=>dao.firstChunks({scope:a}),()=>dao.search({scope:a,query:''}),()=>dao.insertDocument(request())])await assert.rejects(run(),code('closed'));
});
test('bounded allowlisted API rejects SQL, arbitrary kinds, path-shaped IDs and getters',async()=>{
 const dao=createVaultFixtureDao();assert.equal(dao.db,undefined);assert.equal(dao.transaction,undefined);assert.equal(dao.exec,undefined);await assert.rejects(dao.put({scope:a,kind:'document',entity:doc,expectedRevision:0}),code('invalid_input'));await assert.rejects(dao.get({scope:a,kind:'future-kind',id:'x'}),code('not_implemented'));await assert.rejects(dao.get({scope:a,kind:'chat',id:'../x'}),code('invalid_input'));await assert.rejects(dao.firstChunks({scope:a,limit:101}),code('invalid_input'));
 let calls=0;const malicious={...doc};Object.defineProperty(malicious,'text',{enumerable:true,get(){calls++;return 'secret';}});await assert.rejects(dao.put({scope:a,kind:'chat',entity:malicious,expectedRevision:0}),code('invalid_input'));assert.equal(calls,0);await dao.close();
});
