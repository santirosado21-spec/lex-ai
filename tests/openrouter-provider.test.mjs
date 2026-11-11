import test from 'node:test';
import assert from 'node:assert/strict';
import {createOpenRouterProvider} from '../server/providers/openrouter.mjs';
import {createEgressPolicy} from '../server/egress-policy.mjs';

const key='sk-or-v1-'+ 'a'.repeat(32);
const model='example/zero:free',endpoint='example/region';
const messages=[{role:'user',content:'Caso completamente ficticio'}];
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
const free=()=>json({data:[{id:model,pricing:{prompt:'0',completion:'0',request:'0'}}]});
const endpointList=()=>json({data:{endpoints:[{tag:endpoint,pricing:{prompt:'0',completion:'0',request:'0',image:'0'}}]}});
const answer=()=>json({model,choices:[{finish_reason:'stop',message:{role:'assistant',content:'Respuesta de prueba'}}],usage:{prompt_tokens:5,completion_tokens:4,cost:0}});
const mockRoute=url=>url.endsWith('/models')?free():url.endsWith('/endpoints')?endpointList():answer();
const collect=async iterable=>{const chunks=[];for await(const chunk of iterable)chunks.push(chunk);return chunks;};
const configured=(fetchImpl,extra={})=>createOpenRouterProvider({enabled:true,getApiKey:()=>key,model,endpoint,fetchImpl,...extra});
const code=(work,expected)=>assert.rejects(work,error=>error.name==='OpenRouterProviderError'&&error.code===expected&&!error.message.includes(key));

test('disabled by default: no catalog, key or completion call',async()=>{
 let keys=0,calls=0;
 const provider=createOpenRouterProvider({getApiKey:()=>{keys++;return key;},model,endpoint,fetchImpl:()=>{calls++;throw Error('network');}});
 await code(collect(provider.generate(messages)),'disabled');
 await code(provider.checkAccount(),'disabled');
 assert.equal(keys,0);assert.equal(calls,0);assert.equal(provider.status().state,'disabled');
});

test('account check uses supplied credential and returns no key',async()=>{
 const urls=[];
 const provider=configured((url,init)=>{urls.push({url,method:init.method,auth:init.headers.Authorization});return json({data:{is_free_tier:true,limit:0,limit_remaining:0}});});
 const account=await provider.checkAccount();
 assert.deepEqual(account,{connected:true,isFreeTier:true,hasSpendingLimit:true,limitRemaining:0});
 assert.equal(provider.status().accountConnected,true);
 assert.deepEqual(urls,[{url:'https://openrouter.ai/api/v1/key',method:'GET',auth:`Bearer ${key}`}]);
 assert.doesNotMatch(JSON.stringify(account)+JSON.stringify(provider.status()),/sk-or-v1-/);
});

test('free-only request pins model and provider, disables fallbacks/tools and bounds prices',async()=>{
 const calls=[];
 const provider=configured((url,init)=>{calls.push({url,init});return Promise.resolve(mockRoute(url));});
 assert.deepEqual(await collect(provider.generate(messages)),['Respuesta de prueba']);
 assert.equal(calls.length,3);assert.equal(calls[0].url,'https://openrouter.ai/api/v1/models');
 assert.equal(calls[1].url,'https://openrouter.ai/api/v1/models/example/zero:free/endpoints');
 assert.equal(calls[2].url,'https://openrouter.ai/api/v1/chat/completions');
 const body=JSON.parse(calls[2].init.body);
 assert.deepEqual(body.messages,messages);assert.equal(body.model,model);assert.equal(body.stream,false);
 assert.deepEqual(body.provider,{only:[endpoint],allow_fallbacks:false,zdr:true,data_collection:'deny',require_parameters:true,max_price:{prompt:0,completion:0,request:0,image:0}});
 assert.equal(body.tools,undefined);assert.equal(body.models,undefined);assert.equal(calls[2].init.redirect,'error');
 assert.deepEqual(provider.lastReceipt,{requestedModel:model,observedModel:model,endpointRequested:endpoint,observedProvider:null,usage:{promptTokens:5,completionTokens:4}});
});

test('price drift and malformed account key block before completion',async()=>{
 for(const pricing of [{prompt:'0.00001',completion:'0'},{prompt:'0',completion:'0',request:'0.01'},{prompt:'NaN',completion:'0'},{prompt:'',completion:' '},{prompt:'0x0',completion:'0'}]){
  let posts=0;
  const provider=configured((url)=>{if(url.endsWith('/models'))return json({data:[{id:model,pricing}]});posts++;return mockRoute(url);});
  await code(collect(provider.generate(messages)),'not_free');assert.equal(posts,0);
 }
 let posts=0;
 const missing=createOpenRouterProvider({enabled:true,getApiKey:()=>'',model,endpoint,fetchImpl:url=>{if(url.endsWith('/models'))return free();posts++;return mockRoute(url);}});
 await code(collect(missing.generate(messages)),'missing_credential');assert.equal(posts,0);
 const paidEndpoint=configured(url=>url.endsWith('/models')?free():url.endsWith('/endpoints')?json({data:{endpoints:[{tag:endpoint,pricing:{prompt:'0',completion:'0',request:'0.1'}}]}}):answer());
 await code(collect(paidEndpoint.generate(messages)),'not_free');
});

