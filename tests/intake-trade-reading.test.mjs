import test from 'node:test';
import assert from 'node:assert/strict';
import {access,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import mammoth from 'mammoth';
import {openPublicLibrary} from '../server/public-library.mjs';
import {startServer} from '../server/main.mjs';
import {createIntakeGenerator} from '../server/intake-pilot.mjs';
import {loadTradeReading,renderTradeReading,suggestTradeReadings} from '../server/corpus/intake-trade-reading.mjs';

test('trade reading requires a documentary mention with word boundaries and retains exact local evidence',()=>{
 const preface='🧾 '+('informe '.repeat(60));
 const text='Proveedor: Certificado de Origen SA\nAlguien ocupó un asiento.\n'+preface+'Se revisará la FRACCIÓN ARANCELARIA del equipo.';
 const choices=suggestTradeReadings(text);
 assert.deepEqual(choices.map(x=>x.id),['lectura-clasificacion']);
 assert.equal(choices[0].line,3);
 assert.ok(text.includes(choices[0].excerpt)&&choices[0].excerpt.includes('FRACCIÓN ARANCELARIA')&&choices[0].excerpt.length<400);
});

test('seven research topics use actual pinned passages and validate each quote against its own source',async t=>{
 const file='resources/public-library.sqlite';
 try{await access(file);}catch{t.skip('Requiere la biblioteca federal');return;}
 const lib=await openPublicLibrary(file);t.after(()=>lib.close());
 const topics=suggestTradeReadings('Reglas de origen, cupos, regulaciones no arancelarias, FRACCIÓN ARANCELARIA, dumping, subvenciones y salvaguardas.');
 assert.equal(topics.length,7);
 for(const {id} of topics){
  const reading=loadTradeReading(lib,id);
  assert.equal(reading.refs.length,2);
  const [a,b]=reading.choices.map(options=>options[0].quote);
  const output=renderTradeReading(JSON.stringify({A:{pasaje:'B1'},B:{pasaje:'B1'}}),reading);
  assert.ok(output.includes('Fundamento pendiente de cotejo.')&&!output.includes(a));
  assert.ok(output.includes(b));
  assert.ok(reading.choices.every((choices,i)=>choices.every(choice=>reading.refs[i].text.includes(choice.quote))));
 }
 let posts=0;
 const send=createIntakeGenerator({getApiKey:async()=>'unused',fetchImpl:async()=>{posts++;}});
 await assert.rejects(send('lectura-cupos',{reading:{prompt:'Texto inventado'}}),/procedencia/);
 assert.equal(posts,0);
});

test('an imported document gets a two-source note, local-only evidence, editable restoration, export and offline reopen',async t=>{
 const index=path.resolve('resources/public-library.sqlite');
 try{await access(index);}catch{t.skip('Requiere la biblioteca federal');return;}
 const dir=await mkdtemp(path.join(tmpdir(),'rejon-revision-'));
 const privateName='Sociedad de Prueba Talavera';
 const line='Se solicita revisar el cupo del proyecto ficticio Turquesa 841-A.';
 const original='Cliente: '+privateName+'\n'+line;
 const sent=[];let response;
 const generator=createIntakeGenerator({getApiKey:async()=>'sk-'+'m'.repeat(35),fetchImpl:async(_url,o)=>{
  sent.push(JSON.parse(o.body));return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(response)}}]});
 }});
 const start=libraryPath=>startServer({dataDir:dir,autoInitialize:false,intakePilot:true,intakeGenerate:generator,libraryPath,pilotPassphrase:Buffer.from('una frase para prueba ficticia')});
 let app=await start(index);t.after(async()=>{await app.close();await rm(dir,{recursive:true,force:true});});
 const call=(action,payload={})=>app.service.dispatch(action,payload);
 const actualFetch=globalThis.fetch;
 let upload;
 try{
  globalThis.fetch=async url=>{
   assert.equal(url,'http://127.0.0.1:11434/api/chat');
   return Response.json({message:{content:JSON.stringify({client:privateName,title:'',documentKind:'otro',entities:[privateName]})}});
  };
  upload=await call('intake.inspectLocal',{extension:'txt',base64:Buffer.from(original).toString('base64'),review:true});
 }finally{globalThis.fetch=actualFetch;}
 const data=await call('intake.save',{firm:'Despacho Ficticio',client:privateName,title:'Encargo único',jurisdiction:'MX-FED',reviewId:upload.reviewId});
 const task='lectura-cupos',note=data.tasks.find(n=>n.id===task);
 assert.equal(note.evidence.excerpt,line);assert.equal(sent.length,0);
 await assert.rejects(call('intake.draft',{task:'lectura-salvaguardas'}),/Selecciona/);
 await assert.rejects(call('intake.draft',{task,excerpt:'otro'}));
 response=Object.fromEntries(note.references.map((r,i)=>[i?'B':'A',{pasaje:i?'B1':'A1',solicitud:'¿Qué documento acredita el volumen solicitado?'}]));
 const generated=await call('intake.draft',{task});
 assert.ok(generated.drafts[task].includes('[[SOPORTE]]'));
 assert.equal(sent.length,1);assert.equal(sent[0].messages[0].content,note.preview);
 for(const term of ['841-A',privateName,'Encargo único',line,'[[SOPORTE]]'])assert.ok(!JSON.stringify(sent[0]).includes(term));
 assert.equal((await call('intake.preview',{task})).text.includes(line),true);
 await call('intake.edit',{task,text:generated.drafts[task]+'\nRevisado.'});
 await app.close();app=await start(path.join(dir,'sin-indice'));
 assert.ok((await call('intake.status')).tasks.find(n=>n.id===task).preview===note.preview);
 const file=await call('intake.export',{task,format:'docx'});
 const {value}=await mammoth.extractRawText({buffer:Buffer.from(file.base64,'base64')});
 assert.ok(value.includes(line)&&value.includes(privateName)&&value.includes('Revisado.')&&!value.includes('[[SOPORTE]]'));
 for(const id of ['MX-FED-LCE-23','MX-FED-LCE-24'])assert.ok(value.includes(id));
 await call('intake.edit',{task,text:'[[CLIENTE]] · [[ASUNTO]] sin anexo'});
 assert.ok(!(await call('intake.preview',{task})).text.includes(line));
 assert.equal(sent.length,1);
});
