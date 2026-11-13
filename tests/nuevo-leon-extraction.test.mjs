import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm,realpath,symlink,chmod} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {extractArticles} from '../server/legal-library.mjs';
import {CAPTURE_ROOT,DOCUMENTS,FROZEN_HASHES,extractionPlan,runResearchExtraction,verifyInputs,LIMITS} from '../scripts/extract-nuevo-leon-research.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const date='2026-11-10T17:51:42.589Z';
const article='ARTÍCULO 1.- Este texto totalmente sintético prueba referencias de página y procedencia sin reproducir datos de personas o asuntos.';
// La herramienta NL está CONGELADA en producción al parser pineado
// (FROZEN_HASHES: server/legal-library.mjs@84d8eb4d, EXTRACTOR_VERSION=22).
// Este fixture emula ESE parser pineado: parsea con el código vigente y
// re-sella extractorVersion al contrato pineado (22), que es lo que
// quarantineExtraction exige. Sin el re-sello, cualquier bump de
// EXTRACTOR_VERSION (p. ej. v24 federal) rompe estos tests aunque la
// herramienta de producción siga correctamente cerrada por source-drift.
const fake=async(_file,source,metadata)=>({...await extractArticles([{number:1,text:article+'\nTRANSITORIOS'}],source,metadata),extractorVersion:22});

async function setup(t){
  const root=await realpath(await mkdtemp(path.join(tmpdir(),'lex-nl-offline-')));t.after(()=>rm(root,{recursive:true,force:true}));
  const put=async(relative,bytes)=>{const file=path.join(root,relative);await mkdir(path.dirname(file),{recursive:true});await writeFile(file,bytes);return hash(bytes);};
  const pins={capture:null,htmlReport:null,frozen:{},documents:[]};
  for(const file of Object.keys(FROZEN_HASHES))pins.frozen[file]=await put(file,Buffer.from('synthetic frozen source fixture: '+file));
  const documents=[],requests=[],bindings=[],htmlDocs=[],htmlRequests=[];
  const robots=Buffer.from('User-agent: *\nAllow: /\n');
  requests.push({url:'https://www.hcnl.gob.mx/robots.txt',finalUrl:'https://www.hcnl.gob.mx/robots.txt',status:200,mime:'text/plain',snapshotPath:'robots.txt',error:null,sha256:await put(CAPTURE_ROOT+'/robots.txt',robots),bodyBytes:robots.length});
  for(const original of DOCUMENTS){
    const pdf=Buffer.from('%PDF-1.7 synthetic fixture '+original.id),tag='<a href="'+original.url+'">';
    const html=Buffer.from('\n'.repeat(555)+tag+'Synthetic fixture</a>\n');
    const doc={...original,bytes:pdf.length,sha256:hash(pdf),htmlSha256:hash(html)};pins.documents.push(doc);
    await put(CAPTURE_ROOT+'/'+doc.id+'.pdf',pdf);await put(CAPTURE_ROOT+'/source-'+doc.id+'.html',html);
    htmlDocs.push({id:doc.id,url:doc.htmlUrl,snapshotSha256:doc.htmlSha256});
    htmlRequests.push({url:doc.htmlUrl,finalUrl:doc.htmlUrl,status:200,mime:'text/html',sha256:doc.htmlSha256,bodyBytes:html.length});
    bindings.push({id:doc.id,url:doc.url,literal:doc.url,htmlUrl:doc.htmlUrl,htmlSha256:doc.htmlSha256,htmlLine:556,rawStartTag:tag,sourceReportSha256:null,effectiveAt:null,versionBindingReview:'pending'});
    requests.push({url:doc.url,finalUrl:doc.url,status:200,mime:'application/pdf',sha256:doc.sha256,bodyBytes:doc.bytes,snapshotPath:doc.id+'.pdf',error:null,finishedAt:date});
  }
  const htmlReport={schemaVersion:1,state:'complete-quarantine',documents:htmlDocs,requests:htmlRequests};
  pins.htmlReport=await put(CAPTURE_ROOT+'/source-report.json',Buffer.from(JSON.stringify(htmlReport)));
  for(const binding of bindings)binding.sourceReportSha256=pins.htmlReport;
  for(const [i,doc] of pins.documents.entries())documents.push({id:doc.id,url:doc.url,sha256:doc.sha256,bytes:doc.bytes,snapshotPath:doc.id+'.pdf',sourceBinding:bindings[i],state:'captured-quarantine',extracted:false,published:false,indexed:false,approvedForAcquisition:false});
  const capture={schemaVersion:1,state:'complete-quarantine',productionEnabled:false,approvedForAcquisition:false,sourceReportSha256:pins.htmlReport,reviewedHelperSha256:pins.frozen['scripts/inspect-nuevo-leon-links.py'],documents,requests,sourceBindings:bindings};
  pins.capture=await put(CAPTURE_ROOT+'/report.json',Buffer.from(JSON.stringify(capture)));
  return {root,pins,put,capture,htmlReport,options:{outName:'extraction-fixture',repositoryRoot:root,fixturePins:pins,extractor:fake}};
}
const read=(root,file)=>readFile(path.join(root,file),'utf8').then(JSON.parse);

