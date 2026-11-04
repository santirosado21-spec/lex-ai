import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import https from 'node:https';
import path from 'node:path';
import os from 'node:os';
import {startServer} from '../server/main.mjs';

test('HTTPS panel pairs a real matter, imports text, asks, edits and revokes without leaking the other matter',async t=>{
 const dataDir=await mkdtemp(path.join(os.tmpdir(),'lex-office-integration-'));
 t.after(()=>rm(dataDir,{force:true,recursive:true}));
 execFileSync(process.execPath,['scripts/office-cert.mjs','--data-dir',dataDir]);
 const ca=await readFile(path.join(dataDir,'office-addin/ca.crt'));
 const probe=createServer();
 await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
 const port=probe.address().port;
 await new Promise(resolve=>probe.close(resolve));
 const previous=process.env.LEX_OFFICE_PORT;
 process.env.LEX_OFFICE_PORT=String(port);
 t.after(()=>{if(previous===undefined)delete process.env.LEX_OFFICE_PORT;else process.env.LEX_OFFICE_PORT=previous;});
 const app=await startServer({dataDir,autoInitialize:false,inference:{async *generate(){yield 'Borrador sintético de la reunión.';},async stop(){}}});
 t.after(()=>app.close());
 async function desktop(action,payload){
   const response=await fetch(app.connection.url+'/api',{method:'POST',headers:{Authorization:'Bearer '+app.connection.token,'Content-Type':'application/json'},body:JSON.stringify({action,payload})});
   assert.equal(response.status,200);return response.json();
 }
 const origin='https://localhost:'+port;
 function panel(route,body,token){
   return new Promise((resolve,reject)=>{
    const req=https.request(origin+route,{method:body?'POST':'GET',ca,family:4,headers:{Origin:origin,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})}},res=>{
      let data='';res.on('data',part=>data+=part);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,data:res.headers['content-type'].includes('application/json')?JSON.parse(data):data}));
    });
    req.on('error',reject);req.end(body?JSON.stringify(body):undefined);
   });
 }
 await desktop('workspace.create',{name:'Despacho sintético',practiceAreas:['civil']});
 const matter=await desktop('matter.create',{title:'Uno',client:'Persona ficticia',jurisdiction:'MX-FED'});
 const other=await desktop('matter.create',{title:'Dos',client:'Cliente ficticio',jurisdiction:'MX-FED'});
 await app.service.analyze({mode:'auto',matterId:other.id,question:'Hola, soy NOMBRE_RESERVADO.'});
 const {code}=await desktop('office.pair',{matterId:matter.id});
 const {token}=(await panel('/v1/pair',{code})).data;
 const saved=await panel('/v1/selection',{host:'Word',text:'Convenio sintético de revisión.'},token);
 assert.equal(saved.status,200);
 const reply=(await panel('/v1/ask',{question:'Hola, prepara una agenda.'},token)).data;
 const history=(await panel('/v1/thread',{},token)).data;
 assert.equal(history.length,1);assert.equal(history[0].id,reply.id);
 assert.equal((await panel('/v1/ask',{question:'Hola',matterId:other.id},token)).status,403);
 const draft=(await panel('/v1/draft',{replyId:reply.id},token)).data;
 const edited=await panel('/v1/draft/save',{draftId:draft.id,expectedVersion:draft.version,title:'Agenda',text:'Texto editado de prueba.'},token);
 assert.equal(edited.data.version,2);
 assert.equal((await desktop('draft.get',{matterId:matter.id,replyId:reply.id})).original.text,reply.text);
 const tenant='https://demo.sharepoint.com';
 const share=await desktop('office.pair',{matterId:matter.id,tenant});
 assert.equal((await panel('/v1/pair',{code:share.code,tenant:'https://otro.sharepoint.com'})).status,401);
 assert.match((await panel('/sharepoint.html?tenant='+tenant)).headers['content-security-policy'],/frame-ancestors https:\/\/demo\.sharepoint\.com$/);
 assert.match((await panel('/sharepoint.html?tenant=https://otro.sharepoint.com')).headers['content-security-policy'],/frame-ancestors 'none'$/);
 assert.equal((await panel('/v1/pair',{code:share.code,tenant})).status,200);
 await desktop('office.revoke',{matterId:matter.id});
 assert.equal((await panel('/v1/thread',{},token)).status,401);
});
