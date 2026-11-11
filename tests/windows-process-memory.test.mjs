import test from 'node:test';
import assert from 'node:assert/strict';
import {parseWindowsProcessTreeRss as parse,windowsProcessTreeRss,windowsPowerShellPath,WINDOWS_MEMORY_COMMAND} from '../server/windows-process-memory.mjs';
import {processTreeRss} from '../server/runtime-memory.mjs';
const row=(ProcessId,ParentProcessId,WorkingSetSize)=>({ProcessId,ParentProcessId,WorkingSetSize});
const json=rows=>JSON.stringify(rows);
const snapshot=[row(0,0,0),row(1,0,900),row(2,1,100),row(3,2,200),row(4,3,300),row(5,1,99999)];
test('Windows bytes count only owned descendants, independent of row order and host PID',()=>{
 assert.equal(parse(json(snapshot),2),600);
 assert.equal(parse(json([...snapshot].reverse()),2),600);
 assert.equal(parse(json([...snapshot,row(process.pid+100000,1,1000000)]),2),600);
});
test('CIM one row object/array, UTF8 BOM, zero working set and empty snapshots',()=>{
 for(const text of [json(row(2,1,0)),json([row(2,1,0)]),'\uFEFF'+json(row(2,1,0))])assert.equal(parse(text,2),0);
 for(const text of ['','null','[]','{}','warning\n[]'])assert.throws(()=>parse(text,2));
});
test('strict numeric fields reject locale strings, missing/additional fields and invalid PIDs',()=>{
 const bad=[row('2',1,100),row(2,1,'1,024'),row(2,1,'1024'),row(2,1,-1),row(2,1,0.5),row(2,1,Number.MAX_SAFE_INTEGER+1),row(2,-1,1),row(2,2**32,1),row(2**32,1,1),{ProcessId:2,ParentProcessId:1},{...row(2,1,1),CommandLine:'forbidden'}];
 for(const r of bad)assert.throws(()=>parse(json(r),2));
 for(const pid of [0,-1,2.5,'2',NaN,2**32])assert.throws(()=>parse(json(snapshot),pid));
});
test('duplicates, self parents, cycles, missing root and total overflow fail closed',()=>{
 for(const rows of [[row(2,1,1),row(2,1,1)],[row(2,2,1)],[row(2,3,1),row(3,2,1)],[row(2,1,1),row(7,8,1),row(8,7,1)],[row(0,2,1),row(2,1,1)],[row(1,0,1)],[row(2,1,Number.MAX_SAFE_INTEGER),row(3,2,1)]])assert.throws(()=>parse(json(rows),2));
});
test('absolute system PowerShell only, fixed script and bounded shell-free invocation',async()=>{
 let calls=0;
 const execute=async(file,args,options)=>{
  calls++;assert.equal(file,'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
  assert.deepEqual(args,['-NoLogo','-NoProfile','-NonInteractive','-Command',WINDOWS_MEMORY_COMMAND]);
  assert.doesNotMatch(args.join(' '),/ExecutionPolicy|Bypass|CommandLine|ComputerName|CimSession/);
  assert.deepEqual(options,{timeout:2000,maxBuffer:4*1024*1024,encoding:'utf8',windowsHide:true,shell:false,env:{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'}});
  return {stdout:json(snapshot)};
 };
 assert.equal(await processTreeRss(2,{platform:'win32',execute,systemRoot:'C:\\Windows'}),600);
 assert.equal(calls,1);
 await assert.rejects(()=>windowsProcessTreeRss('2; malicious',{execute,systemRoot:'C:\\Windows'}));assert.equal(calls,1);
});
test('untrusted or unavailable launcher path, timeout and output overflow never become zero',async()=>{
 for(const root of [undefined,'Windows','powershell.exe','\\\\host\\Windows','C:\\Windows\\..','C:\\Windows;bad','C:\\Windows\\'])assert.throws(()=>windowsPowerShellPath(root));
 for(const code of ['ENOENT','ETIMEDOUT','ERR_CHILD_PROCESS_STDIO_MAXBUFFER']){
  const error=Object.assign(Error('measurement failed'),{code});
  await assert.rejects(()=>windowsProcessTreeRss(2,{systemRoot:'C:\\Windows',execute:async()=>{throw error;}}),e=>e===error);
 }
 await assert.rejects(()=>windowsProcessTreeRss(2,{systemRoot:'C:\\Windows',execute:async()=>({stdout:' '.repeat(4*1024*1024+1)})}));
});
test('Unix dispatch preserves command, units and existing process-tree behavior',async()=>{
 assert.equal(await processTreeRss(2,{platform:'darwin',execute:async(file,args,options)=>{
  assert.equal(file,'/bin/ps');assert.deepEqual(args,['-axo','pid=,ppid=,rss=']);
  assert.deepEqual(options,{timeout:2000,maxBuffer:4*1024*1024,env:{PATH:'/usr/bin:/bin',LC_ALL:'C'}});
  return {stdout:'1 0 99\n2 1 100\n3 2 200'};
 }}),300*1024);
});
test('real host ps measurement remains available on Unix', {skip:process.platform==='win32'},async()=>{
 const bytes=await processTreeRss(process.pid);assert.ok(Number.isSafeInteger(bytes)&&bytes>0);
});
