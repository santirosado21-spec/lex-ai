import test from 'node:test';
import assert from 'node:assert/strict';
import {localReaderStatus,readerModel} from '../server/privacy/local-reader-status.mjs';
test('the pilot confirms the configured local reader without starting inference or disclosing inventory',async()=>{
 for(const [reply,state] of [
  [Response.json({models:[{name:'otro-modelo-local'},{name:readerModel}]}),'ready'],
  [Response.json({models:[{name:'otro-modelo-local'}]}),'missing'],
  [Response.json({models:[{}]}),'unknown'],[new Response('sin respuesta válida'),'unknown'],
  [new Response(' '.repeat(262145)),'unknown'],[null,'offline'],
 ]){
  const result=await localReaderStatus({fetchImpl:async(url,opts)=>{
   assert.equal(url,'http://127.0.0.1:11434/api/tags');assert.equal(opts.method,'GET');assert.equal(opts.redirect,'error');assert.equal(opts.body,undefined);
   if(!reply)throw Error();return reply;
  }});
  assert.deepEqual(result,{state});
 }
});
