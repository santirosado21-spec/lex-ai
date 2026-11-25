// Dedicated private entry. Never used by server/main.mjs or the default desktop.
import {pathToFileURL} from 'node:url';
import {realpath} from 'node:fs/promises';import path from 'node:path';
import {runNativePilotPipe} from './native-pilot-pipe.mjs';
export async function nativePilotEntry({input=process.stdin,output=process.stdout,root,exercise,readSecret}={}){
 if(input.isTTY||output.isTTY||!path.isAbsolute(root)||await realpath(root)!==root)throw Error('invalid');
 return runNativePilotPipe({input,output,root,exercise,...(readSecret?{readSecret}:{})});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length!==4)throw Error('invalid');
  const result=await nativePilotEntry({root:process.argv[2],exercise:process.argv[3]});
  if(result.failed||!result.closed)process.exitCode=1;
 }catch{process.stderr.write('No se pudo iniciar la sesión nativa privada.\n');process.exitCode=1;}
}
