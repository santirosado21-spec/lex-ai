import {readFile,lstat} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
const exec=promisify(execFile);
const SCOPE='windows-owned-tree-source-diagnostic-v1';
export const SOURCES=Object.freeze([
 ['smoke','scripts/windows-owned-tree-smoke.mjs'],['contracts','tests/windows-owned-tree-smoke.test.mjs'],['design','docs/architecture/windows-owned-tree-smoke-v1.md'],['protocol','resources/windows-owned-tree-smoke-v1.json'],['workflow','.github/workflows/windows-owned-tree-smoke.yml'],['monitor','server/windows-memory-monitor-v2.mjs'],['parser','server/windows-process-memory.mjs']
]);
const OWN=['scripts/windows-owned-tree-source-diagnostic.mjs','tests/windows-owned-tree-source-diagnostic.test.mjs','.github/workflows/windows-owned-tree-source-diagnostic.yml','docs/architecture/windows-owned-tree-source-diagnostic-v1.md'];
const sha=b=>createHash('sha256').update(b).digest('hex');
export function byteFacts(bytes){if(!Buffer.isBuffer(bytes)||bytes.length>1048576)throw Error('BYTES');let lf=0,crlf=0,cr=0;for(let i=0;i<bytes.length;i++){if(bytes[i]===10){lf++;if(i&&bytes[i-1]===13)crlf++;}if(bytes[i]===13)cr++;}return {sha256:sha(bytes),bytes:bytes.length,lfCount:lf,crlfCount:crlf,loneLfCount:lf-crlf,loneCrCount:cr-crlf};}
async function boundedRead(p){const st=await lstat(p);if(st.isSymbolicLink()||!st.isFile()||st.size>1048576)throw Error('SOURCE');return readFile(p);}
export async function gitBlob(p){const {stdout}=await exec('C:\\Program Files\\Git\\cmd\\git.exe',['--no-pager','show',`HEAD:${p}`],{encoding:'buffer',timeout:2000,maxBuffer:1048576,windowsHide:true,shell:false,env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.SystemRoot,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'NUL',GIT_NO_REPLACE_OBJECTS:'1'}});return stdout;}
export function compareSource(role,expected,committed,working){if(!/^[a-f0-9]{64}$/.test(expected))throw Error('FREEZE');const blob=byteFacts(committed),worktree=byteFacts(working);return {role,expectedSha256:expected,committed:blob,working:worktree,committedMatchesFreeze:blob.sha256===expected,workingMatchesFreeze:worktree.sha256===expected,workingMatchesCommitted:worktree.sha256===blob.sha256};}
export async function diagnoseSources({freeze,smokeFreeze,read=boundedRead,blob=gitBlob}={}){
 const started=performance.now();const deadline=()=>{if(performance.now()-started>=30000)throw Error('DEADLINE');};
 if(freeze?.scope!==SCOPE||freeze.approvedForSingleDiagnosticRun!==true||Object.keys(freeze.sourceHashes??{}).sort().join('|')!==[...OWN].sort().join('|'))throw Error('FREEZE');
 // Bind diagnostic authoring bytes from committed Git objects, not transformed checkout bytes.
 // Working diagnostic source may differ ONLY by CR immediately before LF.
 for(const p of OWN){deadline();const committed=await blob(p),working=await read(p);deadline();if(sha(committed)!==freeze.sourceHashes[p]||!working.equals(committed)&&!Buffer.from(working.toString('utf8').replace(/\r\n/g,'\n'),'utf8').equals(committed))throw Error('DIAGNOSTIC_SOURCE');}
 if(sha(Buffer.from(JSON.stringify(smokeFreeze)))!==freeze.smokeFreezeCanonicalSha256)throw Error('FREEZE_BINDING');
 if(smokeFreeze?.scope!=='windows-owned-tree-smoke-v1'||Object.keys(smokeFreeze.sourceHashes??{}).sort().join('|')!==SOURCES.map(s=>s[1]).sort().join('|'))throw Error('FREEZE');
 const rows=[];for(const [role,p] of SOURCES){deadline();rows.push(compareSource(role,smokeFreeze.sourceHashes[p],await blob(p),await read(p)));deadline();}
 return {protocol:SCOPE,status:'DIAGNOSTIC_COMPLETE',diagnosticOnly:true,performanceValidated:false,wmiExecuted:false,rows};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const args=process.argv.slice(2);if(!args.length)console.log(JSON.stringify({protocol:SCOPE,status:'PLAN',execution:false}));else if(args.length===1&&args[0]==='--run'&&process.platform==='win32'){try{const freeze=JSON.parse(await boundedRead('docs/qa/windows-owned-tree-source-diagnostic-freeze-2026-11-10.json'));const smokeFreeze=JSON.parse(await boundedRead('docs/qa/windows-owned-tree-D1j-attempt2-freeze-2026-11-10.json'));console.log(JSON.stringify(await diagnoseSources({freeze,smokeFreeze})));}catch{console.log(JSON.stringify({protocol:SCOPE,status:'FAIL',category:'SOURCE_DIAGNOSTIC_FAILURE',diagnosticOnly:true,performanceValidated:false}));process.exitCode=1;}}else{console.log(JSON.stringify({protocol:SCOPE,status:'FAIL',category:'ARGUMENT_OR_PLATFORM'}));process.exitCode=1;}}
