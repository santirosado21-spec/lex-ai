import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
import {startServer} from '../server/main.mjs';import {emptyLocalReading} from './helpers/local-reader.mjs';
import {createHash} from 'node:crypto';
test('sealed same-matter sources compare locally in selected order, survive restart and never persist clear comparison text',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'rejon-version-'));let app,calls=0;
 const options={dataDir:dir,intakePilot:true,autoInitialize:false,libraryPath:path.join(dir,'absent.sqlite'),pilotPassphrase:Buffer.from('frase temporal de ensayo'),intakeGenerate:()=>assert.fail('cloud forbidden')};
 const start=()=>startServer(options);app=await start();t.after(async()=>{await app.close();await rm(dir,{recursive:true,force:true});});
 t.mock.method(globalThis,'fetch',async(url,opts)=>{calls++;assert.equal(url,'http://127.0.0.1:11434/api/chat');return Response.json({message:{content:JSON.stringify(emptyLocalReading(JSON.parse(opts.body).format.properties))}});});
 const rpc=(name,payload={})=>app.service.dispatch('intake.'+name,payload);
 await rpc('save',{firm:'Firma sintética',client:'Cliente sintético',title:'Contrato de ensayo',jurisdiction:'MX-FED'});
 const add=async(text,label)=>{const review=await rpc('inspectSource',{extension:'txt',base64:Buffer.from(text).toString('base64'),review:true});return (await rpc('addSource',{reviewId:review.reviewId,label})).id;};
 const a='Entrega en 20 días.\n\nEl comprador acepta la revisión.';
 const b='Entrega en 30 días.\n\nEl comprador no acepta la revisión.';
 const first=await add(a,'Versión base'),second=await add(b,'Versión revisada');const before=calls;
 const result=await rpc('compareVersions',{ids:[first,second]});assert.equal(calls,before);
 assert.deepEqual(result.documents.map(d=>d.id),[first,second]);assert.equal(result.documents[0].sha256,createHash('sha256').update(a).digest('hex'));
 assert.ok(JSON.stringify(result.result).includes('30'));assert.ok(result.result.paragraphs.some(p=>p.type==='added'&&p.b.includes('no')||p.words?.some(w=>w.type==='added'&&w.text.includes('no'))));
 assert.equal(result.result.truncated,false);
 for(const payload of [{ids:[first,first]},{ids:[first,'foreign-id']},{ids:[first]},{ids:[first,second],text:'untrusted'}])await assert.rejects(rpc('compareVersions',payload));
 await app.close();app=await start();assert.deepEqual((await rpc('compareVersions',{ids:[first,second]})).result,result.result);
 assert.equal((await rpc('compareVersions',{ids:[second,first]})).documents[0].id,second);
 assert.ok(!(await readFile(path.join(dir,'rejon-protegido.sqlite'))).includes(Buffer.from('El comprador no acepta')));
 const otherDir=await mkdtemp(path.join(tmpdir(),'rejon-version-other-'));const other=await startServer({...options,dataDir:otherDir});
 try{await assert.rejects(other.service.dispatch('intake.compareVersions',{ids:[first,second]}));}finally{await other.close();await rm(otherDir,{recursive:true,force:true});}
});
