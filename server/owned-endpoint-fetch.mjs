// No HTTP bytes are written until the already-connected socket is observed in
// the owned leader's descriptor table. Each request uses a fresh, non-retried socket.
import net from 'node:net';
import http from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execute=promisify(execFile);
const failure=()=>Error('No se pudo verificar la conexión del motor propio.');
export function parseOwnedConnections(text){
 const rows=[];let pid=null,current=null;
 for(const line of text.split('\n')){
  if(line.startsWith('p')){pid=Number(line.slice(1));current=null;}
  else if(line.startsWith('f')){current={pid,name:null,state:null};rows.push(current);}
  else if(line.startsWith('n')&&current)current.name=line.slice(1);
  else if(line.startsWith('TST=')&&current)current.state=line.slice(4);
 }
 return rows;
}
export function hasOwnedConnection(text,pid,{localAddress,localPort,remoteAddress,remotePort}){
 if(!Number.isSafeInteger(pid)||pid<=0||localAddress!=='127.0.0.1'||remoteAddress!=='127.0.0.1'||![localPort,remotePort].every(p=>Number.isInteger(p)&&p>=1024&&p<=65535)||remotePort===11434)return false;
 const target=`127.0.0.1:${remotePort}->127.0.0.1:${localPort}`;
 return parseOwnedConnections(text).some(row=>row.pid===pid&&row.name===target&&row.state==='ESTABLISHED');
}
export async function createOwnedEndpointFetch({child,platform=process.platform,executeImpl=execute,connectImpl=net.createConnection}={}){
 if(!['darwin','linux'].includes(platform)||!Number.isSafeInteger(child?.pid)||child.pid<=0)throw failure();
 const pid=child.pid,lsof=platform==='darwin'?'/usr/sbin/lsof':'/usr/bin/lsof';
 const alive=()=>child.pid===pid&&child.exitCode===null&&!child.signalCode;
 const options={timeout:1500,maxBuffer:256*1024,env:{PATH:'/usr/bin:/bin:/usr/sbin',LC_ALL:'C'}};
 async function identity(){if(!alive())throw failure();const {stdout}=await executeImpl('/bin/ps',['-p',String(pid),'-o','pid=','-o','lstart='],options);const value=stdout.trim();if(!new RegExp('^'+pid+'\\s+\\S.+$').test(value)||value.includes('\n')||!alive())throw failure();return value;}
 const initial=await identity();
 return async function ownedFetch(url,init={}){
  init={...init,signal:AbortSignal.any([AbortSignal.timeout(15000),...(init.signal?[init.signal]:[])])};
  const address=new URL(url);
  if(address.protocol!=='http:'||address.hostname!=='127.0.0.1'||address.username||address.password||address.hash||!Number.isInteger(Number(address.port))||Number(address.port)<1024||Number(address.port)===11434||!alive())throw failure();
  init.signal?.throwIfAborted();
  const agent=new http.Agent({keepAlive:false,maxSockets:1});let connected;
  agent.createConnection=(_options,callback)=>{
   const socket=connectImpl({host:'127.0.0.1',port:Number(address.port)});connected=socket;let finished=false;
   const done=(error)=>{if(finished)return;finished=true;socket.off('error',onError);socket.off('connect',verify);if(error){socket.destroy();callback(error);}else callback(null,socket);};
   const onError=()=>done(failure());
   const verify=async()=>{try{
    if(await identity()!==initial)throw failure();
    const tuple={localAddress:socket.localAddress,localPort:socket.localPort,remoteAddress:socket.remoteAddress,remotePort:socket.remotePort};
    const {stdout}=await executeImpl(lsof,['-nP','-a','-p',String(pid),'-iTCP','-FpnT'],options);
    if(!hasOwnedConnection(stdout,pid,tuple)||await identity()!==initial||socket.destroyed||!alive())throw failure();
    init.signal?.throwIfAborted();done();
   }catch{done(failure());}};
   socket.once('error',onError);socket.once('connect',verify);
   // Agent must wait for callback. Returning the socket here would let Node send early.
  };
  try{return await new Promise((resolve,reject)=>{
   let req;const abort=()=>{connected?.destroy();req?.destroy();reject(init.signal.reason||failure());};
   const finish=()=>init.signal?.removeEventListener('abort',abort);
   init.signal?.addEventListener('abort',abort,{once:true});
   if(init.signal?.aborted){abort();return;}
   req=http.request(address,{method:init.method||'GET',headers:init.headers,agent},res=>{
    const parts=[];let size=0;
    res.on('data',part=>{size+=part.length;if(size>262144){const error=Object.assign(Error('Respuesta local demasiado grande.'),{code:'ERR_OWNED_RESPONSE_LIMIT'});finish();reject(error);res.destroy(error);return;}parts.push(part);});
    res.once('error',error=>{finish();reject(error);});res.once('aborted',()=>{finish();reject(failure());});
    res.once('end',()=>{finish();try{
     const noBody=init.method?.toUpperCase()==='HEAD'||[204,205,304].includes(res.statusCode);
     resolve(new Response(noBody?null:Buffer.concat(parts),{status:res.statusCode,headers:res.headers}));
    }catch(error){reject(error);}});
   });
   req.once('error',error=>{finish();reject(error);});req.end(init.body);
  });}finally{connected?.destroy();agent.destroy();}
 };
}
