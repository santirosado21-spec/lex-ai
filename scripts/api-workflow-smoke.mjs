/** Full product workflow through the REAL HTTP server with explicitly mocked
 * inference: workspace -> matter -> document.import -> /analyze (NDJSON) ->
 * answer.export (DOCX) -> feedback -> proposal lifecycle (create/evaluate/
 * approve/rollback). Closes the gap between service-level unit tests and the
 * Mac-only real-inference e2e (scripts/e2e.mjs): route registration, auth,
 * payload serialization and dispatch for these actions are exercised here.
 * Synthetic data only; never evidence of model quality. */
import { startServer } from '../server/main.mjs';
import { buildPublicLibrary } from '../server/public-library.mjs';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const dataDir=await mkdtemp(path.join(os.tmpdir(),'lex-api-workflow-'));
const digest=value=>createHash('sha256').update(value).digest('hex');

// Synthetic public library fixture (same shape as scripts/ui-smoke.mjs).
const pdfHash='c'.repeat(64);
const libraryRows=Array.from({length:12},(_,index)=>{const lawId=index<11?'MX-FED-SYNTHETIC':'MX-FED-SECOND';const versionId=lawId+'@2026-10-30+'+pdfHash.slice(0,16);const text=`Artículo ${index+1}.- Disposición sintética para pruebas del flujo de trabajo por HTTP. `+(index===11?'Contenido sintético extenso. '.repeat(500)+'FINAL_ARTICULO_COMPLETO_SINTETICO':'La revisión sintética no acredita vigencia ni aplicabilidad jurídica.');return {id:versionId+':art:'+(index+1),lawId,lawTitle:index<11?'Instrumento sintético A':'Instrumento sintético B',versionId,articleId:String(index+1),text,textSha256:digest(text),pdfSha256:pdfHash,sourceUrl:'https://www.diputados.gob.mx/LeyesBiblio/pdf/Synthetic.pdf',sourcePages:[1,2],jurisdiction:'MX-FED',publisher:'Cámara de Diputados',retrievedAt:'2026-10-30T00:00:00Z',quality:{status:'structurally-verified',currentness:'unverified'},effectiveAt:null,split:'train',splitGroup:lawId};});
const libraryFixture=path.join(dataDir,'library-fixture');await mkdir(libraryFixture,{recursive:true});
const libraryCorpus=libraryRows.map(row=>JSON.stringify(row)).join('\n')+'\n';
await writeFile(path.join(libraryFixture,'corpus.jsonl'),libraryCorpus);
await writeFile(path.join(libraryFixture,'sha256.json'),JSON.stringify({'corpus.jsonl':digest(libraryCorpus)}));
await writeFile(path.join(libraryFixture,'independent-extraction-audit.json'),JSON.stringify({corpusSha256:digest(libraryCorpus),checked:12,passed:12,method:'synthetic API fixture only'}));
const libraryPath=path.join(libraryFixture,'public.sqlite');
await buildPublicLibrary({inputDir:libraryFixture,outputFile:libraryPath});

const inference={
 async status(){return {state:'ready',model:'TEST DOUBLE — no real inference',supported:true,hardware:{platform:'linux',arch:'x64',memoryGB:8}};},
 async initialize(){return this.status();},
 async stop(){return {state:'stopped'};},
 async *generate(messages){
  const {sources}=JSON.parse(messages.at(-1).content);
  const document=sources.find(s=>s.category==='internal-firm-document');
  const legal=sources.find(s=>['legislation-snapshot','official-public-legislation'].includes(s.category));
  assert.ok(document&&legal,'test requires retrieved document and official legal source');
  yield JSON.stringify({analysis:`La cláusula sintética de modificación unilateral del precio y la fecha debe contrastarse con el contrato aportado [${document.id}] y con la fuente oficial recuperada [${legal.id}]; su vigencia y aplicación requieren revisión profesional.`,citations:[document,legal].map(s=>({sourceId:s.id,quote:s.text.slice(0,100)}))});
 }
};

const app=await startServer({dataDir,inference,monitorDir:path.join(dataDir,'monitor'),libraryPath});
const report={mode:'Full product workflow over real HTTP server, explicitly mocked inference',syntheticData:true,checks:[],startedAt:new Date().toISOString()};
await mkdir('artifacts',{recursive:true});
try{
 const api=async(action,payload={})=>{const response=await fetch(app.connection.url+'/api',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${app.connection.token}`},body:JSON.stringify({action,payload})});assert.equal(response.status,200,`${action} HTTP ${response.status}`);return response.json();};

 const unauthorized=await fetch(app.connection.url+'/api',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer wrong'},body:JSON.stringify({action:'engine.status',payload:{}})});
 assert.equal(unauthorized.status,401,'wrong bearer must be rejected');
 report.checks.push('HTTP auth boundary rejects wrong bearer token');

 await api('workspace.create',{name:'Despacho sintético workflow',practiceAreas:['Civil','Comercial']});
 const matter=await api('matter.create',{title:'Revisión sintética workflow',client:'Cliente de prueba',jurisdiction:'MX-CMX'});
 const bytes=await readFile('fixtures/contrato-servicios.txt');
 await api('document.import',{matterId:matter.id,name:'contrato-workflow.txt',base64:bytes.toString('base64')});
 report.checks.push('workspace/matter/document.import over HTTP');

 const analyzeResponse=await fetch(app.connection.url+'/analyze',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${app.connection.token}`},body:JSON.stringify({matterId:matter.id,skillId:'contract-reviewer',question:'Analiza la cláusula que permite modificar unilateralmente el precio y la fecha. ¿Qué riesgo contractual identificas? Cita un pasaje del contrato y uno de la ley aportada.'})});
 assert.equal(analyzeResponse.status,200,'/analyze HTTP status');
 const frames=(await analyzeResponse.text()).trim().split('\n').map(line=>JSON.parse(line));
 const result=frames.find(frame=>frame.type==='result')?.data;
 assert.ok(result,'/analyze NDJSON carries a result frame');
 assert.ok(result.validation.citationIntegrity,'citation integrity over HTTP');
 assert.ok(result.citations.some(c=>c.url),'official source citation with URL');
 assert.ok(result.text.length>100,'grounded analysis text');
 report.checks.push('/analyze NDJSON stream: result frame, citation integrity, official source');

 const exported=await api('answer.export',{matterId:matter.id,answerId:result.id});
 const docx=Buffer.from(exported.base64,'base64');
 assert.equal(docx.subarray(0,2).toString(),'PK','DOCX signature');
 report.checks.push('answer.export produces a valid DOCX over HTTP');

 const feedback=await api('feedback.create',{matterId:matter.id,answerId:result.id,rating:'corrected',comment:'Revisar expresamente la aceptación bilateral de modificaciones en este flujo sintético.'});
 const proposal=await api('proposal.create',{feedbackId:feedback.id});
 const evaluated=await api('proposal.evaluate',{proposalId:proposal.id});
 assert.equal(evaluated.evaluation.passed,true,'structural evaluation passes');
 await api('proposal.approve',{proposalId:proposal.id,reviewConfirmed:true});
 await api('proposal.rollback',{proposalId:proposal.id});
 report.checks.push('feedback + proposal lifecycle (create/evaluate/approve/rollback) over HTTP');

 report.status='PASS';
}catch(e){report.status='FAIL';report.error=e.message;process.exitCode=1;}
finally{await app.close();report.finishedAt=new Date().toISOString();await writeFile('artifacts/api-workflow-smoke.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
