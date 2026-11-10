import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import os from 'node:os';
import {windowsProcessTreeRss} from './windows-process-memory.mjs';
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
// macOS keeps almost all RAM as inactive/compressed/cached on purpose, so counting only free + half of
// inactive pages badly under-reports usable memory (a 24 GB Mac with 43 % free was read as 2.6 GB).
// kern.memorystatus_level is the kernel's own "percentage of memory available" figure, the same one
// `memory_pressure` prints. The 3 GB minimum is unchanged; only the measurement is more faithful.
export function parseMemoryLevel(text,totalBytes){
 const raw=String(text).trim();
 const level=Number(raw);
 if(!/^\d{1,3}$/.test(raw)||!Number.isInteger(level)||level<0||level>100||!Number.isFinite(totalBytes)||totalBytes<=0)throw Error('No se pudo medir el nivel de memoria.');
 return Math.floor(totalBytes*level/100);
}
export async function availableMemory(){
 if(os.platform()!=='darwin'){const freeBytes=os.freemem();return {freeBytes,availableBytes:freeBytes,method:'os-free',estimated:false};}
 const {stdout}=await exec('/usr/bin/vm_stat',[],{timeout:2000,maxBuffer:65536,env:{PATH:'/usr/bin:/bin',LC_ALL:'C'}});
 const vm=parseVmMemory(stdout,os.totalmem());
 try{
  const {stdout:level}=await exec('/usr/sbin/sysctl',['-n','kern.memorystatus_level'],{timeout:2000,maxBuffer:4096,env:{PATH:'/usr/bin:/bin',LC_ALL:'C'}});
  const availableBytes=parseMemoryLevel(level,os.totalmem());
  return {...vm,availableBytes,reclaimableCreditBytes:Math.max(0,availableBytes-vm.freeBytes),method:'kern.memorystatus_level',estimated:true};
 }catch{return vm;}
}
export function parseProcessTreeRss(text,rootPid){
 if(!Number.isInteger(rootPid)||rootPid<=0)throw Error('PID del motor inválido.');
 const rows=text.trim().split('\n').filter(Boolean).map(line=>{const parts=line.trim().split(/\s+/).map(Number);if(parts.length!==3||parts.some(n=>!Number.isSafeInteger(n)||n<0))throw Error('No se pudo medir RSS.');return {pid:parts[0],ppid:parts[1],rss:parts[2]*1024};});
 if(!rows.some(r=>r.pid===rootPid))throw Error('El motor no aparece en la medición RSS.');
 const owned=new Set([rootPid]);let changed=true;while(changed){changed=false;for(const r of rows)if(owned.has(r.ppid)&&!owned.has(r.pid)){owned.add(r.pid);changed=true;}}
 // Shared pages may be counted more than once: intentionally conservative.
 return rows.filter(r=>owned.has(r.pid)).reduce((n,r)=>n+r.rss,0);
}
export async function processTreeRss(pid,{platform=os.platform(),execute=exec,systemRoot=process.env.SystemRoot}={}){if(platform==='win32')return windowsProcessTreeRss(pid,{execute,systemRoot});const {stdout}=await execute('/bin/ps',['-axo','pid=,ppid=,rss='],{timeout:2000,maxBuffer:4*1024*1024,env:{PATH:'/usr/bin:/bin',LC_ALL:'C'}});return parseProcessTreeRss(stdout,pid);}
