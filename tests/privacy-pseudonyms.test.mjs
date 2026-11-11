import test from 'node:test';
import assert from 'node:assert/strict';
import {createPseudonymStore} from '../server/privacy/pseudonyms.mjs';

const a={workspaceId:'FIRM_A',matterId:'MATTER_A',threadId:'THREAD_A'};
const b={workspaceId:'FIRM_B',matterId:'MATTER_B',threadId:'THREAD_B'};
const name='Persona sintética Álvarez 🧪';
const message=text=>[{role:'user',content:text}];
const protect=(store,text,entities=[name],scope=a)=>store.protect({scope,messages:message(text),entities});
const restore=(store,text,mappingVersion=store.exportSnapshot({scope:a}).mappingVersion,scope=a)=>store.restore({scope,text,mappingVersion});
const collect=async iterator=>{const out=[];for await(const chunk of iterator)out.push(chunk);return out;};
const assertCode=(fn,code)=>assert.throws(fn,error=>error.name==='PseudonymError'&&error.code===code);

test('declared identities produce stable per-matter markers across threads, repeated occurrences and follow-up turns',()=>{
 const store=createPseudonymStore();
 const first=protect(store,`${name} consultó a ${name}.`);
 const marker=first.messages[0].content.split(' consultó')[0];
 assert.match(marker,/^\[\[LEX_[a-f0-9]{32}_[a-f0-9]{32}\]\]$/);assert.match(first.mappingVersion,/^[a-f0-9]{32}$/);
 assert.equal(first.messages[0].content,`${marker} consultó a ${marker}.`);
 const restored=restore(store,first.messages[0].content);assert.equal(restored,`${name} consultó a ${name}.`);
 const next=protect(store,restored,[],{...a,threadId:'THREAD_NEXT'});
 assert.equal(next.mappingVersion,first.mappingVersion);assert.equal(next.messages[0].content,first.messages[0].content);
 assert.equal(restore(store,next.messages[0].content,next.mappingVersion,{...a,threadId:'THREAD_OTHER'}),restored);
});

test('same entity is isolated across two firms and two matters; foreign and unknown markers never resolve',()=>{
 const store=createPseudonymStore(),scopes=[a,{...a,matterId:'MATTER_B'},{...a,workspaceId:'FIRM_B'},b];
 const outputs=scopes.map(scope=>protect(store,name,[name],scope).messages[0].content);
 assert.equal(new Set(outputs).size,4);
 for(let i=0;i<scopes.length;i++)for(let j=0;j<scopes.length;j++) {
  if(i===j)assert.equal(restore(store,outputs[i],store.exportSnapshot({scope:scopes[j]}).mappingVersion,scopes[j]),name);
  else assertCode(()=>restore(store,outputs[i],store.exportSnapshot({scope:scopes[j]}).mappingVersion,scopes[j]),'unknown_marker');
 }
 assertCode(()=>restore(store,'[[LEX_00000000000000000000000000000000_1]]'),'unknown_marker');
 assertCode(()=>restore(store,outputs[0].replace(/_[a-f0-9]{32}\]\]$/,'_'+ '0'.repeat(32)+']]')),'unknown_marker');
 assert.equal(restore(store,`Texto libre ${name}; PERSONA_01 no es un marcador.`),`Texto libre ${name}; PERSONA_01 no es un marcador.`);
});

test('leftmost-longest overlap selection is deterministic and does not recursively replace generated markers',()=>{
 const store=createPseudonymStore();
 const original='Ana Pérez y Ana; abcd; LEX.';
 const output=protect(store,original,['Ana','Ana Pérez','bcd','abc','LEX','Ana']);
 const snapshot=store.exportSnapshot({scope:a});
 assert.equal(snapshot.entries.length,5);
 const byText=Object.fromEntries(snapshot.entries.map(entry=>[entry.text,entry.marker]));
 assert.equal(output.messages[0].content,`${byText['Ana Pérez']} y ${byText.Ana}; ${byText.abc}d; ${byText.LEX}.`);
 assert.equal(restore(store,output.messages[0].content),original);
});

test('Unicode is exact, preserves emoji/combining sequences and performs no implicit normalization',()=>{
 const store=createPseudonymStore(),decomposed='Jose\u0301',composed='José',original=`${composed} y ${decomposed} 🧑🏽‍⚖️`;
 const output=protect(store,original,[composed,'🧑🏽‍⚖️']);
 assert.ok(output.messages[0].content.includes(decomposed));assert.equal(restore(store,output.messages[0].content),original);
 const follow=protect(store,original,[decomposed]);assert.notEqual(follow.mappingVersion,output.mappingVersion);
 assert.ok(!follow.messages[0].content.includes(decomposed));assert.equal(restore(store,follow.messages[0].content,follow.mappingVersion),original);
});

