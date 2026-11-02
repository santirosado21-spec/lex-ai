import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,writeFileSync,rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { checkConflict,MAX_MATTERS_SCANNED } from '../server/conflicts.mjs';
import { createService } from '../server/service.mjs';

const lawText='Fuente sintética para pruebas de conflictos.';
const source={id:'MX-CONFLICT-TEST',title:'Fuente sintética',authority:'Fixture',jurisdiction:'MX-FED',practiceAreas:['civil'],category:'legislation',publishedAt:null,effectiveAt:null,amendedAt:null,version:'test-only',article:'prueba',url:'https://www.diputados.gob.mx/test-only',retrievedAt:'2026-11-02',status:'unknown-currentness',text:lawText,sha256:createHash('sha256').update(lawText).digest('hex'),accessNote:'Synthetic test data; not legal authority'};

async function fixture(t){
  const dir=mkdtempSync(join(tmpdir(),'lex-conflict-test-'));const corpusPath=join(dir,'corpus.json');writeFileSync(corpusPath,JSON.stringify([source]));
  const service=await createService({dataDir:join(dir,'firm'),corpusPath,inference:{}});
  t.after(()=>{service.close();rmSync(dir,{recursive:true,force:true});});
  await service.dispatch('workspace.create',{name:'Despacho sintético',practiceAreas:['civil']});
  return {service,dataDir:join(dir,'firm')};
}

test('matches exact client metadata and returns no document text',async t=>{
  const {service,dataDir}=await fixture(t);
  const matter=await service.dispatch('matter.create',{title:'Litigio sintético',client:'Grupo Águila, S.A. de C.V.',jurisdiction:'MX-FED'});
  await service.dispatch('document.import',{matterId:matter.id,name:'privado.txt',base64:Buffer.from('SECRETO_DE_DOCUMENTO no debe salir del chequeo.').toString('base64')});
  const result=await service.dispatch('conflict.check',{name:'grupo aguila'});
  assert.deepEqual(result.matches,[{matterId:matter.id,matterTitle:'Litigio sintético',field:'client',matchedText:'Grupo Águila, S.A. de C.V.',kind:'exact',score:1}]);
  assert.equal(JSON.stringify(result).includes('SECRETO_DE_DOCUMENTO'),false);
  assert.match(result.notice,/léxico/i);
  assert.match(result.notice,/no una determinación jurídica/i);
  const db=new DatabaseSync(join(dataDir,'lex.sqlite'));
  const audit=db.prepare("SELECT entity_id FROM audit WHERE action='conflict.check'").get();db.close();
  assert.equal(audit.entity_id,createHash('sha256').update('conflict.check:grupo aguila').digest('hex'));
  assert.equal(audit.entity_id.includes('Grupo Águila'),false);
});

test('matches persisted counterparties and returns their explicit field',async t=>{
  const {service}=await fixture(t);
  const matter=await service.dispatch('matter.create',{title:'Litigio de contraparte',client:'Cliente sintético',jurisdiction:'MX-FED',counterparties:[' Comercial Águila, S.A. de C.V. ','Comercial Aguila SA de CV']});
  assert.deepEqual(matter.counterparties,['Comercial Águila, S.A. de C.V.']);
  const result=await service.dispatch('conflict.check',{name:'comercial aguila'});
  assert.deepEqual(result.matches,[{matterId:matter.id,matterTitle:'Litigio de contraparte',field:'counterparties',matchedText:'Comercial Águila, S.A. de C.V.',kind:'exact',score:1}]);
});

test('normalization is accent, case, punctuation and corporate-suffix insensitive',()=>{
  const result=checkConflict({name:'  CAFÉ DEL SUR, s. de r.l.  '},[{id:'m-1',title:'Asunto',client:'Café del Sur S. de R.L. de C.V.'}]);
  assert.equal(result.matches[0].kind,'exact');assert.equal(result.matches[0].score,1);
});

test('reports bounded lexical typo leads but not unrelated names',()=>{
  const matters=[{id:'m-1',title:'Asunto Alfa',client:'Comercial del Norte'},{id:'m-2',title:'Asunto Beta',client:'Servicios Delta'}];
  const similar=checkConflict({name:'Comercal del Norte'},matters);
  assert.equal(similar.matches.length,1);assert.equal(similar.matches[0].kind,'similar');assert.ok(similar.matches[0].score>0.8);
  assert.deepEqual(checkConflict({name:'Compañía Zeta'},matters).matches,[]);
});

test('current workspace and initiating matter scope are enforced',async t=>{
  const {service:first}=await fixture(t),{service:second}=await fixture(t);
  const current=await first.dispatch('matter.create',{title:'Asunto actual',client:'Parte Única',jurisdiction:'MX-FED'});
  const prior=await first.dispatch('matter.create',{title:'Asunto previo',client:'Parte Única',jurisdiction:'MX-FED'});
  await second.dispatch('matter.create',{title:'Asunto ajeno',client:'Parte Única',jurisdiction:'MX-FED'});
  const result=await first.dispatch('conflict.check',{name:'Parte Única',matterId:current.id});
  assert.deepEqual(result.matches.map(match=>match.matterId),[prior.id]);
  await assert.rejects(second.dispatch('conflict.check',{name:'Parte Única',matterId:current.id}),/Asunto no encontrado/);
});

test('strict validation rejects unknown keys and malformed names or matter identifiers',async t=>{
  const {service}=await fixture(t);
  for(const payload of [{name:'A'},{name:'A'.repeat(201)},{name:'Acme',extra:true},{name:'Acme',matterId:'bad id'},{name:'A.C.'}])await assert.rejects(service.dispatch('conflict.check',payload),/conflicto|Nombre|Asunto/);
});

test('matter scanning is bounded and marks truncated results deterministically',()=>{
  const matters=Array.from({length:MAX_MATTERS_SCANNED+1},(_,index)=>({id:`m-${String(index).padStart(4,'0')}`,title:`Asunto ${index}`,client:index===MAX_MATTERS_SCANNED?'Parte fuera de límite':'Sin coincidencia'}));
  const result=checkConflict({name:'Parte fuera de límite'},matters);
  assert.equal(result.truncated,true);assert.deepEqual(result.matches,[]);
});
