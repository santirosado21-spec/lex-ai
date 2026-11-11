import path from 'node:path';
import {lstat,copyFile,mkdir,realpath} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
export const DESKTOP_TARGETS=Object.freeze({
 'mac-arm64':Object.freeze({platform:'darwin',arch:'arm64',binaryArch:'arm64',rustTarget:'aarch64-apple-darwin',node:'node',engine:'ollama'}),
 'mac-x64':Object.freeze({platform:'darwin',arch:'x64',binaryArch:'x86_64',rustTarget:'x86_64-apple-darwin',node:'node',engine:'ollama'}),
 'windows-x64':Object.freeze({platform:'win32',arch:'x64',binaryArch:'x64',rustTarget:'x86_64-pc-windows-msvc',node:'node.exe',engine:'ollama.exe'})
});
export function desktopTarget(id){if(!Object.hasOwn(DESKTOP_TARGETS,id))throw Error('Destino inválido: usa mac-arm64, mac-x64 o windows-x64.');return {id,...DESKTOP_TARGETS[id]};}
export function targetFromEnvironment(env=process.env,host={platform:process.platform,arch:process.arch}){
 if(env.LEX_TARGET_ARCH&&!env.LEX_DESKTOP_TARGET)throw Error('LEX_TARGET_ARCH fue sustituido por LEX_DESKTOP_TARGET explícito.');
 return desktopTarget(env.LEX_DESKTOP_TARGET||`${host.platform==='darwin'?'mac':host.platform==='win32'?'windows':'unsupported'}-${host.arch}`);
}
export function desktopPlan(target,{root=process.cwd(),host={platform:process.platform,arch:process.arch}}={}){
 const t=desktopTarget(target);return {...t,output:path.resolve(root,'.desktop',t.id,'app'),config:path.resolve(root,'.desktop',t.id,'tauri.conf.json'),hostCompatible:host.platform===t.platform&&host.arch===t.arch};
}
export function requireBuildHost(plan,host={platform:process.platform,arch:process.arch}){
 if(host.platform!==plan.platform||host.arch!==plan.arch)throw Error(`Destino ${plan.id}: se requiere host ${plan.platform}/${plan.arch}; no se permite empaquetado cruzado sin validar.`);
 if(plan.platform==='win32')throw Error('windows-x64: staging bloqueado; faltan validación del launcher, dependencias y runtime Windows.');
}
export function targetTauriConfig(plan){return {bundle:{resources:{[path.join(plan.output,path.sep)]:'app/'}}};}
export function checkBinaryArch(file,plan,run){
 if(plan.platform!=='darwin')throw Error('Verificación PE/Windows pendiente; no invocar lipo para Windows.');
 const r=run('/usr/bin/lipo',['-archs',file],{encoding:'utf8',timeout:5000,maxBuffer:65536});
 if(r.status!==0||!String(r.stdout).trim().split(/\s+/).includes(plan.binaryArch))throw Error(`Componente incompatible con ${plan.id}: ${path.basename(file)}`);
}
function safeRelative(file){return typeof file==='string'&&file.length>0&&!/[\x00-\x1f:]/.test(file)&&!file.includes('\\')&&!file.startsWith('/')&&file.split('/').every(p=>p&&p!=='.'&&p!=='..'&&!/[. ]$/.test(p))&&!/(^|\/)(?:\.env[^/]*|\.git|keys?(?:\.[^/]*)?|secrets?(?:\.[^/]*)?|credentials?(?:\.[^/]*)?|tokens?(?:\.[^/]*)?|cache|models|stores?|data|node_modules)(\/|$)/i.test(file);}
export async function regularFile(root,relative){
 if(!safeRelative(relative))throw Error('Ruta fuera del inventario permitido.');
 let current=path.resolve(root);if(await realpath(current)!==current)throw Error('No se permiten enlaces en ancestros del origen.');let info=await lstat(current);if(!info.isDirectory()||info.isSymbolicLink())throw Error('Origen no regular.');
 const parts=relative.split('/');for(let i=0;i<parts.length;i++){current=path.join(current,parts[i]);info=await lstat(current);if(info.isSymbolicLink()||(i===parts.length-1?!info.isFile():!info.isDirectory()))throw Error('No se permiten enlaces ni archivos especiales.');}
 return current;
}
export async function approvedRuntimeInventory({manifest,source,plan}){
 if(!manifest||manifest.schemaVersion!==1||manifest.target!==plan.id||!Array.isArray(manifest.files)||!manifest.files.length)throw Error('Falta inventario de runtime revisado para el destino (schemaVersion 1, target, files).');
 assertInventoryPaths(manifest.files.map(f=>f?.path));
 const seen=new Set();const files=[];
 for(const entry of manifest.files){
  if(!entry||! /^(?:runtime\/|resources\/runtime\/)/.test(entry.path)||!safeRelative(entry.path)||seen.has(entry.path)||!Number.isSafeInteger(entry.bytes)||entry.bytes<=0||! /^[a-f0-9]{64}$/.test(entry.sha256)||typeof entry.executable!=='boolean')throw Error('Entrada de inventario inválida.');
  const file=await regularFile(source,entry.path),info=await lstat(file),digest=createHash('sha256');
  for await(const bytes of createReadStream(file))digest.update(bytes);
  if(info.size!==entry.bytes||digest.digest('hex')!==entry.sha256)throw Error(`Artefacto distinto al inventario aprobado: ${entry.path}`);
  seen.add(entry.path);files.push({...entry,source:file});
 }
 for(const required of [`runtime/${plan.node}`,`resources/runtime/${plan.engine}`])if(!files.some(f=>f.path===required&&f.executable))throw Error(`Falta ejecutable aprobado: ${required}`);
 return files;
}
export function sourceInventory(tracked){
 return tracked.filter(file=>safeRelative(file)&&(
  /^server\/(?!.*(?:measurements|__pycache__)\/).*\.(?:mjs|json|jxa)$/.test(file)||
  /^office-addin\/[^/]+\.(?:js|css|html|xml|svg)$/.test(file)||
  /^resources\/(?!runtime-manifest\.json$|runtime\/|models\/|bundled-model\/).+\.(?:json|jsonl|sqlite|pdf|md|txt)$/.test(file)
 ));
}
export function assertInventoryPaths(paths){
 const normalized=paths.map(p=>{if(!safeRelative(p))throw Error('Ruta de inventario inválida.');return p.normalize('NFC').toLowerCase();}).sort();
 const seen=new Set();for(const file of normalized){if(seen.has(file))throw Error('Inventario contiene alias o colisión de rutas.');const parts=file.split('/');for(let i=1;i<parts.length;i++)if(seen.has(parts.slice(0,i).join('/')))throw Error('Inventario contiene alias o colisión de rutas.');seen.add(file);}
}
export async function fileDigest(file){const digest=createHash('sha256'),info=await lstat(file);if(!info.isFile()||info.isSymbolicLink())throw Error('Archivo no regular.');for await(const chunk of createReadStream(file))digest.update(chunk);return {bytes:info.size,sha256:digest.digest('hex')};}
export async function copyInventory(files,destination){
 assertInventoryPaths(files.map(f=>f.path));
 for(const file of files){const dest=path.join(destination,file.path);await mkdir(path.dirname(dest),{recursive:true});await copyFile(file.source,dest);const actual=await fileDigest(dest);if(actual.bytes!==file.bytes||actual.sha256!==file.sha256)throw Error('Archivo alterado entre inventario y copia.');}
}


export async function verifyCopiedInventory(files,destination){for(const file of files){const actual=await fileDigest(await regularFile(destination,file.path));if(actual.bytes!==file.bytes||actual.sha256!==file.sha256)throw Error('Archivo alterado en payload.');}}
