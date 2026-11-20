import {startServer} from '../server/main.mjs';
import {createIntakeGenerator} from '../server/intake-pilot.mjs';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
if(!process.argv.includes('--openai'))throw Error('Usa --openai para autorizar hasta dos consultas reales con un ejercicio generado en este equipo.');
const out='artifacts/seguimiento-r11';
await mkdir(out,{recursive:true});
const dir=await mkdtemp(path.join(os.tmpdir(),'rejon-real-protegido-'));
const receipts=[],bodies=[];let preview='',privateValues=[];
const generate=createIntakeGenerator({onReceipt:r=>receipts.push(r),fetchImpl:async(url,opts)=>{
 assert.equal(url,'https://api.openai.com/v1/chat/completions');const body=JSON.parse(opts.body);
 assert.equal(body.messages[0].content,preview);assert.ok(!/\[\[(?:DATO|LEX)_/.test(opts.body));
 assert.ok(privateValues.every(word=>!opts.body.includes(word)));
 assert.ok(bodies.length<2);bodies.push(body.messages[0].content);
 return fetch(url,opts);
}});
const app=await startServer({dataDir:dir,intakePilot:true,intakeGenerate:generate,autoInitialize:false,pilotPassphrase:Buffer.from('frase local del ejercicio')});
try{
 const rpc=(action,p={})=>app.service.dispatch('intake.'+action,p);
 const intake=await rpc('createPractice');
 assert.ok(intake.reviewId);
 const meta=['Despacho Cúmulo de Ensayo',intake.client||'Cliente de Ensayo',intake.title||'Asunto de Ensayo'];
 const saved=await rpc('save',{firm:meta[0],client:meta[1],title:meta[2],jurisdiction:'MX-FED',reviewId:intake.reviewId});
 const source=await rpc('readDocument');
 privateValues=[...meta,...source.original.split('\n').slice(0,4).map(s=>s.slice(s.indexOf(': ')+2)),'RV-000381'];
 const parent=saved.tasks.find(t=>t.id==='case-note');assert.ok(parent?.preview,'El modelo dejó insuficiente contexto visible.');
 preview=parent.preview;
 const initial=await rpc('draft',{task:'case-note'});
 assert.ok(initial.followupParents.includes('case-note'),'El primer borrador no produjo una cita comprobable.');
 await rpc('edit',{task:'case-note',text:initial.drafts['case-note']+'\nObservación RV-000381.'});
 const added=await rpc('addFollowup',{task:'case-note',form:'control',instruction:'Revisa la ficha técnica de RV-000381.'});
 preview=added.status.tasks.find(t=>t.id===added.task).preview;
 assert.ok(preview.includes('Hechos del ejercicio con sustituciones locales'));
 await rpc('draft',{task:added.task});const final=(await rpc('preview',{task:added.task})).text;
 const supplier=source.original.split('\n')[2].slice('Proveedor: '.length);
 assert.ok(final.includes(supplier)&&!final.includes('RV-000381'));
 assert.ok(final.includes('ficha técnica')&&final.includes(parent.references[0].id));
 for(const ext of ['docx','xlsx','pptx']){
  const file=await rpc('export',{task:added.task,format:ext});await writeFile(path.join(out,'practica.'+ext),Buffer.from(file.base64,'base64'));
 }
 const result={receipts,source:parent.references[0].id,visibleProtectedFacts:preview.split('Hechos del ejercicio con sustituciones locales\n')[1],restoredSupplier:true,originalValuesChecked:privateValues.length};
 await writeFile(path.join(out,'practica.json'),JSON.stringify(result,null,2));console.log(result);
}finally{await app.close();await rm(dir,{recursive:true,force:true});}
