import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import yauzl from 'yauzl';
import {createService} from '../server/service.mjs';
import {createStore} from '../server/store.mjs';
function unzip(buffer){return new Promise((resolve,reject)=>yauzl.fromBuffer(buffer,{lazyEntries:true},(error,zip)=>{if(error)return reject(error);const entries=new Map();zip.on('error',reject);zip.on('end',()=>resolve(entries));zip.on('entry',entry=>zip.openReadStream(entry,(error,stream)=>{if(error)return reject(error);const chunks=[];stream.on('error',reject);stream.on('data',chunk=>chunks.push(chunk));stream.on('end',()=>{entries.set(entry.fileName,Buffer.concat(chunks).toString('utf8'));zip.readEntry();});}));zip.readEntry();}));}
const decode=xml=>xml.replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&apos;',"'");
test('DOCX uses citation-order numbers for long public IDs while preserving passages, provenance and saved answer',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'lex-docx-numbered-'));const corpusPath=join(dir,'corpus.json');writeFileSync(corpusPath,'[]');const service=await createService({dataDir:join(dir,'firm'),corpusPath});t.after(()=>{service.close();rmSync(dir,{recursive:true,force:true});});
 await service.dispatch('workspace.create',{name:'Despacho sintético DOCX',practiceAreas:['Civil']});const a=await service.dispatch('matter.create',{title:'Asunto de prueba',client:'Cliente ficticio',jurisdiction:'MX-FED'});const b=await service.dispatch('matter.create',{title:'Otro asunto',client:'Otro ficticio',jurisdiction:'MX-FED'});
 const first='PUB-'+ 'a'.repeat(64),second='PUB-'+ 'b'.repeat(64);
 const citations=[{id:first,title:'Fuente sintética uno',article:'1797',quote:'Pasaje literal uno: consentimiento & condiciones <sin alteración>.',url:'https://www.diputados.gob.mx/LeyesBiblio/pdf/CCF.pdf',version:'snapshot-uno',retrievedAt:'2026-10-30',status:'structurally-verified-currentness-unverified',category:'official-public-legislation'},{id:second,title:'Fuente sintética dos',article:'1',quote:'Pasaje literal dos conserva puntuación y números [123].',url:'https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf',version:'snapshot-dos',retrievedAt:'2026-10-29',status:'structurally-verified-currentness-unverified',category:'official-public-legislation'}];
 const answer={id:randomUUID(),matterId:a.id,question:'Pregunta sintética',text:`Primero se menciona la segunda fuente [${second}].\nDespués ambas [${first}] [${second}]. Nota literal [sin-cita] y [1].`,citations,createdAt:'2026-10-30T12:00:00Z'};const original=structuredClone(answer);const store=createStore(join(dir,'firm'));store.put('answer',answer);store.close();
 await assert.rejects(service.dispatch('answer.export',{matterId:b.id,answerId:answer.id}),/este asunto/);
 const exported=await service.dispatch('answer.export',{matterId:a.id,answerId:answer.id});assert.equal(exported.mime,'application/vnd.openxmlformats-officedocument.wordprocessingml.document');const zip=await unzip(Buffer.from(exported.base64,'base64'));const xml=decode(zip.get('word/document.xml'));const relationships=decode(zip.get('word/_rels/document.xml.rels'));
 assert.ok(xml.includes('Primero se menciona la segunda fuente [2].'));assert.ok(xml.includes('Después ambas [1] [2]. Nota literal [sin-cita] y [1].'));assert.ok(xml.includes('[1] Fuente sintética uno — 1797'));assert.ok(xml.includes('[2] Fuente sintética dos — 1'));assert.ok(!xml.includes(first));assert.ok(!xml.includes(second));
 for(const citation of citations){assert.ok(xml.includes(citation.quote),'verbatim quote unchanged');assert.ok(xml.includes(citation.url),'visible source URL preserved');assert.ok(relationships.includes(citation.url),'actual hyperlink target preserved');assert.ok(xml.includes(citation.version));assert.ok(xml.includes(citation.retrievedAt));assert.ok(xml.includes(citation.status));}
 assert.ok(xml.includes('la exactitud jurídica y vigencia requieren revisión del abogado'));assert.deepEqual((await service.dispatch('state')).answers.find(item=>item.id===answer.id),original,'export does not mutate stored answer or source identifiers');
});