test('history and nested metadata are protected, while copied original citation provenance remains structurally local',()=>{
 const store=createPseudonymStore();
 const provenance=[{sourceId:'SRC_1',officialUrl:'https://example.invalid/public',originalAuthor:name,version:'2026-01-01'}];
 const messages=[{role:'assistant',content:`Historia de ${name}`,metadata:{sourceRefs:['SRC_1'],fileName:`${name}.docx`,toolResult:{rows:[name]}}},{role:'user',content:'Continuar'}];
 const output=store.protect({scope:a,messages,entities:[name],provenance});
 assert.equal(JSON.stringify(output.messages).includes(name),false);
 assert.deepEqual(output.messages[0].metadata.sourceRefs,['SRC_1']);assert.deepEqual(output.provenance,provenance);
 provenance[0].originalAuthor='MUTATED';messages[0].content='MUTATED';
 assert.equal(output.provenance[0].originalAuthor,name);assert.notEqual(output.messages[0].content,'MUTATED');
 output.provenance[0].originalAuthor='ALTERED';assert.equal(store.exportSnapshot({scope:a}).entries[0].text,name);
});

test('literal marker collisions and sensitive structural keys fail atomically without creating or extending a map',()=>{
 const store=createPseudonymStore();
 assertCode(()=>protect(store,'[[LEX_forced_1]]',[name]),'literal_marker');
 assertCode(()=>store.exportSnapshot({scope:a}),'unknown_scope');
 const first=protect(store,name),before=store.exportSnapshot({scope:a});
 assertCode(()=>protect(store,first.messages[0].content,['New synthetic entity']),'literal_marker');
 assert.deepEqual(store.exportSnapshot({scope:a}),before);
 assertCode(()=>store.protect({scope:a,messages:[{role:'user',content:'x',metadata:{[name]:'key'}}],entities:['New synthetic entity']}),'sensitive_metadata_key');
 assert.deepEqual(store.exportSnapshot({scope:a}),before);
 const added=protect(store,'New synthetic entity',['New synthetic entity']);assert.notEqual(added.mappingVersion,first.mappingVersion);assert.notEqual(added.messages[0].content,first.messages[0].content);
});

test('strict input validation rejects malformed scopes, JSON, messages and entities with no partial mutation',()=>{
 const store=createPseudonymStore();const cycle={};cycle.self=cycle;let getters=0;
 const accessor={};Object.defineProperty(accessor,'scope',{enumerable:true,get(){getters++;return a;}});
 assertCode(()=>store.protect(accessor),'invalid_data');assert.equal(getters,0);
 for(const entities of [null,[''],[null],['[[LEX_abc']]) assertCode(()=>protect(store,'x',entities),'invalid_entities');
 assertCode(()=>protect(store,'x',[],{workspaceId:'FIRM_A',matterId:'MATTER_A'}),'invalid_scope');
 assertCode(()=>store.protect({scope:a,messages:[{role:'user',content:'x',tools:[]}],entities:[]}),'invalid_messages');
 assertCode(()=>store.protect({scope:a,messages:message('x'),entities:[],provenance:cycle}),'invalid_data');
 assertCode(()=>store.exportSnapshot({scope:a}),'unknown_scope');
});

test('snapshots survive simulated restart by copy and cannot be imported over an existing matter',()=>{
 const original=createPseudonymStore();const output=protect(original,name);
 const snapshot=original.exportSnapshot({scope:a});const restarted=createPseudonymStore();
 assert.deepEqual(restarted.importSnapshot({scope:{...a,threadId:'NEXT'},snapshot}),{mappingVersion:output.mappingVersion});
 snapshot.entries[0].text='MUTATED';assert.equal(restore(restarted,output.messages[0].content),name);
 assert.equal(protect(restarted,name,[]).messages[0].content,output.messages[0].content);
 assertCode(()=>restarted.importSnapshot({scope:a,snapshot:original.exportSnapshot({scope:a})}),'import_conflict');
 const exported=restarted.exportSnapshot({scope:a});exported.entries[0].marker='BROKEN';assert.equal(restore(restarted,output.messages[0].content),name);
});

test('snapshot import rejects wrong scope, foreign namespace, duplicate entries and inconsistent IDs without mutation',()=>{
 const source=createPseudonymStore();protect(source,name);const snapshot=source.exportSnapshot({scope:a});
 assertCode(()=>createPseudonymStore().importSnapshot({scope:b,snapshot}),'invalid_snapshot');
 for(const change of [s=>{s.namespace='a'.repeat(32);},s=>{s.entries[0].marker='[[LEX_'+ 'b'.repeat(32)+'_1]]';},s=>{s.entries.push({...s.entries[0]});},s=>{s.mappingVersion=1;},s=>{s.namespace='invalid';},s=>{s.entries[0].text='[[LEX_forged';},s=>{delete s.scope;},s=>{s.extra='not allowed';}]) {
  const target=createPseudonymStore(),bad=structuredClone(snapshot);change(bad);
  assertCode(()=>target.importSnapshot({scope:a,snapshot:bad}),'invalid_snapshot');assertCode(()=>target.exportSnapshot({scope:a}),'unknown_scope');
  target.importSnapshot({scope:a,snapshot});assert.equal(restore(target,snapshot.entries[0].marker),name);
 }
 // A trusted snapshot cannot reuse an already registered namespace for another matter.
 const target=createPseudonymStore();target.importSnapshot({scope:a,snapshot});
 const mislabeled=structuredClone(snapshot);mislabeled.scope={workspaceId:b.workspaceId,matterId:b.matterId};
 assertCode(()=>target.importSnapshot({scope:b,snapshot:mislabeled}),'invalid_snapshot');
});

