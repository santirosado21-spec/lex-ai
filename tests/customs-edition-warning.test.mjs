import test from 'node:test';
import assert from 'node:assert/strict';
import {customsPassage} from '../server/corpus/customs-edition.mjs';
import {questionPassage,renderResearchNote} from '../server/corpus/intake-research.mjs';
import {loadTradeReading,renderTradeReading,tradeReadingEnvelope} from '../server/corpus/intake-trade-reading.mjs';
import {prepareFollowup,quotedRanges,renderFollowup,followupEnvelope} from '../server/corpus/intake-followup.mjs';
const warning=customsPassage('65').ref.summary;
const reply=note=>JSON.stringify({cita:note.body.slice(0,90),solicitud:'¿Qué documento acredita los gastos de transporte?'});
test('research notes keep the source edition warning rather than only a generic currentness disclaimer',()=>{
 const note=questionPassage(null,{sourceId:'aduana-65',part:1,angle:'documentos'});
 assert.ok(renderResearchNote(reply(note),note).includes(warning));
 assert.ok(renderResearchNote('{"abstener":true}',note).includes(warning));
 const pair=questionPassage(null,{sourceId:'aduana-64',part:2,angle:'documentos',second:{sourceId:'aduana-65',part:1}});
 const raw=JSON.stringify({cita:pair.sources[0].body.slice(0,90),segundaCita:pair.sources[1].body.slice(0,90),lectura:'El precio y los gastos de transporte requieren cotejar los documentos de la operación.',solicitud:'¿Qué comprobantes permiten revisar estos conceptos?'});
 assert.equal(renderResearchNote(raw,pair).split(warning).length-1,1);
 assert.ok(renderResearchNote(raw,pair).includes(pair.sources[1].condition));
});
test('trade readings and local follow-up rendering retain one source warning without changing provider envelopes',()=>{
 const reading=loadTradeReading(null,'lectura-valoracion');
 const envelope=JSON.stringify(tradeReadingEnvelope(reading));
 const text=renderTradeReading(JSON.stringify({A:{pasaje:'A1'},B:{pasaje:'B2'}}),reading);
 assert.equal(text.split(warning).length-1,1);
 assert.equal(JSON.stringify(tradeReadingEnvelope(reading)),envelope);
 const note=questionPassage(null,{sourceId:'aduana-65',part:1,angle:'documentos'});
 const text2=renderResearchNote(reply(note),note),ranges=quotedRanges(note,text2);
 assert.ok(ranges.length);
 const follow=prepareFollowup(note,ranges,'control');
 const before=JSON.stringify(followupEnvelope(follow));
 const output=renderFollowup(JSON.stringify({acciones:['Cotejar la factura con el comprobante del transporte.','Verificar la parte que cubrió los gastos del trayecto.']}),follow);
 assert.equal(output.split(warning).length-1,1);
 assert.equal(JSON.stringify(followupEnvelope(follow)),before);
});

test('actual encrypted pilot export retains both edition warning and its source table',async t=>{
 const {mkdtemp,rm,writeFile,mkdir}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');const path=await import('node:path');
 const {startServer}=await import('../server/main.mjs');
 const {emptyLocalReading}=await import('./helpers/local-reader.mjs');
 const {default:mammoth}=await import('mammoth');
 const dir=await mkdtemp(path.join(tmpdir(),'rejon-edition-export-'));
 const app=await startServer({dataDir:dir,intakePilot:true,autoInitialize:false,libraryPath:path.join(dir,'absent.sqlite'),pilotPassphrase:Buffer.from('frase sintética para probar'),
  intakeGenerate:async()=>JSON.stringify({cita:customsPassage('65').passages[1].quote.slice(0,90),solicitud:'¿Qué documento acredita los gastos de transporte?'})});
 t.after(async()=>{await app.close();await rm(dir,{recursive:true,force:true});});
 t.mock.method(globalThis,'fetch',async(url,opts)=>{
  assert.equal(url,'http://127.0.0.1:11434/api/chat');const request=JSON.parse(opts.body);
  return Response.json({message:{content:JSON.stringify(emptyLocalReading(request.format.properties))}});
 });
 const call=(action,payload)=>app.service.dispatch('intake.'+action,payload);
 await call('save',{firm:'Despacho sintético',client:'Cliente sintético',title:'Expediente de práctica',jurisdiction:'MX-FED'});
 const review=await call('inspectQuestion',{text:'¿Qué documentos acreditan el flete según el artículo 65 de la Ley Aduanera?'});
 assert.ok(review.candidates.some(row=>row.key==='aduana-65/1'));
 const {task}=await call('addQuestion',{reviewId:review.id,key:'aduana-65/1',angle:'documentos'});
 await call('draft',{task});
 const file=await call('export',{task,format:'docx'}),buffer=Buffer.from(file.base64,'base64');
 const text=(await mammoth.extractRawText({buffer})).value;
 assert.ok(text.includes(warning));assert.ok(text.includes('Fuentes recuperadas'));
 assert.ok(text.includes('Ley Aduanera'));assert.ok(text.includes('65'));
 assert.ok(!text.includes('No se recuperaron fuentes para este borrador.'));
 if(process.env.REJON_EDITION_EVIDENCE_DIR){
  await mkdir(process.env.REJON_EDITION_EVIDENCE_DIR,{recursive:true});
  await writeFile(path.join(process.env.REJON_EDITION_EVIDENCE_DIR,'pilot-export.docx'),buffer);
 }
});
