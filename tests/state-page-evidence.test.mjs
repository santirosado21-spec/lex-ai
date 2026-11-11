import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildPageEvidence,buildStatePageEvidence,verifyStatePageEvidence,PAGE_LIMITS} from '../server/corpus/state-page-evidence.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const source={id:'nl-civil',lawId:'MX-NLE-CIVIL',url:'https://www.hcnl.gob.mx/fixed.pdf?2026-06-26'};
const metadata={pdfSha256:'a'.repeat(64),capturedAt:'2026-11-10T17:51:42.589Z'};
const item=(str,y=700)=>({str,transform:[1,0,0,1,30,y],width:100,height:12,dir:'ltr',fontName:'fixture-font'});
const page=(number,text)=>({number,items:text.split('\n').map((text,index)=>item(text,700-index*12))});

test('page text keeps Latin, Unicode, decomposed accents, spacing and UTF16 item/line lineage exactly',()=>{
  const text='  Café\u00a0cafe\u0301  — € Ñ\n😀 Art. 1o.- cuerpo\n';
  const result=buildStatePageEvidence([page(1,text)],source,metadata);
  const evidence=result.pages[0];assert.equal(evidence.text,text);assert.equal(evidence.textSha256,hash(text));
  assert.notEqual(evidence.textSha256,hash(text.normalize('NFC')));
  for(const line of evidence.lines){assert.equal(evidence.text.slice(line.start,line.end),line.text);assert.equal(line.textSha256,hash(line.text));}
  for(const range of evidence.items){assert.equal(evidence.text.slice(range.start,range.end),range.text);assert.deepEqual(range.coordinates.length,6);assert.equal(evidence.text.slice(range.separatorBefore.start,range.separatorBefore.end),range.separatorBefore.text);}
  assert.equal(result.records.length,0);assert.equal(evidence.offsetUnit,'UTF-16-code-units');assert.deepEqual(verifyStatePageEvidence(result,source,metadata),result);
});

test('same-Y item strings concatenate verbatim; Y changes and hasEOL supply explicit separators',()=>{
  const evidence=buildPageEvidence(1,[item('Art.',700),item('1o.-',700),{...item('cuerpo',700),hasEOL:true},item('siguiente',700),item('fin',680)],metadata);
  assert.equal(evidence.text,'Art.1o.-cuerpo\nsiguiente\nfin');
  assert.equal(evidence.items[1].separatorBefore.text,'');assert.equal(evidence.items[3].separatorBefore.text,'\n');
});

test('Art/Artículo/ARTICULO ordinal, BIS, TER and spaced suffixes preserve literal heading ranges',()=>{
  const lines=['  Art. 1o.- texto','ARTICULO1.- texto','Artículo 2º.- texto','Arti\u0301culo 3.- texto',
    'Art. 4 BIS.- texto','ARTÍCULO 5-TER-A.- texto','Artículo 6 . BIS .- texto','Art. 7 QUÁTER 1.- texto'];
  const evidence=buildStatePageEvidence([page(1,lines.join('\n'))],source,metadata);
  assert.equal(evidence.records.length,lines.length);
  assert.deepEqual(evidence.records.map(r=>r.technicalHeadingKey),['1','1','2','3','4-BIS','5-TER-A','6-BIS','7-QUÁTER-1']);
  for(const record of evidence.records){assert.equal(evidence.pages[0].text.slice(record.start,record.end),record.literal);assert.equal(record.textSha256,hash(record.literal));}
  assert.equal(evidence.records[1].duplicateHeadingKey,true);
});

test('duplicate 96 at page27 never truncates later pages, headings, transitories or editorial candidates',()=>{
  const pages=Array.from({length:28},(_,i)=>page(i+1,'Texto sintético de página '+(i+1)));
  pages[25]=page(26,'ARTICULO 96.- primera aparición');
  pages[26]=page(27,'Art. 96.- reiteración\nNOTA: material editorial\nTRANSITORIOS\nArt. 97 BIS.- candidato posterior');
  pages[27]=page(28,'ARTÍCULO 98.- todavía conservado');
  const evidence=buildStatePageEvidence(pages,source,metadata);
  assert.equal(evidence.pages.length,28);assert.deepEqual(evidence.records.map(r=>r.technicalHeadingKey),['96','96','97-BIS','98']);
  assert.equal(evidence.records[1].duplicateOf,evidence.records[0].id);assert.equal(evidence.coverage.repeatedHeadingCandidates,1);
  assert.equal(evidence.coverage.transitoryCandidates,1);assert.equal(evidence.coverage.editorialCandidates,1);
  assert.ok(evidence.pages[27].text.includes('conservado'));
});

test('body references, quotations and editorial references are not anchored heading candidates',()=>{
  const lines=['El Artículo 96.- se cita como referencia.','Según Art. 1o.- otro supuesto.',
    'Artículo 1 del Código fue citado.','"Artículo 2.- cita"','Nota: Artículo 3.- editorial','(REFORMADO P.O. 2026)'];
  const evidence=buildStatePageEvidence([page(1,lines.join('\n'))],source,metadata);
  assert.equal(evidence.records.length,0);assert.equal(evidence.coverage.editorialCandidates,2);
  assert.equal(evidence.pages[0].text,lines.join('\n'));
});

