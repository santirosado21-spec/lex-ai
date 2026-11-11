import {spawn} from 'node:child_process';
import {readFile,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {createWindowsMemoryMonitorV2,parseWindowsWmiFrame} from '../server/windows-memory-monitor-v2.mjs';
import {runOwnedTreeSmoke,validateTree} from './windows-owned-tree-smoke.mjs';
export const PROTOCOL='windows-owned-tree-bootstrap-diagnostic-v1';
export const NEW_SOURCES=Object.freeze(['scripts/windows-owned-tree-bootstrap-diagnostic.mjs','tests/windows-owned-tree-bootstrap-diagnostic.test.mjs','resources/windows-owned-tree-bootstrap-diagnostic-v1.json','docs/architecture/windows-owned-tree-bootstrap-diagnostic-v1.md','.github/workflows/windows-owned-tree-bootstrap-diagnostic.yml']);
const sha=b=>createHash('sha256').update(b).digest('hex');
export function inspectBootstrapFrame(frame,rows,collectorPid,outsidePid){
 const result={observerStage:'frame-parse',errorCategory:null,roles:{root:{present:false,parentMatches:false,rssPositive:false},child:{present:false,parentMatches:false,rssPositive:false},grandchild:{present:false,parentMatches:false,rssPositive:false}},closureCount:null,collectorExcluded:null,outsideExcluded:null,sumEqualsMonitor:null,proofCount:0};
 let monitorSum,triples;
 try{monitorSum=parseWindowsWmiFrame(frame,{id:1,rootPid:rows[0].pid});triples=frame.split(':').slice(4).join(':').split(';').map(s=>s.split(',').map(Number));}catch{result.errorCategory='FRAME_INVALID';return result;}
 const descendants=new Set([rows[0].pid]);let changed=true;while(changed){changed=false;for(const [p,pp] of triples)if(descendants.has(pp)&&!descendants.has(p)){descendants.add(p);changed=true;}}
 result.observerStage='owned-roles';let sum=0;
 for(let i=0;i<3;i++){const t=triples.find(v=>v[0]===rows[i].pid),role=result.roles[['root','child','grandchild'][i]];role.present=Boolean(t);role.parentMatches=Boolean(t&&t[1]===rows[i].ppid);role.rssPositive=Boolean(t&&t[2]>0);if(t)sum+=t[2];}
 result.closureCount=descendants.size;result.collectorExcluded=!descendants.has(collectorPid);result.outsideExcluded=!descendants.has(outsidePid);result.sumEqualsMonitor=Number.isSafeInteger(sum)&&sum===monitorSum;
 const values=Object.values(result.roles);
 result.errorCategory=values.some(r=>!r.present)?'OWNED_ROLE_MISSING':values.some(r=>!r.parentMatches)?'OWNED_PARENT_MISMATCH':values.some(r=>!r.rssPositive)?'OWNED_RSS_NONPOSITIVE':descendants.size!==3?'CLOSURE_COUNT':!result.collectorExcluded?'COLLECTOR_INCLUDED':!result.outsideExcluded?'OUTSIDE_INCLUDED':!result.sumEqualsMonitor?'OWNED_SUM_MISMATCH':null;
 result.observerStage=result.errorCategory?'proof-rejected':'proof-complete';result.proofCount=result.errorCategory?0:1;return result;
}
export async function runBootstrapDiagnostic({platform=process.platform,arch=process.arch,nodeVersion=process.version,systemRoot=process.env.SystemRoot,spawnNode=spawn,spawnCollector=spawn,killOwned=process.kill}={}){
 const report={protocol:PROTOCOL,status:'DIAGNOSTIC_INCOMPLETE',diagnosticOnly:true,performanceValidated:false,steadyRequests:0,physical8GBValidated:false,installerValidated:false,inferenceValidated:false,observerStage:'fixture-readiness',errorCategory:null,chunkCount:0,byteCount:0,frameCount:0,proofCount:0,frameAscii:true,terminalCRLF:null,fixtureLive:null};
 let rows,fixture,wire=Buffer.alloc(0),monitorResult,innerDiagnostic,forbiddenSteady=false,observerMetadata,observerAggregate;
 const nodeSpy=(...args)=>{fixture=spawnNode(...args);fixture.on('message',message=>{if(message?.kind==='ready'){try{rows=validateTree(message.rows,fixture.pid,process.pid);report.observerStage='bootstrap';}catch{report.errorCategory='FIXTURE_ROSTER_INVALID';}}});return fixture;};
 const collectorSpy=(...args)=>{const child=spawnCollector(...args);child.stdout.on('data',chunk=>{
  report.chunkCount++;if(!Buffer.isBuffer(chunk)){report.errorCategory='CHUNK_TYPE';return;}
  report.byteCount+=chunk.length;if(report.byteCount>4194304||report.chunkCount>4194304){report.errorCategory='OUTPUT_LIMIT';return;}
  if(chunk.some(b=>b>127)){report.frameAscii=false;report.errorCategory='NON_ASCII';return;}
  if(report.frameCount){report.errorCategory='EXTRA_OUTPUT';return;}wire=Buffer.concat([wire,chunk]);const end=wire.indexOf(10);if(end<0)return;
  report.frameCount++;report.terminalCRLF=end>0&&wire[end-1]===13;
  if(end!==wire.length-1){report.errorCategory='TRAILING_OUTPUT';return;}
  if(!rows){report.errorCategory='FIXTURE_ROSTER_MISSING';return;}
  const frame=wire.subarray(0,end).toString('ascii').replace(/\r$/,'');observerMetadata=inspectBootstrapFrame(frame,rows,child.pid,process.pid);try{observerAggregate=parseWindowsWmiFrame(frame,{id:1,rootPid:rows[0].pid});}catch{}Object.assign(report,observerMetadata);wire=Buffer.alloc(0);
 });return child;};
 const makeMonitor=options=>{
  // Real frozen monitor implementation. Only its platform and process launch
  // dependencies are injected; protocol/deadlines/parser remain unchanged.
  const inner=createWindowsMemoryMonitorV2({...options,platform});
  return {async start(){const value=await inner.start();monitorResult=value;report.fixtureLive=Boolean(fixture&&fixture.exitCode===null&&!fixture.signalCode&&fixture.connected);return value;},readRss(){forbiddenSteady=true;return Promise.reject(Object.assign(Error(),{code:'DIAGNOSTIC_STOP_AFTER_BOOTSTRAP'}));},async close(){const value=await inner.close();innerDiagnostic=inner.diagnostics();return value;}};
 };
 const smoke=await runOwnedTreeSmoke({platform,arch,nodeVersion,systemRoot,spawnNode:nodeSpy,spawnCollector:collectorSpy,makeMonitor,killOwned});
 report.steadyRequestIntercepted=forbiddenSteady;report.bootstrapMonitorResolved=Boolean(monitorResult);
 report.collectorCleanup=smoke.collectorCleanup??null;report.fixtureCleanup=smoke.fixtureCleanup??null;
 report.originalSmokeCategory=smoke.category??null;
 if(monitorResult){report.bootstrapElapsedMs=monitorResult.elapsedMs;report.sumEqualsMonitor=Boolean(observerMetadata?.sumEqualsMonitor&&observerAggregate===monitorResult.rssBytes);}
 // A proof rejection is a completed diagnosis; a missing frame, collector error,
 // unsafe cleanup or unbounded activity remains incomplete/nonzero.
 const clean=Boolean(smoke.collectorCleanup?.exitObserved&&!smoke.collectorCleanup?.killed&&!smoke.collectorCleanup?.category&&smoke.collectorCleanup.exitCode===0&&!smoke.collectorCleanup.signal&&smoke.fixtureCleanup?.intentionalShutdown&&smoke.fixtureCleanup.allThreeReaped&&!smoke.fixtureCleanup.forced);
 report.cleanupComplete=clean;report.monitorCategory=innerDiagnostic?.category??null;
 if(clean&&monitorResult&&observerMetadata&&report.frameCount===1&&report.frameAscii&&wire.length===0&&(!report.errorCategory||report.errorCategory===observerMetadata.errorCategory)){report.status='DIAGNOSTIC_COMPLETE';}
 if(report.status!=='DIAGNOSTIC_COMPLETE'&&!report.errorCategory)report.errorCategory='BOOTSTRAP_OR_CLEANUP_INCOMPLETE';
 return report;
}
async function boundedRead(p){const st=await lstat(p);if(!st.isFile()||st.isSymbolicLink()||st.size>1048576)throw Error();return readFile(p);}
export async function verifyDiagnosticFreeze(freeze){
 const baseline=JSON.parse(await boundedRead('docs/qa/windows-owned-tree-D1j-attempt3-freeze-2026-11-10.json'));
 const expected=[...NEW_SOURCES,...Object.keys(baseline.sourceHashes)];
 if(freeze?.scope!==PROTOCOL||freeze.approvedForSingleDiagnosticRun!==true||Object.keys(freeze.sourceHashes??{}).sort().join('|')!==expected.sort().join('|')||sha(Buffer.from(JSON.stringify(baseline)))!==freeze.attempt3FreezeCanonicalSha256)throw Error();
 for(const [p,h] of Object.entries(baseline.sourceHashes))if(freeze.sourceHashes[p]!==h)throw Error();
 for(const p of expected)if(sha(await boundedRead(p))!==freeze.sourceHashes[p])throw Error();
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const args=process.argv.slice(2);if(!args.length)console.log(JSON.stringify({protocol:PROTOCOL,status:'PLAN',execution:false}));else if(args.length===1&&args[0]==='--run'&&process.platform==='win32'){try{const freeze=JSON.parse(await boundedRead('docs/qa/windows-owned-tree-bootstrap-diagnostic-freeze-2026-11-10.json'));await verifyDiagnosticFreeze(freeze);const report=await runBootstrapDiagnostic();await verifyDiagnosticFreeze(freeze);console.log(JSON.stringify(report));if(report.status!=='DIAGNOSTIC_COMPLETE')process.exitCode=1;}catch{console.log(JSON.stringify({protocol:PROTOCOL,status:'DIAGNOSTIC_INCOMPLETE',diagnosticOnly:true,performanceValidated:false,errorCategory:'PREFLIGHT_OR_POSTFLIGHT'}));process.exitCode=1;}}else{console.log(JSON.stringify({protocol:PROTOCOL,status:'DIAGNOSTIC_INCOMPLETE',errorCategory:'ARGUMENT_OR_PLATFORM'}));process.exitCode=1;}}
