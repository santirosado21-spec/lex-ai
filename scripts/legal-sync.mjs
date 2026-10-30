import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {runLegalSync} from '../server/legal-sync.mjs';
export {runLegalSync} from '../server/legal-sync.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function syncOnce(options={}){
  const catalog=JSON.parse(await readFile(path.join(root,'resources/legal-sources.json'),'utf8'));
  return runLegalSync({sources:catalog.sources,outputDir:path.join(root,'artifacts/legal-sync'),...options});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.slice(2).some(a=>a!=='--once')){console.error(JSON.stringify({state:'failed',error:'Uso: node scripts/legal-sync.mjs --once'}));process.exitCode=2;}
  else{const controller=new AbortController();process.once('SIGINT',()=>controller.abort());process.once('SIGTERM',()=>controller.abort());try{const status=await syncOnce({signal:controller.signal});console.log(JSON.stringify(status));if(status.state==='failed')process.exitCode=1;}catch(e){console.error(JSON.stringify({state:'failed',error:e.message}));process.exitCode=1;}}
}
