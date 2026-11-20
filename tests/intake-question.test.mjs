import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm,readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {startServer} from '../server/main.mjs';
import {createIntakeGenerator} from '../server/intake-pilot.mjs';
import {questionPassage,researchEnvelope,renderResearchNote} from '../server/corpus/intake-research.mjs';
import {prepareFollowup,quotedRanges} from '../server/corpus/intake-followup.mjs';
import {customsPassage} from '../server/corpus/customs-edition.mjs';
import {openPublicLibrary} from '../server/public-library.mjs';
import {questionCandidates} from '../server/corpus/intake-question.mjs';

test('question prompt is bound to a verified source, a legal focus and the applicable parent clause',()=>{
 const selection={sourceId:'aduana-65',part:1,angle:'excepciones',concepts:['transporte','regalias']};
 const source=questionPassage(null,selection),passage=customsPassage('65').passages[1];
 const prompt=researchEnvelope(source).messages[0].content;
 assert.match(prompt,/Excepciones y condiciones de aplicación · Gastos de transporte/);
 assert.ok(!prompt.includes('Regalías')&&prompt.includes(passage.condition));
 assert.throws(()=>questionPassage(null,{...selection,concepts:['Empresa privada']}));
 assert.throws(()=>questionPassage(null,{...selection,angle:'otro'}));
 assert.throws(()=>researchEnvelope({...source,prompt:'Texto privado'}));
 const note=renderResearchNote(JSON.stringify({cita:passage.quote.slice(0,89),solicitud:'¿Qué comprobante detalla el transporte?'}),source);
 assert.ok(note.includes(passage.condition)&&note.includes(passage.quote)&&note.includes('[[CONSULTA]]'));
 assert.match(renderResearchNote(JSON.stringify({cita:passage.condition}),source),/Fundamento pendiente/);
 const follow=prepareFollowup(source,quotedRanges(source,note),'control');
 assert.ok(follow.prompt.includes(passage.condition));assert.ok(!follow.prompt.includes('[[CONSULTA]]'));
});

test('public library search respects exact citations, uses unmasked terms, and rejects unsupported jurisdictions',async t=>{
 const library=await openPublicLibrary('resources/public-library.sqlite');t.after(()=>library.close());
 const question='¿Qué requisitos se aplican a la prescripción de un pagaré?';
 const results=questionCandidates(library,question,[{text:question}]);
 assert.ok(results.some(r=>r.partial&&r.title.includes('Operaciones de Crédito')&&/pagar[eé]/iu.test(r.text)));
 const flete='¿Cómo acredito el flete de la factura en el valor en aduana?';
 assert.equal(questionCandidates(library,flete,[{text:flete}])[0].key,'aduana-65/1');
 const id=library.lookupArticle({lawId:'MX-FED-LCE',articleId:'9'}).sourceId;
 const ref={lawId:'MX-FED-LCE',jurisdiction:'MX-FED',articleId:'9'};
 const exact=questionCandidates(library,'Artículo 9 de la Ley de Comercio Exterior',[],ref);
 assert.ok(exact.length===1&&exact[0].source===id);
 assert.deepEqual(questionCandidates(library,'Artículo 99999 sobre origen',[],{...ref,articleId:'99999'}),[]);
 assert.deepEqual(questionCandidates(library,'Artículo 19 de una ley sin identificar',[]),[]);
 assert.deepEqual(questionCandidates(library,question,[],{unavailable:true}),[]);
});

test('question review stays on loopback, original restores only within its matter and edits stay local',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'rejon-pregunta-test-'));
 const original='¿Qué prueba tiene Empresa Ensayo Lila para acreditar el flete del lote X-9134?';
 const customer='Empresa Ensayo Lila',calls=[];
 const generate=createIntakeGenerator({getApiKey:async()=>'sk-'+'x'.repeat(32),fetchImpl:async(url,opts)=>{
  assert.equal(url,'https://api.openai.com/v1/chat/completions');calls.push(opts.body);
  return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({cita:customsPassage('65').passages[1].quote,solicitud:'¿Qué documento acredita los gastos de transporte?'})}}]});
 }});
 let app;const start=()=>startServer({dataDir:dir,intakePilot:true,intakeGenerate:generate,autoInitialize:false,pilotPassphrase:Buffer.from('palabras de prueba local')});
 t.after(async()=>{if(app)await app.close();await rm(dir,{recursive:true,force:true});});
 app=await start();const rpc=(name,payload)=>app.service.dispatch('intake.'+name,payload);
 const local=t.mock.method(globalThis,'fetch',async(url,opts)=>{
  assert.equal(url,'http://127.0.0.1:11434/api/chat');const req=JSON.parse(opts.body);
  return Response.json({message:{content:JSON.stringify(req.format.properties.entities?{entities:[],documentKind:'otro',client:'',title:''}:{oraciones:[]})}});
 });
 await rpc('save',{firm:'Despacho ficticio',client:customer,title:'Consulta de ensayo',jurisdiction:'MX-FED'});
 const inquiry=await rpc('inspectQuestion',{text:original});assert.doesNotMatch(inquiry.masked,/Empresa Ensayo Lila|X-9134/);
 assert.deepEqual(calls,[]);assert.equal(local.mock.callCount(),2);
 const choice={reviewId:inquiry.id,key:'aduana-65/1',angle:'documentos'};
 await assert.rejects(rpc('addQuestion',{...choice,prompt:original}));
 await assert.rejects(rpc('addQuestion',{...choice,key:'source invented'}));
 const {task,status}=await rpc('addQuestion',choice);
 assert.equal((await rpc('addQuestion',choice)).task,task);
 const preview=status.tasks.find(row=>row.id===task).preview;
 const after=await rpc('draft',{task});
 assert.equal(JSON.parse(calls[0]).messages[0].content,preview);
 assert.ok(![customer,'X-9134',inquiry.id,'[[LEX_'].some(s=>calls[0].includes(s)));
 assert.match(after.drafts[task],/\[\[CONSULTA\]\]/);
 await rpc('edit',{task,text:after.drafts[task]+'\nComentario privado.'});
 await assert.rejects(rpc('edit',{task,text:after.drafts[task]+' [[DATOS_DE_OTRA_CONSULTA]]'}));
 await app.close();app=await start();
 const restored=await rpc('preview',{task});assert.ok(restored.text.includes(original)&&restored.text.includes('Comentario privado.'));
 const {status:follow,task:child}=await rpc('addFollowup',{task,form:'control'});
 const next=follow.tasks.find(row=>row.id===child).preview;assert.ok(!next.includes(original)&&!next.includes('Comentario privado'));
 for(const entry of await readdir(dir,{withFileTypes:true}))if(entry.isFile()){
  assert.ok(!(await readFile(path.join(dir,entry.name))).includes(Buffer.from(customer)));
 }
});
