import test from 'node:test';
import assert from 'node:assert/strict';
import {extractArticles} from '../server/legal-library.mjs';
const src={lawId:'t-law',title:'Ley de Prueba',url:'https://example.test/x.pdf',authority:'x',jurisdiction:'Guerrero'};
const meta={pdfSha256:'0'.repeat(64),retrievedAt:'2026-01-01'};
const run=(pages,approved)=>extractArticles(pages.map((text,i)=>({number:i+1,text})),src,approved?{...meta,furnitureApproved:approved}:meta);
const body=n=>`Artículo ${n}. Las autoridades del estado aplicarán esta ley número ${n} en el ámbito de su competencia.\nLa interpretación corresponde a la secretaría competente en cada caso concreto ${n}.`;
const header=i=>`LEY NÚMERO 9 DE PRUEBA\nPARA EL ESTADO DE ${i%2?'GUERRERO':'GUERRER'}\n`;
const footer=i=>`\nH. Congreso del Estado de Guerrero\nO.M./D.P.L.\n${i+1}\n`;
const pages=(extra=()=>'')=>Array.from({length:8},(_,i)=>header(i)+body(i+1)+extra(i)+footer(i));
const texts=r=>r.records.map(x=>x.text).join('\n');
const find=(r,text)=>r.coverage.furnitureCandidates.find(c=>c.text===text);
test('detection only suggests: repeated header, initials and page numbers are reported as candidates and the text is NOT changed',()=>{
  const r=run(pages());
  const t=texts(r);
  assert.equal(r.records.length,8);
  assert.ok(/LEY NÚMERO 9 DE PRUEBA/.test(t)&&/O\.M\.\/D\.P\.L/.test(t));
  assert.equal(r.coverage.removedHeaderLines,0);
  assert.deepEqual(r.coverage.furnitureRemovedLog,[]);
  assert.equal(find(r,'O.M./D.P.L.').count,8);
  assert.ok(r.coverage.furnitureCandidates.some(c=>/^\d+$/.test(c.text)));
  assert.ok(r.documentAnomalies.some(a=>a.startsWith('running-page-furniture-candidates-kept-for-review:')));
  assert.ok(!r.documentAnomalies.some(a=>a.startsWith('running-page-furniture-removed-by-review')));
});
test('QA case: a legitimate operative sentence repeated at the page edge is detected as a candidate but is never removed without explicit approval',()=>{
  const sentence='Queda sin efecto lo dispuesto en el párrafo anterior.';
  const r=run(Array.from({length:8},(_,i)=>header(i)+body(i+1)+footer(i)+`${sentence}`));
  assert.equal((texts(r).match(/Queda sin efecto lo dispuesto/g)||[]).length,8);
  assert.ok(find(r,sentence));
});
test('reviewed removal: only the approved exact lines are removed, every removal is logged completely, and unapproved candidates stay',()=>{
  const r=run(pages(),[{text:'LEY NÚMERO 9 DE PRUEBA'},{text:'O.M./D.P.L.',pos:'b1'}]);
  const t=texts(r);
  assert.ok(!/LEY NÚMERO 9|O\.M\.\/D\.P\.L/.test(t));
  assert.ok(/H\. Congreso del Estado de Guerrero/.test(t));
  assert.equal(r.coverage.furnitureRemovedLog.length,16);
  assert.ok(r.coverage.furnitureRemovedLog.every(x=>x.page>=1&&Number.isInteger(x.line)&&x.text&&x.pos));
  assert.equal(r.coverage.removedHeaderLines,16);
  assert.ok(r.documentAnomalies.includes('running-page-furniture-removed-by-review:16'));
});
test('approval only applies to detected candidates: approving a body sentence that is not furniture removes nothing',()=>{
  const sentence='Queda sin efecto lo dispuesto en el párrafo anterior.';
  const r=run(Array.from({length:8},(_,i)=>header(i)+body(i+1)+(i===0?`\n${sentence}\nOtra línea del cuerpo.`:'')+footer(i)),[{text:sentence}]);
  assert.ok(texts(r).includes('Queda sin efecto'));
  assert.deepEqual(r.coverage.furnitureRemovedLog,[]);
});
test('control: short documents produce no candidates',()=>{
  const r=run(Array.from({length:3},(_,i)=>header(i)+body(i+1)+footer(i)));
  assert.deepEqual(r.coverage.furnitureCandidates,[]);
  assert.ok(!r.documentAnomalies.some(a=>a.startsWith('running-page-furniture')));
});
