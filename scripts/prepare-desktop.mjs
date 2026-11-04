import {mkdir,mkdtemp,rename,cp,copyFile,readFile,writeFile,chmod,stat,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {sha256} from '../server/inference.mjs';
import {stageBundledModel} from '../server/bundled-model.mjs';
const output=path.resolve('.desktop/app');
await mkdir(path.dirname(output),{recursive:true});
const dest=await mkdtemp(path.join(path.dirname(output),'stage-'));
for(const dir of ['server','resources','office-addin'])await cp(dir,path.join(dest,dir),{recursive:true,filter:p=>!p.startsWith('resources/runtime')&&!p.startsWith('resources/models')});
const targetArch=process.env.LEX_TARGET_ARCH||process.arch;
if(!['arm64','x64','universal'].includes(targetArch))throw Error('Arquitectura de escritorio inválida.');
const nodeSource=process.env.LEX_NODE_SOURCE||process.execPath;
const requiredArchs=targetArch==='universal'?['arm64','x86_64']:[targetArch==='x64'?'x86_64':'arm64'];
const checkArch=file=>{const result=spawnSync('/usr/bin/lipo',['-archs',file],{encoding:'utf8'});if(result.status!==0||requiredArchs.some(arch=>!result.stdout.trim().split(/\s+/).includes(arch)))throw Error(`El componente no admite el destino ${targetArch}: ${path.basename(file)}`);};
checkArch(nodeSource);
await mkdir(path.join(dest,'runtime'),{recursive:true});await copyFile(nodeSource,path.join(dest,'runtime/node'));await chmod(path.join(dest,'runtime/node'),0o755);
const engine=process.env.LEX_RUNTIME_SOURCE||'/Applications/Ollama.app/Contents/Resources';
await stat(path.join(engine,'ollama'));
checkArch(path.join(engine,'ollama'));
await rm(path.join(dest,'resources/runtime'),{recursive:true,force:true});
await cp(engine,path.join(dest,'resources/runtime'),{recursive:true,dereference:true,filter:p=>!p.endsWith('.png')&&!p.endsWith('.svg')&&!p.endsWith('.icns')});
const whisper=spawnSync(process.execPath,['scripts/prepare-whisper.mjs',path.join(dest,'resources/runtime','whisper')],{stdio:'inherit'});if(whisper.status!==0)throw Error('No se pudo preparar dictado local.');
const pkg=JSON.parse(await readFile('package.json','utf8'));
const catalog=JSON.parse(await readFile('resources/model-catalog.json','utf8'));
const modelSource=process.env.LEX_BUNDLED_MODEL_SOURCE||path.join(os.homedir(),'Library/Application Support/mx.lexai.desktop/models');
const bundledModel=await stageBundledModel({sourceDir:modelSource,bundleDir:path.join(dest,'resources/bundled-model'),catalog});
// Reuse the committed lockfile; omit dev tooling instead of resolving floating runtime dependencies.
await copyFile('package.json',path.join(dest,'package.json'));
await copyFile('package-lock.json',path.join(dest,'package-lock.json'));
const install=spawnSync('npm',['ci','--omit=dev','--no-fund','--no-audit','--cache','/private/tmp/lex-npm-cache'],{cwd:dest,stdio:'inherit'});if(install.status!==0)throw Error('Runtime dependency install failed');
const hashes={node:await sha256(path.join(dest,'runtime/node')),ollama:await sha256(path.join(dest,'resources/runtime/ollama')),bundledModel:{manifestDigest:catalog.manifestDigest,bytes:bundledModel.bytes},builtAt:new Date().toISOString(),platform:process.platform,arch:targetArch};
await writeFile(path.join(dest,'resources/runtime-manifest.json'),JSON.stringify(hashes,null,2));
// Only a complete staging tree becomes the next app payload. This also prevents
// orphaned resources from previous builds from being shipped in the bundle.
const previous=dest+'-previous';
let backedUp=false;
try {await rename(output,previous);backedUp=true;} catch(error){if(error.code!=='ENOENT')throw error;}
try {await rename(dest,output);}catch(error){if(backedUp)await rename(previous,output);throw error;}
if(backedUp)await rm(previous,{recursive:true,force:true,maxRetries:3,retryDelay:100});
console.log('Desktop resources prepared with the pinned lightweight model and a private engine; no separate runtime install or model download is required.');