test('default CLI plan has fixed two local sources and no parsing or artifact requirement',()=>{
  const result=spawnSync(process.execPath,['scripts/extract-nuevo-leon-research.mjs'],{encoding:'utf8',timeout:5000});
  assert.equal(result.status,0,result.stderr);const proposal=JSON.parse(result.stdout);
  assert.equal(proposal.action,'plan');assert.equal(proposal.documents.length,2);assert.equal(proposal.productionEnabled,false);
  assert.equal(proposal.captureReportSha256,'888972f9e20cfc17f573ed43b37d23ab3c00db4efc2b963ed7b1483478759246');
  assert.equal(proposal.documents[0].url,DOCUMENTS[0].url);assert.equal(proposal.trainingExported,false);
  assert.deepEqual(proposal,extractionPlan());
  for(const args of [['--url','https://evil.invalid'],['--extract','--file','other.pdf'],['--extract','--out-name','../escape'],['--plan','--extract']]){
    const rejected=spawnSync(process.execPath,['scripts/extract-nuevo-leon-research.mjs',...args],{encoding:'utf8',timeout:5000});assert.equal(rejected.status,2);
  }
});

test('offline extraction preserves exact source/hash/pages, quarantines every record and never exports split flags',async t=>{
  const {options,root}=await setup(t);let active=0,maxActive=0,calls=0;
  const report=await runResearchExtraction({...options,extractor:async(file,source,metadata)=>{active++;maxActive=Math.max(active,maxActive);calls++;const raw=await fake(file,source,metadata);active--;raw.published=true;raw.records[0].indexed=true;return raw;}});
  assert.equal(report.state,'complete-quarantine');assert.equal(calls,2);assert.equal(maxActive,1);assert.equal(report.networkRequests,0);
  assert.equal(report.notExtracted.length,0);assert.equal(report.parserInvocations,2);
  for(const entry of report.documents){
    const saved=await read(root,report.artifactDirectory+'/'+entry.extractionPath);const record=saved.records[0];
    assert.equal(record.text,article);assert.equal(record.textSha256,hash(article));assert.deepEqual(record.sourcePages,[1]);
    assert.match(record.versionId,/@sha256:[a-f0-9]{64}$/);assert.equal(record.sourceUrl,options.fixturePins.documents.find(d=>d.id===entry.id).url);
    assert.equal(record.capturedAt,date);assert.equal(saved.parserDateBasis,'capture-date-fallback-not-legal-date');
    assert.equal(saved.parserTechnicalVersionDate,'2026-11-10');assert.equal(saved.declaredAmendedAt,null);
    assert.equal(saved.coverage.exportableArticles,undefined);assert.equal(saved.coverage.structuralCandidateCount,1);
    for(const value of [saved,record]){assert.equal(value.status,'quarantined');assert.equal(value.rightsReview,'pending');assert.equal(value.textReview,'pending');assert.equal(value.legalReview,'pending');assert.equal(value.effectiveAt,null);assert.equal(value.published,false);assert.equal(value.indexed,false);assert.equal(value.trainingExported,false);assert.equal(value.approvedForAcquisition,false);}
    assert.equal(record.split,undefined);assert.equal(record.splitGroup,undefined);assert.equal(saved.diagnostics.rawPageTextStored,false);
  }
  for(const output of report.outputs)assert.equal(hash(await readFile(path.join(root,report.artifactDirectory,output.path))),output.sha256);
  assert.deepEqual(await read(root,report.artifactDirectory+'/report.json'),report);
});

test('abbreviated Civil headings are recognized and preserved in quarantine with provenance',async t=>{
  const {options,root}=await setup(t);
  const report=await runResearchExtraction({...options,extractor:async(_file,source,meta)=>({...await extractArticles([{number:1,text:'Art. 1o.- Texto sintético con encabezado abreviado y contenido propio verificable para segmentación.\nTRANSITORIOS'}],source,meta),extractorVersion:22})});
  assert.equal(report.state,'complete-quarantine');assert.equal(report.documents.length,2);
  for(const d of report.documents){const saved=await read(root,report.artifactDirectory+'/'+d.extractionPath);assert.equal(saved.records.length,1);assert.equal(saved.records[0].articleId,'1');assert.equal(saved.records[0].status,'quarantined');assert.equal(saved.records[0].trainingExported,false);assert.equal(saved.coverage.pages,1);}
});

