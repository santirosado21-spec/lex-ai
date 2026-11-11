import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {validateProtocol,validateCases,validateCorpus,validatePredictionArtifact,maximumMatches,wilson95,scorePredictions,loadManifest} from '../scripts/eval-privacy.mjs';

// Tests use this public frozen PROTOCOL, custom tiny labels and the author's own DEV only.
// Never read or score the independently authored eval/privacy/heldout.jsonl here.
const frozen=JSON.parse(await readFile(new URL('../eval/privacy/protocol.json',import.meta.url),'utf8'));
const protocol=()=>({...structuredClone(frozen),categories:['person','email'],mandatoryCategories:['email'],corpusRules:{...frozen.corpusRules,heldoutMinEntitiesPerCategory:1,heldoutMinCleanCases:1,heldoutMinBlockedPerReason:1}});
const PH='a'.repeat(64),CH='b'.repeat(64);
const copy=value=>structuredClone(value);
const digest=value=>createHash('sha256').update(value).digest('hex');
const scope={workspaceId:'TEST_FIRM',matterId:'TEST_MATTER',threadId:'TEST_THREAD'};
function caseRow(id,{split='heldout',category='person',reason=null,clean=false,text=`${split} ${id}: ABCDE synthetic fixture`}={}) {
 const start=text.indexOf('ABCDE'),row={id,split,templateGroup:`${split}_GROUP_${id}`,synthetic:true,scope:copy(scope),segments:[{id:'SEG',path:'history.content',text,originScope:copy(scope),classification:'synthetic'}],entities:clean?[]:[{segmentId:'SEG',start,end:start+5,category}],expectedStatus:reason?'blocked':'complete',blockReason:reason,preserve:[]};
 if(reason==='scope_mismatch')row.segments[0].originScope.matterId='FOREIGN_MATTER';
 if(reason==='unknown_provenance'){row.segments[0].originScope=null;row.segments[0].classification='unknown';}
 return row;
}
function cases(split='heldout') {
 return [caseRow(`${split}_PERSON`,{split}),caseRow(`${split}_EMAIL`,{split,category:'email'}),caseRow(`${split}_CLEAN`,{split,clean:true}),...frozen.blockReasons.map((reason,index)=>caseRow(`${split}_BLOCK_${index}`,{split,reason}))];
}
const artifact=rows=>({candidateId:'SYNTHETIC_TEST_CANDIDATE',protocolSha256:PH,corpusSha256:CH,predictions:rows.map(row=>({id:row.id,status:row.expectedStatus,detections:copy(row.entities)}))});
const score=(rows,changes={})=>scorePredictions({protocol:protocol(),cases:rows,split:rows[0].split,artifact:artifact(rows),protocolSha256:PH,corpusSha256:CH,...changes});

test('protocol and authored dev corpus validate without inspecting actual heldout labels',async()=>{
 assert.equal(validateProtocol(frozen),frozen);
 const dev=(await readFile(new URL('../eval/privacy/dev.jsonl',import.meta.url),'utf8')).trim().split('\n').map(JSON.parse);
 const {coverage}=validateCases(dev,{protocol:frozen,split:'dev'});
 assert.equal(coverage.cases,36);assert.equal(coverage.cleanCases,6);
 assert.ok(Object.values(coverage.entities).every(count=>count>=2));assert.ok(Object.values(coverage.blocked).every(count=>count===1));
 for(const mutate of [p=>{p.categories.push('person');},p=>{p.experimentalGates.exactPrecisionMinimumPerCategory=NaN;},p=>{p.experimentalGates.minimumDenominatorsMustPass=false;},p=>{p.corpusRules.heldoutMinCleanCases=0;}]) {
  const p=protocol();mutate(p);assert.throws(()=>validateProtocol(p));
 }
});

