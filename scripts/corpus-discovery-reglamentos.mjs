import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {discoverRegulationsLibrary} from '../server/legal-library.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);const index=args.indexOf('--from-file');
try{
  if(index>=0&&(!args[index+1]||args[index+1].startsWith('--')))throw new Error('--from-file requires a path');
  const result=await discoverRegulationsLibrary({outputDir:path.join(root,'artifacts/legal-library'),catalogPath:path.join(root,'resources/legal-library-catalog-reglamentos.json'),indexFile:index>=0?path.resolve(args[index+1]):undefined});
  console.log(JSON.stringify({state:'complete',count:result.count,rows:result.rows,kept:result.kept,excluded:result.excluded,encoding:result.encoding,indexSha256:result.indexSha256,anomalies:result.anomalies.length,importedSnapshot:result.importedSnapshot}));
}catch(e){console.error(JSON.stringify({state:'failed',error:e.message}));process.exitCode=1;}
