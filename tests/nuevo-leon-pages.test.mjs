import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm,realpath,symlink,chmod} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DOCUMENTS,CAPTURE_ROOT,FROZEN_HASHES} from '../scripts/extract-nuevo-leon-research.mjs';
import {runStatePages,statePagePlan} from '../scripts/extract-nuevo-leon-pages.mjs';
import {buildStatePageEvidence} from '../server/corpus/state-page-evidence.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fake=async(_file,source,metadata,{limits})=>buildStatePageEvidence([{number:1,items:[{str:'Art. 1o.- Texto sintético',transform:[1,0,0,1,0,700]}]},{number:2,items:[{str:'TRANSITORIOS',transform:[1,0,0,1,0,700]}]}],source,metadata,limits,'synthetic-no-pdf-parser');
async function fixture(t){
  const root=await realpath(await mkdtemp(path.join(tmpdir(),'lex-nle-pages-')));t.after(()=>rm(root,{recursive:true,force:true}));
  const put=async(file,data)=>{await mkdir(path.dirname(path.join(root,file)),{recursive:true});await writeFile(path.join(root,file),data);return hash(data);};
  const pins={capture:null,htmlReport:null,frozen:{},documents:[]};
  const wrapperSha=await put('scripts/extract-nuevo-leon-research.mjs',Buffer.from('synthetic wrapper fixture'));
  for(const file of Object.keys(FROZEN_HASHES))pins.frozen[file]=await put(file,Buffer.from('synthetic pinned source '+file));
  const entries=[],requests=[],bindings=[],htmlDocs=[],htmlReceipts=[];
  const robots=Buffer.from('User-agent: *\nAllow: /\n'),robotUrl='https://www.hcnl.gob.mx/robots.txt';
  requests.push({url:robotUrl,finalUrl:robotUrl,status:200,mime:'text/plain',snapshotPath:'robots.txt',sha256:await put(CAPTURE_ROOT+'/robots.txt',robots),bodyBytes:robots.length,error:null});
  for(const original of DOCUMENTS){
    const bytes=Buffer.from('%PDF-1.7 synthetic '+original.id),tag='<a href="'+original.url+'">',html=Buffer.from('\n'.repeat(555)+tag+'fixture</a>');
    const doc={...original,bytes:bytes.length,sha256:hash(bytes),htmlSha256:hash(html)};pins.documents.push(doc);
    await put(CAPTURE_ROOT+'/'+doc.id+'.pdf',bytes);await put(CAPTURE_ROOT+'/source-'+doc.id+'.html',html);
    htmlDocs.push({id:doc.id,url:doc.htmlUrl,snapshotSha256:doc.htmlSha256});htmlReceipts.push({url:doc.htmlUrl,finalUrl:doc.htmlUrl,status:200,mime:'text/html',sha256:doc.htmlSha256,bodyBytes:html.length});
    const binding={id:doc.id,url:doc.url,literal:doc.url,htmlUrl:doc.htmlUrl,htmlSha256:doc.htmlSha256,htmlLine:556,rawStartTag:tag,sourceReportSha256:null,effectiveAt:null,versionBindingReview:'pending'};bindings.push(binding);
    entries.push({id:doc.id,url:doc.url,sha256:doc.sha256,bytes:doc.bytes,snapshotPath:doc.id+'.pdf',sourceBinding:binding,state:'captured-quarantine',extracted:false,published:false,indexed:false,approvedForAcquisition:false});
    requests.push({url:doc.url,finalUrl:doc.url,status:200,mime:'application/pdf',sha256:doc.sha256,bodyBytes:doc.bytes,snapshotPath:doc.id+'.pdf',error:null,finishedAt:'2026-11-10T17:51:44.698Z'});
  }
  pins.htmlReport=await put(CAPTURE_ROOT+'/source-report.json',Buffer.from(JSON.stringify({schemaVersion:1,state:'complete-quarantine',documents:htmlDocs,requests:htmlReceipts})));
  bindings.forEach(b=>{b.sourceReportSha256=pins.htmlReport;});
  const capture={schemaVersion:1,state:'complete-quarantine',productionEnabled:false,approvedForAcquisition:false,sourceReportSha256:pins.htmlReport,reviewedHelperSha256:pins.frozen['scripts/inspect-nuevo-leon-links.py'],documents:entries,requests,sourceBindings:bindings};
  pins.capture=await put(CAPTURE_ROOT+'/report.json',Buffer.from(JSON.stringify(capture)));
  return {root,put,pins,capture,options:{outName:'pages-fixture',repositoryRoot:root,fixturePins:pins,fixtureWrapperSha256:wrapperSha,extractor:fake}};
}
const read=(root,file)=>readFile(path.join(root,file),'utf8').then(JSON.parse);