test('case schema rejects duplicate IDs/gold ranges, non-synthetic data and malformed preservation annotations',()=>{
 for(const mutate of [
  rows=>rows.push(copy(rows[0])),rows=>{rows[0].entities.push(copy(rows[0].entities[0]));},rows=>{rows[0].synthetic=false;},
  rows=>{rows[0].extra=true;},rows=>{rows[0].segments[0].path='';},rows=>{rows[0].segments[0].classification='private';},
  rows=>{rows[0].preserve=[{segmentId:'SEG',start:0,end:2,kind:'unknown'}];},
  rows=>{rows[0].preserve=[{segmentId:'MISSING',start:0,end:2,kind:'date'}];},
 ]) {const rows=cases();mutate(rows);assert.throws(()=>validateCases(rows,{protocol:protocol(),split:'heldout'}));}
});

test('UTF16 offsets are finite nonempty half-open ranges and never bisect a surrogate pair',()=>{
 const row=caseRow('UNICODE',{text:'A🧪BCDEF'});row.entities=[{segmentId:'SEG',start:1,end:3,category:'person'}];
 assert.doesNotThrow(()=>validateCases([row],{protocol:protocol(),split:'heldout'}));
 for(const [start,end] of [[1,2],[2,3],[-1,2],[3,3],[3,99],[0.5,2],[NaN,2],[0,Infinity]]) {
  const malformed=copy(row);Object.assign(malformed.entities[0],{start,end});assert.throws(()=>validateCases([malformed],{protocol:protocol(),split:'heldout'}));
 }
 const badPreserve=copy(row);badPreserve.preserve=[{segmentId:'SEG',start:1,end:2,kind:'citation'}];assert.throws(()=>validateCases([badPreserve],{protocol:protocol(),split:'heldout'}));
});

test('scope and classification contradictions cannot be complete; null origin is strictly blocked unknown provenance',()=>{
 for(const mutate of [
  row=>{row.segments[0].originScope.workspaceId='OTHER';},row=>{row.segments[0].classification='unknown';},
  row=>{row.segments[0].originScope=null;},row=>{row.expectedStatus='blocked';row.blockReason='scope_mismatch';},
  row=>{row.expectedStatus='blocked';row.blockReason='unknown_provenance';},
 ]) {const row=caseRow('SCOPE');mutate(row);assert.throws(()=>validateCases([row],{protocol:protocol(),split:'heldout'}));}
 const unknown=caseRow('UNKNOWN',{reason:'unknown_provenance'});assert.doesNotThrow(()=>validateCases([unknown],{protocol:protocol(),split:'heldout'}));
 unknown.blockReason='partial_extraction';assert.throws(()=>validateCases([unknown],{protocol:protocol(),split:'heldout'}));
});

test('split IDs, template groups and raw segment texts are independently disjoint; coverage is counted by category/reason',()=>{
 const splits={dev:cases('dev'),heldout:cases()},result=validateCorpus({protocol:protocol(),splits});assert.deepEqual(result.heldoutMinimumFailures,[]);
 for(const mutate of [
  splits=>{splits.heldout[0].id=splits.dev[0].id;},splits=>{splits.heldout[0].templateGroup=splits.dev[0].templateGroup;},
  splits=>{splits.heldout[0].segments[0].text=splits.dev[0].segments[0].text;splits.heldout[0].entities=copy(splits.dev[0].entities);},
 ]) {const bad=copy(splits);mutate(bad);assert.throws(()=>validateCorpus({protocol:protocol(),splits:bad}),/Contaminated/);}
 const short=copy(splits);short.heldout=short.heldout.filter(row=>row.entities.length);assert.ok(validateCorpus({protocol:protocol(),splits:short}).heldoutMinimumFailures.includes('cleanCases'));
});

test('prediction artifacts reject missing candidate, extra fields, stale hashes and missing/duplicate/unknown IDs',()=>{
 const rows=cases();
 for(const mutate of [
  value=>{value.candidateId='';},value=>{delete value.candidateId;},value=>{value.extra=true;},value=>{value.protocolSha256=CH;},value=>{value.corpusSha256=PH;},
  value=>value.predictions.pop(),value=>value.predictions.push(copy(value.predictions[0])),value=>{value.predictions[0].id='UNKNOWN';},
  value=>{value.predictions[0].status='safe';},value=>{value.predictions[0].extra=true;},
 ]) {const value=artifact(rows);mutate(value);assert.throws(()=>validatePredictionArtifact(value,{protocol:protocol(),cases:rows,split:'heldout',protocolSha256:PH,corpusSha256:CH}));}
});

