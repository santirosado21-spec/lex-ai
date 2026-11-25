import test from 'node:test';
import assert from 'node:assert/strict';
import {validateModelOutput} from '../server/skills.mjs';
import {validateGroundedOutput} from '../server/grounded-output.mjs';
const quote='El documento sintético contiene una declaración para cotejo exclusivamente de prueba.';
const evidence=[{id:'S1',text:quote,allowedQuotes:[quote]}];
const response=analysis=>JSON.stringify({analysis,citations:[{sourceId:'S1',quote}]});
const supported='El documento requiere cotejo profesional antes de concluir el análisis. [S1]';
test('an uncited short claim cannot borrow the citation from another paragraph',()=>{
 for(const claim of ['El plazo vence mañana.','No procede la demanda.','PENDIENTE: fecha del acto.','Análisis']){
  for(const separator of ['\n\n','\r\n\r\n','\n \t\n']){
   assert.throws(()=>validateModelOutput(response(claim+separator+supported),evidence),/párrafos sin referencia/);
   assert.throws(()=>validateModelOutput(response(supported+separator+claim),evidence),/párrafos sin referencia/);
  }
 }
});
test('short cited paragraphs and whitespace retain their original wording',()=>{
 const text='  Cotejar. [S1]\n\n\n'+supported+'\n\n';
 assert.equal(validateModelOutput(response(text),evidence).text,text);
});
test('a short paragraph with a foreign reference still fails closed',()=>{
 assert.throws(()=>validateModelOutput(response('No procede. [OTHER]\n\n'+supported),evidence),/no autorizados/);
});
test('current structured paragraph output still validates through the shared final check',()=>{
 const text='Este documento contiene una declaración para cotejo.';
 const checked=validateGroundedOutput(JSON.stringify({paragraphs:[{sourceId:'S1',quote,text,kind:'observacion'}]}),evidence);
 assert.equal(checked.validated.text,text+' [S1]');
 assert.equal(checked.validated.validation.legalAccuracy,'not-evaluated');
});

test('the real service neither saves nor streams an uncited short claim from a synthetic provider',async t=>{
 const {mkdtemp,writeFile,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');const path=await import('node:path');
 const {createHash}=await import('node:crypto');
 const {createService}=await import('../server/service.mjs');
 const dir=await mkdtemp(path.join(tmpdir(),'rejon-short-citation-'));
 const corpusPath=path.join(dir,'corpus.json');
 const text='Texto sintético de prueba: las obligaciones del contrato deben quedar descritas por las partes.';
 await writeFile(corpusPath,JSON.stringify([{id:'MX-TEST',title:'Fuente sintética',authority:'Fixture',jurisdiction:'MX-FED',practiceAreas:['civil'],category:'legislation',publishedAt:null,effectiveAt:null,amendedAt:null,version:'test-only',article:'prueba',url:'https://www.diputados.gob.mx/test-only',retrievedAt:'2026-11-24',status:'unknown-currentness',text,sha256:createHash('sha256').update(text).digest('hex'),accessNote:'Synthetic fixture, not legal authority'}]));
 let calls=0;
 const inference={async *generate(messages){
  calls++;const source=JSON.parse(messages[1].content).sources[0];
  yield JSON.stringify({analysis:'El plazo vence mañana.\n\nEl contrato exige cotejar las obligaciones del soporte antes de concluir. ['+source.id+']',citations:[{sourceId:source.id,quote:source.allowedQuotes[0]}]});
 }};
 const service=await createService({dataDir:path.join(dir,'firm'),corpusPath,libraryPath:path.join(dir,'absent.sqlite'),inference});
 t.after(async()=>{service.close();await rm(dir,{recursive:true,force:true});});
 await service.dispatch('workspace.create',{name:'Despacho sintético',practiceAreas:['civil']});
 const matter=await service.dispatch('matter.create',{title:'Contrato sintético',client:'Persona ficticia',jurisdiction:'MX-FED'});
 let streamed='';
 await assert.rejects(service.analyze({matterId:matter.id,question:'¿Qué obligaciones establece el contrato?',skillId:'contract-reviewer'},token=>{streamed+=token;}),/párrafos sin referencia/);
 assert.ok(calls>0);assert.equal(streamed,'');assert.equal((await service.dispatch('state')).answers.length,0);
});
