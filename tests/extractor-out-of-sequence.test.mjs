import test from 'node:test';
import assert from 'node:assert/strict';
import {extractArticles} from '../server/legal-library.mjs';

// EXTRACTOR_VERSION=33: reference preservation on the strict numeric-heading
// path, plus characterization tests pinning the reviewed-and-kept behavior for
// out-of-sequence headings. All text is synthetic.
//
// Background (reported 2026-11-17, reproduced independently the same day):
// R1: a wrapped body reference capitalized at line start with a terminator and
//     a forward number ("Artículo 15. de la presente ley") used to OPEN a
//     spurious article and split the current one. Fixed: lowercase continuation
//     + forward gap stays body text.
// R2: heading-shaped lines with out-of-sequence numbers either open a silent
//     jump (strict path) or are absorbed into the previous article (period-less
//     / loose / ordinal paths). REVIEWED AND KEPT: frozen real-document
//     evidence (legal-library tests: official numbering variants, derogated
//     paren markers, excerpted codes, LGSMIME period-less headings) requires
//     tolerating jumps and absorbing ambiguous shapes; stopping would lose
//     document tails, and absorption preserves the text. Stopping at these
//     boundaries needs an authorized real-document review first.
const source={lawId:'fixture-law',title:'LEY FIXTURE SINTETICA',url:'https://fixture.example/ley.pdf',authority:'Fixture',jurisdiction:'MX-FIX',reuseBasis:'fixture'};
const meta={pdfSha256:'a'.repeat(64),retrievedAt:'2026-11-17T00:00:00.000Z'};
const pagesOf=text=>[{number:1,text}];
const body=tag=>`Texto sintético ${tag} con contenido normativo de prueba suficientemente largo para el umbral estructural.`;
const clean=(nums,fmt=n=>`Artículo ${n}.- ${body('del artículo '+n)}`)=>nums.map(fmt).join('\n');

test('clean sequential documents keep byte-identical structure',()=>{
  const r=extractArticles(pagesOf(clean([1,2,3,4,5])+'\nTRANSITORIOS'),source,meta);
  assert.deepEqual(r.records.map(x=>x.articleId),['1','2','3','4','5']);
  assert.equal(r.documentAnomalies.length,0);
  assert.ok(r.records.every(x=>x.quality.status==='structurally-verified'));
});

test('R1 fixed: capitalized wrapped reference, terminator, forward gap, lowercase tail stays body',()=>{
  const text=clean([1,2,3])+'\n…de conformidad con lo dispuesto en el\nArtículo 15. de la presente ley, que establece obligaciones adicionales para los sujetos regulados.\n'+clean([4,5])+'\nTRANSITORIOS';
  const r=extractArticles(pagesOf(text),source,meta);
  assert.deepEqual(r.records.map(x=>x.articleId),['1','2','3','4','5']);
  const a3=r.records.find(x=>x.articleId==='3');
  assert.ok(a3.text.includes('Artículo 15. de la presente ley'));
  assert.equal(r.documentAnomalies.length,0);
});

test('R1: lowercase references and cross-line splits never matched (unchanged)',()=>{
  const text=clean([1,2,3])+'\n…de conformidad con lo dispuesto en el\nartículo 15 de la presente ley, que establece obligaciones adicionales para los sujetos regulados.\n…véase el Artículo\n16 de la presente ley, que continúa la referencia partida por un salto de línea aquí.\n'+clean([4,5])+'\nTRANSITORIOS';
  const r=extractArticles(pagesOf(text),source,meta);
  assert.deepEqual(r.records.map(x=>x.articleId),['1','2','3','4','5']);
});

test('R1 residual: capitalized reference with UPPERCASE continuation still opens (documented ambiguity)',()=>{
  // No local signal distinguishes "Artículo 15. De conformidad..." from a real
  // heading like the frozen "ARTICULO 136. Derogado" case; gating it would
  // break real documents. Pinned as current behavior pending real-doc review.
  const text=clean([1,2,3])+'\n…según lo previsto en el\nArtículo 15. De conformidad con ese precepto, las obligaciones subsisten para todos los sujetos regulados.\n'+clean([4,5])+'\nTRANSITORIOS';
  const r=extractArticles(pagesOf(text),source,meta);
  assert.deepEqual(r.records.map(x=>x.articleId),['1','2','3','15','4','5']);
});

test('R2 kept: strict forward jump opens and continues (official numbering variants require it)',()=>{
  const r=extractArticles(pagesOf(clean([1,2,3])+'\n'+clean([7,8])+'\nTRANSITORIOS'),source,meta);
  assert.deepEqual(r.records.map(x=>x.articleId),['1','2','3','7','8']);
});

test('R2 kept: backward candidate re-triggers the restart stop (citation guard)',()=>{
  const text=clean([1,2,3])+'\nArtículo 2.- Cita con terminador al propio artículo segundo del documento aquí.\nTRANSITORIOS';
  const r=extractArticles(pagesOf(text),source,meta);
  assert.ok(r.documentAnomalies.includes('operative-numbering-restarts-before-transitory-boundary'));
});

test('R2 kept: period-less whole-line out-of-sequence heading is absorbed as body (v17 doctrine)',()=>{
  const text=[1,2,3].map(n=>`Artículo ${n}\n${body('del artículo '+n)}`).join('\n')+'\nArtículo 7\n'+body('del artículo 7')+'\nTRANSITORIOS';
  const r=extractArticles(pagesOf(text),source,meta);
  assert.deepEqual(r.records.map(x=>x.articleId),['1','2','3']);
  const a3=r.records.find(x=>x.articleId==='3');
  assert.ok(a3.text.includes('Artículo 7'));
});

test('R2 kept: loose no-terminator out-of-sequence heading is absorbed as body (v19 doctrine)',()=>{
  const text=clean([1,2,3])+'\nArtículo 7 Encabezado del artículo siete con mayúscula inicial y sin terminador aquí.\n'+body('del artículo 7')+'\nTRANSITORIOS';
  const r=extractArticles(pagesOf(text),source,meta);
  assert.deepEqual(r.records.map(x=>x.articleId),['1','2','3']);
});

test('R2 kept: spelled-ordinal out-of-sequence heading is absorbed as body',()=>{
  const text=['PRIMERO','SEGUNDO','TERCERO'].map(w=>`ARTICULO ${w}.- ${body('ordinal '+w)}`).join('\n')+'\nARTICULO SÉPTIMO.- '+body('ordinal SÉPTIMO')+'\nTRANSITORIOS';
  const r=extractArticles(pagesOf(text),source,meta);
  assert.deepEqual(r.records.map(x=>x.articleId),['1','2','3']);
});

test('suffixed and in-sequence headings unaffected by the gate',()=>{
  const text=`Artículo 1.- ${body('del artículo 1')}\nArtículo 1 Bis.- ${body('del artículo 1 Bis')}\nArtículo 2.- ${body('del artículo 2')}\nTRANSITORIOS`;
  const r=extractArticles(pagesOf(text),source,meta);
  assert.deepEqual(r.records.map(x=>x.articleId),['1','1-BIS','2']);
});
