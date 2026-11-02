import {mkdtemp,readFile,writeFile,mkdir} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
import {createInference} from '../server/inference.mjs';import {createService} from '../server/service.mjs';
const dataDir=await mkdtemp(path.join(os.tmpdir(),'lex-real-e2e-'));
const inference=createInference({dataDir,runtimePath:process.env.LEX_OLLAMA_BIN||'/Applications/Ollama.app/Contents/Resources/ollama',modelsDir:process.env.LEX_MODELS_DIR||path.join(os.homedir(),'.ollama/models')});
let syntheticRaw='';
const traced={outputContract:inference.outputContract,async *generate(messages,options){for await(const chunk of inference.generate(messages,options)){syntheticRaw+=chunk;yield chunk;}}};
const service=await createService({dataDir,corpusPath:path.resolve('resources/legal-corpus.json'),inference:traced});
const report={startedAt:new Date().toISOString(),mode:'real-local-inference',data:'synthetic-only',checks:[]};
try{
 await inference.initialize();let status;const deadline=Date.now()+240_000;
 do{status=await inference.status();if(status.state==='error')throw Error(status.message);if(Date.now()>deadline)throw Error('Initialization timeout');if(status.state!=='ready')await new Promise(r=>setTimeout(r,1000));}while(status.state!=='ready');
 report.engine=status;report.checks.push('pinned model manifest and all blobs SHA256 verified');console.log('Local model ready; creating synthetic workspace.');
 await service.dispatch('workspace.create',{name:'Despacho Sintético de Pruebas',practiceAreas:['Civil','Comercial']});
 const matter=await service.dispatch('matter.create',{title:'Revisión de servicios sintéticos',client:'Cliente de prueba',jurisdiction:'MX-CMX'});
 const bytes=await readFile('fixtures/contrato-servicios.txt');await service.dispatch('document.import',{matterId:matter.id,name:'contrato.txt',base64:bytes.toString('base64')});
 const answer=await service.analyze({matterId:matter.id,skillId:'contract-reviewer',question:'Analiza la cláusula que permite modificar unilateralmente el precio y la fecha. ¿Qué riesgo contractual identificas a partir del artículo 1797? Cita un pasaje del contrato y uno de la ley aportada.'});
 assert.ok(answer.validation.citationIntegrity);assert.ok(answer.citations.some(c=>c.url));assert.ok(answer.text.length>100);
 report.answer={id:answer.id,elapsedMs:answer.elapsedMs,citations:answer.citations.map(c=>({id:c.id,category:c.category})),validation:answer.validation};report.checks.push('Gemma generated grounded analysis with retrieved official sources');
 const exported=await service.dispatch('answer.export',{matterId:matter.id,answerId:answer.id});const docx=Buffer.from(exported.base64,'base64');assert.equal(docx.subarray(0,2).toString(),'PK');await mkdir('artifacts',{recursive:true});await writeFile('artifacts/synthetic-analysis.docx',docx);report.checks.push('DOCX exported');
 const feedback=await service.dispatch('feedback.create',{matterId:matter.id,answerId:answer.id,rating:'corrected',comment:'Revisar expresamente la aceptación bilateral de modificaciones en este asunto sintético.'});
 const proposal=await service.dispatch('proposal.create',{feedbackId:feedback.id});const evaluated=await service.dispatch('proposal.evaluate',{proposalId:proposal.id});assert.equal(evaluated.evaluation.passed,true);
 await service.dispatch('proposal.approve',{proposalId:proposal.id,reviewConfirmed:true});await service.dispatch('proposal.rollback',{proposalId:proposal.id});report.checks.push('feedback, structural evaluation, explicit synthetic approval and rollback');report.status='PASS';
}catch(e){report.status='FAIL';report.error=e.message;await mkdir('artifacts',{recursive:true});await writeFile('artifacts/synthetic-failed-output.txt',syntheticRaw);process.exitCode=1;}finally{await inference.stop();service.close();report.finishedAt=new Date().toISOString();await mkdir('artifacts',{recursive:true});await writeFile('artifacts/real-e2e.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
