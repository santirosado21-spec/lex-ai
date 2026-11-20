import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {startServer} from '../server/main.mjs';
import {createIntakeGenerator} from '../server/intake-pilot.mjs';
import {comparisonEnvelope,comparisonsFor,readComparisonReply,renderComparison} from '../server/corpus/intake-comparison.mjs';

const freight=['incluido','excluido','pendiente'],annex=['presente','ausente','pendiente'];
const question='¿Qué documento permite cotejar esta hipótesis?';
const response=(ids,key='P1')=>JSON.stringify(Object.fromEntries(ids.map(id=>[id,{pasaje:key,pregunta:question}])));
const example='Cliente: Empresa Nube de Ensayo\nEl precio pagado incluye el flete. Ref. MN-87251\nPrecio pagado: USD 8932.31\nFalta el acuse de los anexos del pedimento.';
test('local evidence distinguishes negation, uncertain statements and contradictions while public bytes stay identical',async()=>{
 const suggestions=text=>comparisonsFor(text).filter(n=>n.suggested);
 const yes=suggestions(example);
 assert.deepEqual(yes.map(n=>n.id),['contraste-flete-incluido','contraste-acuse-ausente']);
 for(const text of ['El precio pagado no incluye el flete.','Flete: no incluido en el precio pagado.','El flete está excluido del precio.'])
  assert.equal(suggestions(text)[0].id,'contraste-flete-excluido');
 for(const text of ['¿El precio pagado incluye el flete?','Flete: 104.9 USD','Si el precio pagado incluye el flete, pedir detalle.','El precio pagado incluye el flete. Sin verificar.'])
  assert.equal(suggestions(text)[0].id,'contraste-flete-pendiente');
 const conflict=suggestions('El precio pagado incluye el flete.\nEl precio pagado no incluye el flete.')[0];
 assert.ok(conflict.conflicting);assert.equal(conflict.evidence.additional[0].line,2);
 assert.deepEqual(comparisonEnvelope(conflict.packet),comparisonEnvelope(yes[0].packet));
 assert.ok(!comparisonEnvelope(conflict.packet).messages[0].content.includes('MN-87251'));
 assert.equal(suggestions('Nombre sin indicios.\nProveedor: Flete Mirlo').length,0);
 assert.equal(suggestions('Acuse de validación: REF-998B')[0].variant.id,'pendiente');
 assert.equal(suggestions('Se adjunta el acuse de los anexos al pedimento.')[0].variant.id,'presente');
 assert.throws(()=>comparisonEnvelope({...yes[0].packet}));
});
test('each branch must have a valid citation and documentary question, and restored context fits the editor',()=>{
 for(const note of comparisonsFor(example)){
  const {packet}=note,ids=packet.variants.map(v=>v.id);
  for(const choice of packet.choices){
   const result=renderComparison(note,readComparisonReply(response(ids,choice.key),packet));
   assert.ok(result.length<=1800);assert.ok(result.includes(choice.quote));
   assert.ok(result.includes(packet.choices[0].quote));assert.ok(result.includes('[[SOPORTE]]'));
  }
  for(const raw of ['{}',response(ids,'P9'),response(ids).replace(question,'Texto inventado'),response(ids).replace('pregunta','otra')])
   assert.throws(()=>readComparisonReply(raw,packet));
 }
});
test('one authorized POST covers the three variants; edits, supporting lines and cached answers survive reopening',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'rejon-comparar-')),sent=[];
 const generate=createIntakeGenerator({getApiKey:async()=>'sk-'+'c'.repeat(32),fetchImpl:async(_u,opts)=>{
  sent.push(opts.body);
  const ids=opts.body.includes('Acuse de')||opts.body.includes('presente |')?annex:freight;
  return Response.json({choices:[{finish_reason:'stop',message:{content:response(ids,'P2')}}]});
 }});
 let app;
 const start=()=>startServer({dataDir:dir,intakePilot:true,pilotPassphrase:Buffer.from('frase ficticia para cotejo'),intakeGenerate:generate,autoInitialize:false});
 t.after(async()=>{await app?.close();await rm(dir,{recursive:true,force:true});});app=await start();
 const call=(a,p={})=>app.service.dispatch(a,p);
 const native=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,'http://127.0.0.1:11434/api/chat');
  const fields=JSON.parse(options.body).format.properties;
  return Response.json({message:{content:JSON.stringify(fields.oraciones?{oraciones:[]}:{client:'',title:'',documentKind:'otro',entities:[]})}});
 };
 let inspection;
 try{inspection=await call('intake.inspectLocal',{extension:'txt',base64:Buffer.from(example).toString('base64'),review:true});}
 finally{globalThis.fetch=native;}
 const saved=await call('intake.save',{firm:'Despacho Inventado',title:'Simulación del transporte',client:'Empresa Nube de Ensayo',jurisdiction:'MX-FED',reviewId:inspection.reviewId});
 const note=saved.tasks.find(x=>x.id==='contraste-flete-incluido');assert.ok(note.comparison.suggested);
 assert.ok(!note.comparison.cached);assert.equal(sent.length,0);
 await assert.rejects(call('intake.draft',{task:note.id,branch:'incluido'}));
 const built=await call('intake.draft',{task:note.id});assert.equal(JSON.parse(sent[0]).messages[0].content,note.preview);
 assert.ok(built.tasks.filter(x=>x.comparison?.subject==='flete').every(x=>x.comparison.cached));
 await call('intake.edit',{task:note.id,text:built.drafts[note.id]+'\nRevisión privada de prueba.'});
 await app.close();app=await start();
 const alt='contraste-flete-excluido';await call('intake.draft',{task:alt});assert.equal(sent.length,1);
 const current=await call('intake.status');
 assert.ok(current.drafts[note.id].includes('Revisión privada de prueba.'));assert.ok(!current.drafts[alt].includes('Revisión privada'));
 assert.ok((await call('intake.preview',{task:alt})).text.includes('MN-87251'));
 for(const term of ['MN-87251','8932.31','Empresa Nube','Revisión privada','contraste-flete-incluido'])assert.ok(!sent[0].includes(term));
 await call('intake.draft',{task:'contraste-acuse-ausente'});assert.equal(sent.length,2);
 assert.ok(!(await readFile(path.join(dir,'rejon-protegido.sqlite'))).includes(Buffer.from('MN-87251')));
});

test('royalty scenarios carry the historic judicial source and the printed statutory condition separately',()=>{
 for(const [text,id] of [
  ['El pago de regalías es condición de venta.','pactada'],
  ['El pago de las regalías no es condición de venta.','negada'],
  ['El contrato de licencia registra una operación.','pendiente'],
 ]){
  const note=comparisonsFor(text).find(n=>n.suggested),{packet}=note;
  assert.equal(note.variant.id,id);
  assert.ok(packet.prompt.includes('PC.I.A. J/90 A (10a.)')&&packet.prompt.includes('2013396'));
  const matrix=readComparisonReply(response(packet.variants.map(v=>v.id),'P3'),packet);
  const result=renderComparison(note,matrix);
  assert.ok(result.includes('[SJF-2013396]')&&result.includes('[MX-FED-LADUA-65]')&&result.includes('fracción III'));
  assert.ok(result.length<=1800);assert.ok(packet.refs[1].url.endsWith('/2013396'));
  assert.throws(()=>renderComparison(note,{...matrix,digest:'old'}));
  assert.throws(()=>renderComparison(note,{...matrix,answers:{[id]:{pasaje:'P1',pregunta:'Un texto arbitrario'}}}));
 }
});