test('sent body is a preflight snapshot even if caller mutates during catalog lookup',async()=>{
 const mutable=[{role:'user',content:'Ficción inicial'}];let sent;
 const provider=configured((url,init)=>{
  if(url.endsWith('/models')){mutable[0].content='CANARY_PRIVATE_CHANGED';mutable[0].metadata={hidden:'CANARY'};return free();}
  if(url.endsWith('/endpoints'))return endpointList();sent=JSON.parse(init.body);return answer();
 });
 await collect(provider.generate(mutable));
 assert.deepEqual(sent.messages,[{role:'user',content:'Ficción inicial'}]);
 const accessor={role:'user'};Object.defineProperty(accessor,'content',{enumerable:true,get(){throw Error('CANARY_GETTER');}});
 let calls=0;const p=configured(()=>{calls++;return free();});
 await code(collect(p.generate([accessor])),'invalid_request');assert.equal(calls,0);
});

test('input, quota, failed response and cancellation do not fall back or leak remote text',async()=>{
 const bad=configured(()=>{throw Error('CANARY_RAW_NETWORK');});
 await code(collect(bad.generate(messages)),'network');
 const provider=configured(url=>url.endsWith('/models')?free():url.endsWith('/endpoints')?endpointList():json({error:{message:'CANARY_PRIVATE'}},429));
 await code(collect(provider.generate(messages)),'quota');assert.equal(provider.lastReceipt,null);
 for(const input of [[{role:'user',content:'x',metadata:{secret:'CANARY'}}],[{role:'tool',content:'x'}],[{role:'user',content:'x',tools:[]}]]){
  let calls=0;const p=configured(()=>{calls++;return free();});await code(collect(p.generate(input)),'invalid_request');assert.equal(calls,0);
 }
 const controller=new AbortController();controller.abort();
 let calls=0;const cancelled=configured(()=>{calls++;return free();});
 await code(collect(cancelled.generate(messages,{signal:controller.signal})),'cancelled');assert.equal(calls,0);
});

test('unexpected model, tools, truncated answer and timeout fail closed',async()=>{
 const invalid=[
  {model:'example/paid',choices:[{finish_reason:'stop',message:{content:'x'}}]},
  {model,choices:[{finish_reason:'stop',message:{content:'x',tool_calls:[]}}]},
  {model,choices:[{finish_reason:'length',message:{content:'partial'}}]}
 ];
 for(const response of invalid){const provider=configured(url=>url.endsWith('/models')?free():url.endsWith('/endpoints')?endpointList():json(response));
  await code(collect(provider.generate(messages)),'invalid_response');assert.equal(provider.lastReceipt,null);}
 const timeout=configured((_url,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true})),{timeoutMs:100});
 const hold=setTimeout(()=>{},150);try{await code(collect(timeout.generate(messages)),'timeout');}finally{clearTimeout(hold);}
 const raw=configured(()=>null);await code(raw.checkAccount(),'account_unavailable');
 const cost=configured(url=>url.endsWith('/models')?free():url.endsWith('/endpoints')?endpointList():json({model,choices:[{finish_reason:'stop',message:{content:'x'}}],usage:{cost:0.01}}));
 await code(collect(cost.generate(messages)),'unexpected_charge');
 const partial=configured(mockRoute);const iterator=partial.generate(messages);
 assert.equal((await iterator.next()).value,'Respuesta de prueba');
 assert.equal(partial.status().busy,false);
 assert.deepEqual(await collect(partial.generate(messages)),['Respuesta de prueba']);
});

test('H2 grant allows only complete synthetic scope; denied scopes never hit OpenRouter transport',async()=>{
 let posts=0;
 const provider=configured(url=>{if(url.endsWith('/models'))return free();if(url.endsWith('/endpoints'))return endpointList();posts++;return answer();});
 const scope={workspaceId:'FIRM_A',matterId:'MATTER_A',threadId:'THREAD_A'};
 const gate=createEgressPolicy({destinations:{openrouter:provider},getPolicy:()=>({version:'v1',grants:[{scope,destination:'openrouter',allowedCategories:['synthetic']}]}),
  classify:input=>({serialized:input.serialized,scope:input.scope,destination:input.destination,policyVersion:input.policyVersion,reliable:true,scopeVerified:true,category:'synthetic'})});
 const options={scope,destination:'openrouter',responseFormat:'text'};
 assert.deepEqual(await collect(gate.generate(messages,options)),['Respuesta de prueba']);assert.equal(posts,1);
 await assert.rejects(collect(gate.generate(messages,{...options,scope:{...scope,matterId:'MATTER_B'}})),error=>error.name==='EgressPolicyError'&&error.code==='scope_denied');
 assert.equal(posts,1);
});
