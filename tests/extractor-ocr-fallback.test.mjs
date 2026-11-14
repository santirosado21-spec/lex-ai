import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,access} from 'node:fs/promises';
import {execFile as execFileCb} from 'node:child_process';
import {promisify} from 'node:util';
import os from 'node:os';
import path from 'node:path';
import {parsePdfInWorker,detectOcrTools,OCR_PAGE_CAP} from '../server/legal-library.mjs';

const execFile=promisify(execFileCb);
const FONT='/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf';

// Synthetic image-only (scanned-style) PDF built with Pillow: two pages of a
// fake law with numeric article headings. All text is synthetic; no real corpus.
const MAKER=`
import sys
from PIL import Image, ImageDraw, ImageFont
font=ImageFont.truetype(sys.argv[2],44)
small=ImageFont.truetype(sys.argv[2],38)
def page(lines):
    img=Image.new('L',(2550,3300),255);d=ImageDraw.Draw(img);y=250
    for text,f in lines:
        d.text((200,y),text,font=f,fill=0);y+=110
    return img
p1=page([
 ('LEY SINTETICA DE PRUEBA OCR',font),
 ('CAMARA DE DIPUTADOS',small),
 ('Articulo 1o.- La presente ley es sintetica y solo sirve',small),
 ('para verificar la ruta de OCR del extractor.',small),
 ('Articulo 2o.- Ningun texto de esta pagina proviene de un',small),
 ('documento oficial real ni valida cobertura juridica.',small),
 ('Articulo 3, Todo encabezado con coma atipica se repara',small),
 ('solo cuando el numero es el esperado en secuencia.',small),
])
p2=page([
 ('TRANSITORIOS',font),
 ('PRIMERO.- La presente ley entrara en vigor al dia siguiente',small),
 ('de su publicacion en el periodico oficial sintetico.',small),
])
p1.save(sys.argv[1],save_all=True,append_images=[p2],resolution=300.0)
`;

async function available(){
  try{await access(FONT);}catch{return false;}
  const tools=detectOcrTools();
  if(!tools.available)return false;
  try{await execFile('python3',['-c','import PIL']);}catch{return false;}
  return true;
}

test('scanned PDF without text layer falls back to local OCR and stays quarantined',{timeout:240000,skip:!(await available())&&'requires tesseract+pdftoppm+python3-PIL'},async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'lex-ocr-fixture-'));
  const fixture=path.join(dir,'scanned-law.pdf');
  const maker=path.join(dir,'make-fixture.py');
  await writeFile(maker,MAKER);
  await execFile('python3',[maker,fixture,FONT],{timeout:60000});
  const result=await parsePdfInWorker(fixture,{lawId:'synthetic-ocr-law',url:'https://example.invalid/synthetic',title:'LEY SINTETICA DE PRUEBA OCR'},{pdfSha256:'0'.repeat(64),retrievedAt:'2026-11-14T00:00:00Z'});
  assert.ok(result.coverage.ocr&&result.coverage.ocr.engine==='tesseract',`OCR diagnostics present: ${JSON.stringify(result.coverage.ocr)}`);
  assert.ok(['spa','eng'].includes(result.coverage.ocr.lang));
  assert.ok(result.documentAnomalies.includes('ocr-derived-text-layer'));
  assert.ok(result.documentAnomalies.includes('ocr-ordinal-suffix-fused-heading-repaired'));
  assert.ok(result.documentAnomalies.includes('ocr-comma-terminator-heading-repaired'));
  assert.deepEqual(result.records.map(r=>r.articleId),['1','2','3'],`articles recovered from OCR text: ${JSON.stringify(result.records.map(r=>r.articleId))}`);
  for(const record of result.records){
    assert.equal(record.quality.status,'quarantined','OCR-derived records never reach structurally-verified');
    assert.ok(record.quality.anomalies.includes('ocr-derived-text-layer'));
  }
});

test('OCR page cap constant stays bounded',()=>{
  assert.ok(OCR_PAGE_CAP<=200,'OCR work stays bounded per document');
});

test('registry forceOcr flag widens the OCR trigger (digital layer above char floor still OCRs)',{timeout:240000,skip:!(await available())&&'requires tesseract+pdftoppm+python3-PIL'},async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'lex-ocr-force-'));
  const fixture=path.join(dir,'scanned-law.pdf');
  const maker=path.join(dir,'make-fixture.py');
  await writeFile(maker,MAKER);
  await execFile('python3',[maker,fixture,FONT],{timeout:60000});
  const result=await parsePdfInWorker(fixture,{lawId:'synthetic-ocr-law',forceOcr:true,url:'https://example.invalid/synthetic',title:'LEY SINTETICA DE PRUEBA OCR FORZADA'},{pdfSha256:'1'.repeat(64),retrievedAt:'2026-11-14T00:00:00Z'});
  assert.equal(result.coverage.ocr?.forced,true,'OCR diagnostics mark the run as registry-forced');
  assert.ok(result.documentAnomalies.includes('registry-forced-ocr'));
  assert.ok(result.documentAnomalies.includes('ocr-derived-text-layer'));
  for(const record of result.records){
    assert.equal(record.quality.status,'quarantined','forced-OCR records never reach structurally-verified');
  }
});

// Minimal one-page digital-text PDF builder (raw PDF with correct xref), used
// to prove the forceOcr flag widens the trigger when the text layer EXISTS.
function digitalPdfBytes(line){
  const content=`BT /F1 18 Tf 72 720 Td (${line}) Tj ET`;
  const objs=[
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>',
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
    `<</Length ${content.length}>>\nstream\n${content}\nendstream`,
  ];
  let pdf='%PDF-1.4\n';const offsets=[];
  objs.forEach((body,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${body}\nendobj\n`;});
  const xref=pdf.length;
  pdf+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`+offsets.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('');
  pdf+=`trailer\n<</Size ${objs.length+1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(pdf,'latin1'));
}

test('forceOcr runs OCR even when the digital text layer is above the char floor',{timeout:240000,skip:!(await available())&&'requires tesseract+pdftoppm+python3-PIL'},async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'lex-ocr-force-digital-'));
  const fixture=path.join(dir,'digital.pdf');
  await writeFile(fixture,digitalPdfBytes('Encabezado digital de prueba con suficiente texto para superar el piso'));
  const result=await parsePdfInWorker(fixture,{lawId:'synthetic-force-digital',forceOcr:true,url:'https://example.invalid/digital',title:'FIXTURE DIGITAL FORCE OCR'},{pdfSha256:'2'.repeat(64),retrievedAt:'2026-11-14T00:00:00Z'});
  assert.ok(result.coverage.ocr,'OCR ran despite the digital layer being above the floor');
  assert.equal(result.coverage.ocr.forced,true);
});
