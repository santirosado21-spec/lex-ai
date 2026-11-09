// Developer-only synthetic baseline. No model loads, inference, remote API or user data.
import {startServer} from '../server/main.mjs';
import {createMockInference} from '../server/inference-mock.mjs';
import {processTreeRss} from '../server/runtime-memory.mjs';
import {chromium} from '@playwright/test';
import {mkdtemp,writeFile,readFile,readdir,access,stat,mkdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {parseArgs} from 'node:util';
import {fileURLToPath} from 'node:url';
import os from 'node:os';import path from 'node:path';

const {values}=parseArgs({options:{output:{type:'string',default:'artifacts/privacy/baseline.json'}}});
const root=fileURLToPath(new URL('../',import.meta.url));
const dir=await mkdtemp(path.join(os.tmpdir(),'lex-privacy-baseline-'));
const report={version:1,synthetic:true,measuredAt:new Date().toISOString(),node:process.version,
 platform:os.platform(),arch:os.arch(),hostMemoryBytes:os.totalmem(),
 runtime:{executableKind:path.resolve(process.execPath)===path.resolve(root,'.desktop/app/runtime/node')?'packaged-node':'other-node',sources:'current checkout'},
 ui:'headless Chromium, current built assets; NOT native Tauri/WKWebView',
 detector:'absent',inference:'mock; no initialization/download/model load',
 workload:{matters:4,documents:20,charactersPerDocument:5000},samples:[],
 limitations:['one synthetic run on stated hardware','RSS samples may miss transient peaks and double-count shared pages','no detector or real inference','native Tauri overhead not measured','does not validate a physical 8 GB computer']};
async function treeHash(directory,include=()=>true){
 const hash=createHash('sha256');
 async function visit(relative=''){
  const entries=(await readdir(path.join(directory,relative),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'));
  for(const entry of entries){const name=path.join(relative,entry.name);if(entry.isDirectory())await visit(name);else if(entry.isFile()&&include(name)){hash.update(name);hash.update('\0');hash.update(await readFile(path.join(directory,name)));hash.update('\0');}}
 }
 await visit();return hash.digest('hex');
}
let app,browser;
try{
 report.sourceRevision=execFileSync('/usr/bin/git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 report.serverSourcesSha256=await treeHash(path.join(root,'server'),name=>name.endsWith('.mjs'));
 report.builtAssetsSha256=await treeHash(path.join(root,'dist'));
 report.measurementScriptSha256=createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex');
 app=await startServer({dataDir:dir,inference:createMockInference(),autoInitialize:false,libraryPath:path.join(dir,'absent-public.sqlite')});
 report.samples.push({phase:'backend-idle',treeRssBytes:await processTreeRss(process.pid)});
 await app.service.dispatch('workspace.create',{name:'Despacho sintético benchmark',practiceAreas:['penal']});
 for(let m=0;m<4;m++){
  const matter=await app.service.dispatch('matter.create',{title:`Asunto sintético ${m}`,client:`Parte ficticia ${m}`,jurisdiction:'MX-FED'});
  for(let d=0;d<5;d++)await app.service.dispatch('document.import',{matterId:matter.id,name:`synthetic-${m}-${d}.txt`,base64:Buffer.from('Texto sintético para medir extracción e índice local, sin información real. '.repeat(100).slice(0,5000)).toString('base64')});
 }
 report.samples.push({phase:'backend-indexed',treeRssBytes:await processTreeRss(process.pid)});
 let channel;try{await access(chromium.executablePath());}catch{channel='chrome';}
 browser=await chromium.launch({headless:true,...(channel?{channel}:{}),args:['--disable-background-networking']});
 report.browserVersion=browser.version();
 const context=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'reduce'});
 const page=await context.newPage();
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.goto(`${app.connection.url}/#token=${app.connection.token}`,{waitUntil:'networkidle'});
 await page.getByRole('heading',{name:'Asistente',exact:true}).waitFor({timeout:15000});
 for(let i=0;i<30;i++){
  report.samples.push({phase:'backend-plus-web-ui',treeRssBytes:await processTreeRss(process.pid)});
  await page.waitForTimeout(100);
 }
 report.sqliteBytes=(await stat(path.join(dir,'lex.sqlite'))).size;
 report.peakObservedRssBytes=Math.max(...report.samples.map(sample=>sample.treeRssBytes));
 report.status='measured-baseline-only';
}catch(error){report.status='failed';report.errorCategory=error.name;process.exitCode=1;}
finally{
 await browser?.close();await app?.close();await rm(dir,{recursive:true,force:true});
 const output=path.resolve(values.output);await mkdir(path.dirname(output),{recursive:true});
 await writeFile(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:report.status,samples:report.samples.length,peakObservedRssBytes:report.peakObservedRssBytes,output:values.output}));
}
