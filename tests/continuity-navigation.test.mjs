import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {routeAssistantRequest} from '../server/assistant-router.mjs';
import {rewriteQuery,openFragmentIndex} from '../server/retrieval/query.mjs';
import {buildFragmentIndex} from '../server/retrieval/build.mjs';
import {sha256} from '../server/retrieval/fragments.mjs';
import {retrievePublic} from '../server/retrieval/automatic.mjs';
import {createService} from '../server/service.mjs';

const previousTurn={kind:'grounded',skillId:'legal-researcher',question:'Explica el artículo 7 LFT.',citations:[{lawId:'MX-FED-LFT',article:'7'}]};

test('article navigation stays grounded only after a sourced turn, with explicit tasks taking precedence',()=>{
 for(const question of ['El siguiente.','El anterior.','Siguiente','Anterior','El artículo siguiente','El artículo anterior','El posterior','El previo']){
  assert.equal(routeAssistantRequest({question,previousTurn}).kind,'grounded',question);
  assert.equal(routeAssistantRequest({question}).kind,'chat',question);
  assert.equal(routeAssistantRequest({question,previousTurn:{...previousTurn,citations:[]}}).kind,'chat',question);
 }
 assert.equal(routeAssistantRequest({question:'El siguiente correo debe ser más breve',previousTurn}).kind,'chat');
 assert.equal(routeAssistantRequest({question:'Explica el artículo 9 CFF',previousTurn}).reason,'explicit-authority');
});

function syntheticSource(article){
 const lawId='MX-FED-LFT',text=`Artículo ${article}. Disposición enteramente sintética para comprobar la navegación del índice sin inferir numeración ni contenido jurídico.`;
 return {id:'PUB-'+sha256(lawId+article),lawId,article,jurisdiction:'MX-FED',title:'Ley sintética de navegación',authority:'Fuente sintética',effectiveAt:null,text,textSha256:sha256(text),pdfSha256:'b'.repeat(64),url:'https://www.diputados.gob.mx/LeyesBiblio/pdf/Synthetic.pdf',version:lawId+'@2026-01-01+bbbbbbbbbbbbbbbb',pages:[1],retrievedAt:'2026-01-01T00:00:00Z',category:'official-public-legislation',status:'structurally-verified-currentness-unverified'};
}

test('router, rewriter and index navigate stored Bis/sparse neighbors without borrowing another thread',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'lex-navigation-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const inputFile=path.join(dir,'source.sqlite'),outputFile=path.join(dir,'fragments.sqlite');
 const db=new DatabaseSync(inputFile);db.exec('CREATE TABLE articles(id TEXT PRIMARY KEY,law_id TEXT,jurisdiction TEXT,payload TEXT)');
 for(const article of ['7','7-BIS','19']){const s=syntheticSource(article);db.prepare('INSERT INTO articles VALUES(?,?,?,?)').run(s.id,s.lawId,s.jurisdiction,JSON.stringify(s));}db.close();
 await buildFragmentIndex({inputFile,outputFile,lawAreas:{'MX-FED-LFT':['laboral']}});
 const index=openFragmentIndex(outputFile);t.after(()=>index.close());
 let prior=previousTurn;
 for(const [question,expected] of [['El siguiente.','7-BIS'],['El siguiente.','19'],['El anterior.','7-BIS']]){
  assert.equal(routeAssistantRequest({question,previousTurn:prior}).kind,'grounded');
  const request=rewriteQuery({question,recentTurns:[prior],matterJurisdiction:'MX-FED'});
  assert.equal(request.needsClarification,false);
  const hits=index.searchFragments({...request,limit:3});
  assert.ok(hits.length);assert.ok(hits.every(h=>h.article===expected));
  prior={kind:'grounded',question,citations:[{lawId:'MX-FED-LFT',article:expected}]};
 }
 const anotherThread=rewriteQuery({question:'El siguiente.',recentTurns:[],matterJurisdiction:'MX-FED'});
 assert.equal(anotherThread.needsClarification,true);
 const ambiguous=rewriteQuery({question:'El siguiente.',recentTurns:[{citations:[{lawId:'MX-FED-LFT',article:'7'},{lawId:'MX-FED-LFT',article:'19'}]}],matterJurisdiction:'MX-FED'});
 assert.equal(ambiguous.needsClarification,true);
 const changed=rewriteQuery({question:'Explica el artículo 9 CFF',recentTurns:[prior],matterJurisdiction:'MX-FED'});
 assert.equal(changed.reference.lawId,'MX-FED-CFF');assert.deepEqual(index.searchFragments({...changed,limit:3}),[]);
 const absent=rewriteQuery({question:'El anterior.',recentTurns:[previousTurn],matterJurisdiction:'MX-FED'});
 assert.deepEqual(index.searchFragments({...absent,limit:3}),[]);
});

test('navigation never substitutes fallback results when no matching successor index is available',()=>{
 const fallback=[syntheticSource('7')];
 for(const question of ['El siguiente.','¿Y el artículo anterior?']){
  assert.deepEqual(retrievePublic({question,recentTurns:[previousTurn],jurisdiction:'MX-FED',fallback}),[]);
  assert.deepEqual(retrievePublic({question,recentTurns:[previousTurn],jurisdiction:'MX-JAL',fallback}),[]);
 }
 assert.deepEqual(retrievePublic({question:'Artículo 7 LFT',jurisdiction:'MX-FED',fallback}),fallback);
});

test('automatic conversation abstains instead of repeating the predecessor when navigation is unavailable',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'lex-navigation-service-'));let calls=0;
 const inference={async *generate(messages){calls++;const source=JSON.parse(messages[1].content).sources[0];yield JSON.stringify({analysis:`El fragmento disponible requiere revisión antes de una conclusión jurídica [${source.id}].`,citations:[{sourceId:source.id,quote:source.allowedQuotes[0]}]});}};
 const service=await createService({dataDir:dir,corpusPath:path.resolve('resources/legal-corpus.json'),inference});
 t.after(()=>{service.close();return rm(dir,{recursive:true,force:true});});
 await service.dispatch('workspace.create',{name:'Despacho de prueba sintético',practiceAreas:['civil']});
 const first=await service.analyze({mode:'auto',threadId:'synthetic-a',question:'Explica el artículo 1797 del Código Civil Federal.'});
 assert.ok(first.citations.length);assert.equal(calls,1);
 const next=await service.analyze({mode:'auto',threadId:'synthetic-a',question:'¿Y el siguiente?'});
 assert.equal(next.validation.status,'abstained-no-relevant-sources');assert.deepEqual(next.citations,[]);assert.equal(calls,1);
});
