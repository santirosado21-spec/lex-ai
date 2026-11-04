import https from 'node:https';
import { randomBytes as cryptoRandomBytes } from 'node:crypto';
import { readFile as readFileDefault } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const CODE_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MATTER_ID=/^[a-zA-Z0-9-]{1,100}$/;
const MAX_AUDIT_BYTES=256*1024;
const MAX_AGENT_BYTES=32*1024;
const MAX_PAIR_BYTES=1024;

const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
const nowMs=clock=>{const value=clock();return value instanceof Date?value.getTime():value;};
const safeEqual=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&a===b;
const safeText=value=>typeof value==='string'?value:'';
const unique=values=>[...new Set(values.map(value=>value.trim()).filter(Boolean))];
const bytes=value=>Buffer.byteLength(JSON.stringify(value),'utf8');

function normalizeDocumentType(value) {
  return ['contrato','escrito','general'].includes(value)?value:'general';
}

function romanToNumber(value) {
  const symbols={I:1,V:5,X:10,L:50,C:100,D:500,M:1000};let total=0;let prior=0;
  for(const character of value.toUpperCase().split('').reverse()){const current=symbols[character]||0;total+=current<prior?-current:current;prior=Math.max(prior,current);}return total;
}

function clauseNumber(value) {return /^\d+$/.test(value)?Number(value):romanToNumber(value);}

/** Deterministic, local-only document diagnosis. Supplied text is never executed or used as instructions. */
export function auditOfficeDocument(text,{documentType='general'}={}) {
  text=safeText(text);const type=normalizeDocumentType(documentType);const suggestions=[];
  const add=(kind,message,target=null,replacement=null)=>suggestions.push({id:`${kind}-${suggestions.length+1}`,kind,message,target,replacement});
  const placeholder=/(\[\s*(?:FECHA|COMPLETAR|NOMBRE|DOMICILIO|IMPORTE|MONTO)[^\]]*\]|_{4,})/gi;
  for(const match of text.matchAll(placeholder))add('placeholder','Dato pendiente detectado. Revíselo antes de circular el documento.',match[0],'PENDIENTE: completar');
  const standards={
    contrato:[['partes','identificación de las partes'],['objeto','objeto'],['vigencia','vigencia'],['firma','firmas']],
    escrito:[['asunto','asunto'],['firma','firma'],['anexo','anexo']],
    general:[]
  };
  for(const [needle,label] of standards[type])if(!new RegExp(`\\b${needle}\\b`,'i').test(text))add('organisational',`Sugerencia organizativa (no es un requisito legal): revise si corresponde identificar ${label} para este tipo de documento.`);
  const existing=new Set();
  for(const line of text.split(/\r?\n/)){
    const heading=line.match(/^\s*(?:cl[áa]usula\s+(?:n[úu]mero\s+)?)?([0-9]+|[IVXLCDM]+)\s*[.):-]/i);
    if(heading)existing.add(clauseNumber(heading[1]));
  }
  for(const match of text.matchAll(/cl[áa]usula\s+(?:n[úu]mero\s+)?([0-9]+|[IVXLCDM]+)/gi)){
    const reference=clauseNumber(match[1]);if(reference&&!existing.has(reference))add('cross-reference',`Referencia posiblemente rota: se menciona la cláusula ${match[1]}, pero no se encontró un encabezado correspondiente.`,match[0],match[0]);
  }
  const fields=[];
  const addFields=(kind,values)=>unique(values).slice(0,20).forEach(value=>fields.push({kind,value}));
  const parties=[];
  for(const match of text.matchAll(/\bentre\s+([^\n]+?)\s+(?:y|e)\s+([^\n]+)/gi)){parties.push(match[1],match[2]);}
  for(const match of text.matchAll(/(?:parte\s+(?:contratante|actora|demandada)\s*[:\-]?\s*)([^,;\n]+)/gi))parties.push(match[1]);
  addFields('parte',parties);
  addFields('fecha',text.match(/\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b|\b\d{1,2}\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+\d{4}\b/gi)||[]);
  addFields('importe',text.match(/(?:\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\b\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s+pesos\b)/gi)||[]);
  return {documentType:type,suggestions:suggestions.slice(0,60),fields};
}

