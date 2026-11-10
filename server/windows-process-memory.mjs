import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
const exec=promisify(execFile);
const MAX_OUTPUT=4*1024*1024;
// Local CIM snapshot; deliberately never request names, paths or command lines.
// https://learn.microsoft.com/en-us/windows/win32/cimwin32prov/win32-process
// https://learn.microsoft.com/en-us/powershell/module/cimcmdlets/get-ciminstance
export const WINDOWS_MEMORY_COMMAND="$ErrorActionPreference='Stop'; [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false); @(Get-CimInstance -ClassName Win32_Process -Property ProcessId,ParentProcessId,WorkingSetSize -ErrorAction Stop | Select-Object -Property ProcessId,ParentProcessId,WorkingSetSize) | ConvertTo-Json -Compress";
const invalid=()=>Error('No se pudo medir RSS.');
export function parseWindowsProcessTreeRss(text,rootPid){
 if(!Number.isSafeInteger(rootPid)||rootPid<=0||rootPid>0xffffffff)throw Error('PID del motor inválido.');
 if(typeof text!=='string'||Buffer.byteLength(text,'utf8')>MAX_OUTPUT)throw invalid();
 let parsed;try{parsed=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw invalid();}
 const rows=Array.isArray(parsed)?parsed:[parsed];
 const byPid=new Map();
 for(const row of rows){
  if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).sort().join(',')!=='ParentProcessId,ProcessId,WorkingSetSize')throw invalid();
  const {ProcessId:pid,ParentProcessId:ppid,WorkingSetSize:rss}=row;
  if(![pid,ppid,rss].every(n=>Number.isSafeInteger(n)&&n>=0)||pid>0xffffffff||ppid>0xffffffff||byPid.has(pid)||(pid===ppid&&pid!==0)||(pid===0&&ppid!==0))throw invalid();
  byPid.set(pid,{pid,ppid,rss});
 }
 if(!byPid.has(rootPid))throw Error('El motor no aparece en la medición RSS.');
 // Reject corrupt snapshots, including cycles outside the owned subtree.
 const complete=new Set([0]);
 for(const pid of byPid.keys()){
  const visiting=new Set();let cursor=pid;
  while(byPid.has(cursor)&&!complete.has(cursor)){
   if(visiting.has(cursor))throw invalid();
   visiting.add(cursor);cursor=byPid.get(cursor).ppid;
  }
  for(const seen of visiting)complete.add(seen);
 }
 const children=new Map();
 for(const row of byPid.values()){if(!children.has(row.ppid))children.set(row.ppid,[]);children.get(row.ppid).push(row.pid);}
 let total=0;const pending=[rootPid];
 while(pending.length){const pid=pending.pop();total+=byPid.get(pid).rss;if(!Number.isSafeInteger(total))throw invalid();for(const child of children.get(pid)||[])pending.push(child);}
 return total;
}
export function windowsPowerShellPath(systemRoot){
 // SystemRoot comes only from the trusted launcher environment, never document input.
 if(typeof systemRoot!=='string'||! /^[A-Za-z]:\\/.test(systemRoot)||!path.win32.isAbsolute(systemRoot)||systemRoot.split(/[\\/]/).slice(1).some(s=>!s||s==='.'||s==='..'||! /^[\w .-]+$/.test(s)))throw invalid();
 return path.win32.join(systemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');
}
export async function windowsProcessTreeRss(pid,{execute=exec,systemRoot=process.env.SystemRoot}={}){
 if(!Number.isSafeInteger(pid)||pid<=0||pid>0xffffffff)throw Error('PID del motor inválido.');
 const executable=windowsPowerShellPath(systemRoot);
 // No shell, profile, policy bypass, PATH lookup or request-derived interpolation.
 const {stdout}=await execute(executable,['-NoLogo','-NoProfile','-NonInteractive','-Command',WINDOWS_MEMORY_COMMAND],{timeout:2000,maxBuffer:MAX_OUTPUT,encoding:'utf8',windowsHide:true,shell:false,env:{SystemRoot:systemRoot,WINDIR:systemRoot}});
 return parseWindowsProcessTreeRss(stdout,pid);
}
