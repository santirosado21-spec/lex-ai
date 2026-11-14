import {mkdir,readFile,writeFile,rename,open,unlink} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';

export const LEGAL_SYNC_AGENT='LexAI-LegalSync/0.1';
export const ALLOWED_HOSTS=Object.freeze(['www.diputados.gob.mx','diputados.gob.mx','www.congresocdmx.gob.mx','congresocdmx.gob.mx','www.hcnl.gob.mx','hcnl.gob.mx','congresoweb.congresojal.gob.mx','congresocoahuila.gob.mx','www.congresocoahuila.gob.mx','www.congresobc.gob.mx','congresobc.gob.mx','congresoags.gob.mx','www.congresoags.gob.mx','congresoyucatan.gob.mx','www.congresoyucatan.gob.mx','congresonayarit.gob.mx','www.congresonayarit.gob.mx']);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const transient=status=>[408,425,429,500,502,503,504].includes(status);

export function validateSourceUrl(value){
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash||!ALLOWED_HOSTS.includes(url.hostname))throw new Error('URL bloqueada: solo HTTPS y dominios oficiales autorizados.');
  return url;
}

export function robotsPolicy(content,target,userAgent=LEGAL_SYNC_AGENT){
  const groups=[];let agents=[],rules=[],crawlDelay=0,hasRules=false;
  const flush=()=>{if(agents.length)groups.push({agents,rules,crawlDelay});agents=[];rules=[];crawlDelay=0;hasRules=false;};
  for(const raw of content.split(/\r?\n/)){
    const line=raw.replace(/#.*$/,'').trim();if(!line)continue;
    const colon=line.indexOf(':');if(colon<0)continue;
    const key=line.slice(0,colon).trim().toLowerCase(),value=line.slice(colon+1).trim();
    if(key==='user-agent'){if(hasRules)flush();agents.push(value.toLowerCase());}
    else if(agents.length&&['allow','disallow'].includes(key)){hasRules=true;if(value)rules.push({allow:key==='allow',pattern:value});}
    else if(agents.length&&key==='crawl-delay'){hasRules=true;const v=Number(value);if(Number.isFinite(v)&&v>=0)crawlDelay=Math.max(crawlDelay,v*1000);}
  }
  flush();const agent=userAgent.toLowerCase();
  let selected=groups.filter(g=>g.agents.some(a=>a!=='*'&&agent.includes(a)));
  if(!selected.length)selected=groups.filter(g=>g.agents.includes('*'));
  const url=new URL(target),pathname=url.pathname+url.search;
  const matches=selected.flatMap(g=>g.rules).filter(r=>{
    const end=r.pattern.endsWith('$');const pattern=(end?r.pattern.slice(0,-1):r.pattern).split('*').map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*');
    return new RegExp('^'+pattern+(end?'$':'')).test(pathname);
  }).sort((a,b)=>b.pattern.replace(/\*/g,'').length-a.pattern.replace(/\*/g,'').length||Number(b.allow)-Number(a.allow));
  return {allowed:matches.length?matches[0].allow:true,crawlDelayMs:Math.max(0,...selected.map(g=>g.crawlDelay)),rule:matches[0]?.pattern??null};
}

async function readJson(file,fallback){try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw new Error(`Estado persistido inválido: ${path.basename(file)}. No se sobrescribirá.`);}}
async function atomicJson(file,value){const tmp=file+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(value,null,2)+'\n',{mode:0o600});await rename(tmp,file);}
async function lockRun(outputDir){
  const file=path.join(outputDir,'sync.lock');
  for(let attempt=0;attempt<2;attempt++){
    try{const handle=await open(file,'wx',0o600);await handle.writeFile(JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));await handle.close();return ()=>unlink(file).catch(()=>{});}
    catch(e){if(e.code!=='EEXIST')throw e;let lock;try{lock=JSON.parse(await readFile(file,'utf8'));}catch{throw new Error('Ya existe una sincronización o bloqueo pendiente de revisar.');}
      if(!Number.isInteger(lock.pid)||lock.pid<=0)throw new Error('Bloqueo de sincronización inválido.');
      try{process.kill(lock.pid,0);throw new Error('Ya hay una sincronización en curso.');}catch(err){if(err.code!=='ESRCH')throw err;await unlink(file);}
    }
  }
  throw new Error('No fue posible obtener el bloqueo de sincronización.');
}

