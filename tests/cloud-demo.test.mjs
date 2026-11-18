import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {createCloudDemo} from '../server/cloud-demo.mjs';
import {startServer} from '../server/main.mjs';

test('the cloud demo uses only its fixed message and caps outbound requests', async () => {
 const dataDir = await mkdtemp(path.join(os.tmpdir(), 'rejon-cloud-demo-'));
 const captured = [];
 const cloudDemo = createCloudDemo({
  getApiKey:async()=>`sk-${'x'.repeat(32)}`,
  fetchImpl:async (url, options) => {
   captured.push({url, body:JSON.parse(options.body)});
   return Response.json({choices:[{finish_reason:'stop',message:{content:'LISTO'}}]});
  },
 });
 const app = await startServer({dataDir, cloudDemo, autoInitialize:false, libraryPath:path.join(dataDir,'unused.sqlite')});
 try {
  const {url, token} = app.connection;
  const call = (body, authorization=token) => fetch(url+'/api',{
   method:'POST',
   headers:{'content-type':'application/json',authorization:`Bearer ${authorization}`},
   body:JSON.stringify(body),
  });
  assert.equal((await call({action:'cloudDemo.run'}, 'invalid')).status, 401);
  for (const body of [
   {action:'cloudDemo.run',payload:{question:'PRIVATE_CANARY',matterId:'private-matter'}},
   {action:'cloudDemo.run',payload:[]},
   {action:'cloudDemo.run',payload:null},
   {action:'cloudDemo.run',history:['PRIVATE_CANARY']},
  ]) assert.equal((await call(body)).status, 400);
  assert.equal(captured.length, 0);

  for (let attempt=0; attempt<3; attempt++) {
   const res = await call({action:'cloudDemo.run',payload:{}});
   assert.equal(res.status, 200);
   assert.deepEqual(await res.json(), {connected:true});
  }
  assert.equal((await call({action:'cloudDemo.run'})).status, 400);
  assert.equal(captured.length, 3);
  for (const {url, body} of captured) {
   assert.equal(url, 'https://api.openai.com/v1/chat/completions');
   assert.deepEqual(body.messages, [{role:'user',content:'Prueba técnica con datos ficticios. Responde únicamente con la palabra LISTO.'}]);
   assert.equal(body.store, false);
   assert.equal(body.max_completion_tokens, 64);
   assert.equal(body.tools, undefined);
  }
 } finally {
  await app.close();
  await rm(dataDir,{recursive:true,force:true});
 }
});
