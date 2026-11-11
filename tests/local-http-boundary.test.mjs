import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {startServer} from '../server/main.mjs';

async function raw(port,{target='/api',method='POST',headers=[],body='{"action":"synthetic"}',host=true,contentType='application/json'}={}) {
 return new Promise((resolve,reject)=>{
  const socket=net.connect(port,'127.0.0.1');let response='';
  socket.setTimeout(10000,()=>socket.destroy(Error('HTTP test timeout')));
  socket.on('error',reject);socket.on('data',chunk=>response+=chunk);
  socket.on('end',()=>resolve({status:Number(response.split(' ')[1]),text:response}));
  socket.on('connect',()=>socket.write(`${method} ${target} HTTP/1.1\r\n${host?`Host: 127.0.0.1:${port}\r\n`:''}Connection: close\r\nContent-Type: ${contentType}\r\nContent-Length: ${Buffer.byteLength(body)}\r\n${headers.join('\r\n')}${headers.length?'\r\n':''}\r\n${body}`));
 });
}
test('local HTTP boundary uses actual HTTP with service stubs and no persistent store',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'lex-boundary-'));let calls=0;
 const app=await startServer({dataDir:dir,libraryPath:path.join(dir,'absent.sqlite'),autoInitialize:false,
  inference:{stop:async()=>{}},service:{dispatch:async()=>{calls++;return {synthetic:true};},analyze:async()=>{calls++;return {synthetic:true};}}});
 const port=Number(new URL(app.connection.url).port),auth=`Authorization: Bearer ${app.connection.token}`;
 try {
  const negatives=[
   ...['evil.example',`127.0.0.1:${port}.evil.example`,`localhost.evil:${port}`,`user@localhost:${port}`,`localhost:${port+1}`,`localhost:0${port}`,`localhost`,`[::1]:${port}`,`127.0.0.2:${port}`,`localhost:${port},evil`,`localhost:${port}:80`].map(value=>({name:`host ${value}`,host:false,headers:[`Host: ${value}`],status:400})),
   {name:'missing Host',host:false,status:400},
   {name:'duplicate Host',headers:[`Host: localhost:${port}`],status:400},
   ...['https://evil.example','null','',`http://localhost:${port}.evil`].map(value=>({name:`origin ${value}`,headers:[`Origin: ${value}`],status:403})),
   {name:'duplicate Origin',headers:[`Origin: ${app.connection.url}`,`Origin: ${app.connection.url}`],status:400},
   ...['cross-site','same-site','bogus'].map(value=>({name:`absent Origin / ${value}`,headers:[`Sec-Fetch-Site: ${value}`],status:403})),
   ...['http://evil.example/api','//evil.example/api','*','/api#fragment','/api\\other'].map(target=>({name:`target ${target}`,target,status:400})),
   {name:'invalid token',headers:['Authorization: Bearer invalid'],noAuth:true,status:401},
   {name:'missing token',noAuth:true,status:401},
   {name:'duplicate bearer',headers:[auth],status:400},
   {name:'duplicate content type',headers:['Content-Type: application/json'],status:400},
   {name:'non JSON MIME suffix',contentType:'application/json-evil',status:405},
   {name:'non JSON MIME',contentType:'text/plain',status:405},
   {name:'API requires POST',method:'GET',status:405},
   {name:'analyze invalid token',target:'/analyze',noAuth:true,status:401},
   {name:'preflight missing origin',method:'OPTIONS',status:403},
   {name:'preflight foreign origin',method:'OPTIONS',headers:['Origin: https://evil.example','Access-Control-Request-Method: POST','Access-Control-Request-Headers: authorization, content-type'],status:403},
   ...[
    ['Access-Control-Request-Method: GET','Access-Control-Request-Headers: authorization'],
    ['Access-Control-Request-Method: POST','Access-Control-Request-Headers: x-hostile'],
    ['Access-Control-Request-Method: POST','Access-Control-Request-Headers: content-type'],
    ['Access-Control-Request-Method: POST'],
   ].map(headers=>({name:`preflight ${headers.join('/')}`,method:'OPTIONS',headers:[`Origin: ${app.connection.url}`,...headers],status:403})),
   {name:'preflight wrong path',target:'/anything',method:'OPTIONS',headers:[`Origin: ${app.connection.url}`,'Access-Control-Request-Method: POST','Access-Control-Request-Headers: authorization'],status:403},
  ];
  for(const {name,status,noAuth,headers=[],...options} of negatives) await t.test(name,async()=>{
   const before=calls;const r=await raw(port,{...options,headers:[...headers,...(noAuth?[]:[auth])]});
   assert.equal(r.status,status);assert.equal(calls,before);assert.ok(!r.text.includes('Access-Control-Allow-Origin: https://evil.example'));
  });
  for(const origin of [undefined,app.connection.url,`http://localhost:${port}`,'http://localhost:1420','http://127.0.0.1:1420','tauri://localhost','http://tauri.localhost','https://tauri.localhost']) await t.test(`legitimate ${origin||'native'}`,async()=>{
   const before=calls;const r=await raw(port,{headers:[auth,...(origin?[`Origin: ${origin}`]:[])]});assert.equal(r.status,200);assert.equal(calls,before+1);
  });
  for(const site of ['none','same-origin']) await t.test(`origin-absent ${site}`,async()=>assert.equal((await raw(port,{headers:[auth,`Sec-Fetch-Site: ${site}`]})).status,200));
  await t.test('localhost actual authority',async()=>assert.equal((await raw(port,{host:false,headers:[`Host: localhost:${port}`,auth]})).status,200));
  await t.test('analyze remains authenticated',async()=>assert.equal((await raw(port,{target:'/analyze',headers:[auth]})).status,200));
  await t.test('valid preflight is not a service operation',async()=>{
   const before=calls;const r=await raw(port,{method:'OPTIONS',headers:[`Origin: ${app.connection.url}`,'Access-Control-Request-Method: POST','Access-Control-Request-Headers: Authorization, Content-Type']});
   assert.equal(r.status,204);assert.equal(calls,before);assert.match(r.text,/Access-Control-Allow-Headers: Authorization, Content-Type/);
  });
  await t.test('JSON body and limit retained',async()=>{
   const before=calls;
   assert.equal((await raw(port,{headers:[auth],body:'{bad'})).status,400);
   const r=await fetch(app.connection.url+'/api',{method:'POST',headers:{Authorization:`Bearer ${app.connection.token}`,'Content-Type':'application/json'},body:JSON.stringify({text:'x'.repeat(15*1024*1024)})});
   assert.equal(r.status,413);assert.equal(calls,before);
  });
 } finally {await app.close();await rm(dir,{recursive:true,force:true});}
});
