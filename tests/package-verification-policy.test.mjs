import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {spawnSync} from 'node:child_process';
import {assertPackageVerificationMode,verifyReasoningDisabled} from '../scripts/package-verification-policy.mjs';
import {createReasoningBoundary} from '../server/reasoning-boundary.mjs';
test('package mode denies legacy chat before platform, filesystem or child startup',()=>{
 assert.throws(()=>assertPackageVerificationMode({LEX_VERIFY_CHAT:'1'}),/no longer supported/);
 for(const env of [{},{LEX_VERIFY_CHAT:'0'}])assert.doesNotThrow(()=>assertPackageVerificationMode(env));
 const result=spawnSync(process.execPath,['scripts/verify-package.mjs','/path-that-must-not-be-read'],{env:{...process.env,LEX_VERIFY_CHAT:'1'},encoding:'utf8',timeout:3000});
 assert.notEqual(result.status,0);assert.match(result.stderr,/LEX_VERIFY_CHAT is no longer supported/);assert.doesNotMatch(result.stderr,/requireBuildHost|ENOENT|unsupported/);
});
test('observed disabled reasoning contract is distinct from runtime initialization or stopped attestation',async()=>{
 let calls=0;const boundary=createReasoningBoundary({stop:async()=>{calls++;},initialize:async()=>{throw Error('must not initialize');}});
 const report=verifyReasoningDisabled(await boundary.status());assert.deepEqual(report,{state:'unavailable',reasoningAvailable:false,localReaderRuntimeValidated:false});assert.equal(calls,0);
 for(const delta of [{state:'ready'},{state:'stopped'},{busy:true},{supported:true},{reasoning:{available:true,code:'reasoning-route-unavailable'}},{reasoning:{available:false,code:'other'}}])await assert.rejects(async()=>verifyReasoningDisabled({...await boundary.status(),...delta}));
});
test('verifier retains artifact checks without chat flag, polling ready or analyze execution',async()=>{
 const source=await readFile('scripts/verify-package.mjs','utf8');assert.match(source,/verifyBundledModel/);assert.match(source,/verifyCopiedInventory/);assert.match(source,/fileHash/);assert.match(source,/verifyReasoningDisabled/);
 assert.doesNotMatch(source,/readyDeadline|engine\.initialize|\/analyze|realLocalInference:true|automatically prepares its included model/);
 assert.ok(source.indexOf('assertPackageVerificationMode(process.env)')<source.indexOf('const plan='));
});
test('real server reports unavailable without touching an injected local initializer',async t=>{
 const {mkdtemp,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),path=await import('node:path'),{startServer}=await import('../server/main.mjs');
 const dataDir=await mkdtemp(path.join(tmpdir(),'package-boundary-'));let initialized=0,generated=0;
 const app=await startServer({dataDir,libraryPath:path.join(dataDir,'absent.sqlite'),autoInitialize:true,inference:{initialize:async()=>{initialized++;throw Error('forbidden');},status:async()=>({state:'ready'}),async *generate(){generated++;throw Error('forbidden');},stop:async()=>{}}});
 t.after(async()=>{await app.close();await rm(dataDir,{recursive:true,force:true});});
 const response=await fetch(app.connection.url+'/api',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+app.connection.token},body:JSON.stringify({action:'engine.status',payload:{}})});
 assert.equal(response.status,200);const observed=verifyReasoningDisabled(await response.json());assert.equal(observed.localReaderRuntimeValidated,false);assert.equal(initialized,0);assert.equal(generated,0);
});