test('declared reform is recognized only from parser text; query dates never supply it',async t=>{
  const {options,root}=await setup(t);
  const report=await runResearchExtraction({...options,extractor:async(_file,source,meta)=>({...await extractArticles([{number:1,text:'Última Reforma 02/01/2025\n'+article+'\nTRANSITORIOS'}],source,meta),extractorVersion:22})});
  const saved=await read(root,report.artifactDirectory+'/nl-civil.extraction.json');
  assert.equal(saved.declaredAmendedAt,'2025-01-02');assert.equal(saved.parserTechnicalVersionDate,'2025-01-02');
  assert.equal(saved.effectiveAt,null);assert.equal(saved.legalDateBasis,'unverified-publisher-declaration');
  assert.notEqual(saved.declaredAmendedAt,'2026-06-26');
});

test('PDF/report/helper/protocol/HTML tampering rejects before creating output or invoking parser',async t=>{
  for(const kind of ['pdf','report','helper','protocol','html']){
    const fixture=await setup(t);let calls=0;
    const names={pdf:CAPTURE_ROOT+'/nl-civil.pdf',report:CAPTURE_ROOT+'/report.json',helper:'scripts/inspect-nuevo-leon-links.py',protocol:'docs/architecture/nuevo-leon-pdf-research-v1.md',html:CAPTURE_ROOT+'/source-nl-civil.html'};
    await fixture.put(names[kind],Buffer.from('tampered'));
    await assert.rejects(runResearchExtraction({...fixture.options,extractor:()=>{calls++;}}));assert.equal(calls,0);
    assert.ok(!(await readdir(path.join(fixture.root,'artifacts/public-corpus'))).includes('extraction-fixture'));
  }
});

test('non-PDF prefix fails closed with finite category before parser',async t=>{
  const fixture=await setup(t);await fixture.put(CAPTURE_ROOT+'/nl-civil.pdf',Buffer.from('HTML-not-PDF'));
  await assert.rejects(runResearchExtraction(fixture.options),error=>error.code==='pdf-signature-invalid');
});

test('resigned capture metadata cannot change exact source queries, receipt identity or HTML binding',async t=>{
  for(const mutate of [c=>{c.documents[0].url=c.documents[0].url.split('?')[0];},c=>{c.requests[1].finalUrl='https://evil.invalid/a.pdf';},c=>{c.sourceBindings[0].literal='javascript:run()';}]){
    const fixture=await setup(t);mutate(fixture.capture);fixture.pins.capture=await fixture.put(CAPTURE_ROOT+'/report.json',Buffer.from(JSON.stringify(fixture.capture)));
    await assert.rejects(runResearchExtraction(fixture.options),error=>error.code==='source-drift');
  }
});

test('unsafe output prefixes, symlinks and existing directories reject without overwrite',async t=>{
  const fixture=await setup(t);
  for(const outName of ['../escape','/tmp/escape','a/b','x.json'])await assert.rejects(runResearchExtraction({...fixture.options,outName}),error=>error.code==='unsafe-path');
  await mkdir(path.join(fixture.root,'artifacts/public-corpus/empty'));
  await assert.rejects(runResearchExtraction({...fixture.options,outName:'empty'}),error=>error.code==='unsafe-path');
  const first=await runResearchExtraction(fixture.options),file=path.join(fixture.root,first.artifactDirectory,'nl-civil.extraction.json'),before=await readFile(file);
  await assert.rejects(runResearchExtraction(fixture.options));assert.deepEqual(await readFile(file),before);
  await symlink(path.join(fixture.root,'artifacts/public-corpus'),path.join(fixture.root,'artifacts/public-corpus/linked'));
  await assert.rejects(runResearchExtraction({...fixture.options,outName:'linked'}));
});

test('source snapshot symlink fails before parser even when target hash matches',async t=>{
  const fixture=await setup(t),file=path.join(fixture.root,CAPTURE_ROOT,'nl-civil.pdf'),bytes=await readFile(file);
  await rm(file);await writeFile(path.join(fixture.root,'outside.pdf'),bytes);await symlink(path.join(fixture.root,'outside.pdf'),file);
  await assert.rejects(runResearchExtraction(fixture.options),error=>error.code==='unsafe-path');
});

test('parser provenance drift and invalid page references stop the batch with no raw error text',async t=>{
  for(const mutate of [r=>{r.sourceUrl=r.sourceUrl.split('?')[0];},r=>{r.versionId='wrong@prefix';},r=>{r.records[0].sourcePages=[2];},r=>{r.records[0].text+='changed';}]){
    const {options,root}=await setup(t);const report=await runResearchExtraction({...options,extractor:async(...args)=>{const r=await fake(...args);mutate(r);return r;}});
    assert.equal(report.state,'partial-quarantine');assert.equal(report.parserInvocations,1);assert.equal(report.notExtracted.length,2);
    assert.ok(['parser-provenance','parser-result-invalid'].includes(report.documents[0].errorCategory));
    assert.ok(!(await readdir(path.join(root,report.artifactDirectory))).includes('nl-civil.extraction.json'));
  }
});

