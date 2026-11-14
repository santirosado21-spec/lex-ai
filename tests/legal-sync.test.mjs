import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {runLegalSync,robotsPolicy,validateSourceUrl} from '../server/legal-sync.mjs';

const source={id:'ccf',title:'Fuente sintética',url:'https://www.diputados.gob.mx/LeyesBiblio/pdf/CCF.pdf',jurisdiction:'MX-FED'};
const pdf=content=>new Response(Buffer.from('%PDF-1.4\n'+content),{status:200,headers:{'content-type':'application/pdf',etag:'"test-v1"','last-modified':'Thu, 29 Oct 2026 00:00:00 GMT'}});
async function setup(t){const outputDir=await mkdtemp(path.join(tmpdir(),'lex-sync-test-'));t.after(()=>rm(outputDir,{recursive:true,force:true}));return {sources:[source],outputDir,sleep:async()=>{},limits:{rateMs:0},now:()=>new Date('2026-10-29T12:00:00Z')};}
const robots=()=>new Response('User-agent: *\nAllow: /\n',{status:200});

test('first download stays quarantined; conditional 304 preserves verified snapshot and history',async t=>{
  const opts=await setup(t);let headers;
  const first=await runLegalSync({...opts,fetchImpl:async url=>url.endsWith('/robots.txt')?robots():pdf('version-one')});
  assert.equal(first.state,'complete');assert.equal(first.sources[0].reviewStatus,'quarantined');
  const snapshot=await readFile(path.join(opts.outputDir,first.sources[0].snapshotPath));
  const second=await runLegalSync({...opts,fetchImpl:async(url,options)=>{if(url.endsWith('/robots.txt'))return robots();headers=options.headers;return new Response(null,{status:304});}});
  assert.equal(second.sources[0].state,'unchanged');assert.equal(headers['If-None-Match'],'"test-v1"');assert.ok(headers['If-Modified-Since']);
  assert.deepEqual(await readFile(path.join(opts.outputDir,first.sources[0].snapshotPath)),snapshot);
  const manifest=JSON.parse(await readFile(path.join(opts.outputDir,'manifest.json')));assert.equal(manifest.sources.ccf.versions.length,1);
});

test('changed PDF appends immutable history and never modifies an approved corpus',async t=>{
  const opts=await setup(t),approved=path.join(opts.outputDir,'approved-corpus.json');await writeFile(approved,'APPROVED_SENTINEL');
  const first=await runLegalSync({...opts,fetchImpl:async url=>url.endsWith('/robots.txt')?robots():pdf('version-one')});
  const second=await runLegalSync({...opts,fetchImpl:async url=>url.endsWith('/robots.txt')?robots():pdf('version-two')});
  assert.equal(second.summary.downloaded,1);assert.notEqual(first.sources[0].sha256,second.sources[0].sha256);
  assert.equal(await readFile(approved,'utf8'),'APPROVED_SENTINEL');
  assert.match(await readFile(path.join(opts.outputDir,first.sources[0].snapshotPath),'utf8'),/version-one/);
  assert.equal(JSON.parse(await readFile(path.join(opts.outputDir,'manifest.json'))).sources.ccf.versions.length,2);
});

test('same bytes without validators are unchanged by content hash',async t=>{
  const opts=await setup(t);const fetchImpl=async url=>url.endsWith('/robots.txt')?robots():pdf('same');
  await runLegalSync({...opts,fetchImpl});const result=await runLegalSync({...opts,fetchImpl});assert.equal(result.sources[0].state,'unchanged');
});

test('transient HTTP failure is retried once and final failure preserves prior snapshot',async t=>{
  const opts=await setup(t);const first=await runLegalSync({...opts,fetchImpl:async url=>url.endsWith('/robots.txt')?robots():pdf('prior')});let calls=0;
  const failed=await runLegalSync({...opts,fetchImpl:async url=>{if(url.endsWith('/robots.txt'))return robots();calls++;return new Response('unavailable',{status:503});}});
  assert.equal(calls,2);assert.equal(failed.state,'failed');assert.equal(failed.sources[0].sha256,first.sources[0].sha256);
  assert.match(await readFile(path.join(opts.outputDir,first.sources[0].snapshotPath),'utf8'),/prior/);
  assert.equal(JSON.parse(await readFile(path.join(opts.outputDir,'manifest.json'))).sources.ccf.versions.length,1);
});

