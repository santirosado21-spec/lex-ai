import { createHash, randomUUID } from 'node:crypto';
import { spawn as nativeSpawn } from 'node:child_process';
import { access, mkdir, open, readFile, rename, stat, unlink } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { availableMemory } from './runtime-memory.mjs';

const MiB=1024*1024, GiB=1024**3;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const sttCatalog={
  'small-q5_1':{file:'ggml-small-q5_1.bin',bytes:190085487,sha256:'ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb',minFreeMemoryGB:1.5,default:true},
  base:{file:'ggml-base.bin',bytes:147951465,sha256:'60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe',minFreeMemoryGB:1}
};
const modelUrl=model=>`https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${model.file}`;
const cpuBackend=()=>/apple m1/i.test(os.cpus()[0]?.model||'')?'libggml-cpu-apple_m1.so':/apple m2|apple m3/i.test(os.cpus()[0]?.model||'')?'libggml-cpu-apple_m2_m3.so':'libggml-cpu-apple_m4.so';
const safeText=value=>String(value).replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,12000);

export async function sha256(file){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}
export function validateWav(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length<44||bytes.length>4*MiB)throw Error('El audio debe ser un archivo WAV de hasta 4 MB.');
 if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE')throw Error('El dictado requiere audio WAV.');
 let offset=12,fmt,dataLength=0;
 while(offset+8<=bytes.length){const id=bytes.toString('ascii',offset,offset+4),size=bytes.readUInt32LE(offset+4);offset+=8;if(size>bytes.length-offset)throw Error('El archivo WAV no es válido.');if(id==='fmt '&&size>=16)fmt={format:bytes.readUInt16LE(offset),channels:bytes.readUInt16LE(offset+2),sampleRate:bytes.readUInt32LE(offset+4),bits:bytes.readUInt16LE(offset+14)};if(id==='data')dataLength=size;offset+=size+(size%2);}
 if(!fmt||!dataLength||fmt.format!==1||fmt.channels!==1||fmt.sampleRate!==16000||fmt.bits!==16)throw Error('El dictado requiere WAV PCM mono de 16 kHz.');
 return {durationMs:Math.round(dataLength/(16000*2)*1000)};
}

