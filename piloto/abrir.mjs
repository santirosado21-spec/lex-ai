import {execFile} from 'node:child_process';
import {access,appendFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';
import {startServer} from '../server/main.mjs';
import {createIntakeGenerator} from '../server/intake-pilot.mjs';
import {selectPilotCredential} from '../server/providers/pilot-credentials.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
process.chdir(root);
await access('dist/index.html');
const args=process.argv.slice(2);
let profile=args.find(a=>!a.startsWith('--'))??'santiago';
let mode=args.find(a=>a.startsWith('--cuenta='))?.slice(9)??'primary';
let temporary=process.platform!=='darwin' || args.includes('--clave-temporal');
let caseName=args.find(a=>a.startsWith('--caso='))?.slice(7)??'primera-prueba';
if (args.includes('--elegir-perfil')) {
 const menu=createInterface({input:process.stdin,output:process.stdout});
 try {
  profile=(await menu.question('Perfil (santiago, lorenzo o pedro) [santiago]: ')).trim().toLowerCase()||'santiago';
  caseName=(await menu.question('Código local del ejercicio para abrir o retomar [primera-prueba]: ')).trim()||'primera-prueba';
  if (process.platform==='darwin') {
   const choice=(await menu.question('OpenAI: 1 Llavero principal, 2 clave temporal, 3 Llavero Lorenzo, 4 alternar, 5 respaldo [1]: ')).trim()||'1';
   if (!['1','2','3','4','5'].includes(choice)) throw Error('Cuenta no válida.');
   temporary=choice==='2';
   mode=({1:'primary',2:'primary',3:'lorenzo',4:'alternate',5:'backup'})[choice];
  }
 } finally {menu.close();}
}
if(!/^[a-z0-9][a-z0-9-]{0,47}$/.test(caseName)) throw Error('Usa un código ficticio con letras minúsculas, números o guiones.');
if (!['santiago','pedro','lorenzo'].includes(profile)) throw Error('Selecciona santiago, lorenzo o pedro.');
let account='temporal';
let getApiKey=selectPilotCredential(mode,undefined,slot=>{account=slot;});
if (temporary) {
 if(!process.stdin.isTTY) throw Error('Abre una terminal interactiva para la clave temporal.');
 if(mode!=='primary') throw Error('Las cuentas múltiples requieren el Llavero de macOS.');
 process.stdout.write('Clave de OpenAI para esta sesión (entrada oculta): ');
 const silent=new Writable({write(_chunk,_encoding,done){done();}});
 const rl=createInterface({input:process.stdin,output:silent,terminal:true,historySize:0});
 let key;
 try {key=(await rl.question('')).trim();} finally {rl.close();process.stdout.write('\n');}
 if(!/^sk-[A-Za-z0-9_-]{20,256}$/.test(key)) throw Error('Formato de clave no válido.');
 getApiKey=async()=>key;
}
const dataDir=path.join(homedir(),'.rejon-piloto-comercio',profile,caseName);
async function onReceipt(receipt) {
 if(!receipt)return;
 const record={at:new Date().toISOString(),account,model:receipt.observedModel,usage:receipt.usage};
 try {await appendFile(path.join(dataDir,'uso-openai.jsonl'),JSON.stringify(record)+'\n',{mode:0o600});}
 catch {console.error('El borrador se conserva. No se pudo guardar el recibo de uso local.');}
}
const app=await startServer({dataDir,autoInitialize:false,intakePilot:true,intakeGenerate:createIntakeGenerator({getApiKey,onReceipt})});
const local=new URL(app.connection.url);
local.hash=new URLSearchParams({pilot:'intake',token:app.connection.token}).toString();
const open=process.platform==='darwin'?['/usr/bin/open',[local.href]]:process.platform==='win32'?['rundll32.exe',['url.dll,FileProtocolHandler',local.href]]:['xdg-open',[local.href]];
execFile(open[0],open[1],{windowsHide:true},error=>{if(error)console.error('Abre esta dirección de sesión en el navegador de este equipo:',local.href);});
console.log('Piloto abierto en el navegador local. Perfil '+profile+'. Cierra esta terminal o pulsa Ctrl+C al terminar.');
for(const signal of ['SIGINT','SIGTERM','SIGHUP'])process.once(signal,async()=>{await app.close();process.exit(0);});