export async function runLegalSync({sources,outputDir,fetchImpl=fetch,now=()=>new Date(),sleep=delay,limits={},signal}={}){
  if(!Array.isArray(sources)||!sources.length||sources.length>32)throw new Error('Lista de fuentes inválida.');
  const ids=new Set();for(const source of sources){if(!/^[a-z][a-z0-9-]{0,39}$/.test(source.id)||ids.has(source.id))throw new Error('Identificador de fuente inválido o repetido.');validateSourceUrl(source.url);ids.add(source.id);}
  const config={maxBytes:20*1024*1024,timeoutMs:45_000,rateMs:2000,maxRetries:1,maxRedirects:3,checkIntervalMs:6*3600_000,...limits};
  await mkdir(outputDir,{recursive:true,mode:0o700});const unlock=await lockRun(outputDir);
  const statusFile=path.join(outputDir,'status.json'),manifestFile=path.join(outputDir,'manifest.json');
  let status;
  try{
    const manifest=await readJson(manifestFile,{schemaVersion:1,sources:{}});
    if(manifest.schemaVersion!==1||!manifest.sources||typeof manifest.sources!=='object')throw new Error('Manifest de sincronización incompatible.');
    for(const [id,record] of Object.entries(manifest.sources)){
      if(!/^[a-z][a-z0-9-]{0,39}$/.test(id)||!Array.isArray(record.versions))throw new Error('Manifest de versiones inválido.');
      for(const version of record.versions){if(!/^[a-f0-9]{64}$/.test(version.sha256)||version.snapshotPath!==`snapshots/${id}/${version.sha256}.pdf`)throw new Error('Ruta de snapshot no autorizada en manifest.');}
    }
    const previous=await readJson(statusFile,{sources:[]});
    status={schemaVersion:1,state:'running',startedAt:now().toISOString(),finishedAt:null,nextCheckAfter:null,summary:{total:sources.length,downloaded:0,unchanged:0,failed:0,quarantined:0},sources:[]};
    await atomicJson(statusFile,status);
    const originTimes=new Map(),robotCache=new Map();
    async function throttle(origin,extra=0){const wait=Math.max(config.rateMs,extra)-(now().getTime()-(originTimes.get(origin)??0));if(wait>0)await sleep(wait);originTimes.set(origin,now().getTime());}
    async function boundedResponse(response,maxBytes,requestSignal){
      const declared=Number(response.headers.get('content-length')||0);if(declared>maxBytes){await response.body?.cancel();throw new Error('El documento supera el tamaño permitido.');}
      const chunks=[];let size=0;
      if(response.body){for await(const chunk of response.body){if(requestSignal.aborted)throw new Error('Solicitud cancelada o tiempo agotado.');size+=chunk.length;if(size>maxBytes)throw new Error('El documento supera el tamaño permitido.');chunks.push(Buffer.from(chunk));}}
      return Buffer.concat(chunks);
    }
    async function request(url,headers={},isRobots=false){
      let current=validateSourceUrl(url);const initialOrigin=current.origin;
      for(let redirects=0;redirects<=config.maxRedirects;redirects++){
        if(signal?.aborted)throw new Error('Sincronización cancelada.');
        let policy={crawlDelayMs:0};if(!isRobots){policy=await ensureRobots(current);if(!policy.allowed)throw new Error('Acceso bloqueado por robots.txt.');if(policy.crawlDelayMs>60_000)throw new Error('Crawl-delay requiere una ventana mayor; fuente aplazada.');}
        await throttle(current.origin,policy.crawlDelayMs);
        const requestSignal=AbortSignal.any([AbortSignal.timeout(config.timeoutMs),...(signal?[signal]:[])]);
        const response=await fetchImpl(current.href,{method:'GET',redirect:'manual',headers:{'User-Agent':LEGAL_SYNC_AGENT,Accept:isRobots?'text/plain':'application/pdf',...headers},signal:requestSignal});
        if([301,302,303,307,308].includes(response.status)){
          const location=response.headers.get('location');await response.body?.cancel();if(!location)throw new Error('Redirección sin destino.');
          const next=validateSourceUrl(new URL(location,current).href);if(next.origin!==initialOrigin)headers={};current=next;continue;
        }
        const bytes=await boundedResponse(response,isRobots?512_000:config.maxBytes,requestSignal);
        return {response,bytes,url:current.href};
      }
      throw new Error('Demasiadas redirecciones.');
    }
    async function ensureRobots(url){
      if(!robotCache.has(url.origin)){
        const result=await request(url.origin+'/robots.txt',{},true);
        if(result.response.status===404||result.response.status===410)robotCache.set(url.origin,{text:'',httpStatus:result.response.status,checkedAt:now().toISOString(),sha256:hash(result.bytes)});
        else if(result.response.status===200)robotCache.set(url.origin,{text:result.bytes.toString('utf8'),httpStatus:200,checkedAt:now().toISOString(),sha256:hash(result.bytes)});
        else throw new Error(`robots.txt no verificable (HTTP ${result.response.status}); no se descargará la fuente.`);
      }
      const robots=robotCache.get(url.origin);return {...robotsPolicy(robots.text,url.href),httpStatus:robots.httpStatus,checkedAt:robots.checkedAt,sha256:robots.sha256};
    }
    for(const source of sources){
      const prior=previous.sources?.find(s=>s.id===source.id&&s.url===source.url);
      const stored=manifest.sources[source.id];
      const latest=stored?.url===source.url?stored.versions?.find(v=>v.sha256===stored.latestSha256):null;
      const entry={id:source.id,title:source.title,url:source.url,jurisdiction:source.jurisdiction,state:'pending',checkedAt:now().toISOString(),lastSuccessAt:prior?.lastSuccessAt??null,httpStatus:null,etag:latest?.etag??null,lastModified:latest?.lastModified??null,sha256:latest?.sha256??null,bytes:latest?.bytes??null,versionId:latest?.versionId??null,reviewStatus:latest?'quarantined':null,snapshotPath:latest?.snapshotPath??null,attempts:0};
      try{
        let result;
        for(let attempt=0;attempt<=config.maxRetries;attempt++){
          entry.attempts=attempt+1;
          try{
            const headers={};if(latest?.etag)headers['If-None-Match']=latest.etag;if(latest?.lastModified)headers['If-Modified-Since']=latest.lastModified;
            result=await request(source.url,headers);entry.httpStatus=result.response.status;
            if(transient(result.response.status)&&attempt<config.maxRetries){
              const retryHeader=result.response.headers.get('retry-after');const retryDelay=retryHeader?(/^\d+$/.test(retryHeader)?Number(retryHeader)*1000:Date.parse(retryHeader)-now().getTime()):1000;
              if(retryDelay>10_000)throw new Error(`HTTP ${result.response.status}; Retry-After exige esperar antes de la próxima sincronización.`);
              await sleep(Math.max(1000,retryDelay||0));continue;
            }
            break;
          }catch(e){const permanentTls=/CERT|TLS/.test(e.cause?.code??'');if(attempt<config.maxRetries&&!permanentTls&&(e.name==='TypeError'||e.name==='TimeoutError')){await sleep(1000);continue;}throw e;}
        }
        if(result.response.status===304){
          if(!latest)throw new Error('Servidor devolvió 304 sin una copia local verificada.');
          const snapshot=await readFile(path.join(outputDir,latest.snapshotPath));if(hash(snapshot)!==latest.sha256)throw new Error('La copia local no supera la verificación de integridad.');
          entry.state='unchanged';
        }else{
          if(result.response.status!==200)throw new Error(`Descarga fallida (HTTP ${result.response.status}).`);
          if(!result.bytes.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error('La respuesta no es un PDF; se conserva la versión previa.');
          const digest=hash(result.bytes);entry.sha256=digest;entry.bytes=result.bytes.length;entry.etag=result.response.headers.get('etag');entry.lastModified=result.response.headers.get('last-modified');
          const known=stored?.versions?.find(v=>v.sha256===digest);
          if(known){const existing=await readFile(path.join(outputDir,known.snapshotPath));if(hash(existing)!==digest)throw new Error('La copia histórica está dañada; requiere revisión.');entry.state='unchanged';entry.versionId=known.versionId;entry.snapshotPath=known.snapshotPath;}
          else{
            const relative=`snapshots/${source.id}/${digest}.pdf`;await mkdir(path.dirname(path.join(outputDir,relative)),{recursive:true,mode:0o700});
            try{await writeFile(path.join(outputDir,relative),result.bytes,{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw e;if(hash(await readFile(path.join(outputDir,relative)))!==digest)throw new Error('Snapshot preexistente con integridad inválida.');}
            const version={versionId:`${source.id}-${digest.slice(0,16)}`,sha256:digest,bytes:entry.bytes,retrievedAt:entry.checkedAt,url:source.url,finalUrl:result.url,etag:entry.etag,lastModified:entry.lastModified,snapshotPath:relative,reviewStatus:'quarantined',legalValidity:'unknown',effectiveAt:null};
            const record=manifest.sources[source.id]??{id:source.id,title:source.title,url:source.url,versions:[]};record.url=source.url;record.versions.push(version);record.latestSha256=digest;record.lastCheckedAt=entry.checkedAt;manifest.sources[source.id]=record;
            await atomicJson(manifestFile,manifest);entry.state='downloaded';entry.versionId=version.versionId;entry.snapshotPath=relative;
          }
          if(manifest.sources[source.id]){manifest.sources[source.id].latestSha256=digest;manifest.sources[source.id].lastCheckedAt=entry.checkedAt;const version=manifest.sources[source.id].versions.find(v=>v.sha256===digest);version.etag=entry.etag;version.lastModified=entry.lastModified;await atomicJson(manifestFile,manifest);}
        }
        entry.reviewStatus='quarantined';entry.lastSuccessAt=entry.checkedAt;const robots=await ensureRobots(new URL(source.url));entry.robots=robots.httpStatus;entry.robotsEvidence={checkedAt:robots.checkedAt,sha256:robots.sha256,rule:robots.rule};
      }catch(e){entry.state=/bloquead|robots\.txt|Crawl-delay/.test(e.message)?'blocked':'failed';entry.errorCode=e.cause?.code??e.code??null;entry.error=/CERT|TLS/.test(entry.errorCode??'')?'No se pudo verificar el certificado TLS del sitio oficial; no se omitirá esta comprobación.':e.message;entry.sha256=latest?.sha256??null;entry.bytes=latest?.bytes??null;entry.versionId=latest?.versionId??null;entry.snapshotPath=latest?.snapshotPath??null;}
      status.sources.push(entry);status.summary.downloaded=status.sources.filter(s=>s.state==='downloaded').length;status.summary.unchanged=status.sources.filter(s=>s.state==='unchanged').length;status.summary.failed=status.sources.filter(s=>['failed','blocked'].includes(s.state)).length;status.summary.quarantined=status.sources.filter(s=>s.reviewStatus==='quarantined').length;
      await atomicJson(statusFile,status);
    }
    status.finishedAt=now().toISOString();status.nextCheckAfter=new Date(now().getTime()+config.checkIntervalMs).toISOString();status.state=status.summary.failed===0?'complete':status.summary.failed===sources.length?'failed':'partial';await atomicJson(statusFile,status);return status;
  }finally{await unlock();}
}
