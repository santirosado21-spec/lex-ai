import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,readdir,realpath,symlink,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {Worker} from 'node:worker_threads';
import {performance} from 'node:perf_hooks';
import {buildAcquisitionPlan,ACQUISITION_LIMITS} from '../server/corpus/source-registry.mjs';
import {runPublicAcquisition,loadPublicAcquisitionReport} from '../server/corpus/acquisition.mjs';
import {extractArticles} from '../server/legal-library.mjs';

const digest=value=>createHash('sha256').update(value).digest('hex');
const capture='2026-11-09T12:00:00.000Z';
const index='https://www.diputados.gob.mx/LeyesBiblio/index.htm';
const article='Artículo 1.- Este contenido es completamente sintético y permite verificar texto, páginas y trazabilidad sin datos de clientes.';
const pause=async()=>{};
function registry({documents=1,limits={}}={}){
  return {schemaVersion:1,id:'synthetic-public-pilot',registryVersion:'synthetic-v1',dataClass:'public-legal',productionEnabled:false,policy:{approvalAuthority:'developer-reviewed',purpose:'bounded-public-acquisition',scope:'public-legal'},limits:{...ACQUISITION_LIMITS,...limits},sources:[{id:'synthetic-fed',title:'Synthetic source',jurisdiction:'MX-FED',collection:'federal-legislation',status:'approved',discovery:{url:index,evidence:'Synthetic fixture only',observedAt:capture},rightsReview:{status:'approved',reviewedBy:'synthetic-reviewer',reviewedAt:capture,basis:'Synthetic fixtures only',evidenceUrl:index,scope:'bounded-public-pilot'},version:{id:'fixture-selection-v1',evidenceUrl:index,observedAt:capture}}],documents:[...Array.from({length:documents},(_,i)=>({id:`law-${i+1}`,sourceId:'synthetic-fed',title:`Synthetic law ${i+1}`,jurisdiction:'MX-FED',status:'approved',url:`https://www.diputados.gob.mx/LeyesBiblio/pdf/Synthetic${i+1}.pdf`,versionId:'fixture-selection-v1',evidenceUrl:index})),{id:'judicial-pending',sourceId:'synthetic-fed',title:'Pending channel fixture',jurisdiction:'MX-FED',status:'pending',url:null,versionId:'fixture-selection-v1',evidenceUrl:null}]};
}
const planFor=options=>buildAcquisitionPlan(registry(options),{now:capture});
const extractor=async(file,source,metadata)=>extractArticles([{number:1,text:article+'\nTRANSITORIOS'}],source,metadata);
const pdf=value=>new Response('%PDF-1.4 synthetic '+value,{headers:{'content-type':'application/pdf'}});
const fetchFixture=async url=>url.endsWith('/robots.txt')?new Response('',{status:404}):pdf('version-1');
async function directory(t){const dir=await realpath(await mkdtemp(path.join(tmpdir(),'lex-public-acquisition-')));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}
async function setup(t,options={}){return {plan:planFor(),outputDir:await directory(t),mode:'live',fetchImpl:fetchFixture,extractor,sleep:pause,...options};}
const read=(dir,file)=>readFile(path.join(dir,file),'utf8').then(JSON.parse);

test('live acquisition preserves immutable provenance, quarantine and pending denominator; offline replay is idempotent',async t=>{
  let extractions=0;const options=await setup(t,{extractor:async(...args)=>{extractions++;return extractor(...args);}});
  const first=await runPublicAcquisition(options);assert.equal(first.state,'complete');assert.equal(first.summary.downloaded,1);assert.equal(first.summary.extracted,1);assert.equal(first.summary.pending,1);assert.equal(first.metrics.requests,2);
  assert.equal(first.metrics.decodedBodyBytes,Buffer.byteLength('%PDF-1.4 synthetic version-1'));
  const entry=first.documents[0],saved=await read(options.outputDir,entry.extractionPath);
  const evidence=await read(options.outputDir,entry.versionEvidencePath);assert.equal(evidence.mime,'application/pdf');assert.equal(evidence.pdfSha256,entry.pdfSha256);assert.equal(evidence.discoverySelectionVersionId,'fixture-selection-v1');assert.equal(evidence.declaredAmendedAt,null);assert.equal(first.documents[0].requests[0].kind,'robots');
  assert.equal(saved.records[0].text,article);assert.equal(saved.records[0].textSha256,digest(article));assert.deepEqual(saved.records[0].sourcePages,[1]);assert.equal(saved.declaredAmendedAt,null);assert.equal(saved.effectiveAt,null);assert.match(saved.versionId,/law-1@sha256:[a-f0-9]{64}$/);assert.doesNotMatch(saved.versionId,/2026-/);
  assert.equal(saved.coverage.exportableArticles,undefined);assert.equal(saved.coverage.structuralCandidateCount,1);
  for(const row of [saved,...saved.records]){assert.equal(row.textReview,'pending');assert.equal(row.legalReview,'pending');assert.equal(row.status,'quarantined');assert.equal(row.published,false);assert.equal(row.indexed,false);}
  const newerPlan=buildAcquisitionPlan(registry(),{now:'2026-11-10T12:00:00.000Z'});
  const replay=await runPublicAcquisition({...options,plan:newerPlan,mode:'offline',fetchImpl:()=>{throw new Error('offline cannot fetch');}});
  assert.equal(replay.state,'complete');assert.equal(replay.summary.cached,1);assert.equal(replay.metrics.requests,0);assert.equal(extractions,1);assert.equal(replay.documents[0].extractionPath,entry.extractionPath);
  assert.deepEqual(await loadPublicAcquisitionReport({outputDir:options.outputDir}),replay);
  assert.ok(!(await readdir(options.outputDir)).includes('exports'));
});

