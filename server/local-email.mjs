import {createHash,randomUUID} from 'node:crypto';
import {createMailTransport} from './mail-transport.mjs';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const email=value=>typeof value==='string'&&value.length<=254&&/^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(value);
const fields=(p,allowed)=>{if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(key=>!allowed.includes(key)))throw Error('Parámetros de correo inválidos.');};
const text=(value,label,max)=>{if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw Error(`${label} inválido.`);return value.trim();};
function addresses(value,required=false){if(value===undefined&&!required)return [];if(!Array.isArray(value)||value.length>20||required&&!value.length||value.some(v=>!email(v)))throw Error('Destinatarios inválidos.');return [...new Set(value.map(v=>v.toLowerCase()))];}

export function createLocalEmail({store,workspace,matter,transport=createMailTransport(),clock=()=>new Date(),schedulerEnabled=false}){
 const stamp=()=>new Date(clock()).toISOString();let timer=null,ticking=false;
 const owner=()=>{const w=workspace();if(!w)throw Error('Primero crea el espacio del despacho.');return w;};
 const connection=()=>{const w=owner();return store.list('email-connection').find(c=>c.workspaceId===w.id)||null;};
 const list=()=>{const w=owner();return store.list('email-proposal').filter(p=>p.workspaceId===w.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));};
 function proposal(id){const w=owner();if(typeof id!=='string')throw Error('Correo inválido.');const p=store.get('email-proposal',id);if(!p||p.workspaceId!==w.id)throw Error('Correo no encontrado en este despacho.');if(p.matterId)matter(p.matterId);return p;}
 function event(p,status,extra={}){const updated={...p,...extra,status,updatedAt:stamp(),history:[...p.history,{status,at:stamp()}]};store.put('email-proposal',updated);store.audit(`email.${status}`,p.id);return updated;}
 function checkConnection(message){const c=connection();if(!c?.connected)throw Error('Conecta Mail antes de aprobar un envío.');const account=c.accounts.find(a=>a.id===message.accountId&&a.addresses.includes(message.from.toLowerCase()));if(!account)throw Error('Selecciona un remitente de las cuentas conectadas.');}
 function status(){const c=connection(),items=list();return {supported:transport.supported!==false,connected:Boolean(c?.connected),accounts:c?.connected?c.accounts:[],checkedAt:c?.checkedAt||null,scheduler:{running:Boolean(timer),intervalSeconds:15,activeWhileAppOpen:true,approved:items.filter(p=>p.status==='approved').length,nextDueAt:items.filter(p=>p.status==='approved').map(p=>p.scheduledAt).sort()[0]||null},notice:'El envío usa Mail en este equipo. El programador funciona mientras Rejon.AI está abierto; Mail gestiona la entrega y puede dejar mensajes en su bandeja de salida.'};}
 async function connect(){const w=owner();const result=await transport.accounts();if(!result||!Array.isArray(result.accounts))throw Error('Mail devolvió cuentas inválidas.');const accounts=result.accounts.slice(0,30).map(a=>({id:text(a.id,'Cuenta',200),name:text(a.name,'Nombre',200),addresses:addresses(a.addresses)})).filter(a=>a.addresses.length);if(!accounts.length)throw Error('Configura una cuenta de correo en Mail y vuelve a conectar.');const prior=connection();store.put('email-connection',{id:prior?.id||randomUUID(),workspaceId:w.id,connected:true,accounts,checkedAt:stamp()});store.audit('email.connect',w.id);return status();}
 function propose(p){
  fields(p,['matterId','accountId','from','to','cc','bcc','subject','body','scheduledAt']);const w=owner();const scope=p.matterId||'';if(typeof scope!=='string')throw Error('Asunto inválido.');if(scope)matter(scope);
  if(!email(p.from))throw Error('Remitente inválido.');
  const message={accountId:text(p.accountId,'Cuenta',200),from:p.from.toLowerCase(),to:addresses(p.to,true),cc:addresses(p.cc),bcc:addresses(p.bcc),subject:text(p.subject,'Asunto del correo',200),body:text(p.body,'Mensaje',24000)};
  if(/[\r\n]/.test(message.subject))throw Error('El asunto del correo no puede contener saltos de línea.');checkConnection(message);
  let scheduledAt=stamp();if(p.scheduledAt!==undefined&&p.scheduledAt!==null&&p.scheduledAt!==''){if(typeof p.scheduledAt!=='string'||!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(p.scheduledAt)||!Number.isFinite(Date.parse(p.scheduledAt))||Date.parse(p.scheduledAt)<=Date.parse(stamp()))throw Error('Elige una fecha futura con zona horaria.');scheduledAt=new Date(p.scheduledAt).toISOString();}
  const snapshot={message,scheduledAt};const item={id:randomUUID(),workspaceId:w.id,matterId:scope,...snapshot,contentHash:hash(snapshot),status:'proposed',createdAt:stamp(),updatedAt:stamp(),history:[{status:'proposed',at:stamp()}]};store.put('email-proposal',item);store.audit('email.proposed',item.id);return item;
 }
 async function sendOne(id){
  const chosen=store.transaction(()=>{const item=proposal(id);if(item.status!=='approved'||Date.parse(item.scheduledAt)>Date.parse(stamp()))return null;checkConnection(item.message);if(item.approvedHash!==item.contentHash||hash({message:item.message,scheduledAt:item.scheduledAt})!==item.contentHash)throw Error('El correo cambió después de la aprobación.');return event(item,'submitting',{attemptedAt:stamp()});});
  if(!chosen)return proposal(id);
  try{const result=await transport.send(chosen.message);if(result?.accepted!==true)throw Error('Envío no confirmado.');return event(proposal(id),'submitted',{submittedAt:stamp(),notice:'Mail aceptó el mensaje. Esto no confirma su entrega al destinatario.'});}
  catch{return event(proposal(id),'unknown',{notice:'No se confirmó si Mail aceptó el mensaje. Revisa Enviados y Bandeja de salida en Mail antes de crear otro envío. No se reintentará automáticamente.'});}
 }
 async function approve(p){fields(p,['proposalId','contentHash','reviewed']);if(p.reviewed!==true)throw Error('Revisa los destinatarios y el mensaje exacto antes de aprobar.');const approved=store.transaction(()=>{const item=proposal(p.proposalId);if(item.status!=='proposed')throw Error('Este correo ya fue decidido.');if(p.contentHash!==item.contentHash||hash({message:item.message,scheduledAt:item.scheduledAt})!==item.contentHash)throw Error('El mensaje no coincide con la vista aprobada.');checkConnection(item.message);return event(item,'approved',{approvedAt:stamp(),approvedHash:item.contentHash});});return Date.parse(approved.scheduledAt)<=Date.parse(stamp())?sendOne(approved.id):approved;}
 function revoke(p){fields(p,['proposalId']);const item=proposal(p.proposalId);if(!['proposed','approved'].includes(item.status))throw Error('El envío ya se inició o terminó; no puede revocarse desde Rejon.AI.');return event(item,'revoked',{revokedAt:stamp()});}
 async function tick(){if(ticking)return {busy:true};ticking=true;try{if(!workspace()||!connection()?.connected)return {processed:0};const due=list().filter(p=>p.status==='approved'&&Date.parse(p.scheduledAt)<=Date.parse(stamp()));for(const p of due){try{await sendOne(p.id);}catch{/* A disconnected account pauses this message without approving or retrying it. */}}return {processed:due.length};}finally{ticking=false;}}
 function disconnect(){const c=connection();if(c)store.put('email-connection',{...c,connected:false,accounts:[],checkedAt:stamp()});for(const p of list())if(['approved','proposed'].includes(p.status))event(p,'revoked',{reason:'disconnected'});return status();}
 // A process that stopped during submission cannot know the remote outcome.
 // Recovery never retries such messages, preventing duplicate sends.
 if(workspace())for(const p of list())if(p.status==='submitting')event(p,'unknown',{notice:'Rejon.AI se cerró durante el envío. Revisa Mail antes de crear otro correo.'});
 if(schedulerEnabled){timer=setInterval(()=>{void tick().catch(()=>{});},15000);timer.unref?.();}
 return {status,connect,disconnect,propose,list,approve,revoke,tick,close(){if(timer)clearInterval(timer);timer=null;}};
}
