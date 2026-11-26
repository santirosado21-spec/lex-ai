import test from 'node:test';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {REGULATION_LAYOUT,validateRegulationLayoutRequest,regulationLayoutReceipt} from '../server/regulation-layout.mjs';
import {parsePdfInWorker} from '../server/legal-library.mjs';
const source={lawId:'MX-FED-REG-LADUA',title:'REGLAMENTO de la Ley Aduanera',url:REGULATION_LAYOUT.url,textLayer:'poppler',textLayout:REGULATION_LAYOUT.option};
const meta={pdfSha256:REGULATION_LAYOUT.pdfSha256,retrievedAt:'2026-11-26T02:30:00Z'};
const file=new URL('../resources/trade/reglamento-aduanero-2026.pdf',import.meta.url).pathname;
const hash=x=>createHash('sha256').update(x).digest('hex');
test('explicit option rejects unknown values, different source, default layer and forced OCR',()=>{
 assert.equal(validateRegulationLayoutRequest({}),false);assert.equal(validateRegulationLayoutRequest(source),true);
 for(const change of [{textLayout:false},{textLayout:'layout'},{textLayer:undefined},{textLayer:'default'},{url:source.url+'?other'},{forceOcr:true},{forceOcr:false}])assert.throws(()=>validateRegulationLayoutRequest({...source,...change}));
});
test('actual PDF bytes and claimed pin must both match, no silent fallback',async t=>{
 const bytes=await readFile(file);assert.equal(hash(bytes),REGULATION_LAYOUT.pdfSha256);
 assert.equal(regulationLayoutReceipt(source,meta,bytes).revision,1);
 assert.throws(()=>regulationLayoutReceipt(source,{...meta,pdfSha256:'0'.repeat(64)},bytes));
 const altered=Buffer.concat([bytes,Buffer.from('\n')]);assert.throws(()=>regulationLayoutReceipt(source,meta,altered));
 const dir=await mkdtemp(path.join(tmpdir(),'reg-layout-'));t.after(()=>rm(dir,{recursive:true,force:true}));const wrong=path.join(dir,'altered.pdf');await writeFile(wrong,altered);
 await assert.rejects(parsePdfInWorker(wrong,source,meta),/hash mismatch/);
 await assert.rejects(parsePdfInWorker(file,{...source,url:'https://example.invalid/other.pdf'},meta),/Unsupported pinned/);
});
test('seven visual segment contracts, exact provenance, raw PDF and 282 identities preserved',async()=>{
 const before=hash(await readFile(file));const pinned=await parsePdfInWorker(file,source,meta);
 const plain=await parsePdfInWorker(file,{...source,textLayout:undefined},meta);
 const standard=await parsePdfInWorker(file,{...source,textLayout:undefined,textLayer:undefined},meta);
 const get=(r,id)=>r.records.find(x=>x.articleId===id).text;
 // Source pixels: p3 I owns a-d; p17 II is Descarga; p38 III starts Constancia;
 // p39/40 I owns a-d; p53 visual III starts garantia (raw Ill retained);
 // p77/78 IV owns a-f and V starts RFC; p42 literal wraps 36- / A.
 const anchors=[['6-A','d) Los demás requisitos que se establezcan mediante Reglas. II. Para poder realizar trámites'],['41','II. Descarga:'],['105','permanente; III. Constancia expedida'],['110','requerimiento, y II. Se establezca'],['158','empresa; Ill. La garantía'],['236','año; V. Estar inscrito'],['117','artículo 36- A de la Ley.']];
 for(const [id,anchor]of anchors){assert.ok(get(pinned,id).includes(anchor),id);assert.ok(!get(plain,id).includes(anchor),id+' reproduces old segment failure');}
 assert.equal(pinned.records.length,282);assert.deepEqual(pinned.records.map(x=>[x.articleId,x.text,x.sourcePages]),standard.records.map(x=>[x.articleId,x.text,x.sourcePages]));
 assert.equal(pinned.records.filter((x,i)=>x.text!==plain.records[i].text).length,7);
 assert.ok(pinned.records.every(x=>x.quality.status==='quarantined'));
 assert.equal(pinned.coverage.exportableArticles,0);assert.equal(hash(await readFile(file)),before);
 assert.deepEqual(pinned.coverage.parser.layout.arguments,['-layout','-enc','UTF-8']);assert.equal(pinned.coverage.parser.layout.option,REGULATION_LAYOUT.option);assert.equal(pinned.coverage.parser.layout.pdfSha256,before);assert.equal(pinned.coverage.parser.layout.legalReview,'pending');
 assert.equal(pinned.coverage.parser.layout.rawTextSha256,hash(execFileSync('pdftotext',['-layout','-enc','UTF-8',file,'-'])));
 assert.equal(plain.coverage.parser.layout,undefined);assert.equal(standard.coverage.parser,undefined);
 assert.equal(get(pinned,'158').includes('lV. Declaración'),true);assert.equal(get(pinned,'117').includes('36-A'),false);
});
