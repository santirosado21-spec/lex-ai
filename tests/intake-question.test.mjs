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
 const word='vidrio difuso';
 const privateQuestion=original+' '+word+' y '+word;
 for(const reserved of [null,[null],[word,word],['fuera de la pregunta'],['v']])
  await assert.rejects(rpc('inspectQuestion',{text:privateQuestion,reserved}));
 const manual=await rpc('inspectQuestion',{text:privateQuestion,reserved:[word]});
 assert.ok(!manual.masked.includes(word));
 const manualTask=(await rpc('addQuestion',{reviewId:manual.id,key:'aduana-65/1',angle:'documentos'})).task;
 assert.ok(manualTask!==undefined);
 const listed=await rpc('inspectQuestion',{text:'Coteja los artículos 97 y 117 de la Ley Aduanera.'});
 assert.deepEqual(new Set(listed.candidates.map(row=>row.citationId)),new Set(['MX-FED-LADUA-97','MX-FED-LADUA-117']));
 const regulation=await rpc('inspectQuestion',{text:'Compara los artículos 150 y 174 del Reglamento de la Ley Aduanera.'});
 assert.deepEqual(new Set(regulation.candidates.map(row=>row.key)),new Set(['reg-aduana-150/0','reg-aduana-174/0']));
 const single=await rpc('inspectQuestion',{text:'¿Qué dispone el artículo 174 del Reglamento de la Ley Aduanera?'});
 assert.deepEqual(single.candidates.map(r=>r.key),['reg-aduana-174/0']);
 const regulationTask=await rpc('addQuestion',{reviewId:single.id,key:single.candidates[0].key,angle:'documentos'});
 const regulationPreview=regulationTask.status.tasks.find(r=>r.id===regulationTask.task).preview;
 assert.match(regulationPreview,/programa de manufactura/);
 assert.match(regulationPreview,/hayan efectuado importaciones temporales/);
 const choice={reviewId:inquiry.id,key:'aduana-65/1',angle:'documentos'};
 assert.deepEqual(inquiry.facts,[]);
 for(const factIds of [[],['H1'],[original],null])await assert.rejects(rpc('addQuestion',{...choice,factIds}));
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

test('each citation in a two-source opinion must come from its assigned provision and is carried forward with its own conditions',()=>{
 const primary=customsPassage('64').passages[2],secondary=customsPassage('65').passages[1];
 const request={sourceId:'aduana-64',part:2,angle:'documentos',second:{sourceId:'aduana-65',part:1}};
 const source=questionPassage(null,request);
 const reply={cita:primary.quote.slice(0,75),segundaCita:secondary.quote.slice(0,67),lectura:'El importe pagado debe cotejarse con el soporte de transporte para identificar un posible ajuste.',solicitud:'¿Quién pagó el transporte y cómo se acredita?'};
 const note=renderResearchNote(JSON.stringify(reply),source);
 const ranges=quotedRanges(source,note);
 assert.equal(ranges.length,2);
 const follow=prepareFollowup(source,ranges,'control');
 assert.deepEqual(follow.refs.map(r=>r.id),['MX-FED-LADUA-64','MX-FED-LADUA-65']);
 assert.equal(follow.quotes[0].condition,undefined);assert.equal(follow.quotes[1].condition,secondary.condition);
 assert.ok(note.includes(secondary.condition)&&follow.prompt.includes(secondary.condition));
 for(const change of [{cita:reply.segundaCita},{segundaCita:reply.cita},{lectura:''},{solicitud:''},{extra:'disposición ajena'}]){
  const invalid=renderResearchNote(JSON.stringify({...reply,...change}),source);
  assert.match(invalid,/Fundamento pendiente/);assert.deepEqual(quotedRanges(source,invalid),[]);
 }
 for(const wrong of [[ranges[0]],[ranges[1],ranges[0]],[ranges[1],ranges[1]]])assert.throws(()=>prepareFollowup(source,wrong,'control'));
 assert.throws(()=>questionPassage(null,{...request,second:{sourceId:'aduana-64',part:1}}));
});

