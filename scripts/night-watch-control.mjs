import {spawnSync} from 'node:child_process';
import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(root,'artifacts/night-watch'),label='mx.lexai.nightwatch',domain=`gui/${process.getuid()}`,target=`${domain}/${label}`;
const cmd=process.argv[2]||'status';
const xml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const launch=(...args)=>spawnSync('/bin/launchctl',args,{encoding:'utf8'});
await mkdir(dir,{recursive:true});
if(cmd==='start'){
 if(process.platform!=='darwin')throw Error('Este instalador del monitor requiere macOS.');
 const current=launch('print',target);if(current.status===0)throw Error('El job ya está cargado. Consulta status; usa unload antes de iniciarlo otra vez.');
 // Only reclaim our own stale lock when its process is demonstrably absent.
 let owner;try{owner=JSON.parse(await readFile(path.join(dir,'lock/owner.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(owner){if(!Number.isInteger(owner.pid)||owner.pid<1)throw Error('Bloqueo no válido; revisar manualmente.');try{process.kill(owner.pid,0);throw Error('Otro proceso conserva el bloqueo del monitor.');}catch(e){if(e.code!=='ESRCH')throw e;}await rm(path.join(dir,'lock'),{recursive:true});}
 await rm(path.join(dir,'STOP'),{force:true});
 const args=['/usr/bin/caffeinate','-i',process.execPath,path.join(root,'scripts/night-watch.mjs'),'--hours','12','--interval','45','--cycles','16','--real-inference'];
 // User-requested validation loads large local weights. Standard preserves
 // normal launchd limits; a Background run reached the five-minute timeout.
 const plist=`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Label</key><string>${label}</string><key>ProgramArguments</key><array>${args.map(x=>`<string>${xml(x)}</string>`).join('')}</array><key>WorkingDirectory</key><string>${xml(root)}</string><key>EnvironmentVariables</key><dict><key>PATH</key><string>${xml(path.dirname(process.execPath)+':'+path.join(os.homedir(),'.local/bin')+':/usr/bin:/bin:/usr/sbin:/sbin')}</string></dict><key>RunAtLoad</key><true/><key>ProcessType</key><string>Standard</string><key>StandardOutPath</key><string>${xml(path.join(dir,'launchd.log'))}</string><key>StandardErrorPath</key><string>${xml(path.join(dir,'launchd-error.log'))}</string></dict></plist>`;
 const file=path.join(dir,'launchagent.plist');await writeFile(file,plist,{mode:0o600});
 const r=launch('bootstrap',domain,file);if(r.status!==0)throw Error(`launchctl: ${r.stderr||r.stdout}`);
 console.log('Monitor iniciado en launchd durante un máximo de 12 horas. Consulta npm run watch:status.');
}else if(cmd==='stop'){
 await writeFile(path.join(dir,'STOP'),new Date().toISOString());console.log('Parada solicitada. El supervisor cancela el trabajo en un máximo de 5 segundos.');
}else if(cmd==='unload'){
 await writeFile(path.join(dir,'STOP'),new Date().toISOString());const r=launch('bootout',target);if(r.status!==0)throw Error(r.stderr||r.stdout);console.log('Job del monitor descargado de launchd. Los resultados se conservan.');
}else if(cmd==='status'){
 let status=null;try{status=JSON.parse(await readFile(path.join(dir,'status.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const job=launch('print',target);let processAlive=false,processCheckRestricted=false;if(status?.pid)try{process.kill(status.pid,0);processAlive=true;}catch(e){if(e.code==='EPERM'){processAlive=true;processCheckRestricted=true;}}
 console.log(JSON.stringify({loaded:job.status===0,processAlive,processCheckRestricted,status},null,2));
}else throw Error('Uso: night-watch-control.mjs start|status|stop|unload');
