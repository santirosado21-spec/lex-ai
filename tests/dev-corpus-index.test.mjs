import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,writeFileSync,mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {buildDevIndex,openDevIndex} from '../server/dev-corpus-index.mjs';
const manifestPath='docs/qa/zac-candidato-v36c-manifest-2026-11-17.json';
const have=existsSync(manifestPath)&&existsSync('artifacts/public-corpus/zac-v36c-poppler-01-2026-11-17');
const skip=!have&&'requires the local Zacatecas v36c artifacts (restore from Drive part-14)';
const sha=f=>createHash('sha256').update(readFileSync(f)).digest('hex');
function fresh(){const dir=path.join(mkdtempSync(path.join(os.tmpdir(),'t-')),'dev-index');mkdirSync(dir,{recursive:true});return path.join(dir,'x.sqlite');}
test('dev index builds from the candidate manifest by hash, keeps kinds separate and leaves production untouched',{skip},()=>{
  const prodBefore=sha('resources/legal-corpus.json');
  const out=fresh();const r=buildDevIndex({manifestPath,corpusRoot:'artifacts/public-corpus',outFile:out});
  assert.equal(r.docs,144);assert.deepEqual(r.counts,{articulo:13207,transitorio:2237,'prefacio-articulo-citado':15});
  const idx=openDevIndex(out);
  assert.equal(idx.meta.published,'false');assert.equal(idx.meta.productionIndexed,'false');assert.equal(idx.meta.legalReview,'pending');
  const hit=idx.search({query:'Dirección General del COZCYT estará a cargo una Directora o Director',limit:3});
  assert.ok(hit.length>0);assert.equal(hit[0].document_id,'zac-ley-109');assert.equal(hit[0].record_kind,'articulo');
  assert.ok(hit[0].pdf_sha256.length===64&&hit[0].source_pages.length>0&&hit[0].declared_publication_at&&hit[0].legal_review==='pending');
  assert.ok(idx.search({query:'entrará en vigor al día siguiente de su publicación'}).every(x=>x.record_kind==='articulo'));
  const tr=idx.search({query:'entrará en vigor al día siguiente de su publicación',kinds:['transitorio']});
  assert.ok(tr.length>0&&tr.every(x=>x.record_kind==='transitorio'&&x.ordinal_label));
  const pf=idx.search({query:'atribuciones Legislatura',kinds:['prefacio-articulo-citado'],limit:5});
  assert.ok(pf.every(x=>x.record_kind==='prefacio-articulo-citado'));
  idx.close();
  assert.equal(sha('resources/legal-corpus.json'),prodBefore);
});
test('dev index refuses tampered manifests and non-dev output locations',{skip},()=>{
  const m=JSON.parse(readFileSync(manifestPath,'utf8'));m.documents_list[0].extractionFileSha256='0'.repeat(64);
  const tmp=path.join(mkdtempSync(path.join(os.tmpdir(),'m-')),'m.json');writeFileSync(tmp,JSON.stringify(m));
  assert.throws(()=>buildDevIndex({manifestPath:tmp,corpusRoot:'artifacts/public-corpus',outFile:fresh()}),/hash mismatch/);
  assert.throws(()=>buildDevIndex({manifestPath,corpusRoot:'artifacts/public-corpus',outFile:path.join(os.tmpdir(),'prod.sqlite')}),/dev-index/);
});
