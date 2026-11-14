import test from 'node:test';
import assert from 'node:assert/strict';
import {extractArticles,EXTRACTOR_VERSION} from '../server/legal-library.mjs';

// Synthetic fixtures for the Yucatán/Aguascalientes official-PDF format variants
// repaired in EXTRACTOR_VERSION=25. All text is synthetic; every case builds the
// page array directly so no real PDF bytes are needed.
const source={lawId:'fixture-law',title:'LEY FIXTURE SINTETICA',url:'https://fixture.example/ley.pdf',authority:'Fixture',jurisdiction:'MX-FIX',reuseBasis:'fixture'};
const meta={pdfSha256:'a'.repeat(64),retrievedAt:'2026-11-14T00:00:00.000Z'};
const pagesOf=text=>[{number:1,text}];
const body='Texto sintético del artículo con contenido normativo de prueba suficientemente largo para el umbral estructural.';

test('bullet-glyph wrapped spaced numeric headings extract as standard numeric articles',()=>{
  const r=extractArticles(pagesOf(`\u00ACArtículo 1.-\u00AC ${body}\n\u00ACArtículo 2.-\u00AC ${body}\nTRANSITORIOS`),source,meta);
  assert.equal(r.records.length,2);
  assert.deepEqual(r.records.map(x=>x.articleId),['1','2']);
  assert.ok(r.coverage.removedBulletGlyphs>=4);
  assert.ok(!r.documentAnomalies.includes('nospace-heading-mode'));
});

test('bullet-glyph wrapped all-caps ordinal headings extract via ordinal path',()=>{
  const r=extractArticles(pagesOf(`\u00ACARTICULO PRIMERO.-\u00AC ${body}\n\u00ACARTICULO SEGUNDO.-\u00AC ${body}\nTRANSITORIOS`),source,meta);
  assert.equal(r.records.length,2);
  assert.deepEqual(r.records.map(x=>x.articleId),['1','2']);
});

test('title-case spelled ordinal headings extract strictly sequentially',()=>{
  const r=extractArticles(pagesOf(`Artículo Primero.-${body}\nArtículo Segundo.-${body}\nArtículo Tercero.-${body}\nTRANSITORIOS`),source,meta);
  assert.equal(r.records.length,3);
  assert.deepEqual(r.records.map(x=>x.articleId),['1','2','3']);
  assert.ok(r.documentAnomalies.includes('titlecase-ordinal-heading-mode'));
});

test('title-case ordinal without terminator stays body text (fail-closed)',()=>{
  const r=extractArticles(pagesOf(`El artículo primero de esta ley se refiere al artículo primero constitucional.\nArtículo Primero de las disposiciones anteriores ${body}\nTRANSITORIOS`),source,meta);
  assert.equal(r.records.length,0);
});

test('no-space numeric headings extract strictly sequentially',()=>{
  const r=extractArticles(pagesOf(`Artículo1.-${body}\nArtículo2.-${body}\nArtículo3.-${body}\nTRANSITORIOS`),source,meta);
  assert.equal(r.records.length,3);
  assert.deepEqual(r.records.map(x=>x.articleId),['1','2','3']);
  assert.ok(r.documentAnomalies.includes('nospace-heading-mode'));
});

test('no-space numeric headings with ordinal suffix (1o.) extract',()=>{
  const r=extractArticles(pagesOf(`Artículo1o.-${body}\nArtículo2o.-${body}\nTRANSITORIOS`),source,meta);
  assert.equal(r.records.length,2);
  assert.deepEqual(r.records.map(x=>x.articleId),['1','2']);
});

test('no-space numeric heading out of sequence never opens (fail-closed)',()=>{
  const r=extractArticles(pagesOf(`Artículo2.-${body}\nArtículo3.-${body}\nTRANSITORIOS`),source,meta);
  assert.equal(r.records.length,0);
});

test('reversed ordinal heading (Artículo.-1o.) extracts and chains with title-case ordinals',()=>{
  const r=extractArticles(pagesOf(`Artículo.-1o.${body}\nArtículo Segundo.-${body}\nTRANSITORIOS`),source,meta);
  assert.equal(r.records.length,2);
  assert.deepEqual(r.records.map(x=>x.articleId),['1','2']);
  assert.ok(r.documentAnomalies.includes('reversed-ordinal-heading-mode'));
});

test('documents with spaced numeric headings never enter ordinal/nospace paths (regression)',()=>{
  const r=extractArticles(pagesOf(`Artículo 1.- ${body}\nEl texto menciona Artículo Primero de otra ley y Artículo2.-no encabezado.\nArtículo 2.- ${body}\nTRANSITORIOS`),source,meta);
  assert.equal(r.records.length,2);
  assert.deepEqual(r.records.map(x=>x.articleId),['1','2']);
  assert.ok(!r.documentAnomalies.includes('nospace-heading-mode'));
  assert.ok(!r.documentAnomalies.includes('titlecase-ordinal-heading-mode'));
});

test('extractor version bumped for the format repair',()=>{
  assert.ok(EXTRACTOR_VERSION>=25);
});

test('worker page cap raised and exported (nay-ley-148 class: 1376 pages)',async()=>{
  const {EXTRACTOR_MAX_PAGES}=await import('../server/legal-library.mjs');
  assert.equal(EXTRACTOR_MAX_PAGES,2000);
  assert.ok(EXTRACTOR_MAX_PAGES>=1376);
  assert.equal(EXTRACTOR_VERSION,26);
});