function parseJson(buffer,max) {
  if(buffer.length>max)throw Object.assign(new Error('Solicitud demasiado grande.'),{status:413});
  let body;try{body=JSON.parse(buffer.toString('utf8'));}catch{throw Object.assign(new Error('JSON inválido.'),{status:400});}
  if(!body||typeof body!=='object'||Array.isArray(body))throw Object.assign(new Error('Solicitud inválida.'),{status:400});
  return body;
}

async function readBody(req,max) {
  let total=0;const chunks=[];
  for await(const chunk of req){const value=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);total+=value.length;if(total>max)throw Object.assign(new Error('Solicitud demasiado grande.'),{status:413});chunks.push(value);}
  return parseJson(Buffer.concat(chunks),max);
}

/**
 * A local HTTPS Office bridge. It deliberately exposes no service.dispatch route:
 * service.agentChannel is the only service capability available to a paired add-in.
 */
export function createOfficeBridge({
  service,
  assistant,
  dataDir,
  port=48765,
  allowedOrigins=[`https://localhost:${port}`],
  clock=()=>Date.now(),
  randomBytes=cryptoRandomBytes,
  fs={readFile:readFileDefault},
  listenerFactory=({key,cert,handler})=>https.createServer({key,cert},handler),
  staticRoot=path.join(moduleRoot,'office-addin'),
  certPaths,
  rateLimit={count:30,windowMs:60_000}
}={}) {
  if(!service||typeof service.agentChannel!=='function')throw new Error('El puente Office requiere el canal de agente restringido.');
  if(!dataDir||typeof dataDir!=='string')throw new Error('El puente Office requiere un directorio de datos local.');
  if(!fs||typeof fs.readFile!=='function')throw new Error('El puente Office requiere un lector de archivos.');
  const origins=new Set(allowedOrigins);const pairings=new Map(),tokens=new Map(),requests=new Map(),auditLog=[];
  function tenantOrigin(value) {
    if (!value) return '';
    const url = new URL(value);
    if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.sharepoint\.com$/.test(url.hostname) || url.port || url.username || url.password)
      throw Error('Indica la dirección HTTPS de tu organización en SharePoint Online.');
    return url.origin;
  }
  const certificate=certPaths||{key:path.join(dataDir,'office-addin','localhost.key'),cert:path.join(dataDir,'office-addin','localhost.crt')};
  let listener=null;
  const log=(action,matterId,extra={})=>{auditLog.push({at:new Date(nowMs(clock)).toISOString(),action,matterId,...extra});if(auditLog.length>500)auditLog.shift();};
  const rate=(key)=>{const now=nowMs(clock),prior=(requests.get(key)||[]).filter(at=>now-at<rateLimit.windowMs);if(prior.length>=rateLimit.count)return false;prior.push(now);requests.set(key,prior);return true;};
  const code=()=>{const source=randomBytes(6);return [...source].map(value=>CODE_ALPHABET[value%CODE_ALPHABET.length]).join('');};
  const token=()=>randomBytes(32).toString('base64url');
  const clean=()=>{const now=nowMs(clock);for(const [key,value] of pairings)if(value.expiresAt<=now||value.used)pairings.delete(key);for(const [key,value] of tokens)if(value.expiresAt<=now||value.revoked)tokens.delete(key);};
  const requireToken=(req)=>{
    clean();const supplied=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');const session=tokens.get(supplied);
    if(!session||session.revoked||session.expiresAt<=nowMs(clock))throw Object.assign(new Error('Sesión del complemento no autorizada o vencida.'),{status:401});
    if(!rate(`token:${supplied}`))throw Object.assign(new Error('Demasiadas solicitudes del complemento.'),{status:429});
    return {supplied,session};
  };
  const cors=(req,res)=>{
    const origin=req.headers.origin;if(!origin||!origins.has(origin))return false;
    res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Vary','Origin');return true;
  };
  const staticFile=async(pathname,res,tenant)=>{
    const relative=pathname==='/'?'word.html':pathname.slice(1);const resolved=path.resolve(staticRoot,relative);
    if(!resolved.startsWith(path.resolve(staticRoot)+path.sep)){json(res,404,{error:'No encontrado.'});return;}
    let content;try{content=await fs.readFile(resolved);}catch{json(res,404,{error:'Recurso del complemento no encontrado.'});return;}
    const extension=path.extname(resolved);const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.xml':'application/xml; charset=utf-8','.svg':'image/svg+xml'}[extension]||'application/octet-stream';
    clean();
    const tenants = [...new Set([...pairings.values(), ...tokens.values()].map(item => item.tenant).filter(Boolean))];
    const parents = relative === 'sharepoint.html' && tenants.includes(tenant) ? tenant : "'none'";
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' https://appsforoffice.microsoft.com; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors "+parents);res.writeHead(200,{'Content-Type':mime});res.end(content);
  };
  const handle=async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    const origin=req.headers.origin;
    try{
      if(req.method==='OPTIONS'){if(!cors(req,res)){json(res,403,{error:'Origen del complemento no permitido.'});return;}res.writeHead(204);res.end();return;}
      const url=new URL(req.url,`https://localhost:${port}`);const pathname=url.pathname;
      if(req.method==='GET'){if(origin&&!cors(req,res)){json(res,403,{error:'Origen del complemento no permitido.'});return;}await staticFile(pathname,res,url.searchParams.get('tenant'));return;}
      if(!cors(req,res)){json(res,403,{error:'Origen del complemento no permitido.'});return;}
      if(req.method!=='POST'){json(res,405,{error:'Método no permitido.'});return;}
      if(pathname==='/v1/pair'){
        if(!rate(`pair:${req.socket?.remoteAddress||'local'}`)){json(res,429,{error:'Demasiados intentos de vinculación.'});return;}
        const body=await readBody(req,MAX_PAIR_BYTES);const pairing=pairings.get(body.code);
        if(typeof body.code!=='string'||!pairing||pairing.used||(body.tenant||'')!==pairing.tenant||pairing.expiresAt<=nowMs(clock)){json(res,401,{error:'Código de vinculación inválido o vencido.'});return;}
        pairing.used=true;const value=token();const session={matterId:pairing.matterId,tenant:pairing.tenant,expiresAt:nowMs(clock)+pairing.tokenTtlMs,revoked:false};tokens.set(value,session);log('paired',session.matterId);json(res,200,{token:value,expiresAt:new Date(session.expiresAt).toISOString(),matterId:session.matterId});return;
      }
      const auth=requireToken(req);
      if (['/v1/thread','/v1/draft','/v1/draft/save'].includes(pathname)) {
        const body=await readBody(req,128*1024);
        if (!assistant || Object.hasOwn(body,'matterId')) throw Object.assign(Error('Solicitud fuera del asunto.'),{status:403});
        const scope=auth.session.matterId;
        if (pathname==='/v1/thread') {json(res,200,await assistant.history(scope));return;}
        const draft=pathname==='/v1/draft'?await assistant.draft(scope,body.replyId):await assistant.saveDraft(scope,body);
        json(res,200,{id:draft.id,version:draft.version,title:draft.current.title,text:draft.current.text});return;
      }
      if (pathname === '/v1/ask' || pathname === '/v1/selection') {
        const body = await readBody(req, MAX_AUDIT_BYTES);
        const {matterId} = auth.session;
        if (Object.hasOwn(body, 'matterId') || !assistant)
          throw Object.assign(Error('Consulta no permitida.'), {status:403});
        if (['/v1/thread','/v1/draft','/v1/draft/save'].includes(pathname)) {
        const body=await readBody(req,128*1024);
        if (!assistant || Object.hasOwn(body,'matterId')) throw Object.assign(Error('Solicitud fuera del asunto.'),{status:403});
        const scope=auth.session.matterId;
        if (pathname==='/v1/thread') {json(res,200,await assistant.history(scope));return;}
        const draft=pathname==='/v1/draft'?await assistant.draft(scope,body.replyId):await assistant.saveDraft(scope,body);
        json(res,200,{id:draft.id,version:draft.version,title:draft.current.title,text:draft.current.text});return;
      }
      if (pathname === '/v1/ask') {
          if (Object.keys(body).some(key => key !== 'question') || typeof body.question !== 'string' || !body.question.trim() || body.question.length > 4000)
            throw Error('Escribe una consulta de hasta 4000 caracteres.');
          const result = await assistant.ask(matterId, body.question);
          if (!tokens.has(auth.supplied) || auth.session.expiresAt <= nowMs(clock)) throw Object.assign(Error('Sesión vencida.'), {status:401});
          json(res, 200, {text:result.text, citations:result.citations, id:result.id});
        } else {
          if (!['Word','Excel','SharePoint'].includes(body.host) || typeof body.text !== 'string' || !body.text.trim() || body.text.length > 60000)
            throw Error('Selecciona entre 1 y 60.000 caracteres.');
          const result = await assistant.saveSelection(matterId, body.host, body.text);
          json(res, 200, {id:result.id, name:result.name});
        }
        return;
      }
      if(pathname==='/v1/audit'){
        const body=await readBody(req,MAX_AUDIT_BYTES);if(typeof body.text!=='string'||bytes({text:body.text})>MAX_AUDIT_BYTES)throw Object.assign(new Error('Texto de documento inválido o demasiado grande.'),{status:413});
        const result=auditOfficeDocument(body.text,{documentType:body.documentType});log('audit',auth.session.matterId,{documentBytes:Buffer.byteLength(body.text,'utf8'),suggestions:result.suggestions.length,fields:result.fields.length});json(res,200,result);return;
      }
      if(pathname==='/v1/agent'){
        const body=await readBody(req,MAX_AGENT_BYTES);if(!['agent.propose','agent.pending','agent.log'].includes(body.action)||!body.payload||typeof body.payload!=='object'||Array.isArray(body.payload))throw Object.assign(new Error('Acción del complemento no permitida.'),{status:403});
        if(!safeEqual(body.payload.matterId,auth.session.matterId))throw Object.assign(new Error('El complemento solo puede acceder al asunto vinculado.'),{status:403});
        if (body.action === 'agent.propose' && !['planner.today','reminder.list'].includes(body.payload.action))
          throw Object.assign(Error('Acción fuera del alcance del panel.'), {status:403});
        const result=await service.agentChannel(body.action,body.payload);log('agent-channel',auth.session.matterId,{agentAction:body.action});json(res,200,result);return;
      }
      json(res,404,{error:'Ruta del complemento no encontrada.'});
    }catch(error){json(res,error.status||400,{error:error.message||'No se pudo atender la solicitud del complemento.'});}
  };
  return {
    createPairing({matterId,tenant='',ttlMs=60_000,tokenTtlMs=15*60_000}={}) {
      clean();if(!MATTER_ID.test(matterId||''))throw new Error('La vinculación requiere un asunto válido seleccionado en la aplicación de escritorio.');
      if(!Number.isInteger(ttlMs)||ttlMs<1_000||ttlMs>120_000||!Number.isInteger(tokenTtlMs)||tokenTtlMs<60_000||tokenTtlMs>60*60_000)throw new Error('Duración de vinculación inválida.');
      let value=code();while(pairings.has(value))value=code();pairings.set(value,{matterId,tenant:tenantOrigin(tenant),expiresAt:nowMs(clock)+ttlMs,tokenTtlMs,used:false});log('pairing-created',matterId);return {code:value,expiresAt:new Date(nowMs(clock)+ttlMs).toISOString(),matterId};
    },
    revokeMatter(matterId) {
      for (const [key, session] of tokens) if (session.matterId === matterId) tokens.delete(key);
      for (const [key, pairing] of pairings) if (pairing.matterId === matterId) pairings.delete(key);
      return {revoked:true};
    },
    revoke(value) {const session=tokens.get(value);if(!session)return false;session.revoked=true;tokens.delete(value);log('token-revoked',session.matterId);return true;},
    getAuditLog(){return auditLog.map(entry=>({...entry}));},
    handle,
    async start() {
      if(listener)return {url:`https://localhost:${listener.address().port}`};
      const [key,cert]=await Promise.all([fs.readFile(certificate.key),fs.readFile(certificate.cert)]);listener=listenerFactory({key,cert,handler:handle});
      await new Promise((resolve,reject)=>{listener.once('error',reject);listener.listen(port,'127.0.0.1',resolve);});return {url:`https://localhost:${listener.address().port}`};
    },
    async close(){if(!listener)return;const current=listener;listener=null;await new Promise(resolve=>current.close(resolve));}
  };
}
