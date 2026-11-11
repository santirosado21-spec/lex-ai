// Developer-only negative control. Never accepts a data directory or opens an app store.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,readdir,realpath,lstat,rm,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStore} from '../server/store.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sources=['server/store.mjs','server/main.mjs','server/service.mjs','server/extraction.mjs','server/extraction-worker.mjs','server/docx-export.mjs','server/local-files.mjs','server/stt.mjs','server/office-bridge.mjs','server/local-email.mjs','server/mail-transport.mjs','server/mail-scripts/send.jxa','server/reply-drafts.mjs','server/thread-memory.mjs','server/proactive-drafts.mjs','server/time-billing.mjs','server/inference.mjs','server/bundled-model.mjs','server/public-library.mjs','server/state-library.mjs','server/legal-sync.mjs','server/public-monitor.mjs','server/training-status.mjs','server/privacy/pseudonyms.mjs','server/canonical-json.mjs','src/App.tsx','src/api.ts','src/VoiceInput.tsx','src/ReplyDraftEditor.tsx','src/TimeBillingView.tsx','src-tauri/src/main.rs','src-tauri/tauri.conf.json','scripts/prepare-desktop.mjs','scripts/qwen-training/train.py','scripts/qwen-training/raft_train.py','scripts/qwen-training/raft_night.py','scripts/qa-vault-inventory.mjs'];

