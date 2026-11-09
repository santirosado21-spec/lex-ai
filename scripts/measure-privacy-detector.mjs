// Matched synthetic baseline/candidate measurement. Never loads a model or real user store.
import {startServer} from '../server/main.mjs';
import {createMockInference} from '../server/inference-mock.mjs';
import {processTreeRss} from '../server/runtime-memory.mjs';
import {startCandidateWorker,candidateSourceHashes} from './run-privacy-detector.mjs';
import {chromium} from '@playwright/test';
import {mkdtemp,writeFile,readFile,readdir,access,stat,mkdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {parseArgs} from 'node:util';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import os from 'node:os';import path from 'node:path';

export function measurementInput(length) {
  const scope={workspaceId:'BENCH_FIRM',matterId:'BENCH_MATTER',threadId:'BENCH_THREAD'};
  const prefix='Datos sintéticos: correo prueba@example.invalid; RFC DEMO990101ZZ0. ';
  return {scope,segments:[{id:'TEXT',path:'content',text:(prefix+'Texto de control público sin datos reales. '.repeat(200)).slice(0,length),originScope:{...scope},classification:'synthetic'}]};
}
const quantile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.max(0,Math.ceil(values.length*p)-1)]??null;
async function treeHash(directory){
  const hash=createHash('sha256');
  async function visit(relative=''){
    for(const entry of (await readdir(path.join(directory,relative),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))){
      const name=path.join(relative,entry.name);if(entry.isDirectory())await visit(name);else if(entry.isFile()){hash.update(name);hash.update('\0');hash.update(await readFile(path.join(directory,name)));hash.update('\0');}
    }
  }
  await visit();return hash.digest('hex');
}

export async function main(args=process.argv.slice(2)){
  const {values}=parseArgs({args,options:{mode:{type:'string'},output:{type:'string'}}});
  if(!['baseline','candidate'].includes(values.mode)||!values.output)throw Error('mode_and_output_required');
  const root=fileURLToPath(new URL('../',import.meta.url));
  const dir=await mkdtemp(path.join(os.tmpdir(),'lex-detector-bench-'));
  const report={version:1,mode:values.mode,synthetic:true,measuredAt:new Date().toISOString(),node:process.version,
    platform:os.platform(),arch:os.arch(),hostMemoryBytes:os.totalmem(),
    runtime:path.resolve(process.execPath)===path.resolve(root,'.desktop/app/runtime/node')?'packaged-node':'other-node',
    ui:'headless Chromium, not native Tauri/WKWebView',inference:'mock; no model initialization/download',
    workload:{matters:4,documents:20,charactersPerDocument:5000,detectorEnvelopeLengthsUtf16:[256,2048,6800],coldProcessStarts:3,warmSamples:30,concurrency:1},
    cold:[],samples:[],limitations:['one matched synthetic workload, not representative of legal traffic','cold means fresh process, not OS cache purge','RSS sampling may miss peaks and double-count shared pages','no semantic entity/context model or real inference','24 GiB does not validate a physical 8 GB machine; native Tauri pending']};
  let app,browser,worker;
  try{
    report.sourceRevision=execFileSync('/usr/bin/git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
    report.candidateSourceHashes=await candidateSourceHashes();
    report.serverSourcesSha256=await treeHash(path.join(root,'server'));
    report.builtAssetsSha256=await treeHash(path.join(root,'dist'));
    report.measurementScriptSha256=createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex');
    if(values.mode==='candidate')for(let i=0;i<3;i++){
      const start=performance.now(),cold=startCandidateWorker();
      try{const result=await cold.request([measurementInput(6800)]);report.cold.push({startupAndDetectionMs:performance.now()-start,peakRssBytes:result.peakRssBytes,status:result.results[0].status});}finally{await cold.close();}
    }
    app=await startServer({dataDir:dir,inference:createMockInference(),autoInitialize:false,libraryPath:path.join(dir,'absent-public.sqlite')});
    await app.service.dispatch('workspace.create',{name:'Despacho sintético benchmark',practiceAreas:['penal']});
    for(let m=0;m<4;m++){
      const matter=await app.service.dispatch('matter.create',{title:`Asunto sintético ${m}`,client:`Parte ficticia ${m}`,jurisdiction:'MX-FED'});
      for(let d=0;d<5;d++)await app.service.dispatch('document.import',{matterId:matter.id,name:`synthetic-${m}-${d}.txt`,base64:Buffer.from('Texto sintético para medir extracción e índice local, sin información real. '.repeat(100).slice(0,5000)).toString('base64')});
    }
    let channel;try{await access(chromium.executablePath());}catch{channel='chrome';}
    browser=await chromium.launch({headless:true,...(channel?{channel}:{}),args:['--disable-background-networking']});
    report.browserVersion=browser.version();
    const context=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'reduce'}),page=await context.newPage();
    await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
    await page.goto(`${app.connection.url}/#token=${app.connection.token}`,{waitUntil:'networkidle'});
    await page.getByRole('heading',{name:'Asistente',exact:true}).waitFor({timeout:15000});
    if(values.mode==='candidate'){worker=startCandidateWorker();await worker.request([measurementInput(256)]);}
    for(let i=0;i<30;i++){
      const length=report.workload.detectorEnvelopeLengthsUtf16[i%3],sample={lengthUtf16:length};
      if(worker){
        const start=performance.now(),result=await worker.request([measurementInput(length)]);
        sample.roundTripMs=performance.now()-start;sample.detectorMs=result.latenciesMs[0];sample.detectorPeakRssBytes=result.peakRssBytes;sample.status=result.results[0].status;
      }
      sample.treeRssBytes=await processTreeRss(process.pid);report.samples.push(sample);
      await page.waitForTimeout(100);
    }
    report.sqliteBytes=(await stat(path.join(dir,'lex.sqlite'))).size;
    report.peakObservedRssBytes=Math.max(...report.samples.map(sample=>sample.treeRssBytes));
    if(worker){
      report.detectorPeakRssBytes=Math.max(...report.samples.map(sample=>sample.detectorPeakRssBytes),...report.cold.map(sample=>sample.peakRssBytes));
      report.detectorLatencyMs={p50:quantile(report.samples.map(s=>s.detectorMs),.5),p95:quantile(report.samples.map(s=>s.detectorMs),.95)};
      report.byInputLength=Object.fromEntries([256,2048,6800].map(length=>{const samples=report.samples.filter(s=>s.lengthUtf16===length);return [length,{n:samples.length,p50:quantile(samples.map(s=>s.detectorMs),.5),p95:quantile(samples.map(s=>s.detectorMs),.95)}];}));
    }
    report.status='measured-not-product-validated';
  }catch(error){report.status='failed';report.errorCategory=error.name;process.exitCode=1;}
  finally{
    const cleanup=await Promise.allSettled([worker?.close(),browser?.close(),app?.close()]);
    report.cleanup={workerClosed:cleanup[0].status==='fulfilled',browserClosed:cleanup[1].status==='fulfilled',serverClosed:cleanup[2].status==='fulfilled',ownTemporaryDirectoryRemoved:false};
    try{await rm(dir,{recursive:true,force:true});report.cleanup.ownTemporaryDirectoryRemoved=true;}catch{report.status='failed';process.exitCode=1;}
    if(cleanup.some(result=>result.status==='rejected')){report.status='failed';process.exitCode=1;}
    const output=path.resolve(values.output);await mkdir(path.dirname(output),{recursive:true});
    await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({status:report.status,mode:report.mode,samples:report.samples.length,peakObservedRssBytes:report.peakObservedRssBytes,detectorLatencyMs:report.detectorLatencyMs}));
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
