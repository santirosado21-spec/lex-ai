import {copyFile,chmod,mkdir,readdir,readFile,readlink,realpath,symlink,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const destination=path.resolve(process.argv[2]||'.desktop/app/resources/runtime/whisper');
const run=(command,args,options={})=>execFileSync(command,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],...options});
const prefix=name=>run('brew',['--prefix',name]).trim();
const resolveLink=async source=>{let value=source;while(true){try{const link=await readlink(value);value=path.resolve(path.dirname(value),link);}catch{return value;}}};
const copy=async(source,target=path.basename(source))=>{const file=await resolveLink(source);if(!existsSync(file))throw Error(`Falta dependencia de dictado: ${source}`);await copyFile(file,path.join(destination,target));};
const cellar=async name=>realpath(prefix(name));
const cpuBackend=()=>/apple m1/i.test(os.cpus()[0]?.model||'')?'libggml-cpu-apple_m1.so':/apple m2|apple m3/i.test(os.cpus()[0]?.model||'')?'libggml-cpu-apple_m2_m3.so':'libggml-cpu-apple_m4.so';
if(process.platform!=='darwin')throw Error('El empaquetado de dictado solo está preparado para macOS.');
const whisper=await cellar('whisper-cpp'),ggml=await cellar('ggml'),libomp=await cellar('libomp');
for(const source of [path.join(whisper,'bin/whisper-cli'),path.join(whisper,'lib/libwhisper.1.dylib'),path.join(ggml,'lib/libggml.0.dylib'),path.join(ggml,'lib/libggml-base.0.dylib'),path.join(libomp,'lib/libomp.dylib')])if(!existsSync(source))throw Error(`No se encontró ${source}. Instala la dependencia local antes de empaquetar.`);
await mkdir(path.join(destination,'lib'),{recursive:true,mode:0o755});await mkdir(path.join(destination,'libexec'),{recursive:true,mode:0o755});
await copy(path.join(whisper,'bin/whisper-cli'));
for(const source of [path.join(whisper,'lib/libwhisper.1.dylib'),path.join(ggml,'lib/libggml.0.dylib'),path.join(ggml,'lib/libggml-base.0.dylib'),path.join(libomp,'lib/libomp.dylib')])await copy(source,path.join('lib',path.basename(await resolveLink(source))));
for(const source of await readdir(path.join(ggml,'libexec')))if(source.endsWith('.so'))await copy(path.join(ggml,'libexec',source),path.join('libexec',source));
for(const [link,target] of [['libwhisper.1.dylib','libwhisper.1.9.2.dylib'],['libggml.0.dylib','libggml.0.19.0.dylib'],['libggml-base.0.dylib','libggml-base.0.19.0.dylib']]){const targetFile=path.join(destination,'lib',target);if(!existsSync(targetFile))throw Error(`No se copió ${target}.`);const linkFile=path.join(destination,'lib',link);if(!existsSync(linkFile))await symlink(target,linkFile);}
// Homebrew compiles this path into libggml as a default backend search path. Clear it before signing: the runtime receives an explicit, bundled backend list below.
const defaultBackend=Buffer.from(path.join(ggml,'libexec')),ggmlLibrary=path.join(destination,'lib','libggml.0.19.0.dylib');await chmod(ggmlLibrary,0o755);const ggmlBytes=await readFile(ggmlLibrary),embedded=ggmlBytes.indexOf(defaultBackend);if(embedded<0)throw Error('No se pudo localizar la ruta de backend de Homebrew para aislarla.');ggmlBytes.fill(0,embedded,embedded+defaultBackend.length);await writeFile(ggmlLibrary,ggmlBytes);
const binaries=[path.join(destination,'whisper-cli'),...['libwhisper.1.9.2.dylib','libggml.0.19.0.dylib','libggml-base.0.19.0.dylib','libomp.dylib'].map(name=>path.join(destination,'lib',name)),...(await readdir(path.join(destination,'libexec'))).filter(name=>name.endsWith('.so')).map(name=>path.join(destination,'libexec',name))];
for(const file of binaries){
 await chmod(file,0o755);
 const linked=run('otool',['-L',file]).split('\n').slice(1).map(line=>line.trim().split(' ')[0]).filter(value=>value.startsWith('/opt/homebrew/'));
 for(const old of linked)run('install_name_tool',['-change',old,`@rpath/${path.basename(old)}`,file]);
 const rpathLines=run('otool',['-l',file]).split('\n').filter(line=>line.trim().startsWith('path ')).map(line=>line.trim().split(' ')[1]);
 for(const old of rpathLines.filter(value=>value.startsWith('/opt/homebrew/')))run('install_name_tool',['-delete_rpath',old,file]);
 if(file!==path.join(destination,'whisper-cli'))run('install_name_tool',['-id',`@rpath/${path.basename(file)}`,file]);
 const wantedRpath=file===path.join(destination,'whisper-cli')?'@loader_path/lib':file.includes(`${path.sep}libexec${path.sep}`)?'@loader_path/../lib':'@loader_path';if(!rpathLines.includes(wantedRpath))run('install_name_tool',['-add_rpath',wantedRpath,file]);
 run('codesign',['--force','--sign','-',file]);
}
for(const file of binaries){const report=`${run('otool',['-L',file])}\n${run('otool',['-l',file])}`;if(report.includes('/opt/homebrew/')||run('strings',[file]).includes('/opt/homebrew/'))throw Error(`Quedó una dependencia absoluta en ${file}.`);}
const check=run(path.join(destination,'whisper-cli'),['--version'],{env:{...process.env,DYLD_LIBRARY_PATH:path.join(destination,'lib'),GGML_BACKEND_PATH:path.join(destination,'libexec',cpuBackend())}});if(!check.trim())throw Error('No se pudo ejecutar el binario de dictado empaquetado.');
console.log(`Dictado local preparado en ${destination}.`);
await writeFile(path.join(destination,'runtime.json'),JSON.stringify({supportedArchs:[process.arch]}));
