import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {auditExtractionDir} from '../scripts/public-corpus-extraction-audit.mjs';
test('empty extraction directory and fabricated complete report cannot pass integrity audit',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'rejon-empty-audit-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 await mkdir(path.join(dir,'extractions'));await writeFile(path.join(dir,'report.json'),JSON.stringify({state:'complete',documents:[],summary:{extracted:0}}));
 const result=await auditExtractionDir(dir);assert.equal(result.ok,false);assert.ok(result.findings.some(value=>value.startsWith('integrity-chain:')));assert.deepEqual(result.documents,{});
});

import {createHash} from 'node:crypto';import {readFile,realpath} from 'node:fs/promises';import {tmpdir} from 'node:os';
import {buildAcquisitionPlan,ACQUISITION_LIMITS} from '../server/corpus/source-registry.mjs';
import {runPublicAcquisition} from '../server/corpus/acquisition.mjs';import {extractArticles} from '../server/legal-library.mjs';
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

test('audit validates ledger-selected extraction and rejects tampered snapshots and unbound report paths',async t=>{
 for(const mode of ['valid','snapshot','path','extraction']){
  const options=await setup(t),report=await runPublicAcquisition(options);
  if(mode==='snapshot')await writeFile(path.join(options.outputDir,'acquisitions/snapshots/law-1',report.documents[0].pdfSha256+'.pdf'),'tampered');
  if(mode==='path'){report.documents[0].extractionPath='extractions/missing.json';await writeFile(path.join(options.outputDir,'report.json'),JSON.stringify(report));}
  if(mode==='extraction')await writeFile(path.join(options.outputDir,report.documents[0].extractionPath),'{}');
  const result=await auditExtractionDir(options.outputDir);assert.equal(result.ok,mode==='valid',mode);
 }
});

test('distinct transitories with null articleId do not become duplicate operative article zero',async t=>{
 const options=await setup(t,{extractor:async(...args)=>{const result=await extractor(...args);result.transitories=['Primero','Segundo'].map((ordinal,i)=>({ordinal,group:'TRANSITORIOS',text:'Synthetic transitional provision '+i,textSha256:digest('Synthetic transitional provision '+i),sourcePages:[1]}));result.coverage.transitoryRecords=2;return result;}});
 await runPublicAcquisition(options);const result=await auditExtractionDir(options.outputDir);assert.equal(result.ok,true,JSON.stringify(result.findings));assert.equal(result.documents['law-1'].records,3);assert.equal(result.documents['law-1'].dupe,0);assert.equal(result.documents['law-1'].nonMono,0);
});

for(const mode of ['unknown','transitory-with-id','transitory-without-id','preface-without-reason'])test('reject ledger-consistent misclassification: '+mode,async t=>{
 const options=await setup(t,{extractor:async(...args)=>{const result=await extractor(...args);const duplicate={...result.records[0],recordKind:mode==='unknown'?'bogus':mode.startsWith('transitory')?'transitorio':'prefacio-articulo-citado'};
 if(mode==='transitory-without-id'){duplicate.articleId=null;duplicate.ordinalLabel='PRIMERO';duplicate.headingTitle='ley-original';}
 result.records.push(duplicate);return result;}});
 await runPublicAcquisition(options);const result=await auditExtractionDir(options.outputDir);assert.equal(result.ok,false,JSON.stringify(result));assert.ok(result.findings.some(f=>!f.startsWith('integrity-chain:')));
});
test('real parser separates valid transitory structures',async t=>{
 const options=await setup(t,{extractor:async(file,source,metadata)=>extractArticles([{number:1,text:article+'\nTRANSITORIOS\nPRIMERO.- La disposición sintética entra en vigor al día siguiente de publicarse.\nSEGUNDO.- Se conserva la evidencia documental sintética.'}],source,metadata)});
 await runPublicAcquisition(options);const result=await auditExtractionDir(options.outputDir);assert.equal(result.ok,true,JSON.stringify(result.findings));assert.equal(result.documents['law-1'].records,3);
});

test('valid quoted preface preserves its article identity outside operative ordering',async t=>{
 const options=await setup(t,{extractor:async(...args)=>{const result=await extractor(...args);result.prefaceRecords=[{...result.records[0],prefaceReason:'quoted-article'}];result.coverage.prefaceRecordsPreserved=1;return result;}});
 await runPublicAcquisition(options);const result=await auditExtractionDir(options.outputDir);assert.equal(result.ok,true,JSON.stringify(result.findings));assert.equal(result.documents['law-1'].records,2);
});
for(const mode of ['transitory-id','transitory-boundary','transitory-count','operative-count','preface-count','preface-reason'])test('reject internally inconsistent structural evidence: '+mode,async t=>{
 const options=await setup(t,{extractor:async(file,source,metadata)=>{const result=extractArticles([{number:1,text:article+'\nTRANSITORIOS\nPRIMERO.- La disposición sintética entra en vigor al día siguiente de publicarse.'}],source,metadata);
 if(mode==='transitory-id'){result.records.push({...result.records[0],recordKind:'transitorio',ordinalLabel:'PRIMERO',headingTitle:'ley-original'});result.coverage.transitoryRecords++;}
 if(mode==='transitory-boundary')result.coverage.transitoryStartPage=2;
 if(mode==='transitory-count')result.coverage.transitoryRecords++;
 if(mode==='operative-count')result.coverage.operativeArticleCandidates++;
 if(mode.startsWith('preface')){result.prefaceRecords=[{...result.records[0],prefaceReason:mode==='preface-reason'?'unknown-reason':'quoted-article'}];result.coverage.prefaceRecordsPreserved=mode==='preface-count'?0:1;}
 return result;}});
 await runPublicAcquisition(options);const result=await auditExtractionDir(options.outputDir);assert.equal(result.ok,false,JSON.stringify(result));
});

for(const mode of ['duplicate-operative-id','non-monotonic-operative-id','missing-operative-id','missing-transitory-ordinal'])test('isolated structural guard: '+mode,async t=>{
 const options=await setup(t,{extractor:async(file,source,metadata)=>{const result=extractArticles([{number:1,text:article+'\nArtículo 2.- Otra disposición completamente sintética para verificar el orden de los artículos sin datos privados.\nTRANSITORIOS\nPRIMERO.- La disposición sintética entra en vigor al día siguiente de publicarse.'}],source,metadata);
 if(mode==='duplicate-operative-id'){result.records[0].articleId='1BIS';result.records[1].articleId='1BIS';}
 if(mode==='non-monotonic-operative-id'){result.records[0].articleId='2';result.records[1].articleId='1';}
 if(mode==='missing-operative-id')result.records[0].articleId=null;
 if(mode==='missing-transitory-ordinal'){result.transitories[0].ordinal='';assert.ok(result.transitories[0].group);}
 return result;}});
 await runPublicAcquisition(options);const result=await auditExtractionDir(options.outputDir);assert.equal(result.ok,false,JSON.stringify(result));
 const expected=mode==='duplicate-operative-id'?'duplicate article ids':mode==='non-monotonic-operative-id'?'non-monotonic article numbers':mode==='missing-operative-id'?'operative article id missing':'invalid transitory structure';assert.ok(result.findings.some(f=>f.includes(expected)),JSON.stringify(result.findings));
});
