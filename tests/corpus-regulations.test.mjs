import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {parseRegulationsIndex,decodeIndex,discoverRegulationsLibrary} from '../server/legal-library.mjs';
import {classifyTitle,generateCoverage} from '../scripts/corpus-coverage.mjs';

const fixture=path.resolve('tests/fixtures/corpus-reglamentos-index.html');
async function temporary(t){const dir=await mkdtemp(path.join(tmpdir(),'lex-corpus-'));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}

test('regulations parser preserves provenance and excludes duplicate, mobile, and foreign PDFs',async()=>{
  const bytes=await readFile(fixture);const decoded=decodeIndex(bytes);const result=parseRegulationsIndex(decoded.text,{retrievedAt:'2026-11-02T00:00:00.000Z',indexSha256:'b'.repeat(64)});
  assert.equal(result.rows,3);assert.equal(result.kept,2);assert.equal(result.excluded,3);assert.equal(result.anomalies.length,3);
  assert.deepEqual(result.sources.map(source=>source.id),['reg-ladua','reg-lsalud']);assert.equal(result.sources[1].lawId,'MX-FED-REG-LSALUD');assert.equal(result.sources[0].indexSha256,'b'.repeat(64));assert.deepEqual(result.sources[0].indexRow,['01','REGLAMENTO de la Ley Aduanera Original DOF 20/04/2015','20/04/2015','PDF']);
});

test('regulations discovery imports a local snapshot without fetch',async t=>{
  const dir=await temporary(t);const catalogPath=path.join(dir,'catalog.json');const catalog=await discoverRegulationsLibrary({outputDir:dir,catalogPath,indexFile:fixture,fetchImpl:async()=>{throw new Error('must not fetch');}});
  assert.equal(catalog.importedSnapshot,true);assert.equal(catalog.count,2);assert.deepEqual(JSON.parse(await readFile(catalogPath,'utf8')).sources.map(source=>source.id),['reg-ladua','reg-lsalud']);
});

test('ingest CLI accepts an explicit catalogue path offline',async t=>{
  const dir=await temporary(t);const catalogPath=path.join(dir,'catalog.json'),outputDir=path.join(dir,'out');await writeFile(catalogPath,JSON.stringify({sources:[{id:'reg-test',lawId:'MX-FED-REG-TEST',title:'REGLAMENTO SINTÉTICO',url:'https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_Test.pdf',jurisdiction:'MX-FED'}]}));
  const result=await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['scripts/corpus-ingest.mjs','--catalog',catalogPath,'--output-dir',outputDir,'--offline','--limit','1'],{cwd:path.resolve('.')});let stdout='',stderr='';
    child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);child.on('error',reject);
    child.on('close',code=>{if(code===0)resolve({stdout,stderr});else reject(new Error(stderr||`exit ${code}`));});
  });
  const status=JSON.parse(result.stdout);assert.equal(status.catalogTotal,1);assert.equal(status.sources[0].id,'reg-test');assert.equal(status.sources[0].state,'failed');
});

test('coverage classifies title keywords transparently and reports inaccessible gaps',async t=>{
  const dir=await temporary(t);const lawsPath=path.join(dir,'laws.json'),regsPath=path.join(dir,'regs.json'),lawsStatus=path.join(dir,'laws-status.json'),frozenPath=path.join(dir,'frozen.jsonl'),output=path.join(dir,'coverage.json'),document=path.join(dir,'coverage.md');
  const law={id:'law-amparo',lawId:'MX-FED-AMPARO',title:'LEY DE AMPARO',url:'https://www.diputados.gob.mx/LeyesBiblio/pdf/LAmp.pdf',jurisdiction:'MX-FED',publisherIndex:'fixture',indexSha256:'a'.repeat(64)};
  const regulation={id:'reg-lsalud',lawId:'MX-FED-REG-LSALUD',title:'REGLAMENTO de la Ley de Salud',url:'https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LSalud.pdf',jurisdiction:'MX-FED',publisherIndex:'fixture',indexSha256:'b'.repeat(64)};
  await Promise.all([writeFile(lawsPath,JSON.stringify({source:'fixture-laws',sources:[law]})),writeFile(regsPath,JSON.stringify({source:'fixture-regs',sources:[regulation]})),writeFile(lawsStatus,JSON.stringify({sources:[{id:'law-amparo',state:'extracted'}]})),writeFile(frozenPath,JSON.stringify({lawId:'MX-FED-AMPARO'})+'\n')]);
  const report=await generateCoverage({lawsCatalogPath:lawsPath,regulationsCatalogPath:regsPath,lawsStatusPath:lawsStatus,regulationsStatusPath:path.join(dir,'missing.json'),frozenCorpusPath:frozenPath,outputPath:output,documentPath:document,generatedAt:'2026-11-02T00:00:00.000Z'});
  assert.equal(classifyTitle('Código Fiscal de la Federación').id,'fiscal-tributario');assert.equal(report.totals.catalogued,2);assert.equal(report.instruments.find(row=>row.id==='law-amparo').ingestion.status,'ingested-frozen-export');assert.equal(report.instruments.find(row=>row.id==='reg-lsalud').ingestion.status,'not-ingested-no-status');assert.equal(report.gaps.find(gap=>gap.id==='jurisprudence-tesis').accessStatus,'blocked');assert.match(await readFile(document,'utf8'),/cobertura medida sobre fuentes accesibles/i);
});

test('coverage fails closed without the frozen export evidence instead of overwriting the measured document',async t=>{
  const dir=await temporary(t);const lawsPath=path.join(dir,'laws.json'),regsPath=path.join(dir,'regs.json'),output=path.join(dir,'coverage.json'),document=path.join(dir,'coverage.md');
  const law={id:'law-amparo',lawId:'MX-FED-AMPARO',title:'LEY DE AMPARO',url:'https://www.diputados.gob.mx/LeyesBiblio/pdf/LAmp.pdf',jurisdiction:'MX-FED',publisherIndex:'fixture',indexSha256:'a'.repeat(64)};
  await Promise.all([writeFile(lawsPath,JSON.stringify({source:'fixture-laws',sources:[law]})),writeFile(regsPath,JSON.stringify({source:'fixture-regs',sources:[]}))]);
  await assert.rejects(generateCoverage({lawsCatalogPath:lawsPath,regulationsCatalogPath:regsPath,lawsStatusPath:path.join(dir,'missing-laws.json'),regulationsStatusPath:path.join(dir,'missing-regs.json'),frozenCorpusPath:path.join(dir,'absent-corpus.jsonl'),outputPath:output,documentPath:document,generatedAt:'2026-11-02T00:00:00.000Z'}),/frozen export/i);
  await assert.rejects(readFile(document,'utf8'),{code:'ENOENT'});await assert.rejects(readFile(output,'utf8'),{code:'ENOENT'});
});
