import {execFile} from 'node:child_process';
import {access,stat} from 'node:fs/promises';
import {PILOT_VAULT_FILE} from '../server/privacy/pilot-record-vault.mjs';
import {homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline/promises';
import {hiddenInput} from './entrada-oculta.mjs';
import {startServer} from '../server/main.mjs';
import {createIntakeGenerator} from '../server/intake-pilot.mjs';
import {openPilotUsage} from '../server/providers/pilot-usage.mjs';
import {selectPilotCredential,selectTemporaryPilotCredential} from '../server/providers/pilot-credentials.mjs';

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
  if(temporary) {
   const option=(await menu.question('Cuenta temporal: 1 principal, 2 Lorenzo, 3 alternar, 4 respaldo [1]: ')).trim()||'1';
   if(!['1','2','3','4'].includes(option))throw Error('Cuenta no válida.');
   mode=({1:'primary',2:'lorenzo',3:'alternate',4:'backup'})[option];
  }
 } finally {menu.close();}
}
if(!/^[a-z0-9][a-z0-9-]{0,47}$/.test(caseName)) throw Error('Usa un código ficticio con letras minúsculas, números o guiones.');
if (!['santiago','pedro','lorenzo'].includes(profile)) throw Error('Selecciona santiago, lorenzo o pedro.');
let account='temporal';
let getApiKey=selectPilotCredential(mode,undefined,slot=>{account=slot;});
if (temporary) {
 getApiKey=await selectTemporaryPilotCredential(mode,hiddenInput,slot=>{account=slot;});
}
const dataDir=path.join(homedir(),'.rejon-piloto-comercio',profile,caseName);
async function hasFile(name) {
 try{const file=await stat(path.join(dataDir,name));return file.isFile()&&file.size>0;}
 catch(error){if(error.code==='ENOENT')return false;throw error;}
}
const hasVault=await hasFile(PILOT_VAULT_FILE);
if(await hasFile('lex.sqlite')) console.log('Este ejercicio conserva una copia anterior en claro. La primera apertura copia sus registros al archivo cifrado.');
if(!hasVault)console.log('Crea una frase exclusiva para abrir este ejercicio. Guárdala para volver a entrar.');
const passphrase=Buffer.from(await hiddenInput(hasVault?'Frase local del expediente: ':'Nueva frase local (al menos 12 caracteres): '),'utf8');
if (!hasVault) {
 const confirmation=Buffer.from(await hiddenInput('Repite la frase local: '),'utf8');
 const valid=passphrase.equals(confirmation)&&Array.from(passphrase.toString()).length>=12&&passphrase.length<=1024;
 confirmation.fill(0);
 if(!valid){passphrase.fill(0);throw Error('Las frases deben coincidir y tener al menos 12 caracteres.');}
}
const usage=await openPilotUsage(dataDir,mode);
let app;
try {
 app=await startServer({dataDir,autoInitialize:false,intakePilot:true,pilotPassphrase:passphrase,intakeGenerate:createIntakeGenerator({getApiKey,usageStatus:usage.status,onAttempt:attempt=>usage.record(account,attempt)})});
} finally {passphrase.fill(0);}
const local=new URL(app.connection.url);
local.hash=new URLSearchParams({pilot:'intake',token:app.connection.token}).toString();
const open=process.platform==='darwin'?['/usr/bin/open',[local.href]]:process.platform==='win32'?['rundll32.exe',['url.dll,FileProtocolHandler',local.href]]:['xdg-open',[local.href]];
execFile(open[0],open[1],{windowsHide:true},error=>{if(error)console.error('Abre esta dirección de sesión en el navegador de este equipo:',local.href);});
console.log('Piloto abierto en el navegador local. Perfil '+profile+'. Cierra esta terminal o pulsa Ctrl+C al terminar.');
for(const signal of ['SIGINT','SIGTERM','SIGHUP'])process.once(signal,async()=>{await app.close();process.exit(0);});
