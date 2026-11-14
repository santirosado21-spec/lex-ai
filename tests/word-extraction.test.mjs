import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {parseWordInWorker,detectDocumentFormat,EXTRACTOR_VERSION} from '../server/legal-library.mjs';

const fixtures=path.resolve('tests/fixtures');
const source=(title)=>({lawId:'MX-COL-fixture',title,url:'https://fixture.invalid/doc',authority:'fixture',jurisdiction:'MX-COL',reuseBasis:'fixture'});
const meta={pdfSha256:'0'.repeat(64),retrievedAt:'2026-11-14T00:00:00.000Z'};

test('magic bytes distinguish pdf, docx (OOXML zip) and legacy doc (OLE)',async()=>{
  const {readFile}=await import('node:fs/promises');
  assert.equal(detectDocumentFormat(Buffer.from('%PDF-1.7\n')), 'pdf');
  assert.equal(detectDocumentFormat(await readFile(path.join(fixtures,'word-law.docx'))), 'docx');
  assert.equal(detectDocumentFormat(await readFile(path.join(fixtures,'word-code.doc'))), 'doc');
  assert.equal(detectDocumentFormat(Buffer.from('<!DOCTYPE html>')), null);
});

test('docx extraction reads only document.xml text and segments articles',async()=>{
  const result=await parseWordInWorker(path.join(fixtures,'word-law.docx'),source('LEY DE PRUEBA PARA EL ESTADO DE COLIMA'),meta);
  assert.equal(result.extractorVersion,EXTRACTOR_VERSION);
  assert.equal(result.records.length,3);
  assert.match(result.records[0].text,/orden público/);
  assert.deepEqual(result.records.map(r=>r.articleId),['1','2','3']);
});

test('legacy doc extraction via antiword segments articles without executing anything',async()=>{
  const result=await parseWordInWorker(path.join(fixtures,'word-code.doc'),source('CODIGO DE PRUEBA DEL ESTADO DE COLIMA'),meta);
  assert.equal(result.records.length,2);
  assert.match(result.records[0].text,/regula los procedimientos/);
});

test('a non-document buffer is refused instead of reinterpreted',async()=>{
  const {writeFile,mkdtemp,rm}=await import('node:fs/promises');
  const {tmpdir}=await import('node:os');
  const dir=await mkdtemp(path.join(tmpdir(),'word-test-'));
  const bogus=path.join(dir,'bogus.docx');await writeFile(bogus,'<html>not a document</html>');
  await assert.rejects(()=>parseWordInWorker(bogus,source('X'),meta));
  await rm(dir,{recursive:true,force:true});
});
