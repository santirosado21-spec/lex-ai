import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';import path from 'node:path';import os from 'node:os';
import {createFrozenLibraryVerifier,frozenLibraryInventory,FROZEN_LIBRARY_IDENTITY,assertFrozenLibraryManifest} from '../server/frozen-library-artifact.mjs';
import {buildSourceInventory} from '../scripts/runtime-source-inventory.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
async function fixture(t){
 const root=await realpath(await mkdtemp(path.join(os.tmpdir(),'library-source-inventory-')));t.after(()=>rm(root,{recursive:true,force:true}));
 const tracked=['server/main.mjs','resources/model-catalog.json','office-addin/word.html','resources/public-library.sqlite.manifest.json'];
 for(const file of [...tracked,'package.json','package-lock.json']){await mkdir(path.dirname(path.join(root,file)),{recursive:true});await writeFile(path.join(root,file),'{}');}
 const db='resources/public-library.sqlite',bytes='synthetic frozen index';
 await writeFile(path.join(root,db),bytes);await writeFile(path.join(root,db+'.manifest.json'),JSON.stringify({schemaVersion:1,kind:'public-legal-library',privateDocumentsIncluded:false,status:'structurally-verified-currentness-unverified',corpusSha256:hash('synthetic corpus'),indexSha256:hash(bytes),bytes:Buffer.byteLength(bytes)}));
 const run=(command,args)=>({status:0,stdout:args[0]==='ls-files'?tracked.join('\0'):'synthetic-head'});
 const manifest=await readFile(path.join(root,db+'.manifest.json'),'utf8');
 const verifyFrozenLibrary=createFrozenLibraryVerifier({manifestSha256:hash(manifest),indexSha256:hash(bytes),corpusSha256:hash('synthetic corpus'),bytes:Buffer.byteLength(bytes)});
 return {root,run,db,verifyFrozenLibrary};
}
test('inventory includes the exact frozen gitignored pair deterministically and approves no runtime',async t=>{
 const f=await fixture(t),a=await buildSourceInventory(f),b=await buildSourceInventory(f);assert.deepEqual(a,b);
 assert.equal(a.reviewStatus,'generated-unreviewed-no-runtime-approved');assert.deepEqual(a.files,[]);
 for(const file of a.sourceFiles){assert.match(file.sha256,/^[a-f0-9]{64}$/);assert.ok(Number.isSafeInteger(file.bytes)&&file.bytes>=0);assert.ok(!file.path.startsWith('/')&&!file.path.includes('..'));}
 for(const required of ['server/main.mjs','package-lock.json',f.db,f.db+'.manifest.json'])assert.ok(a.sourceFiles.some(file=>file.path===required));
 assert.ok(!a.sourceFiles.some(f=>/^(?:resources\/)?runtime\//.test(f.path)));
 const sidecar=path.join(f.root,f.db+'.manifest.json'),original=JSON.parse(await readFile(sidecar,'utf8'));
 for(const change of [{kind:'private'},{privateDocumentsIncluded:true},{bytes:-1},{indexSha256:'bad'},{corpusSha256:'bad'}]){await writeFile(sidecar,JSON.stringify({...original,...change}));await assert.rejects(()=>buildSourceInventory(f),/Manifiesto/);}
 await writeFile(sidecar,JSON.stringify(original));
 await rm(path.join(f.root,f.db));await assert.rejects(()=>buildSourceInventory(f),/ENOENT/);
 await writeFile(path.join(f.root,f.db),'not the frozen index');await assert.rejects(()=>buildSourceInventory(f),/no coincide/);
});
test('a failing git listing fails closed',async()=>{
 await assert.rejects(buildSourceInventory({run:()=>({status:1,stdout:''})}),/git ls-files failed/);
});

test('production verifier pins the versioned manifest and rejects a different self-consistent pair',async t=>{
 const f=await fixture(t);await assert.rejects(()=>frozenLibraryInventory(f.root),/edición congelada/);
 const bytes=await readFile(new URL('../resources/public-library.sqlite.manifest.json',import.meta.url));
 assert.equal(hash(bytes),FROZEN_LIBRARY_IDENTITY.manifestSha256);assert.doesNotThrow(()=>assertFrozenLibraryManifest(JSON.parse(bytes),{sha256:hash(bytes)}));
 const changed={...JSON.parse(bytes),bytes:1000,indexSha256:hash('different'),corpusSha256:'0'.repeat(64)};
 assert.throws(()=>assertFrozenLibraryManifest(changed,{sha256:hash(JSON.stringify(changed))}),/edición congelada/);
});