test('transient network failure recovers on one bounded retry',async t=>{
  const opts=await setup(t);let calls=0;
  const result=await runLegalSync({...opts,fetchImpl:async url=>{if(url.endsWith('/robots.txt'))return robots();if(++calls===1)throw new TypeError('network failure');return pdf('recovered');}});
  assert.equal(calls,2);assert.equal(result.sources[0].attempts,2);assert.equal(result.state,'complete');
});

test('robots exclusions and unavailable robots fail closed without fetching the PDF',async t=>{
  for(const response of [()=>new Response('User-agent: *\nDisallow: /LeyesBiblio/\n'),()=>new Response('',{status:503})]){
    const opts=await setup(t);let calls=0;const result=await runLegalSync({...opts,fetchImpl:async url=>{assert.ok(url.endsWith('/robots.txt'));calls++;return response();}});
    assert.equal(result.sources[0].state,'blocked');assert.equal(calls,1);
  }
});

test('blocked source URLs and redirect destinations never reach the fetch implementation',async t=>{
  for(const url of ['http://www.diputados.gob.mx/a','https://127.0.0.1/a','https://evil.example/a','https://www.diputados.gob.mx:8443/a','https://user@www.diputados.gob.mx/a'])assert.throws(()=>validateSourceUrl(url),/bloqueada/);
  const opts=await setup(t);const calls=[];
  const result=await runLegalSync({...opts,fetchImpl:async url=>{calls.push(url);return url.endsWith('/robots.txt')?robots():new Response(null,{status:302,headers:{location:'https://evil.example/leak'}});}});
  assert.equal(result.sources[0].state,'blocked');assert.ok(calls.every(url=>url.startsWith('https://www.diputados.gob.mx/')));
});

test('oversized and HTML responses do not create snapshots or replace historical data',async t=>{
  for(const response of [()=>new Response('not PDF',{headers:{'content-length':'99999999'}}),()=>new Response('<html>captcha</html>')]){
    const opts=await setup(t);const result=await runLegalSync({...opts,fetchImpl:async url=>url.endsWith('/robots.txt')?robots():response()});
    assert.equal(result.sources[0].state,'failed');await assert.rejects(access(path.join(opts.outputDir,'manifest.json')));
  }
});

test('304 with missing snapshot and corrupted manifest are never silently accepted',async t=>{
  const opts=await setup(t);const result=await runLegalSync({...opts,fetchImpl:async url=>url.endsWith('/robots.txt')?robots():new Response(null,{status:304})});
  assert.equal(result.state,'failed');assert.match(result.sources[0].error,/304/);
  await writeFile(path.join(opts.outputDir,'manifest.json'),'INVALID_EXISTING_MANIFEST');
  await assert.rejects(runLegalSync({...opts,fetchImpl:async()=>{throw new Error('must not fetch')}}),/No se sobrescribirá/);
  assert.equal(await readFile(path.join(opts.outputDir,'manifest.json'),'utf8'),'INVALID_EXISTING_MANIFEST');
});

test('robots matching honors longest rule, allow ties, specific agent and crawl-delay',()=>{
  const policy='User-agent: *\nDisallow: /\n\nUser-agent: LexAI-LegalSync\nDisallow: /private/\nAllow: /private/public.pdf$\nCrawl-delay: 3\n';
  assert.equal(robotsPolicy(policy,'https://www.diputados.gob.mx/private/a.pdf').allowed,false);
  assert.equal(robotsPolicy(policy,'https://www.diputados.gob.mx/private/public.pdf').allowed,true);
  assert.equal(robotsPolicy(policy,source.url).crawlDelayMs,3000);
});