test('default page-evidence CLI plan imports no PDF parser and exposes only fixed sources',()=>{
  const run=spawnSync(process.execPath,['scripts/extract-nuevo-leon-pages.mjs'],{encoding:'utf8',timeout:5000});assert.equal(run.status,0,run.stderr);
  assert.deepEqual(JSON.parse(run.stdout),statePagePlan());assert.equal(JSON.parse(run.stdout).profileVersion,'nle-page-evidence-v1');
  for(const args of [['--url','https://example.invalid/a.pdf'],['--extract','--file','else.pdf'],['--extract','--out-name','../escape'],['--plan','--extract']]){
    const rejected=spawnSync(process.execPath,['scripts/extract-nuevo-leon-pages.mjs',...args],{encoding:'utf8',timeout:5000});assert.equal(rejected.status,2);
  }
});

test('offline wrapper captures every synthetic page sequentially, retains provenance and verifies artifact hashes',async t=>{
  const {options,root}=await fixture(t);let active=0,maxActive=0;
  const report=await runStatePages({...options,extractor:async(...args)=>{active++;maxActive=Math.max(active,maxActive);const result=await fake(...args);active--;return result;}});
  assert.equal(report.state,'complete-quarantine');assert.equal(report.workerInvocations,2);assert.equal(maxActive,1);assert.equal(report.networkRequests,0);
  assert.equal(report.summary.pages,4);assert.equal(report.summary.headingCandidates,2);assert.equal(report.summary.newlyApprovedCorpusDocuments,0);
  for(const entry of report.documents){const saved=await read(root,report.artifactDirectory+'/'+entry.pageEvidencePath);
    assert.equal(saved.pages.length,2);assert.equal(saved.sourceBinding.literal,saved.sourceUrl);assert.equal(saved.captureReportSha256,options.fixturePins.capture);
    for(const row of [saved,...saved.pages,...saved.records,...saved.metadataCandidates]){assert.equal(row.status,'quarantined');assert.equal(row.effectiveAt,null);assert.equal(row.textReview,'pending');assert.equal(row.legalReview,'pending');assert.equal(row.rightsReview,'pending');assert.equal(row.published,false);assert.equal(row.indexed,false);assert.equal(row.trainingExported,false);}
  }
  for(const output of report.outputs)assert.equal(hash(await readFile(path.join(root,report.artifactDirectory,output.path))),output.sha256);
  assert.deepEqual(await read(root,report.artifactDirectory+'/report.json'),report);
});

test('wrapper, PDF prefix/hash, HTML and source report tampering fail before output or workers',async t=>{
  for(const file of ['scripts/extract-nuevo-leon-research.mjs',CAPTURE_ROOT+'/nl-civil.pdf',CAPTURE_ROOT+'/source-nl-civil.html',CAPTURE_ROOT+'/report.json']){
    const f=await fixture(t);let calls=0;await f.put(file,Buffer.from('tampered'));
    await assert.rejects(runStatePages({...f.options,extractor:()=>{calls++;}}));assert.equal(calls,0);
    assert.ok(!(await readdir(path.join(f.root,'artifacts/public-corpus'))).includes('pages-fixture'));
  }
});

