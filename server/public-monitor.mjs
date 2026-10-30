import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const defaultMonitorDir=()=>process.env.LEX_MONITOR_DIR||path.join(os.homedir(),'Library/Application Support/LEX AI/public-monitor');
async function readJSON(file,optional=false){
 try{if((await stat(file)).size>2*1024*1024)throw Error('El registro público supera el límite de lectura.');return JSON.parse(await readFile(file,'utf8'));}
 catch(e){if(optional&&e.code==='ENOENT')return null;throw e;}
}
export async function publicMonitorStatus({monitorDir=defaultMonitorDir(),resourceDir=path.join(root,'resources'),now=Date.now()}={}){
 const [catalog,corpus,published]=await Promise.all([readJSON(path.join(resourceDir,'legal-sources.json')),readJSON(path.join(resourceDir,'legal-corpus.json')),readJSON(path.join(monitorDir,'status.json'),true)]);
 const monitor=published?.monitor&&typeof published.monitor==='object'?{...published.monitor}:null;
 if(monitor){const heartbeat=Date.parse(monitor.heartbeatAt);monitor.stale=!Number.isFinite(heartbeat)||now-heartbeat>120_000; if(monitor.stale&&['running','waiting'].includes(monitor.state))monitor.state='unresponsive';}
 return {catalog:Array.isArray(catalog)?catalog:catalog.sources||[],corpus:{articles:corpus.length,laws:new Set(corpus.map(x=>x.name||x.title)).size},sync:published?.sync||null,monitor,repositories:published?.repositories||null};
}
