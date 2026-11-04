import test from 'node:test';import assert from 'node:assert/strict';
import {extractStateArticles,independentCheck} from '../scripts/audit-state-laws.mjs';
const source={lawId:'MX-TEST-SYNTHETIC',title:'Código sintético',url:'https://www.hcnl.gob.mx/synthetic.pdf',authority:'Synthetic fixture',jurisdiction:'MX-NLE',practiceAreas:['civil'],split:'train',reuseBasis:{kind:'synthetic-test'}};
const metadata={sha256:'a'.repeat(64),retrievedAt:'2026-11-02T00:00:00Z'};
const text='Disposición exclusivamente sintética para verificar el extractor sin afirmar contenido jurídico real.';
test('lowercase cross-references stay inside the article and do not restart numbering',()=>{
 const result=extractStateArticles([{number:1,text:`Artículo 1.- ${text}\nArtículo 2.- ${text}\nartículo 1.\nTRANSITORIOS`}],source,metadata);
 assert.deepEqual(result.documentAnomalies,[]);assert.deepEqual(result.records.map(r=>r.articleId),['1','2']);assert.match(result.records[1].text,/artículo 1/);
});
test('dotted Bis numeric suffixes and Roman suffixes remain distinct source identities',()=>{
 const result=extractStateArticles([{number:1,text:`Artículo 1.- ${text}\nArtículo 176-Bis.1. ${text}\nArt. 410-Bis-II.- ${text}\nArtículo 180 Bis. IV.- ${text}\nT R A NS I T O R I O S`}],source,metadata);
 assert.deepEqual(result.documentAnomalies,[]);assert.deepEqual(result.records.map(r=>r.articleId),['1','176-BIS-1','410-BIS-II','180-BIS-IV']);
});
test('bare numeric labels are retained but quarantine the ambiguous combined record',()=>{
 const result=extractStateArticles([{number:1,text:`Artículo 1.- ${text}\nARTICULO 2.\n${text}\nArtículo 2.- ${text}\nTRANSITORIOS`}],source,metadata);
 assert.deepEqual(result.documentAnomalies,[]);assert.equal(result.records[0].quality.status,'quarantined');assert.ok(result.records[0].quality.anomalies.includes('bare-article-label-needs-review'));assert.equal(result.records[1].quality.status,'structurally-verified');
});
test('unreadable headings and absent transitory boundary never become accepted source records',()=>{
 const corrupted=extractStateArticles([{number:1,text:`ArtÌculo 1.- ${text}`}],source,metadata);assert.ok(corrupted.documentAnomalies.includes('no-article-headings'));
 const missing=extractStateArticles([{number:1,text:`Artículo 1.- ${text}`}],source,metadata);assert.equal(missing.records[0].quality.status,'quarantined');assert.ok(missing.documentAnomalies.includes('no-explicit-transitory-boundary'));
});
test('independent comparison requires the complete body rather than only citation edges',()=>{
 const [row]=extractStateArticles([{number:1,text:`Artículo 1.- ${text.repeat(8)}\nTRANSITORIOS`}],source,metadata).records;
 assert.equal(independentCheck(row,row.text).fullBodyPresent,true);const altered=row.text.slice(0,200)+' OMITTED MIDDLE '+row.text.slice(-200);const check=independentCheck(row,altered);assert.equal(check.headPresent,true);assert.equal(check.tailPresent,true);assert.equal(check.fullBodyPresent,false);
});
test('publisher invalidity annotations require review even when extraction matches the PDF',()=>{
 const result=extractStateArticles([{number:1,text:`Artículo 1.- ${text} La porción normativa entrecomillada fue declarada inválida.\nTRANSITORIOS`}],source,metadata);
 assert.equal(result.records[0].quality.status,'quarantined');assert.ok(result.records[0].quality.anomalies.includes('invalidity-annotation-requires-review'));
});
