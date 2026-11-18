import test from 'node:test';
import assert from 'node:assert/strict';
import {extractArticles} from '../server/legal-library.mjs';
const src={lawId:'t-law',title:'Ley de Prueba',url:'https://example.test/x.pdf',authority:'x',jurisdiction:'Guerrero'};
const meta={pdfSha256:'0'.repeat(64),retrievedAt:'2026-01-01'};
const run=text=>extractArticles(text.split('\f').map((t,i)=>({number:i+1,text:t})),src,meta);
const arts=r=>r.records.filter(x=>(x.recordKind??'articulo')==='articulo').map(x=>x.articleId);
const a=n=>`ARTÍCULO ${n}o.- Las autoridades del estado aplicarán esta ley número ${n} en el ámbito de su competencia.\n`;
test('publisher typo with the period glued to the word (ARTÍCULO.9o.-) opens the next sequential article (real shape: gro-ley-032)',()=>{
  const t=a(1)+a(2)+a(3)+a(4)+a(5)+a(6)+a(7)+a(8)+'ARTÍCULO.9o.- Todas las entidades y órganos administrativos se regirán por esta ley y su reglamento.\nARTÍCULO.10o.- Los ingresos de la Secretaría no estarán sujetos a contribuciones estatales.\n'+a(11).replace('11o','11');
  const r=run(t);
  assert.deepEqual(arts(r),['1','2','3','4','5','6','7','8','9','10','11']);
});
test('adversary: the glued form that is not the next sequential article (an inline reference) does not open an article',()=>{
  const t=a(1)+a(2)+a(3)+'ARTÍCULO.15o.- referencia fuera de secuencia que no debe abrir un artículo nuevo en este documento.\n'+a(4);
  const r=run(t);
  assert.deepEqual(arts(r),['1','2','3','4']);
});