test('return and replacement identify separate customs regimes and preserve the page break and the prior import condition',async t=>{
 const library=await openPublicLibrary('resources/public-library.sqlite');t.after(()=>library.close());
 const question='¿Qué documentos permiten distinguir el retorno de una mercancía exportada para reparación de la sustitución de un bien previamente importado por resultar defectuoso?';
 const candidates=q=>questionCandidates(library,q,[{text:q}]);
 assert.deepEqual(new Set(candidates(question).slice(0,2).map(r=>r.source)),new Set(['aduana-117','aduana-97']));
 assert.equal(candidates('¿Qué régimen de exportación temporal permite retornar la mercancía en el mismo estado?')[0].source,'aduana-115');
 assert.ok(!candidates('¿Qué garantía cubre la reparación de un bien defectuoso que adquirí en una tienda?').some(r=>/^aduana-(97|115|117)$/.test(r.source)));
 const note=questionPassage(library,{sourceId:'aduana-117',part:1,angle:'documentos',second:{sourceId:'aduana-97',part:1}});
 assert.match(note.body,/clasificación arancelaria de la mercancía retornada\.$/u);
 assert.match(note.ref.locator,/79–80/);
 const [first,second]=note.sources;
 const rendered=renderResearchNote(JSON.stringify({cita:first.body.slice(0,95),segundaCita:second.body,lectura:'El régimen previo y la identidad de las mercancías permiten distinguir reparación y sustitución.',solicitud:'¿Qué documento identifica la mercancía retornada?'}),note);
 assert.ok(rendered.includes(second.condition));
 const next=prepareFollowup(note,quotedRanges(note,rendered),'control');
 assert.ok(next.prompt.includes(second.condition)&&next.prompt.includes('Condición del párrafo primero'));
 assert.throws(()=>questionPassage(library,{sourceId:'aduana-999',part:0,angle:'documentos'}));
});

test('manual search uses reviewed lines in this matter and keeps the private document out of a generic question',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'rejon-soporte-manual-'));
 const app=await startServer({dataDir:dir,intakePilot:true,autoInitialize:false,pilotPassphrase:Buffer.from('palabras del expediente de ensayo')});
 t.after(async()=>{await app.close();await rm(dir,{recursive:true,force:true});});
 t.mock.method(globalThis,'fetch',async(url,opts)=>{
  assert.equal(url,'http://127.0.0.1:11434/api/chat');
  const shape=JSON.parse(opts.body).format.properties;
  return Response.json({message:{content:JSON.stringify(shape.oraciones?{oraciones:[]}:{entities:[],documentKind:'otro',client:'',title:''})}});
 });
 const rpc=(name,payload)=>app.service.dispatch('intake.'+name,payload);
 await rpc('save',{firm:'Despacho de Ensayo',client:'Cliente de Ensayo',title:'Prueba de líneas',jurisdiction:'MX-FED'});
 const sentence='El comprador pagó el flete del embarque de ensayo GSQ-54821 para determinar el valor en aduana.';
 const file=await rpc('inspectSource',{extension:'txt',base64:Buffer.from(sentence).toString('base64'),review:true});
 const source=await rpc('addSource',{reviewId:file.reviewId,label:'Recibo turquesa'});
 const query=await rpc('inspectQuestion',{text:'¿Qué información permite aclarar lo sucedido?'});
 const refine=lines=>rpc('refineQuestion',{reviewId:query.id,lines});
 await assert.rejects(refine(['line:inventada/1']));
 const [row]=await rpc('questionLines',{reviewId:query.id,sourceId:source.id});
 for(const invalid of [[],[row.id,row.id],null])await assert.rejects(refine(invalid));
 const result=await refine([row.id]);assert.notEqual(result.id,query.id);
 const freight=result.candidates.find(r=>r.key==='aduana-65/1');assert.ok(freight);
 const choice={reviewId:result.id,key:freight.key,angle:'documentos'};
 await assert.rejects(rpc('addQuestion',choice));
 const {status,task}=await rpc('addQuestion',{...choice,factIds:[row.id]});
 const prompt=status.tasks.find(x=>x.id===task).preview;
 assert.ok(!prompt.includes('GSQ-54821')&&!prompt.includes(sentence)&&!prompt.includes('Recibo turquesa'));
});