async function inventory(){
 const parent=await realpath(tmpdir());
 const directory=await mkdtemp(path.join(parent,'lex-vault-synthetic-'));
 let store,report;
 try {
  store=createStore(directory);
  const db=store.db,at='2026-11-09T00:00:00.000Z';
  // Deliberately unmistakable synthetic canaries; never included in the report.
  const fixture={original:'SYNTHETIC_VAULT_ORIGINAL_ONLY_9A01',chunk:'SYNTHETICVAULTFTSCONTROL9A02',filename:'SYNTHETIC_VAULT_FILENAME_ONLY_9A03.txt',history:'SYNTHETIC_VAULT_HISTORY_ONLY_9A04',time:'SYNTHETIC_VAULT_TIME_ONLY_9A05',journal:'SYNTHETIC_VAULT_JOURNAL_ONLY_9A06'};
  const bytes=Buffer.from(fixture.original+'\nInvented test document, never a client file.\n','utf8');
  store.put('workspace',{id:'synthetic-workspace-a',name:'SYNTHETIC TEST ONLY'});
  for(const suffix of ['a','b']){
   const matterId='synthetic-matter-'+suffix;
   store.put('matter',{id:matterId,workspaceId:'synthetic-workspace-'+suffix,title:'SYNTHETIC TEST ONLY',counterparties:[]});
   store.insertDocument({id:'synthetic-document-'+suffix,workspaceId:'synthetic-workspace-'+suffix,matterId,name:fixture.filename,text:fixture.chunk,sha256:sha(bytes),createdAt:at},bytes,[{id:'synthetic-chunk-'+suffix,text:fixture.chunk}]);
  }
  store.put('chat',{id:'synthetic-chat',workspaceId:'synthetic-workspace-a',matterId:'synthetic-matter-a',threadId:'synthetic-thread',question:fixture.history,text:fixture.history,createdAt:at});
  store.put('thread-memory',{id:'synthetic-memory',workspaceId:'synthetic-workspace-a',matterId:'synthetic-matter-a',threadId:'synthetic-thread',summary:fixture.history,version:1});
  store.put('email-proposal',{id:'synthetic-email',workspaceId:'synthetic-workspace-a',matterId:'synthetic-matter-a',message:{subject:fixture.history,body:fixture.history},status:'proposed'});
  store.createTimeEntry({id:'synthetic-time',workspaceId:'synthetic-workspace-a',matterId:'synthetic-matter-a',userId:'synthetic-user',startedAt:null,endedAt:null,manualMinutes:6,durationMinutes:6,billedMinutes:6,description:fixture.time,billable:true,rateCentavos:100,amountCentavos:10,currency:'MXN',source:'manual',billingStatus:'unbilled',createdAt:at});
  store.putActiveTimer({workspaceId:'synthetic-workspace-a',userId:'synthetic-user',matterId:'synthetic-matter-a',startedAt:at,accumulatedMinutes:0,pausedAt:null,state:'running',rateCentavos:100,billable:true,description:fixture.time,currency:'MXN'});
  store.putFeeArrangement({workspaceId:'synthetic-workspace-a',matterId:'synthetic-matter-a',arrangement:'hourly',hourlyRateCentavos:100,contingencyBasisPoints:null,billingIncrementMinutes:6,currency:'MXN',updatedAt:at});
  store.putClientHourlyRate({workspaceId:'synthetic-workspace-a',clientName:fixture.time,hourlyRateCentavos:100,currency:'MXN',updatedAt:at});
  store.put('synthetic-journal-control',{id:'synthetic-journal',text:fixture.journal});
  const controls={
   originalRoundTrip:Buffer.from(store.original('synthetic-document-a','synthetic-matter-a')).equals(bytes),
   wrongMatterOriginalDenied:store.original('synthetic-document-a','synthetic-matter-b')===null,
   ftsFindsOwnChunk:store.search('synthetic-matter-a',fixture.chunk).length===1,
   ftsDoesNotMixMatter:store.search('synthetic-matter-a',fixture.chunk).every(row=>row.documentId==='synthetic-document-a'),
   unknownMatterFtsEmpty:store.search('synthetic-matter-missing',fixture.chunk).length===0,
  };
  const schema=db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
  const compileOptions=db.prepare('PRAGMA compile_options').all().map(row=>Object.values(row)[0]).sort();
  const pragmas={journalMode:db.prepare('PRAGMA journal_mode').get().journal_mode,tempStore:db.prepare('PRAGMA temp_store').get().temp_store,userVersion:db.prepare('PRAGMA user_version').get().user_version,sqliteVersion:db.prepare('SELECT sqlite_version() AS version').get().version,cipherVersionRowCount:db.prepare('PRAGMA cipher_version').all().length};
  // Stock SQLite silently ignores unknown pragmas. Acceptance is explicitly NOT encryption.
  db.exec("PRAGMA key='SYNTHETIC-NOT-A-REAL-KEY';");
  controls.readableAfterIgnoredKeyPragma=db.prepare('SELECT count(*) AS count FROM originals').get().count===2;
  db.exec('BEGIN IMMEDIATE');
  let journalBytes;
  try {
   db.prepare('UPDATE records SET payload=? WHERE id=?').run(JSON.stringify({id:'synthetic-journal',text:'SYNTHETIC REPLACEMENT ONLY'}),'synthetic-journal');
   journalBytes=await readFile(path.join(directory,'lex.sqlite-journal'));
  } finally {db.exec('ROLLBACK');}
  const counts={tables:schema.filter(row=>row.type==='table').length,ftsShadowTables:schema.filter(row=>row.name.startsWith('chunks_fts_')).length,records:db.prepare('SELECT count(*) AS count FROM records').get().count,originals:db.prepare('SELECT count(*) AS count FROM originals').get().count,chunks:db.prepare('SELECT count(*) AS count FROM chunks').get().count,ftsRows:db.prepare('SELECT count(*) AS count FROM chunks_fts').get().count,timeEntries:store.listTimeEntries('synthetic-workspace-a').length,activeTimers:db.prepare('SELECT count(*) AS count FROM active_timers').get().count,feeArrangements:db.prepare('SELECT count(*) AS count FROM fee_arrangements').get().count,clientRates:db.prepare('SELECT count(*) AS count FROM client_hourly_rates').get().count};
  store.close();store=null;
  const database=await readFile(path.join(directory,'lex.sqlite'));
  const plaintext={sqliteHeaderVisible:database.subarray(0,16).equals(Buffer.from('SQLite format 3\0')),originalVisible:database.includes(Buffer.from(fixture.original)),chunkVisible:database.includes(Buffer.from(fixture.chunk)),filenameVisible:database.includes(Buffer.from(fixture.filename)),historyVisible:database.includes(Buffer.from(fixture.history)),timeVisible:database.includes(Buffer.from(fixture.time)),journalPreimageVisible:journalBytes.includes(Buffer.from(fixture.journal))};
  const closedArtifacts=await readdir(directory);
  controls.deleteJournalGoneAfterRollbackAndClose=!closedArtifacts.includes('lex.sqlite-journal');
  controls.noWalOrShmInDeleteMode=!closedArtifacts.some(name=>name==='lex.sqlite-wal'||name==='lex.sqlite-shm');
  // A real no-key reopen, not merely a read through an already-open keyed connection.
  store=createStore(directory);
  controls.reopenWithoutKeyReadsOriginal=Buffer.from(store.original('synthetic-document-a','synthetic-matter-a')).equals(bytes);
  store.close();store=null;
  controls.fts5Compiled=compileOptions.includes('ENABLE_FTS5');
  controls.noCipherVersion=pragmas.cipherVersionRowCount===0;
  assert.ok(Object.values(controls).every(Boolean),'synthetic control failed');
  assert.ok(Object.values(plaintext).every(Boolean),'negative plaintext control failed');
  assert.equal(pragmas.journalMode,'delete');
  report={schemaVersion:1,inventoryVersion:'h5a-inventory-v1',controlKind:'plaintext-negative-control',encryptionValidated:false,recoveryValidated:false,nativeRuntimeValidated:false,physical8GBValidated:false,sourceRevision:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),versions:{node:process.versions.node,...pragmas},counts,controls,plaintextNegativeControls:plaintext,hashes:{databaseSha256:sha(database),originalSha256:sha(bytes),schemaSha256:sha(JSON.stringify(schema)),compileOptionsSha256:sha(JSON.stringify(compileOptions)),sources:Object.fromEntries(await Promise.all(sources.map(async file=>[file,sha(await readFile(path.join(root,file)))])))}};
 } finally {
  store?.close();
  // Only this invocation's mkdtemp child; refuse links or a changed directory identity.
  assert.equal(path.dirname(directory),parent);
  assert.ok(path.basename(directory).startsWith('lex-vault-synthetic-'));
  assert.equal(await realpath(directory),directory);
  assert.ok((await lstat(directory)).isDirectory());
  await rm(directory,{recursive:true,force:false});
 }
 report.controls.ownSyntheticDirectoryRemoved=!existsSync(directory);
 assert.equal(report.controls.ownSyntheticDirectoryRemoved,true);
 return report;
}

try {
 assert.ok(process.argv.slice(2).every(arg=>arg==='--write')&&process.argv.length<=3,'unsupported argument');
 const report=await inventory();
 const json=JSON.stringify(report,null,2)+'\n';
 if(process.argv[2]==='--write')await writeFile(path.join(root,'docs/qa/vault-inventory-2026-11-09.json'),json,{mode:0o600});
 else process.stdout.write(json);
} catch {
 // Never print filesystem paths, SQL parameters or fixture contents on failure.
 console.error('Synthetic vault inventory failed; no encryption or recovery result established.');
 process.exitCode=1;
}
