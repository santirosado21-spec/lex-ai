import { createHash } from 'node:crypto';

/** The entire capability surface available to the in-app agent. */
export const AGENT_ACTIONS=Object.freeze({
  'matter.list':{mode:'read',matter:'optional',keys:[]},
  'research.search':{mode:'read',matter:'optional',keys:['query','jurisdiction']},
  'reminder.list':{mode:'read',matter:'required',keys:['status']},
  'planner.today':{mode:'read',matter:'required',keys:['timeZone']},
  'matter.create':{mode:'write',matter:'forbidden',keys:['title','client','jurisdiction']},
  'reminder.create':{mode:'write',matter:'required',keys:['kind','title','dueAt','note']},
  'document.import':{mode:'write',matter:'required',keys:['name','base64']},
  'answer.export':{mode:'write',matter:'required',keys:['answerId']},
  'planner.propose':{mode:'write',matter:'required',keys:[]},
});

const identifier=value=>typeof value==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(value);
const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const forbidden=/^(?:shell|exec|command|cmd|file|path|url|uri|network|net|host|port|fetch|request|socket|endpoint|process|env)$/i;
const string=(value,label,max,{optional=false}={})=>{
  if(value===undefined&&optional)return undefined;
  if(typeof value!=='string'||!value.trim()||value.length>max)throw new Error(`${label}: valor inválido.`);
  return value.trim();
};
const objectSize=value=>Buffer.byteLength(JSON.stringify(value),'utf8');

function noForbiddenKeys(value) {
  if(!isObject(value))return;
  for(const [key,child] of Object.entries(value)) {
    if(forbidden.test(key))throw new Error(`Campo de capacidad prohibido: ${key}.`);
    noForbiddenKeys(child);
  }
}

function exactArgs(action,args) {
  const definition=AGENT_ACTIONS[action];
  if(!definition)throw new Error('Acción de agente no registrada.');
  if(!isObject(args))throw new Error('Argumentos de agente inválidos.');
  if(objectSize(args)>14_000_000)throw new Error('Argumentos de agente demasiado grandes.');
  noForbiddenKeys(args);
  for(const key of Object.keys(args))if(!definition.keys.includes(key))throw new Error(`Campo de agente no admitido: ${key}.`);
  return definition;
}

/** Validates syntax only; service re-validates all current scope at execution time. */
export function validateAgentRequest(request) {
  if(!isObject(request))throw new Error('Solicitud de agente inválida.');
  for(const key of Object.keys(request))if(!['matterId','action','args','origin'].includes(key))throw new Error(`Campo de agente no admitido: ${key}.`);
  const {matterId,action,args,origin}=request;
  if(typeof action!=='string'||!Object.hasOwn(AGENT_ACTIONS,action))throw new Error('Acción de agente no registrada.');
  if(origin!=='user'&&origin!=='agent')throw new Error('Origen de propuesta inválido.');
  const definition=exactArgs(action,args);
  if(definition.matter==='required'&&!identifier(matterId))throw new Error('Esta acción requiere un asunto válido.');
  if(definition.matter==='forbidden'&&matterId!==undefined&&matterId!==null)throw new Error('Esta acción no admite asunto.');
  if(definition.matter==='optional'&&matterId!==undefined&&matterId!==null&&!identifier(matterId))throw new Error('Asunto inválido.');
  switch(action) {
    case 'research.search':
      string(args.query,'Consulta',4000);
      if(!['MX-FED','MX-CMX'].includes(args.jurisdiction))throw new Error('Jurisdicción no admitida.');
      break;
    case 'reminder.list':
      if(args.status!==undefined&&!['proposed','approved','done','dismissed'].includes(args.status))throw new Error('Estado de recordatorio inválido.');
      break;
    case 'planner.today':
      if(args.timeZone!==undefined)string(args.timeZone,'Zona horaria',100);
      break;
    case 'matter.create':
      string(args.title,'Título',200);string(args.client,'Cliente',200);
      if(!['MX-FED','MX-CMX'].includes(args.jurisdiction))throw new Error('Jurisdicción no disponible.');
      break;
    case 'reminder.create':
      if(!['deadline','followup','draft-suggestion'].includes(args.kind))throw new Error('Tipo de recordatorio inválido.');
      string(args.title,'Título',200);
      if(args.note!==undefined&&args.note!==null&&typeof args.note!=='string')throw new Error('Nota: valor inválido.');
      if(typeof args.note==='string'&&args.note.length>3600)throw new Error('Nota: valor inválido.');
      if(args.dueAt!==undefined&&args.dueAt!==null&&typeof args.dueAt!=='string')throw new Error('Fecha y hora inválidas.');
      break;
    case 'document.import':
      if(origin!=='user')throw new Error('Solo contenido proporcionado por la persona usuaria puede importarse.');
      string(args.name,'Nombre',200);
      if(typeof args.base64!=='string'||!args.base64.length||args.base64.length>13_981_016||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(args.base64))throw new Error('Contenido de documento inválido o demasiado grande.');
      break;
    case 'answer.export':
      if(!identifier(args.answerId))throw new Error('Respuesta inválida.');
      break;
  }
  return {definition,args:{...args},matterId:matterId??null,action,origin};
}

export function agentArgsHash(args) {return createHash('sha256').update(JSON.stringify(args)).digest('hex');}

/** Never expose supplied document bytes/text while listing pending approvals. */
export function proposalView(proposal) {
  const args={...proposal.args};
  if(proposal.action==='document.import') {
    const bytes=Buffer.from(args.base64,'base64');
    delete args.base64;
    args.contentBytes=bytes.length;
    args.contentSha256=createHash('sha256').update(bytes).digest('hex');
  }
  return {...proposal,args};
}
