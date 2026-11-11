import {spawn} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {readFile,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {fixtureCode,validateTree} from './windows-owned-tree-smoke.mjs';
import {windowsPowerShellPath} from '../server/windows-process-memory.mjs';
export const PROTOCOL='windows-descendant-classification-diagnostic-v1';
export const CLASSIFICATION_COMMAND=String.raw`$ErrorActionPreference='Stop'; try {
 $culture=[Globalization.CultureInfo]::InvariantCulture;
 $line=[Console]::ReadLine(); if ($null -eq $line -or $line.Length -gt 65 -or $line -notmatch '\A[1-9][0-9]{0,9},[1-9][0-9]{0,9};[1-9][0-9]{0,9},[1-9][0-9]{0,9};[1-9][0-9]{0,9},[1-9][0-9]{0,9}\z') { throw 'input' };
 $parts=$line.Split(';'); $owned=[Collections.Generic.List[uint32]]::new(); $parents=[Collections.Generic.List[uint32]]::new();
 foreach ($part in $parts) { $values=$part.Split(','); [uint32]$p=0; [uint32]$pp=0; if (-not [uint32]::TryParse($values[0],[Globalization.NumberStyles]::None,$culture,[ref]$p) -or -not [uint32]::TryParse($values[1],[Globalization.NumberStyles]::None,$culture,[ref]$pp) -or $p -eq 0 -or $pp -eq 0 -or $p -eq $PID -or $owned.Contains($p)) { throw 'input' }; $owned.Add($p); $parents.Add($pp) };
 if ($parents[1] -ne $owned[0] -or $parents[2] -ne $owned[1] -or $owned.Contains($parents[0])) { throw 'input' };
 $system=[Environment]::SystemDirectory; if (-not [IO.Path]::IsPathRooted($system)) { throw 'system' };
 $expectedA=[IO.Path]::Combine($system,'conhost.exe'); $expectedB=[IO.Path]::Combine($system,'OpenConsole.exe');
 $searcher=$null; $results=$null; $rows=@{}; $count=0;
 try {
  $searcher=[wmisearcher]::new('root\cimv2','SELECT ProcessId,ParentProcessId,WorkingSetSize,ExecutablePath FROM Win32_Process'); $results=$searcher.Get();
  foreach ($item in $results) { try {
   $count++; if ($count -gt 4096) { throw 'count' };
   $p=$item.GetPropertyValue('ProcessId'); $pp=$item.GetPropertyValue('ParentProcessId'); $rss=$item.GetPropertyValue('WorkingSetSize'); $exe=$item.GetPropertyValue('ExecutablePath');
   if ($p -isnot [uint32] -or $pp -isnot [uint32] -or $rss -isnot [uint64] -or $rss -gt 9007199254740991 -or ($null -ne $exe -and ($exe -isnot [string] -or $exe.Length -gt 32768)) -or $rows.ContainsKey($p) -or ($p -eq $pp -and $p -ne 0)) { throw 'row' };
   $rows.Add($p,@($pp,$rss,$exe));
  } finally { $item.Dispose() } }
 } finally { try { if ($null -ne $results) { $results.Dispose() } } finally { if ($null -ne $searcher) { $searcher.Dispose() } } };
 if ($count -eq 0) { throw 'count' };
 $tree=[Collections.Generic.HashSet[uint32]]::new(); [void]$tree.Add($owned[0]); $changed=$true;
 while ($changed) { $changed=$false; foreach ($p in $rows.Keys) { if ($tree.Contains($rows[$p][0]) -and -not $tree.Contains($p)) { [void]$tree.Add($p); $changed=$true } } };
 $presence=0; $parentMatch=0; $positive=0;
 for ($i=0;$i -lt 3;$i++) { if ($rows.ContainsKey($owned[$i])) { $presence=$presence -bor (1 -shl $i); if ($rows[$owned[$i]][0] -eq $parents[$i]) { $parentMatch=$parentMatch -bor (1 -shl $i) }; if ($rows[$owned[$i]][1] -gt 0) { $positive=$positive -bor (1 -shl $i) } } };
 $extra=0; $a=0; $b=0; $unknown=0; $ownedClosure=0; foreach ($p in $owned) { if ($tree.Contains($p)) { $ownedClosure++ } };
 foreach ($p in $tree) { if (-not $owned.Contains($p)) { $extra++; $exe=$rows[$p][2]; if ([string]::Equals($exe,$expectedA,[StringComparison]::OrdinalIgnoreCase)) { $a++ } elseif ([string]::Equals($exe,$expectedB,[StringComparison]::OrdinalIgnoreCase)) { $b++ } else { $unknown++ } } };
 $collectorExcluded=1; if ($tree.Contains([uint32]$PID)) { $collectorExcluded=0 }; $outsideExcluded=1; if ($tree.Contains($parents[0])) { $outsideExcluded=0 };
 [Console]::WriteLine(('CLASS1:'+ $presence.ToString($culture)+':'+$parentMatch.ToString($culture)+':'+$positive.ToString($culture)+':'+$tree.Count.ToString($culture)+':'+$extra.ToString($culture)+':'+$a.ToString($culture)+':'+$b.ToString($culture)+':'+$unknown.ToString($culture)+':'+$collectorExcluded.ToString($culture)+':'+$outsideExcluded.ToString($culture)+':'+$ownedClosure.ToString($culture)))
} catch { exit 22 }`;
export function parseClassificationFrame(frame){
 if(typeof frame!=='string'||frame.length>256||!/^CLASS1:(?:0|[1-9][0-9]{0,3})(?::(?:0|[1-9][0-9]{0,3})){10}$/.test(frame))throw Error('FRAME');
 const [presence,parent,positive,closure,extra,a,b,unknown,collector,outside,ownedClosure]=frame.slice(7).split(':').map(Number);
 if(presence>7||parent>7||positive>7||closure<1||closure>4096||extra>4096||a+b+unknown!==extra||closure!==extra+ownedClosure||ownedClosure>3||ownedClosure>((presence&1?1:0)+(presence&2?1:0)+(presence&4?1:0))||collector>1||outside>1||(parent&presence)!==parent||(positive&presence)!==positive)throw Error('FRAME');
 return {roles:['root','child','grandchild'].map((role,i)=>({role,present:Boolean(presence&(1<<i)),parentMatches:Boolean(parent&(1<<i)),rssPositive:Boolean(positive&(1<<i))})),closureCount:closure,ownedClosureCount:ownedClosure,extraCount:extra,classificationCounts:{systemConsoleHost:a,systemOpenConsole:b,unknown},collectorExcluded:Boolean(collector),outsideExcluded:Boolean(outside)};
}
function observeClose(child){
 let closed=false,code=null,signal=null,waiters=[];
 child.on('close',(exitCode,exitSignal)=>{if(closed)return;closed=true;code=exitCode;signal=exitSignal;for(const notify of [...waiters])notify();});
 return {get closed(){return closed;},async wait(ms){
  if(closed)return {observed:true,zero:code===0&&!signal};
  const started=performance.now();return new Promise(resolve=>{let timer;const done=()=>{clearTimeout(timer);waiters=waiters.filter(fn=>fn!==done);resolve({observed:closed,zero:closed&&code===0&&!signal&&performance.now()-started<ms});};timer=setTimeout(()=>{waiters=waiters.filter(fn=>fn!==done);resolve({observed:false,zero:false});},ms);waiters.push(done);});
 }};
}
export async function runClassificationDiagnostic({platform=process.platform,arch=process.arch,systemRoot=process.env.SystemRoot,spawnFixture=spawn,spawnCollector=spawn}={}){
 const report={protocol:PROTOCOL,status:'DIAGNOSTIC_INCOMPLETE',diagnosticOnly:true,performanceValidated:false,classificationAllowsExtras:false,physical8GBValidated:false,extraCleanupObserved:null,cleanupScope:'collector-and-three-known-node-roles-only'};let fixture,collector,intentional=false,unexpected=false,metadata,collectorError=false,collectorClose;
 try{
 if(platform!=='win32'||arch!=='x64')throw Error();const shell=windowsPowerShellPath(systemRoot);
 fixture=spawnFixture(process.execPath,['--input-type=commonjs','-e',fixtureCode(),'0'],{env:{SystemRoot:systemRoot,WINDIR:systemRoot},shell:false,windowsHide:true,stdio:['ignore','ignore','ignore','ipc']});fixture.on('error',()=>{unexpected=true});fixture.on('exit',()=>{if(!intentional)unexpected=true});
 const rows=await new Promise((resolve,reject)=>{const start=performance.now(),t=setTimeout(()=>finish(),5000);const finish=value=>{clearTimeout(t);fixture.off('message',ready);fixture.off('error',failed);fixture.off('exit',failed);value?resolve(value):reject(Error())};const failed=()=>finish();const ready=m=>{try{if(performance.now()-start>=5000||m?.kind!=='ready')throw Error();finish(validateTree(m.rows,fixture.pid,process.pid))}catch{finish()}};fixture.on('message',ready);fixture.once('error',failed);fixture.once('exit',failed)});
 const started=performance.now();
 collector=spawnCollector(shell,['-NoLogo','-NoProfile','-NonInteractive','-Command',CLASSIFICATION_COMMAND],{env:{SystemRoot:systemRoot,WINDIR:systemRoot},shell:false,windowsHide:true,stdio:['pipe','pipe','ignore']});collectorClose=observeClose(collector);collector.on('error',()=>{collectorError=true});collector.stdout.on('error',()=>{collectorError=true});
 const frame=await new Promise((resolve,reject)=>{let wire=Buffer.alloc(0),settled=false;const finish=value=>{if(settled)return;settled=true;clearTimeout(t);value?resolve(value):reject(Error())};const t=setTimeout(()=>finish(),Math.max(0,10000-(performance.now()-started)));collector.stdout.on('data',chunk=>{if(settled){report.extraOutput=true;return;}if(performance.now()-started>=10000||!Buffer.isBuffer(chunk)||chunk.some(b=>b>127)||wire.length+chunk.length>256)return finish();wire=Buffer.concat([wire,chunk]);const end=wire.indexOf(10);if(end>=0){if(end!==wire.length-1)return finish();try{const value=parseClassificationFrame(wire.subarray(0,end).toString('ascii').replace(/\r$/,''));if(performance.now()-started>=10000)return finish();finish(value)}catch{finish()}}});collector.once('error',()=>finish());collector.once('close',()=>{if(!settled)finish()});collector.stdin.on('error',()=>{collectorError=true;finish()});collector.stdin.end(rows.map(r=>`${r.pid},${r.ppid}`).join(';')+'\n');});
 metadata=frame;report.bootstrapElapsedMs=performance.now()-started;
 if(unexpected||fixture.exitCode!==null||fixture.signalCode||!fixture.connected)throw Error();Object.assign(report,metadata);
 }catch{report.errorCategory='PROTOCOL_OR_BOOTSTRAP_FAILURE';}
 finally{
 if(collector){const closed=await collectorClose.wait(3000);report.collectorCleanup={closeObserved:closed.observed,exitObservedZero:closed.zero,forced:false};if(!closed.observed){try{collector.kill()}catch{}report.collectorCleanup.forced=true;const after=await collectorClose.wait(3000);report.collectorCleanup.closeObservedAfterForce=after.observed;}}
 if(fixture){intentional=!unexpected&&fixture.exitCode===null&&!fixture.signalCode&&fixture.connected;let roles=false;const clean=await new Promise(resolve=>{const started=performance.now(),t=setTimeout(()=>resolve(false),3500);fixture.on('message',m=>{if(m?.kind==='reaped'&&Array.isArray(m.roles)&&m.roles.join(',')==='2,1')roles=true});fixture.once('exit',(code,signal)=>{clearTimeout(t);resolve(roles&&code===0&&!signal&&performance.now()-started<3500)});try{if(fixture.connected)fixture.send('stop');else{clearTimeout(t);resolve(false)}}catch{clearTimeout(t);resolve(false)}});report.fixtureCleanup={allThreeGracefullyReaped:clean&&intentional&&!unexpected,forced:false};if(!clean){try{fixture.kill()}catch{}report.fixtureCleanup.forced=true;}}
 }
 if(metadata&&!collectorError&&!report.errorCategory&&!report.extraOutput&&report.collectorCleanup?.closeObserved&&report.collectorCleanup.exitObservedZero&&!report.collectorCleanup.forced&&report.fixtureCleanup?.allThreeGracefullyReaped&&!report.fixtureCleanup.forced){report.status='DIAGNOSTIC_COMPLETE';}
 report.finalStreamValidated=Boolean(collectorClose?.closed&&!collectorError&&!report.extraOutput&&metadata);
 return structuredClone(report);
}
const OWN=['scripts/windows-descendant-classification-diagnostic.mjs','tests/windows-descendant-classification-diagnostic.test.mjs','resources/windows-descendant-classification-diagnostic-v1.json','docs/architecture/windows-descendant-classification-diagnostic-v1.md','.github/workflows/windows-descendant-classification-diagnostic.yml','scripts/windows-owned-tree-smoke.mjs','server/windows-process-memory.mjs','server/windows-memory-monitor-v2.mjs'];
export async function verifyFreeze(freeze){if(freeze?.scope!==PROTOCOL||freeze.approvedForSingleDiagnosticRun!==true||Object.keys(freeze.sourceHashes??{}).sort().join('|')!==[...OWN].sort().join('|'))throw Error();for(const p of OWN){const st=await lstat(p);if(st.isSymbolicLink()||!st.isFile()||st.size>1048576||createHash('sha256').update(await readFile(p)).digest('hex')!==freeze.sourceHashes[p])throw Error();}}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const args=process.argv.slice(2);if(!args.length)console.log(JSON.stringify({protocol:PROTOCOL,status:'PLAN',execution:false}));else if(args.length===1&&args[0]==='--run'&&process.platform==='win32'){try{const freeze=JSON.parse(await readFile('docs/qa/windows-descendant-classification-diagnostic-freeze-2026-11-10.json','utf8'));await verifyFreeze(freeze);const report=await runClassificationDiagnostic();await verifyFreeze(freeze);console.log(JSON.stringify(report));if(report.status!=='DIAGNOSTIC_COMPLETE')process.exitCode=1;}catch{console.log(JSON.stringify({protocol:PROTOCOL,status:'DIAGNOSTIC_INCOMPLETE',errorCategory:'PREFLIGHT_OR_POSTFLIGHT'}));process.exitCode=1;}}else{console.log(JSON.stringify({protocol:PROTOCOL,status:'DIAGNOSTIC_INCOMPLETE',errorCategory:'ARGUMENT_OR_PLATFORM'}));process.exitCode=1;}}