test('selected article extraction removes following section title and next-article amendment annotation',async()=>{
  const {extractSelectedArticle}=await import('../scripts/build-corpus.mjs');
  const raw='[LEX_PAGE_175]\nArtículo 1797.- La validez y el cumplimiento no puede dejarse al arbitrio de uno de los contratantes.\n\nDe la Capacidad\n(ADICIONADO, G.O. 22 DE ENERO DE 2010)\nArtículo 1798.- Texto siguiente.';
  const result=extractSelectedArticle(raw,1797,'Código Civil Federal');
  assert.ok(!result.text.includes('Capacidad'));assert.ok(!result.text.includes('ADICIONADO'));assert.deepEqual(result.amendmentNotes,[]);assert.deepEqual(result.pages,[175]);
});

test('selected article extraction removes page headers without merging next article or phantom page',async()=>{
  const {extractSelectedArticle}=await import('../scripts/build-corpus.mjs');
  const raw='[LEX_PAGE_3]\nArtículo 11.- Texto legal sintético completo para la prueba de extracción.\n[LEX_PAGE_4]\nLEY FEDERAL DEL DERECHO DE AUTOR\nCÁMARA DE DIPUTADOS DEL H. CONGRESO DE LA UNIÓN\nSecretaría General\nSecretaría de Servicios Parlamentarios\nÚltima Reforma DOF 14-05-2026\n4 de 87\nArtículo 12.- Autor es la persona.';
  const result=extractSelectedArticle(raw,11,'Ley Federal del Derecho de Autor');assert.deepEqual(result.pages,[3]);assert.ok(!result.text.includes('DIPUTADOS'));assert.ok(!result.text.includes('Artículo 12'));
});

test('TLS certificate failure is permanent and does not trigger a redundant retry',async t=>{
  const opts=await setup(t);let calls=0;
  const result=await runLegalSync({...opts,fetchImpl:async()=>{calls++;throw new TypeError('fetch failed',{cause:{code:'ERR_TLS_CERT_ALTNAME_INVALID'}});}});
  assert.equal(calls,1);assert.equal(result.sources[0].errorCode,'ERR_TLS_CERT_ALTNAME_INVALID');assert.match(result.sources[0].error,/certificado TLS/);
});

test('manifest paths cannot escape the quarantine directory',async t=>{
  const opts=await setup(t);await writeFile(path.join(opts.outputDir,'manifest.json'),JSON.stringify({schemaVersion:1,sources:{ccf:{versions:[{sha256:'a'.repeat(64),snapshotPath:'../../private-file.pdf'}]}}}));
  await assert.rejects(runLegalSync({...opts,fetchImpl:async()=>{throw new Error('must not fetch')}}),/Ruta de snapshot/);
});

test('a download that stalls mid-body fails as network error within the inactivity bound instead of hanging',async t=>{
  const opts=await setup(t);
  // cancel() also hangs forever on a half-open socket: the watchdog must not await it.
  const stalled=()=>new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('%PDF-1.4\npartial'));},cancel(){return new Promise(()=>{});}}),{status:200,headers:{'content-type':'application/pdf'}});
  const started=Date.now();
  const result=await runLegalSync({...opts,limits:{rateMs:0,downloadInactivityMs:150,timeoutMs:30_000},fetchImpl:async url=>url.endsWith('/robots.txt')?robots():stalled()});
  assert.ok(Date.now()-started<10_000,'sync must not hang on a stalled body even when cancel() never settles');
  assert.equal(result.summary.failed,1);
  assert.equal(result.state,'failed');
});

test('a slow but progressing download inside the inactivity bound completes',async t=>{
  const opts=await setup(t);
  const slow=()=>new Response(new ReadableStream({async start(c){const e=new TextEncoder();c.enqueue(e.encode('%PDF-1.4\nchunk-one\n'));await new Promise(r=>setTimeout(r,80));c.enqueue(e.encode('chunk-two'));c.close();}}),{status:200,headers:{'content-type':'application/pdf'}});
  const result=await runLegalSync({...opts,limits:{rateMs:0,downloadInactivityMs:500,timeoutMs:30_000},fetchImpl:async url=>url.endsWith('/robots.txt')?robots():slow()});
  assert.equal(result.state,'complete');
  assert.equal(result.summary.downloaded,1);
});
