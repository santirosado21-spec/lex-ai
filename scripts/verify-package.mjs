import {spawn,spawnSync} from 'node:child_process';
import {readFile,mkdtemp,writeFile,mkdir} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';
const app=path.resolve(process.argv[2]||'src-tauri/target/release/bundle/macos/LEX AI.app');
const resource=path.join(app,'Contents/Resources/app');
const reportPath=path.resolve(process.argv[3]||'artifacts/cycle-3-package-check.json');
async function fileHash(file){const digest=createHash('sha256');for await(const chunk of createReadStream(file))digest.update(chunk);return digest.digest('hex');}
const report={cycle:3,checkedAt:new Date().toISOString(),app,checks:[],nativeVisualRetest:false,nativeVisualLimitation:'This verifier tests bundled services; browser UI evidence is recorded separately. It does not assert a native visual retest.',notarized:false};
let child;
try{
 const version=JSON.parse(await readFile('package.json','utf8')).version;assert.match(version,/^\d+\.\d+\.\d+$/);report.version=version;
 const bundledPackage=JSON.parse(await readFile(path.join(resource,'package.json'),'utf8'));assert.equal(bundledPackage.version,version);
 const nativeVersion=spawnSync('/usr/libexec/PlistBuddy',['-c','Print :CFBundleShortVersionString',path.join(app,'Contents/Info.plist')],{encoding:'utf8'});assert.equal(nativeVersion.status,0,nativeVersion.stderr);assert.equal(nativeVersion.stdout.trim(),version);report.checks.push(`native and bundled package versions are ${version}`);
 const nativeIcon=spawnSync('/usr/libexec/PlistBuddy',['-c','Print :CFBundleIconFile',path.join(app,'Contents/Info.plist')],{encoding:'utf8'});assert.equal(nativeIcon.status,0,'macOS bundle must declare its app icon');
 const iconName=nativeIcon.stdout.trim();assert.equal(path.basename(iconName),iconName);assert.ok(iconName);
 const iconFile=iconName.endsWith('.icns')?iconName:`${iconName}.icns`;assert.equal(await fileHash(path.join(app,'Contents/Resources',iconFile)),await fileHash('src-tauri/icons/icon.icns'),'bundled app icon must match the current LEX AI icon');report.checks.push('macOS icon declared and packaged with matching source hash');
 const signature=spawnSync('/usr/bin/codesign',['--verify','--deep','--strict',app],{encoding:'utf8'});assert.equal(signature.status,0,signature.stderr);report.checks.push('ad-hoc signature verified');
 const files=['server/main.mjs','server/inference.mjs','server/public-monitor.mjs','server/training-status.mjs','server/public-library.mjs','server/service.mjs','server/matter-tasks.mjs','server/store.mjs','server/skills.mjs','server/extraction.mjs','resources/legal-corpus.json','resources/legal-sources.json','resources/public-library.sqlite','resources/public-library.sqlite.manifest.json'];
 for(const file of files)assert.equal(await fileHash(path.join(resource,file)),await fileHash(file),file+' does not match source');
 report.hashedFiles=files;report.checks.push('packaged source monitor, training, task and library modules plus both public corpora match source hashes');
 const dataDir=await mkdtemp(path.join(os.tmpdir(),'lex-packaged-check-'));
 child=spawn(path.join(resource,'runtime/node'),[path.join(resource,'server/main.mjs')],{env:{HOME:os.homedir(),PATH:'/usr/bin:/bin',LEX_DATA_DIR:dataDir,LEX_DESKTOP:'1'},stdio:['pipe','pipe','pipe']});child.stderr.resume();
 const connection=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(Error('Bundled backend startup timeout')),30000);child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',()=>{clearTimeout(timer);reject(Error('Bundled backend exited before connection.'));});child.stdout.on('data',b=>{text+=b.toString();if(text.length>20000){clearTimeout(timer);reject(Error('Unexpected backend startup output'));}else if(text.includes('\n')){clearTimeout(timer);try{resolve(JSON.parse(text.split('\n')[0]));}catch{reject(Error('Invalid backend connection response.'));}}});});
 async function api(action,payload={}){const response=await fetch(connection.url+'/api',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${connection.token}`},body:JSON.stringify({action,payload}),signal:AbortSignal.timeout(10000)});assert.equal(response.status,200,action+' HTTP failure');return response.json();}
 const sources=await api('sources.status');assert.equal(sources.catalog.length,7);assert.equal(sources.corpus.articles,21);report.checks.push('authenticated sources.status preserves seven sources and 21 seed articles');report.monitor={state:sources.monitor?.state||null,heartbeatAt:sources.monitor?.heartbeatAt||null};
 const library=await api('library.status');assert.equal(library.available,true);assert.equal(library.articles,35452);assert.equal(library.laws.length,303);report.library={articles:library.articles,laws:library.laws.length,corpusSha256:library.corpusSha256};
 const matches=await api('library.search',{query:'validez cumplimiento contratos',lawId:'MX-FED-CCF',jurisdiction:'MX-FED',limit:10,offset:0});const article=matches.sources.find(source=>source.article==='1797'&&source.lawId==='MX-FED-CCF');assert.ok(article,'CCF 1797 not found');const full=await api('library.source',{sourceId:article.id});assert.match(full.text,/validez/i);assert.equal(full.status,'structurally-verified-currentness-unverified');report.checks.push('bundled full public library: 35,452 articles, 303 instruments, CCF1797 search and full source');
 const training=await api('training.status');assert.ok(['not_started','downloading','preparing_data','loading','baseline','training','evaluating','completed','failed'].includes(training.state),'Invalid training state');assert.ok(['not-trained','experimental','rejected','ready'].includes(training.releaseStatus),'Invalid training release state');report.training={state:training.state,releaseStatus:training.releaseStatus};report.checks.push('bundled training.status returns a valid read-only state; no model initialization or inference');report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.message;process.exitCode=1;}finally{
 if(child&&child.exitCode===null){child.stdin.end();await new Promise(resolve=>{const timer=setTimeout(()=>{child.kill('SIGKILL');resolve();},5000);child.once('exit',()=>{clearTimeout(timer);resolve();});});}
 await mkdir(path.dirname(reportPath),{recursive:true});await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
}console.log(JSON.stringify(report,null,2));
