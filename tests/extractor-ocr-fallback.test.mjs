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
  assert.deepEqual(result.records.map(r=>r.articleId),['1','2'],`articles recovered from OCR text: ${JSON.stringify(result.records.map(r=>r.articleId))}`);
  for(const record of result.records){
    assert.equal(record.quality.status,'quarantined','OCR-derived records never reach structurally-verified');
    assert.ok(record.quality.anomalies.includes('ocr-derived-text-layer'));
  }
});

test('OCR page cap constant stays bounded',()=>{
  assert.ok(OCR_PAGE_CAP<=200,'OCR work stays bounded per document');
});