test('prediction duplicate detections, unknown categories/segments and invalid ranges fail before any scoring',()=>{
 const rows=cases();
 for(const mutate of [
  p=>p.detections.push(copy(p.detections[0])),p=>{p.detections[0].category='unknown';},p=>{p.detections[0].segmentId='OTHER';},
  p=>{p.detections[0].start=-1;},p=>{p.detections[0].end=Infinity;},p=>{p.detections[0].start=0.5;},p=>{p.detections[0].score=1;},
 ]) {const value=artifact(rows);mutate(value.predictions[0]);assert.throws(()=>score(rows,{artifact:value}));}
});

test('overlap uses independent maximum-cardinality matching instead of greedy/double-counted pairs',()=>{
 const entity=(start,end,category='person',segmentId='SEG')=>({segmentId,start,end,category});
 const gold=[entity(0,3),entity(2,5)],predictions=[entity(0,5),entity(0,1)];
 assert.equal(maximumMatches(gold,predictions,true),2);assert.equal(maximumMatches(gold,predictions,false),0);
 assert.equal(maximumMatches([entity(0,3)],[entity(0,1),entity(1,2)],true),1);
 assert.equal(maximumMatches(gold,[entity(0,3),entity(0,1)],true),2); // exact-first greedy would lose one
 assert.equal(maximumMatches(gold,[entity(0,3),entity(0,1)],false),1);
 assert.equal(maximumMatches(gold,[entity(0,5,'email'),entity(0,5,'person','OTHER')],true),0);
});

test('exact and overlap per-category counts, micro and macro expose imperfect spans and missing denominators',()=>{
 const rows=[caseRow('METRIC')],value=artifact(rows),gold=rows[0].entities[0];
 value.predictions[0].detections=[{...gold,end:gold.end-1},{...gold,start:0,end:1}];
 const report=score(rows,{artifact:value});
 assert.deepEqual([report.metrics.exact.micro.tp,report.metrics.exact.micro.fp,report.metrics.exact.micro.fn],[0,2,1]);
 assert.deepEqual([report.metrics.overlap.micro.tp,report.metrics.overlap.micro.fp,report.metrics.overlap.micro.fn],[1,1,0]);
 assert.equal(report.metrics.overlap.micro.precision,0.5);assert.equal(report.metrics.overlap.micro.recall,1);
 assert.equal(report.metrics.exact.perCategory.email.precision,null);assert.equal(report.metrics.exact.perCategory.email.recall,null);
 assert.equal(report.metrics.exact.perCategory.email.recallInsufficient,true);assert.equal(report.metrics.exact.macro.precisionCategories,1);assert.equal(report.metrics.exact.macro.insufficient,true);
 assert.equal(report.experimentalGate.status,'incomplete');
});

test('blocked entity rows with empty detections contribute false negatives despite correct blocked status',()=>{
 const rows=cases(),value=artifact(rows),blocked=rows.filter(row=>row.expectedStatus==='blocked');
 for(const prediction of value.predictions)if(prediction.status==='blocked')prediction.detections=[];
 const report=score(rows,{artifact:value});assert.equal(report.blockedStatus.rate,1);
 assert.equal(report.metrics.exact.perCategory.person.fn,blocked.length);assert.equal(report.experimentalGate.status,'failed');
 assert.ok(report.experimentalGate.failures.includes('recall:person'));assert.equal(report.routingSafety,'not-evaluated');assert.equal(report.preservation,'not-evaluated');
});

