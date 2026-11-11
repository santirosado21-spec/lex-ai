// H6a: isolated, opt-in OpenRouter transport for public/synthetic development.
// No production import. A trusted local egress gate must authorize the whole
// prepared envelope before this provider is ever enabled by an application.
const ORIGIN='https://openrouter.ai';
const MODELS_URL=`${ORIGIN}/api/v1/models`;
const KEY_URL=`${ORIGIN}/api/v1/key`;
const CHAT_URL=`${ORIGIN}/api/v1/chat/completions`;
const error=code=>Object.assign(new Error('OpenRouter no está disponible para esta solicitud.'),{name:'OpenRouterProviderError',code});
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const keysOnly=(value,keys)=>record(value)&&Object.keys(value).every(key=>keys.includes(key));
const validModel=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*:free$/.test(value);
const validEndpoint=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9._/-]{0,99}$/.test(value)&&!value.includes('..');
const validKey=value=>typeof value==='string'&&/^sk-or-v1-[A-Za-z0-9_-]{20,}$/.test(value);
function snapshotMessages(messages){
 if(!Array.isArray(messages)||messages.length<1||messages.length>16)throw error('invalid_request');
 let total=0;const snapshot=[];
 for(const message of messages){
  if(!keysOnly(message,['role','content'])||Object.getOwnPropertySymbols(message).length)throw error('invalid_request');
  const role=Object.getOwnPropertyDescriptor(message,'role'),content=Object.getOwnPropertyDescriptor(message,'content');
  if(!role||!content||!Object.hasOwn(role,'value')||!Object.hasOwn(content,'value')||
   !['system','user','assistant'].includes(role.value)||typeof content.value!=='string'||!content.value.length)throw error('invalid_request');
  total+=content.value.length;if(total>7000)throw error('invalid_request');
  snapshot.push({role:role.value,content:content.value});
 }
 return snapshot;
}
const zero=value=>value===0||typeof value==='string'&&/^0(?:\.0+)?$/.test(value);
const allZero=pricing=>record(pricing)&&['prompt','completion'].every(key=>zero(pricing[key]))&&
 Object.values(pricing).every(zero);
const closeBody=async response=>{try{await response?.body?.cancel();}catch{/* Ignore transport cleanup. */}};

async function boundedJson(response,limit=65536){
 if(!response?.body?.getReader)throw error('invalid_response');
 const reader=response.body.getReader();let size=0;const chunks=[];
 try{
  while(true){const {done,value}=await reader.read();if(done)break;
   if(!(value instanceof Uint8Array))throw error('invalid_response');size+=value.byteLength;
   if(size>limit)throw error('invalid_response');chunks.push(value);
  }
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 }catch{throw error('invalid_response');}finally{await reader.cancel().catch(()=>{});}
}

