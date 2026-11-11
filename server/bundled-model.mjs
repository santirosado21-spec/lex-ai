import {createReadStream} from 'node:fs';
import {copyFile,lstat,mkdir,mkdtemp,readFile,readdir,rename,rm,stat,statfs,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const cancelled=signal=>signal?.throwIfAborted();
const blobPath=digest=>`blobs/${digest.replace(':','-')}`;
function policy(catalog){
 if(!catalog||!/^([a-z0-9][a-z0-9_.-]*):([a-zA-Z0-9][a-zA-Z0-9_.-]*)$/.test(catalog.id)||! /^[a-f0-9]{64}$/.test(catalog.manifestDigest)||!Number.isSafeInteger(catalog.downloadBytes)||catalog.downloadBytes<=0||catalog.downloadBytes>2_000_000_000||catalog.localOnly||catalog.manifestLayout==='v2')throw Error('El paquete no contiene un candidato de distribución autorizado.');
 const [name,tag]=catalog.id.split(':');
 return {manifestPath:`manifests/registry.ollama.ai/library/${name}/${tag}`,modernManifestPath:`manifests-v2/ollama.com/library/${name}/${tag}`};
}
async function fileHash(file,signal){
 const info=await lstat(file);if(!info.isFile()||info.isSymbolicLink())throw Error('El paquete del asistente contiene un archivo no admitido.');
 const digest=createHash('sha256');for await(const chunk of createReadStream(file,{signal}))digest.update(chunk);cancelled(signal);return digest.digest('hex');
}
async function checkedManifest(sourceDir,catalog,signal){
 const paths=policy(catalog);cancelled(signal);
 const boundedRead=async relative=>{const file=path.join(sourceDir,relative),info=await lstat(file);if(!info.isFile()||info.isSymbolicLink()||info.size>65536)throw Error('Manifiesto del asistente inválido.');return readFile(file,{signal});};
 let raw;
 try{raw=await boundedRead(blobPath(`sha256:${catalog.manifestDigest}`));}
 catch(error){if(error.code!=='ENOENT')throw error;raw=await boundedRead(paths.manifestPath);}
 if(raw.length>65536||hash(raw)!==catalog.manifestDigest)throw Error('El manifiesto incluido no coincide con la versión aprobada.');
 const manifest=JSON.parse(raw);
 if(manifest.schemaVersion!==2||!Array.isArray(manifest.layers)||manifest.layers.length>64)throw Error('Manifiesto del asistente inválido.');
 const files=[manifest.config,...manifest.layers];
 if(files.some(file=>!file||!/^sha256:[a-f0-9]{64}$/.test(file.digest)||!Number.isSafeInteger(file.size)||file.size<0)||files.reduce((total,file)=>total+file.size,0)!==catalog.downloadBytes)throw Error('Los archivos incluidos no coinciden con el tamaño aprobado.');
 const unique=new Map();for(const file of files){const prior=unique.get(file.digest);if(prior&&prior.size!==file.size)throw Error('Archivos de modelo inconsistentes.');unique.set(file.digest,file);}
 return {...paths,raw,files:[...unique.values()]};
}
async function verifyFiles(sourceDir,files,signal){
 for(const file of files){cancelled(signal);const name=path.join(sourceDir,blobPath(file.digest));if((await stat(name)).size!==file.size||await fileHash(name,signal)!==file.digest.slice(7))throw Error('Un archivo incluido del asistente está dañado.');}
}
async function directory(dir){
 await mkdir(dir,{recursive:true,mode:0o700});const info=await lstat(dir);if(!info.isDirectory()||info.isSymbolicLink())throw Error('El almacén del asistente no admite enlaces de directorio.');
}
async function safeParent(root,relative){
 await directory(root);let current=root;for(const part of path.dirname(relative).split(path.sep)){if(part==='.')continue;current=path.join(current,part);await directory(current);}
}
async function atomicWrite(root,relative,bytes,signal){
 cancelled(signal);await safeParent(root,relative);const destination=path.join(root,relative),temporary=`${destination}.${randomUUID()}.partial`;
 try{await writeFile(temporary,bytes,{mode:0o600,flag:'wx',signal});cancelled(signal);await rename(temporary,destination);}finally{await rm(temporary,{force:true});}
}
async function atomicCopy(root,relative,source,signal){
 cancelled(signal);await safeParent(root,relative);const destination=path.join(root,relative),temporary=`${destination}.${randomUUID()}.partial`;
 try{await copyFile(source,temporary);cancelled(signal);await rename(temporary,destination);}finally{await rm(temporary,{force:true});}
}

/** Build-only: include a digest allowlist, never the source store's other models. */
export async function stageBundledModel({sourceDir,bundleDir,catalog,signal}){
 const sourceRoot=path.resolve(sourceDir),bundleRoot=path.resolve(bundleDir);
 if(sourceRoot===bundleRoot||sourceRoot.startsWith(bundleRoot+path.sep)||bundleRoot.startsWith(sourceRoot+path.sep))throw Error('El origen y destino del modelo deben ser distintos y estar separados.');
 const approved=await checkedManifest(sourceDir,catalog,signal);await verifyFiles(sourceDir,approved.files,signal);
 await mkdir(path.dirname(bundleDir),{recursive:true});const staging=await mkdtemp(path.join(path.dirname(bundleDir),'.bundled-model-'));
 try{
  for(const file of approved.files){cancelled(signal);await atomicCopy(staging,blobPath(file.digest),path.join(sourceDir,blobPath(file.digest)),signal);}
  await atomicWrite(staging,blobPath(`sha256:${catalog.manifestDigest}`),approved.raw,signal);
  await atomicWrite(staging,approved.manifestPath,approved.raw,signal);
  await atomicWrite(staging,approved.modernManifestPath,approved.raw,signal);
  await writeFile(path.join(staging,'bundle.json'),JSON.stringify({schemaVersion:1,modelId:catalog.id,manifestDigest:catalog.manifestDigest,bytes:catalog.downloadBytes,license:catalog.license,licenseUrl:catalog.licenseUrl,sourceUrl:catalog.sourceUrl},null,2)+'\n');
  // Only this generated bundle is replaced; source caches and user stores are untouched.
  await verifyFiles(staging,approved.files,signal);
  cancelled(signal);await rm(bundleDir,{recursive:true,force:true});await rename(staging,bundleDir);
 }finally{await rm(staging,{recursive:true,force:true});}
 return {available:true,files:approved.files.length+3,bytes:catalog.downloadBytes};
}

export async function verifyBundledModel({bundleDir,catalog,signal}){
 const approved=await checkedManifest(bundleDir,catalog,signal);await verifyFiles(bundleDir,approved.files,signal);
 for(const relative of [approved.manifestPath,approved.modernManifestPath])if(!(await readFile(path.join(bundleDir,relative))).equals(approved.raw))throw Error('El índice incluido no coincide con el manifiesto aprobado.');
 const allowed=new Set([...approved.files.map(file=>blobPath(file.digest)),blobPath(`sha256:${catalog.manifestDigest}`),approved.manifestPath,approved.modernManifestPath,'bundle.json']);
 async function inspect(relative=''){
  for(const entry of await readdir(path.join(bundleDir,relative),{withFileTypes:true})){cancelled(signal);const file=path.join(relative,entry.name);if(entry.isDirectory())await inspect(file);else if(!entry.isFile()||!allowed.has(file))throw Error('El paquete incluye archivos ajenos al candidato aprobado.');}
 }
 await inspect();
 return {available:true,files:approved.files.length+3,bytes:catalog.downloadBytes};
}

/** Seed a writable per-user store from the verified, offline distribution. */
export async function ensureBundledModel({bundleDir,modelsDir,catalog,signal,reserveBytes=0,dependencies={}}){
 if(!Number.isSafeInteger(reserveBytes)||reserveBytes<0)throw Error('Reserva de espacio del asistente inválida.');
 policy(catalog);cancelled(signal);
 try{const info=await lstat(bundleDir);if(!info.isDirectory()||info.isSymbolicLink())throw Error('Paquete del asistente inválido.');}catch(error){if(error.code==='ENOENT')return {available:false,seeded:false,files:0,bytes:0,bytesNeeded:0};throw error;}
 const approved=await checkedManifest(bundleDir,catalog,signal);await verifyFiles(bundleDir,approved.files,signal);
 // Plan once without creating or modifying the user store. Atomic replacement
 // needs the full new file temporarily even when a damaged prior copy exists.
 const copies=[],writes=[];
 for(const file of approved.files){
  cancelled(signal);
  const relative=blobPath(file.digest),destination=path.join(modelsDir,relative);let valid=false;
  try{valid=(await lstat(destination)).isFile()&&(await stat(destination)).size===file.size&&await fileHash(destination,signal)===file.digest.slice(7);}catch(error){if(signal?.aborted)throw error;if(error.code!=='ENOENT'&&!error.message.includes('archivo no admitido'))throw error;}
  if(!valid)copies.push({relative,size:file.size});
 }
 // Restore both tag formats so a stale migrated index cannot shadow approved weights.
 for(const relative of [blobPath(`sha256:${catalog.manifestDigest}`),approved.manifestPath,approved.modernManifestPath]){
  cancelled(signal);let matches=false;
  try{const destination=path.join(modelsDir,relative),info=await lstat(destination);matches=info.isFile()&&!info.isSymbolicLink()&&info.size===approved.raw.length&&(await readFile(destination,{signal})).equals(approved.raw);}catch(error){if(error.code!=='ENOENT')throw error;}
  if(!matches)writes.push(relative);
 }
 const bytesNeeded=copies.reduce((total,file)=>total+file.size,0)+writes.length*approved.raw.length,requiredBytes=bytesNeeded+reserveBytes;
 if(!Number.isSafeInteger(requiredBytes))throw Error('Reserva de espacio del asistente inválida.');
 let probe=path.resolve(modelsDir),disk;
 while(true){
  cancelled(signal);try{disk=await (dependencies.statfs||statfs)(probe);break;}catch(error){if(error.code!=='ENOENT'||path.dirname(probe)===probe)throw error;probe=path.dirname(probe);}
 }
 const availableBytes=Number(disk.bavail)*Number(disk.bsize);
 if(!Number.isFinite(availableBytes)||availableBytes<0)throw Error('No se pudo comprobar el espacio en disco.');
 if(availableBytes<requiredBytes)throw Error(`Se necesitan ${(requiredBytes/1024**3).toFixed(1)} GB libres en disco para preparar Rejon.AI y conservar el espacio de trabajo. Libera espacio y vuelve a intentarlo.`);
 for(const file of copies)await atomicCopy(modelsDir,file.relative,path.join(bundleDir,file.relative),signal);
 for(const relative of writes)await atomicWrite(modelsDir,relative,approved.raw,signal);
 return {available:true,seeded:copies.length+writes.length>0,files:approved.files.length+3,bytes:catalog.downloadBytes,bytesNeeded};
}
