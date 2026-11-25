import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,symlink,rm,readdir,realpath} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {desktopTarget,desktopPlan,targetFromEnvironment,requireBuildHost,targetTauriConfig,checkBinaryArch,approvedRuntimeInventory,sourceInventory,assertInventoryPaths,copyInventory,fileDigest} from '../server/desktop-target.mjs';
import {createFrozenLibraryVerifier} from '../server/frozen-library-artifact.mjs';
import {prepareDesktop} from '../scripts/prepare-desktop.mjs';
const host={platform:'darwin',arch:'arm64'};
async function fixture(t){const root=await realpath(await mkdtemp(path.join(os.tmpdir(),'lex-target-')));t.after(()=>rm(root,{recursive:true,force:true}));return root;}
const hash=s=>createHash('sha256').update(s).digest('hex');
test('explicit target names, executable conventions, isolated output and config',()=>{
 const plans=['mac-arm64','mac-x64','windows-x64'].map(id=>desktopPlan(id,{root:'/project',host}));
 assert.equal(new Set(plans.map(p=>p.output)).size,3);
 for(const p of plans){assert.match(p.output,new RegExp(`\\.desktop/${p.id}/app$`));assert.deepEqual(Object.values(targetTauriConfig(p).bundle.resources),['app/']);}
 assert.equal(plans[2].node,'node.exe');assert.equal(plans[2].engine,'ollama.exe');assert.equal(plans[1].binaryArch,'x86_64');
 for(const id of ['mac-universal','../mac-arm64','linux-x64'])assert.throws(()=>desktopTarget(id));
 assert.equal(targetFromEnvironment({},host).id,'mac-arm64');assert.throws(()=>targetFromEnvironment({LEX_TARGET_ARCH:'universal'},host));
});
test('host/platform gates fail closed before platform-specific tools',()=>{
 assert.doesNotThrow(()=>requireBuildHost(desktopPlan('mac-arm64'),host));
 assert.throws(()=>requireBuildHost(desktopPlan('mac-x64'),host),/host/);
 assert.throws(()=>requireBuildHost(desktopPlan('windows-x64'),{platform:'win32',arch:'x64'}),/bloqueado/);
 let called=false;assert.throws(()=>checkBinaryArch('node.exe',desktopPlan('windows-x64'),()=>{called=true;}),/Windows/);assert.equal(called,false);
});
test('single-target Mac architecture accepts thin binary and rejects wrong architecture',()=>{
 for(const [id,arch] of [['mac-arm64','arm64'],['mac-x64','x86_64']]){
  const run=(command,args,opts)=>{assert.equal(command,'/usr/bin/lipo');assert.deepEqual(args,['-archs','binary']);assert.equal(opts.timeout,5000);return {status:0,stdout:arch};};
  assert.doesNotThrow(()=>checkBinaryArch('binary',desktopPlan(id),run));
  assert.throws(()=>checkBinaryArch('binary',desktopPlan(id),()=>({status:0,stdout:'wrong'})));
 }
});
test('approved artifact inventory hashes exact names, refuses stores, links and wrong targets',async t=>{
 const root=await fixture(t),plan=desktopPlan('mac-arm64');
 const files=['runtime/node','resources/runtime/ollama'];
 for(const file of files){await mkdir(path.dirname(path.join(root,file)),{recursive:true});await writeFile(path.join(root,file),'binary');}
 const manifest={schemaVersion:1,target:plan.id,files:files.map(p=>({path:p,bytes:6,sha256:hash('binary'),executable:true}))};
 assert.equal((await approvedRuntimeInventory({manifest,source:root,plan})).length,2);
 for(const changed of [{...manifest,target:'mac-x64'},{...manifest,files:[...manifest.files,manifest.files[0]]},{...manifest,files:[{...manifest.files[0],path:'../keys'}]},{...manifest,files:[{...manifest.files[0],path:'resources/model-catalog.json'}]},{...manifest,files:manifest.files.map(f=>({...f,sha256:'0'.repeat(64)}))}])await assert.rejects(()=>approvedRuntimeInventory({manifest:changed,source:root,plan}));
 await rm(path.join(root,'runtime/node'));await symlink(path.join(root,'resources/runtime/ollama'),path.join(root,'runtime/node'));
 await assert.rejects(()=>approvedRuntimeInventory({manifest,source:root,plan}),/enlaces/);
});
test('source inventory excludes stores, caches, model/runtime folders and measurement logs',()=>{
 const good=['server/main.mjs','server/store.mjs','resources/public-library.sqlite','office-addin/word.html'];
 assert.deepEqual(sourceInventory([...good,'server/retrieval/measurements/test.json','resources/models/a.json','resources/cache/a.json','resources/runtime/a.json','resources/.env','resources/keys/a.json','resources/bundled-model/a.json','resources/private.pem']),good);
});
test('preflight rejection never creates staging or changes existing payload',async t=>{
 const root=await fixture(t),output=desktopPlan('mac-arm64',{root}).output;
 await mkdir(output,{recursive:true});await writeFile(path.join(output,'sentinel'),'existing');
 let calls=0;
 await assert.rejects(()=>prepareDesktop({root,env:{LEX_DESKTOP_TARGET:'windows-x64'},host,run:()=>{calls++;}}),/host/);
 await assert.rejects(()=>prepareDesktop({root,env:{LEX_DESKTOP_TARGET:'mac-arm64'},host,run:()=>{calls++;}}),/INVENTORY/);
 assert.equal(calls,0);assert.equal(await readFile(path.join(output,'sentinel'),'utf8'),'existing');
 assert.deepEqual(await readdir(path.dirname(output)),['app']);
});
test('offline staging failure preserves prior payload; successful staging stays target isolated',async t=>{
 const root=await fixture(t),artifactRoot=path.join(root,'artifacts'),plan=desktopPlan('mac-arm64',{root});
 const tracked=['server/main.mjs','resources/model-catalog.json','office-addin/word.html'];
 for(const file of [...tracked,'package.json','package-lock.json']){await mkdir(path.dirname(path.join(root,file)),{recursive:true});await writeFile(path.join(root,file),'{}');}
 const db='resources/public-library.sqlite',sidecar=db+'.manifest.json';
 const database='synthetic frozen index only';const libraryManifest=JSON.stringify({schemaVersion:1,kind:'public-legal-library',privateDocumentsIncluded:false,status:'structurally-verified-currentness-unverified',corpusSha256:hash('synthetic corpus'),indexSha256:hash(database),bytes:Buffer.byteLength(database)});
 await writeFile(path.join(root,db),database);await writeFile(path.join(root,sidecar),libraryManifest);
 const verifyFrozenLibrary=createFrozenLibraryVerifier({manifestSha256:hash(libraryManifest),indexSha256:hash(database),corpusSha256:hash('synthetic corpus'),bytes:Buffer.byteLength(database)});
 const files=['runtime/node','resources/runtime/ollama'];
 for(const file of files){await mkdir(path.dirname(path.join(artifactRoot,file)),{recursive:true});await writeFile(path.join(artifactRoot,file),'binary');}
 const manifest={schemaVersion:1,target:plan.id,files:files.map(p=>({path:p,bytes:6,sha256:hash('binary'),executable:true}))};
 manifest.sourceFiles=[...tracked,'package.json','package-lock.json'].map(p=>({path:p,bytes:2,sha256:hash('{}')}));
 manifest.sourceFiles.push({path:db,bytes:Buffer.byteLength(database),sha256:hash(database)},{path:sidecar,bytes:Buffer.byteLength(libraryManifest),sha256:hash(libraryManifest)});
 const inventory=path.join(root,'inventory.json');await writeFile(inventory,JSON.stringify(manifest));
 const env={LEX_DESKTOP_TARGET:plan.id,LEX_RUNTIME_INVENTORY:inventory,LEX_RUNTIME_ARTIFACTS:artifactRoot};
 await mkdir(path.join(plan.output,'resources'),{recursive:true});await writeFile(path.join(plan.output,'resources/runtime-manifest.json'),JSON.stringify({schemaVersion:2,target:plan.id}));await writeFile(path.join(plan.output,'sentinel'),'old');
 let failInstall=true;const commands=[];
 const run=(command,args,options)=>{commands.push([command,args]);if(command==='/usr/bin/lipo')return {status:0,stdout:'arm64'};if(command==='git')return {status:0,stdout:tracked.join('\0')};if(command==='npm'&&args[0]==='--version')return {status:0,stdout:'10'};assert.equal(command,'npm');assert.ok(args.includes('--offline'));assert.ok(args.includes('--ignore-scripts'));assert.ok(args.includes('--bin-links=false'));assert.notEqual(options.cwd,plan.output);return {status:failInstall?1:0};};
 await assert.rejects(()=>prepareDesktop({root,env,host,run}),/edición congelada/);
 const complete=structuredClone(manifest);
 for(const omitted of [db,sidecar]){manifest.sourceFiles=complete.sourceFiles.filter(f=>f.path!==omitted);await writeFile(inventory,JSON.stringify(manifest));await assert.rejects(()=>prepareDesktop({root,env,host,run,verifyFrozenLibrary}),/Falta fuente/);assert.equal(await readFile(path.join(plan.output,'sentinel'),'utf8'),'old');}
 manifest.sourceFiles=complete.sourceFiles;await writeFile(inventory,JSON.stringify(manifest));
 await rm(path.join(root,db));await assert.rejects(()=>prepareDesktop({root,env,host,run,verifyFrozenLibrary}),/ENOENT/);await writeFile(path.join(root,db),database);
 await writeFile(path.join(root,db),'altered');await assert.rejects(()=>prepareDesktop({root,env,host,run,verifyFrozenLibrary}),/Fuente distinta/);await writeFile(path.join(root,db),database);
 await rm(path.join(root,db));await symlink(path.join(root,'package.json'),path.join(root,db));await assert.rejects(()=>prepareDesktop({root,env,host,run,verifyFrozenLibrary}),/enlaces/);await rm(path.join(root,db));await writeFile(path.join(root,db),database);
 const inconsistent=libraryManifest.replace(hash(database),'0'.repeat(64));await writeFile(path.join(root,sidecar),inconsistent);manifest.sourceFiles=complete.sourceFiles.map(f=>f.path===sidecar?{...f,sha256:hash(inconsistent)}:f);await writeFile(inventory,JSON.stringify(manifest));await assert.rejects(()=>prepareDesktop({root,env,host,run,verifyFrozenLibrary}),/edición congelada/);await writeFile(path.join(root,sidecar),libraryManifest);manifest.sourceFiles=complete.sourceFiles;await writeFile(inventory,JSON.stringify(manifest));
 assert.equal(await readFile(path.join(plan.output,'sentinel'),'utf8'),'old');assert.deepEqual(await readdir(path.dirname(plan.output)),['app']);
 await assert.rejects(()=>prepareDesktop({root,env,host,run,verifyFrozenLibrary}),/offline/);
 assert.equal(await readFile(path.join(plan.output,'sentinel'),'utf8'),'old');assert.deepEqual(await readdir(path.dirname(plan.output)),['app']);
 failInstall=false;assert.equal((await prepareDesktop({root,env,host,run,verifyFrozenLibrary})).output,plan.output);
 const staged=JSON.parse(await readFile(path.join(plan.output,'resources/runtime-manifest.json'),'utf8'));
 assert.equal(await readFile(path.join(plan.output,db),'utf8'),database);assert.equal(await readFile(path.join(plan.output,sidecar),'utf8'),libraryManifest);
 assert.equal(staged.target,plan.id);assert.equal(staged.bundledModel,null);assert.equal(staged.validationStatus,'staged-not-platform-validated');
 assert.equal(await readFile(path.join(plan.output,'runtime/node'),'utf8'),'binary');
 assert.equal(commands.some(([command])=>/brew|whisper|curl/.test(command)),false);
 assert.deepEqual(await readdir(path.dirname(plan.output)),['app']);
});
test('build entry and base Tauri config cannot select stale shared payload',async()=>{
 const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
 assert.equal(pkg.scripts['desktop:build'],'node scripts/build-desktop.mjs');
 const base=JSON.parse(await readFile(new URL('../src-tauri/tauri.conf.json',import.meta.url),'utf8'));
 assert.deepEqual(base.bundle.resources,{});
 for(const id of ['mac-arm64','mac-x64','windows-x64']){
  const plan=desktopPlan(id),keys=Object.keys(targetTauriConfig(plan).bundle.resources);
  assert.equal(keys.length,1);assert.ok(keys[0].startsWith(plan.output));assert.equal(keys[0].includes('/.desktop/app/'),false);
 }
});
test('inventory rejects case/NFC aliases, ancestor collisions and nonportable traversal',()=>{
 for(const files of [['runtime/node','runtime/Node'],['runtime/é','runtime/e\u0301'],['runtime/a','runtime/a-b','runtime/a/b'],['/runtime/node'],['C:/runtime/node'],['runtime/../node'],['runtime\\node'],['runtime/node:stream'],['runtime/node.'],['runtime/node ']])assert.throws(()=>assertInventoryPaths(files));
});
test('source-root ancestor symlink and post-inventory tampering fail closed',async t=>{
 const root=await fixture(t);await mkdir(path.join(root,'source'));await writeFile(path.join(root,'source/file'),'first');
 await symlink(path.join(root,'source'),path.join(root,'alias'));
 await assert.rejects(()=>approvedRuntimeInventory({manifest:{schemaVersion:1,target:'mac-arm64',files:[{path:'runtime/node',bytes:5,sha256:hash('first'),executable:true}]},source:path.join(root,'alias'),plan:desktopPlan('mac-arm64')}),/enlaces/);
 const source=path.join(root,'source/file'),expected=await fileDigest(source);await writeFile(source,'other');
 await assert.rejects(()=>copyInventory([{path:'runtime/node',source,...expected}],path.join(root,'destination')),/alterado/);
});
test('real Mac Node architecture satisfies only this host target', {skip:process.platform!=='darwin'},async()=>{
 const {spawnSync}=await import('node:child_process');
 checkBinaryArch(process.execPath,desktopPlan(process.arch==='arm64'?'mac-arm64':'mac-x64'),spawnSync);
});
