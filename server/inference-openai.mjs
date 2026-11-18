// Optional local inference provider for an OpenAI-compatible server that the user already runs
// (for example Colibri at http://127.0.0.1:8000/v1). Opt-in only: LEX_INFERENCE_BACKEND=openai-local.
// It never downloads, installs or starts a model, and it only talks to a loopback address.
// Same surface as createInference(): status, initialize, generate, stop.
const MAX_CHARS=32768,MAX_INPUT=120000;

export function loopbackBase(raw){
 let u;try{u=new URL(raw);}catch{throw Error('Dirección del motor local no válida.');}
 if(u.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(u.hostname)||u.username||u.password)throw Error('El motor local debe estar en esta misma computadora (127.0.0.1).');
 return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/,'')}`;
}

async function* sse(body){
 const dec=new TextDecoder();let buf='';
 for await(const chunk of body){buf+=dec.decode(chunk,{stream:true});let i;while((i=buf.indexOf('\n'))>=0){const line=buf.slice(0,i).trim();buf=buf.slice(i+1);if(!line.startsWith('data:'))continue;const data=line.slice(5).trim();if(data==='[DONE]')return;try{yield JSON.parse(data);}catch{throw Error('Respuesta del motor local no válida.');}}}
}

export function createOpenAIInference({baseUrl=process.env.LEX_OPENAI_BASE_URL||'http://127.0.0.1:8000/v1',model=process.env.LEX_OPENAI_MODEL,label=process.env.LEX_OPENAI_LABEL||'Motor local OpenAI-compatible',contextLength=4096,outputTokens=1024,dependencies={}}={}){
 const base=loopbackBase(baseUrl),deps={fetch:globalThis.fetch,...dependencies};
 let state={state:'stopped',model:label,modelId:model||'',supported:true,message:'Conecta el motor local para comenzar.',progress:0,contextLength,outputTokens,memoryMeasured:false,provider:'openai-local'};
 let busy=false,controller;
 const set=s=>{state={...state,...s};};
 const call=async(route,body,timeout,signal)=>{
  const r=await deps.fetch(base+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.any([AbortSignal.timeout(timeout),...(signal?[signal]:[])])});
  if(!r.ok)throw Error(`Motor local: HTTP ${r.status}`);return r;
 };
 return {
  async status(){return {...state,busy};},
  async initialize(){
   if(state.state==='ready')return {...state};
   set({state:'starting',message:'Conectando con el motor local…'});
   try{
    const list=await(await call('/models',null,5000)).json();
    const ids=(list.data||[]).map(m=>m.id).filter(x=>typeof x==='string');
    if(!ids.length)throw Error('El motor local no tiene ningún modelo cargado.');
    const chosen=model||ids[0];
    if(!ids.includes(chosen))throw Error('El modelo configurado no está disponible en el motor local.');
    set({state:'ready',modelId:chosen,message:'Motor local conectado. No se midió memoria ni calidad.',progress:100});
   }catch(e){set({state:'error',message:e.name==='TimeoutError'?'El motor local no respondió.':e.message||'No se pudo conectar con el motor local.'});}
   return {...state};
  },
  async *generate(messages,{signal,outputSchema,responseFormat='json'}={}){
   if(state.state!=='ready')throw Error('Conecta el motor local antes de analizar documentos.');
   if(busy)throw Error('Ya hay un análisis en curso.');
   if(!['json','text'].includes(responseFormat)||responseFormat==='text'&&outputSchema)throw Error('Formato de respuesta no admitido.');
   if(!Array.isArray(messages)||!messages.length||messages.length>16||messages.some(m=>!['system','user','assistant'].includes(m.role)||typeof m.content!=='string')||messages.reduce((n,m)=>n+m.content.length,0)>MAX_INPUT||JSON.stringify(outputSchema||{}).length>16000)throw Error('El contexto excede el presupuesto local. Acota tu pregunta y las fuentes.');
   busy=true;controller=new AbortController();const active=controller,timer=setTimeout(()=>active.abort(),180_000);
   try{
    const response_format=responseFormat==='text'?undefined:outputSchema?{type:'json_schema',json_schema:{name:'rejon_output',strict:true,schema:outputSchema}}:{type:'json_object'};
    const r=await call('/chat/completions',{model:state.modelId,messages,stream:true,max_tokens:outputTokens,temperature:0,...(response_format?{response_format}:{})},180_000,AbortSignal.any([active.signal,...(signal?[signal]:[])]));
    let chars=0,finished=false;
    for await(const d of sse(r.body)){
     if(d.error)throw Error('El motor no pudo generar el análisis.');
     const c=d.choices?.[0];if(!c)continue;
     const t=c.delta?.content;if(t){chars+=t.length;if(chars>MAX_CHARS)throw Error('Respuesta local demasiado grande.');yield t;}
     if(c.finish_reason){finished=true;if(c.finish_reason==='length')throw Error('La respuesta excedió el límite. Acota tu pregunta.');}
    }
    if(!finished)throw Error('La respuesta local se interrumpió.');
   }catch(e){if(e.name==='AbortError'||e.name==='TimeoutError')throw Error('Análisis cancelado o tiempo máximo excedido.');throw e;}
   finally{clearTimeout(timer);active.abort();if(controller===active)controller=null;busy=false;}
  },
  async stop(){controller?.abort();set({state:'stopped',message:'Motor local desconectado. Rejon no detiene un servidor que no inició.',progress:0});return {...state};}
 };
}
