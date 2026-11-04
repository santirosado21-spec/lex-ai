import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,readdir,writeFile,rm,symlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import {stageBundledModel,ensureBundledModel,verifyBundledModel} from '../server/bundled-model.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function fixture(t){
 const root=await mkdtemp(path.join(os.tmpdir(),'lex-bundled-model-test-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const sourceDir=path.join(root,'source'),bundleDir=path.join(root,'bundle'),modelsDir=path.join(root,'user');await mkdir(path.join(sourceDir,'blobs'),{recursive:true});
 const layers=[{mediaType:'application/vnd.ollama.image.model',bytes:Buffer.from('tiny synthetic model fixture')},{mediaType:'application/vnd.ollama.image.license',bytes:Buffer.from('Synthetic test license')}];
 const config=Buffer.from('{"synthetic":true}');
 const entry=bytes=>({digest:`sha256:${hash(bytes)}`,size:bytes.length});
 const manifest={schemaVersion:2,config:{...entry(config),mediaType:'application/vnd.docker.container.image.v1+json'},layers:layers.map(layer=>({...entry(layer.bytes),mediaType:layer.mediaType}))};
 const raw=Buffer.from(JSON.stringify(manifest));
 const catalog={id:'synthetic:small',manifestDigest:hash(raw),downloadBytes:config.length+layers.reduce((n,layer)=>n+layer.bytes.length,0),license:'Synthetic',licenseUrl:'https://example.com/test-license',sourceUrl:'https://example.com/test-model'};
 for(const bytes of [config,...layers.map(layer=>layer.bytes),raw])await writeFile(path.join(sourceDir,'blobs',`sha256-${hash(bytes)}`),bytes);
 const manifestPath='manifests/registry.ollama.ai/library/synthetic/small';
 return {root,sourceDir,bundleDir,modelsDir,catalog,manifest,manifestPath,raw};
}
test('bundle allowlist excludes other cached models; offline seeding preserves unrelated user data and is idempotent',async t=>{
 const f=await fixture(t);await writeFile(path.join(f.sourceDir,'blobs','unrelated-large-model'),'do not distribute');
 const result=await stageBundledModel(f);assert.equal(result.bytes,f.catalog.downloadBytes);
 assert.equal((await readdir(path.join(f.bundleDir,'blobs'))).includes('unrelated-large-model'),false);
 assert.equal((await verifyBundledModel(f)).available,true);
 await mkdir(f.modelsDir);await writeFile(path.join(f.modelsDir,'keep.txt'),'preserve');
 assert.equal((await ensureBundledModel(f)).seeded,true);
 assert.deepEqual(await readFile(path.join(f.modelsDir,f.manifestPath)),f.raw);
 assert.deepEqual(await readFile(path.join(f.modelsDir,'manifests-v2/ollama.com/library/synthetic/small')),f.raw);
 assert.equal(await readFile(path.join(f.modelsDir,'keep.txt'),'utf8'),'preserve');
 assert.equal((await ensureBundledModel(f)).seeded,false);
});
test('corrupt build source fails without replacing the previous staged bundle',async t=>{
 const f=await fixture(t);await mkdir(f.bundleDir);await writeFile(path.join(f.bundleDir,'previous'),'preserve');
 await writeFile(path.join(f.sourceDir,'blobs',f.manifest.layers[0].digest.replace(':','-')),'corrupt');
 await assert.rejects(stageBundledModel(f),/dañado/);
 assert.equal(await readFile(path.join(f.bundleDir,'previous'),'utf8'),'preserve');
});
test('corrupt bundled weights fail before touching the user store',async t=>{
 const f=await fixture(t);await stageBundledModel(f);await mkdir(f.modelsDir);await writeFile(path.join(f.modelsDir,'keep'),'preserve');
 await writeFile(path.join(f.bundleDir,'blobs',f.manifest.layers[0].digest.replace(':','-')),'corrupt');
 await assert.rejects(ensureBundledModel(f),/dañado/);
 assert.deepEqual(await readdir(f.modelsDir),['keep']);
});
test('repair replaces only the same pinned model files and stale migrated tag',async t=>{
 const f=await fixture(t);await stageBundledModel(f);await ensureBundledModel(f);
 await writeFile(path.join(f.modelsDir,'blobs',f.manifest.layers[0].digest.replace(':','-')),'corrupt');
 await writeFile(path.join(f.modelsDir,'manifests-v2/ollama.com/library/synthetic/small'),'stale shadow');
 assert.equal((await ensureBundledModel(f)).seeded,true);
 assert.deepEqual(await readFile(path.join(f.modelsDir,'blobs',f.manifest.layers[0].digest.replace(':','-'))),Buffer.from('tiny synthetic model fixture'));
 assert.deepEqual(await readFile(path.join(f.modelsDir,'manifests-v2/ollama.com/library/synthetic/small')),f.raw);
});
test('cancelled initialization leaves the existing user store untouched',async t=>{
 const f=await fixture(t);await stageBundledModel(f);await mkdir(f.modelsDir);await writeFile(path.join(f.modelsDir,'keep'),'preserve');
 const abort=new AbortController();abort.abort();await assert.rejects(ensureBundledModel({...f,signal:abort.signal}),{name:'AbortError'});
 assert.deepEqual(await readdir(f.modelsDir),['keep']);
});
test('rejects oversized or path-bearing catalogs and does not follow user store directory links',async t=>{
 const f=await fixture(t);
 await assert.rejects(stageBundledModel({...f,catalog:{...f.catalog,id:'../outside:tag'}}),/autorizado/);
 await assert.rejects(stageBundledModel({...f,catalog:{...f.catalog,downloadBytes:16_000_000_000}}),/autorizado/);
 await stageBundledModel(f);await mkdir(f.modelsDir);const outside=path.join(f.root,'outside');await mkdir(outside);await writeFile(path.join(outside,'keep'),'preserve');await symlink(outside,path.join(f.modelsDir,'blobs'));
 await assert.rejects(ensureBundledModel(f),/enlaces/);assert.deepEqual(await readdir(outside),['keep']);
});
test('missing offline bundle is optional for development and experiments',async t=>{
 const f=await fixture(t);assert.deepEqual(await ensureBundledModel(f),{available:false,seeded:false,files:0,bytes:0,bytesNeeded:0});
});
test('distribution verification rejects extra files and modified tag indexes',async t=>{
 const f=await fixture(t);await stageBundledModel(f);const extra=path.join(f.bundleDir,'blobs','another-model');await writeFile(extra,'must not ship');
 await assert.rejects(verifyBundledModel(f),/ajenos/);await rm(extra);
 await writeFile(path.join(f.bundleDir,f.manifestPath),'modified tag');await assert.rejects(verifyBundledModel(f),/índice/);
});
test('disk preflight reserves missing bytes and runtime margin before creating or modifying a user store',async t=>{
 const f=await fixture(t);await stageBundledModel(f);
 const needed=f.catalog.downloadBytes+3*f.raw.length,reserveBytes=1000;
 const noRoom={statfs:async()=>({bavail:needed+reserveBytes-1,bsize:1})};
 await assert.rejects(ensureBundledModel({...f,reserveBytes,dependencies:noRoom}),/libres en disco/);
 await assert.rejects(readdir(f.modelsDir),{code:'ENOENT'});
 await mkdir(f.modelsDir);await writeFile(path.join(f.modelsDir,'keep'),'preserve');
 await assert.rejects(ensureBundledModel({...f,reserveBytes,dependencies:noRoom}),/libres en disco/);
 assert.deepEqual(await readdir(f.modelsDir),['keep']);
 const exactRoom={statfs:async()=>({bavail:needed+reserveBytes,bsize:1})};
 const first=await ensureBundledModel({...f,reserveBytes,dependencies:exactRoom});assert.equal(first.bytesNeeded,needed);assert.equal(first.seeded,true);
 const warm=await ensureBundledModel({...f,reserveBytes,dependencies:{statfs:async()=>({bavail:reserveBytes,bsize:1})}});assert.equal(warm.bytesNeeded,0);assert.equal(warm.seeded,false);
 assert.equal(await readFile(path.join(f.modelsDir,'keep'),'utf8'),'preserve');
});
test('disk preflight accounts for a damaged replacement without overwriting it on failure',async t=>{
 const f=await fixture(t);await stageBundledModel(f);await ensureBundledModel(f);
 const broken=path.join(f.modelsDir,'blobs',f.manifest.layers[0].digest.replace(':','-'));await writeFile(broken,'damaged');
 const reserveBytes=1000,missing=f.manifest.layers[0].size;
 await assert.rejects(ensureBundledModel({...f,reserveBytes,dependencies:{statfs:async()=>({bavail:missing+reserveBytes-1,bsize:1})}}),/libres en disco/);
 assert.equal(await readFile(broken,'utf8'),'damaged');
 const fixed=await ensureBundledModel({...f,reserveBytes,dependencies:{statfs:async()=>({bavail:missing+reserveBytes,bsize:1})}});assert.equal(fixed.bytesNeeded,missing);
});
test('disk preflight measures the nearest existing ancestor without creating missing parents',async t=>{
 const f=await fixture(t);await stageBundledModel(f);const modelsDir=path.join(f.root,'absent','nested','models'),seen=[];
 await assert.rejects(ensureBundledModel({...f,modelsDir,reserveBytes:1000,dependencies:{statfs:async probe=>{seen.push(probe);if(probe===f.root)return {bavail:0,bsize:1};const error=Error('absent');error.code='ENOENT';throw error;}}}),/libres en disco/);
 assert.equal(seen.at(-1),f.root);await assert.rejects(readdir(path.join(f.root,'absent')),{code:'ENOENT'});
});
