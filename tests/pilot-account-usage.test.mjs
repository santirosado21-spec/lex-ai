import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {selectPilotCredential} from '../server/providers/pilot-credentials.mjs';
import {openPilotUsage} from '../server/providers/pilot-usage.mjs';
import {createIntakeGenerator} from '../server/intake-pilot.mjs';

const keys={primary:'sk-'+'p'.repeat(35),lorenzo:'sk-'+'l'.repeat(35)};
const fail=(status,code)=>Response.json({error:{code,message:'remote diagnostics'}},{status});
const answer=()=>Response.json({model:'gpt-6-luna',usage:{prompt_tokens:9,completion_tokens:3},
 choices:[{finish_reason:'stop',message:{content:'Para [[CLIENTE]], [[ASUNTO]].'}}]});

function harness(serve,{mode='backup',read=slot=>keys[slot],record=()=>{}}={}){
 const calls=[],attempts=[];
 let account;
 const getApiKey=selectPilotCredential(mode,read,slot=>{account=slot;});
 const generate=createIntakeGenerator({getApiKey,
  fetchImpl:async(url,options)=>{
   assert.equal(url,'https://api.openai.com/v1/chat/completions');
   assert.equal(options.headers.Authorization,'Bearer '+await read(account));
   calls.push({account,body:options.body});return serve(calls.length);
  },
  onAttempt:async attempt=>{attempts.push({account,...attempt});await record(account,attempt);},
  usageStatus:()=>({}),
 });
 return {generate,calls,attempts};
}

test('a confirmed primary account refusal uses the identical authorized body and the shared physical budget',async()=>{
 for(const [status,code] of [[401,'invalid_api_key'],[429,'insufficient_quota']]){
  const h=harness(n=>n===1?fail(status,code):answer());
  assert.match(await h.generate('opening'),/CLIENTE/);
  assert.deepEqual(h.calls.map(c=>c.account),['primary','lorenzo']);
  assert.equal(h.calls[0].body,h.calls[1].body);
  assert.deepEqual(h.attempts.map(a=>a.outcome),['rejected','answered']);
  assert.equal(h.generate.usageStatus().remaining,1);
  await h.generate('documents');
  await assert.rejects(h.generate('opening'));
  assert.equal(h.calls.length,3);
 }
});

test('limit, denial, ambiguous outcome, malformed or mixed envelopes never trigger the backup',async()=>{
 for(const response of [
  ()=>fail(429,'rate_limit_exceeded'),()=>fail(403,'invalid_api_key'),()=>fail(500,'insufficient_quota'),
  ()=>fail(429,'other'),()=>new Response('{',{status:401}),
  ()=>Response.json({error:{code:'invalid_api_key'},choices:[]},{status:401}),
  ()=>fail(401,'other'),()=>Response.json({choices:[{finish_reason:'length'}]}),
  ()=>Response.json({bad:true}),()=>{throw Error('lost connection');},
 ]){
  const h=harness(response);
  await assert.rejects(h.generate('opening'));assert.deepEqual(h.calls.map(c=>c.account),['primary']);
  assert.equal(h.attempts.length,1);assert.equal(h.generate.usageStatus().remaining,2);
 }
});

test('backup is explicit and bounded to distinct keys, cancellation, availability and the shared cap',async()=>{
 for(const mode of ['alternate','primary','lorenzo']){
  const h=harness(()=>fail(401,'invalid_api_key'),{mode});
  await assert.rejects(h.generate('opening'));assert.equal(h.calls.length,1);
 }
 for(const read of [()=>keys.primary,slot=>{if(slot==='lorenzo')throw Error('locked');return keys.primary;} ]){
  const h=harness(()=>fail(401,'invalid_api_key'),{read});
  await assert.rejects(h.generate('opening'));assert.equal(h.calls.length,1);
  assert.equal(h.generate.usageStatus().remaining,2);
 }
 const noPrimary=harness(()=>fail(401,'invalid_api_key'),{read:slot=>{
  if(slot==='primary')throw Object.assign(Error(),{code:'credential_unavailable'});return keys.lorenzo;
 }});
 await assert.rejects(noPrimary.generate('opening'));assert.deepEqual(noPrimary.calls.map(c=>c.account),['lorenzo']);
 const aborted=new AbortController();
 const stop=harness(()=>fail(401,'invalid_api_key'),{record:()=>aborted.abort()});
 await assert.rejects(stop.generate('opening',{signal:aborted.signal}));assert.equal(stop.calls.length,1);
 const capped=harness(n=>n===3?fail(429,'insufficient_quota'):answer());
 await capped.generate('opening');await capped.generate('documents');
 await assert.rejects(capped.generate('opening'));assert.equal(capped.calls.length,3);
 const double=harness(()=>fail(429,'insufficient_quota'));await assert.rejects(double.generate('opening'));
 assert.equal(double.calls.length,2);
});

test('account records survive reopening with legacy, partial and malformed receipts and contain no content or keys',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'rejon-usage-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const file=path.join(dir,'uso-openai.jsonl');
 await writeFile(file,JSON.stringify({account:'primary',model:'legacy',usage:{promptTokens:11,completionTokens:null}})+'\ninvalid\n');
 const usage=await openPilotUsage(dir,'backup');
 const h=harness(n=>n===1?fail(429,'insufficient_quota'):answer(),{record:usage.record});
 await h.generate('opening');
 const saved=usage.status();
 assert.deepEqual(saved.accounts.primary,{attempts:2,input:11,output:0,unreported:2});
 assert.deepEqual(saved.accounts.lorenzo,{attempts:1,input:9,output:3,unreported:0});
 assert.deepEqual(saved.last,{account:'lorenzo',outcome:'answered',reason:null});assert.ok(saved.partial);
 assert.deepEqual((await openPilotUsage(dir,'backup')).status(),saved);
 const text=await readFile(file,'utf8');for(const privateText of [...Object.values(keys),'remote diagnostics','CLIENTE','ASUNTO'])assert.ok(!text.includes(privateText));
});
