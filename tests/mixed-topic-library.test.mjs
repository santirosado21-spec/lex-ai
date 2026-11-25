import test from 'node:test';
import assert from 'node:assert/strict';
import {questionCandidates} from '../server/corpus/intake-question.mjs';
import {loadTradeReading,tradeReadingNeedsLibrary} from '../server/corpus/intake-trade-reading.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {startServer} from '../server/main.mjs';
import {emptyLocalReading} from './helpers/local-reader.mjs';

const question='¿Qué documentos debo revisar sobre el flete y el origen de la mercancía importada?';
test('missing optional public index does not discard independently pinned customs candidates for a mixed topic',()=>{
 assert.equal(tradeReadingNeedsLibrary('lectura-valoracion'),false);
 assert.equal(tradeReadingNeedsLibrary('lectura-pedimento'),false);
 assert.equal(tradeReadingNeedsLibrary('lectura-origen'),true);
 assert.throws(()=>tradeReadingNeedsLibrary('inventado'));
 const rows=questionCandidates(null,question,[{text:question}]);
 assert.ok(rows.some(row=>row.source==='aduana-65'));
 assert.ok(rows.every(row=>row.source.startsWith('aduana-')));
 assert.deepEqual(questionCandidates(null,'¿Cómo revisar los cupos?', [{text:'¿Cómo revisar los cupos?'}]),[]);
 assert.deepEqual(questionCandidates(null,'Artículo 9 de la Ley de Comercio Exterior',[],{lawId:'MX-FED-LCE',articleId:'9',jurisdiction:'MX-FED'}),[]);
 assert.deepEqual(questionCandidates(null,'Artículo 999 de la Ley Aduanera',[],{lawId:'MX-FED-LADUA',articleId:'999',jurisdiction:'MX-FED'}),[]);
 assert.throws(()=>loadTradeReading(null,'lectura-origen'));
});
test('present but unverified or broken readers are not treated as an absent index',()=>{
 const broken={lookupArticle(){throw Error('Invalid source sentinel');}};
 assert.throws(()=>questionCandidates(broken,'¿Cómo revisar cupos?', [{text:'cupos'}]),/Invalid source sentinel/);
 const fake={lookupArticle(){return {sourceId:'PUB-'+'a'.repeat(64)};}};
 assert.throws(()=>questionCandidates(fake,'¿Cómo revisar cupos?', [{text:'cupos'}]),/edición verificada/);
});
test('actual pilot can prepare the verified customs part of a mixed question without a general index or cloud calls',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'rejon-mixed-topic-'));let cloudCalls=0;
 const app=await startServer({dataDir:dir,intakePilot:true,autoInitialize:false,libraryPath:path.join(dir,'absent.sqlite'),pilotPassphrase:Buffer.from('frase sintética de prueba'),intakeGenerate:async()=>{cloudCalls++;throw Error('Unexpected generation');}});
 t.after(async()=>{await app.close();await rm(dir,{recursive:true,force:true});});
 const call=(action,payload)=>app.service.dispatch('intake.'+action,payload);
 t.mock.method(globalThis,'fetch',async(url,opts)=>{
  assert.equal(url,'http://127.0.0.1:11434/api/chat');const request=JSON.parse(opts.body);
  return Response.json({message:{content:JSON.stringify(emptyLocalReading(request.format.properties))}});
 });
 await call('save',{firm:'Despacho sintético',client:'Cliente sintético',title:'Asunto de práctica',jurisdiction:'MX-FED'});
 const review=await call('inspectQuestion',{text:question});
 const choice=review.candidates.find(row=>row.key.startsWith('aduana-65/'));assert.ok(choice);
 const {task,status}=await call('addQuestion',{reviewId:review.id,key:choice.key,angle:'documentos'});
 assert.ok(status.tasks.find(row=>row.id===task).preview.includes('Ley Aduanera'));
 assert.equal(cloudCalls,0);
});
