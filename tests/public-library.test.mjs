import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';import {buildPublicLibrary,openPublicLibrary,publicSource,searchTokens} from '../server/public-library.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
function fixture(n=1,extra={}){const lawId='MX-FED-SYNTHETIC',pdfSha256='a'.repeat(64),versionId=lawId+'@2026-10-30+'+pdfSha256.slice(0,16),text=`Artículo ${n}.- Este contenido sintético permite buscar contratos y obligaciones sin incorporar documentos privados ni clientes.`;return {id:versionId+':art:'+n,lawId,lawTitle:'Ley sintética',versionId,articleId:String(n),text,textSha256:hash(text),pdfSha256,sourceUrl:'https://www.diputados.gob.mx/LeyesBiblio/pdf/Synthetic.pdf',sourcePages:[1],jurisdiction:'MX-FED',publisher:'Cámara de Diputados',retrievedAt:'2026-10-30T00:00:00Z',quality:{status:'structurally-verified',currentness:'unverified'},effectiveAt:null,split:'train',splitGroup:lawId,...extra};}
async function setup(t,rows=[fixture()]){const dir=await mkdtemp(path.join(tmpdir(),'lex-public-index-'));t.after(()=>rm(dir,{recursive:true,force:true}));const corpus=rows.map(r=>JSON.stringify(r)).join('\n')+'\n';await writeFile(path.join(dir,'corpus.jsonl'),corpus);await writeFile(path.join(dir,'sha256.json'),JSON.stringify({'corpus.jsonl':hash(corpus)}));await writeFile(path.join(dir,'independent-extraction-audit.json'),JSON.stringify({corpusSha256:hash(corpus),checked:1,passed:1}));return {inputDir:dir,outputFile:path.join(dir,'public.sqlite')};}
test('public source preserves complete provenance and constrained source ID',()=>{const row=fixture(),s=publicSource(row);assert.match(s.id,/^[a-zA-Z0-9-]{1,100}$/);assert.equal(s.text,row.text);assert.equal(s.article,'1');assert.equal(s.version,row.versionId);assert.deepEqual(s.pages,[1]);assert.equal(s.status,'structurally-verified-currentness-unverified');assert.equal(s.effectiveAt,null);});
test('public index searches bounded pages and only stored public sources',async t=>{const opts=await setup(t,Array.from({length:12},(_,i)=>fixture(i+1)));const manifest=await buildPublicLibrary(opts);assert.equal(manifest.articles,12);const lib=await openPublicLibrary(opts.outputFile);t.after(()=>lib.close());const first=lib.search({query:'contratos'});assert.equal(first.sources.length,10);assert.equal(first.hasMore,true);assert.equal(lib.search({query:'contratos',offset:10}).sources.length,2);assert.equal(lib.search({query:'contratos',lawId:'MX-FED-NOT-IN-INDEX'}).sources.length,0);assert.equal(lib.getSource(first.sources[0].id).text,first.sources[0].text);assert.equal(lib.status().privateDocumentsIncluded,false);});
test('SQL and FTS operators are literal tokens, with hostile filters rejected',async t=>{const opts=await setup(t);await buildPublicLibrary(opts);const lib=await openPublicLibrary(opts.outputFile);t.after(()=>lib.close());for(const query of ['" OR * --','NEAR(contratos,1)','contratos\"; DROP TABLE articles; --','text:contratos NOT obligaciones'])assert.doesNotThrow(()=>lib.search({query}));assert.equal(lib.search({query:'contratos'}).sources.length,1);assert.throws(()=>lib.search({query:'contratos',lawId:"x' OR 1=1 --"}));assert.throws(()=>lib.search({query:'contratos',limit:11}));assert.throws(()=>lib.search({query:'contratos',offset:1001}));assert.throws(()=>searchTokens('*'));assert.throws(()=>searchTokens('x'.repeat(301)));});
test('hash mismatch, private fields and unapproved URLs fail before publication',async t=>{for(const row of [fixture(1,{textSha256:'b'.repeat(64)}),fixture(1,{matterId:'private'}),fixture(1,{sourceUrl:'https://evil.test/secret.pdf'}),fixture(1,{quality:{status:'quarantined',currentness:'unverified'}})]){const opts=await setup(t,[row]);await assert.rejects(buildPublicLibrary(opts));await assert.rejects(readFile(opts.outputFile),{code:'ENOENT'});}});
test('all versions of a law must remain in one partition',async t=>{const opts=await setup(t,[fixture(1),fixture(2,{split:'test'})]);await assert.rejects(buildPublicLibrary(opts),/partitions/);});
test('failed rebuild leaves existing index bytes and manifest intact',async t=>{const opts=await setup(t);await buildPublicLibrary(opts);const before=await readFile(opts.outputFile),manifest=await readFile(opts.outputFile+'.manifest.json');await writeFile(path.join(opts.inputDir,'corpus.jsonl'),'tampered');await assert.rejects(buildPublicLibrary(opts),/hash|audit/);assert.deepEqual(await readFile(opts.outputFile),before);assert.deepEqual(await readFile(opts.outputFile+'.manifest.json'),manifest);});
test('long articles preview explicitly while exact full source remains retrievable',async t=>{const text='Artículo 1.- '+('Contenido sintético sobre contratos. '.repeat(500));const opts=await setup(t,[fixture(1,{text,textSha256:hash(text)})]);await buildPublicLibrary(opts);const lib=await openPublicLibrary(opts.outputFile);t.after(()=>lib.close());const source=lib.search({query:'contratos'}).sources[0];assert.equal(source.truncated,true);assert.equal(source.text.length,12000);assert.equal(source.textLength,text.length);assert.equal(lib.getSource(source.id).text,text);assert.throws(()=>publicSource(fixture(1,{text:'a'.repeat(60001),textSha256:hash('a'.repeat(60001))})),/text/);});
test('changed SQLite bytes are refused by read-only opener',async t=>{const opts=await setup(t);await buildPublicLibrary(opts);await writeFile(opts.outputFile,'corrupted');await assert.rejects(openPublicLibrary(opts.outputFile),/integrity/);});
test('accented article designators (Quáter) are stored with canonical form and resolve accent-free lookups',async t=>{
 const row=fixture('26',{articleId:'26-QUÁTER',id:undefined});
 row.id=row.versionId+':art:26-QUÁTER';
 const source=publicSource(row);
 assert.equal(source.article,'26-QUÁTER');
 assert.equal(source.articleCanonical,'26-QUATER');
 const opts=await setup(t,[row]);await buildPublicLibrary(opts);
 const lib=await openPublicLibrary(opts.outputFile);t.after(()=>lib.close());
 for(const ref of ['26-QUATER','26-QUÁTER'])assert.equal(lib.lookupArticle({lawId:'MX-FED-SYNTHETIC',articleId:ref})?.article,'26-QUÁTER');
 // Negative classes keep failing closed: injection, malformed and overlong references.
 for(const bad of ['26-QUATER OR 1=1','26 QUÁTER','26-QU@TER','26-QUÁTERXSUFFIXEXCEDE','1234567','1-','-1','26-'])assert.throws(()=>lib.lookupArticle({lawId:'MX-FED-SYNTHETIC',articleId:bad}));
 assert.equal(lib.lookupArticle({lawId:'MX-FED-SYNTHETIC',articleId:'26-QUINQUIES'}),null);
});
test('publicSource rejects article ids outside the shared bounded grammar',()=>{
 for(const bad of ['26-quáter','ABC','26-QUÁTER-1-2-3-4','26-ESTESUFIJOESDEMASIADOLARGO',''])assert.throws(()=>publicSource(fixture(1,{articleId:bad,id:'x'})),/article|Invalid/);
});
test('legacy index with accented original (no articleCanonical) resolves canonical lookups',async t=>{
 // Índice construido a mano al formato del builder, con payload SIN articleCanonical
 // (forma de los índices anteriores a la reconciliación). Integridad preservada: el
 // manifiesto se calcula sobre los bytes reales, como exige openPublicLibrary.
 const dir=await mkdtemp(path.join(tmpdir(),'lex-public-legacy-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const file=path.join(dir,'public.sqlite');
 const {DatabaseSync}=await import('node:sqlite');
 const db=new DatabaseSync(file);
 const corpusSha256='d'.repeat(64);
 db.exec(`PRAGMA application_id=1279613016; PRAGMA user_version=1; CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE articles(id TEXT PRIMARY KEY,law_id TEXT NOT NULL,jurisdiction TEXT NOT NULL,payload TEXT NOT NULL); CREATE INDEX by_law ON articles(law_id);`);
 db.prepare('INSERT INTO metadata VALUES(?,?)').run('library',JSON.stringify({schemaVersion:1,kind:'public-legal-library',corpusSha256,privateDocumentsIncluded:false}));
 const legacy={id:'PUB-'+'e'.repeat(64),lawId:'MX-FED-SYN',jurisdiction:'MX-FED',article:'26-QUÁTER',retrievedAt:'2026-10-30T00:00:00Z',text:'legacy acentuado'};
 db.prepare('INSERT INTO articles VALUES(?,?,?,?)').run(legacy.id,legacy.lawId,legacy.jurisdiction,JSON.stringify(legacy));
 db.exec('PRAGMA integrity_check');db.close();
 const indexSha256=hash(await readFile(file));
 await writeFile(file+'.manifest.json',JSON.stringify({schemaVersion:1,kind:'public-legal-library',corpusSha256,indexSha256,bytes:(await readFile(file)).length}));
 const lib=await openPublicLibrary(file);t.after(()=>lib.close());
 for(const ref of ['26-QUATER','26-QUÁTER'])assert.equal(lib.lookupArticle({lawId:'MX-FED-SYN',articleId:ref})?.article,'26-QUÁTER');
 assert.equal(lib.lookupArticle({lawId:'MX-FED-SYN',articleId:'26-QUATE'}),null);
 assert.equal(lib.lookupArticle({lawId:'MX-FED-SYN',articleId:'999999'}),null);
});
