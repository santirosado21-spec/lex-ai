// Fixed native hidden-answer prompts. Never imports frontend code or returns a string.
// Not invoked by production. A future private native helper owns stdout, not a terminal.
import {execFile} from 'node:child_process';
const scripts=Object.freeze({unlock:'text returned of (display dialog "Frase local del expediente de Rejon" default answer "" with hidden answer buttons {"Cancelar","Abrir"} default button "Abrir" with title "Rejon")',create:'text returned of (display dialog "Nueva frase local del expediente de Rejon" default answer "" with hidden answer buttons {"Cancelar","Continuar"} default button "Continuar" with title "Rejon")',confirm:'text returned of (display dialog "Repite la nueva frase local" default answer "" with hidden answer buttons {"Cancelar","Continuar"} default button "Continuar" with title "Rejon")'});
const failure=()=>Object.assign(Error('No se pudo obtener la frase local.'),{code:'secret_unavailable'});
export function createNativePilotSecretReader({platform=process.platform,execFileImpl=execFile}={}){
 return async (kind,{signal}={})=>{
  if(platform!=='darwin'||!Object.hasOwn(scripts,kind)||signal?.aborted)throw failure();
  return new Promise((resolve,reject)=>{
   try{execFileImpl('/usr/bin/osascript',['-e',scripts[kind]],{shell:false,env:{},encoding:'buffer',maxBuffer:2048,timeout:120000,killSignal:'SIGKILL',signal},(error,stdout,stderr)=>{
    try{
     if(error||!Buffer.isBuffer(stdout)||stdout.length>1026)throw failure();
     const end=stdout.length&&stdout[stdout.length-1]===10?stdout.length-(stdout.length>1&&stdout[stdout.length-2]===13?2:1):stdout.length;
     if(end<12||end>1024||stdout.subarray(0,end).includes(0)||stdout.subarray(0,end).includes(10)||stdout.subarray(0,end).includes(13))throw failure();
     resolve(Buffer.from(stdout.subarray(0,end)));
    }catch{reject(failure());}
    finally{if(Buffer.isBuffer(stdout))stdout.fill(0);if(Buffer.isBuffer(stderr))stderr.fill(0);}
   });}catch{reject(failure());}
  });
 };
}