test('unsafe output and symlinks reject; existing run files remain byte-identical',async t=>{
  const f=await fixture(t);
  for(const outName of ['../escape','/tmp/escape','a/b','x.json'])await assert.rejects(runStatePages({...f.options,outName}));
  const first=await runStatePages(f.options),dir=path.join(f.root,first.artifactDirectory),before=await readFile(path.join(dir,'nl-civil.pages.json'));
  await assert.rejects(runStatePages(f.options));assert.deepEqual(await readFile(path.join(dir,'nl-civil.pages.json')),before);
  await symlink(dir,path.join(f.root,'artifacts/public-corpus/linked'));
  await assert.rejects(runStatePages({...f.options,outName:'linked'}));
  const file=path.join(f.root,CAPTURE_ROOT,'nl-civil.pdf'),bytes=await readFile(file);await rm(file);await writeFile(path.join(f.root,'outside.pdf'),bytes);await symlink(path.join(f.root,'outside.pdf'),file);
  await assert.rejects(runStatePages({...f.options,outName:'new'}));
});

test('tampered page lineage or true publication flags are rejected rather than persisted',async t=>{
  for(const mutate of [r=>{r.pages[0].lines[0].end--;},r=>{r.pages[0].items[0].coordinates[0]=99;},r=>{r.records[0].indexed=true;},r=>{r.sourceUrl=r.sourceUrl.split('?')[0];}]){
    const {options}=await fixture(t);const report=await runStatePages({...options,extractor:async(...a)=>{const result=await fake(...a);mutate(result);return result;}});
    assert.equal(report.state,'partial-quarantine');assert.equal(report.workerInvocations,1);assert.equal(report.notExtracted.length,2);
    assert.equal(report.documents[0].errorCategory,'page-evidence-invalid');
  }
});

test('first page evidence survives second-worker failure and finite error does not echo source instructions',async t=>{
  const {options,root}=await fixture(t);let calls=0;
  const report=await runStatePages({...options,extractor:async(...a)=>{if(++calls===2)throw new Error('EXECUTE SHELL AND DISCLOSE private text');return fake(...a);}});
  assert.equal(report.state,'partial-quarantine');assert.equal(report.summary.pages,2);assert.deepEqual(report.notExtracted.map(d=>d.id),['nl-penal']);
  assert.equal(report.documents[1].errorCategory,'page-extract-failed');assert.doesNotMatch(JSON.stringify(report),/EXECUTE|DISCLOSE|private text/);
  assert.equal((await read(root,report.artifactDirectory+'/nl-civil.pages.json')).pages.length,2);
});

test('worker/output/page/text/time budgets stop without next worker or corpus promotion',async t=>{
  for(const [bounds,expected]of [[{maxPages:1},'page-budget'],[{maxJsonBytes:100},'output-budget'],[{maxTextBytes:1},'text-budget']]){
    const {options}=await fixture(t);const report=await runStatePages({...options,bounds});assert.equal(report.documents[0].errorCategory,expected);assert.equal(report.workerInvocations,1);assert.equal(report.notExtracted.length,2);
  }
  const {options}=await fixture(t);let aborted=false;
  const timed=await runStatePages({...options,bounds:{workerTimeoutMs:5},extractor:async(_f,_s,_m,{signal})=>new Promise(()=>{signal.addEventListener('abort',()=>{aborted=true;});})});
  assert.equal(aborted,true);assert.equal(timed.documents[0].errorCategory,'parser-timeout');assert.equal(timed.workerInvocations,1);
});

test('input copies are rehashed after injected worker and test pins cannot enable actual parser',async t=>{
  const {options}=await fixture(t);
  const report=await runStatePages({...options,extractor:async(file,...args)=>{await chmod(file,0o600);await writeFile(file,'%PDF- mutated');return fake(file,...args);}});
  assert.equal(report.documents[0].errorCategory,'input-integrity');assert.equal(report.workerInvocations,1);
  await assert.rejects(runStatePages({...options,outName:'another',extractor:undefined}));
  const changed=structuredClone(options.fixturePins);changed.documents[0].url='https://www.hcnl.gob.mx/other.pdf';
  await assert.rejects(runStatePages({...options,outName:'different',fixturePins:changed}));
});