test('rollback invalidates stale version tokens and never reuses removed marker IDs or versions',()=>{
 const store=createPseudonymStore(),first=protect(store,name),second=protect(store,'Otra persona',['Otra persona']);
 assert.notEqual(second.mappingVersion,first.mappingVersion);
 assertCode(()=>restore(store,first.messages[0].content,first.mappingVersion),'stale_version');
 assert.deepEqual(store.rollback({scope:a,toVersion:first.mappingVersion}),{mappingVersion:first.mappingVersion});
 assert.equal(restore(store,first.messages[0].content,first.mappingVersion),name);
 assertCode(()=>restore(store,second.messages[0].content,second.mappingVersion),'stale_version');
 assertCode(()=>restore(store,second.messages[0].content,first.mappingVersion),'unknown_marker');
 const third=protect(store,'Otra persona',['Otra persona']);assert.notEqual(third.mappingVersion,second.mappingVersion);
 assert.notEqual(third.messages[0].content,second.messages[0].content);
 const before=store.exportSnapshot({scope:a});assertCode(()=>store.rollback({scope:a,toVersion:'0'.repeat(32)}),'stale_version');assert.deepEqual(store.exportSnapshot({scope:a}),before);
});

test('ordinary stale snapshot restart cannot reinterpret discarded identities or reuse version IDs',()=>{
 const original=createPseudonymStore(),alpha=protect(original,'Alpha',['Alpha']);
 const stale=original.exportSnapshot({scope:a});
 const beta=protect(original,'Beta',['Beta']);
 const restart=createPseudonymStore();restart.importSnapshot({scope:a,snapshot:stale});
 assert.equal(restore(restart,alpha.messages[0].content,alpha.mappingVersion),'Alpha');
 const gamma=protect(restart,'Gamma',['Gamma']);
 assert.notEqual(gamma.mappingVersion,beta.mappingVersion);assert.notEqual(gamma.messages[0].content,beta.messages[0].content);
 assertCode(()=>restore(restart,beta.messages[0].content,beta.mappingVersion),'stale_version');
 assertCode(()=>restore(restart,beta.messages[0].content,gamma.mappingVersion),'unknown_marker');
 assert.equal(restore(restart,gamma.messages[0].content,gamma.mappingVersion),'Gamma');
 assert.equal(restore(restart,alpha.messages[0].content,gamma.mappingVersion),'Alpha');
});

test('stream restoration handles every marker split and single-code-unit Unicode chunks without partial display',async()=>{
 const store=createPseudonymStore(),output=protect(store,name),text=`Inicio ${output.messages[0].content} fin 🧪`;
 for(let split=0;split<=text.length;split++) {
  assert.deepEqual(await collect(store.restoreStream({scope:a,mappingVersion:output.mappingVersion,chunks:[text.slice(0,split),text.slice(split)]})),[`Inicio ${name} fin 🧪`]);
 }
 assert.deepEqual(await collect(store.restoreStream({scope:a,mappingVersion:output.mappingVersion,chunks:text.split('')})),[`Inicio ${name} fin 🧪`]);
});

test('stream failures, unknown markers, overflow and truncation emit no partially restored output',async()=>{
 const store=createPseudonymStore(),output=protect(store,name),marker=output.messages[0].content;
 async function *broken(){yield marker;throw Error('synthetic stream failure');}
 const cases=[[marker,'[[LEX_unknown_1]]'],[marker.slice(0,-1)],[marker,'[[LE'],['x'.repeat(32769)],[marker,1],broken()];
 for(const chunks of cases) {
  const observed=[];
  await assert.rejects(async()=>{for await(const text of store.restoreStream({scope:a,mappingVersion:output.mappingVersion,chunks}))observed.push(text);});
  assert.deepEqual(observed,[]);
 }
});

test('stream cancellation and rollback during an awaited chunk prevent any output',async()=>{
 for(const cancel of [true,false]) {
  const store=createPseudonymStore();const first=protect(store,name);const second=protect(store,'Otra',['Otra']);
  const controller=new AbortController();let release,closed=false;
  const waiting=new Promise(resolve=>{release=resolve;});
  async function *chunks(){try{await waiting;yield second.messages[0].content;}finally{closed=true;}}
  const observed=[],run=(async()=>{for await(const text of store.restoreStream({scope:a,mappingVersion:second.mappingVersion,chunks:chunks(),signal:controller.signal}))observed.push(text);})();
  if(cancel)controller.abort();else store.rollback({scope:a,toVersion:first.mappingVersion});release();
  await assert.rejects(run,{code:cancel?'cancelled':'stale_version'});assert.deepEqual(observed,[]);assert.equal(closed,true);
 }
});
