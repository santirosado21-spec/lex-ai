// Opt-in preparation for a native caller. Not imported by either production entry.
// Passphrase ownership transfers to unlock: supplied Buffers are zeroed on every path.
import path from 'node:path';
import {lstat,mkdir,realpath} from 'node:fs/promises';
import {startServer} from './main.mjs';
import {PILOT_VAULT_FILE} from './privacy/pilot-record-vault.mjs';

const fail=code=>Object.assign(new Error('No se pudo completar la sesión local cifrada.'),{code});
async function ordinaryDirectory(directory){
 if(await realpath(directory)!==directory)throw fail('unsafe_directory');
 if(!(await lstat(directory)).isDirectory())throw fail('unsafe_directory');
}
async function exists(file){try{await lstat(file);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
export function createNativePilotSession({root,exercise}={}){
 if(typeof root!=='string'||!path.isAbsolute(root)||path.resolve(root)!==root||typeof exercise!=='string'||!/^[a-z0-9][a-z0-9-]{0,47}$/.test(exercise))throw fail('invalid_scope');
 const base=path.join(root,'native-pilot-v1'),dataDir=path.join(base,exercise);
 let state='locked',app=null;
 const status=()=>({state,mode:'encrypted-intake',cloudEnabled:false,autoInitialize:false});
 return Object.freeze({
  status,
  async unlock({passphrase,confirmation}={}){
   let ownsTransition=false;
   try{
    if(state!=='locked')throw fail('invalid_state');
    state='unlocking';ownsTransition=true;
    if(!Buffer.isBuffer(passphrase)||passphrase.length<12||passphrase.length>1024||confirmation!==undefined&&!Buffer.isBuffer(confirmation))throw fail('invalid_secret');
    await ordinaryDirectory(root);
    for(const directory of [base,dataDir]){
     try{await mkdir(directory,{mode:0o700});}catch(e){if(e.code!=='EEXIST')throw e;}
     await ordinaryDirectory(directory);
    }
    // Never invoke the existing vault's automatic plaintext migration here.
    if(await exists(path.join(dataDir,'lex.sqlite')))throw fail('legacy_store_refused');
    const vault=path.join(dataDir,PILOT_VAULT_FILE),existing=await exists(vault);
    if(existing){const file=await lstat(vault);if(!file.isFile()||file.nlink!==1)throw fail('unsafe_directory');}
    if(!existing&&(!Buffer.isBuffer(confirmation)||!passphrase.equals(confirmation)))throw fail('confirmation_required');
    if(existing&&confirmation!==undefined)throw fail('unexpected_confirmation');
    const noGeneration=async()=>{throw fail('generation_disabled');};
    app=await startServer({dataDir,intakePilot:true,nativePilotPreparation:true,pilotPassphrase:passphrase,autoInitialize:false,
     intakeGenerate:noGeneration,
     inference:{status:async()=>({state:'stopped',nativePilot:true}),initialize:noGeneration,stop:async()=>{},async *generate(){throw fail('generation_disabled');}}});
    state='unlocked';
    return {connection:{...app.connection},viewHash:'pilot=intake',...status()};
   }catch(e){if(ownsTransition&&state==='unlocking')state='locked';throw fail(e?.code&&['invalid_state','invalid_secret','unsafe_directory','legacy_store_refused','confirmation_required','unexpected_confirmation'].includes(e.code)?e.code:'unlock_failed');}
   finally{if(Buffer.isBuffer(passphrase))passphrase.fill(0);if(Buffer.isBuffer(confirmation))confirmation.fill(0);}
  },
  async lock(){
   if(state==='locked')return status();
   if(state!=='unlocked')throw fail('invalid_state');
   state='locking';
   try{await app.close();app=null;state='locked';return status();}
   catch{state='failed';throw fail('close_failed');}
  },
  async dispose(){
   if(state==='disposed')return status();
   if(state==='locked'){state='disposed';return status();}
   if(state!=='unlocked')throw fail('invalid_state');
   state='locking';
   try{await app.close();app=null;state='disposed';return status();}
   catch{state='failed';throw fail('close_failed');}
  },
 });
}
