import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {Readable} from 'node:stream';
import {parseWordInWorker,detectDocumentFormat,EXTRACTOR_VERSION,docxParagraphsFromXmlStream} from '../server/legal-library.mjs';

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

test('streamed document.xml scan matches v27 string semantics byte-for-byte',async()=>{
  const xmlUnescape=value=>value.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
  const v27=xml=>xml.split(/<\/w:p[ >]/).map(segment=>[...segment.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(match=>match[1]).join('')).map(xmlUnescape);
  const xml='<w:body>'
    +'<w:p><w:r><w:t>Artículo 1o.- La presente ley es de orden público &amp; social.</w:t></w:r></w:p>'
    +'<w:p><w:r><w:t xml:space="preserve">Texto con <acabo> anidado falso</w:t></w:r><w:r><w:t> segunda parte</w:t></w:r></w:p>'
    +'<w:p ><w:r><w:t/></w:r></w:p>'
    +'<w:p><w:tbl><w:tc><w:t>celda &lt;tabulada&gt;</w:t></w:tc></w:tbl></w:p>'
    +'<w:sectPr><w:pgSz/></w:sectPr></w:body><w:t>fuera de párrafo</w:t>';
  const expected=v27(xml);
  for(const chunkSize of [1,7,64,xml.length]){
    const chunks=[];for(let i=0;i<xml.length;i+=chunkSize)chunks.push(Buffer.from(xml.slice(i,i+chunkSize)));
    assert.deepEqual(await docxParagraphsFromXmlStream(Readable.from(chunks)),expected,`chunk size ${chunkSize}`);
  }
  // multibyte UTF-8 split across chunks must decode through the streaming decoder
  const buf=Buffer.from('<w:p><w:t>Artículo áéíóú ñ ü</w:t></w:p>','utf8');
  const cut=buf.indexOf(Buffer.from('á'))+1;
  assert.deepEqual(await docxParagraphsFromXmlStream(Readable.from([buf.subarray(0,cut),buf.subarray(cut)])),['Artículo áéíóú ñ ü','']);
});

test('streaming caps fail closed on runaway input',async()=>{
  const big='<w:p><w:t>'+'x'.repeat(8*1024*1024+1)+'</w:t></w:p>';
  await assert.rejects(()=>docxParagraphsFromXmlStream(Readable.from([Buffer.from(big)])),/paragraph exceeds safety cap/);
  const runawayChunks=[Buffer.from('<w:p><w:t>'),...Array.from({length:5},()=>Buffer.from('x'.repeat(1024*1024)))];
  await assert.rejects(()=>docxParagraphsFromXmlStream(Readable.from(runawayChunks)),/text run exceeds safety cap/);
  const manyParagraphs='<w:p><w:t>a</w:t></w:p>'.repeat(100);
  assert.equal((await docxParagraphsFromXmlStream(Readable.from([Buffer.from(manyParagraphs)]))).length,101);
});

test('a non-document buffer is refused instead of reinterpreted',async()=>{
  const {writeFile,mkdtemp,rm}=await import('node:fs/promises');
  const {tmpdir}=await import('node:os');
  const dir=await mkdtemp(path.join(tmpdir(),'word-test-'));
  const bogus=path.join(dir,'bogus.docx');await writeFile(bogus,'<html>not a document</html>');
  await assert.rejects(()=>parseWordInWorker(bogus,source('X'),meta));
  await rm(dir,{recursive:true,force:true});
});