test('changed PDF retains both immutable versions and failed later acquisition preserves prior valid snapshot',async t=>{
  const options=await setup(t);const first=await runPublicAcquisition(options);
  const second=await runPublicAcquisition({...options,fetchImpl:async url=>url.endsWith('/robots.txt')?new Response('',{status:404}):pdf('version-2')});
  assert.notEqual(first.documents[0].pdfSha256,second.documents[0].pdfSha256);
  const manifest=await read(options.outputDir,'acquisitions/manifest.json');assert.equal(manifest.sources['law-1'].versions.length,2);
  for(const version of manifest.sources['law-1'].versions)assert.equal(digest(await readFile(path.join(options.outputDir,'acquisitions',version.snapshotPath))),version.sha256);
  const before=await readFile(path.join(options.outputDir,'acquisitions/manifest.json'),'utf8');
  const failed=await runPublicAcquisition({...options,fetchImpl:async url=>url.endsWith('/robots.txt')?new Response('',{status:404}):new Response('outage',{status:503})});
  assert.equal(failed.documents[0].errorCategory,'http-error');assert.equal(failed.summary.extracted,0);assert.equal(await readFile(path.join(options.outputDir,'acquisitions/manifest.json'),'utf8'),before);
  const replay=await runPublicAcquisition({...options,mode:'offline'});assert.equal(replay.state,'complete');assert.equal(replay.documents[0].pdfSha256,second.documents[0].pdfSha256);
});

test('conditional 304 verifies prior PDF and performs no extraction fallback or version replacement',async t=>{
  const options=await setup(t);await runPublicAcquisition(options);
  const report=await runPublicAcquisition({...options,fetchImpl:async url=>url.endsWith('/robots.txt')?new Response('',{status:404}):new Response(null,{status:304})});
  assert.equal(report.summary.cached,1);assert.equal(report.documents[0].downloadState,'unchanged');assert.equal((await read(options.outputDir,'acquisitions/manifest.json')).sources['law-1'].versions.length,1);
});

test('offline is the API default and absent snapshots fail closed without any request',async t=>{
  let calls=0;const options=await setup(t,{mode:undefined,fetchImpl:()=>{calls++;throw new Error('no network');}});const report=await runPublicAcquisition(options);
  assert.equal(report.mode,'offline');assert.equal(report.documents[0].errorCategory,'snapshot-unavailable');assert.equal(calls,0);
});

test('tampered plan rejects before creating output or making requests',async t=>{
  const root=await directory(t);const options=await setup(t,{outputDir:path.join(root,'untouched')});const plan=JSON.parse(JSON.stringify(options.plan));plan.limits.maxRequests=99;let calls=0;
  await assert.rejects(runPublicAcquisition({...options,plan,fetchImpl:()=>{calls++;}}),/digest mismatch/);assert.equal(calls,0);assert.deepEqual(await readdir(root),[]);
});

