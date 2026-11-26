import test from 'node:test';
import assert from 'node:assert/strict';
import {regulationPassage} from '../server/corpus/customs-edition.mjs';
import {regulationReadingNotes,renderedRegulationReadingNotes} from '../server/corpus/regulation-reading-notes.mjs';
import {questionPassage,researchEnvelope,renderResearchNote} from '../server/corpus/intake-research.mjs';
import {prepareFollowup,quotedRanges,renderFollowup,followupEnvelope} from '../server/corpus/intake-followup.mjs';
const selection={sourceId:'reg-aduana-117',part:0,angle:'documentos'};
const response=note=>JSON.stringify({cita:note.ref.text.slice(note.ref.text.lastIndexOf('Quienes ejerzan')),lectura:'La disposición permite cotejar la póliza y el aviso con los documentos de la operación.',solicitud:'¿Qué documento acredita la transmisión de la póliza?'});
test('117 reading metadata is separate from literal quote and provider envelope',()=>{
 const source=regulationPassage('117'),note=questionPassage(null,selection);
 const [mark]=source.ref.readingNotes;
 assert.equal(source.ref.text.slice(mark.start,mark.end),'36- A');assert.equal(mark.page,42);assert.equal(mark.reading,'36-A');
 assert.equal(mark.pdfSha256,source.ref.pdfSha256);assert.ok(Object.isFrozen(mark));
 assert.ok(note.ref.text.includes('artículo 36- A de la Ley.'));
 assert.ok(note.prompt.includes('artículo 36- A de la Ley.'));
 assert.ok(!note.prompt.includes(mark.message));assert.ok(!JSON.stringify(researchEnvelope(note)).includes('readingNotes'));
 const output=renderResearchNote(response(note),note);
 assert.ok(output.includes('artículo 36- A de la Ley.'));
 assert.ok(output.includes('Nota editorial de lectura · Reglamento, artículo 117'));
 assert.equal(output.split(mark.message).length-1,1);
 assert.ok(renderResearchNote('{"abstener":true}',note).includes(mark.message));
 const ranges=quotedRanges(note,output);assert.equal(ranges.length,1);
 const follow=prepareFollowup(note,ranges,'control');
 assert.ok(!JSON.stringify(followupEnvelope(follow)).includes(mark.message));
 const result=renderFollowup(JSON.stringify({acciones:['Cotejar la póliza con el aviso presentado.','Revisar los documentos que respaldan la transmisión.']}),follow);
 assert.ok(result.includes(mark.message));assert.ok(result.includes('36- A'));
});
test('reading notes fail on changed literal and never spread to other articles or PDF hashes',()=>{
 assert.equal(regulationReadingNotes('118','36- A'),undefined);
 assert.throws(()=>regulationReadingNotes('117','36A'),/requiere cotejo/);
 assert.throws(()=>regulationReadingNotes('117','36- A y 36- A'),/requiere cotejo/);
 const ref=regulationPassage('117').ref;
 assert.deepEqual(renderedRegulationReadingNotes([{...ref,pdfSha256:'other'}]),[]);
 assert.deepEqual(renderedRegulationReadingNotes([{...ref,id:'MX-FED-LADUA-117'}]),[]);
 assert.deepEqual(renderedRegulationReadingNotes([{...ref,text:ref.text.replace('36- A','36-A')}]),[]);
 for(const article of ['116','118','119'])assert.equal(regulationPassage(article).ref.readingNotes,undefined);
 const pair=questionPassage(null,{...selection,second:{sourceId:'reg-aduana-118',part:0}});
 assert.equal(renderedRegulationReadingNotes(pair.refs).length,1);
});

test('encrypted pilot DOCX export keeps the literal and separate reading note',async t=>{
 const {mkdtemp,rm,writeFile,mkdir}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');const path=await import('node:path');
 const {startServer}=await import('../server/main.mjs');
 const {emptyLocalReading}=await import('./helpers/local-reader.mjs');
 const {default:mammoth}=await import('mammoth');
 const dir=await mkdtemp(path.join(tmpdir(),'rejon-117-export-'));
 const note=questionPassage(null,selection),sent=[];
 const app=await startServer({dataDir:dir,intakePilot:true,autoInitialize:false,libraryPath:path.join(dir,'absent.sqlite'),pilotPassphrase:Buffer.from('frase sintética para probar'),
  intakeGenerate:async(_task,{research})=>{sent.push(research.prompt);return response(note);}});
 t.after(async()=>{await app.close();await rm(dir,{recursive:true,force:true});});
 t.mock.method(globalThis,'fetch',async(url,opts)=>{
  assert.equal(url,'http://127.0.0.1:11434/api/chat');const request=JSON.parse(opts.body);
  return Response.json({message:{content:JSON.stringify(emptyLocalReading(request.format.properties))}});
 });
 const call=(action,payload)=>app.service.dispatch('intake.'+action,payload);
 await call('save',{firm:'Despacho sintético',client:'Cliente sintético',title:'Referencia partida del Reglamento',jurisdiction:'MX-FED'});
 const review=await call('inspectQuestion',{text:'¿Qué documentos exige el artículo 117 del Reglamento de la Ley Aduanera?'});
 assert.ok(review.candidates.some(row=>row.key==='reg-aduana-117/0'));
 const {task}=await call('addQuestion',{reviewId:review.id,key:'reg-aduana-117/0',angle:'documentos'});
 await call('draft',{task});
 const file=await call('export',{task,format:'docx'}),buffer=Buffer.from(file.base64,'base64');
 const text=(await mammoth.extractRawText({buffer})).value;
 assert.ok(text.includes('artículo 36- A de la Ley.'));assert.ok(text.includes(note.ref.readingNotes[0].message));
 assert.ok(text.includes('Nota editorial de lectura'));
 assert.equal(sent.length,1);assert.equal(sent[0],note.prompt);
 assert.ok(sent.every(prompt=>!prompt.includes(note.ref.readingNotes[0].message)));
 if(process.env.REJON_117_EVIDENCE_DIR){await mkdir(process.env.REJON_117_EVIDENCE_DIR,{recursive:true});await writeFile(path.join(process.env.REJON_117_EVIDENCE_DIR,'117-export.docx'),buffer);}
});
