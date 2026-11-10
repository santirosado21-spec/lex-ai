// Bounded offline comparison of fixed public research captures. Never repairs text.
import {open,lstat,mkdir,realpath} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {canonicalJson} from '../server/canonical-json.mjs';
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const CAP='artifacts/public-corpus/nl-pdfs-revision-01/',PAGES='artifacts/public-corpus/nl-page-evidence-revision-01/';
export const CONFIG='resources/nuevo-leon-fidelity-audit-v1.json';
export const CONFIG_SHA='ccc5f89132342a769068905925d8f389e88a78a225dbf1a961273f8b9a219a3d';
export const DOCUMENTS=Object.freeze([
 Object.freeze({id:'nl-civil',pages:396,selected:Object.freeze([1,2,57,114,170,227,283,340,373,374,375,396]),visual:Object.freeze([1,374,396])}),
 Object.freeze({id:'nl-penal',pages:223,selected:Object.freeze([1,2,26,27,28,33,64,96,128,160,191,223]),visual:Object.freeze([26,27,223])})]);
export const PINS=Object.freeze({
 [CONFIG]:CONFIG_SHA,
 'docs/qa/nuevo-leon-pages-C2a-freeze-2026-11-10.json':'a760cbb14eb0096cdddcdd9353de5bb9ec109d876c596eae6c5df6b55f0937eb',
 [CAP+'report.json']:'888972f9e20cfc17f573ed43b37d23ab3c00db4efc2b963ed7b1483478759246',
 [PAGES+'report.json']:'fcbcef8eb1e090e3ef2953bd694f07eaf7b8ec7cff5bb425445090f5cafff815',
 [CAP+'nl-civil.pdf']:'a517709dd10664bbf7fc4ee77e32e4a0da7fdfbce45b662166dc706ead3c8af7',
 [CAP+'nl-penal.pdf']:'440f28ca7515f63c35e5e9034086e843e126bed75f6d07dfe1067537607c3d76',
 [PAGES+'nl-civil.pages.json']:'5cb4872ebf40dec7edf9447a037b2df500ffd903632429fdf8bc3c275a8ba216',
 [PAGES+'nl-penal.pages.json']:'426311dc88b95d0a5d8dec78d66c0ec2b357ed30ff8659dc3c2ab8411cd5c343'});
