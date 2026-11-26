import test from 'node:test';
import assert from 'node:assert/strict';
import {questionPassage,renderResearchNote,researchEnvelope} from '../server/corpus/intake-research.mjs';
import {createIntakeGenerator} from '../server/intake-pilot.mjs';
const note=()=>questionPassage(null,{sourceId:'reg-aduana-117',part:0,angle:'documentos'});
const response=source=>JSON.stringify({cita:source.ref.text.slice(source.ref.text.lastIndexOf('Quienes ejerzan')),lectura:'La disposición permite cotejar la póliza y el aviso con los documentos de la operación.',solicitud:'¿Qué documento acredita la transmisión de la póliza?'});

test('a simulated response and abstention never claim a provider in the local rendering',()=>{
 const source=note(),before=JSON.stringify(researchEnvelope(source));
 const rendered=renderResearchNote(response(source),source);
 assert.ok(rendered.includes('Lectura preliminar para revisión'));
 assert.ok(rendered.includes('artículo 36- A de la Ley.'));
 assert.ok(rendered.includes('Nota editorial de lectura'));
 for(const raw of [response(source),'{"abstener":true}','not json'])assert.doesNotMatch(renderResearchNote(raw,source),/OpenAI/);
 assert.match(renderResearchNote('{"abstener":true}',source),/La respuesta indicó/);
 assert.equal(JSON.stringify(researchEnvelope(source)),before);
});

test('the default OpenAI adapter keeps its actual destination, request and response without a real model call',async()=>{
 const source=note(),calls=[];
 const generate=createIntakeGenerator({getApiKey:async()=>'sk-'+'x'.repeat(32),fetchImpl:async(url,options)=>{
  calls.push({url,body:JSON.parse(options.body)});
  return Response.json({choices:[{finish_reason:'stop',message:{content:response(source)}}]});
 }});
 const raw=await generate('attribution-test',{research:source});
 assert.equal(calls.length,1);assert.equal(calls[0].url,'https://api.openai.com/v1/chat/completions');
 assert.deepEqual(calls[0].body.messages,researchEnvelope(source).messages);
 assert.equal(raw,response(source));assert.doesNotMatch(renderResearchNote(raw,source),/OpenAI/);
});

test('injected simulation stays neutral in an actual encrypted pilot DOCX export',async t=>{
 const {mkdtemp,rm,writeFile,mkdir}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');const path=await import('node:path');
 const {startServer}=await import('../server/main.mjs');
 const {emptyLocalReading}=await import('./helpers/local-reader.mjs');
 const {default:mammoth}=await import('mammoth');
 const dir=await mkdtemp(path.join(tmpdir(),'rejon-attribution-'));
 const source=note();let calls=0;
 const app=await startServer({dataDir:dir,intakePilot:true,autoInitialize:false,libraryPath:path.join(dir,'absent.sqlite'),pilotPassphrase:Buffer.from('frase sintética de prueba'),
  intakeGenerate:async()=>{calls++;return response(source);}});
 t.after(async()=>{await app.close();await rm(dir,{recursive:true,force:true});});
 t.mock.method(globalThis,'fetch',async(url,opts)=>{
  assert.equal(url,'http://127.0.0.1:11434/api/chat');const request=JSON.parse(opts.body);
  return Response.json({message:{content:JSON.stringify(emptyLocalReading(request.format.properties))}});
 });
 const call=(action,payload)=>app.service.dispatch('intake.'+action,payload);
 await call('save',{firm:'SIMULACIÓN · Sin inferencia real',client:'Cliente sintético',title:'Prueba de atribución con respuesta simulada',jurisdiction:'MX-FED'});
 const review=await call('inspectQuestion',{text:'¿Qué documentos exige el artículo 117 del Reglamento de la Ley Aduanera?'});
 const {task}=await call('addQuestion',{reviewId:review.id,key:'reg-aduana-117/0',angle:'documentos'});
 await call('draft',{task});assert.equal(calls,1);
 const file=await call('export',{task,format:'docx'}),buffer=Buffer.from(file.base64,'base64');
 const text=(await mammoth.extractRawText({buffer})).value;
 assert.match(text,/SIMULACIÓN · Sin inferencia real/);assert.match(text,/Lectura preliminar para revisión/);
 assert.doesNotMatch(text,/OpenAI/);assert.match(text,/36- A/);assert.match(text,/Nota editorial de lectura/);
 if(process.env.REJON_ATTRIBUTION_EVIDENCE_DIR){await mkdir(process.env.REJON_ATTRIBUTION_EVIDENCE_DIR,{recursive:true});await writeFile(path.join(process.env.REJON_ATTRIBUTION_EVIDENCE_DIR,'simulation-export.docx'),buffer);}
});
