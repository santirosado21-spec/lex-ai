import {mkdir,mkdtemp,rename,readFile,writeFile,chmod,rm,lstat,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {stageBundledModel,verifyBundledModel} from '../server/bundled-model.mjs';
import {targetFromEnvironment,desktopPlan,requireBuildHost,checkBinaryArch,approvedRuntimeInventory,sourceInventory,regularFile,copyInventory,fileDigest,assertInventoryPaths,verifyCopiedInventory} from '../server/desktop-target.mjs';
export async function prepareDesktop({root=process.cwd(),env=process.env,host={platform:process.platform,arch:process.arch},run=spawnSync}={}){
 const plan=desktopPlan(targetFromEnvironment(env,host).id,{root,host});
 // Every compatibility/inventory check precedes staging-directory mutation.
 requireBuildHost(plan,host);
 if(!env.LEX_RUNTIME_INVENTORY||!env.LEX_RUNTIME_ARTIFACTS)throw Error('Define LEX_RUNTIME_INVENTORY (JSON revisado) y LEX_RUNTIME_ARTIFACTS (directorio de artefactos aprobados). No se descargan runtimes.');
 const manifest=JSON.parse(await readFile(env.LEX_RUNTIME_INVENTORY,'utf8'));
 const runtime=await approvedRuntimeInventory({manifest,source:env.LEX_RUNTIME_ARTIFACTS,plan});
 for(const file of runtime.filter(f=>f.executable||/\.(?:dylib|so)$/.test(f.path)))checkBinaryArch(file.source,plan,run);
 const tracked=run('git',['ls-files','-z','--','server','resources','office-addin'],{cwd:root,encoding:'utf8',timeout:5000,maxBuffer:4*1024*1024});
 if(tracked.status!==0)throw Error('No se pudo consultar el inventario versionado de fuentes.');
 const allowed=new Set([...sourceInventory(tracked.stdout.split('\0').filter(Boolean)),'package.json','package-lock.json']);
 if(!Array.isArray(manifest.sourceFiles)||!manifest.sourceFiles.length)throw Error('Falta inventario revisado sourceFiles con path, bytes y sha256.');
 assertInventoryPaths(manifest.sourceFiles.map(f=>f?.path));
 const sources=[];
 for(const entry of manifest.sourceFiles){
  if(!allowed.has(entry.path)||!Number.isSafeInteger(entry.bytes)||entry.bytes<0||! /^[a-f0-9]{64}$/.test(entry.sha256))throw Error('Fuente fuera del inventario revisado.');
  const source=await regularFile(root,entry.path),actual=await fileDigest(source);
  if(actual.bytes!==entry.bytes||actual.sha256!==entry.sha256)throw Error(`Fuente distinta al inventario aprobado: ${entry.path}`);
  sources.push({...entry,source});
 }
 for(const required of ['server/main.mjs','resources/model-catalog.json','office-addin/word.html','package.json','package-lock.json'])if(!sources.some(f=>f.path===required))throw Error(`Falta fuente revisada: ${required}`);
 let modelCatalog;
 if(env.LEX_BUNDLED_MODEL_SOURCE){modelCatalog=JSON.parse(await readFile(path.join(root,'resources/model-catalog.json'),'utf8'));await verifyBundledModel({bundleDir:env.LEX_BUNDLED_MODEL_SOURCE,catalog:modelCatalog});}
 const npm=run('npm',['--version'],{encoding:'utf8',timeout:5000,maxBuffer:65536});if(npm.status!==0)throw Error('Falta npm para instalar dependencias desde caché offline.');
 const parent=path.dirname(plan.output);
 for(const dir of [path.join(root,'.desktop'),parent,plan.output]){try{const info=await lstat(dir);if(info.isSymbolicLink()||!info.isDirectory())throw Error('Destino de staging no regular.');}catch(e){if(e.code!=='ENOENT')throw e;}}
 try{await lstat(plan.output);const previous=JSON.parse(await readFile(path.join(plan.output,'resources/runtime-manifest.json'),'utf8'));if(previous.schemaVersion!==2||previous.target!==plan.id)throw Error('Destino previo no es un payload del mismo destino.');}catch(e){if(e.code!=='ENOENT')throw e;else {try{await lstat(plan.output);throw Error('Destino existente sin manifiesto de payload; no se reemplaza.');}catch(missing){if(missing.code!=='ENOENT')throw missing;}}}
 await mkdir(parent,{recursive:true});
 const stage=await mkdtemp(path.join(parent,'stage-'));let backedUp=false;const previous=stage+'-previous';
 try{
  await copyInventory([...sources,...runtime],stage);
  await approvedRuntimeInventory({manifest,source:stage,plan});
  for(const f of runtime.filter(f=>f.executable))await chmod(path.join(stage,f.path),0o755);
  let bundledModel=null;
  if(env.LEX_BUNDLED_MODEL_SOURCE)bundledModel=await stageBundledModel({sourceDir:env.LEX_BUNDLED_MODEL_SOURCE,bundleDir:path.join(stage,'resources/bundled-model'),catalog:modelCatalog});
  const install=run('npm',['ci','--offline','--ignore-scripts','--bin-links=false','--omit=dev','--no-fund','--no-audit'],{cwd:stage,stdio:'inherit'});
  if(install.status!==0)throw Error('Dependencias offline no disponibles; no se realizó descarga ni se reemplazó el payload anterior.');
  async function inspect(dir){for(const entry of await readdir(dir,{withFileTypes:true})){if(entry.isDirectory())await inspect(path.join(dir,entry.name));else if(!entry.isFile())throw Error('Payload contiene enlaces o archivos especiales.');}}
  await inspect(stage);
  await verifyCopiedInventory([...sources,...runtime],stage);
  await writeFile(path.join(stage,'resources/runtime-manifest.json'),JSON.stringify({schemaVersion:2,target:plan.id,platform:plan.platform,arch:plan.arch,files:manifest.files,sourceFiles:sources.map(({path,bytes,sha256})=>({path,bytes,sha256})),bundledModel,builtAt:new Date().toISOString(),validationStatus:'staged-not-platform-validated',optionalDictation:'not-prepared'},null,2)+'\n');
  try{await rename(plan.output,previous);backedUp=true;}catch(e){if(e.code!=='ENOENT')throw e;}
  try{await rename(stage,plan.output);}catch(e){if(backedUp){await rename(previous,plan.output);backedUp=false;}throw e;}
  if(backedUp)await rm(previous,{recursive:true,force:true});
  return plan;
 }finally{await rm(stage,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{const plan=await prepareDesktop();console.log(`Payload ${plan.id}: ${plan.output}. Solo staging; no acredita arranque, privacidad, dictado ni rendimiento de 8 GB.`);}catch(e){console.error(e.message);process.exitCode=1;}
}
