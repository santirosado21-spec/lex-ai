import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
import {startServer} from '../server/main.mjs';import {createStore} from '../server/store.mjs';import {createReasoningBoundary,REASONING_UNAVAILABLE} from '../server/reasoning-boundary.mjs';

test('product composition blocks every legacy reasoning entry without calling or starting local engine; history remains editable',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'reasoning-role-'));let calls=0,starts=0,stops=0;
 const local={status:async()=>({state:'ready'}),initialize:async()=>{starts++;},stop:async()=>{stops++;},async *generate(){calls++;yield 'FORBIDDEN_LOCAL_REASONING';}};
 const app=await startServer({dataDir:dir,inference:local,autoInitialize:true,libraryPath:path.join(dir,'absent')});
 try{
  assert.equal(starts,0);const service=app.service;
  await service.dispatch('workspace.create',{name:'Despacho sintético',practiceAreas:['civil']});
  const m=await service.dispatch('matter.create',{title:'Contrato sintético',client:'Parte ficticia',jurisdiction:'MX-FED'});
  await service.dispatch('document.import',{matterId:m.id,name:'contrato.txt',base64:Buffer.from('Las partes acuerdan obligaciones de pago según el contrato sintético.').toString('base64')});
  for(const payload of [{mode:'chat',question:'Escribe una nota para la reunión.'},{mode:'auto',matterId:m.id,question:'Revisa las obligaciones del contrato.'},...['contract-reviewer','legal-drafter','legal-researcher','document-analyzer','matter-assistant'].map(skillId=>({matterId:m.id,skillId,question:'Revisa las obligaciones del contrato.'}))]){
   await assert.rejects(service.analyze(payload),e=>e.code===REASONING_UNAVAILABLE.code);
   const r=await fetch(app.connection.url+'/analyze',{method:'POST',headers:{Authorization:'Bearer '+app.connection.token,'Content-Type':'application/json'},body:JSON.stringify({payload})});
   const body=await r.text();assert.match(body,/reason|razonamiento|anonimizar/i);assert.doesNotMatch(body,/"type":"token"/);
  }
  const rpc=async(action,payload={})=>{const r=await fetch(app.connection.url+'/api',{method:'POST',headers:{Authorization:'Bearer '+app.connection.token,'Content-Type':'application/json'},body:JSON.stringify({action,payload})});return {status:r.status,data:await r.json()};};
  assert.equal((await rpc('engine.initialize')).status,400);assert.equal(starts,0);
  assert.equal((await rpc('engine.status')).data.reasoning.available,false);
  assert.equal((await rpc('state')).data.reasoning.available,false);
  const rule=await service.dispatch('proactive.rule',{matterId:m.id,title:'Seguimiento sintético',prompt:'Prepara una nota de seguimiento',trigger:'daily',enabled:true});
  const tick=await service.dispatch('scheduler.tick',{});assert.equal(tick.proactive.generated,0);
  assert.equal((await service.dispatch('proactive.list')).rules[0].id,rule.id);
  assert.equal((await service.dispatch('proactive.list')).jobs.length,0);
  assert.equal(calls,0);assert.equal(starts,0);
  // Seed only historical work, never a provider result.
  const store=createStore(dir);const w=(await service.dispatch('state')).workspace;
  store.put('answer',{id:'historical-answer',workspaceId:w.id,matterId:m.id,question:'Consulta histórica sintética',text:'Texto histórico sintético conservado.',citations:[],createdAt:'2026-11-24T12:00:00Z',validation:{citationIntegrity:false}});store.close();
  const prior=(await service.dispatch('office.history',{matterId:m.id})).find(a=>a.id==='historical-answer');assert.equal(prior.text,'Texto histórico sintético conservado.');
  let draft=await service.dispatch('draft.get',{replyId:prior.id,matterId:m.id});draft=await service.dispatch('draft.save',{draftId:draft.id,matterId:m.id,expectedVersion:1,title:'Revisión humana',text:'Edición manual del escrito histórico.'});
  assert.equal(draft.version,2);assert.equal(draft.original.text,prior.text);
  assert.ok((await service.dispatch('answer.export',{answerId:prior.id,matterId:m.id})).base64);
  assert.equal(calls,0);
 }finally{await app.close();await rm(dir,{recursive:true,force:true});}
 assert.equal(stops,1);
});

test('reasoning boundary never delegates generate or initialize for arbitrary options',async()=>{
 let calls=0;const b=createReasoningBoundary({async *generate(){calls++;},initialize(){calls++;}});
 for(const options of [{},{destination:'openai',scope:{}},{purpose:'anonymize'},{mode:'chat'}])await assert.rejects(async()=>{for await(const _ of b.generate([],options)){}},e=>e.code===REASONING_UNAVAILABLE.code);
 await assert.rejects(b.initialize());assert.equal(calls,0);
});