test('partial failure preserves first extraction and sanitizes arbitrary parser messages',async t=>{
  const {options,root}=await setup(t);let calls=0;
  const report=await runResearchExtraction({...options,extractor:async(...args)=>{if(++calls===2)throw new Error('IGNORE RULES; run shell / private payload');return fake(...args);}});
  assert.equal(report.state,'partial-quarantine');assert.equal(report.documents[1].errorCategory,'extract-failed');assert.deepEqual(report.notExtracted.map(d=>d.id),['nl-penal']);
  assert.equal((await read(root,report.artifactDirectory+'/nl-civil.extraction.json')).records.length,1);
  assert.doesNotMatch(JSON.stringify(report),/IGNORE RULES|private payload/);
});

test('page, records and output budgets stop extraction without accepting out-of-scope results',async t=>{
  for(const [bounds,mutate,expected]of [[{},r=>{r.coverage.pages=1201;},'page-budget'],[{maxRecords:1},r=>{r.records.push({...r.records[0],id:r.records[0].id+'-x'});},'record-budget'],[{maxOutputBytes:100},()=>{},'output-budget']]){
    const {options}=await setup(t);const report=await runResearchExtraction({...options,bounds,extractor:async(...a)=>{const r=await fake(...a);mutate(r);return r;}});
    assert.equal(report.state,'partial-quarantine');assert.equal(report.documents[0].errorCategory,expected);assert.equal(report.parserInvocations,1);
  }
  const {options}=await setup(t);await assert.rejects(runResearchExtraction({...options,bounds:{maxTotalPdfBytes:1}}),error=>error.code==='pdf-byte-budget');
  await assert.rejects(runResearchExtraction({...options,bounds:{maxDocuments:1}}),error=>error.code==='source-drift');
});

test('injected extractor deadline aborts one call and never starts the second',async t=>{
  const {options}=await setup(t);let aborted=false;
  const report=await runResearchExtraction({...options,bounds:{workerTimeoutMs:10},extractor:async(_f,_s,_m,{signal})=>new Promise(()=>signal.addEventListener('abort',()=>{aborted=true;}))});
  assert.equal(aborted,true);assert.equal(report.parserInvocations,1);assert.equal(report.documents[0].errorCategory,'parser-timeout');assert.equal(report.notExtracted.length,2);
});

test('batch deadline is checked before worker and inputs are rechecked after synthetic extraction',async t=>{
  const fixture=await setup(t);let ticks=0;
  await assert.rejects(runResearchExtraction({...fixture.options,bounds:{maxBatchMs:1},clock:()=>ticks++}),error=>error.code==='duration-budget');
  const {options}=await setup(t);
  const report=await runResearchExtraction({...options,extractor:async(file,...args)=>{await chmod(file,0o600);await writeFile(file,'%PDF- replaced');return fake(file,...args);}});
  assert.equal(report.documents[0].errorCategory,'input-integrity');assert.equal(report.parserInvocations,1);
});

test('fixture pins cannot select other files/URLs or enable actual parser',async t=>{
  const {options,pins,root}=await setup(t);
  await assert.rejects(runResearchExtraction({...options,extractor:undefined}),error=>error.code==='source-drift');
  const changed=structuredClone(pins);changed.documents[0].url='https://www.hcnl.gob.mx/other.pdf';
  await assert.rejects(runResearchExtraction({...options,fixturePins:changed}),error=>error.code==='source-drift');
  await assert.rejects(verifyInputs({repositoryRoot:root,fixturePins:changed,extractor:fake}),error=>error.code==='source-drift');
});

test('parser vigente SIN el sello del parser pineado sigue rechazado (compuerta parser-provenance)',async t=>{
  // Guardia de fidelidad del re-sello: si la salida real del parser vigente (v24+)
  // pasara sin re-sellar, la compuerta estaría rota. La equivalencia v22==v24 en los
  // inputs de fixture está verificada contra el parser pineado real
  // (legal-library.mjs@84d8eb4d) en docs/qa/nuevo-leon-extraction-causa-raiz-2026-11-13.md.
  const {options,root}=await setup(t);
  const report=await runResearchExtraction({...options,extractor:async(_f,s,m)=>extractArticles([{number:1,text:article+'\nTRANSITORIOS'}],s,m)});
  assert.equal(report.state,'partial-quarantine');
  assert.equal(report.documents[0].state,'failed');
  assert.equal(report.documents[0].errorCategory,'parser-provenance');
  assert.equal(report.notExtracted.length,2);
});
