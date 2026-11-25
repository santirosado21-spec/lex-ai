import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,realpath,readFile,readdir,rm,mkdir,symlink,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
import {createNativePilotSession} from '../server/native-pilot-session.mjs';
const secret=()=>Buffer.from('frase sintetica exclusiva de ensayo');
async function fixture(t){const root=await realpath(await mkdtemp(path.join(tmpdir(),'native-pilot-')));const session=createNativePilotSession({root,exercise:'case-a'});t.after(async()=>{await session.dispose();await rm(root,{recursive:true,force:true});});return {root,session,dir:path.join(root,'native-pilot-v1','case-a')};}
const rpc=async(c,action,payload={})=>{const r=await fetch(c.url+'/api',{method:'POST',headers:{Authorization:'Bearer '+c.token,'Content-Type':'application/json'},body:JSON.stringify({action,payload})});return {status:r.status,body:await r.json()};};
test('native preparation stays locked until memory-only unlock; actual encrypted service reopens and old session stops',async t=>{
 const nativeFetch=globalThis.fetch;let forbidden=0;t.mock.method(globalThis,'fetch',async(url,options)=>{if(!String(url).startsWith('http://127.0.0.1:')||new URL(url).port==='11434'){forbidden++;throw Error('Network forbidden in this test');}return nativeFetch(url,options);});
 const {root,session,dir}=await fixture(t);assert.equal(session.status().state,'locked');assert.deepEqual(await readdir(root),[]);
 const p=secret(),c=secret();const first=await session.unlock({passphrase:p,confirmation:c});assert.ok(p.every(b=>b===0)&&c.every(b=>b===0));assert.equal(first.viewHash,'pilot=intake');assert.equal(first.autoInitialize,false);
 const saved=await rpc(first.connection,'intake.save',{firm:'Firma de ensayo nativo',client:'Cliente sintetico reservado',title:'Ensayo nativo',jurisdiction:'MX-FED'});assert.equal(saved.status,200);
 for(const action of ['engine.initialize','workspace.create','office.start','intake.inspectLocal','intake.inspectSource','intake.addSource','intake.followup','intake.unlock','intake.futureAction'])assert.equal((await rpc(first.connection,action)).status,403);
 const denied=await fetch(first.connection.url+'/analyze',{method:'POST',headers:{Authorization:'Bearer '+first.connection.token,'Content-Type':'application/json'},body:'{}'});assert.equal(denied.status,403);
 const generation=await rpc(first.connection,'intake.draft',{task:'trade'});assert.equal(generation.status,403);assert.equal(forbidden,0);
 const db=await readFile(path.join(dir,'rejon-protegido.sqlite'));assert.ok(!db.includes(Buffer.from('Cliente sintetico reservado')));assert.ok(!db.includes(secret()));assert.ok(!(await readdir(dir)).includes('lex.sqlite'));
 await session.lock();await assert.rejects(fetch(first.connection.url+'/api',{method:'POST'}));
 const wrong=Buffer.from('frase incorrecta suficientemente larga');await assert.rejects(session.unlock({passphrase:wrong}),{code:'unlock_failed'});assert.ok(wrong.every(b=>b===0));assert.equal(session.status().state,'locked');
 const second=await session.unlock({passphrase:secret()});assert.notEqual(second.connection.token,first.connection.token);const status=await rpc(second.connection,'intake.status');assert.equal(status.status,200);assert.equal(status.body.saved,true);assert.equal(status.body.protectedRecords,true);const state=await rpc(second.connection,'state');assert.ok(JSON.stringify(state.body).includes('Cliente sintetico reservado'));
 const unauthorized=await rpc({...second.connection,token:first.connection.token},'intake.status');assert.equal(unauthorized.status,401);
 await session.dispose();assert.equal(session.status().state,'disposed');const after=secret();await assert.rejects(session.unlock({passphrase:after}),{code:'invalid_state'});assert.ok(after.every(b=>b===0));assert.equal(forbidden,0);
});
test('new vault confirmation and secret bounds fail closed, no plaintext fallback',async t=>{
 const {session,dir}=await fixture(t);const p=secret();await assert.rejects(session.unlock({passphrase:p}),{code:'confirmation_required'});assert.ok(p.every(b=>b===0));assert.ok(!(await readdir(dir)).includes('rejon-protegido.sqlite'));
 await assert.rejects(session.unlock({passphrase:Buffer.from('short'),confirmation:secret()}),{code:'invalid_secret'});
 await writeFile(path.join(dir,'lex.sqlite'),'untouched legacy sentinel');await assert.rejects(session.unlock({passphrase:secret(),confirmation:secret()}),{code:'legacy_store_refused'});assert.equal(await readFile(path.join(dir,'lex.sqlite'),'utf8'),'untouched legacy sentinel');
});
test('scope traversal and symbolic roots are refused before vault opening',async t=>{
 const {root}=await fixture(t);for(const exercise of ['../case','/tmp/case','','case/a'])assert.throws(()=>createNativePilotSession({root,exercise}),{code:'invalid_scope'});
 const link=root+'-link';await symlink(root,link);t.after(()=>rm(link,{force:true}));const session=createNativePilotSession({root:link,exercise:'case-a'});await assert.rejects(session.unlock({passphrase:secret(),confirmation:secret()}),{code:'unsafe_directory'});assert.deepEqual(await readdir(root),[]);
});
test('concurrent state changes cannot reset an in-flight unlock or reuse the same secret',async t=>{
 const {session}=await fixture(t);const opening=session.unlock({passphrase:secret(),confirmation:secret()});await assert.rejects(session.unlock({passphrase:secret(),confirmation:secret()}),{code:'invalid_state'});assert.equal(session.status().state,'unlocking');await assert.rejects(session.lock(),{code:'invalid_state'});await opening;assert.equal(session.status().state,'unlocked');
 const p=secret();await assert.rejects(session.unlock({passphrase:p}),{code:'invalid_state'});assert.ok(p.every(b=>b===0));assert.equal(session.status().state,'unlocked');
});

