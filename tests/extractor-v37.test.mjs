import test from 'node:test';
import assert from 'node:assert/strict';
import {extractArticles,EXTRACTOR_VERSION} from '../server/legal-library.mjs';
const src={lawId:'t-law',title:'Ley de Prueba',url:'https://example.test/x.pdf',authority:'x',jurisdiction:'Guerrero'};
const meta={pdfSha256:'0'.repeat(64),retrievedAt:'2026-01-01'};
const run=text=>extractArticles(text.split('\f').map((t,i)=>({number:i+1,text:t})),src,meta);
const arts=r=>r.records.filter(x=>(x.recordKind??'articulo')==='articulo').map(x=>x.articleId);
test('v37 version',()=>assert.equal(EXTRACTOR_VERSION,37));
test('dictamen preamble quoting articles 2,3 then a later real law starting at article 1 keeps the whole law (real shape: gro-ley-132)',()=>{
  const pre='Dictamen con proyecto de decreto.\nArtículo 2.- Para los efectos de la presente ley, se considerarán de interés público las acciones del Estado.\nArtículo 3.- Para los efectos de esta ley, se tomarán en cuenta las terminologías de la ley general.\nArtículo 2.- Para los efectos de la presente ley, se considerarán de interés público las acciones del Estado.\n\f';
  const law='LEY NUMERO 1 DE PRUEBA\nARTÍCULO 1.- Las disposiciones de la presente Ley son de orden público e interés social.\nARTÍCULO 2.- Para los efectos de la presente Ley, se considerarán de interés público las acciones.\nARTÍCULO 3.- Para los efectos de esta Ley, se tomarán en cuenta las terminologías.\nARTÍCULO 4.- Las autoridades aplicarán esta Ley.\nARTÍCULO 5.- Para los casos no previstos serán aplicables supletoriamente las normas generales.\n';
  const r=run(pre+law);
  assert.deepEqual(arts(r),['1','2','3','4','5']);
  assert.ok(r.documentAnomalies.includes('preface-operative-candidates-dropped-restart-before-art1'));
  assert.ok(r.prefaceRecords.some(x=>x.articleId==='2'),'quoted candidates are preserved, not erased');
});
test('a wrapped citation leaving TRANSITORIO alone on a line is body text, the real TRANSITORIOS heading still ends the body',()=>{
  const t='ARTÍCULO 1.- Texto del primero.\nARTÍCULO 2.- Texto del segundo.\nA TRAVES DEL DECRETO 220 PUBLICADO EN SU ARTÍCULO QUINTO\nTRANSITORIO.\n…..Se deroga\nARTÍCULO 3.- Texto del tercero.\nTRANSITORIOS\nPRIMERO.- La presente Ley entrará en vigor al día siguiente de su publicación.\n';
  const r=run(t);
  assert.deepEqual(arts(r),['1','2','3']);
  assert.ok(r.transitories.length>=1,'real transitories separated');
  assert.ok(!r.records.find(x=>x.articleId==='2').text.includes('PRIMERO.-'));
});
test('heading variants: no-space with dash, period after the word, ordinal mark plus uppercase word (first article included)',()=>{
  const t='Capítulo I\nDisposiciones Generales\nArticulo 1° La Comisión es un organismo de interés público con personalidad propia.\nArtículo 2. La Comisión tiene por objeto investigar los hechos.\nArticulo. 3. Los principios rigen la actuación de la Comisión.\nArticulo4.- El periodo de la investigación comprenderá varios años.\nArticulo 5º Se entiende por derecho a la verdad la facultad de las víctimas.\n';
  const r=run(t);
  assert.deepEqual(arts(r),['1','2','3','4','5']);
});
test('a body reference with the same shapes in the middle of a sentence does not open an article',()=>{
  const t='ARTÍCULO 1.- Texto del primero que cita lo dispuesto por el\nArticulo 1° constitucional y los tratados internacionales aplicables en la materia.\nARTÍCULO 2.- Texto del segundo.\n';
  const r=run(t);
  assert.deepEqual(arts(r),['1','2']);
  assert.ok(r.records[0].text.includes('constitucional'));
});
