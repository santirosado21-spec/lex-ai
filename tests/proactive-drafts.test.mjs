import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {createService} from '../server/service.mjs';
test('opted-in due reminder invokes production generation path, dedupes, queues a draft and never sends without precise approval',async t=>{
 const dataDir=await mkdtemp(path.join(os.tmpdir(),'lex-proactive-test-'));let generations=0,sends=0,statusReads=0,context;
 const inference={async status(){statusReads++;return {state:'ready',busy:false};},async *generate(messages,options){generations++;context=JSON.parse(messages[1].content);assert.equal(options.responseFormat,'text');yield 'Borrador sintético de seguimiento. PENDIENTE: confirmar información con la persona responsable.';}};
 const service=await createService({dataDir,corpusPath:path.resolve('resources/legal-corpus.json'),inference,mailTransport:{supported:true,async accounts(){throw Error('Must not connect automatically');},async send(){sends++;throw Error('Must not send');}},clock:()=>new Date('2026-11-03T12:00:00Z'),schedulerEnabled:false});
 t.after(()=>{service.close();return rm(dataDir,{recursive:true,force:true});});
 await service.dispatch('workspace.create',{name:'Despacho sintético',practiceAreas:['civil']});const matter=await service.dispatch('matter.create',{title:'Asunto sintético',client:'Parte sintética',jurisdiction:'MX-FED'});const other=await service.dispatch('matter.create',{title:'ASUNTO_AJENO_CANARY',client:'Parte ajena',jurisdiction:'MX-FED'});
 await service.dispatch('reminder.create',{matterId:matter.id,title:'Seguimiento sintético',kind:'followup',dueAt:'2026-11-03T10:00:00Z',note:'Nota sintética'});
 await service.dispatch('reminder.create',{matterId:other.id,title:'RECORDATORIO_AJENO_CANARY',kind:'followup',dueAt:'2026-11-03T10:00:00Z',note:'No compartir'});
 await service.dispatch('scheduler.tick');assert.equal(generations,0);assert.equal(statusReads,0);
 await service.dispatch('proactive.rule',{matterId:matter.id,title:'Propuesta de seguimiento',prompt:'Prepara preguntas para una reunión de seguimiento.',trigger:'reminder-due',enabled:true});
 await service.dispatch('scheduler.tick');assert.equal(generations,1);assert.doesNotMatch(JSON.stringify(context),/AJENO_CANARY/);assert.equal(sends,0);
 await service.dispatch('scheduler.tick');assert.equal(generations,1);let queue=await service.dispatch('proactive.list');assert.equal(queue.jobs.length,1);assert.equal(queue.jobs[0].status,'proposed');assert.equal((await service.dispatch('state')).chatTurns.length,0);
 const accepted=await service.dispatch('proactive.accept',{jobId:queue.jobs[0].id});assert.ok(accepted.replyId);const draft=await service.dispatch('draft.get',{replyId:accepted.replyId,matterId:matter.id});assert.match(draft.current.text,/Borrador sintético/);assert.equal(draft.original.validation.citationIntegrity,false);assert.equal(sends,0);await assert.rejects(service.dispatch('proactive.accept',{jobId:queue.jobs[0].id}),/ya fue decidida/);
});

test('concurrent scheduler polls claim one generation before awaiting model status',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'lex-proactive-concurrency-'));let release,statusReads=0,calls=0;const waiting=new Promise(resolve=>{release=resolve;});
 const service=await createService({dataDir:dir,corpusPath:path.resolve('resources/legal-corpus.json'),schedulerEnabled:false,inference:{async status(){statusReads++;await waiting;return {state:'ready'};},async *generate(){calls++;yield 'Borrador sintético único para revisión humana.';}}});
 t.after(()=>{release();service.close();return rm(dir,{recursive:true,force:true});});await service.dispatch('workspace.create',{name:'Despacho sintético',practiceAreas:['civil']});const m=await service.dispatch('matter.create',{title:'Asunto',client:'Parte ficticia',jurisdiction:'MX-FED'});
 for(const title of ['Regla A','Regla B'])await service.dispatch('proactive.rule',{matterId:m.id,title,prompt:'Prepara preguntas de organización.',trigger:'daily',enabled:true});
 const first=service.dispatch('scheduler.tick');const second=service.dispatch('scheduler.tick');await new Promise(resolve=>setImmediate(resolve));assert.equal(statusReads,1);release();await Promise.all([first,second]);assert.equal(calls,1);assert.equal((await service.dispatch('proactive.list')).jobs.length,1);
});
