import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {startServer} from '../server/main.mjs';
const engine={status:async()=>({state:'stopped'}),stop:async()=>{},initialize:async()=>({state:'starting'})};
test('desktop startup initializes the owned engine without blocking local API startup',async()=>{
 let starts=0;const dir=await mkdtemp(path.join(os.tmpdir(),'lex-auto-start-'));
 const app=await startServer({dataDir:dir,autoInitialize:true,inference:{...engine,initialize:async()=>{starts++;return {state:'preparing'};}}});
 try{assert.equal(starts,1);assert.match(app.connection.url,/^http:\/\/127\.0\.0\.1:/);}finally{await app.close();}
});
test('loopback API rejects missing tokens and foreign origins, accepts authenticated request',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'lex-http-'));const app=await startServer({dataDir:dir,inference:engine});try{
 const send=(headers={})=>fetch(app.connection.url+'/api',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify({action:'state'})});
 assert.equal((await send()).status,401);
 assert.equal((await send({Authorization:`Bearer ${app.connection.token}`,Origin:'https://hostile.example'})).status,403);
 const r=await send({Authorization:`Bearer ${app.connection.token}`});assert.equal(r.status,200);assert.equal((await r.json()).workspace,null);
 assert.equal((await fetch(app.connection.url+'/server/main.mjs')).status,404);
 }finally{await app.close();}
});
