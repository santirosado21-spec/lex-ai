import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const scripts=path.join(path.dirname(fileURLToPath(import.meta.url)),'mail-scripts');

// Closed native Mail operations, never a shell or caller-supplied script. Message
// text travels over stdin, not argv, and native diagnostics never enter logs/UI.
export function createMailTransport({platform=process.platform,launch=spawn}={}){
 function run(name,payload){
  if(platform!=='darwin')return Promise.reject(Error('La conexión local con Mail requiere macOS.'));
  return new Promise((resolve,reject)=>{
   const child=launch('/usr/bin/osascript',['-l','JavaScript',path.join(scripts,name)],{stdio:['pipe','pipe','pipe'],env:{HOME:process.env.HOME||'',PATH:'/usr/bin:/bin'}});
   let output='',failed=false;const finishError=()=>{if(failed)return;failed=true;clearTimeout(timer);reject(Error('Mail no confirmó la operación. Revisa sus cuentas y el permiso de Automatización de Rejon.AI en Configuración del Sistema.'));};
   const timer=setTimeout(()=>{child.kill();finishError();},30000);
   child.stdout.on('data',chunk=>{output+=chunk.toString();if(output.length>65536){child.kill();finishError();}});child.stderr.resume();
   child.once('error',finishError);child.once('close',code=>{clearTimeout(timer);if(failed)return;if(code!==0)return finishError();try{resolve(JSON.parse(output));}catch{finishError();}});
   child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(payload||{}));
  });
 }
 return {supported:platform==='darwin',accounts:()=>run('accounts.jxa',{}),send:payload=>run('send.jxa',payload)};
}