export function createOpenRouterProvider({enabled=false,getApiKey,model,endpoint,fetchImpl=globalThis.fetch,timeoutMs=15000,maxOutputTokens=512}={}){
 if(typeof enabled!=='boolean'||typeof getApiKey!=='function'||!validModel(model)||!validEndpoint(endpoint)||
  typeof fetchImpl!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>30000||
  !Number.isInteger(maxOutputTokens)||maxOutputTokens<1||maxOutputTokens>1024)throw error('invalid_configuration');
 let busy=false,accountConnected=false,lastReceipt=null;
 const credential=async()=>{let key;try{key=await getApiKey();}catch{throw error('missing_credential');}
  if(!validKey(key))throw error('missing_credential');return key;};
 const request=async(url,init,signal)=>{
  try{return await fetchImpl(url,{...init,signal,redirect:'error',credentials:'omit',cache:'no-store'});}
  catch{if(signal?.aborted)throw error('cancelled');throw error('network');}
 };
 const account=async({signal}={})=>{
  if(!enabled)throw error('disabled');
  if(signal!==undefined&&!(signal instanceof AbortSignal))throw error('invalid_request');
  const key=await credential();const timeout=AbortSignal.timeout(timeoutMs);
  const combined=signal?AbortSignal.any([signal,timeout]):timeout;
  try{
   const response=await request(KEY_URL,{method:'GET',headers:{Authorization:`Bearer ${key}`,Accept:'application/json'}},combined);
   if(response.status===401||response.status===403){await closeBody(response);throw error('auth');}
   if(!response.ok){await closeBody(response);throw error('account_unavailable');}
   const body=await boundedJson(response,8192),data=body?.data;
   if(!record(data)||typeof data.is_free_tier!=='boolean')throw error('invalid_response');
   accountConnected=true;
   return Object.freeze({connected:true,isFreeTier:data.is_free_tier,
    hasSpendingLimit:typeof data.limit==='number'&&Number.isFinite(data.limit),
    limitRemaining:typeof data.limit_remaining==='number'&&Number.isFinite(data.limit_remaining)?data.limit_remaining:null});
  }catch(cause){accountConnected=false;if(signal?.aborted)throw error('cancelled');if(timeout.aborted)throw error('timeout');
   if(cause?.name==='OpenRouterProviderError')throw cause;throw error('account_unavailable');}
 };
 return {
  outputContract:'paragraph-citations-v1',
  status(){return {state:enabled?'configured':'disabled',busy,model:'LEX AI',remote:true,accountConnected};},
  checkAccount:account,
  get lastReceipt(){return lastReceipt?{...lastReceipt}:null;},
  async *generate(messages,{responseFormat='text',signal}={}){
   if(!enabled)throw error('disabled');
   if(busy)throw error('busy');
   if(responseFormat!=='text'||signal!==undefined&&!(signal instanceof AbortSignal))throw error('invalid_request');
   const prepared=snapshotMessages(messages);
   const body=JSON.stringify({model,messages:prepared,max_tokens:maxOutputTokens,stream:false,usage:{include:true},
    provider:{only:[endpoint],allow_fallbacks:false,zdr:true,data_collection:'deny',require_parameters:true,
     max_price:{prompt:0,completion:0,request:0,image:0}}});
   if(new TextEncoder().encode(body).byteLength>16384)throw error('invalid_request');
   if(signal?.aborted)throw error('cancelled');
   busy=true;lastReceipt=null;
   const timeout=AbortSignal.timeout(timeoutMs),combined=signal?AbortSignal.any([signal,timeout]):timeout;
   try{
    // Catalog is public. Reject a changed/nonzero route before using the key.
    const catalog=await request(MODELS_URL,{method:'GET',headers:{Accept:'application/json'}},combined);
    if(!catalog.ok){await closeBody(catalog);throw error('catalog_unavailable');}
    const listing=await boundedJson(catalog,4*1024*1024);
    const found=Array.isArray(listing?.data)?listing.data.filter(item=>item?.id===model):[];
    if(found.length!==1||!allZero(found[0].pricing))throw error('not_free');
    const key=await credential();
    const [author,slug]=model.split('/');
    const endpointUrl=`${ORIGIN}/api/v1/models/${author}/${slug}/endpoints`;
    const available=await request(endpointUrl,{method:'GET',headers:{Authorization:`Bearer ${key}`,Accept:'application/json'}},combined);
    if(!available.ok){await closeBody(available);throw error('endpoint_unavailable');}
    const endpointListing=await boundedJson(available,262144);
    const matches=Array.isArray(endpointListing?.data?.endpoints)?endpointListing.data.endpoints.filter(item=>item?.tag===endpoint):[];
    if(matches.length!==1||!allZero(matches[0].pricing))throw error('not_free');
    const response=await request(CHAT_URL,{method:'POST',headers:{Authorization:`Bearer ${key}`,
     'Content-Type':'application/json',Accept:'application/json'},body},combined);
    if(response.status===401||response.status===403){await closeBody(response);throw error('auth');}
    if(response.status===402||response.status===429){await closeBody(response);throw error('quota');}
    if(!response.ok){await closeBody(response);throw error('provider_failed');}
    const result=await boundedJson(response);
    if(result?.model!==model||!Array.isArray(result.choices)||result.choices.length!==1||
     result.choices[0]?.finish_reason!=='stop'||typeof result.choices[0]?.message?.content!=='string'||
     result.choices[0].message.content.length>32768||result.choices[0].message.tool_calls!==undefined)throw error('invalid_response');
    if(combined.aborted)throw error('cancelled');
    const count=value=>Number.isSafeInteger(value)&&value>=0?value:null;
    if(result.usage?.cost!==undefined&&!zero(result.usage.cost))throw error('unexpected_charge');
    lastReceipt=Object.freeze({requestedModel:model,observedModel:result.model,endpointRequested:endpoint,
     observedProvider:typeof result.provider==='string'?result.provider:null,
     usage:record(result.usage)?{promptTokens:count(result.usage.prompt_tokens),completionTokens:count(result.usage.completion_tokens)}:null});
    busy=false;yield result.choices[0].message.content;
   }catch(cause){if(signal?.aborted)throw error('cancelled');if(timeout.aborted)throw error('timeout');if(cause?.name==='OpenRouterProviderError')throw cause;
    throw error('provider_failed');
   }finally{busy=false;}
  }
 };
}