// All dependencies are injectable so this module can be tested without audio, a network or a subprocess.
export function createStt({dataDir,runtimeDir=process.env.LEX_WHISPER_RUNTIME||path.join(root,'resources/runtime/whisper'),modelsDir=process.env.LEX_WHISPER_MODELS_DIR||path.join(dataDir,'whisper'),catalog=sttCatalog,timeoutMs=60_000,dependencies={}}={}){
 if(!dataDir)throw Error('Falta el directorio de datos para dictado.');
 if(!Number.isInteger(timeoutMs)||timeoutMs<1)throw Error('Tiempo máximo de dictado inválido.');
 const deps={spawn:nativeSpawn,fetch:globalThis.fetch,memory:availableMemory,sha256,arch:()=>os.arch(),...dependencies};
 const entries=new Map(Object.entries(catalog));
 if(!entries.size||[...entries.values()].some(model=>!model||typeof model.file!=='string'||!Number.isSafeInteger(model.bytes)||model.bytes<1||!/^[a-f0-9]{64}$/.test(model.sha256)||!Number.isFinite(model.minFreeMemoryGB)))throw Error('Catálogo de dictado inválido.');
 const defaultId=[...entries].find(([,model])=>model.default)?.[0]||entries.keys().next().value;
 let selected=defaultId,busy=false,controller=null,task=null;
 let state={state:'stopped',selectedModel:selected,progress:0,message:'Activa dictado para descargar el reconocimiento de voz en este equipo.'};
 const set=next=>{state={...state,...next,selectedModel:selected};};
 const model=()=>entries.get(selected);
 const modelPath=()=>path.join(modelsDir,model().file);
 const binary=()=>path.join(runtimeDir,'whisper-cli');
 async function runtimeAvailable(){try{await access(binary());try{const metadata=JSON.parse(await readFile(path.join(runtimeDir,'runtime.json'),'utf8'));return Array.isArray(metadata.supportedArchs)&&metadata.supportedArchs.includes(deps.arch());}catch(error){if(error.code!=='ENOENT')return false;}return true;}catch{return false;}}
 async function installed(){try{return (await stat(modelPath())).size===model().bytes;}catch{return false;}}
 async function status(){const [ready,available]=await Promise.all([installed(),runtimeAvailable()]);return {...state,ready:available&&ready&&state.state==='ready',installed:ready,models:[...entries].map(([id,value])=>({id,default:Boolean(value.default),downloadBytes:value.bytes,minFreeMemoryGB:value.minFreeMemoryGB,active:id===selected})),runtimeAvailable:available,busy};}
 async function verify(file=modelPath()){const info=await stat(file);if(info.size!==model().bytes||await deps.sha256(file)!==model().sha256)throw Error('La descarga de dictado no superó la comprobación de integridad.');}
 async function download(){
  await mkdir(modelsDir,{recursive:true,mode:0o700});const target=modelPath(),partial=`${target}.part`;let received=0;
  try{received=(await stat(partial)).size;}catch{/* no resumable bytes yet */}
  if(received>model().bytes){await unlink(partial);received=0;}
  set({state:'downloading',progress:Math.floor(received/model().bytes*100),message:'Descargando dictado. Puedes cancelar y continuar después.'});
  let response=await deps.fetch(modelUrl(model()),{headers:received?{Range:`bytes=${received}-`}:{},signal:controller.signal,redirect:'error'});
  if(received&&response.status===200){await unlink(partial);received=0;response=await deps.fetch(modelUrl(model()),{signal:controller.signal,redirect:'error'});}
  if(!response.ok||!response.body)throw Error('No se pudo descargar dictado desde la fuente aprobada.');
  const length=Number(response.headers?.get?.('content-length'));if(Number.isFinite(length)&&length>model().bytes-received)throw Error('La descarga de dictado excede el tamaño aprobado.');
  const handle=await open(partial,received?'a':'w',0o600);
  try{for await(const chunk of response.body){if(controller.signal.aborted)throw new DOMException('cancelled','AbortError');received+=chunk.length;if(received>model().bytes)throw Error('La descarga de dictado excede el tamaño aprobado.');await handle.write(chunk);set({progress:Math.min(99,Math.floor(received/model().bytes*100))});}}finally{await handle.close();}
  if(received!==model().bytes)throw Error('La descarga de dictado quedó incompleta.');
  await verify(partial);await rename(partial,target);await verify(target);
 }
 async function initialize(payload={}){
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.keys(payload).some(key=>key!=='model'&&key!=='cancel'))throw Error('Parámetros de dictado inválidos.');
  if(payload.cancel===true){controller?.abort();return status();}
  if(busy)return status();
  if(!await runtimeAvailable())throw Error('El dictado no está disponible en este equipo. Puedes conversar por escrito.');
  if(payload.model!==undefined){if(typeof payload.model!=='string'||!entries.has(payload.model))throw Error('Opción de dictado no admitida.');selected=payload.model;}
  if(await installed()){try{await verify();set({state:'ready',progress:100,message:'Dictado está listo en este equipo.'});return status();}catch{set({state:'error',message:'El archivo de dictado no superó la comprobación de integridad.'});throw Error(state.message);}}
  await access(binary()).catch(()=>{throw Error('El componente local de dictado no está disponible en esta instalación.');});
  busy=true;controller=new AbortController();task=(async()=>{try{await download();set({state:'ready',progress:100,message:'Dictado está listo en este equipo.'});}catch(error){set({state:'stopped',progress:0,message:error?.name==='AbortError'?'Descarga de dictado cancelada. Puedes continuar después.':error.message||'No se pudo preparar dictado.'});}finally{busy=false;controller=null;}})();
  return status();
 }
 async function checkMemory(){const memory=await deps.memory(),floor=model().minFreeMemoryGB*GiB;if(!Number.isFinite(memory.availableBytes)||memory.availableBytes<floor)throw Error(`Libera al menos ${model().minFreeMemoryGB} GB de RAM disponible antes de usar dictado.`);return memory;}
 async function transcribe(payload={}){
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.keys(payload).length!==1||typeof payload.audioBase64!=='string'||payload.audioBase64.length>6*MiB)throw Error('Audio de dictado inválido.');
  if(!await runtimeAvailable())throw Error('El dictado no está disponible en este equipo. Puedes conversar por escrito.');
  if(busy)throw Error('Ya hay una operación de dictado en curso.');busy=true;const tempDir=path.join(dataDir,'dictation-tmp');let temp,child,timer;
  try{if(!(await installed()))throw Error('Activa dictado en Configuración antes de grabar.');await verify();await access(binary());let audio;try{audio=Buffer.from(payload.audioBase64,'base64');}catch{throw Error('Audio de dictado inválido.');}validateWav(audio);await checkMemory();await mkdir(tempDir,{recursive:true,mode:0o700});temp=path.join(tempDir,`${randomUUID()}.wav`);const file=await open(temp,'wx',0o600);try{await file.writeFile(audio);}finally{await file.close();}
   const text=await new Promise((resolve,reject)=>{let output='',finished=false;const finish=(error,value)=>{if(finished)return;finished=true;clearTimeout(timer);error?reject(error):resolve(value);};
    child=deps.spawn(binary(),['-m',modelPath(),'-l','es','-nt','-np','-f',temp],{shell:false,stdio:['ignore','pipe','pipe'],env:{PATH:'/usr/bin:/bin',HOME:dataDir,TMPDIR:tempDir,DYLD_LIBRARY_PATH:path.join(runtimeDir,'lib'),GGML_BACKEND_PATH:path.join(runtimeDir,'libexec',cpuBackend())}});
    child.stdout?.on('data',chunk=>{output+=Buffer.from(chunk).toString('utf8');if(output.length>65536){child.kill('SIGTERM');finish(Error('La transcripción devolvió demasiado texto.'));}});child.stderr?.on('data',()=>{});child.once('error',()=>finish(Error('No se pudo iniciar dictado local.')));child.once('exit',code=>code===0?finish(null,output):finish(Error('Dictado no pudo completar la transcripción.')));timer=setTimeout(()=>{child.kill('SIGTERM');finish(Error('El dictado excedió el tiempo máximo de 60 segundos.'));},timeoutMs);
   });
   return {text:safeText(text)};
  }finally{clearTimeout(timer);if(temp)await unlink(temp).catch(()=>{});busy=false;}
 }
 return {status,initialize,transcribe};
}
