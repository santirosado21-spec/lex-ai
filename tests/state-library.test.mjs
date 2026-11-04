import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {createStateLibrary} from '../server/state-library.mjs';
import {createService} from '../server/service.mjs';
test('pinned optional state snapshot exposes only five audited codes with source provenance',()=>{
 const library=createStateLibrary();assert.equal(library.status().laws.length,5);
 for(const law of library.status().laws){const ref=library.reference(`Explica el artículo 1 del ${law.title}.`),source=library.lookupArticle(ref);assert.equal(ref.lawId,law.id);assert.equal(source.jurisdiction,law.jurisdiction);assert.equal(source.status,'structurally-verified-currentness-unverified');assert.equal(source.effectiveAt,null);assert.equal(source.coverage,'partial-audited-articles-only');assert.ok(source.pdfSha256&&source.textSha256&&source.pages.length);source.text='mutated';assert.notEqual(library.lookupArticle(ref).text,'mutated');}
});
test('state identity requires a named official code and one exact article',()=>{
 const library=createStateLibrary();assert.equal(library.reference('Artículo 1 del Código Civil'),null);assert.equal(library.reference('Busca el Código Civil del Estado de Jalisco'),null);
 assert.equal(library.reference('Artículo 410-Bis-II del Código Civil para el Estado de Nuevo León').articleId,'410-BIS-II');
 assert.equal(library.reference('Artículos 1 y 2 del Código Civil del Estado de Jalisco'),null);
 assert.equal(library.reference('Artículo 1 y artículo 2 del Código Civil del Estado de Jalisco').unavailable,true);
 assert.equal(library.reference('Compara artículo 1 del Código Civil del Estado de Jalisco y Código Civil Federal').unavailable,true);
 assert.equal(library.lookupArticle({lawId:'MX-JAL-CP',articleId:'1'}),null);assert.equal(library.lookupArticle({lawId:'MX-NLE-CPC',articleId:'1'}),null);assert.equal(library.lookupArticle({lawId:'MX-JAL-CC',articleId:'999999'}),null);assert.equal(library.lookupArticle({lawId:'MX-JAL-CC',articleId:'477'}),null);
});
test('state snapshot corruption fails closed without admitting unpinned data',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'lex-state-tamper-'));t.after(()=>rm(dir,{recursive:true,force:true}));const file=path.join(dir,'corpus.jsonl');await writeFile(file,'{"text":"unreviewed public candidate"}\n');const library=createStateLibrary({corpusPath:file});assert.throws(()=>library.lookupArticle({lawId:'MX-JAL-CC',articleId:'1'}),/integrity mismatch/);
});
async function fixture(t){const dir=await mkdtemp(path.join(os.tmpdir(),'lex-state-service-')),calls=[];
 const service=await createService({dataDir:dir,corpusPath:path.resolve('resources/legal-corpus.json'),inference:{async *generate(messages){const p=JSON.parse(messages[1].content);calls.push(p);const s=p.sources[0];yield JSON.stringify({analysis:`El fragmento recuperado requiere revisión antes de una conclusión jurídica [${s.id}].`,citations:[{sourceId:s.id,quote:s.allowedQuotes[0]}]});}}});
 t.after(()=>{service.close();return rm(dir,{recursive:true,force:true});});await service.dispatch('workspace.create',{name:'Despacho sintético',practiceAreas:['civil']});return {service,calls};}
test('unified assistant retrieves exact Jalisco and Nuevo León provisions and keeps public provenance',async t=>{
 const {service,calls}=await fixture(t);
 for(const law of createStateLibrary().status().laws){const reply=await service.analyze({mode:'auto',question:`Explica el artículo 1 del ${law.title}.`});assert.equal(reply.kind,'grounded');assert.equal(reply.citations.length,1);assert.equal(reply.citations[0].lawId,law.id);assert.equal(reply.citations[0].jurisdiction,law.jurisdiction);assert.equal(reply.citations[0].status,'structurally-verified-currentness-unverified');assert.equal(reply.citations[0].fullTextSha256,reply.citations[0].textSha256);assert.equal(calls.at(-1).sources[0].currentness,'unverified');}
 const follow=await service.analyze({mode:'auto',question:'Hazlo más breve.'});assert.equal(follow.citations[0].lawId,'MX-NLE-CF');
 const federal=await service.analyze({mode:'auto',question:'Explica el artículo 1797 del Código Civil Federal.'});assert.equal(federal.citations[0].jurisdiction,'MX-FED');
 const local=await service.analyze({mode:'auto',question:'Explica el artículo 1797 del Código Civil para el Distrito Federal en CDMX.'});assert.equal(local.citations[0].jurisdiction,'MX-CMX');
});
test('missing, excluded, ambiguous and broad state requests abstain before inference',async t=>{
 const {service,calls}=await fixture(t);
 for(const question of ['Explica el artículo 999999 del Código Civil del Estado de Jalisco.','Explica el artículo 477 del Código Civil del Estado de Jalisco.','Explica el artículo 1 del Código Penal para el Estado Libre y Soberano de Jalisco.','Explica el artículo 1 del Código de Procedimientos Civiles del Estado de Nuevo León.','Explica el artículo 1 y artículo 2 del Código Civil del Estado de Jalisco.','¿Cómo puedo tramitar mi divorcio en Jalisco?','Busca el Código Civil del Estado de Jalisco.']){const reply=await service.analyze({mode:'auto',question});assert.equal(reply.citations.length,0);assert.ok(['needs-jurisdiction-source','abstained-no-relevant-sources'].includes(reply.validation.status));}
 assert.equal(calls.length,0);
});
