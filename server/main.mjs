import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createService } from './service.mjs';
import { createInference } from './inference.mjs';
import { publicMonitorStatus } from './public-monitor.mjs';
import { trainingStatus } from './training-status.mjs';
import { openPublicLibrary } from './public-library.mjs';
import { createLocalFileOpener } from './local-files.mjs';
import { createOfficeBridge } from './office-bridge.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const MAX_BODY=15*1024*1024;
export async function startServer({port=0,dataDir=process.env.LEX_DATA_DIR||path.join(os.homedir(),'Library/Application Support/LEX AI'),inference,service,monitorDir,autoInitialize=process.env.LEX_DESKTOP==='1',libraryPath=process.env.LEX_PUBLIC_LIBRARY_PATH||path.join(root,'resources/public-library.sqlite')}={}){
 process.umask(0o077);await mkdir(dataDir,{recursive:true,mode:0o700});
 let publicLibrary=null;let libraryUnavailable={available:false,reason:'not-indexed'};
 try{publicLibrary=await openPublicLibrary(libraryPath);}catch(e){let absent=false;if(e.code==='ENOENT'){try{await access(libraryPath);}catch(missing){absent=missing.code==='ENOENT';}}if(!absent)libraryUnavailable={available:false,reason:'invalid-index',error:'La biblioteca pública no supera la comprobación de integridad o lectura. Reconstruye el índice.'};}
 const openFile=process.platform==='darwin'&&process.env.LEX_DESKTOP==='1'?createLocalFileOpener({dataDir}):null;
 inference ||= createInference({dataDir});try{service ||= await createService({dataDir,corpusPath:path.join(root,'resources/legal-corpus.json'),inference,publicLibrary,openFile});}catch(e){publicLibrary?.close();throw e;}
 let officeBridge=null, officeStarting=null;
 async function enableOffice() {
  if (officeBridge) return officeBridge;
  if (officeStarting) return officeStarting;
  const port=Number(process.env.LEX_OFFICE_PORT||48765);
  if (!Number.isInteger(port)||port<1||port>65535) throw Error('Puerto de Office inválido.');
  officeStarting=(async()=>{
   const bridge=createOfficeBridge({service,dataDir,port,assistant:{
    history:matterId=>service.dispatch('office.history',{matterId}),
    draft:(matterId,replyId)=>service.dispatch('draft.get',{matterId,replyId}),
    saveDraft:(matterId,payload)=>service.dispatch('draft.save',{...payload,matterId}),
    ask:(matterId,question)=>service.analyze({mode:'auto',matterId,question}),
    saveSelection:(matterId,host,text)=>service.dispatch('document.import',{matterId,name:host+' - selección.txt',base64:Buffer.from(text).toString('base64')})
   }});
   try {await bridge.start();} catch(error) {
    if(error.code==='ENOENT') throw Error('Prepara primero el certificado local de Office con el asistente de instalación.');
    throw error;
   }
   officeBridge=bridge;return bridge;
  })();
  try{return await officeStarting;}finally{officeStarting=null;}
 }
 if(process.env.LEX_OFFICE_BRIDGE==='1')try{await enableOffice();}catch(error){service.close?.();publicLibrary?.close();throw error;}
 const token=randomBytes(32).toString('hex');let closing=false;
 const allowed=new Set(['tauri://localhost','http://tauri.localhost','https://tauri.localhost','http://localhost:1420','http://127.0.0.1:1420']);
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  const origin=req.headers.origin;const own=`http://127.0.0.1:${server.address()?.port}`;
  if(origin&&!allowed.has(origin)&&origin!==own){json(res,403,{error:'Origen no permitido.'});return;}
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'POST'});res.end();return;}
  try{
   const pathname=new URL(req.url,own).pathname;
   if(pathname==='/api'||pathname==='/analyze'){
    const supplied=Buffer.from(req.headers.authorization||'');const expected=Buffer.from(`Bearer ${token}`);
    if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected)){json(res,401,{error:'Sesión no autorizada.'});return;}
    if(req.method!=='POST'||!req.headers['content-type']?.startsWith('application/json')){json(res,405,{error:'Se requiere POST JSON.'});return;}
    let count=0;const chunks=[];for await(const b of req){count+=b.length;if(count>MAX_BODY){json(res,413,{error:'El archivo supera el límite.'});return;}chunks.push(b);}
    let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{json(res,400,{error:'JSON inválido.'});return;}
    if(!body||typeof body!=='object'||Array.isArray(body)){json(res,400,{error:'Solicitud inválida.'});return;}
    if(pathname==='/analyze'){
     const analysisAbort=new AbortController();res.once('close',()=>{if(!res.writableEnded)analysisAbort.abort();});
     res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8'});
     try{const result=await service.analyze(body.payload||body,text=>{if(!res.destroyed)res.write(JSON.stringify({type:'token',text})+'\n');},{signal:analysisAbort.signal});if(!res.destroyed)res.end(JSON.stringify({type:'result',data:result})+'\n');}
     catch(e){if(!res.destroyed)res.end(JSON.stringify({type:'error',message:e.message})+'\n');}return;
    }
    let result;
    if(body.action==='engine.status')result=await inference.status();
    else if(body.action==='engine.initialize')result=await inference.initialize();
    else if(body.action==='engine.stop')result=await inference.stop();
    else if(body.action==='office.pair' || body.action==='office.revoke'){
     const {matterId,tenant}=body.payload||{};
     // This check uses the same workspace/matter boundary as the desktop.
     await service.dispatch('checklist.get',{matterId});
     result=body.action==='office.pair'?(await enableOffice()).createPairing({matterId,tenant}):officeBridge?.revokeMatter(matterId)||{revoked:true};
    }
    else if(body.action==='sources.status')result=await publicMonitorStatus({monitorDir});
    else if(body.action==='training.status')result=await trainingStatus({monitorDir});
    else if(typeof body.action==='string'&&body.action.startsWith('library.')){
     const p=body.payload??{};if(!p||typeof p!=='object'||Array.isArray(p)||JSON.stringify(p).length>1500)throw new Error('Parámetros de biblioteca inválidos.');
     const keys=body.action==='library.search'?['query','lawId','jurisdiction','limit','offset']:body.action==='library.source'?['sourceId']:[];if(Object.keys(p).some(k=>!keys.includes(k)))throw new Error('Campo de biblioteca no admitido.');
     if(body.action==='library.status')result=publicLibrary?publicLibrary.status():libraryUnavailable;
     else if(body.action==='library.search'){if(!publicLibrary)throw new Error(libraryUnavailable.error||'Biblioteca pública no instalada.');result=publicLibrary.search(p);}
     else if(body.action==='library.source'){if(typeof p.sourceId!=='string'||!/^PUB-[a-f0-9]{64}$/.test(p.sourceId))throw new Error('Identificador de fuente pública inválido.');if(!publicLibrary)throw new Error(libraryUnavailable.error||'Biblioteca pública no instalada.');result=publicLibrary.getSource(p.sourceId);}
     else throw new Error('Acción de biblioteca no admitida.');
    }
    else result=await service.dispatch(body.action,body.payload||{});
    json(res,200,result);return;
   }
   if(req.method!=='GET'){json(res,405,{error:'Método no permitido.'});return;}
   const rel=decodeURIComponent(pathname)==='/'?'index.html':decodeURIComponent(pathname).replace(/^\//,'');
   const file=path.resolve(root,'dist',rel),dist=path.resolve(root,'dist');
   if(!file.startsWith(dist+path.sep)){json(res,404,{error:'No encontrado.'});return;}
   let content;try{content=await readFile(file);}catch{json(res,404,{error:'Interfaz no compilada. Ejecuta npm run build.'});return;}
   const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream';
   res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");res.writeHead(200,{'Content-Type':mime});res.end(content);
  }catch(e){if(!res.headersSent)json(res,400,{error:e.message||'No se pudo completar la operación.'});else res.end();}
 });
 server.requestTimeout=30_000;server.headersTimeout=10_000;
 try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});}catch(e){try{await officeBridge?.close();service.close?.();}finally{publicLibrary?.close();}throw e;}
 const connection={url:`http://127.0.0.1:${server.address().port}`,token};
 // Desktop initialization installs only the small verified model from the
 // bundle, starts its private daemon, and never loads weights until a query.
 if(autoInitialize)void inference.initialize().catch(()=>{});
 return {connection,service,inference,officeBridge,async close(){if(closing)return;closing=true;try{await officeBridge?.close();await inference.stop();server.closeAllConnections();await new Promise(r=>server.close(r));service.close?.();}finally{publicLibrary?.close();}}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const app=await startServer({port:Number(process.env.LEX_PORT||0)});console.log(JSON.stringify(app.connection));for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await app.close();process.exit(0);});process.stdin.resume();process.stdin.on('end',async()=>{if(process.env.LEX_DESKTOP==='1'){await app.close();process.exit(0);}});}
 catch(e){console.error(`LEX AI no pudo iniciar: ${e.message}`);process.exitCode=1;}
}
