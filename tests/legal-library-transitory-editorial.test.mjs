import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {parsePdfInWorker} from '../server/legal-library.mjs';

// Synthetic law, not a real corpus. Reproduces three layouts seen in the Cámara Ley Aduanera PDF:
// letter-spaced "T r a n s i t o r i o s" boundary, amounts-update note lines with wrapped date lists, and a derogated article followed by a section heading.
function pdf(lines){
  const content='BT /F1 11 Tf 14 TL 50 740 Td '+lines.map(l=>`(${l.replace(/[()\\]/g,'')}) Tj T*`).join(' ')+' ET';
  const objs=['<</Type/Catalog/Pages 2 0 R>>','<</Type/Pages/Kids[3 0 R]/Count 1>>','<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>','<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',`<</Length ${content.length}>>\nstream\n${content}\nendstream`];
  let out='%PDF-1.4\n';const offs=[];
  objs.forEach((b,i)=>{offs.push(out.length);out+=`${i+1} 0 obj\n${b}\nendobj\n`;});
  const x=out.length;
  out+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`+offs.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<</Size ${objs.length+1}/Root 1 0 R>>\nstartxref\n${x}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(out,'latin1'));
}
const LINES=[
 'LEY SINTETICA DE PRUEBA',
 'ARTICULO 1. Esta ley sintetica regula la importacion de mercancias ficticias con fines de prueba.',
 'ARTICULO 2. Se impondra una multa de $1,000.00 por cada documento ficticio omitido en la operacion.',
 'Multa de la fraccion actualizada DOF 01-03-2002, 28-04-2003, 04-04-2005',
 '10-04-2006, 09-05-2007. Articulo reformado DOF 31-12-1998',
 'ARTICULO 3. (Se deroga).',
 '09-05-2008, 12-05-2009. Articulo derogado DOF 09-12-2013',
 'ARTICULO 4. El plazo para responder la notificacion de esta ley sintetica sera de diez dias habiles.',
 'T r a n s i t o r i o s',
 'Primero. La presente ley sintetica entrara en vigor el dia siguiente de su publicacion ficticia.',
 'Segundo. Este texto transitorio no debe formar parte del ultimo articulo operativo de la ley.',
];
test('letter-spaced Transitorios heading ends the last article; amounts-update notes and derogated-article date lists are editorial',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'lex-trans-'));const f=path.join(dir,'s.pdf');await writeFile(f,pdf(LINES));
  const r=await parsePdfInWorker(f,{lawId:'synthetic-trans-law',url:'https://example.invalid/s',title:'LEY SINTETICA DE PRUEBA'},{pdfSha256:'3'.repeat(64),retrievedAt:'2026-11-18T00:00:00Z'});
  const ids=r.records.map(x=>x.articleId);
  assert.deepEqual(ids,['1','2','3','4'],JSON.stringify(ids));
  const by=Object.fromEntries(r.records.map(x=>[x.articleId,x.text]));
  assert.ok(!/Primero|Segundo|transitorio/i.test(by['4']),'transitory text does not leak into the last article: '+by['4']);
  assert.ok(!/DOF \d{2}-\d{2}-\d{4}/.test(r.records.map(x=>x.text).join(' ')),'no residual DOF note text in bodies');
  assert.equal(r.coverage.transitoryStartPage,1);
  assert.equal(r.coverage.transitoryPagesNotStructured,1,'coverage records how many pages from the boundary on were not structured');
});
