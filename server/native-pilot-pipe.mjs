// Private parent-child pipe protocol only. No executable entry or default activation.
import {createNativePilotSession} from './native-pilot-session.mjs';
import {createNativePilotSecretReader} from './native-pilot-secret.mjs';
const operations=new Set(['status','create','unlock','lock','dispose']);
// Parent must supply non-TTY anonymous pipes and keep output out of logs.
export async function runNativePilotPipe({input,output,root,exercise,readSecret=createNativePilotSecretReader()}={}){
 if(!input||!output||input.isTTY||output.isTTY)throw Error('Canal privado requerido.');
 const session=createNativePilotSession({root,exercise}),abort=new AbortController();
 let pending=Buffer.alloc(0),busy=false,ended=false,failed=false,active=Promise.resolve();
 const send=value=>{if(!ended&&!output.destroyed)output.write(JSON.stringify(value)+'\n');};
 const shutdown=()=>{if(pending.length)failed=true;ended=true;abort.abort();};
 input.once('end',shutdown);input.once('error',shutdown);output.once('error',shutdown);output.once('close',shutdown);
 const error=()=>send({ok:false,error:'request_failed'});
 async function perform(op){
  let passphrase,confirmation;
  try{
   if(op==='create'||op==='unlock'){
    passphrase=await readSecret(op==='create'?'create':'unlock',{signal:abort.signal});
    if(ended)throw Error('closed');
    if(op==='create')confirmation=await readSecret('confirm',{signal:abort.signal});
    if(ended)throw Error('closed');
    send({ok:true,result:await session.unlock({passphrase,confirmation})});
   }else if(op==='status')send({ok:true,result:session.status()});
   else if(op==='lock')send({ok:true,result:await session.lock()});
   else {const result=await session.dispose();send({ok:true,result});shutdown();input.destroy();}
  }catch{error();}
  finally{passphrase?.fill?.(0);confirmation?.fill?.(0);busy=false;}
 }
 function line(bytes){
  if(ended)return;
  let message,text;
  try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);message=JSON.parse(text);}catch{error();return;}
  if(!message||Array.isArray(message)||Object.keys(message).length!==1||!operations.has(message.op)||text!==JSON.stringify({op:message.op})){error();return;}
  if(busy){error();return;}
  busy=true;active=perform(message.op);
 }
 try{
  await new Promise(resolve=>{
   const finish=()=>resolve();input.once('end',finish);input.once('close',()=>{shutdown();finish();});input.once('error',finish);output.once('error',()=>{shutdown();input.destroy();finish();});output.once('close',()=>{shutdown();input.destroy();finish();});
   input.on('data',chunk=>{
    if(ended)return;
    if(!Buffer.isBuffer(chunk)){failed=true;shutdown();input.destroy();return;}
    // Pipe chunk boundaries have no protocol meaning. Accumulate at most one
    // bounded frame; never concatenate an unbounded chunk before checking it.
    for(const byte of chunk){
     if(ended)break;
     if(byte===10){const frame=pending;pending=Buffer.alloc(0);line(frame);frame.fill(0);}
     else if(pending.length===128){failed=true;error();shutdown();input.destroy();break;}
     else pending=Buffer.concat([pending,Buffer.from([byte])]);
    }
   });
  });
  await active;
 }finally{
  shutdown();pending.fill(0);input.removeListener('end',shutdown);input.removeListener('error',shutdown);output.removeListener('error',shutdown);output.removeListener('close',shutdown);
  // Failed close is not reported as clean. Parent must kill/wait its own helper.
  try{await session.dispose();}catch{failed=true;}
 }
 return {closed:session.status().state==='disposed',failed};
}
