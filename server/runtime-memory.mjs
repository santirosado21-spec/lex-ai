import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import os from 'node:os';
const exec=promisify(execFile);
// Apple: https://developer.apple.com/library/archive/documentation/Performance/Conceptual/ManagingMemory/Articles/AboutMemory.html
// Inactive pages can be reclaimed, but may need paging. Credit only half as a
// conservative policy estimate, not an OS promise of immediately available RAM.
// Do not add purgeable/file-backed/speculative counters: these can overlap.
// https://github.com/apple-oss-distributions/xnu/blob/main/osfmk/mach/vm_statistics.h
export function parseVmMemory(text,totalBytes){
 const pageSize=Number(text.match(/page size of (\d+) bytes/)?.[1]);
 const count=name=>Number(text.match(new RegExp(`^${name}:\\s+(\\d+)\\.`, 'm'))?.[1]);
 const free=count('Pages free'),inactive=count('Pages inactive');
 if(![4096,16384].includes(pageSize)||![free,inactive].every(n=>Number.isSafeInteger(n)&&n>=0)||!Number.isFinite(totalBytes)||totalBytes<=0||(free+inactive)*pageSize>totalBytes)throw Error('No se pudo medir la memoria disponible.');
 return {freeBytes:free*pageSize,availableBytes:(free+Math.floor(inactive/2))*pageSize,reclaimableCreditBytes:Math.floor(inactive/2)*pageSize,method:'vm_stat-free-plus-half-inactive',estimated:true};
}
export async function availableMemory(){
 if(os.platform()!=='darwin'){const freeBytes=os.freemem();return {freeBytes,availableBytes:freeBytes,method:'os-free',estimated:false};}
 const {stdout}=await exec('/usr/bin/vm_stat',[],{timeout:2000,maxBuffer:65536,env:{PATH:'/usr/bin:/bin',LC_ALL:'C'}});
 return parseVmMemory(stdout,os.totalmem());
}
export function parseProcessTreeRss(text,rootPid){
 if(!Number.isInteger(rootPid)||rootPid<=0)throw Error('PID del motor inválido.');
 const rows=text.trim().split('\n').filter(Boolean).map(line=>{const parts=line.trim().split(/\s+/).map(Number);if(parts.length!==3||parts.some(n=>!Number.isSafeInteger(n)||n<0))throw Error('No se pudo medir RSS.');return {pid:parts[0],ppid:parts[1],rss:parts[2]*1024};});
 if(!rows.some(r=>r.pid===rootPid))throw Error('El motor no aparece en la medición RSS.');
 const owned=new Set([rootPid]);let changed=true;while(changed){changed=false;for(const r of rows)if(owned.has(r.ppid)&&!owned.has(r.pid)){owned.add(r.pid);changed=true;}}
 // Shared pages may be counted more than once: intentionally conservative.
 return rows.filter(r=>owned.has(r.pid)).reduce((n,r)=>n+r.rss,0);
}
export async function processTreeRss(pid){const {stdout}=await exec('/bin/ps',['-axo','pid=,ppid=,rss='],{timeout:2000,maxBuffer:4*1024*1024,env:{PATH:'/usr/bin:/bin',LC_ALL:'C'}});return parseProcessTreeRss(stdout,pid);}