test('symbolic exercise and vault, copied scope and unexpected confirmation fail without fallback',async t=>{
 const {root,session,dir}=await fixture(t);await session.unlock({passphrase:secret(),confirmation:secret()});await session.lock();
 await assert.rejects(session.unlock({passphrase:secret(),confirmation:secret()}),{code:'unexpected_confirmation'});
 const {copyFile,rename}=await import('node:fs/promises');const other=path.join(root,'native-pilot-v1','case-b');await mkdir(other);await copyFile(path.join(dir,'rejon-protegido.sqlite'),path.join(other,'rejon-protegido.sqlite'));const foreign=createNativePilotSession({root,exercise:'case-b'});await assert.rejects(foreign.unlock({passphrase:secret()}),{code:'unlock_failed'});await foreign.dispose();
 const vault=path.join(dir,'rejon-protegido.sqlite');await rename(vault,vault+'.safe');await symlink(vault+'.safe',vault);await assert.rejects(session.unlock({passphrase:secret()}),{code:'unsafe_directory'});await rm(vault);await rename(vault+'.safe',vault);
 const linked=path.join(root,'native-pilot-v1','linked');await symlink(dir,linked);const linkedSession=createNativePilotSession({root,exercise:'linked'});await assert.rejects(linkedSession.unlock({passphrase:secret()}),{code:'unsafe_directory'});await linkedSession.dispose();
 await session.unlock({passphrase:secret()});const locking=session.lock();await assert.rejects(session.unlock({passphrase:secret()}),{code:'invalid_state'});await assert.rejects(session.dispose(),{code:'invalid_state'});await locking;await session.lock();
});

test('native profile cannot be selected without encrypted pilot or with automatic initialization',async t=>{
 const {startServer}=await import('../server/main.mjs');const dataDir=await realpath(await mkdtemp(path.join(tmpdir(),'native-negative-')));t.after(()=>rm(dataDir,{recursive:true,force:true}));
 for(const options of [{},{intakePilot:true},{intakePilot:true,pilotPassphrase:secret(),autoInitialize:true}]){let app;try{await assert.rejects(async()=>{app=await startServer({...options,dataDir,nativePilotPreparation:true});});}finally{await app?.close();options.pilotPassphrase?.fill(0);}}
});