test('source URL drift, PDF tamper, manifest tamper and cached extraction tamper reject before network',async t=>{
  for(const kind of ['source-url','pdf','manifest','extraction']){
    const options=await setup(t);const report=await runPublicAcquisition(options);let plan=options.plan;
    if(kind==='source-url'){const changed=registry();changed.documents[0].url='https://www.diputados.gob.mx/LeyesBiblio/pdf/Replacement.pdf';plan=buildAcquisitionPlan(changed,{now:capture});}
    else if(kind==='pdf')await writeFile(path.join(options.outputDir,'acquisitions/snapshots/law-1',report.documents[0].pdfSha256+'.pdf'),'%PDF-1.4 altered');
    else if(kind==='manifest'){const manifest=await read(options.outputDir,'acquisitions/manifest.json');manifest.sources['law-1'].title='tamper';await writeFile(path.join(options.outputDir,'acquisitions/manifest.json'),JSON.stringify(manifest));}
    else{const extraction=await read(options.outputDir,report.documents[0].extractionPath);extraction.records[0].text='tampered';await writeFile(path.join(options.outputDir,report.documents[0].extractionPath),JSON.stringify(extraction));}
    let calls=0;await assert.rejects(runPublicAcquisition({...options,plan,fetchImpl:()=>{calls++;}}),kind==='source-url'?/source-drift/:/integrity-error/);assert.equal(calls,0);
  }
});

test('parser and policy changes invalidate cached extraction while preserving previous extraction artifacts',async t=>{
  let count=0;const options=await setup(t,{extractor:async(...args)=>{count++;return extractor(...args);}});const first=await runPublicAcquisition(options);
  const second=await runPublicAcquisition({...options,mode:'offline',parserVersion:'new-parser-v2'});const third=await runPublicAcquisition({...options,mode:'offline',parserVersion:'new-parser-v2',policyVersion:'new-policy-v2'});
  assert.equal(count,3);assert.notEqual(first.documents[0].extractionPath,second.documents[0].extractionPath);assert.notEqual(second.documents[0].extractionPath,third.documents[0].extractionPath);assert.equal((await readdir(path.dirname(path.join(options.outputDir,first.documents[0].extractionPath)))).length,3);
  const changed=registry();changed.documents[0].title='Different synthetic header title';const fourth=await runPublicAcquisition({...options,mode:'offline',plan:buildAcquisitionPlan(changed,{now:capture})});assert.equal(count,4);assert.notEqual(fourth.documents[0].extractionPath,first.documents[0].extractionPath);
});

test('per-record segmentation anomalies and editorial source notes survive quarantine as extraction diagnostics',async t=>{
  const options=await setup(t,{extractor:async(...args)=>{const result=await extractor(...args);result.records[0].quality.anomalies.push('publisher-note-requires-manual-segmentation');result.records[0].editorialNotes=['Synthetic publisher note'];return result;}});
  const report=await runPublicAcquisition(options);const saved=await read(options.outputDir,report.documents[0].extractionPath);
  assert.deepEqual(saved.records[0].extractionDiagnostics.anomalies,['publisher-note-requires-manual-segmentation']);assert.deepEqual(saved.records[0].extractionDiagnostics.editorialNotes,['Synthetic publisher note']);assert.equal(saved.records[0].textReview,'pending');
});

test('whole-run request budget includes every robots check and stops further acquisition with zero retries',async t=>{
  let calls=0;const options=await setup(t,{plan:planFor({documents:2,limits:{maxRequests:3}}),fetchImpl:async(...args)=>{calls++;return fetchFixture(...args);}});const report=await runPublicAcquisition(options);
  assert.equal(report.state,'partial');assert.equal(calls,3);assert.equal(report.metrics.requests,3);assert.equal(report.documents[1].errorCategory,'request-budget');assert.equal(report.summary.extracted,1);
});

test('decoded body byte and document budgets enforce consumed streamed bytes, including error and redirect bodies',async t=>{
  for(const [kind,limits,response,category] of [
    ['total',{maxTotalBytes:60,maxDocumentBytes:60},()=>pdf('x'.repeat(100)),'byte-budget'],
    ['document',{maxTotalBytes:1000,maxDocumentBytes:30},()=>pdf('x'.repeat(100)),'document-byte-budget'],
    ['error',{maxTotalBytes:60,maxDocumentBytes:60},()=>new Response('x'.repeat(100),{status:503}),'byte-budget'],
    ['redirect',{maxTotalBytes:60,maxDocumentBytes:60},()=>new Response('x'.repeat(100),{status:302,headers:{location:'/unapproved.pdf'}}),'byte-budget']
  ]){
    const options=await setup(t,{plan:planFor({limits}),fetchImpl:async url=>url.endsWith('/robots.txt')?new Response('rules',{status:404}):response()});const report=await runPublicAcquisition(options);
    assert.equal(report.documents[0].errorCategory,category,kind);assert.ok(report.metrics.decodedBodyBytes>limits.maxDocumentBytes);assert.equal(report.summary.extracted,0);
  }
});