test('status compliance and clean complete rate remain separate from entity matching and gate promotion',()=>{
 const rows=cases(),value=artifact(rows);value.predictions.find(p=>p.id.endsWith('CLEAN')).status='blocked';value.predictions.find(p=>p.status==='blocked'&&!p.id.endsWith('CLEAN')).status='complete';
 const report=score(rows,{artifact:value});assert.equal(report.metrics.exact.micro.recall,1);assert.equal(report.cleanComplete.rate,0);assert.ok(report.blockedStatus.rate<1);
 assert.equal(report.experimentalGate.status,'failed');assert.ok(report.experimentalGate.failures.includes('blockedStatusRate'));assert.ok(report.experimentalGate.failures.includes('cleanCompleteRate'));
 const dev=score(cases('dev'));assert.equal(dev.experimentalGate.status,'diagnostic-only');assert.equal(dev.experimentalGate.minimumsApplied,false);
 const good=score(rows);assert.equal(good.experimentalGate.status,'eligible-for-integration-evaluation');assert.match(good.experimentalGate.meaning,/never safe-egress/);
});

test('Wilson95 and zero-miss upper bounds report uncertainty; empty denominators are null',()=>{
 assert.equal(wilson95(0,0),null);assert.throws(()=>wilson95(2,1));
 const interval=wilson95(20,20);assert.ok(Math.abs(interval.lower-0.8388748419471806)<1e-12);assert.equal(interval.upper,1);
 const report=score(cases()),email=report.metrics.exact.perCategory.email;
 assert.ok(Math.abs(email.zeroMissUpper95-0.95)<1e-12);assert.ok(report.metrics.exact.micro.zeroMissUpper95>0);
 const empty=caseRow('EMPTY',{clean:true}),zero=score([empty]);assert.equal(zero.metrics.exact.micro.precision,null);assert.equal(zero.metrics.exact.micro.recall,null);assert.equal(zero.metrics.exact.micro.zeroMissUpper95,null);assert.equal(zero.blockedStatus.rate,null);
});

