import {mkdir,writeFile,readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';import path from 'node:path';
import {robotsPolicy,LEGAL_SYNC_AGENT} from '../server/legal-sync.mjs';
import {decodeIndex} from '../server/legal-library.mjs';
const root=path.resolve('artifacts/legal-library/state-expansion-2026-11-02');
const hosts=new Set(['www.congresocdmx.gob.mx','congresocdmx.gob.mx','congresoweb.congresojal.gob.mx','www.hcnl.gob.mx']);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const robots=new Map();let last=0;
async function get(url,{checkRobots=true,maxBytes=25*1024*1024}={}){
 let current=new URL(url);for(let i=0;i<4;i++){
  if(current.protocol!=='https:'||!hosts.has(current.hostname)||current.username||current.password||current.port)throw Error('Official state-law URL outside explicit scope');
  if(checkRobots){if(!robots.has(current.origin)){const result=await get(current.origin+'/robots.txt',{checkRobots:false,maxBytes:512000});if(![200,404,410].includes(result.status))throw Error('robots unavailable '+result.status);robots.set(current.origin,result);await mkdir(root,{recursive:true});await writeFile(path.join(root,'robots-'+current.hostname+'.json'),JSON.stringify({...result,bytes:undefined,body:result.bytes.toString('utf8')},null,2));}const rb=robots.get(current.origin),policy=robotsPolicy(rb.status===200?rb.bytes.toString('utf8'):'',current.href);if(!policy.allowed||policy.crawlDelayMs>60000)throw Error('robots denies or defers '+current.href);await sleep(Math.max(0,Math.max(2000,policy.crawlDelayMs)-(Date.now()-last)));}
  const response=await fetch(current,{redirect:'manual',headers:{'User-Agent':LEGAL_SYNC_AGENT,Accept:'application/pdf,text/html,text/plain'},signal:AbortSignal.timeout(45000)});last=Date.now();
  if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('location');await response.body?.cancel();if(!location)throw Error('Redirect without location');current=new URL(location,current);continue;}
  if(Number(response.headers.get('content-length'))>maxBytes)throw Error('Response too large');const chunks=[];let size=0;for await(const b of response.body??[]){size+=b.length;if(size>maxBytes)throw Error('Response too large');chunks.push(Buffer.from(b));}const bytes=Buffer.concat(chunks);return {url:current.href,status:response.status,headers:Object.fromEntries(['content-type','content-length','etag','last-modified','cache-control'].filter(k=>response.headers.has(k)).map(k=>[k,response.headers.get(k)])),retrievedAt:new Date().toISOString(),sha256:digest(bytes),bytes};
 }throw Error('Too many redirects');
}
const indexes=[
 ['cdmx','https://www.congresocdmx.gob.mx/marco-legal-cdmx-107-2.html'],
 ['jalisco','https://congresoweb.congresojal.gob.mx/BibliotecaVirtual/busquedasleyes/ListadoMov.cfm'],
 ['nuevo-leon','https://www.hcnl.gob.mx/trabajo_legislativo/leyes/codigos.php']
];
if(process.argv.includes('--discover')){
 await mkdir(path.join(root,'discovery'),{recursive:true});const report=[];
 for(const [id,url] of indexes){try{const result=await get(url,{maxBytes:5*1024*1024});if(result.status!==200)throw Error('HTTP '+result.status);await writeFile(path.join(root,'discovery',id+'.html'),result.bytes);const {text:html,encoding}=decodeIndex(result.bytes);const links=[...html.matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/gi)].map(m=>new URL(m[1].replaceAll('&amp;','&'),result.url).href).filter(x=>/\.pdf(?:[?#]|$)|codig|c%C3%B3d|c[oó]digo/i.test(x));report.push({id,url,...result,encoding,bytes:undefined,links:[...new Set(links)]});}catch(e){report.push({id,url,error:e.message});}}
 await writeFile(path.join(root,'discovery','manifest.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.map(({id,url,status,sha256,links,error})=>({id,url,status,sha256,links,error})),null,2));
}else if(process.argv.includes('--download')){
 const catalog=JSON.parse(await readFile(path.join(root,'catalog.json'),'utf8'));await mkdir(path.join(root,'pdfs'),{recursive:true});const report=[];
 for(const source of catalog.sources){try{const result=await get(source.url);if(result.status!==200||result.bytes.subarray(0,5).toString()!=='%PDF-')throw Error('Not a successful PDF response');const file=path.join(root,'pdfs',result.sha256+'.pdf');try{await stat(file);}catch(e){if(e.code!=='ENOENT')throw e;await writeFile(file,result.bytes,{flag:'wx'});}report.push({...source,...result,bytes:result.bytes.length,file:path.relative(root,file)});}catch(e){report.push({...source,error:e.message});}await writeFile(path.join(root,'acquisitions.json'),JSON.stringify(report,null,2)+'\n');}
 console.log(JSON.stringify(report.map(({id,lawId,status,bytes,sha256,error})=>({id,lawId,status,bytes,sha256,error})),null,2));
}else throw Error('Use --discover or --download');