test('rate and robots crawl-delay are applied across the entire sequential run',async t=>{
  // The worker subtracts elapsed monotonic time from the robots delay. Simulate
  // unequal request durations so parallel-suite scheduling cannot change expectations.
  let clock=0;const requestDurations=[137,421,73,11];
  t.mock.method(performance,'now',()=>clock);
  const waits=[];let active=0,maxActive=0;const options=await setup(t,{plan:planFor({documents:2}),sleep:async ms=>{waits.push(ms);clock+=ms;},fetchImpl:async url=>{active++;maxActive=Math.max(maxActive,active);clock+=requestDurations.shift();await Promise.resolve();active--;return url.endsWith('/robots.txt')?new Response('User-agent: *\nCrawl-delay: 3\nAllow: /'):pdf('fixture');}});
  const report=await runPublicAcquisition(options);assert.equal(report.state,'complete');assert.equal(maxActive,1);
  assert.deepEqual(waits,[3000-137,3000-421,3000-73]);
  assert.equal(report.metrics.elapsedMs,9011);assert.deepEqual(requestDurations,[]);
});

test('robots denial/unavailability never fetches document; same-host redirects cannot expand exact authorization',async t=>{
  for(const [response,category] of [[()=>new Response('User-agent: *\nDisallow: /'),'robots-blocked'],[()=>new Response('outage',{status:503}),'robots-unavailable']]){
    const calls=[];const options=await setup(t,{fetchImpl:async url=>{calls.push(url);return response();}});const report=await runPublicAcquisition(options);assert.equal(report.documents[0].errorCategory,category);assert.deepEqual(calls,['https://www.diputados.gob.mx/robots.txt']);
  }
  for(const destination of ['/LeyesBiblio/pdf/Other.pdf','https://www.diputados.gob.mx/LeyesBiblio/pdf/Synthetic2.pdf','https://evil.example/escape.pdf']){
    const calls=[];const options=await setup(t,{fetchImpl:async url=>{calls.push(url);return url.endsWith('/robots.txt')?new Response('',{status:404}):new Response('redirect body',{status:302,headers:{location:destination}});}});const report=await runPublicAcquisition(options);assert.equal(report.documents[0].errorCategory,'redirect-denied');assert.equal(calls.length,2);assert.equal(report.metrics.decodedBodyBytes,13);
  }
});

test('opaque automatic redirects are rejected; malformed/empty documents and HTTP errors never invoke extractor',async t=>{
  for(const [response,category] of [[()=>new Response('not PDF'),'invalid-pdf'],[()=>new Response(''),'invalid-pdf'],[()=>new Response('no',{status:429}),'http-error'],[()=>{const value=pdf('fixture');Object.defineProperty(value,'url',{value:'https://evil.example/'});return value;},'redirect-denied']]){
    let count=0;const options=await setup(t,{fetchImpl:async url=>url.endsWith('/robots.txt')?new Response('',{status:404}):response(),extractor:async()=>{count++;}});const report=await runPublicAcquisition(options);assert.equal(report.documents[0].errorCategory,category);assert.equal(count,0);
  }
});

test('network and extraction errors use fixed categories without logging raw failure text',async t=>{
  for(const extraction of [false,true]){
    const options=await setup(t,{fetchImpl:extraction?fetchFixture:async()=>{throw new Error('secret fixture text that must not be logged');},extractor:async()=>{throw new Error('secret fixture text that must not be logged');}});const report=await runPublicAcquisition(options);assert.equal(report.documents[0].errorCategory,extraction?'extract-failed':'network-error');assert.doesNotMatch(await readFile(path.join(options.outputDir,'report.json'),'utf8'),/secret fixture/);
    if(!extraction)assert.doesNotMatch(await readFile(path.join(options.outputDir,'acquisitions/status.json'),'utf8'),/secret fixture/);
  }
});

test('malformed extraction provenance, page references and text hashes cannot enter quarantine cache',async t=>{
  for(const mutate of [r=>{r.sourceUrl='https://example.com/wrong';},r=>{r.pdfSha256='0'.repeat(64);},r=>{r.records[0].textSha256='0'.repeat(64);},r=>{r.records[0].sourcePages=[];},r=>{r.records=[];}]){
    const options=await setup(t,{extractor:async(...args)=>{const result=await extractor(...args);mutate(result);return result;}});const report=await runPublicAcquisition(options);assert.equal(report.documents[0].errorCategory,'extraction-invalid');assert.equal(report.summary.extracted,0);assert.ok(!(await readdir(options.outputDir)).includes('extractions'));
  }
});

