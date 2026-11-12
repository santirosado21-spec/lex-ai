import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {parseOfficialIndex,decodeIndex,extractArticles,splitForLaw,exportLibrary,ingestLibrary} from '../server/legal-library.mjs';
const source={id:'testlaw',lawId:'MX-FED-TESTLAW',title:'LEY SINTÉTICA DE PRUEBA',url:'https://www.diputados.gob.mx/LeyesBiblio/pdf/Testlaw.pdf',authority:'Cámara de Diputados',jurisdiction:'MX-FED',reuseBasis:{kind:'synthetic-fixture'}};
const meta={pdfSha256:'a'.repeat(64),retrievedAt:'2026-10-30T00:00:00.000Z'};
const article='Artículo 1.- Este texto completamente sintético permite comprobar la conservación del contenido y su procedencia.';
const pages=[{number:1,text:`${source.title}\nCÁMARA DE DIPUTADOS DEL H. CONGRESO DE LA UNIÓN\nÚltima Reforma DOF 01-01-2026\n${article}\nPárrafo reformado DOF 01-01-2026\n1 de 2`},{number:2,text:'Secretaría General\nLa continuación pertenece al mismo artículo y conserva su página.\nCAPÍTULO II\nDe las reglas sintéticas\nArtículo 2.- Una disposición sintética diferente permite comprobar segmentación y separación de evidencia documental.\nTRANSITORIOS\nArtículo Primero.- No debe integrarse al artículo segundo.'}];
async function temporary(t){const dir=await mkdtemp(path.join(tmpdir(),'lex-library-'));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}
test('official index reads Latin-1, numeric filenames and excludes mobile/foreign duplicates',()=>{const html='<table><tr><td>1</td><td><a href="ref/test.htm">LEY sintética</a></td><td><a href="pdf/79.pdf">PDF</a><a href="pdf_mov/79.pdf">Móvil</a><a href="https://evil.test/pdf/x.pdf">otro</a></td></tr></table>';const decoded=decodeIndex(Buffer.from(html,'latin1'));assert.equal(decoded.encoding,'windows-1252');const result=parseOfficialIndex(decoded.text);assert.equal(result.sources.length,1);assert.equal(result.sources[0].id,'law-79');assert.equal(result.sources[0].title,'LEY sintética');assert.throws(()=>parseOfficialIndex('<p>outage</p>'),/vacío/);});
test('article extraction preserves exact substantive text, pages and unknown validity; excludes editorial and sections',()=>{const result=extractArticles(pages,source,meta);assert.equal(result.records.length,2);assert.deepEqual(result.documentAnomalies,[]);const first=result.records[0];assert.deepEqual(first.sourcePages,[1,2]);assert.equal(first.declaredAmendedAt,'2026-01-01');assert.equal(first.effectiveAt,null);assert.equal(first.text,article+' La continuación pertenece al mismo artículo y conserva su página.');assert.deepEqual(first.editorialNotes,['Párrafo reformado DOF 01-01-2026']);assert.equal(first.quality.status,'structurally-verified');assert.doesNotMatch(result.records[1].text,/TRANSITORIOS|Primero/);});
test('missing transitory boundary and restarted numbering fail closed',()=>{const missing=extractArticles([{number:1,text:article}],source,meta);assert.equal(missing.records[0].quality.status,'quarantined');assert.ok(missing.documentAnomalies.includes('no-explicit-transitory-boundary'));const restart=extractArticles([{number:1,text:article+'\n'+article}],source,meta);assert.ok(restart.documentAnomalies.includes('operative-numbering-restarts-before-transitory-boundary'));assert.ok(restart.records.every(r=>r.quality.status==='quarantined'));});
test('inserted article identifiers remain separate',()=>{const result=extractArticles([{number:1,text:article.replace('1.-','1 Bis.-')+'\n'+article.replace('1.-','1-A.-')+'\nTRANSITORIOS'}],source,meta);assert.deepEqual(result.records.map(x=>x.articleId),['1-BIS','1-A']);});
test('law split is stable for all versions and exact cross-partition content is excluded',async t=>{const dir=await temporary(t);const first=extractArticles(pages,source,meta);const newer=extractArticles(pages,source,{...meta,pdfSha256:'b'.repeat(64)});assert.equal(first.records[0].split,newer.records[0].split);assert.equal(first.records[0].split,splitForLaw(source.lawId));const duplicate=structuredClone(first);duplicate.records=duplicate.records.map(r=>({...r,id:r.id+'-other',lawId:'OTHER',split:r.split==='train'?'test':'train'}));const result=await exportLibrary([first,duplicate],dir);assert.equal(result.articles,0);assert.equal(result.exactDuplicateExclusions,4);});
test('ingest resumes immutable versions and cached extraction without calling parser again',async t=>{const dir=await temporary(t);let count=0;const extractor=async(file,s,m)=>{count++;return extractArticles(pages,s,m);};const fetchImpl=async url=>url.endsWith('/robots.txt')?new Response('',{status:404}):new Response('%PDF-1.4 synthetic test data',{headers:{'content-type':'application/pdf'}});const options={catalog:{sources:[source]},outputDir:dir,limit:1,fetchImpl,extractor,sleep:async()=>{}};const first=await ingestLibrary(options);assert.equal(first.state,'complete');assert.equal(first.export.articles,2);const second=await ingestLibrary({...options,download:false});assert.equal(second.export.articles,2);assert.equal(count,1);assert.deepEqual(JSON.parse(await readFile(path.join(dir,'acquisitions/manifest.json'),'utf8')).sources.testlaw.versions.length,1);});
test('blocked URL and failed download produce no invented training records',async t=>{const dir=await temporary(t);let requests=0;await assert.rejects(ingestLibrary({catalog:{sources:[{...source,url:'https://evil.test/document.pdf'}]},outputDir:dir,limit:1,fetchImpl:async()=>{requests++;throw new Error('must not fetch');},sleep:async()=>{}}),/permitid|autorizad/i);assert.equal(requests,0);assert.equal(JSON.parse(await readFile(path.join(dir,'status.json'),'utf8')).state,'failed');});
test('exclusive ingest lock blocks concurrent writers and budget refuses a batch before download',async t=>{const dir=await temporary(t);await writeFile(path.join(dir,'ingest.lock'),'{}');await assert.rejects(ingestLibrary({catalog:{sources:[source]},outputDir:dir}),/already running/);await rm(path.join(dir,'ingest.lock'));let calls=0;await assert.rejects(ingestLibrary({catalog:{sources:[source]},outputDir:dir,limit:1,maxTotalBytes:1,fetchImpl:async()=>{calls++;},sleep:async()=>{}}),/budget/);assert.equal(calls,0);});
test('official numbering variants and lowercase cross-reference never restart article numbering',()=>{const headings=['1o.-A.-','8o.-A.-','19-1.','58-1.','103-Bis.-','268 Bis-1.-','353-Ñ.-'];const text=headings.map(h=>article.replace('1.-',h)).join('\n')+'\nartículo 1. Esta referencia continúa el artículo anterior sin abrir una disposición nueva.\nTRANSITORIOS';const result=extractArticles([{number:1,text}],source,meta);assert.deepEqual(result.records.map(r=>r.articleId),['1-A','8-A','19-1','58-1','103-BIS','268-BIS-1','353-Ñ']);assert.deepEqual(result.documentAnomalies,[]);assert.match(result.records.at(-1).text,/artículo 1\. Esta referencia/);});
test('abbreviated Art. headings segment state-code format without opening cross-references',()=>{const abbreviated='Art. 6o.- La voluntad de los particulares no puede eximir de la observancia de la ley sintética.\nArt. 17 Bis.- Con excepción de lo dispuesto en el Artículo 2289, los conceptos de interés son sintéticos.\nArt. 18.- Texto sintético posterior que menciona Art. 2289, los conceptos anteriores no abren disposición.\nTRANSITORIOS';const result=extractArticles([{number:1,text:abbreviated}],source,meta);assert.deepEqual(result.records.map(r=>r.articleId),['6','17-BIS','18']);assert.deepEqual(result.documentAnomalies,[]);assert.match(result.records[1].text,/Artículo 2289, los conceptos/);});
test('roman bis suffixes keep distinct ids and end-of-line cross-references open no heading',()=>{const text=['Art. 410 Bis.- Texto sintético del artículo cuatrocientos diez bis con contenido propio verificable.','Art. 410 Bis I.- Primer texto sintético posterior al bis.','Art. 410 Bis II.- Segundo texto sintético posterior al bis.','Art. 410-Bis-III.- Tercer texto sintético posterior al bis con guiones.','Artículo 410 Bis. IV.- Cuarto texto sintético con punto tras el bis.','Art. 411.- Texto sintético que cita un precepto y termina con referencia solitaria.','ARTICULO 96.','Art. 412.- Texto sintético que remite a LA FRACCION III DEL','ARTICULO 44.','(ADICIONADO, P.O. 16 DE MAYO DE 2012)','Art. 413.','Texto sintético del cuatrocientos trece con encabezado en línea propia.','TRANSITORIOS'].join('\n');const result=extractArticles([{number:1,text}],source,meta);assert.deepEqual(result.records.map(r=>r.articleId),['410-BIS','410-BIS-I','410-BIS-II','410-BIS-III','410-BIS-IV','411','412','413']);assert.deepEqual(result.documentAnomalies,[]);assert.match(result.records[5].text,/ARTICULO 96\./);assert.match(result.records[6].text,/ARTICULO 44\./);});
test('derogated paren-marker headings and no-terminator sequential headings segment without opening fragments',()=>{const text=['Art. 36.- Las inscripciones a que se refiere el artículo que antecede harán prueba plena y surtirán efectos frente a terceros.','Art. 37 (DEROGADO, P.O. 28 DE NOVIEMBRE DE 2008)','(REFORMADO PRIMER PÁRRAFO, P.O. 28 DE NOVIEMBRE DE 2008)','Art. 38.- La titularidad sintética estará a cargo de servidores públicos con contenido propio verificable.','ARTICULO 354.- TEXTO SINTÉTICO QUE TERMINA EN SU LIBERTAD.','(REFORMADO, P.O. 13 DE DICIEMBRE DE 2012)','ARTICULO 355 AL RESPONSABLE DEL DELITO SE LE IMPONDRÁN PENAS SINTÉTICAS VERIFICABLES.','ARTICULO 356.- TEXTO SINTÉTICO FINAL QUE CIERRA LA SECUENCIA SIN ABRIR FRAGMENTOS.','TRANSITORIOS'].join('\n');const result=extractArticles([{number:1,text}],source,meta);assert.deepEqual(result.records.map(r=>r.articleId),['36','37','38','354','355','356']);const derogated=result.records[1];assert.match(derogated.text,/DEROGADO/);assert.equal(derogated.quality.status,'quarantined');assert.match(result.records[4].text,/AL RESPONSABLE DEL DELITO/);assert.deepEqual(result.documentAnomalies,[]);});
test('publisher note quoting another law quarantines affected article and does not invent a duplicate',()=>{const text=article.replace('1.-','1777.-')+'\nNota: Otra ley publicó el siguiente texto editorial.\nArtículo 54.- Esta cita pertenece a otra ley y no puede convertirse en artículo de esta fuente.\n'+article.replace('1.-','1778.-')+'\nTRANSITORIOS';const result=extractArticles([{number:1,text}],source,meta);assert.deepEqual(result.records.map(r=>r.articleId),['1777','1778']);assert.equal(result.records[0].quality.status,'quarantined');assert.equal(result.records[1].quality.status,'structurally-verified');});
test('reform and errata annotations remain evidence metadata rather than operative article text',()=>{const text=article+'\nReforma DOF 01-01-2026: Derogó del artículo el entonces párrafo segundo\nFe de erratas al artículo DOF 02-01-2026\nTRANSITORIOS';const result=extractArticles([{number:1,text}],source,meta);assert.equal(result.records[0].text,article);assert.equal(result.records[0].editorialNotes.length,2);});
test('dated publisher filenames retain stable law and source identity across versions',()=>{const html=file=>`<tr><td>1</td><td><a href="ref/test.htm">LEY sintética de ejemplo</a></td><td><a href="pdf/${file}.pdf">PDF</a></td></tr>`;const old=parseOfficialIndex(html('10_270614')).sources[0],newer=parseOfficialIndex(html('10_301026')).sources[0];assert.equal(old.id,newer.id);assert.equal(old.lawId,newer.lawId);assert.notEqual(old.url,newer.url);assert.equal(splitForLaw(old.lawId),splitForLaw(newer.lawId));});
test('changed catalog URL cannot relabel older snapshot when no replacement was downloaded',async t=>{
  const dir=await temporary(t);
  const options={catalog:{sources:[source]},outputDir:dir,limit:1,sleep:async()=>{},extractor:async(file,s,m)=>extractArticles(pages,s,m),fetchImpl:async url=>url.endsWith('/robots.txt')?new Response('',{status:404}):new Response('%PDF-1.4 synthetic',{headers:{'content-type':'application/pdf'}})};
  const first=await ingestLibrary(options);assert.equal(first.export.articles,2);
  const manifestBefore=await readFile(path.join(dir,'acquisitions/manifest.json'),'utf8');
  const changed=await ingestLibrary({...options,download:false,catalog:{sources:[{...source,url:'https://www.diputados.gob.mx/LeyesBiblio/pdf/Testlaw_new.pdf'}]}});
  assert.equal(changed.summary.failedLaws,1);assert.equal(changed.export.articles,0);
  assert.equal(await readFile(path.join(dir,'acquisitions/manifest.json'),'utf8'),manifestBefore);
});
test('v17 period-less official headings open only at article 1 and continue strictly sequentially',()=>{
  const text=['TITULO PRIMERO','Artículo 5','Esta línea previa con número distinto de uno nunca abre el cuerpo operativo.','Artículo 1','1. Texto sintético del artículo primero con contenido propio verificable y suficiente longitud documental.','Artículo 2','1. Texto sintético del artículo segundo con contenido propio verificable y suficiente longitud documental.','Artículo 9','Esta línea no secuencial permanece como texto del artículo segundo y no abre disposición.','Artículo 3','1. Texto sintético del artículo tercero con contenido propio verificable y suficiente longitud documental.','TRANSITORIOS'].join('\n');
  const result=extractArticles([{number:1,text}],source,meta);
  assert.deepEqual(result.records.map(r=>r.articleId),['1','2','3']);
  assert.deepEqual(result.documentAnomalies,[]);
  assert.match(result.records[1].text,/Artículo 9/);
  assert.ok(!result.records.some(r=>/nunca abre el cuerpo/.test(r.text)));
});
test('v17 period-less lines with trailing text or mid-body citations never open headings',()=>{
  const text=['Artículo 1','1. Texto sintético que cita el Artículo 105 de la Constitución en una línea con texto adicional.','Artículo 105 de la Constitución Política es una cita, nunca un encabezado propio.','Artículo 2','1. Texto sintético del artículo segundo con contenido propio verificable y suficiente longitud documental.','TRANSITORIOS'].join('\n');
  const result=extractArticles([{number:1,text}],source,meta);
  assert.deepEqual(result.records.map(r=>r.articleId),['1','2']);
  assert.match(result.records[0].text,/Artículo 105 de la Constitución/);
});
test('v17 OCR-degraded slash ordinals anchor headings and bis variants',()=>{
  const text=['ARTICULO 1/o. Texto sintético del artículo primero con contenido propio verificable y suficiente longitud documental.','ARTICULO 1/o BIS. Texto sintético del artículo bis con contenido propio verificable y suficiente longitud documental adicional.','ARTICULO 2/o. Texto sintético del artículo segundo con contenido propio verificable y suficiente longitud documental.','TRANSITORIOS'].join('\n');
  const result=extractArticles([{number:1,text}],source,meta);
  assert.deepEqual(result.records.map(r=>r.articleId),['1','1-BIS','2']);
  assert.deepEqual(result.documentAnomalies,[]);
});
const body18='Texto sintético con contenido propio verificable y longitud documental suficiente para la prueba.';
test('v19 period-less suffixed heading opens its own record only right after its base',()=>{
  const r=extractArticles([{number:1,text:['Artículo 21.- '+body18,'Artículo 21 Bis',body18,'TRANSITORIOS'].join('\n')}],source,meta);
  assert.deepEqual(r.records.map(x=>x.articleId),['21','21-BIS']);
  assert.deepEqual(r.documentAnomalies,[]);
});
test('v19 bare suffixed heading with wrong base stays body and quarantines the document',()=>{
  const r=extractArticles([{number:1,text:['Artículo 19.- '+body18,'Artículo 21 Bis',body18,'TRANSITORIOS'].join('\n')}],source,meta);
  assert.deepEqual(r.records.map(x=>x.articleId),['19']);
  assert.match(r.records[0].text,/Artículo 21 Bis/);
  assert.ok(r.documentAnomalies.includes('unmatched-suffixed-heading-in-body'));
  assert.ok(r.records.every(x=>x.quality.status==='quarantined'));
});
test('v19 noTerm route never captures a suffixed heading as its plain number',()=>{
  const r=extractArticles([{number:1,text:['Artículo 20.- '+body18,'Artículo 21 Bis',body18,'Artículo 21.- '+body18,'TRANSITORIOS'].join('\n')}],source,meta);
  assert.deepEqual(r.records.map(x=>x.articleId),['20','21']);
  assert.match(r.records[0].text,/Artículo 21 Bis/);
  assert.ok(r.documentAnomalies.includes('unmatched-suffixed-heading-in-body'));
});
test('v19 glued suffixed heading without terminator opens; lowercase citation tail stays body',()=>{
  const r=extractArticles([{number:1,text:['Artículo 43.- '+body18,'Artículo 43 Ter Se resolverá el recurso sintético con contenido propio verificable.','Artículo 44.- El texto cita al Artículo 43 Ter de la presente ley sin abrir encabezado alguno.','TRANSITORIOS'].join('\n')}],source,meta);
  assert.deepEqual(r.records.map(x=>x.articleId),['43','43-TER','44']);
  assert.match(r.records[2].text,/Artículo 43 Ter de la presente ley/);
  assert.deepEqual(r.documentAnomalies,[]);
});
test('v19 mid-sentence structural line is kept as body with explicit quarantine',()=>{
  const r=extractArticles([{number:1,text:['Artículo 37.- Las reglas de trámite a que se refiere el Capítulo VIII del Título Segundo del','Libro Primero del presente ordenamiento, se aplicarán las reglas siguientes con texto verificable.','TRANSITORIOS'].join('\n')}],source,meta);
  assert.match(r.records[0].text,/Libro Primero del presente ordenamiento/);
  assert.ok(r.documentAnomalies.includes('mid-sentence-structural-line-kept-as-body'));
  assert.equal(r.coverage.keptAmbiguousStructuralLines,1);
});
test('v19 ALL-CAPS section heading after derogated article still consumed',()=>{
  const r=extractArticles([{number:1,text:['Artículo 135.- '+body18,'ARTICULO 136. Derogado','CAPITULO II','De las cosas sintéticas','Artículo 137.- '+body18,'TRANSITORIOS'].join('\n')}],source,meta);
  assert.deepEqual(r.records.map(x=>x.articleId),['135','136','137']);
  assert.ok(!r.records.some(x=>/De las cosas sintéticas/.test(x.text)));
  assert.deepEqual(r.documentAnomalies,[]);
});
test('v19 two-line subtitle plus bare suffixed heading opens its record (265 Bis case)',()=>{
  const r=extractArticles([{number:1,text:['Artículo 265.- '+body18,'SECCIÓN DÉCIMA','DE LAS COMPARECENCIAS A','SOLICITUD DE LA COMISIÓN','Artículo 265 Bis',body18,'TRANSITORIOS'].join('\n')}],source,meta);
  assert.deepEqual(r.records.map(x=>x.articleId),['265','265-BIS']);
  assert.equal(r.coverage.removedSubtitleLines,2);
});
test('v19 bounded pendingSection returns third line to body with anomaly',()=>{
  const r=extractArticles([{number:1,text:['Artículo 1.- '+body18,'CAPITULO I','Subtítulo línea uno','Subtítulo línea dos','Resto del cuerpo que no debe perderse jamás en silencio.','Artículo 2.- '+body18,'TRANSITORIOS'].join('\n')}],source,meta);
  assert.match(r.records[0].text,/Resto del cuerpo que no debe perderse/);
  assert.ok(r.documentAnomalies.includes('section-discard-exceeded-2-lines'));
});
test('v19 body line starting Cámara de Diputados is kept; ALL-CAPS page header removed',()=>{
  const r=extractArticles([{number:1,text:['Artículo 221.- De aprobarse las observaciones realizadas por la','Cámara de Diputados, se procede conforme lo establece el artículo 72 de la Constitución.','CÁMARA DE DIPUTADOS DEL H. CONGRESO DE LA UNIÓN','Artículo 222.- '+body18,'TRANSITORIOS'].join('\n')}],source,meta);
  assert.match(r.records[0].text,/Cámara de Diputados, se procede/);
  assert.ok(!/CONGRESO DE LA UNIÓN/.test(r.records[0].text));
  assert.deepEqual(r.documentAnomalies,[]);
});
test('v19 exact suffixed citation in transitory material never opens',()=>{
  const r=extractArticles([{number:1,text:['Artículo 5.- '+body18,'TRANSITORIOS','Artículo 5 Bis','Artículo 5.- '+body18].join('\n')}],source,meta);
  assert.deepEqual(r.records.map(x=>x.articleId),['5']);
});
test('v19 trailing editorial headings are trimmed with traceable discards',()=>{
  const r=extractArticles([{number:1,text:['Artículo 75.- '+body18,'Servicio de Ingenieros','Artículo 170.- '+body18,'De las Licencias','ARTICULO 171.- '+body18.toUpperCase(),'ESTADO MAYOR CONJUNTO DE LA DEFENSA NACIONAL','Artículo 172.- '+body18,'Generalidades','Artículo 32.- '+body18,'EL CENTRO NACIONAL DE VIGILANCIA Y PROTECCIÓN DEL ESPACIO AÉREO Subsección adicionada DOF 03-05-2023','ARTICULO 156. Derogado Del Adiestramiento','TRANSITORIOS'].join('\n')}],source,meta);
  const byId=Object.fromEntries(r.records.map(x=>[x.articleId,x]));
  assert.ok(!/Servicio de Ingenieros/.test(byId['75'].text));
  assert.ok(!/De las Licencias/.test(byId['170'].text));
  assert.ok(!/ESTADO MAYOR CONJUNTO/.test(byId['171'].text));
  assert.ok(!/Generalidades/.test(byId['172'].text));
  assert.ok(!/CENTRO NACIONAL DE VIGILANCIA/.test(byId['32'].text));
  assert.equal(byId['156'].text,'ARTICULO 156. Derogado');
  assert.equal(r.coverage.removedTrailingRubrics,6);
  assert.deepEqual(r.documentAnomalies,[]);
  assert.ok(byId['75'].editorialNotes.includes('Servicio de Ingenieros'));
  assert.ok(byId['32'].editorialNotes.some(x=>/Subsección adicionada DOF 03-05-2023/.test(x)));
});
test('v19 trailing lines with sentence punctuation or table markers are never trimmed',()=>{
  const r=extractArticles([{number:1,text:['Artículo 130.- La equivalencia jerárquica sintética es la siguiente con contenido verificable:','B. Soldado Marinero','Artículo 131.- '+body18,'TRANSITORIOS'].join('\n')}],source,meta);
  assert.match(r.records[0].text,/B\. Soldado Marinero$/);
  assert.equal(r.coverage.removedTrailingRubrics,0);
});
test('v19 duplicate-proof: roman suffixed derogated headings keep distinct ids (real Código Penal NL 208 Bis I/II)',()=>{
  const r=extractArticles([{number:1,text:['ARTÍCULO 208.- COMETE EL DELITO SINTÉTICO CON CONTENIDO PROPIO VERIFICABLE PARA SEGMENTACIÓN DEL EXTRACTOR.','ARTICULO 208 BIS I, (DEROGADO, P.O. 24 DE ENERO DE 1997)','ARTICULO 208 BIS II, (DEROGADO, P.O. 24 DE ENERO DE 1997)','ARTÍCULO 209.- TEXTO SINTÉTICO POSTERIOR CON CONTENIDO PROPIO VERIFICABLE PARA SEGMENTACIÓN.','TRANSITORIOS'].join('\n')}],source,meta);
  assert.deepEqual(r.records.map(x=>x.articleId),['208','208-BIS-I','208-BIS-II','209']);
  assert.ok(!r.documentAnomalies.includes('operative-numbering-restarts-before-transitory-boundary'));
  assert.match(r.records[1].text,/DEROGADO/);
});
test('v19 trailing trim never eats all-caps body lines (Código Penal NL negative)',()=>{
  const r=extractArticles([{number:1,text:['ARTÍCULO 5.- LAS DISPOSICIONES DE ESTE CÓDIGO SE APLICARÁN EN TODO EL ESTADO Y TAMBIÉN A','LOS DELITOS COMETIDOS EN EL EXTRANJERO CUANDO PRODUZCAN O SE PRETENDA QUE PRODUZCAN','MISMO O CAUSEN SUS EFECTOS EN EL.','ARTÍCULO 6.- TEXTO SINTÉTICO POSTERIOR CON CONTENIDO PROPIO VERIFICABLE PARA SEGMENTACIÓN FINAL.','TRANSITORIOS'].join('\n')}],source,meta);
  assert.match(r.records[0].text,/MISMO O CAUSEN SUS EFECTOS EN EL\.$/);
  assert.equal(r.coverage.removedTrailingRubrics,0);
});
test('v21 inline-glued trailing rúbricas are cut at sentence boundary; all-caps body and table rows kept',()=>{
  const r=extractArticles([{number:1,text:[
    'Artículo 77.- El texto sintético termina con cierre propio. Servicio Cartográfico',
    'Artículo 138.- Fracción declarada inválida por sentencia sintética publicada DOF 20-09-2023 Generalidades',
    'Artículo 32.- Texto sintético conforme al Reglamento Interior de la Secretaría. EL CENTRO NACIONAL DE VIGILANCIA Y PROTECCIÓN DEL ESPACIO AÉREO Subsección adicionada DOF 03-05-2023',
    'ARTÍCULO 9.- TEXTO UNO CERRADO. FRASE FINAL CORTA',
    'Artículo 130.- La equivalencia sintética es: B. Soldado Marinero',
    'TRANSITORIOS'].join('\n')}],source,meta);
  const byId=Object.fromEntries(r.records.map(x=>[x.articleId,x]));
  assert.match(byId['77'].text,/cierre propio\.$/);
  assert.match(byId['138'].text,/DOF 20-09-2023$/);
  assert.match(byId['32'].text,/Secretaría\.$/);
  assert.match(byId['9'].text,/FRASE FINAL CORTA$/);
  assert.match(byId['130'].text,/B\. Soldado Marinero$/);
  assert.equal(r.coverage.removedTrailingRubrics,3);
  assert.ok(r.records[1].editorialNotes.includes('Generalidades'));
});
test('v23 spelled-ordinal headings segment sequentially and ranges collapse with anomaly',()=>{
  const text=['ARTICULO PRIMERO.- Texto sintético del artículo primero con contenido propio verificable y suficiente longitud documental.','ARTICULO SEGUNDO.- Texto sintético del artículo segundo con contenido propio verificable y suficiente longitud documental.','ARTICULO TERCERO.- Texto sintético del artículo tercero que menciona el artículo primero de esta ley sin abrir disposición nueva y con longitud suficiente.','TRANSITORIOS'].join('\n');
  const result=extractArticles([{number:1,text}],source,meta);
  assert.deepEqual(result.records.map(r=>r.articleId),['1','2','3']);
  assert.deepEqual(result.documentAnomalies,[]);
  assert.match(result.records[2].text,/el artículo primero de esta ley/);
  const ranged=['ARTICULOS PRIMERO A OCTAVO.- Texto sintético del rango primero a octavo con contenido propio verificable y suficiente longitud documental.','ARTICULO NOVENO.- Texto sintético del artículo noveno con contenido propio verificable y suficiente longitud documental.','TRANSITORIOS'].join('\n');
  const rr=extractArticles([{number:1,text:ranged}],source,meta);
  assert.deepEqual(rr.records.map(r=>r.articleId),['1-8','9']);
  assert.ok(rr.documentAnomalies.includes('ordinal-range-heading-single-record'));
});
test('v23 ordinal headings fail closed: out-of-sequence, lowercase references and post-numeric ordinals never open',()=>{
  const gap=['ARTICULO TERCERO.- Texto sintético que empieza en tres y nunca debe abrir registro alguno por secuencia rota.','TRANSITORIOS'].join('\n');
  const g=extractArticles([{number:1,text:gap}],source,meta);
  assert.equal(g.records.length,0);
  assert.ok(g.documentAnomalies.includes('no-numeric-article-headings'));
  const lower=['ARTICULO PRIMERO.- Texto sintético del artículo primero con contenido propio verificable y suficiente longitud documental.','Se interpreta conforme al artículo primero de esta ley y al Artículo segundo citado en minúsculas o capitalizados.','ARTICULO SEGUNDO.- Texto sintético del artículo segundo con contenido propio verificable y suficiente longitud documental.','TRANSITORIOS'].join('\n');
  const l=extractArticles([{number:1,text:lower}],source,meta);
  assert.deepEqual(l.records.map(r=>r.articleId),['1','2']);
  assert.match(l.records[0].text,/artículo primero de esta ley/);
  const mixed=[article,'ARTICULO SEGUNDO.- Esta línea ordinal en mayúsculas después de un artículo numérico permanece como cuerpo y nunca abre disposición propia.','TRANSITORIOS'].join('\n');
  const m=extractArticles([{number:1,text:mixed}],source,meta);
  assert.deepEqual(m.records.map(r=>r.articleId),['1']);
  assert.match(m.records[0].text,/ARTICULO SEGUNDO/);
});