async function fixture(t) {
 const dir=await mkdtemp(path.join(tmpdir(),'lex-privacy-eval-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const guide='Synthetic custom test annotation guide.',p=protocol();p.annotationGuideSha256=digest(guide);
 const splits={dev:cases('dev'),heldout:cases()},raw={protocol:JSON.stringify(p),dev:splits.dev.map(row=>JSON.stringify(row)).join('\n')+'\n',heldout:splits.heldout.map(row=>JSON.stringify(row)).join('\n')+'\n'};
 const provenance=JSON.stringify({protocolSha256:digest(raw.protocol),corpusSha256:digest(raw.heldout),annotationGuideSha256:digest(guide),annotationGuideRead:true,syntheticOnly:true,noDevRead:true,candidateOutputsSeen:false,configuredModel:'test-fixture-author',observedModelId:null});
 const manifest={version:1,protocol:{file:'protocol.json',sha256:digest(raw.protocol)},splits:{dev:{file:'dev.jsonl',sha256:digest(raw.dev)},heldout:{file:'heldout.jsonl',sha256:digest(raw.heldout)}},provenance:{protocolFrozenBeforeHeldout:true,syntheticOnly:true,candidateEvaluated:false,heldoutAuthor:'INDEPENDENT_TEST_AUTHOR',heldoutProvenance:{file:'provenance.json',sha256:digest(provenance)},annotationGuide:{file:'annotation-guide.md',sha256:digest(guide)}}};
 for(const [key,text] of Object.entries(raw))await writeFile(path.join(dir,key==='protocol'?'protocol.json':`${key}.jsonl`),text);
 await writeFile(path.join(dir,'provenance.json'),provenance);
 await writeFile(path.join(dir,'annotation-guide.md'),guide);
 const manifestPath=path.join(dir,'manifest.json');await writeFile(manifestPath,JSON.stringify(manifest));
 return {dir,manifest,manifestPath,splits,save:()=>writeFile(manifestPath,JSON.stringify(manifest))};
}

test('manifest loader verifies actual bytes and rejects traversal and outside-directory symlinks',async t=>{
 const f=await fixture(t);assert.equal((await loadManifest(f.manifestPath)).validation.heldout.cases,9);
 await writeFile(path.join(f.dir,'dev.jsonl'),'modified');await assert.rejects(loadManifest(f.manifestPath),/hash mismatch/);
 const traversal=await fixture(t);traversal.manifest.splits.dev.file='../dev.jsonl';await traversal.save();await assert.rejects(loadManifest(traversal.manifestPath),/path\/hash/);
 const outside=await fixture(t),linked=await fixture(t);await symlink(path.join(outside.dir,'dev.jsonl'),path.join(linked.dir,'external.jsonl'));linked.manifest.splits.dev.file='external.jsonl';await linked.save();await assert.rejects(loadManifest(linked.manifestPath),/escapes/);
});

test('manifest provenance assertions and referenced provenance hashes fail closed without attesting model identity',async t=>{
 for(const mutate of [
  f=>{f.manifest.provenance={};},f=>{delete f.manifest.provenance;},f=>{f.manifest.provenance.candidateEvaluated=true;},
  f=>{f.manifest.provenance.protocolFrozenBeforeHeldout=false;},f=>{f.manifest.provenance.heldoutAuthor='';},
  f=>{delete f.manifest.provenance.annotationGuide;},
 ]) {const f=await fixture(t);mutate(f);await f.save();await assert.rejects(loadManifest(f.manifestPath));}
 for(const mutate of [
  p=>{p.protocolSha256=PH;},p=>{p.corpusSha256=CH;},p=>{delete p.corpusSha256;},p=>{p.noDevRead=false;},p=>{p.candidateOutputsSeen=true;},p=>{p.syntheticOnly=false;},
  p=>{delete p.configuredModel;},p=>{p.observedModelId=42;},p=>{delete p.observedModelId;},
  p=>{p.annotationGuideSha256=PH;},p=>{p.annotationGuideRead=false;},p=>{delete p.annotationGuideRead;},
 ]) {
  const f=await fixture(t),file=path.join(f.dir,'provenance.json'),provenance=JSON.parse(await readFile(file,'utf8'));mutate(provenance);
  const raw=JSON.stringify(provenance);await writeFile(file,raw);f.manifest.provenance.heldoutProvenance.sha256=digest(raw);await f.save();await assert.rejects(loadManifest(f.manifestPath),/provenance/);
 }
 const stale=await fixture(t);await writeFile(path.join(stale.dir,'provenance.json'),'{}');await assert.rejects(loadManifest(stale.manifestPath),/hash mismatch/);
 const changedGuide=await fixture(t);await writeFile(path.join(changedGuide.dir,'annotation-guide.md'),'Changed guide');await assert.rejects(loadManifest(changedGuide.manifestPath),/hash mismatch/);
 const unboundGuide=await fixture(t),rawProtocol=JSON.parse(await readFile(path.join(unboundGuide.dir,'protocol.json'),'utf8'));rawProtocol.annotationGuideSha256=PH;
 const raw=JSON.stringify(rawProtocol);await writeFile(path.join(unboundGuide.dir,'protocol.json'),raw);unboundGuide.manifest.protocol.sha256=digest(raw);
 const provenanceFile=path.join(unboundGuide.dir,'provenance.json'),provenance=JSON.parse(await readFile(provenanceFile,'utf8'));provenance.protocolSha256=digest(raw);
 const rawProvenance=JSON.stringify(provenance);await writeFile(provenanceFile,rawProvenance);unboundGuide.manifest.provenance.heldoutProvenance.sha256=digest(rawProvenance);await unboundGuide.save();
 await assert.rejects(loadManifest(unboundGuide.manifestPath),/annotation guide hash/);
 const replacedCorpus=await fixture(t),replacement=cases();replacement[0].templateGroup='REPLACED_AUTHOR_TEMPLATE';
 const replacementRaw=replacement.map(row=>JSON.stringify(row)).join('\n')+'\n';await writeFile(path.join(replacedCorpus.dir,'heldout.jsonl'),replacementRaw);
 replacedCorpus.manifest.splits.heldout.sha256=digest(replacementRaw);await replacedCorpus.save();
 await assert.rejects(loadManifest(replacedCorpus.manifestPath),/heldout provenance/);
});

test('CLI validates corpus without candidate PASS and scores only explicit custom prediction files',async t=>{
 const f=await fixture(t),cli=path.resolve('scripts/eval-privacy.mjs'),exec=promisify(execFile);
 const validated=JSON.parse((await exec(process.execPath,[cli,'validate','--manifest',f.manifestPath])).stdout);
 assert.equal(validated.status,'corpus-valid');assert.equal(validated.candidateEvaluation,'not-performed');assert.equal(JSON.stringify(validated).includes('PASS'),false);
 for(const split of ['dev','heldout']) {
  const value=artifact(f.splits[split]);value.protocolSha256=f.manifest.protocol.sha256;value.corpusSha256=f.manifest.splits[split].sha256;
  const input=path.join(f.dir,`${split}-predictions.json`),output=path.join(f.dir,`${split}-report.json`);await writeFile(input,JSON.stringify(value));
  const args=[cli,'score','--manifest',f.manifestPath,'--split',split,'--predictions',input,'--output',output];
  if(split==='dev')await assert.rejects(exec(process.execPath,args),error=>error.code===3);else await exec(process.execPath,args);
  const report=JSON.parse(await readFile(output,'utf8'));assert.equal(report.split,split);assert.equal(report.routingSafety,'not-evaluated');assert.equal(report.preservation,'not-evaluated');
  await assert.rejects(exec(process.execPath,[...args.slice(0,-1),input]),error=>error.code===2&&/overwrite/.test(error.stderr));
 }
 await assert.rejects(exec(process.execPath,[cli,'score','--manifest',f.manifestPath]),error=>error.code===2);
});

test('CLI distinguishes failed candidate, incomplete heldout and malformed predictions with nonzero exits',async t=>{
 const f=await fixture(t),cli=path.resolve('scripts/eval-privacy.mjs'),exec=promisify(execFile);
 const input=path.join(f.dir,'custom-predictions.json'),output=path.join(f.dir,'custom-report.json');
 const args=[cli,'score','--manifest',f.manifestPath,'--split','heldout','--predictions',input,'--output',output];
 const value=artifact(f.splits.heldout);value.protocolSha256=f.manifest.protocol.sha256;value.corpusSha256=f.manifest.splits.heldout.sha256;value.predictions[0].detections=[];
 await writeFile(input,JSON.stringify(value));await assert.rejects(exec(process.execPath,args),error=>error.code===1);
 assert.equal(JSON.parse(await readFile(output,'utf8')).experimentalGate.status,'failed');
 f.splits.heldout=f.splits.heldout.filter(row=>!row.id.endsWith('CLEAN'));
 const raw=f.splits.heldout.map(row=>JSON.stringify(row)).join('\n')+'\n';await writeFile(path.join(f.dir,'heldout.jsonl'),raw);f.manifest.splits.heldout.sha256=digest(raw);await f.save();
 const provenancePath=path.join(f.dir,'provenance.json'),provenance=JSON.parse(await readFile(provenancePath,'utf8'));provenance.corpusSha256=digest(raw);
 const provenanceRaw=JSON.stringify(provenance);await writeFile(provenancePath,provenanceRaw);f.manifest.provenance.heldoutProvenance.sha256=digest(provenanceRaw);await f.save();
 const incomplete=artifact(f.splits.heldout);incomplete.protocolSha256=f.manifest.protocol.sha256;incomplete.corpusSha256=f.manifest.splits.heldout.sha256;
 await writeFile(input,JSON.stringify(incomplete));await assert.rejects(exec(process.execPath,args),error=>error.code===3);
 assert.equal(JSON.parse(await readFile(output,'utf8')).experimentalGate.status,'incomplete');
 await assert.rejects(exec(process.execPath,[cli,'validate','--manifest',f.manifestPath]),error=>error.code===1&&JSON.parse(error.stdout).status==='corpus-incomplete');
 incomplete.candidateId='';await writeFile(input,JSON.stringify(incomplete));await assert.rejects(exec(process.execPath,args),error=>error.code===2);
});
