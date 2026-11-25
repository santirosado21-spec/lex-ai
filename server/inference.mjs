import { availableMemory, processTreeRss } from './runtime-memory.mjs';
import { CONTRACTUAL_OLLAMA_OPTIONS } from './privacy/intake-contractual-options.mjs';
import { generationOptions } from './generation-options.mjs';
import { ensureBundledModel } from './bundled-model.mjs';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, access, stat, statfs } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultCatalog = JSON.parse(await readFile(path.join(root, 'resources/model-catalog.json'), 'utf8'));
const GiB = 1024 ** 3;
const digestOf = raw => createHash('sha256').update(raw).digest('hex');
export async function sha256(file, signal) {
 const h=createHash('sha256'); for await(const b of createReadStream(file,{signal})) h.update(b); return h.digest('hex');
}
async function freePort(){ const s=createServer(); await new Promise((r,j)=>{s.once('error',j);s.listen(0,'127.0.0.1',r)}); const p=s.address().port; await new Promise(r=>s.close(r)); return p; }
export function modelPolicy(catalog) {
 if(!/^[a-z0-9][a-z0-9_.-]*:[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(catalog.id)||!/[a-f0-9]{64}/.test(catalog.manifestDigest)||catalog.manifestDigest.length!==64)throw Error('Catálogo de modelo inválido.');
 if(!Number.isSafeInteger(catalog.downloadBytes)||catalog.downloadBytes<=0||catalog.downloadBytes>2_000_000_000)throw Error('El modelo excede el límite de descarga de 2 GB.');
 if(!Number.isInteger(catalog.contextLength)||catalog.contextLength<2048||catalog.contextLength>4096||!Number.isInteger(catalog.outputTokens)||catalog.outputTokens<1||catalog.outputTokens>512||!Number.isInteger(catalog.maxInputCharacters)||catalog.maxInputCharacters<1||catalog.maxInputCharacters>7000)throw Error('Presupuesto del modelo inválido.');
 if(![catalog.minMemoryGB,catalog.minFreeMemoryGB,catalog.minFreeDiskGB].every(n=>Number.isFinite(n)&&n>0))throw Error('Requisitos de recursos inválidos.');
 if(catalog.manifestLayout!==undefined&&!['legacy','v2'].includes(catalog.manifestLayout))throw Error('Formato de índice no admitido.');
 if(catalog.manifestLayout==='v2'&&catalog.localOnly!==true)throw Error('El índice experimental requiere un modelo local verificado.');
 const [name,tag]=catalog.id.split(':');
 const modernManifestPath=`manifests-v2/ollama.com/library/${name}/${tag}`;
 return {manifestPath:catalog.manifestLayout==='v2'?modernManifestPath:`manifests/registry.ollama.ai/library/${name}/${tag}`,modernManifestPath,manifestUrl:`https://registry.ollama.ai/v2/library/${name}/manifests/${tag}`};
}
function validateManifest(raw,catalog){
 if(digestOf(raw)!==catalog.manifestDigest)throw Error('El manifiesto no coincide con la versión aprobada.');
 const m=JSON.parse(raw);if(m.schemaVersion!==2||!Array.isArray(m.layers)||m.layers.length>64)throw Error('Manifiesto inválido.');
 const layers=[m.config,...m.layers];
 if(layers.some(l=>!l||!/^sha256:[a-f0-9]{64}$/.test(l.digest)||!Number.isSafeInteger(l.size)||l.size<0||typeof l.mediaType!=='string'))throw Error('Archivo de manifiesto inválido.');
 if(layers.reduce((n,l)=>n+l.size,0)!==catalog.downloadBytes)throw Error('Tamaño de descarga distinto al aprobado.');
 return m;
}
async function boundedBytes(response,limit,signal){
 if(Number(response.headers?.get('content-length'))>limit)throw Error('Respuesta excede el límite.');
 const reader=response.body.getReader(),parts=[];let size=0,onAbort;
 const cancel=()=>{void reader.cancel().catch(()=>{});};
 const aborted=new Promise((_,reject)=>{onAbort=()=>{cancel();reject(signal.reason||Error('Lectura cancelada.'));};signal?.addEventListener('abort',onAbort,{once:true});if(signal?.aborted)onAbort();});
 try{for(;;){signal?.throwIfAborted();const {done,value}=await (signal?Promise.race([reader.read(),aborted]):reader.read());if(done)break;size+=value.byteLength;if(size>limit)throw Error('Respuesta excede el límite.');parts.push(Buffer.from(value));}signal?.throwIfAborted();return Buffer.concat(parts);}
 catch(error){cancel();throw error;}finally{signal?.removeEventListener('abort',onAbort);reader.releaseLock();}
}
async function abortable(work,signal){
 signal?.throwIfAborted();let cancel;
 const aborted=new Promise((_,reject)=>{cancel=()=>reject(signal.reason||Error('Operación cancelada.'));signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();});
 try{return await (signal?Promise.race([work,aborted]):work);}finally{signal?.removeEventListener('abort',cancel);}
}
async function* records(body,signal){
 const decoder=new TextDecoder();let buffer='';
 const reader=body.getReader();const cancel=()=>{void reader.cancel().catch(()=>{});};signal?.addEventListener('abort',cancel,{once:true});
 try{for(;;){signal?.throwIfAborted();const {value:b,done}=await abortable(reader.read(),signal);if(done)break;buffer+=decoder.decode(b,{stream:true});if(buffer.length>262144)throw Error('Respuesta local demasiado grande.');let n;while((n=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,n);buffer=buffer.slice(n+1);if(line.trim())yield JSON.parse(line);}}
 buffer+=decoder.decode();if(buffer.trim())yield JSON.parse(buffer);
 }finally{signal?.removeEventListener('abort',cancel);void reader.cancel().catch(()=>{});reader.releaseLock();}
}
// Dependencies are injectable for isolated CPU tests; production uses only the owned local daemon.
function createRuntime({dataDir,runtimePath=process.env.LEX_OLLAMA_BIN,modelsDir=process.env.LEX_MODELS_DIR,modelCatalog=defaultCatalog,bundledModelsDir=path.join(root,'resources/bundled-model'),allowDownload=process.env.LEX_DESKTOP!=='1',dependencies={}}={},readerOnly=false) {
 const catalog=modelCatalog,policy=modelPolicy(catalog);
 const deps={fetch:globalThis.fetch,spawn,freePort,freeMemory:()=>os.freemem(),statfs,hardware:()=>({platform:os.platform(),arch:os.arch(),memoryGB:os.totalmem()/GiB}),...dependencies};
 deps.memory=dependencies.memory||(dependencies.freeMemory?async()=>({freeBytes:deps.freeMemory(),availableBytes:deps.freeMemory(),method:'injected-test',estimated:true}):availableMemory);deps.rss=dependencies.rss||processTreeRss;
 const hardware=deps.hardware();
 const supported=hardware.platform===catalog.platform&&(catalog.supportedArchs||[catalog.arch]).includes(hardware.arch)&&hardware.memoryGB>=catalog.minMemoryGB;
 let state={state:'stopped',model:'Rejon.AI',modelId:catalog.id,supported,hardware,message:supported?'Inicializa el modelo local para comenzar.':`Requiere una Mac compatible y al menos ${catalog.minMemoryGB} GB de RAM; compatibilidad pendiente de medición.`,downloadGB:catalog.downloadGB,downloadBytes:catalog.downloadBytes,license:catalog.license,licenseUrl:catalog.licenseUrl,progress:0,contextLength:catalog.contextLength,outputTokens:catalog.outputTokens,memoryEstimateGB:catalog.memoryEstimateGB,memoryMeasured:false,minMemoryGB:catalog.minMemoryGB,minFreeMemoryGB:catalog.minFreeMemoryGB,minFreeDiskGB:catalog.minFreeDiskGB,validationStatus:catalog.validationStatus};
 let cleanupTask,cleanupFailed=false,terminal=false;const signalledChildren=new WeakSet();
 let child,base,controller,initializing=false,busy=false,stopping=false,shutdown=false,initController,bootTask,stopPromise;
 const modelRoot=modelsDir||path.join(dataDir,'models');
 const set=s=>{state={...state,...s};};
 const cancelled=()=>{if(terminal||shutdown||initController?.signal.aborted)throw Error('Inicialización cancelada');};
 const request=async(route,body,timeout=15000,signal=initController?.signal)=>{
  const combined=AbortSignal.any([AbortSignal.timeout(timeout),...(signal?[signal]:[])]);combined.throwIfAborted();
  if(readerOnly&&(terminal||shutdown||!child||child.exitCode!=null||child.signalCode!=null))throw Error('Runtime propio cerrado.');
  let onAbort;
  const aborted=new Promise((_,reject)=>{onAbort=()=>reject(combined.reason||Error('Petición cancelada.'));combined.addEventListener('abort',onAbort,{once:true});if(combined.aborted)onAbort();});
  const work=(async()=>{
   const r=await deps.fetch(base+route,{method:body?'POST':'GET',redirect:'error',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:combined});
   if(combined.aborted){await r.body?.cancel().catch(()=>{});combined.throwIfAborted();}
   if(!r.ok)throw Error(`Motor local: HTTP ${r.status}`);
   if(!readerOnly)return r;
   // Own-mode startup and chat reads share cancellation through the full body,
   // not only until HTTP headers. Late/uncooperative transports cannot be reused.
   const bytes=await boundedBytes(r,262144,combined);combined.throwIfAborted();return new Response(bytes,{status:200});
  })();
  try{return await Promise.race([work,aborted]);}finally{combined.removeEventListener('abort',onAbort);}
 };
 const signalOwned=(owned,signal)=>{if(Number.isInteger(owned.pid)&&owned.pid>0&&!dependencies.spawn){try{return process.kill(-owned.pid,signal);}catch{}}return owned.kill(signal);};
 async function killOwned(){
  if(cleanupTask)return cleanupTask;
  const owned=child;if(!owned)return !cleanupFailed;stopping=true;
  const gone=()=>owned.exitCode!=null||owned.signalCode!=null;
  cleanupTask=(async()=>{
   const startedAlive=!gone();let attemptSignalled=false;
   if(gone()&&!signalledChildren.has(owned)){cleanupFailed=true;terminal=true;set({state:'error',cleanup:'unconfirmed-tree',message:'El líder ya salió; no se confirmó el cierre de auxiliares.'});return false;}
   if(!gone()){
    let timer,onExit;const exited=new Promise(r=>{onExit=r;owned.once('exit',onExit);});
    try{if(signalOwned(owned,'SIGTERM')===true){attemptSignalled=true;signalledChildren.add(owned);}}catch{}
    await Promise.race([exited,new Promise(r=>{timer=setTimeout(r,1500);})]);clearTimeout(timer);
    if(!gone()){try{if(signalOwned(owned,'SIGKILL')===true){attemptSignalled=true;signalledChildren.add(owned);}}catch{}let last;await Promise.race([exited,new Promise(r=>{last=setTimeout(r,1000);})]);clearTimeout(last);}
    owned.removeListener('exit',onExit);
   }
   if(gone()&&startedAlive&&!attemptSignalled){cleanupFailed=true;terminal=true;set({state:'error',cleanup:'unconfirmed-tree',message:'No se confirmó señal aceptada en este intento ni cierre de auxiliares.'});return false;}
   if(!gone()){cleanupFailed=true;terminal=true;set({state:'error',cleanup:'unconfirmed',message:'No se confirmó el cierre del motor propio. No se puede reiniciar.'});return false;}
   if(child===owned)child=undefined;cleanupFailed=false;set({cleanup:'confirmed-child-exit'});return true;
  })();
  try{return await cleanupTask;}finally{cleanupTask=null;}
 }
 const memoryRequirementMessage=`Libera al menos ${catalog.minFreeMemoryGB} GB de RAM disponible antes de usar Rejon.AI. Estimación conservadora, no garantía de rendimiento.`;
 async function readMemory(epoch=initController){const memory=await deps.memory();if(shutdown||terminal||epoch!==initController||epoch?.signal.aborted)return memory;set({freeMemoryGB:memory.freeBytes/GiB,availableMemoryGB:memory.availableBytes/GiB,memoryAvailabilityMethod:memory.method,memoryAvailabilityEstimated:memory.estimated});return memory;}
 async function refreshMemoryWarning(epoch=initController){
  try{
   const memory=await readMemory(epoch);if(shutdown||terminal||epoch!==initController||epoch?.signal.aborted)return;
   if(!Number.isFinite(memory.availableBytes)||memory.availableBytes<catalog.minFreeMemoryGB*GiB)set({memoryWarning:`Cierra otras aplicaciones antes de preguntar. ${memoryRequirementMessage}`});
   else set({memoryWarning:undefined});
  }catch{if(shutdown||terminal||epoch!==initController||epoch?.signal.aborted)return;set({memoryWarning:'No se pudo comprobar la memoria disponible. Cierra otras aplicaciones antes de preguntar.'});}
 }
 async function checkMemory(){const epoch=initController;const memory=await readMemory(epoch);if(shutdown||terminal||epoch!==initController||epoch?.signal.aborted)throw Error('Motor detenido.');if(!Number.isFinite(memory.availableBytes)||memory.availableBytes<catalog.minFreeMemoryGB*GiB){set({memoryWarning:`Cierra otras aplicaciones antes de preguntar. ${memoryRequirementMessage}`});throw Error(memoryRequirementMessage);}set({memoryWarning:undefined});}

 async function verify(){
  set({state:'verifying',message:'Comprobando integridad de los archivos del modelo…',progress:0});
  const blob=d=>path.join(modelRoot,'blobs',d.replace(':','-'));
  let raw;try{raw=await readFile(blob(`sha256:${catalog.manifestDigest}`));}catch{raw=await readFile(path.join(modelRoot,policy.manifestPath));}
  const manifest=validateManifest(raw,catalog);
  const installedRaw=await readFile(path.join(modelRoot,policy.manifestPath));
  if(catalog.manifestLayout==='v2'&&digestOf(installedRaw)!==catalog.manifestDigest)throw Error('El índice local del modelo fue modificado.');
  const installed=JSON.parse(installedRaw);
  const signature=l=>JSON.stringify([l.mediaType,l.digest,l.size,l.name??null]);
  const approved=manifest.layers.filter(l=>!l.mediaType.includes('manifest'));
  const checkIndex=index=>{
   const executable=index.layers?.filter(l=>!l.mediaType.includes('manifest'));
   if(index.schemaVersion!==2||!executable||signature(index.config)!==signature(manifest.config)||executable.length!==approved.length||executable.some((l,i)=>signature(l)!==signature(approved[i]))||index.layers.filter(l=>l.mediaType.includes('manifest')).some(l=>l.digest!==`sha256:${catalog.manifestDigest}`))throw Error('Configuración del modelo modificada.');
  };
  checkIndex(installed);
  // Ollama 0.40 can migrate legacy GGUF tags into a second index. Do not
  // validate only the old index while a different effective model shadows it.
  if(catalog.manifestLayout!=='v2'){
   let modernRaw;try{modernRaw=await readFile(path.join(modelRoot,policy.modernManifestPath));}catch(e){if(e.code!=='ENOENT')throw e;}
   if(modernRaw){const modern=JSON.parse(modernRaw);if(modern.runner!=='llamacpp'||modern.format!=='gguf'||Object.keys(modern).some(k=>!['schemaVersion','mediaType','config','layers','runner','format'].includes(k)))throw Error('Índice migrado no autorizado.');checkIndex(modern);}
  }
  const layers=[manifest.config,...manifest.layers];
  for(let i=0;i<layers.length;i++){
   cancelled();const l=layers[i],file=blob(l.digest);
   if((await stat(file)).size!==l.size||await sha256(file,initController.signal)!==l.digest.slice(7))throw Error('Un archivo del modelo está dañado.');
   cancelled();set({progress:Math.round((i+1)/layers.length*100)});
  }
 }
 async function start(){
  if(!supported)throw Error(`Requiere una Mac compatible y al menos ${catalog.minMemoryGB} GB de RAM; compatibilidad pendiente de medición.`);cancelled();
  const bin=runtimePath||path.join(root,'resources/runtime/ollama');await abortable(access(bin),initController.signal);cancelled();
  await abortable(mkdir(modelRoot,{recursive:true,mode:0o700}),initController.signal);cancelled();const disk=await abortable(deps.statfs(modelRoot),initController.signal);cancelled();set({freeDiskGB:Number(disk.bavail)*Number(disk.bsize)/GiB});
  if(state.freeDiskGB<catalog.minFreeDiskGB)throw Error(`Se requieren ${catalog.minFreeDiskGB} GB libres en disco.`);
  const port=await abortable(deps.freePort(),initController.signal);cancelled();if(!Number.isInteger(port)||port<1024||port>65535||readerOnly&&port===11434)throw Error('Puerto propio inválido.');cancelled();base=`http://127.0.0.1:${port}`;
  child=deps.spawn(bin,['serve'],{detached:true,stdio:['ignore','ignore','pipe'],env:{PATH:'/usr/bin:/bin',HOME:dataDir,TMPDIR:os.tmpdir(),OLLAMA_HOST:`127.0.0.1:${port}`,OLLAMA_MODELS:modelRoot,OLLAMA_NO_CLOUD:'1',OLLAMA_KEEP_ALIVE:'0',OLLAMA_MAX_LOADED_MODELS:'1',OLLAMA_NUM_PARALLEL:'1',OLLAMA_MAX_QUEUE:'1',OLLAMA_CONTEXT_LENGTH:String(catalog.contextLength),OLLAMA_ORIGINS:'',DYLD_LIBRARY_PATH:path.dirname(bin)}});
  const owned=child;owned.stderr.on('data',()=>{});
  owned.once('error',e=>set({state:'error',message:`No se pudo iniciar el motor: ${e.code||'error'}`}));
  owned.once('exit',()=>{if(!stopping&&child===owned){if(readerOnly)terminal=true;initController?.abort();controller?.abort();set({state:'error',message:'El motor local se detuvo.'});}});
  for(let n=0;n<100;n++){cancelled();if(child?.exitCode!=null||child?.signalCode!=null)throw Error('El motor no pudo conservar el puerto propio.');try{await request('/api/version',null,1000);return;}catch{cancelled();await new Promise(r=>setTimeout(r,100));}}
  throw Error('El motor no respondió al iniciar.');
 }
 async function boot(){
  try{
   if(!catalog.localOnly){
    if(!supported)throw Error(`Requiere una Mac compatible y al menos ${catalog.minMemoryGB} GB de RAM; compatibilidad pendiente de medición.`);
    await abortable(mkdir(modelRoot,{recursive:true,mode:0o700}),initController.signal);cancelled();const disk=await abortable(deps.statfs(modelRoot),initController.signal);cancelled();
    if(Number(disk.bavail)*Number(disk.bsize)<catalog.minFreeDiskGB*GiB)throw Error(`Se requieren ${catalog.minFreeDiskGB} GB libres en disco.`);
    set({state:'preparing',message:'Preparando los recursos incluidos en la aplicación…',progress:0});
    const bundled=await abortable(ensureBundledModel({bundleDir:bundledModelsDir,modelsDir:modelRoot,catalog,signal:initController.signal,reserveBytes:catalog.minFreeDiskGB*GiB}),initController.signal);
    cancelled();set({bundledModelAvailable:bundled.available});
   }
   if(readerOnly){cancelled();await abortable(verify(),initController.signal);cancelled();}
   await start();const tags=await(await request('/api/tags')).json();cancelled();
   if(!tags.models?.some(x=>x.name===catalog.id)){
    if(catalog.localOnly===true)throw Error('El candidato local de evaluación no está importado en este almacén.');
    if(!allowDownload)throw Error('No se encontraron los recursos incluidos de Rejon.AI. Vuelve a instalar la aplicación completa.');
    // Inspect only the small official manifest before allowing a tag pull. No cloud inference.
    const response=await deps.fetch(policy.manifestUrl,{headers:{Accept:'application/vnd.docker.distribution.manifest.v2+json'},redirect:'error',signal:AbortSignal.any([initController.signal,AbortSignal.timeout(15000)])});
    if(!response.ok)throw Error('No se pudo verificar el manifiesto oficial.');
    const manifest=validateManifest(await boundedBytes(response,65536),catalog);
    const allowed=new Map([manifest.config,...manifest.layers].map(l=>[l.digest,l.size]));
    set({state:'downloading',message:`Descargando Rejon.AI (${(catalog.downloadBytes/1e9).toFixed(2)} GB). Puedes cancelar.`,progress:0});
    const r=await request('/api/pull',{model:catalog.id,stream:true},3600_000);let success=false;
    for await(const d of records(r.body,initController.signal)){
     cancelled();if(d.error)throw Error('La descarga local falló.');
     if(d.digest&&(!allowed.has(d.digest)||d.total!==undefined&&d.total!==allowed.get(d.digest)||d.completed!==undefined&&(!Number.isFinite(d.completed)||d.completed<0||d.completed>allowed.get(d.digest))))throw Error('La descarga no coincide con los archivos aprobados.');
     if(d.total!==undefined&&(!d.digest||d.total>catalog.downloadBytes))throw Error('La descarga excede el límite aprobado.');
     if(d.status==='success')success=true;
     set({progress:d.total?Math.min(99,Math.round((d.completed||0)/d.total*100)):state.progress});
    }
    if(!success)throw Error('La descarga se interrumpió.');
   }
   cancelled();if(!readerOnly)await abortable(verify(),initController.signal);cancelled();await abortable(refreshMemoryWarning(),initController.signal);cancelled();set({state:'ready',manifestDigest:catalog.manifestDigest,progress:100,message:'Rejon.AI está disponible. Los documentos se procesan en este equipo.'});
  }catch(e){await killOwned();set({state:cleanupFailed?'error':shutdown?'stopped':'error',message:cleanupFailed?'No se confirmó el cierre del motor propio. No se puede reiniciar.':shutdown?'Motor detenido.':e.message});}finally{initializing=false;}
 }
 return {
  outputContract:'paragraph-citations-v1',
  status:async()=>({...state,hardware:{...hardware},busy}),
  initialize:async()=>{if(stopPromise)await stopPromise;if(terminal)throw Error('Runtime terminal: cierre requerido o no confirmado.');if(initializing||state.state==='ready')return {...state};shutdown=false;stopping=false;initController=new AbortController();initializing=true;set({state:'starting',message:'Iniciando motor local…',progress:0});bootTask=boot();return {...state};},
  async *generate(messages,{signal,outputSchema,responseFormat='json'}={}){
   if(readerOnly)throw Error('Runtime reservado para privacidad.');
   if(state.state!=='ready')throw Error('Prepara Rejon.AI antes de analizar documentos.');
   if(busy)throw Error('Ya hay un análisis en curso.');
   if(!['json','text'].includes(responseFormat)||responseFormat==='text'&&outputSchema)throw Error('Formato de respuesta no admitido.');
   if(!Array.isArray(messages)||!messages.length||messages.length>16||messages.some(m=>!['system','user','assistant'].includes(m.role)||typeof m.content!=='string')||messages.reduce((n,m)=>n+m.content.length,0)>catalog.maxInputCharacters||JSON.stringify(outputSchema||{}).length>16000)throw Error('El contexto excede el presupuesto local. Acota tu pregunta y las fuentes.');
   const generationChild=child,generationInit=initController;await checkMemory();if(shutdown||terminal||state.state!=='ready'||child!==generationChild||initController!==generationInit)throw Error('Motor detenido durante preparación.');if(busy)throw Error('Ya hay un análisis en curso.');busy=true;controller=new AbortController();const active=controller;const generationSignal=AbortSignal.any([active.signal,...(signal?[signal]:[])]);const timer=setTimeout(()=>active.abort(),180_000);
   let rssTimer,rssChecking=false,guardError;const clearGenerationTimers=()=>{clearTimeout(timer);clearInterval(rssTimer);};generationSignal.addEventListener('abort',clearGenerationTimers,{once:true});
   const sampleRss=async()=>{if(rssChecking||shutdown||!child||child!==generationChild||controller!==active||active.signal.aborted)return;rssChecking=true;try{const rss=await deps.rss(generationChild.pid);if(controller!==active||active.signal.aborted||child!==generationChild)return;if(!Number.isFinite(rss)||rss<0)throw Error('Medición RSS inválida.');set({runtimeRssGB:rss/GiB,runtimeRssLimitGB:3});if(rss>3*GiB)throw Error('Rejon.AI superó el límite de memoria de 3 GiB. Motor detenido.');}catch(e){if(controller!==active||active.signal.aborted||child!==generationChild)return;guardError=Error(e.message?.includes('3 GiB')?e.message:'No se pudo supervisar la memoria del motor.');active.abort();await killOwned();set({state:'error',message:guardError.message});}finally{rssChecking=false;}};
   try{
    await sampleRss();if(guardError)throw guardError;if(active.signal.aborted||shutdown||child!==generationChild)throw Error('Generación cancelada.');rssTimer=setInterval(()=>void sampleRss(),500);
    const r=await request('/api/chat',{model:catalog.id,messages,stream:true,think:false,truncate:false,shift:false,...(responseFormat==='text'?{}:{format:outputSchema||'json'}),keep_alive:0,options:generationOptions(catalog.contextLength,catalog.outputTokens)},180_000,AbortSignal.any([active.signal,...(signal?[signal]:[])]));
    let done=false,characters=0;
    for await(const d of records(r.body,generationSignal)){if(generationSignal.aborted||shutdown||child!==generationChild||controller!==active)throw Error('Generación cancelada.');if(d.error)throw Error('El motor no pudo generar el análisis.');if(d.message?.content){characters+=d.message.content.length;if(characters>32768)throw Error('Respuesta local demasiado grande.');yield d.message.content;if(generationSignal.aborted||shutdown||child!==generationChild||controller!==active)throw Error('Generación cancelada.');}if(d.done){done=true;if(d.done_reason==='length')throw Error('La respuesta excedió el límite. Acota tu pregunta.');}}
    generationSignal.throwIfAborted();if(!done)throw Error('La respuesta local se interrumpió.');
   }catch(e){if(guardError)throw guardError;if(e.name==='AbortError'||e.name==='TimeoutError')throw Error('Análisis cancelado o tiempo máximo excedido.');throw e;}
   finally{
    clearGenerationTimers();generationSignal.removeEventListener('abort',clearGenerationTimers);active.abort();
    // Explicit unload also covers cancelled streams, where keep_alive alone may not finish.
    if(!shutdown&&child===generationChild&&controller===active){try{const released=await request('/api/generate',{model:catalog.id,keep_alive:0,stream:false},3000,null);const result=JSON.parse(await boundedBytes(released,65536));if(result.done!==true)throw Error('No se confirmó la liberación.');}catch{if(child===generationChild&&controller===active){await killOwned();if(!cleanupFailed)set({state:'stopped',message:'Motor detenido para liberar memoria.'});}}}
    if(controller===active){controller=null;busy=false;}
   }
  },
  ...(readerOnly?{async readerRequest(body,{signal}={}){
   if(terminal||shutdown||state.state!=='ready'||busy)throw Error('Lector propio no disponible.');
   if(!body||body.model!==defaultCatalog.id||body.stream!==false||body.think!==false||body.keep_alive!=='30s'||!Array.isArray(body.messages)||body.messages.length!==2||body.messages[0].role!=='system'||body.messages[1].role!=='user'||body.messages.some(m=>typeof m.content!=='string')||JSON.stringify(body).length>131072)throw Error('Petición de lector inválida.');
   const expected={...CONTRACTUAL_OLLAMA_OPTIONS,num_predict:body.format?.properties?.oraciones?256:4096};
   if(JSON.stringify(body.options)!==JSON.stringify(expected)||Object.keys(body).sort().join(',')!=='format,keep_alive,messages,model,options,stream,think')throw Error('Opciones de lector inválidas.');
   signal?.throwIfAborted();busy=true;controller=new AbortController();const active=controller;
   const combined=AbortSignal.any([active.signal,AbortSignal.timeout(15000),...(signal?[signal]:[])]);
   let onAbort;
   const aborted=new Promise((_,reject)=>{onAbort=()=>reject(combined.reason||Error('Lector cancelado.'));combined.addEventListener('abort',onAbort,{once:true});if(combined.aborted)onAbort();});
   try{
    const work=(async()=>{await checkMemory();combined.throwIfAborted();if(terminal||shutdown)throw Error('Lector cerrado.');const response=await request('/api/chat',body,15000,combined);const bytes=await boundedBytes(response,262144);combined.throwIfAborted();if(terminal)throw Error('Lector cerrado.');return new Response(bytes,{status:200});})();
    return await Promise.race([work,aborted]);
   }catch(error){terminal=true;shutdown=true;active.abort();await killOwned();if(!cleanupFailed)set({state:'stopped',message:'Lector detenido tras fallo o cancelación.'});throw error;}
   finally{combined.removeEventListener('abort',onAbort);active.abort();if(controller===active){controller=null;busy=false;}}

  }}:{}),
  async stop(){
   if(stopPromise)return stopPromise;
   stopPromise=(async()=>{shutdown=true;if(readerOnly)terminal=true;stopping=true;initController?.abort();controller?.abort();controller=null;busy=false;const closed=await killOwned();await bootTask;if(!closed||cleanupFailed)throw Error('No se confirmó el cierre del motor propio.');set({state:'stopped',message:'Motor detenido.',progress:0});return {...state};})();
   try{return await stopPromise;}finally{stopPromise=undefined;}
  }
 };
}

// Existing product API remains compatible; close failures now fail closed. Owned reader is opt-in and never wired by main.
export function createInference(options){return createRuntime(options);}
export function createOwnedIntakeRuntime({dataDir,runtimePath,dependencies}={}){
 if(typeof dataDir!=='string'||!path.isAbsolute(dataDir)||typeof runtimePath!=='string'||!path.isAbsolute(runtimePath))throw Error('Runtime propio requiere rutas absolutas.');
 const {testModelCatalog,...runtimeDependencies}=dependencies||{};
 if(testModelCatalog&&(!runtimeDependencies.spawn||!runtimeDependencies.fetch))throw Error('Catálogo sintético requiere transporte y proceso simulados.');
 return createRuntime({dataDir,runtimePath,modelsDir:path.join(dataDir,'models'),modelCatalog:{...(testModelCatalog||defaultCatalog),id:defaultCatalog.id,localOnly:true},allowDownload:false,dependencies:runtimeDependencies},true);
}
