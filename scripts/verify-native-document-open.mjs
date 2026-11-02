// Explicit manual integration check; excluded from the automated test suite.
import assert from 'node:assert/strict';
import {mkdir,writeFile,mkdtemp,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createService} from '../server/service.mjs';
import {createStore} from '../server/store.mjs';
import {createLocalFileOpener} from '../server/local-files.mjs';
if(process.platform!=='darwin'||!process.argv.includes('--open-synthetic-documents'))throw Error('Manual macOS check requires --open-synthetic-documents');
const out=path.resolve('artifacts/native-document-open');await mkdir(out,{recursive:true});
const dataDir=await mkdtemp(path.join(out,'synthetic-'));
const corpusPath=path.join(dataDir,'corpus.json');await writeFile(corpusPath,'[]');
const report={at:new Date().toISOString(),data:'synthetic only',dataDir,visualVerification:false,scope:'Real service dispatch and macOS LaunchServices acceptance; does not assert editor rendering'};
let service;
try{
 service=await createService({dataDir,corpusPath,openFile:createLocalFileOpener({dataDir})});
 await service.dispatch('workspace.create',{name:'PRUEBA SINTÉTICA — LEX AI',practiceAreas:['Civil']});
 const matter=await service.dispatch('matter.create',{title:'Prueba de apertura',client:'Persona ficticia',jurisdiction:'MX-FED'});
 const text='PRUEBA SINTÉTICA DE SOFTWARE. El equipo conservará una copia escrita del informe en su carpeta. No es un escrito para presentar ante una autoridad.';
 const document=await service.dispatch('document.import',{matterId:matter.id,name:'Prueba sintetica LEX AI.txt',base64:Buffer.from(text).toString('base64')});
 report.original=await service.dispatch('document.open',{matterId:matter.id,documentId:document.id});
 const store=createStore(dataDir),answer={id:randomUUID(),matterId:matter.id,question:'PRUEBA SINTÉTICA: apertura del escrito',text:'El equipo conservará una copia escrita del informe en su carpeta. [D1]',citations:[{id:'D1',title:'Documento sintético',quote:'El equipo conservará una copia escrita del informe en su carpeta.',category:'internal-firm-document',status:'synthetic-test-only'}],createdAt:new Date().toISOString()};
 store.put('answer',answer);store.close();
 report.written=await service.dispatch('answer.open',{matterId:matter.id,answerId:answer.id});
 assert.equal(report.original.opened,true);assert.equal(report.written.opened,true);
 const opened=path.join(dataDir,'opened-documents');report.files=[];
 for(const folder of await readdir(opened))for(const name of await readdir(path.join(opened,folder))){const file=path.join(opened,folder,name),info=await stat(file);assert.equal(info.mode&0o777,0o600);report.files.push({file,bytes:info.size,mode:'0600'});}
 assert.equal(report.files.length,2);report.status='OS_LAUNCH_ACCEPTED';
}catch(error){report.status='FAIL';report.error=error.message;process.exitCode=1;}
finally{service?.close();await writeFile(path.join(dataDir,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
