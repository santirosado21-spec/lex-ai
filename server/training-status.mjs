import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {defaultMonitorDir} from './public-monitor.mjs';
export async function trainingStatus({monitorDir=defaultMonitorDir(),now=Date.now()}={}){
 const file=path.join(monitorDir,'training.json');
 try{
  if((await stat(file)).size>1024*1024)throw Error('Registro de entrenamiento demasiado grande.');
  const data=JSON.parse(await readFile(file,'utf8'));
  if(!data||typeof data.state!=='string'||typeof data.releaseStatus!=='string')throw Error('Registro de entrenamiento inválido.');
  return {...data,stale:!['completed','failed','not_started'].includes(data.state)&&(!data.updatedAt||now-Date.parse(data.updatedAt)>300_000)};
 }catch(e){if(e.code==='ENOENT')return {state:'not_started',releaseStatus:'not-trained'};throw e;}
}
