import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {IDS,validateAblationManifests,validateAblation,runAblation,main} from '../scripts/run-privacy-ablation-v3.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function fixture(){
 const manifestBytes=await Promise.all([2,3].map(v=>readFile(`resources/privacy-detector-candidate-v${v}.json`)));
 const protocolBytes=await readFile('eval/privacy-v2/protocol.json'),guideBytes=await readFile('eval/privacy-v2/annotation-guide.md');
 const scope={workspaceId:'SYNTH_W',matterId:'SYNTH_M',threadId:'SYNTH_T'};
 const rows=Array.from({length:60},(_,i)=>({id:`synthetic_${i}`,split:'dev',templateGroup:`synthetic_group_${i}`,synthetic:true,scope,segments:[{id:'s',path:'/content',text:'Texto genérico sin datos.',originScope:scope,classification:'synthetic'}],entities:[],expectedStatus:'complete',blockReason:null,preserve:[],operational:{processorStatus:'ok',segments:[{id:'s',mediaType:'text/plain',extractionStatus:'complete',assessment:'known'}]}}));
 const devBytes=Buffer.from(rows.map(r=>JSON.stringify(r)).join('\n')+'\n'),identity={sources:{synthetic:'a'},runtime:{synthetic:'b'}};
 const binding={version:1,candidateIds:IDS,identity,manifestSha256:manifestBytes.map(sha),protocolSha256:sha(protocolBytes),guideSha256:sha(guideBytes),devSha256:sha(devBytes),cases:60,threshold:.3};
 return {manifestBytes,protocolBytes,guideBytes,devBytes,identity,freeze:{approvedForDevelopmentAblation:true,independentReviewer:'synthetic reviewer',binding}};
}
test('two exact configs preserve weights, threshold and policy; arbitrary config fails',async()=>{
 const f=await fixture();assert.equal(validateAblationManifests(f.manifestBytes).length,2);
 for(const mutate of [m=>m.runtime.threshold=.2,m=>m.files[0].sha256='changed',m=>m.runtime.labels.push({label:'other',category:'context'}),m=>m.productionEnabled=true,m=>m.download.artifactDirectory='/tmp',m=>m.limitations[4]='arbitrary note',m=>m.limitations[0]='altered limitation',m=>m.limitations.pop()]){
  const b=JSON.parse(f.manifestBytes[1]);mutate(b);assert.throws(()=>validateAblationManifests([f.manifestBytes[0],Buffer.from(JSON.stringify(b))]));
 }
});
test('review, byte identities and corpus contract gate every backend before dispatch',async()=>{
 const f=await fixture();assert.equal(validateAblation(f).rows.length,60);let calls=0;
 for(const patch of [{freeze:{...f.freeze,approvedForDevelopmentAblation:false}},{devBytes:Buffer.from('bad')},{guideBytes:Buffer.from('bad')},{identity:{changed:true}},{protocolBytes:Buffer.from('{}')}])await assert.rejects(runAblation({...f,...patch},{startWorker:async()=>{calls++;throw Error('called');}}));
 assert.equal(calls,0);
 const missing={...f,devBytes:Buffer.from(f.devBytes.toString().trimEnd().split('\n').slice(1).join('\n'))};missing.freeze=structuredClone(f.freeze);missing.freeze.binding.devSha256=sha(missing.devBytes);assert.throws(()=>validateAblation(missing));
});
test('bounded sequential comparison passes only operational envelope, closes both workers',async()=>{
 const f=await fixture();let live=0,closed=0,calls=0;
 const result=await runAblation(f,{startWorker:async({candidateId})=>{assert.equal(live++,0);return {ready:Promise.resolve({candidateId,manifestSha256:f.manifestBytes.map(sha)[IDS.indexOf(candidateId)]}),async request(input){calls++;assert.deepEqual(Object.keys(input).sort(),['operational','scope','segments']);assert.equal(JSON.stringify(input).includes('expectedStatus'),false);return {result:{status:'complete',reasonCategory:null,detections:[]},latencyMs:1,peakRssBytes:100};},close(){live--;closed++;}};}});
 assert.equal(calls,120);assert.equal(closed,2);assert.equal(result.results.length,2);assert.equal(result.productionEnabled,false);
});
test('metadata mismatch or backend failure closes and never retries/starts next config',async()=>{
 const f=await fixture();for(const wrong of [true,false]){let starts=0,closed=0;await assert.rejects(runAblation(f,{startWorker:async({candidateId})=>{starts++;return {ready:Promise.resolve({candidateId,manifestSha256:wrong?'bad':sha(f.manifestBytes[0])}),request:async()=>{throw Error('synthetic');},close(){closed++;}};}}));assert.equal(starts,1);assert.equal(closed,1);}
});
test('default is plan; heldout and arbitrary command options rejected without model',async()=>{
 const result=spawnSync(process.execPath,['scripts/run-privacy-ablation-v3.mjs'],{encoding:'utf8',timeout:5000});assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).maximumRequests,120);
 await assert.rejects(main(['--heldout']));await assert.rejects(main(['--dev','--manifest','/tmp/arbitrary']));
 const source=await readFile('scripts/run-privacy-ablation-v3.mjs','utf8');assert.ok(source.includes('(deny file-read*'));assert.ok(source.includes('await mkdir(out)'));
});
test('invalid prediction stops scoring and next configuration',async()=>{
 const f=await fixture();let starts=0,closed=0;
 await assert.rejects(runAblation(f,{startWorker:async({candidateId})=>{starts++;return {ready:Promise.resolve({candidateId,manifestSha256:sha(f.manifestBytes[0])}),async request(){return {result:{status:'complete',reasonCategory:null,detections:[{segmentId:'s',start:0,end:99999,category:'person'}]},latencyMs:1,peakRssBytes:100};},close(){closed++;}};}}));
 assert.equal(starts,1);assert.equal(closed,1);
});
