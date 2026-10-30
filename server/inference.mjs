import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, access, link, copyFile, statfs } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(await readFile(path.join(root, 'resources/model-catalog.json'), 'utf8'));
export async function sha256(file) {
 const h=createHash('sha256'); for await(const b of createReadStream(file)) h.update(b); return h.digest('hex');
}
async function freePort(){ const s=createServer(); await new Promise((r,j)=>{s.once('error',j);s.listen(0,'127.0.0.1',r)}); const p=s.address().port; await new Promise(r=>s.close(r)); return p; }
export function createInference({dataDir, runtimePath=process.env.LEX_OLLAMA_BIN, modelsDir=process.env.LEX_MODELS_DIR}={}) {
 const hardware={platform:os.platform(),arch:os.arch(),memoryGB:Math.round(os.totalmem()/1024**3)};
 const supported=hardware.platform===catalog.platform&&hardware.arch===catalog.arch&&hardware.memoryGB>=catalog.minMemoryGB;
 let state={state:'stopped',model:catalog.label,modelId:catalog.id,supported,hardware,message:supported?'Inicializa el modelo local para comenzar.':'Este prototipo requiere macOS Apple Silicon con al menos 24 GB de RAM.',downloadGB:catalog.downloadGB,license:catalog.license,progress:0};
 let child, base, controller, initializing=false, busy=false, stopping=false, shutdown=false, initController, bootTask, stopPromise;
 const modelRoot=modelsDir||path.join(dataDir,'models');
 const set=(s)=>{state={...state,...s};};
 const request=async(route,body,timeout=15000)=>{ const r=await fetch(base+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.any([AbortSignal.timeout(timeout),...(initController?[initController.signal]:[])])}); if(!r.ok) throw Error(`Motor local: HTTP ${r.status}`);return r;};
 async function verify(){
  set({state:'verifying',message:'Comprobando integridad de los archivos del modelo…',progress:0});
  const blob=(digest)=>{if(!/^sha256:[a-f0-9]{64}$/.test(digest))throw Error('Digest de modelo inválido');return path.join(modelRoot,'blobs',digest.replace(':','-'));};
  const original=blob(`sha256:${catalog.manifestDigest}`);
  // Ollama may store a normalized manifest plus the original manifest as a layer.
  let raw;try{raw=await readFile(original);}catch{
   raw=await readFile(path.join(modelRoot,'manifests/registry.ollama.ai/library/gemma4/26b-a4b'));
  }
  if(createHash('sha256').update(raw).digest('hex')!==catalog.manifestDigest) throw Error('El manifiesto no coincide con la versión aprobada.');
  const manifest=JSON.parse(raw);const layers=[manifest.config,...manifest.layers];
  for(let i=0;i<layers.length;i++){
   if(shutdown)throw Error('Inicialización cancelada');
   const l=layers[i];if(await sha256(blob(l.digest))!==l.digest.slice(7))throw Error('Un archivo del modelo está dañado.');
   if(i%20===0)set({progress:Math.round((i+1)/layers.length*100)});
  }
  const installed=JSON.parse(await readFile(path.join(modelRoot,'manifests/registry.ollama.ai/library/gemma4/26b-a4b'),'utf8'));
  // The executable weights/template/config must be the pinned ones, even if the registry manifest was normalized.
  const signature=l=>JSON.stringify([l.mediaType,l.digest,l.size,l.name??null]);
  const executable=installed.layers.filter(l=>!l.mediaType.includes('manifest'));
  const approvedExecutable=manifest.layers.filter(l=>!l.mediaType.includes('manifest'));
  const extras=installed.layers.filter(l=>l.mediaType.includes('manifest'));
  if(signature(installed.config)!==signature(manifest.config)||executable.length!==approvedExecutable.length||executable.some((l,i)=>signature(l)!==signature(approvedExecutable[i]))||extras.some(l=>!['application/vnd.ollama.manifest.list.v2+json','application/vnd.docker.distribution.manifest.v2+json'].includes(l.mediaType)))throw Error('Configuración del modelo modificada.');

 }
 async function start(){
  if(!supported)throw Error(state.message);
  if(child&&child.exitCode===null)return;
  const bin=runtimePath||path.join(root,'resources/runtime/ollama');await access(bin);
  await mkdir(modelRoot,{recursive:true,mode:0o700}); const port=await freePort();if(shutdown||initController?.signal.aborted)throw Error('Inicialización cancelada');base=`http://127.0.0.1:${port}`;
  child=spawn(bin,['serve'],{stdio:['ignore','ignore','pipe'],env:{PATH:'/usr/bin:/bin',HOME:dataDir,TMPDIR:os.tmpdir(),OLLAMA_HOST:`127.0.0.1:${port}`,OLLAMA_MODELS:modelRoot,OLLAMA_NO_CLOUD:'1',OLLAMA_KEEP_ALIVE:'0',OLLAMA_MAX_LOADED_MODELS:'1',OLLAMA_NUM_PARALLEL:'1',OLLAMA_CONTEXT_LENGTH:'8192',OLLAMA_ORIGINS:'',DYLD_LIBRARY_PATH:path.dirname(bin)}});
  child.stderr.on('data',()=>{}); // Never persist model prompts/runtime logs.
  child.once('error',e=>set({state:'error',message:`No se pudo iniciar el motor: ${e.code||'error'}`}));
  child.once('exit',()=>{if(!stopping)set({state:'error',message:'El motor local se detuvo. Puedes reiniciarlo.'});});
  for(let n=0;n<100;n++){if(shutdown)throw Error('Inicialización cancelada');try{await request('/api/version',null,1000);return;}catch{await new Promise(r=>setTimeout(r,200));}}
  throw Error('El motor no respondió al iniciar.');
 }
 async function seedExisting(){
  if(modelsDir)return;
  const relative='manifests/registry.ollama.ai/library/gemma4/26b-a4b';
  try{await access(path.join(modelRoot,relative));return;}catch{}
  const existing=path.join(os.homedir(),'.ollama/models');
  let manifest;
  try{manifest=JSON.parse(await readFile(path.join(existing,relative),'utf8'));await access(path.join(existing,'blobs',`sha256-${catalog.manifestDigest}`));}catch{return;}
  set({message:'Reutilizando una instalación local; se verificará cada archivo.'});
  await mkdir(path.join(modelRoot,'blobs'),{recursive:true,mode:0o700});
  for(const layer of [manifest.config,...manifest.layers]){
   if(shutdown)throw Error('Inicialización cancelada');
   if(!/^sha256:[a-f0-9]{64}$/.test(layer.digest))throw Error('Manifiesto local inválido');
   const name=layer.digest.replace(':','-'),src=path.join(existing,'blobs',name),dst=path.join(modelRoot,'blobs',name);
   try{await link(src,dst);}catch(e){if(e.code==='EEXIST')continue;if(e.code==='EXDEV')await copyFile(src,dst);else throw e;}
  }
  await mkdir(path.dirname(path.join(modelRoot,relative)),{recursive:true,mode:0o700});
  await copyFile(path.join(existing,relative),path.join(modelRoot,relative));
 }
 async function boot(){
  try{
   await start();await seedExisting();const tags=await (await request('/api/tags')).json();const match=tags.models?.find(x=>x.name===catalog.id);
   if(!match){
    const disk=await statfs(modelRoot);if(Number(disk.bavail)*Number(disk.bsize)<20*1024**3)throw Error('Se requieren al menos 20 GB libres para descargar el modelo.');
    set({state:'downloading',message:`Descargando ${catalog.label} (aprox. ${catalog.downloadGB} GB).`,progress:0});
    const r=await request('/api/pull',{model:catalog.id,stream:true},3600_000);let pending='';
    for await(const b of r.body){if(shutdown)throw Error('Descarga cancelada');pending+=new TextDecoder().decode(b);let nl;while((nl=pending.indexOf('\n'))>=0){const l=pending.slice(0,nl);pending=pending.slice(nl+1);if(!l)continue;const d=JSON.parse(l);if(d.error)throw Error(d.error);set({message:d.status||'Descargando…',progress:d.total?Math.round((d.completed||0)/d.total*100):state.progress});}}
   }
   // Ollama may report the digest of a normalized manifest. Verify the pinned original and ordered execution layers below, not the tag summary.
   set({manifestDigest:catalog.manifestDigest});
   await verify();set({state:'ready',progress:100,message:'Gemma está disponible. Los documentos se procesan en este equipo.'});
  }catch(e){const failedChild=child;if(failedChild&&failedChild.exitCode===null){stopping=true;failedChild.kill('SIGTERM');}set({state:shutdown?'stopped':'error',message:shutdown?'Motor detenido.':e.message});}finally{initializing=false;}
 }
 return {
  status:async()=>({...state,busy}),
  initialize:async()=>{if(stopPromise)await stopPromise;if(initializing||state.state==='ready')return {...state};shutdown=false;stopping=false;initController=new AbortController();initializing=true;set({state:'starting',message:'Iniciando motor local…',progress:0});bootTask=boot();return {...state};},
  async *generate(messages,{signal,outputSchema}={}){
   if(state.state!=='ready')throw Error('Inicializa Gemma antes de analizar documentos.');
   if(busy)throw Error('Ya hay un análisis en curso.');busy=true;controller=new AbortController();const timer=setTimeout(()=>controller.abort(),300_000);
   try{
    // MLX prefix snapshots accumulate between requests in Ollama 0.40.6.
    // Release the runner after each answer on the supported 24 GB machines.
    const r=await fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal:signal?AbortSignal.any([controller.signal,signal]):controller.signal,body:JSON.stringify({model:catalog.id,messages,stream:true,think:false,format:outputSchema||{type:'object',properties:{analysis:{type:'string'},citations:{type:'array',items:{type:'object',properties:{sourceId:{type:'string'},quote:{type:'string'}},required:['sourceId','quote'],additionalProperties:false}}},required:['analysis','citations'],additionalProperties:false},keep_alive:0,options:{temperature:0,num_ctx:8192,num_predict:2400}})});
    if(!r.ok)throw Error(`Error de inferencia local (${r.status}).`);let buffer='';let decoder=new TextDecoder();let done=false;
    for await(const b of r.body){buffer+=decoder.decode(b,{stream:true});let n;while((n=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,n);buffer=buffer.slice(n+1);if(!line.trim())continue;const d=JSON.parse(line);if(d.error)throw Error('El motor no pudo generar el análisis.');if(d.message?.content)yield d.message.content;if(d.done){done=true;if(d.done_reason==='length')throw Error('La respuesta excedió el límite. Acota tu pregunta.');}}}
    if(!done)throw Error('La respuesta local se interrumpió.');
   }catch(e){if(e.name==='AbortError')throw Error('Análisis cancelado o tiempo máximo excedido.');throw e;}finally{clearTimeout(timer);controller=null;busy=false;}
  },
  async stop(){
   if(stopPromise)return stopPromise;
   stopPromise=(async()=>{
    shutdown=true;stopping=true;initController?.abort();controller?.abort();
    await bootTask;
    const owned=child;
    if(owned&&owned.exitCode===null){owned.kill('SIGTERM');await Promise.race([new Promise(r=>owned.once('exit',r)),new Promise(r=>setTimeout(r,3000))]);if(owned.exitCode===null)owned.kill('SIGKILL');}
    if(child===owned)child=undefined;set({state:'stopped',message:'Motor detenido.',progress:0});return {...state};
   })();
   try{return await stopPromise;}finally{stopPromise=undefined;}
  }
 };
}
