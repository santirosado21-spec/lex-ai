import test from 'node:test';
import assert from 'node:assert/strict';
import {copyFile,mkdtemp,readFile,readdir,rm,lstat,symlink} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import os from 'node:os';
import path from 'node:path';
import mammoth from 'mammoth';
import {startServer} from '../server/main.mjs';
import {createStore} from '../server/store.mjs';
import {PILOT_VAULT_FILE} from '../server/privacy/pilot-record-vault.mjs';

const fields={firm:'Despacho Único Secreto',client:'Consultante Ficticio Índigo',
 title:'Asunto Muestra de Tránsito',jurisdiction:'MX-FED'};
const pass=()=>Buffer.from('frase ficticia sólo para la prueba del almacén');
const generate=async()=> 'Mensaje para [[CLIENTE]] sobre [[ASUNTO]]. Verificar documentos.';
const start=(dir,passphrase)=>startServer({dataDir:dir,autoInitialize:false,intakePilot:true,
 intakeGenerate:generate,pilotPassphrase:passphrase,libraryPath:path.join(dir,'sin-biblioteca')});
async function temp(t){const dir=await mkdtemp(path.join(os.tmpdir(),'rejon-cifrado-'));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}
async function checkFiles(dir,needles){
 for(const name of await readdir(dir)){
  const bytes=await readFile(path.join(dir,name));
  for(const value of needles)assert.ok(!bytes.includes(Buffer.from(value)),name);
 }
}

test('protected intake stores case data, edits and audit encrypted and can export after restart',async t=>{
 const dir=await temp(t);
 let app=await start(dir,pass());
 t.after(()=>app.close());
 const call=(action,payload={})=>app.service.dispatch(action,payload);
 assert.equal((await call('intake.status')).protectedRecords,true);
 await call('intake.save',fields);
 await call('intake.draft',{task:'opening'});
 const edit='Borrador privado de prueba para [[CLIENTE]] del asunto [[ASUNTO]].';
 await call('intake.edit',{task:'opening',text:edit});
 const needles=[fields.firm,fields.client,fields.title,edit,'intake.local.edit',pass().toString()];
 await checkFiles(dir,needles);
 await app.close();
 assert.deepEqual(await readdir(dir),[PILOT_VAULT_FILE]);
 if(process.platform!=='win32')assert.equal((await lstat(path.join(dir,PILOT_VAULT_FILE))).mode&0o777,0o600);
 await assert.rejects(start(dir,Buffer.from('frase claramente incorrecta')),/frase local/);
 await assert.rejects(start(dir),/requiere su frase/);
 app=await start(dir,pass());
 assert.ok((await call('intake.status')).drafts.opening.includes(edit));
 const {base64}=await call('intake.export',{task:'opening',format:'docx'});
 const {value}=await mammoth.extractRawText({buffer:Buffer.from(base64,'base64')});
 for(const original of [fields.firm,fields.client,fields.title])assert.ok(value.includes(original));
 await app.close();
 await checkFiles(dir,needles);
});

test('initial conversion uses a read-only legacy snapshot and is not replayed on later unlock',async t=>{
 const dir=await temp(t);
 const old=await start(dir);
 await old.service.dispatch('intake.save',fields);
 await old.service.dispatch('intake.draft',{task:'opening'});
 await old.close();
 const legacy=path.join(dir,'lex.sqlite');
 const before=await readFile(legacy);
 assert.ok(before.includes(Buffer.from(fields.client)));
 let app=await start(dir,pass());
 try{
  const {text}=await app.service.dispatch('intake.preview',{task:'opening'});
  assert.ok(text.includes(fields.client));
  await app.service.dispatch('intake.edit',{task:'opening',text:'Cambio en el archivo protegido [[CLIENTE]] [[ASUNTO]].'});
 }finally{await app.close();}
 assert.deepEqual(await readFile(legacy),before);
 assert.ok(!(await readFile(path.join(dir,PILOT_VAULT_FILE))).includes(Buffer.from(fields.client)));
 app=await start(dir,pass());
 try{assert.match((await app.service.dispatch('intake.status')).drafts.opening,/Cambio en el archivo protegido/);}
 finally{await app.close();}
});

test('rollback and authenticated row identity survive tampering and simultaneous readers',async t=>{
 const dir=await temp(t);
 const a=createStore(dir,{pilotPassphrase:pass()});
 let b;
 try{
  a.transaction(()=>a.put('matter',{id:'one',title:'Primero reservado'}));
  assert.throws(()=>a.transaction(()=>{a.put('matter',{id:'two',title:'Un segundo reservado'});throw Error('fallo');}));
  assert.equal(a.get('matter','two'),null);
  b=createStore(dir,{pilotPassphrase:pass()});
  b.transaction(()=>b.put('matter',{id:'two',title:'Un segundo reservado'}));
  assert.equal(a.get('matter','two').title,'Un segundo reservado');
 } finally {b?.close();a.close();}
 const raw=new DatabaseSync(path.join(dir,PILOT_VAULT_FILE));
 raw.exec("UPDATE records SET payload=(SELECT payload FROM records WHERE id='one') WHERE id='two'");
 raw.close();
 const reopened=createStore(dir,{pilotPassphrase:pass()});
 try{assert.throws(()=>reopened.get('matter','two'),/integridad/);}finally{reopened.close();}
});

test('a symlink cannot direct a protected case to a different file',async t=>{
 const dir=await temp(t);
 const other=path.join(dir,'other.sqlite');
 try{await symlink(other,path.join(dir,PILOT_VAULT_FILE));}catch(error){if(process.platform==='win32'&&error.code==='EPERM'){t.skip('Windows no permite enlaces simbólicos en esta sesión.');return;}throw error;}
 assert.throws(()=>createStore(dir,{pilotPassphrase:pass()}));
 assert.deepEqual(await readdir(dir),[PILOT_VAULT_FILE]);
});


test('a complete copied vault cannot restore identities under a different exercise code',async t=>{
 const original=await temp(t),other=await temp(t);
 const repository=createStore(original,{pilotPassphrase:pass()});
 try{repository.put('matter',{id:'muestra',title:fields.title});}finally{repository.close();}
 await copyFile(path.join(original,PILOT_VAULT_FILE),path.join(other,PILOT_VAULT_FILE));
 assert.throws(()=>createStore(other,{pilotPassphrase:pass()}),/integridad/);
});
