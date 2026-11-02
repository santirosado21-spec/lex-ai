import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,stat,symlink,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';import {randomUUID} from 'node:crypto';
import {createLocalFileOpener} from '../server/local-files.mjs';
import {createService} from '../server/service.mjs';import {createStore} from '../server/store.mjs';

test('native opener writes only supported documents into private unique folders, never accepts paths',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'lex-open-'));t.after(()=>rm(dir,{recursive:true,force:true}));const calls=[];
 const open=createLocalFileOpener({dataDir:dir,launch:async p=>calls.push(p)});
 const first=await open({name:'Escrito sintético.txt',bytes:Buffer.from('Contenido de prueba')});assert.equal(first.opened,true);
 assert.equal(await readFile(calls[0],'utf8'),'Contenido de prueba');assert.equal((await stat(calls[0])).mode&0o777,0o600);assert.equal((await stat(path.dirname(calls[0]))).mode&0o777,0o700);
 await open({name:'Escrito sintético.txt',bytes:Buffer.from('Otra copia')});assert.notEqual(calls[0],calls[1]);
 for(const name of ['../escape.docx','/tmp/escape.docx','run.command','document.app','test\n.docx'])await assert.rejects(open({name,bytes:Buffer.from('test')}),/no permitido/);
 assert.equal(calls.length,2);
 const other=await mkdtemp(path.join(os.tmpdir(),'lex-open-link-'));t.after(()=>rm(other,{recursive:true,force:true}));await symlink(dir,path.join(other,'opened-documents'));
 await assert.rejects(createLocalFileOpener({dataDir:other,launch:async()=>assert.fail('must not launch')})({name:'test.txt',bytes:Buffer.from('test')}),/no válido/);
});

test('document and generated written submissions open only in their own matter; browser has explicit fallback',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'lex-written-'));t.after(()=>rm(dir,{recursive:true,force:true}));const corpusPath=path.join(dir,'corpus.json');await writeFile(corpusPath,'[]');const calls=[];
 const dataDir=path.join(dir,'firm');const service=await createService({dataDir,corpusPath,openFile:async item=>{calls.push(item);return {opened:true,name:item.name};}});t.after(()=>service.close());
 await service.dispatch('workspace.create',{name:'Despacho sintético',practiceAreas:['Civil']});
 const a=await service.dispatch('matter.create',{title:'A',client:'Sintético',jurisdiction:'MX-FED'});const b=await service.dispatch('matter.create',{title:'B',client:'Sintético',jurisdiction:'MX-FED'});
 const document=await service.dispatch('document.import',{matterId:a.id,name:'escrito.txt',base64:Buffer.from('Escrito sintético para abrir desde su asunto.').toString('base64')});
 await assert.rejects(service.dispatch('document.open',{matterId:b.id,documentId:document.id}),/este asunto/);
 await service.dispatch('document.open',{matterId:a.id,documentId:document.id});assert.equal(calls[0].bytes.toString(),'Escrito sintético para abrir desde su asunto.');
 const store=createStore(dataDir),answer={id:randomUUID(),matterId:a.id,question:'Pregunta',text:'Escrito sintético para revisión. [D1]',citations:[{id:'D1',title:'Escrito de prueba',quote:'Escrito sintético',category:'internal-firm-document'}],createdAt:new Date().toISOString()};store.put('answer',answer);store.close();
 await assert.rejects(service.dispatch('answer.open',{matterId:b.id,answerId:answer.id}),/este asunto/);
 await service.dispatch('answer.open',{matterId:a.id,answerId:answer.id});assert.match(calls[1].name,/\.docx$/);assert.equal(calls[1].bytes.subarray(0,2).toString(),'PK');
 const browser=await createService({dataDir,corpusPath});t.after(()=>browser.close());await assert.rejects(browser.dispatch('answer.open',{matterId:a.id,answerId:answer.id}),/Exportar DOCX/);assert.equal(calls.length,2);
});
