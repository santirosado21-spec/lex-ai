#!/usr/bin/env node
// Explicit offline import only: isolated daemon/store, no generation, no promotion.
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {createReadStream} from 'node:fs';
import {access,mkdir,readFile,writeFile,stat,link,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const work=path.join(root,'artifacts/lightweight');
const hfAligned=process.argv.includes('--hf-aligned');
const tag=hfAligned?'1b-v2-hf':'1b-v2';
const name='lexai-grounded:'+tag;
const prefix=hfAligned?'trained-gguf-hf':'trained-gguf';
const alignedTemplateSHA='680a6206c5762f5a0915d25b2e5d85f8a1aecbc07a03a504bcbe21b5796b34ca';
const pin='97558784bdc9175075a72655bf360b15da17df6b3b9e5182af9f8c0c8e58ba7c';
const sha=raw=>createHash('sha256').update(raw).digest('hex');
async function fileHash(file){const h=createHash('sha256');for await(const chunk of createReadStream(file))h.update(chunk);return h.digest('hex');}
async function port(){const s=createServer();await new Promise((resolve,reject)=>{s.once('error',reject);s.listen(0,'127.0.0.1',resolve);});const value=s.address().port;await new Promise(r=>s.close(r));return value;}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function atomicJson(file,value){
 const tmp=file+'.tmp-'+process.pid;await writeFile(tmp,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
 try{await link(tmp,file);}catch(e){if(e.code!=='EEXIST')throw e;const prior=JSON.parse(await readFile(file,'utf8'));if((prior.manifestDigest||prior.manifestSHA256)!==(value.manifestDigest||value.manifestSHA256))throw Error('Existing metadata describes a different manifest; not overwritten');}finally{await unlink(tmp);}
}
async function findManifest(models){
 for(const [layout,relative] of [['v2',`manifests-v2/ollama.com/library/lexai-grounded/${tag}`],['legacy',`manifests/registry.ollama.ai/library/lexai-grounded/${tag}`]]){const file=path.join(models,relative);try{await access(file);return {file,layout};}catch(e){if(e.code!=='ENOENT')throw e;}}
 throw Error('Imported manifest not found in v2 or legacy layout');
}

async function baseMetadata(){
 const raw=await readFile(path.join(work,'gemma3-1b.manifest.json'));if(sha(raw)!==pin)throw Error('Original base manifest checksum mismatch');
 const m=JSON.parse(raw);
 const get=async type=>{const layers=m.layers.filter(l=>l.mediaType===type);if(layers.length!==1)throw Error('Expected one '+type);const l=layers[0];if(!/^sha256:[a-f0-9]{64}$/.test(l.digest)||l.size>65536)throw Error('Invalid metadata layer');const content=await readFile(path.join(work,'runtime/models/blobs',l.digest.replace(':','-')));if(content.length!==l.size||sha(content)!==l.digest.slice(7))throw Error('Base metadata checksum mismatch');return content.toString('utf8');};
 const metadata={template:await get('application/vnd.ollama.image.template'),license:await get('application/vnd.ollama.image.license')};
 const originalTemplateSHA256=sha(Buffer.from(metadata.template));
 if(hfAligned){
  const file=path.join(work,'trained-gguf-models/blobs','sha256-'+alignedTemplateSHA);
  const bytes=await readFile(file);
  if(bytes.length!==363||sha(bytes)!==alignedTemplateSHA)throw Error('HF-aligned generated template checksum or length mismatch');
  metadata.template=bytes.toString('utf8');
  metadata.templateProvenance={variant:'hf-aligned-generated',source:path.relative(root,file),sha256:alignedTemplateSHA,bytes:bytes.length,originalTemplateSHA256,convention:'System prefix inside first user turn for initial system/user pair',tokenEquivalence:'Not established: whitespace, BOS and tokenizer behavior may differ from HF; requires paired runtime evaluation'};
 }else metadata.templateProvenance={variant:'original',sha256:originalTemplateSHA256,bytes:Buffer.byteLength(metadata.template)};
 return metadata;
}
async function main(){
 const verifyExisting=process.argv.includes('--verify-existing');
 if(!verifyExisting&&!process.argv.includes('--execute'))throw Error('Use --execute to import or --verify-existing to verify local files without spawning.');
 if(verifyExisting&&process.argv.includes('--execute'))throw Error('Choose one mode only');
 const bin='/Applications/LEX AI.app/Contents/Resources/app/resources/runtime/ollama';
 const gguf=path.join(work,'gemma3-grounded-v2-q4_k_m.gguf');
 const models=path.join(work,prefix+'-models'),home=path.join(work,prefix+'-import-home');
 const manifestPaths=[`manifests/registry.ollama.ai/library/lexai-grounded/${tag}`,`manifests-v2/ollama.com/library/lexai-grounded/${tag}`].map(p=>path.join(models,p));
 const catalogPath=path.join(work,prefix+'-candidate-catalog.json');
 // Never overwrite an existing experimental import or catalog accidentally.
 if(!verifyExisting)for(const p of [...manifestPaths,catalogPath]){try{await access(p);throw Error('Destination already exists: '+path.basename(p));}catch(e){if(e.code!=='ENOENT')throw e;}}
 await access(bin);const info=await stat(gguf);if(!info.isFile()||info.size<1||info.size>2_000_000_000)throw Error('Final GGUF missing or over2GB');
 const metadata=await baseMetadata(),digest=await fileHash(gguf);
 async function verifyAndEmit(){
  const located=await findManifest(models);const raw=await readFile(located.file),m=JSON.parse(raw),layers=[m.config,...m.layers];let total=0;
  if(m.schemaVersion!==2||layers.length>32||m.runner!=='llamacpp'||m.format!=='gguf')throw Error('Unexpected imported manifest');
  const modelLayers=m.layers.filter(l=>l.mediaType==='application/vnd.ollama.image.model');if(modelLayers.length!==1||modelLayers[0].digest!==`sha256:${digest}`||modelLayers[0].size!==info.size)throw Error('Imported GGUF layer differs from verified source');
  const records=[];
  for(const layer of layers){if(!/^sha256:[a-f0-9]{64}$/.test(layer.digest)||!Number.isSafeInteger(layer.size)||layer.size<0)throw Error('Invalid imported layer');const p=path.join(models,'blobs',layer.digest.replace(':','-'));if((await stat(p)).size!==layer.size||await fileHash(p)!==layer.digest.slice(7))throw Error('Imported layer checksum mismatch');total+=layer.size;records.push({mediaType:layer.mediaType,digest:layer.digest,bytes:layer.size});}
  if(total>2_000_000_000)throw Error('Imported model exceeds2GB');
  for(const [type,text] of [['template',metadata.template],['license',metadata.license]]){const layer=m.layers.find(l=>l.mediaType===`application/vnd.ollama.image.${type}`);if(!layer||layer.digest!==`sha256:${sha(Buffer.from(text))}`)throw Error('Imported '+type+' differs from verified selected metadata');}
  if(await fileHash(gguf)!==digest)throw Error('GGUF changed during import');
  const manifestDigest=sha(raw);
  const catalog={id:name,label:'LEX AI',technicalLabel:'Experimental Gemma3 1B grounded-v2 four dense LoRA projections'+(hfAligned?' HF-aligned template':''),manifestDigest,minMemoryGB:8,minFreeMemoryGB:2,minFreeDiskGB:3,downloadBytes:total,downloadGB:Number((total/1e9).toFixed(3)),maxDownloadBytes:2_000_000_000,license:'Gemma Terms of Use',licenseUrl:'https://ai.google.dev/gemma/terms',sourceUrl:'https://ai.google.dev/gemma/docs/core',platform:'darwin',arch:'arm64',contextLength:4096,outputTokens:512,maxInputCharacters:7000,memoryEstimateGB:[2,3],memoryMeasured:false,validationStatus:'experimental-trained-candidate-pending-production-schema-evaluation',think:false,localOnly:true,manifestLayout:located.layout,...(hfAligned?{templateProvenance:metadata.templateProvenance}:{})};
  await atomicJson(path.join(work,prefix+'-import-report.json'),{schemaVersion:1,verificationMode:verifyExisting?'existing-files-only':'after-api-import',daemonStartedByThisRun:!verifyExisting,manifestLayout:located.layout,model:name,modelsDir:path.relative(root,models),sourceGGUF:{file:path.relative(root,gguf),bytes:info.size,sha256:digest},originalBaseManifestSHA256:pin,manifestSHA256:manifestDigest,totalLayerBytes:total,layers:records,templateAndLicense:hfAligned?'verified-generated-template-and-original-pinned-license':'exact-original-pinned-bytes',templateProvenance:metadata.templateProvenance,inferencePerformed:false,legalAccuracy:'not-evaluated',runtimeBinarySHA256:await fileHash(bin)});
  await atomicJson(catalogPath,catalog);
  console.log(JSON.stringify({status:verifyExisting?'verified-existing-not-evaluated':'imported-not-evaluated',catalog:path.relative(root,catalogPath),modelsDir:path.relative(root,models),manifestDigest,totalLayerBytes:total,inferencePerformed:false}));
 }
 if(verifyExisting){await verifyAndEmit();return;}
 await mkdir(models,{recursive:true,mode:0o700});await mkdir(home,{recursive:true,mode:0o700});
 const assigned=await port(),base=`http://127.0.0.1:${assigned}`,abort=new AbortController();
 let daemon,exited=false;
 const cancel=()=>abort.abort();process.once('SIGINT',cancel);process.once('SIGTERM',cancel);
 const request=async(route,body,timeout=30000)=>{const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.any([abort.signal,AbortSignal.timeout(timeout)])});if(!r.ok)throw Error(`Import HTTP${r.status}: ${(await r.text()).slice(0,500)}`);return r;};
 try{
  daemon=spawn(bin,['serve'],{stdio:['ignore','ignore','pipe'],env:{PATH:'/usr/bin:/bin',HOME:home,TMPDIR:process.env.TMPDIR||'/tmp',OLLAMA_HOST:`127.0.0.1:${assigned}`,OLLAMA_MODELS:models,OLLAMA_NO_CLOUD:'1',OLLAMA_KEEP_ALIVE:'0',OLLAMA_MAX_LOADED_MODELS:'1',OLLAMA_NUM_PARALLEL:'1',OLLAMA_CONTEXT_LENGTH:'4096',OLLAMA_ORIGINS:'',DYLD_LIBRARY_PATH:path.dirname(bin)}});
  daemon.stderr.on('data',()=>{});let startError;daemon.once('error',e=>{startError=e;});daemon.once('exit',()=>{exited=true;});
  let ready=false;
  for(let i=0;i<100;i++){if(abort.signal.aborted)throw Error('Import cancelled');if(startError)throw startError;if(exited)throw Error('Private daemon stopped');try{const r=await fetch(base+'/api/version',{signal:AbortSignal.any([abort.signal,AbortSignal.timeout(500)])});if(r.ok){ready=true;break;}}catch{}await delay(100);}
  if(!ready)throw Error('Private daemon startup timed out');
  // Upload the verified local GGUF as a stream; never buffer a model in memory.
  const upload=await fetch(base+'/api/blobs/sha256:'+digest,{method:'POST',body:createReadStream(gguf),duplex:'half',headers:{'Content-Type':'application/octet-stream','Content-Length':String(info.size)},signal:AbortSignal.any([abort.signal,AbortSignal.timeout(900000)])});
  if(!upload.ok)throw Error(`Local blob upload failed: HTTP${upload.status}`);await upload.arrayBuffer();
  const created=await request('/api/create',{model:name,files:{'candidate.gguf':'sha256:'+digest},template:metadata.template,license:metadata.license,parameters:{num_ctx:4096,num_predict:512,num_thread:2,num_batch:64,temperature:0},stream:false},900000);
  const result=await created.json();if(result.error||result.status!=='success')throw Error('Local create did not finish successfully');
  await verifyAndEmit();
 }finally{
  abort.abort();process.removeListener('SIGINT',cancel);process.removeListener('SIGTERM',cancel);
  if(daemon?.pid){try{daemon.kill('SIGTERM');}catch{}for(let i=0;i<30&&!exited;i++)await delay(100);try{daemon.kill('SIGKILL');}catch{}}
 }
}
main().catch(e=>{console.error(JSON.stringify({status:'error',message:e.message}));process.exitCode=1;});
