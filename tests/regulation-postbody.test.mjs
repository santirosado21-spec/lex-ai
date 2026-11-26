import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parsePdfInWorker} from '../server/legal-library.mjs';
import {regulationPostBody} from '../server/regulation-postbody.mjs';
const hash='bcdfcd9073014aec4aefbacc01c9dd5b1f97f0da0c4556f0f506d20f12d77812';
const source={lawId:'MX-FED-REG-LADUA',title:'REGLAMENTO de la Ley Aduanera',url:'https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LAdua.pdf'};
const meta={pdfSha256:hash,retrievedAt:'2026-11-26T01:11:00Z'};
for(const textLayer of ['default','poppler'])test('pinned Reglamento post-body classification '+textLayer,async()=>{
 const r=await parsePdfInWorker(new URL('../resources/trade/reglamento-aduanero-2026.pdf',import.meta.url).pathname,{...source,...(textLayer==='poppler'?{textLayer}:{})},meta);
 assert.equal(r.records.length,282);assert.equal(r.coverage.exportableArticles,0);
 assert.equal(r.transitories.length,11);assert.deepEqual(r.transitories.map(t=>t.ordinal),['PRIMERO','SEGUNDO','TERCERO','CUARTO','QUINTO','SEXTO','PRIMERO','SEGUNDO','TERCERO','CUARTO','QUINTO']);
 assert.ok(r.transitories.every(t=>t.quality.status==='quarantined'&&!/ARTÍCULO ÚNICO|Atentamente|DECRETO por el|Artículo 144/.test(t.text)));
 assert.deepEqual(r.transitories.map(t=>t.group),Array(6).fill('reglamento-original-2015').concat(Array(5).fill('decreto-reforma-2026-02-23')));
 assert.equal(r.postBodyRecords.length,10);
 const annexes=r.postBodyRecords.filter(t=>t.recordKind==='rgce-amount-annex');assert.equal(annexes.length,7);assert.deepEqual(annexes.map(t=>t.sourcePages),[[82],[83],[84],[85],[86],[87],[88]]);
 assert.ok(annexes.at(-1).rawText.includes('175,395,050'));assert.ok(!annexes.at(-1).rawText.includes('ARTÍCULO ÚNICO'));
 const decree=r.postBodyRecords.find(t=>t.recordKind==='amendment-decree');assert.deepEqual(decree.sourcePages,[89]);assert.ok(decree.rawText.includes('ARTÍCULO ÚNICO'));assert.ok(!decree.rawText.includes('Primero.'));
 assert.ok(r.postBodyRecords.every(t=>t.quality.status==='quarantined'&&createHash('sha256').update(t.rawText).digest('hex')===t.textSha256));

});
test('document classifier is digest and law scoped, fails closed on pinned layout changes',()=>{
 assert.equal(regulationPostBody([],source,{...meta,pdfSha256:'0'.repeat(64)}),null);
 assert.equal(regulationPostBody([],{...source,lawId:'other'},meta),null);
 assert.throws(()=>regulationPostBody([],source,meta),/page sequence/);
});

test('raw post-body text and page provenance are partitioned without loss',()=>{
 const pages=Array.from({length:90},(_,i)=>({number:i+1,text:'page '+(i+1)+'\n'}));
 pages[80].text='operative end\nTRANSITORIOS\noriginal raw\n';
 pages[88].text='DECRETO 23 de febrero de 2026\nARTÍCULO ÚNICO. reforma\nTRANSITORIOS\nreform raw\n';
 const ord=['Primero','Segundo','Tercero','Cuarto','Quinto','Sexto'];
 const lines=[...ord.map(o=>({page:81,text:o+'. texto original.'})),{page:81,text:'Dado en la Residencia.'},{page:89,text:'TRANSITORIOS'},...ord.slice(0,5).map(o=>({page:90,text:o+'. texto reforma.'})),{page:90,text:'Ciudad de México, firma.'}];
 const r=regulationPostBody(pages,source,{...meta,versionId:'test-version',lines});
 assert.equal(r.postBodyRecords.map(r=>r.rawText).join(''),pages[80].text.slice(pages[80].text.indexOf('TRANSITORIOS'))+pages.slice(81).map(p=>p.text).join(''));
 assert.equal(r.transitories.length,11);assert.ok(!r.transitories.some(t=>/firma|Residencia/.test(t.text)));
 assert.throws(()=>regulationPostBody(pages.map((p,i)=>i===88?{...p,text:'changed boundary'}:p),source,{...meta,versionId:'test-version',lines}),/boundaries/);
});

for(const textLayer of ['default','poppler'])test('normalized post-body is independent of abbreviated catalog title '+textLayer,async()=>{
 const file=new URL('../resources/trade/reglamento-aduanero-2026.pdf',import.meta.url).pathname;
 const layer=textLayer==='poppler'?{textLayer}:{};
 const canonical=await parsePdfInWorker(file,{...source,...layer},meta);
 const abbreviated=await parsePdfInWorker(file,{...source,title:'R',...layer},meta);
 assert.deepEqual(abbreviated.transitories,canonical.transitories);
 assert.deepEqual(abbreviated.postBodyRecords,canonical.postBodyRecords);
 const second=abbreviated.transitories.find(t=>t.group==='decreto-reforma-2026-02-23'&&t.ordinal==='SEGUNDO');
 assert.deepEqual(second.sourcePages,[89]);
 assert.ok(second.text.endsWith('gasto de operación y servicios personales.'));
 assert.equal(second.textSha256,'c5e9ed63224c0e8c788afeffbe572e98661b8147379be1caee67797041eab495');
 assert.ok(abbreviated.transitories.every(t=>!t.text.includes('REGLAMENTO DE LA LEY ADUANERA')));
 const exclusions=abbreviated.coverage.postBodyNormalizationExclusions;
 assert.ok(exclusions.some(l=>l.page===90&&l.text==='REGLAMENTO DE LA LEY ADUANERA'&&l.rawLineIndices.length===1));
 assert.ok(exclusions.every(l=>l.reason==='pinned-running-title'&&l.rawLineIndices.length>0));
 assert.ok(abbreviated.postBodyRecords.at(-1).pageTexts.find(p=>p.page===90).text.includes('REGLAMENTO DE LA LEY ADUANERA'));
 assert.deepEqual(canonical.coverage.postBodyNormalizationExclusions,[]);
});

test('normalized and raw boundary guards reject missing or duplicate markers',()=>{
 const pages=Array.from({length:90},(_,i)=>({number:i+1,text:'page '+(i+1)}));
 pages[80].text='TRANSITORIOS';pages[88].text='ARTÍCULO ÚNICO TRANSITORIOS';
 const options={...meta,versionId:'test-version',lines:[]};
 assert.throws(()=>regulationPostBody(pages,source,options),/normalized transitory boundary/);
 assert.throws(()=>regulationPostBody(pages,source,{...options,lines:[{page:89,text:'TRANSITORIOS'},{page:90,text:'TRANSITORIOS'}]}),/normalized transitory boundary/);
 for(const page of [80,88])assert.throws(()=>regulationPostBody(pages.map((p,i)=>i===page?{...p,text:p.text+' TRANSITORIOS'}:p),source,options),/boundaries ambiguous/);
});
