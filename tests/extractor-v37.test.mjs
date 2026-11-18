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
test('dictamen preamble with period-and-title headings (no dash) then the real law from article 1 keeps the whole law (real shape: gro-ley-072)',()=>{
  const pre='CONSIDERANDO\nArtículo 28. Prueba anticipada\nEl juez podrá ordenar la práctica de pruebas anticipadas cuando exista riesgo de pérdida.\nArtículo 2. Glosario\n......\nDe la I a la III . . . . .\nArtículo 4. Hechos ilícitos\nLos hechos ilícitos se determinarán conforme a la legislación penal aplicable.\nArtículo 2. Glosario\n......\n\f';
  const law='LEY NÚMERO 1 DE PRUEBA\nArtículo 1. Naturaleza y objeto de la ley\nLas disposiciones de la presente Ley son de orden público e interés social.\nArtículo 2. Glosario\nPara los efectos de esta Ley se entenderá por afectado a la persona titular del bien.\nArtículo 3. Autoridades\nLas autoridades aplicarán esta Ley en el ámbito de su competencia.\nArtículo 4. Supletoriedad\nPara los casos no previstos serán aplicables las normas generales.\n';
  const r=run(pre+law);
  assert.deepEqual(arts(r),['1','2','3','4']);
  assert.ok(r.documentAnomalies.includes('preface-operative-candidates-dropped-restart-before-art1'));
  assert.ok(!r.documentAnomalies.includes('operative-numbering-restarts-before-transitory-boundary'));
  assert.equal(r.coverage.prefaceRecordsPreserved,3);
});
test('a law that really repeats an article number without a later article 1 still stops at the restart',()=>{
  const body='LEY DE PRUEBA\nArtículo 2. Glosario\nTexto uno del glosario con contenido suficiente para ser un artículo.\nArtículo 3. Objeto\nTexto del objeto de la ley con contenido suficiente.\nArtículo 2. Glosario\nTexto repetido del glosario.\n';
  const r=run(body);
  assert.ok(r.documentAnomalies.includes('operative-numbering-restarts-before-transitory-boundary'));
});
test('regression (QA probe shape): a dictamen quoting article 2 twice and then period-style articles 1 and 2 must not shadow the real law that uses the dash format',()=>{
  const pre='CONSIDERANDO\nArtículo 2. Glosario de la iniciativa con texto citado del dictamen.\nArtículo 2. Glosario de la iniciativa con texto citado del dictamen.\nArtículo 1. Las disposiciones citadas del dictamen son de orden público.\nArtículo 2. Para los efectos citados se entenderá por afectado a la persona.\n\f';
  const law='LEY REAL DE PRUEBA\nARTÍCULO 1.- Las disposiciones de la presente Ley son de orden público e interés social.\nARTÍCULO 2.- Para los efectos de la presente Ley se entenderá por afectado a la persona titular.\nARTÍCULO 3.- Las autoridades aplicarán esta Ley en el ámbito de su competencia.\n';
  const r=run(pre+law);
  assert.deepEqual(arts(r),['1','2','3']);
  assert.ok(r.records.every(x=>!/citad/.test(x.text)));
  assert.ok(r.documentAnomalies.includes('preface-operative-candidates-dropped-restart-before-art1'));
  assert.ok(r.coverage.prefaceRecordsPreserved>=1);
});
test('ambiguous period-style quotations (two candidate article 1 headings, both followed by article 2) are not guessed: the extractor keeps its stop',()=>{
  const pre='CONSIDERANDO\nArtículo 2. Glosario de la iniciativa con texto citado del dictamen.\nArtículo 2. Glosario de la iniciativa con texto citado del dictamen.\nArtículo 1. Las disposiciones citadas del dictamen son de orden público.\nArtículo 2. Para los efectos citados se entenderá por afectado a la persona.\n\f';
  const law='LEY REAL DE PRUEBA\nArtículo 1. Las disposiciones de la presente Ley son de orden público e interés social.\nArtículo 2. Para los efectos de la presente Ley se entenderá por afectado a la persona titular.\nArtículo 3. Las autoridades aplicarán esta Ley en el ámbito de su competencia.\n';
  const r=run(pre+law);
  assert.ok(r.documentAnomalies.includes('operative-numbering-restarts-before-transitory-boundary'));
  assert.ok(!r.documentAnomalies.includes('preface-operative-candidates-dropped-restart-before-art1'));
});