test('cancellation before start makes no filesystem/network effects; during fetch stops whole run and releases lock',async t=>{
  const controller=new AbortController();controller.abort();const root=await directory(t);let calls=0;
  await assert.rejects(runPublicAcquisition({plan:planFor(),outputDir:path.join(root,'not-created'),signal:controller.signal,mode:'live',fetchImpl:()=>{calls++;}}),/cancelled/);assert.equal(calls,0);assert.deepEqual(await readdir(root),[]);
  const active=new AbortController();const options=await setup(t,{signal:active.signal,plan:planFor({documents:2}),fetchImpl:async()=>{active.abort();return new Promise(()=>{});}});const report=await runPublicAcquisition(options);
  assert.equal(report.state,'cancelled');assert.equal(report.metrics.requests,1);assert.equal(report.documents[0].errorCategory,'cancelled');assert.equal(report.documents[1].state,'not-attempted');assert.ok(!(await readdir(options.outputDir)).includes('acquisition.lock'));
});

test('per-document timeout bounds a fetch that ignores AbortSignal and whole-run duration also bounds throttling',async t=>{
  const options=await setup(t,{plan:planFor({limits:{timeoutMs:30}}),fetchImpl:async()=>new Promise(()=>{})});const report=await runPublicAcquisition(options);assert.equal(report.documents[0].errorCategory,'request-timeout');assert.ok(report.metrics.elapsedMs<2000);
  const limited=await setup(t,{plan:planFor({limits:{timeoutMs:2000,maxDurationMs:2000}}),sleep:async()=>new Promise(()=>{})});const timed=await runPublicAcquisition(limited);assert.equal(timed.documents[0].errorCategory,'duration-budget');assert.ok(timed.metrics.elapsedMs<4000);
});

test('output confinement rejects symlinks, traversal, existing unrelated contents and concurrent writers',async t=>{
  const root=await directory(t),destination=await directory(t);await symlink(destination,path.join(root,'linked'));
  for(const outputDir of [path.join(root,'linked'),root+'/../escape'])await assert.rejects(runPublicAcquisition({plan:planFor(),outputDir}),/unsafe-output/);
  const unrelated=await directory(t);await writeFile(path.join(unrelated,'keep.txt'),'keep');await assert.rejects(runPublicAcquisition({plan:planFor(),outputDir:unrelated}),/unsafe-output/);assert.equal(await readFile(path.join(unrelated,'keep.txt'),'utf8'),'keep');
  const options=await setup(t);await runPublicAcquisition(options);await writeFile(path.join(options.outputDir,'acquisition.lock'),'{}');await assert.rejects(runPublicAcquisition(options),/locked/);await rm(path.join(options.outputDir,'acquisition.lock'));
  await mkdir(path.join(options.outputDir,'trap'));await symlink(destination,path.join(options.outputDir,'trap','link'));await assert.rejects(runPublicAcquisition(options),/unsafe-output/);
});

test('CLI defaults to plan only and confines live/offline output to developer artifact root',async t=>{
  const root=await directory(t),file=path.join(root,'registry.json');await writeFile(file,JSON.stringify(registry()));
  const {stdout}=await promisify(execFile)(process.execPath,['scripts/legal-acquisition.mjs','--registry',file],{cwd:path.resolve('.')});assert.equal(JSON.parse(stdout).kind,'public-legal-acquisition-plan');assert.deepEqual((await readdir(root)).sort(),['registry.json']);
  await assert.rejects(promisify(execFile)(process.execPath,['scripts/legal-acquisition.mjs','--registry',file,'--offline','--out',root],{cwd:path.resolve('.')}));
});

test('terminating the extraction wrapper terminates nested parser workers (Node lifecycle regression)',async t=>{
  const root=await directory(t),heartbeat=path.join(root,'heartbeat');
  const inner=`const {workerData,parentPort}=require('node:worker_threads');const fs=require('node:fs');setInterval(()=>fs.appendFileSync(workerData.file,'x'),10);parentPort.postMessage('ready');`;
  const outer=`const {Worker,workerData,parentPort}=require('node:worker_threads');const child=new Worker(workerData.inner,{eval:true,workerData:{file:workerData.file}});child.on('message',()=>parentPort.postMessage('nested-ready'));`;
  const worker=new Worker(outer,{eval:true,workerData:{inner,file:heartbeat}});await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});
  await new Promise(resolve=>setTimeout(resolve,40));await worker.terminate();const before=await readFile(heartbeat,'utf8');await new Promise(resolve=>setTimeout(resolve,50));assert.equal(await readFile(heartbeat,'utf8'),before);
});