test('wrapped Penal article89 bare ARTICULO96. reference stays intact without becoming a duplicate heading',()=>{
  const pages=Array.from({length:28},(_,i)=>page(i+1,'Página sintética '+(i+1)));
  const body='ARTICULO89.- Párrafo sintético que remite al\nARTICULO96.';
  pages[25]=page(26,body);
  pages[26]=page(27,'ARTICULO95.- texto\nARTICULO96.- texto real con delimitador\nARTICULO97. - texto con espacio');
  pages[27]=page(28,'Art.98o. – texto de página siguiente');
  const evidence=buildStatePageEvidence(pages,source,metadata);
  assert.equal(evidence.pages[25].text,body);
  assert.deepEqual(evidence.records.map(r=>r.technicalHeadingKey),['89','95','96','97','98']);
  assert.equal(evidence.coverage.repeatedHeadingCandidates,0);assert.equal(evidence.coverage.ambiguousBareReferences,1);
  const reference=evidence.metadataCandidates.find(c=>c.kind==='ambiguous-bare-article-reference-candidate');
  assert.equal(reference.literal,'ARTICULO96.');assert.equal(reference.pageNumber,26);
  assert.equal(evidence.pages[25].text.slice(reference.start,reference.end),'ARTICULO96.');
  assert.equal(evidence.pages.length,28);
});

test('header, editorial and transitory bounds are candidates only and never stripped',()=>{
  const text='CÓDIGO CIVIL PARA EL ESTADO\nÚltima Reforma 26 de Junio 2026\nArt. 1.- texto (REFORMADO)\nARTÍCULOS TRANSITORIOS\nArt. 1.- reinicio';
  const evidence=buildStatePageEvidence([page(1,text)],source,metadata);
  assert.equal(evidence.pages[0].text,text);assert.equal(evidence.records.length,2);assert.equal(evidence.coverage.headerCandidates,2);
  for(const candidate of evidence.metadataCandidates){assert.equal(evidence.pages[0].text.slice(candidate.start,candidate.end),candidate.literal);assert.equal(candidate.operativeClassification,'not-performed');}
  for(const row of [...evidence.pages,...evidence.records,...evidence.metadataCandidates]){assert.equal(row.status,'quarantined');assert.equal(row.effectiveAt,null);assert.equal(row.published,false);assert.equal(row.indexed,false);assert.equal(row.trainingExported,false);assert.equal(row.legalReview,'pending');}
});

test('blank pages retained; page coverage must be unique and contiguous 1..N',()=>{
  const evidence=buildStatePageEvidence([{number:2,items:[]},page(1,'Art. 1.- texto')],source,metadata);
  assert.deepEqual(evidence.coverage.pageNumbers,[1,2]);assert.equal(evidence.pages[1].text,'');assert.equal(evidence.pages[1].lines.length,1);
  for(const pages of [[page(2,'a')],[page(1,'a'),page(1,'b')],[page(1,'a'),page(3,'b')]])assert.throws(()=>buildStatePageEvidence(pages,source,metadata),error=>error.code==='page-coverage');
});

test('page/text/item/hash/candidate/false-flag tampering rejects even when individual hashes are recomputed',()=>{
  const original=buildStatePageEvidence([page(1,'Art. 1.- texto\nTRANSITORIOS')],source,metadata);
  for(const change of [r=>{r.pages[0].text+='changed';},r=>{r.pages[0].lines[0].start=1;},r=>{r.pages[0].items[0].start=1;},r=>{r.pages[0].pageSha256='0'.repeat(64);},r=>{r.records[0].literal='Art. 2.-';r.records[0].textSha256=hash(r.records[0].literal);},r=>{r.records[0].published=true;},r=>{r.coverage.pages=999;},r=>{r.documentEvidenceSha256='0'.repeat(64);},r=>{r.sourceUrl='https://evil.invalid/';}]){
    const changed=structuredClone(original);change(changed);assert.throws(()=>verifyStatePageEvidence(changed,source,metadata));
  }
});

test('page/items/text/candidate/output budgets and malformed coordinates fail closed',()=>{
  const one=page(1,'Art. 1.- texto\nArt. 2.- texto');
  for(const [limits,expected]of [[{maxPages:1},'page-budget'],[{maxItemsPerPage:1},'item-budget'],[{maxTextBytes:5},'text-budget'],[{maxCandidates:1},'candidate-budget'],[{maxJsonBytes:10},'output-budget']]){
    const pages=limits.maxPages?[one,page(2,'body')]:[one];assert.throws(()=>buildStatePageEvidence(pages,source,metadata,{...PAGE_LIMITS,...limits}),e=>e.code===expected);
  }
  assert.throws(()=>buildPageEvidence(1,[{str:'text',transform:[NaN,0,0,0,0,0]}],metadata),e=>e.code==='page-evidence-invalid');
  assert.throws(()=>buildStatePageEvidence([page(1,'a'),page(2,'b')],source,metadata,{...PAGE_LIMITS,maxTotalItems:1}),e=>e.code==='item-budget');
});

test('metadata is PDF-hash grounded, not query/date interpreted',()=>{
  const evidence=buildStatePageEvidence([page(1,'Art. 1.- texto')],source,metadata);
  assert.equal(evidence.sourceUrl,source.url);assert.equal(evidence.capturedAt,metadata.capturedAt);assert.equal(evidence.effectiveAt,null);
  assert.equal(evidence.declaredAmendedAt,undefined);assert.equal(evidence.records[0].pdfSha256,metadata.pdfSha256);
  assert.throws(()=>buildStatePageEvidence([page(1,'a')],source,{...metadata,pdfSha256:'invalid'}),e=>e.code==='page-provenance');
});
