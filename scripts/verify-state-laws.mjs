import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import {STATE_ARTICLE} from './audit-state-laws.mjs';
const root=path.resolve('artifacts/legal-library/state-expansion-2026-11-02');
const frozen=path.join(root,'frozen-v1');
const sha=x=>createHash('sha256').update(x).digest('hex');
const norm=x=>x.normalize('NFC').replace(/\s+/g,' ').trim();
const body=x=>sha(norm(x.replace(STATE_ARTICLE,'')));
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const lines=x=>x.toString().split('\n').filter(Boolean).map(JSON.parse);
const hashes=await json(path.join(frozen,'sha256.json'));
for(const [name,hash] of Object.entries(hashes))assert.equal(sha(await readFile(path.join(frozen,name))),hash,`Frozen file changed: ${name}`);
const [manifest,audit,catalog,acquisitions]=await Promise.all(['manifest.json','independent-extraction-audit.json','catalog.json','acquisitions.json'].map(name=>json(path.join(frozen,name))));
const corpusBytes=await readFile(path.join(frozen,'corpus.jsonl')),rows=lines(corpusBytes);
assert.equal(manifest.releaseStatus,'FROZEN');assert.equal(sha(corpusBytes),manifest.corpusSha256);assert.equal(audit.corpusSha256,manifest.corpusSha256);
assert.equal(rows.length,manifest.articles);assert.equal(audit.checked,rows.length);assert.equal(audit.passed,audit.checked);assert.ok(audit.checked>0);
assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);assert.equal(new Set(audit.checks.map(c=>c.id)).size,rows.length);
const checks=new Map(audit.checks.map(c=>[c.id,c])),bodies=new Set(),laws=new Map();
const base=await readFile('artifacts/legal-library/exports-v2/corpus.jsonl');assert.equal(sha(base),manifest.baseCorpusSha256);const baseBodies=new Set(lines(base).map(r=>body(r.text)));
for(const acquisition of acquisitions){assert.equal(sha(await readFile(path.join(root,acquisition.file))),acquisition.sha256);assert.equal(acquisition.split,catalog.sources.find(s=>s.id===acquisition.id).split);}
for(const source of catalog.sources){const name=source.jurisdiction==='MX-JAL'?'jalisco':'nuevo-leon';assert.equal(sha(await readFile(path.join(root,'discovery',name+'.html'))),source.indexSha256);}
for(const row of rows){
 const source=catalog.sources.find(s=>s.lawId===row.lawId),acquisition=acquisitions.find(s=>s.lawId===row.lawId),check=checks.get(row.id);
 assert.ok(source&&acquisition&&check);assert.equal(row.sourceUrl,source.url);assert.equal(row.publisherIndex,source.publisherIndex);assert.equal(row.indexSha256,source.indexSha256);assert.equal(row.pdfSha256,acquisition.sha256);assert.equal(row.split,source.split);assert.equal(row.splitGroup,row.lawId);
 assert.equal(row.textSha256,sha(row.text));assert.equal(row.contentSha256,body(row.text));assert.equal(check.textSha256,row.textSha256);assert.deepEqual(check.sourcePages,row.sourcePages);
 for(const key of ['headPresent','middlePresent','tailPresent','fullBodyPresent'])assert.equal(check[key],true);
 assert.equal(row.quality.status,'structurally-verified');assert.equal(row.quality.anomalies.length,0);assert.equal(row.quality.currentness,'unverified');assert.ok(row.sourcePages.length>0&&row.sourcePages.every(n=>Number.isInteger(n)&&n>0&&n<=manifest.sources.find(s=>s.lawId===row.lawId).pages));
 assert.ok(!bodies.has(body(row.text))&&!baseBodies.has(body(row.text)),`Duplicate body ${row.id}`);bodies.add(body(row.text));
 if(laws.has(row.lawId))assert.equal(laws.get(row.lawId),row.split);laws.set(row.lawId,row.split);
}
for(const split of ['train','validation','test']){const expected=rows.filter(r=>r.split===split),actual=lines(await readFile(path.join(frozen,split+'.jsonl')));assert.deepEqual(actual,expected);assert.equal(actual.length,manifest.splits[split].articles);}
assert.equal(laws.get('MX-NLE-CF'),'test');assert.equal(laws.get('MX-NLE-CP'),'validation');assert.equal(laws.size,manifest.laws);
console.log(JSON.stringify({passed:true,articles:rows.length,checked:audit.checked,splits:manifest.splits,corpusSha256:manifest.corpusSha256,manifestSha256:hashes['manifest.json'],auditSha256:hashes['independent-extraction-audit.json'],baseCorpusUnmodified:true},null,2));
