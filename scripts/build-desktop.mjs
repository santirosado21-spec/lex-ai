import {spawnSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {prepareDesktop} from './prepare-desktop.mjs';
import {targetFromEnvironment,desktopPlan,requireBuildHost,targetTauriConfig} from '../server/desktop-target.mjs';
try{
 const plan=desktopPlan(targetFromEnvironment().id);requireBuildHost(plan);
 const run=(command,args,extra={})=>{const result=spawnSync(command,args,{stdio:'inherit',env:{...process.env,CARGO_NET_OFFLINE:'true'},...extra});if(result.status!==0)throw Error(`${command} falló; no se descargan herramientas ni dependencias.`);return result;};
 // Check tools/installed target before staging changes. Actual cargo builds also
 // stay offline; no rustup target add, npx acquisition or CI purchase is implied.
 run('cargo',['--version']);
 const targets=run('rustup',['target','list','--installed'],{stdio:'pipe',encoding:'utf8',timeout:10000,maxBuffer:65536});
 if(!targets.stdout.trim().split(/\s+/).includes(plan.rustTarget))throw Error(`Falta target Rust instalado: ${plan.rustTarget}.`);
 const cli=path.resolve('node_modules/@tauri-apps/cli/tauri.js');run(process.execPath,[cli,'--version']);
 await prepareDesktop();
 await writeFile(plan.config,JSON.stringify(targetTauriConfig(plan),null,2)+'\n');
 // The base resources map is empty: JSON Merge Patch otherwise retains stale
 // keys. Only the selected target-specific payload enters this build.
 run('npm',['run','build']);
 run(process.execPath,[cli,'build','--target',plan.rustTarget,'--config',plan.config,'--bundles','app']);
}catch(e){console.error(e.message);process.exitCode=1;}