export const LIMITS=Object.freeze({maxCommandMs:15000,maxBatchMs:120000,maxStdoutBytes:1048576,maxStderrBytes:65536,maxTotalTextBytes:4194304,maxJsonBytes:33554432,maxImagesBytes:33554432,maxBinaryBytes:67108864,maxInputFileBytes:33554432,maxInputBytes:41943040});
const TOOL_PATHS=Object.freeze({pdftotext:'/opt/homebrew/bin/pdftotext',pdftoppm:'/opt/homebrew/bin/pdftoppm',pdfinfo:'/opt/homebrew/bin/pdfinfo'});
const FLAGS=Object.freeze({status:'quarantined',rightsReview:'pending',textReview:'pending',legalReview:'pending',effectiveAt:null,fidelityApproved:false,visualReview:'pending',approvedForAcquisition:false,productionEnabled:false,published:false,indexed:false,trainingExported:false});
const codes=new Set(['input-integrity','unsafe-path','source-drift','page-provenance','process-failed','process-timeout','duration-budget','output-budget','text-budget','image-invalid','invalid-utf8','empty-output','tool-unavailable']);
const err=code=>Object.assign(new Error(code),{code});
const category=e=>codes.has(e?.code)?e.code:'process-failed';
export const sha=b=>createHash('sha256').update(b).digest('hex');
export function fidelityPlan(){return {schemaVersion:1,kind:'nle-fidelity-audit-proposal',action:'plan',protocol:CONFIG,protocolSha256:CONFIG_SHA,documents:DOCUMENTS,plannedPages:24,plannedTextComparisons:48,plannedVisualPages:6,limits:LIMITS,networkRequests:0,actualAuditExecuted:false,...FLAGS};}
async function safe(root,relative){
 if(typeof relative!=='string'||path.isAbsolute(relative)||relative.split(/[\\/]/).some(s=>!s||s==='.'||s==='..'))throw err('unsafe-path');
 const target=path.resolve(root,relative);if(!target.startsWith(path.resolve(root)+path.sep))throw err('unsafe-path');
 let cur=path.parse(target).root;for(const part of target.slice(cur.length).split(path.sep)){cur=path.join(cur,part);let st;try{st=await lstat(cur);}catch(e){if(e.code==='ENOENT'&&cur===target)return target;throw err('unsafe-path');}if(st.isSymbolicLink()||(!st.isFile()&&!st.isDirectory())||(cur!==target&&!st.isDirectory()))throw err('unsafe-path');}return target;
}
async function read(root,rel,max){let h;try{h=await open(await safe(root,rel),constants.O_RDONLY|constants.O_NOFOLLOW);const st=await h.stat();if(!st.isFile()||st.size>max)throw err('input-integrity');const b=Buffer.alloc(st.size+1);let n=0;while(n<b.length){const r=await h.read(b,n,b.length-n,null);if(!r.bytesRead)break;n+=r.bytesRead;}if(n!==st.size)throw err('input-integrity');return b.subarray(0,n);}catch(e){throw codes.has(e?.code)?e:err('input-integrity');}finally{await h?.close();}}
async function write(root,rel,b){const h=await open(await safe(root,rel),constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);try{await h.writeFile(b);await h.sync();await h.chmod(0o400);}finally{await h.close();}return {path:rel,bytes:b.length,sha256:sha(b)};}
function decode(b){try{return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(b);}catch{throw err('invalid-utf8');}}
export function normalize(text){return text.replace(/[\u0009-\u000d\u0020]+/g,' ').replace(/^ +| +$/g,'');}
export function compareText(a,b){
 const left=Array.from(a),right=Array.from(b),na=normalize(a),nb=normalize(b),x=Array.from(na),y=Array.from(nb);
 let prefix=0;while(prefix<Math.min(left.length,right.length)&&left[prefix]===right[prefix])prefix++;
 let suffix=0;while(suffix<Math.min(left.length,right.length)-prefix&&left[left.length-1-suffix]===right[right.length-1-suffix])suffix++;
 const ta=na?na.split(' '):[],tb=nb?nb.split(' '):[],counts=new Map();for(const t of tb)counts.set(t,(counts.get(t)??0)+1);let matched=0;
 for(const t of ta){const n=counts.get(t)??0;if(n){matched++;counts.set(t,n-1);}}
 let tokenPrefix=0;while(tokenPrefix<Math.min(ta.length,tb.length)&&ta[tokenPrefix]===tb[tokenPrefix])tokenPrefix++;
 let positional=0;for(let i=0;i<Math.min(x.length,y.length);i++)if(x[i]===y[i])positional++;
 const same=a===b,window=(v)=>v.slice(Math.max(0,prefix-80),Math.min(v.length,prefix+160)).join('');
 return {rawEqual:same,normalizedEqual:na===nb,pdfjs:{bytes:Buffer.byteLength(a),sha256:sha(a),codePoints:left.length,tokens:ta.length,replacementCharacters:left.filter(c=>c==='\ufffd').length},poppler:{bytes:Buffer.byteLength(b),sha256:sha(b),codePoints:right.length,tokens:tb.length,replacementCharacters:right.filter(c=>c==='\ufffd').length},
  normalized:{pdfjs:{sha256:sha(na),bytes:Buffer.byteLength(na),codePoints:x.length},poppler:{sha256:sha(nb),bytes:Buffer.byteLength(nb),codePoints:y.length}},tokenMultiset:{matched,pdfjsObservedPrecision:ta.length?matched/ta.length:null,popplerComparatorRecall:tb.length?matched/tb.length:null,groundTruth:false},
  order:{firstUnequalTokenIndex:ta.length===tb.length&&tokenPrefix===ta.length?null:tokenPrefix,orderedTokensEqual:JSON.stringify(ta)===JSON.stringify(tb),positionalCodePointMatches:positional,positionDenominator:Math.max(x.length,y.length),rawCommonPrefixCodePoints:prefix,rawCommonSuffixCodePoints:suffix},
  firstLiteralDifference:same?null:{codePointIndex:prefix,pdfjsUtf8ByteOffset:Buffer.byteLength(left.slice(0,prefix).join('')),popplerUtf8ByteOffset:Buffer.byteLength(right.slice(0,prefix).join('')),pdfjsLine:1+(left.slice(0,prefix).join('').match(/\n/g)?.length??0),popplerLine:1+(right.slice(0,prefix).join('').match(/\n/g)?.length??0),pdfjsWindow:window(left),popplerWindow:window(right),fullDifferencesRetainedInRawArtifacts:true},normalization:'ascii-whitespace-v1',semanticApproval:false};
}
// No shell, inherited private environment, URLs, or user-selected executable.
export function executeBounded(file,args,{timeoutMs,stdoutLimit,stderrLimit,cwd}){
 return new Promise((resolve,reject)=>{let child,done=false,timer,out=[],errors=[],size=0,errorSize=0;
  const finish=(error,result)=>{if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve(result);};
  try{child=spawn(file,args,{cwd,env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},shell:false,stdio:['ignore','pipe','pipe'],detached:true});}catch{finish(err('tool-unavailable'));return;}
  let failure=null;const stop=code=>{failure??=err(code);try{process.kill(-child.pid,'SIGKILL');}catch{child.kill('SIGKILL');}};
  timer=setTimeout(()=>stop('process-timeout'),timeoutMs);
  child.stdout.on('data',b=>{size+=b.length;if(size>stdoutLimit)stop('output-budget');else out.push(b);});
  child.stderr.on('data',b=>{errorSize+=b.length;if(errorSize>stderrLimit)stop('output-budget');else errors.push(b);});
  child.on('error',()=>finish(err('tool-unavailable')));child.on('close',code=>finish(failure??(code===0?null:err('process-failed')),{stdout:Buffer.concat(out),stderr:Buffer.concat(errors),exitCode:code}));
 });
}
export async function runFidelityAudit({outName,render=false,repositoryRoot=ROOT,execImpl,fixturePins,fixtureTools,bounds,clock=()=>performance.now()}={}){
 const injected=typeof execImpl==='function';if((repositoryRoot!==ROOT||fixturePins||fixtureTools||bounds)&&!injected)throw err('source-drift');
 if(!/^[a-z][a-z0-9-]{0,79}$/.test(outName??''))throw err('unsafe-path');if(typeof render!=='boolean')throw err('source-drift');
 const limits={...LIMITS,...bounds};if(Object.keys(limits).length!==Object.keys(LIMITS).length)throw err('source-drift');for(const [k,v]of Object.entries(LIMITS))if(!Number.isSafeInteger(limits[k])||limits[k]<1||limits[k]>v)throw err('source-drift');
 const start=clock(),check=()=>{if(clock()-start>=limits.maxBatchMs)throw err('duration-budget');};check();
 const pins=fixturePins??PINS;if(Object.keys(pins).sort().join()!==Object.keys(PINS).sort().join())throw err('source-drift');
 const inputs=new Map(),inputLedger=[];let inputBytes=0;
 for(const rel of Object.keys(PINS)){check();const b=await read(repositoryRoot,rel,limits.maxInputFileBytes);inputBytes+=b.length;if(inputBytes>limits.maxInputBytes||sha(b)!==pins[rel])throw err('input-integrity');inputs.set(rel,b);inputLedger.push({path:rel,bytes:b.length,sha256:sha(b)});}
 const config=JSON.parse(decode(inputs.get(CONFIG)));if(config.protocolId!=='nuevo-leon-fidelity-audit-v1'||JSON.stringify(config.sampling.documents.map(d=>[d.id,d.selected,d.visual]))!==JSON.stringify(DOCUMENTS.map(d=>[d.id,d.selected,d.visual])))throw err('source-drift');
 const pages=new Map();for(const doc of DOCUMENTS){const pdf=inputs.get(CAP+doc.id+'.pdf');if(!pdf.subarray(0,5).equals(Buffer.from('%PDF-')))throw err('input-integrity');const obj=JSON.parse(decode(inputs.get(PAGES+doc.id+'.pages.json')));if(obj.documentId!==doc.id||obj.pdfSha256!==pins[CAP+doc.id+'.pdf']||obj.pages?.length!==doc.pages)throw err('page-provenance');for(const p of doc.selected){const page=obj.pages[p-1];if(page?.pageNumber!==p||typeof page.text!=='string'||sha(page.text)!==page.textSha256||page.pdfSha256!==obj.pdfSha256)throw err('page-provenance');}pages.set(doc.id,obj);}
 const tools={};for(const [key,fixed]of Object.entries(TOOL_PATHS)){check();const selected=fixtureTools?.[key]??fixed;const resolved=await realpath(selected).catch(()=>{throw err('tool-unavailable');});if(!injected&&!resolved.startsWith('/opt/homebrew/'))throw err('tool-unavailable');const b=await read(path.dirname(resolved),path.basename(resolved),limits.maxBinaryBytes);tools[key]={requestedPath:fixed,resolvedPath:resolved,binarySha256:sha(b),bytes:b.length};}
 const base='artifacts/public-corpus/'+outName,output=await safe(repositoryRoot,base);await mkdir(output,{mode:0o700}).catch(()=>{throw err('unsafe-path');});
 const report={...fidelityPlan(),action:'audit-offline',actualAuditExecuted:true,state:'running',artifactDirectory:base,startedAt:new Date().toISOString(),inputLedger,tools,runtime:{node:process.version,platform:process.platform,arch:process.arch},limits,outputs:[],commands:[],comparisons:[],visual:[],pending:[],networkRequests:0};
 let textBytes=0,jsonBytes=0,imageBytes=0;const execute=execImpl??executeBounded;
 const json=async(rel,value)=>{const b=Buffer.from(canonicalJson(value)+'\n');const next=jsonBytes+b.length;if(next+(rel==='report.json'?0:Math.min(262144,Math.floor(limits.maxJsonBytes/2)))>limits.maxJsonBytes)throw err('output-budget');report.outputs.push(await write(output,rel,b));jsonBytes=next;};
 const call=async(key,args,stdoutLimit)=>{check();const timeoutMs=Math.min(limits.maxCommandMs,Math.max(1,Math.floor(limits.maxBatchMs-(clock()-start))));const began=clock();const receipt={tool:key,args,startedAt:new Date().toISOString(),timeoutMs};report.commands.push(receipt);try{const result=await execute(tools[key].resolvedPath,args,{timeoutMs,stdoutLimit,stderrLimit:limits.maxStderrBytes,cwd:output});check();if(result.exitCode!==0)throw err('process-failed');if(!Buffer.isBuffer(result.stdout)||!Buffer.isBuffer(result.stderr)||result.stdout.length>stdoutLimit||result.stderr.length>limits.maxStderrBytes)throw err('output-budget');Object.assign(receipt,{exitCode:0,elapsedMs:Math.max(0,clock()-began),stdoutBytes:result.stdout.length,stdoutSha256:sha(result.stdout),stderrBytes:result.stderr.length,stderrSha256:sha(result.stderr)});return result;}catch(e){receipt.errorCategory=category(e);throw e;}};
 try{
  for(const [key]of Object.entries(tools)){const result=await call(key,['-v'],limits.maxStderrBytes);if(!result.stdout.length&&!result.stderr.length)throw err('empty-output');const b=Buffer.concat([result.stdout,result.stderr]);textBytes+=b.length;if(textBytes>limits.maxTotalTextBytes)throw err('text-budget');report.outputs.push(await write(output,key+'.version.txt',b));}
  for(const doc of DOCUMENTS){const pdf=inputs.get(CAP+doc.id+'.pdf');report.outputs.push(await write(output,doc.id+'.pdf',pdf));}
  await json('input-ledger.json',inputLedger);
  for(const doc of DOCUMENTS){const obj=pages.get(doc.id),pdfPath=await safe(output,doc.id+'.pdf');
   for(const n of doc.selected){check();const page=obj.pages[n-1],prefix=doc.id+'-p'+String(n).padStart(4,'0');if(!page.text.length)throw err('empty-output');
    const observed=Buffer.from(page.text);textBytes+=observed.length;if(textBytes>limits.maxTotalTextBytes)throw err('text-budget');report.outputs.push(await write(output,prefix+'.pdfjs.txt',observed));
    await json(prefix+'.lineage.json',{documentId:doc.id,pageNumber:n,pdfSha256:obj.pdfSha256,pageTextSha256:page.textSha256,pageEvidenceSha256:page.pageSha256,documentEvidenceSha256:obj.documentEvidenceSha256,evidenceFileSha256:pins[PAGES+doc.id+'.pages.json'],lines:page.lines,items:page.items,...FLAGS});
    for(const mode of ['default','layout']){const args=['-f',String(n),'-l',String(n),'-enc','UTF-8','-eol','unix',...(mode==='layout'?['-layout']:[]),pdfPath,'-'];const result=await call('pdftotext',args,limits.maxStdoutBytes);if(!result.stdout.length)throw err('empty-output');const literal=decode(result.stdout);if(!normalize(literal))throw err('empty-output');textBytes+=result.stdout.length;if(textBytes>limits.maxTotalTextBytes)throw err('text-budget');
     report.outputs.push(await write(output,prefix+'.poppler-'+mode+'.txt',result.stdout));const metrics=compareText(page.text,literal);const normalizedA=Buffer.from(normalize(page.text)),normalizedB=Buffer.from(normalize(literal));textBytes+=normalizedA.length+normalizedB.length;if(textBytes>limits.maxTotalTextBytes)throw err('text-budget');report.outputs.push(await write(output,prefix+'.'+mode+'.pdfjs.ascii-ws.txt',normalizedA));report.outputs.push(await write(output,prefix+'.'+mode+'.poppler.ascii-ws.txt',normalizedB));
     const comparison={documentId:doc.id,physicalPage:n,mode,pdfSha256:obj.pdfSha256,pageTextSha256:page.textSha256,pageEvidenceSha256:page.pageSha256,...metrics,...FLAGS};await json(prefix+'.'+mode+'.comparison.json',comparison);report.comparisons.push({documentId:doc.id,physicalPage:n,mode,rawEqual:metrics.rawEqual,normalizedEqual:metrics.normalizedEqual,orderedTokensEqual:metrics.order.orderedTokensEqual});
    }
   }
  }
  if(render)for(const doc of DOCUMENTS)for(const n of doc.visual){const pdfPath=await safe(output,doc.id+'.pdf'),r=await call('pdftoppm',['-f',String(n),'-l',String(n),'-singlefile','-r','96','-png',pdfPath],Math.min(8*1024*1024,limits.maxImagesBytes));const b=r.stdout;
   if(b.length<33||!b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||b.subarray(12,16).toString()!=='IHDR')throw err('image-invalid');const width=b.readUInt32BE(16),height=b.readUInt32BE(20);if(!width||!height||width>2048||height>2048)throw err('image-invalid');imageBytes+=b.length;if(imageBytes>limits.maxImagesBytes)throw err('output-budget');const rel=doc.id+'-p'+String(n).padStart(4,'0')+'.png';report.outputs.push(await write(output,rel,b));report.visual.push({documentId:doc.id,physicalPage:n,path:rel,dpi:96,width,height,coordinateSystem:'integer pixels, top-left origin; no PDF.js transform mapping assumed',review:'pending',fidelityApproved:false});}
  report.state='complete-quarantine';
 }catch(e){report.state='partial-quarantine';report.errorCategory=category(e);}
 finally{
  try{for(const [rel,expected]of Object.entries(pins))if(sha(await read(repositoryRoot,rel,limits.maxInputFileBytes))!==expected)throw err('input-integrity');for(const item of report.outputs.filter(r=>r.path.endsWith('.pdf')))if(sha(await read(output,item.path,limits.maxInputFileBytes))!==item.sha256)throw err('input-integrity');for(const tool of Object.values(tools))if(sha(await read(path.dirname(tool.resolvedPath),path.basename(tool.resolvedPath),limits.maxBinaryBytes))!==tool.binarySha256)throw err('input-integrity');check();}catch(e){report.state='partial-quarantine';report.errorCategory=category(e);}
  const done=new Set(report.comparisons.map(c=>c.documentId+':'+c.physicalPage+':'+c.mode));report.pending=DOCUMENTS.flatMap(d=>d.selected.flatMap(n=>['default','layout'].filter(m=>!done.has(d.id+':'+n+':'+m)).map(mode=>({documentId:d.id,physicalPage:n,mode,status:'pending'}))));
  const visualDone=new Set(report.visual.map(v=>v.documentId+':'+v.physicalPage));report.pendingVisual=DOCUMENTS.flatMap(d=>d.visual.filter(n=>!visualDone.has(d.id+':'+n)).map(physicalPage=>({documentId:d.id,physicalPage,status:'pending-not-rendered'})));
  report.summary={plannedPages:24,plannedComparisons:48,completedComparisons:report.comparisons.length,pendingComparisons:report.pending.length,rawEqual:report.comparisons.filter(c=>c.rawEqual).length,normalizedEqual:report.comparisons.filter(c=>c.normalizedEqual).length,plannedVisualPages:6,renderedPages:report.visual.length,visualApproved:0,fidelityApproved:false};report.textBytes=textBytes;report.imageBytes=imageBytes;report.elapsedMs=Math.max(0,clock()-start);report.finishedAt=new Date().toISOString();await json('report.json',report);
 }
 return report;
}
export async function main(args=process.argv.slice(2)){
 if(!args.length||(args.length===1&&args[0]==='--plan')){process.stdout.write(JSON.stringify(fidelityPlan(),null,2)+'\n');return 0;}
 if(!((args.length===3||args.length===4)&&args[0]==='--audit'&&args[1]==='--out-name'&&(args.length===3||args[3]==='--render')))throw err('unsafe-path');
 const r=await runFidelityAudit({outName:args[2],render:args[3]==='--render'});process.stdout.write(JSON.stringify(r.summary)+'\n');return r.state==='complete-quarantine'?0:1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().then(c=>{process.exitCode=c;}).catch(e=>{process.stderr.write(category(e)+'\n');process.exitCode=2;});
