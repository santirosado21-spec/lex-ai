import {mkdir,cp,copyFile,readFile,writeFile,chmod,stat,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {sha256} from '../server/inference.mjs';
const dest=path.resolve('.desktop/app');await mkdir(dest,{recursive:true});
for(const dir of ['server','resources'])await cp(dir,path.join(dest,dir),{recursive:true,filter:p=>!p.startsWith('resources/runtime')&&!p.startsWith('resources/models')});
await mkdir(path.join(dest,'runtime'),{recursive:true});await copyFile(process.execPath,path.join(dest,'runtime/node'));await chmod(path.join(dest,'runtime/node'),0o755);
const engine=process.env.LEX_RUNTIME_SOURCE||'/Applications/Ollama.app/Contents/Resources';
await stat(path.join(engine,'ollama'));
await rm(path.join(dest,'resources/runtime'),{recursive:true,force:true});
await cp(engine,path.join(dest,'resources/runtime'),{recursive:true,dereference:true,filter:p=>!p.endsWith('.png')&&!p.endsWith('.svg')&&!p.endsWith('.icns')});
const pkg=JSON.parse(await readFile('package.json','utf8'));
// Reuse the committed lockfile; omit dev tooling instead of resolving floating runtime dependencies.
await copyFile('package.json',path.join(dest,'package.json'));
await copyFile('package-lock.json',path.join(dest,'package-lock.json'));
const install=spawnSync('npm',['ci','--omit=dev','--no-fund','--no-audit','--cache','/private/tmp/lex-npm-cache'],{cwd:dest,stdio:'inherit'});if(install.status!==0)throw Error('Runtime dependency install failed');
const hashes={node:await sha256(path.join(dest,'runtime/node')),ollama:await sha256(path.join(dest,'resources/runtime/ollama')),builtAt:new Date().toISOString(),platform:process.platform,arch:process.arch};
await writeFile(path.join(dest,'resources/runtime-manifest.json'),JSON.stringify(hashes,null,2));
console.log('Desktop resources prepared; models are downloaded and checksum-verified on initialization.');
