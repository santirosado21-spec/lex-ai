import test from 'node:test';
import assert from 'node:assert/strict';
import mammoth from 'mammoth';
import {buildAnswerDocx} from '../server/docx-export.mjs';
const context={firm:{name:'Despacho sintético'},matter:{title:'Asunto sintético'},answer:{question:'Consulta sintética',text:'Documento de prueba.',citations:[],createdAt:'2026-11-25T02:30:00Z'}};
const text=async value=>(await mammoth.extractRawText({buffer:await buildAnswerDocx(value)})).value;
test('document date follows the existing Mexico City product default across UTC midnight without mutating timestamps',async()=>{
 const before=structuredClone(context);
 assert.match(await text(context),/Fecha: 24 de noviembre de 2026/);
 assert.deepEqual(context,before);
 assert.match(await text({...context,answer:{...context.answer,createdAt:'2026-11-25T06:30:00Z'}}),/Fecha: 25 de noviembre de 2026/);
});
test('explicit service timezone is honored, invalid timezone rejected and date-only source metadata is not shifted',async()=>{
 assert.match(await text({...context,timeZone:'Asia/Tokyo'}),/Fecha: 25 de noviembre de 2026/);
 await assert.rejects(text({...context,timeZone:'Invalid/Zone'}),/time zone|timezone/i);
 const value={...context,answer:{...context.answer,createdAt:'2026-11-24',citations:[{id:'source',title:'Fuente sintética',retrievedAt:'2026-11-19',version:'copia sintética',status:'sin evaluar'}]}};
 const output=await text(value);assert.match(output,/Fecha: 24 de noviembre de 2026/);assert.ok(output.includes('2026-11-19'));
});

test('general service passes its configured planner timezone to document export without changing stored answer',async t=>{
 const {mkdtemp,writeFile,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const path=await import('node:path');
 const {createService}=await import('../server/service.mjs');const {createStore}=await import('../server/store.mjs');
 const dir=await mkdtemp(path.join(tmpdir(),'rejon-doc-date-'));const corpusPath=path.join(dir,'corpus.json');await writeFile(corpusPath,'[]');
 const dataDir=path.join(dir,'firm');const service=await createService({dataDir,corpusPath,plannerTimeZone:'Asia/Tokyo'});
 t.after(async()=>{service.close();await rm(dir,{recursive:true,force:true});});
 await service.dispatch('workspace.create',{name:'Despacho de prueba',practiceAreas:['Civil']});
 const matter=await service.dispatch('matter.create',{title:'Asunto sintético',client:'Cliente sintético',jurisdiction:'MX-FED'});
 const answer={...structuredClone(context.answer),id:'date-proof-answer',matterId:matter.id,createdAt:'2026-11-24T20:30:00Z'};
 const store=createStore(dataDir);store.put('answer',answer);store.close();
 const file=await service.dispatch('answer.export',{matterId:matter.id,answerId:answer.id});
 const output=(await mammoth.extractRawText({buffer:Buffer.from(file.base64,'base64')})).value;
 assert.match(output,/Fecha: 25 de noviembre de 2026/);
 assert.deepEqual((await service.dispatch('state')).answers.find(row=>row.id===answer.id),answer);
});
