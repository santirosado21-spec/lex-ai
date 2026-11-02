import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';import assert from 'node:assert/strict';
import {createInference} from '../server/inference.mjs';
import {createService} from '../server/service.mjs';
import {openPublicLibrary} from '../server/public-library.mjs';
import {prepareCases,runEvaluation} from './evaluate-lightweight-skills.mjs';
const out=path.resolve('artifacts/lightweight');await mkdir(out,{recursive:true});
const id=new Date().toISOString().replace(/[:.]/g,'-');const report={startedAt:new Date().toISOString(),data:'synthetic-only',targetRAMGB:8,physical8GBValidation:false};
const modelCatalog=JSON.parse(await readFile(process.env.LEX_EVAL_CATALOG||'resources/model-catalog.json','utf8'));
let pid,endpoint,service,library;
const inference=createInference({dataDir:path.join(out,'runtime'),runtimePath:process.env.LEX_RUNTIME_BINARY||'/Applications/Ollama.app/Contents/Resources/ollama',modelCatalog,modelsDir:process.env.LEX_EVAL_MODELS_DIR,dependencies:{spawn:(bin,args,options)=>{const child=spawn(bin,args,options);pid=child.pid;endpoint='http://'+options.env.OLLAMA_HOST;return child;}}});
try{
 await inference.initialize();const deadline=Date.now()+600000;let previous='';
 while(true){const state=await inference.status();if(state.state==='error')throw Error(state.message);if(state.state==='ready'){report.engine=state;break;}if(Date.now()>deadline)throw Error('Initialization deadline exceeded');const message=`${state.state} ${Math.floor((state.progress||0)/10)*10}%`;if(message!==previous){console.log(message);previous=message;}await new Promise(r=>setTimeout(r,1000));}
 console.log('Pinned lightweight download verified; beginning sequential A/B.');
 const bundle=await prepareCases({suite:process.env.LEX_EVAL_SUITE||'default'});
 const caseLimit=Number(process.env.LEX_EVAL_CASES||bundle.cases.length);
 const ab=await runEvaluation({endpoint,model:modelCatalog.id,runtimePid:pid,bundle,caseLimit,output:path.join(out,`skills-ab-${id}.json`)});
 report.ab={status:ab.status,summary:ab.summary,memory:ab.memory,file:`skills-ab-${id}.json`};
 console.log(JSON.stringify(report.ab));
 library=await openPublicLibrary(path.resolve('resources/public-library.sqlite'));
 service=await createService({dataDir:path.join(out,`synthetic-${id}`),corpusPath:path.resolve('resources/legal-corpus.json'),inference,publicLibrary:library});
 await service.dispatch('workspace.create',{name:'Despacho sintético de evaluación ligera',practiceAreas:['Civil']});
 const matter=await service.dispatch('matter.create',{title:'Escrito sintético',client:'Parte ficticia',jurisdiction:'MX-FED'});
 const answer=await service.analyze({matterId:matter.id,skillId:'legal-researcher',question:'Explica brevemente el artículo 1797 del Código Civil Federal según el pasaje disponible.'});
 assert.ok(answer.validation.citationIntegrity);assert.ok(answer.citations.some(c=>c.url));
 const exported=await service.dispatch('answer.export',{matterId:matter.id,answerId:answer.id});
 const bytes=Buffer.from(exported.base64,'base64');assert.equal(bytes.subarray(0,2).toString(),'PK');await writeFile(path.join(out,'synthetic-lightweight-written-submission.docx'),bytes);
 report.e2e={status:'PASS',withoutDocumentImport:true,answer:answer.text,citations:answer.citations.map(c=>({id:c.id,title:c.title,article:c.article,quote:c.quote})),elapsedMs:answer.elapsedMs,exportBytes:bytes.length};
 report.status=ab.status==='TECHNICAL_PASS'?'PASS':'E2E_PASS_AB_INCOMPLETE';
}catch(error){report.status='FAIL';report.error=error.message;process.exitCode=1;}
finally{await inference.stop();service?.close();library?.close();report.finishedAt=new Date().toISOString();await writeFile(path.join(out,`runtime-verification-${id}.json`),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
