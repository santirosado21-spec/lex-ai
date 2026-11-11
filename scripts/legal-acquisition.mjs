#!/usr/bin/env node
// Developer/server command only; importing this module does not acquire documents.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildAcquisitionPlan} from '../server/corpus/source-registry.mjs';
import {runPublicAcquisition} from '../server/corpus/acquisition.mjs';

const workspace=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const artifactRoot=path.join(workspace,'artifacts','public-corpus');

export async function main(args=process.argv.slice(2)){
  let registryFile=path.join(workspace,'resources','legal-acquisition-pilot.json');
  let outputDir=path.join(artifactRoot,'pilot');let mode='plan';let documentIds;
  for(let i=0;i<args.length;i++){
    const arg=args[i];
    if(['--plan','--live','--offline'].includes(arg)){if(mode!=='plan'&&mode!==arg.slice(2))throw new Error('Choose one mode');mode=arg.slice(2);}
    else if(['--registry','--out','--documents'].includes(arg)){
      const value=args[++i];if(!value||value.startsWith('--'))throw new Error('Missing option value');
      if(arg==='--registry')registryFile=path.resolve(value);
      else if(arg==='--out'){if(value.split(/[\\/]/).includes('..'))throw new Error('Output traversal refused');outputDir=path.resolve(value);}
      else documentIds=value.split(',');
    }else if(arg==='--help'){
      process.stdout.write('Usage: node scripts/legal-acquisition.mjs [--plan|--live|--offline] [--registry FILE] [--documents id,id] [--out DIR]\nDefault: print an offline plan. --live explicitly enables bounded public requests. --offline reprocesses this worker\'s captured snapshots. Output must be under artifacts/public-corpus. No product route, publication or training export.\n');return null;
    }else throw new Error('Unknown option');
  }
  if(outputDir!==artifactRoot&&!outputDir.startsWith(artifactRoot+path.sep))throw new Error('Output must be under artifacts/public-corpus');
  const registry=JSON.parse(await readFile(registryFile,'utf8'));const plan=buildAcquisitionPlan(registry,{documentIds});
  if(mode==='plan'){process.stdout.write(JSON.stringify(plan,null,2)+'\n');return plan;}
  const controller=new AbortController();const cancel=()=>controller.abort();process.once('SIGINT',cancel);process.once('SIGTERM',cancel);
  try{const report=await runPublicAcquisition({plan,outputDir,mode,signal:controller.signal});process.stdout.write(JSON.stringify(report,null,2)+'\n');if(report.state!=='complete')process.exitCode=1;return report;}
  finally{process.removeListener('SIGINT',cancel);process.removeListener('SIGTERM',cancel);}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(error=>{process.stderr.write(JSON.stringify({state:'failed',errorCategory:['unsafe-output','integrity-error','source-drift','locked'].includes(error.code)?error.code:'invalid-or-failed-acquisition'})+'\n');process.exitCode=1;});
}
