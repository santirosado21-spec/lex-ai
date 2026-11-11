import {spawn} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {readFile,mkdir,writeFile,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {createWindowsMemoryMonitorV2,parseWindowsWmiFrame} from '../server/windows-memory-monitor-v2.mjs';
function requireNodeVersion(version){const m=/^v?(\d+)\.(\d+)\.(\d+)$/.exec(version);if(!m||Number(m[1])<22||(Number(m[1])===22&&Number(m[2])<13))throw Error('NODE_VERSION');}
export const PROTOCOL='windows-owned-tree-smoke-v1';
// Fixed code, numeric role only; no environment-driven executable or commands.
export function ownedFixture(){
 const {spawn}=require('node:child_process');
 const role=Number(process.argv[1]);const bytes=Buffer.alloc(8*1024*1024,1);
 let child,stopping=false,rows=[{pid:process.pid,ppid:process.ppid,role}],reaped=[];
 const lifetime=setTimeout(()=>process.exit(30),60000);
 const pulse=setInterval(()=>{if(bytes[0]!==1)process.exit(31)},500);
 function stop(){if(stopping)return;stopping=true;if(child){if(child.connected)child.send('stop');else process.exit(32);}else finish();}
 function finish(){clearTimeout(lifetime);clearInterval(pulse);if(process.connected)process.send({kind:'reaped',roles:reaped},()=>process.exit(0));else process.exit(0);}
 process.on('message',m=>{if(m==='stop')stop();else process.exit(33)});
 process.on('disconnect',stop);
 if(role<2){child=spawn(process.execPath,['--input-type=commonjs','-e','('+ownedFixture.toString()+')()',String(role+1)],{env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR},stdio:['ignore','ignore','ignore','ipc'],shell:false,windowsHide:true});
 child.on('error',()=>process.exit(34));child.on('message',m=>{if(m.kind==='ready'){if(stopping){child.send('stop');}else{rows.push(...m.rows);process.send({kind:'ready',rows});}}else if(m.kind==='reaped'&&stopping)reaped=m.roles;else process.exit(35)});
 child.on('exit',(code,signal)=>{if(!stopping||code!==0||signal)process.exit(36);reaped.push(role+1);finish()});
 }else process.send({kind:'ready',rows});
}
export function fixtureCode(){return '('+ownedFixture.toString()+')()';}
const pid=n=>Number.isInteger(n)&&n>0&&n<=0xffffffff;
export function validateTree(rows,rootPid,parentPid){
 if(!Array.isArray(rows)||rows.length!==3)throw Error('TREE');
 const seen=new Set();for(let i=0;i<3;i++){const r=rows[i];if(!r||Object.keys(r).sort().join(',')!=='pid,ppid,role'||r.role!==i||!pid(r.pid)||!pid(r.ppid)||seen.has(r.pid)||r.pid===parentPid||r.ppid!==(i?rows[i-1].pid:parentPid))throw Error('TREE');seen.add(r.pid);}
 if(rows[0].pid!==rootPid)throw Error('TREE');return rows;
}
export function validateSnapshot(frame,id,rows,collectorPid,outsidePid){
 const rssBytes=parseWindowsWmiFrame(frame,{id,rootPid:rows[0].pid});
 const all=frame.split(':').slice(4).join(':').split(';').map(v=>v.split(',').map(Number));
 const descendants=new Set([rows[0].pid]);let changed=true;while(changed){changed=false;for(const [p,pp] of all)if(descendants.has(pp)&&!descendants.has(p)){descendants.add(p);changed=true;}}
 if(descendants.size!==3||descendants.has(collectorPid)||descendants.has(outsidePid))throw Error('CLOSURE');
 let total=0;for(const r of rows){const a=all.find(a=>a[0]===r.pid);if(!a||a[1]!==r.ppid||a[2]<=0)throw Error('CLOSURE');total+=a[2];}
 if(total!==rssBytes)throw Error('CLOSURE');return {rssBytes,ownedProcessCount:3,parentClosureVerified:true,collectorExcluded:true,outsideExcluded:true};
}
function waitEvent(child,event,ms,accept){return new Promise((resolve,reject)=>{const started=performance.now();const finish=(e,v)=>{clearTimeout(timer);child.off(event,got);child.off('error',error);child.off('exit',exit);e?reject(Error(e)):resolve(v)};const got=v=>{if(performance.now()-started>=ms)return finish('DEADLINE');try{const accepted=accept(v);if(accepted===null)return;if(accepted)finish(null,v);else finish('PROTOCOL')}catch{finish('PROTOCOL')}};const error=()=>finish('FIXTURE_ERROR');const exit=()=>finish('FIXTURE_EXIT');const timer=setTimeout(()=>finish('DEADLINE'),ms);child.on(event,got);child.once('error',error);if(event!=='exit')child.once('exit',exit);});}
export async function runOwnedTreeSmoke({platform=process.platform,arch=process.arch,nodeVersion=process.version,systemRoot=process.env.SystemRoot,spawnNode=spawn,spawnCollector=spawn,makeMonitor=createWindowsMemoryMonitorV2,killOwned=process.kill}={}){
 const report={protocol:PROTOCOL,status:'FAIL',samples:[],physical8GBValidated:false,installerValidated:false,inferenceValidated:false,collectorOverheadBytes:null};let child,monitor,rows,unexpected=false,intentional=false,reaped=false,frameCount=0,proofs=[],wire=Buffer.alloc(0),wireError=false;
 const live=()=>child&&!unexpected&&child.exitCode===null&&!child.signalCode&&child.connected;
 try{requireNodeVersion(nodeVersion);if(platform!=='win32'||arch!=='x64')throw Error('PLATFORM');
 child=spawnNode(process.execPath,['--input-type=commonjs','-e',fixtureCode(),'0'],{env:{SystemRoot:systemRoot,WINDIR:systemRoot},stdio:['ignore','ignore','ignore','ipc'],shell:false,windowsHide:true});child.on('error',()=>{unexpected=true});child.on('exit',()=>{if(!intentional)unexpected=true});
 const ready=await waitEvent(child,'message',5000,m=>m?.kind==='ready');rows=validateTree(ready.rows,child.pid,process.pid);if(!live())throw Error('FIXTURE_EXIT');
 const observeSpawn=(...args)=>{const collector=spawnCollector(...args);collector.stdout.on('data',chunk=>{try{if(!Buffer.isBuffer(chunk)||wire.length+chunk.length>4194304)throw Error();wire=Buffer.concat([wire,chunk]);const end=wire.indexOf(10);if(end>=0){if(end!==wire.length-1)throw Error();proofs.push(validateSnapshot(wire.subarray(0,end).toString('ascii').replace(/\r$/,''),++frameCount,rows,collector.pid,process.pid));wire=Buffer.alloc(0);}}catch{wireError=true;}});return collector;};
 monitor=makeMonitor({rootPid:child.pid,systemRoot,spawnProcess:observeSpawn});report.startup=await monitor.start();if(!live()||wireError||proofs.length!==1)throw Error('SNAPSHOT');report.startup={...report.startup,...proofs[0],includesFirstActualWmiSnapshot:true};
 for(let i=0;i<4;i++){const result=await monitor.readRss();if(!live()||wireError||proofs.length!==i+2)throw Error('SNAPSHOT');report.samples.push({sample:i+1,...result,...proofs[i+1]});}
 if(!live())throw Error('FIXTURE_EXIT');report.status='PASS';
 }catch{report.category='PROTOCOL_OR_MEASUREMENT_FAILURE';}
 finally{
 if(monitor){try{report.collectorCleanup=await monitor.close();if(!report.collectorCleanup.exitObserved||report.collectorCleanup.killed||report.collectorCleanup.category||report.collectorCleanup.exitCode!==0||report.collectorCleanup.signal||wireError||wire.length||proofs.length!==5)report.status='FAIL';}catch{report.status='FAIL';report.collectorCleanup={exitObserved:false};}}
 if(child){intentional=Boolean(live());try{const receipt=waitEvent(child,'message',3000,m=>m?.kind==='ready'?null:m?.kind==='reaped'&&Array.isArray(m.roles)&&m.roles.join(',')==='2,1');const shutdownStarted=performance.now();const exit=new Promise(resolve=>{if(child.exitCode!==null)return resolve(false);const t=setTimeout(()=>resolve(false),3500);child.once('exit',(code,signal)=>{clearTimeout(t);resolve(code===0&&!signal&&performance.now()-shutdownStarted<3500)})});if(child.connected)child.send('stop');await receipt;reaped=await exit;}catch{}report.fixtureCleanup={intentionalShutdown:intentional,allThreeReaped:reaped,forced:false};if(!intentional||!reaped||unexpected){report.status='FAIL';report.fixtureCleanup.forced=true;for(const r of [...(rows??[])].reverse()){try{killOwned(r.pid)}catch{}}try{child.kill()}catch{}}}
 }
 return report;
}
const SOURCE_PATHS=['scripts/windows-owned-tree-smoke.mjs','tests/windows-owned-tree-smoke.test.mjs','docs/architecture/windows-owned-tree-smoke-v1.md','server/windows-memory-monitor-v2.mjs','server/windows-process-memory.mjs','resources/windows-owned-tree-smoke-v1.json','.github/workflows/windows-owned-tree-smoke.yml'];
export async function verifyFreeze(freeze){if(!freeze||freeze.scope!==PROTOCOL||freeze.approvedForSingleRun!==true||Object.keys(freeze.sourceHashes??{}).sort().join('|')!==[...SOURCE_PATHS].sort().join('|'))throw Object.assign(Error(),{code:'INVALID_FREEZE'});for(const p of SOURCE_PATHS){const bytes=await readFile(p);if(createHash('sha256').update(bytes).digest('hex')!==freeze.sourceHashes[p])throw Object.assign(Error(),{code:'SOURCE_HASH_MISMATCH'});}}
const ERROR_TYPES=new Set(['Error','TypeError','RangeError','SyntaxError']);
const ERROR_CODES=new Set(['INVALID_FREEZE','SOURCE_HASH_MISMATCH','UNSUPPORTED_PLATFORM','UNSAFE_OUTPUT_PARENT','ENOENT','EEXIST','EACCES','EPERM','ENOTDIR','EISDIR','ENOSPC']);
export function sanitizedFailure(error,phase){return {protocol:PROTOCOL,status:'FAIL',phase,category:'PREFLIGHT_OR_RUN',errorType:ERROR_TYPES.has(error?.name)?error.name:'UNKNOWN',errorCode:ERROR_CODES.has(error?.code)?error.code:'UNKNOWN'};}
export async function createFreshOutput(parent='artifacts'){
 try{await mkdir(parent,{recursive:false});}catch(error){if(error?.code!=='EEXIST')throw error;}
 const info=await lstat(parent);if(info.isSymbolicLink()||!info.isDirectory())throw Object.assign(Error(),{code:'UNSAFE_OUTPUT_PARENT'});
 const out=path.join(parent,'windows-owned-tree-smoke-v1');await mkdir(out,{recursive:false});
 const after=await lstat(parent);if(after.isSymbolicLink()||!after.isDirectory()||after.dev!==info.dev||after.ino!==info.ino)throw Object.assign(Error(),{code:'UNSAFE_OUTPUT_PARENT'});
 return out;
}
export async function runFrozenSmoke({platform=process.platform,readFreeze=()=>readFile('docs/qa/windows-owned-tree-smoke-freeze-2026-11-10.json','utf8'),checkFreeze=verifyFreeze,run=runOwnedTreeSmoke,parent='artifacts',write=writeFile}={}){
 let phase='preflight',report;
 try{
  if(platform!=='win32')throw Object.assign(Error(),{code:'UNSUPPORTED_PLATFORM'});
  const freeze=JSON.parse(await readFreeze());phase='source-preflight';await checkFreeze(freeze);
  phase='output';const out=await createFreshOutput(parent);await write(path.join(out,'started.json'),JSON.stringify({protocol:PROTOCOL}),{flag:'wx'});
  phase='run';report=await run();report.phase=report.status==='PASS'?'complete':'run';phase='postflight';await checkFreeze(freeze);
  phase='receipt';await write(path.join(out,'receipt.json'),JSON.stringify(report),{flag:'wx'});
  return report;
 }catch(error){return {...sanitizedFailure(error,phase),...(report?{measurementReportAvailable:true}: {})};}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const args=process.argv.slice(2);if(!args.length)console.log(JSON.stringify({protocol:PROTOCOL,status:'PLAN',execution:false}));
 else if(args.length===1&&args[0]==='--run'){const report=await runFrozenSmoke();console.log(JSON.stringify(report));if(report.status!=='PASS')process.exitCode=1;}
 else{console.log(JSON.stringify({status:'FAIL',category:'ARGUMENTS'}));process.exitCode=1;}
}
