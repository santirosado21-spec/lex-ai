import test from 'node:test';
import assert from 'node:assert/strict';
import {extractArticles,EXTRACTOR_VERSION} from '../server/legal-library.mjs';

// Synthetic fixtures for EXTRACTOR_VERSION=31: non-article document classes.
// Only fires when ZERO article headings parse. Two fail-closed grammars:
// 'principios' (numbered named values: "1.- Integridad.") and 'resolutivos'
// (decree resolve points: "Primero.", "Segundo."). Numbers are never invented:
// identifiers come only from the document text, strictly sequential, with
// minimum heading counts (3 / 2) and a 60-char minimum body per record.
const source={lawId:'fixture-na',title:'DOCUMENTO NO ARTICULADO FIXTURE',url:'https://fixture.example/na.pdf',authority:'Fixture',jurisdiction:'MX-FIX',reuseBasis:'fixture'};
const meta={pdfSha256:'b'.repeat(64),retrievedAt:'2026-11-14T00:00:00.000Z'};
const pagesOf=text=>[{number:1,text}];
const longBody='Contenido sustantivo suficientemente largo para superar el umbral minimo de sesenta caracteres por registro estructural del documento.';

test('principios class: numbered named values extract as principio records',()=>{
  const r=extractArticles(pagesOf(`CODIGO DE ETICA FIXTURE\nI.- Preámbulo.\n${longBody}\nII.- Valores.\n1.- Integridad.\n${longBody}\n2.- Independencia.\n${longBody}\n3.- Legalidad.\n${longBody}`),source,meta);
  assert.equal(r.records.length,3);
  assert.deepEqual(r.records.map(x=>x.headingTitle),['Integridad','Independencia','Legalidad']);
  for(const rec of r.records){
    assert.equal(rec.articleId,null);
    assert.equal(rec.recordKind,'principio');
    assert.equal(rec.quality.status,'quarantined');
    assert.ok(rec.quality.anomalies.includes('non-article-principio-record'));
    assert.ok(rec.text.startsWith(rec.ordinalLabel));
    assert.ok(rec.sourcePages.length>0);
  }
  assert.equal(r.coverage.nonArticleClass,'principios');
  assert.ok(r.documentAnomalies.includes('non-article-document-class:principios'));
  assert.ok(!r.documentAnomalies.includes('no-numeric-article-headings'));
});

test('principios fail-closed: only 2 sequential headings give zero records',()=>{
  const r=extractArticles(pagesOf(`1.- Integridad.\n${longBody}\n2.- Independencia.\n${longBody}`),source,meta);
  assert.equal(r.records.length,0);
  assert.ok(r.documentAnomalies.includes('no-numeric-article-headings'));
});

test('principios fail-closed: numbering gap breaks the class (no invented numbers)',()=>{
  const r=extractArticles(pagesOf(`1.- Integridad.\n${longBody}\n2.- Independencia.\n${longBody}\n4.- Legalidad.\n${longBody}\n5.- Honradez.\n${longBody}\n6.- Lealtad.\n${longBody}`),source,meta);
  assert.equal(r.records.length,0);
});

test('resolutivos class: decree resolve points extract as resolutivo records',()=>{
  const r=extractArticles(pagesOf(`DECRETO FIXTURE\nPrimero.\n${longBody}\nSegundo.\n${longBody}\nTercero.\n${longBody}`),source,meta);
  assert.equal(r.records.length,3);
  assert.deepEqual(r.records.map(x=>x.ordinalLabel),['Primero','Segundo','Tercero']);
  for(const rec of r.records){
    assert.equal(rec.articleId,null);
    assert.equal(rec.recordKind,'resolutivo');
    assert.equal(rec.quality.status,'quarantined');
    assert.ok(rec.quality.anomalies.includes('non-article-resolutivo-record'));
  }
  assert.equal(r.coverage.nonArticleClass,'resolutivos');
});

test('resolutivos cut at transitory boundary (transitory not structured, not absorbed)',()=>{
  const r=extractArticles(pagesOf(`Primero.\n${longBody}\nSegundo.\n${longBody}\nTRANSITORIOS\nPRIMERO.- Entra en vigor el dia de su publicacion en el periodico oficial del estado fixture.`+ ' '.repeat(30)),source,meta);
  assert.equal(r.records.length,2);
  assert.ok(!r.records[1].text.includes('Entra en vigor'));
  assert.ok(r.documentAnomalies.includes('non-article-transitory-content-not-structured'));
});

test('resolutivos fail-closed: a single resolve point gives zero records',()=>{
  const r=extractArticles(pagesOf(`Primero.\n${longBody}\n${longBody}\n${longBody}`),source,meta);
  assert.equal(r.records.length,0);
});

test('capitulos-numerados class: all-caps numbered chapters extract as capitulo records',()=>{
  const r=extractArticles(pagesOf(`CODIGO DE CONDUCTA FIXTURE\n1. DISPOSICIONES GENERALES\n${longBody}\n2. VALORES DE LOS SERVIDORES PUBLICOS\n${longBody}\n3. DEL INCUMPLIMIENTO Y VIGILANCIA\n${longBody}`),source,meta);
  assert.equal(r.records.length,3);
  assert.deepEqual(r.records.map(x=>x.headingTitle),['DISPOSICIONES GENERALES','VALORES DE LOS SERVIDORES PUBLICOS','DEL INCUMPLIMIENTO Y VIGILANCIA']);
  for(const rec of r.records){
    assert.equal(rec.articleId,null);
    assert.equal(rec.recordKind,'capitulo');
    assert.equal(rec.quality.status,'quarantined');
    assert.ok(rec.quality.anomalies.includes('non-article-capitulo-record'));
  }
  assert.equal(r.coverage.nonArticleClass,'capitulos-numerados');
});

test('capitulos fail-closed: title-case numbered enumerations are lists, not chapters',()=>{
  const r=extractArticles(pagesOf(`1. Constitución Política de los Estados Unidos Mexicanos.\n2. Constitución Política del Estado Fixture.\n3. Ley de Responsabilidades Administrativas del Estado Fixture.\n4. Ley de Justicia Administrativa del Estado Fixture.\n${longBody}`),source,meta);
  assert.equal(r.records.length,0);
  assert.ok(r.documentAnomalies.includes('no-numeric-article-headings'));
});

test('ordinary article documents are unaffected by the non-article path',()=>{
  const body='Texto sintético del artículo con contenido normativo de prueba suficientemente largo para el umbral estructural.';
  const r=extractArticles(pagesOf(`Artículo 1.- ${body}\nArtículo 2.- ${body}\nTRANSITORIOS`),source,meta);
  assert.equal(r.records.length,2);
  assert.equal(r.records[0].recordKind,undefined);
  assert.equal(r.coverage.nonArticleClass,undefined);
  assert.ok(!r.documentAnomalies.some(a=>a.startsWith('non-article')));
});

test('extractor version bumped to 31 for non-article classes',()=>{
  assert.ok(EXTRACTOR_VERSION>=31);
});
