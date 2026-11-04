import {createHash,randomUUID} from 'node:crypto';
import {buildAnswerDocx,DOCX_MIME} from './docx-export.mjs';

const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const id=value=>typeof value==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(value);
const fields=(p,allowed)=>{if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(key=>!allowed.includes(key)))throw Error('Parámetros de escrito inválidos.');};
const bounded=(value,label,max)=>{if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw Error(`${label} inválido.`);return value.trim();};

export function createReplyDrafts({store,workspace,matter,openFile,clock=()=>new Date()}){
 const stamp=()=>new Date(clock()).toISOString();
 const owner=()=>{const w=workspace();if(!w)throw Error('Primero crea el espacio del despacho.');return w;};
 function source(p){
  if(!id(p.replyId)||typeof p.matterId!=='string')throw Error('Respuesta inválida.');
  const w=owner(),m=p.matterId?matter(p.matterId):null;
  const reply=store.get('answer',p.replyId,p.matterId)||store.get('chat',p.replyId,p.matterId);
  if(!reply||reply.workspaceId&&reply.workspaceId!==w.id||!m&&reply.workspaceId!==w.id)throw Error('Respuesta no encontrada en este ámbito.');
  return {w,m,reply};
 }
 function checked(draftId,matterId){
  const w=owner();if(!id(draftId)||typeof matterId!=='string')throw Error('Escrito inválido.');if(matterId)matter(matterId);
  const draft=store.get('reply-draft',draftId,matterId);
  if(!draft||draft.workspaceId!==w.id)throw Error('Escrito no encontrado en este ámbito.');
  const original=source({replyId:draft.replyId,matterId});
  if(digest({text:original.reply.text,citations:original.reply.citations||[]})!==draft.originalHash)throw Error('La respuesta original cambió; revisa la procedencia del escrito.');
  return {draft,...original};
 }
 function view(draft){
  const versions=store.list('reply-draft-version',draft.matterId).filter(v=>v.draftId===draft.id&&v.workspaceId===draft.workspaceId).sort((a,b)=>a.version-b.version);
  return {...draft,versions,current:versions.at(-1),notice:'La respuesta original y sus fuentes se conservan. Los cambios editoriales requieren revisión y no heredan la comprobación de citas.'};
 }
 function get(p){
  fields(p,['replyId','matterId']);const {w,reply}=source(p);
  const existing=store.list('reply-draft',p.matterId).find(d=>d.replyId===reply.id&&d.workspaceId===w.id);
  if(existing)return view(checked(existing.id,p.matterId).draft);
  return store.transaction(()=>{
   const draft={id:randomUUID(),workspaceId:w.id,matterId:p.matterId,replyId:reply.id,originalHash:digest({text:reply.text,citations:reply.citations||[]}),original:{text:reply.text,citations:reply.citations||[],validation:reply.validation||null},createdAt:stamp(),updatedAt:stamp(),version:1};
   const first={id:randomUUID(),workspaceId:w.id,matterId:p.matterId,draftId:draft.id,version:1,title:(reply.question||'Respuesta de LEX AI').slice(0,200),text:reply.text,isOriginal:true,createdAt:stamp(),contentHash:digest({title:(reply.question||'Respuesta de LEX AI').slice(0,200),text:reply.text})};
   const initialized={...draft,current:first};store.put('reply-draft',initialized);store.put('reply-draft-version',first);store.audit('draft.create',draft.id);return view(initialized);
  });
 }
 function append(p,restoring=false){
  fields(p,restoring?['draftId','matterId','expectedVersion','restoreVersion']:['draftId','matterId','expectedVersion','title','text']);
  const {draft}=checked(p.draftId,p.matterId);
  if(!Number.isSafeInteger(p.expectedVersion)||p.expectedVersion!==draft.version)throw Error('El escrito cambió en otra ventana. Actualiza antes de guardar.');
  let title,text;
  if(restoring){const previous=view(draft).versions.find(v=>v.version===p.restoreVersion);if(!previous)throw Error('Versión no encontrada.');title=previous.title;text=previous.text;}
  else{title=bounded(p.title,'Título',200);text=bounded(p.text,'Texto',24000);}
  const contentHash=digest({title,text});
  return store.transaction(()=>{
   const live=store.get('reply-draft',draft.id,p.matterId);if(live.version!==p.expectedVersion)throw Error('El escrito cambió en otra ventana. Actualiza antes de guardar.');
   const current=view(live).current;if(current.contentHash===contentHash)return view(live);
   const version={id:randomUUID(),workspaceId:draft.workspaceId,matterId:draft.matterId,draftId:draft.id,version:live.version+1,title,text,contentHash,isOriginal:false,restoredFrom:restoring?p.restoreVersion:null,createdAt:stamp()};
   const updated={...live,version:version.version,current:version,updatedAt:stamp()};store.put('reply-draft-version',version);store.put('reply-draft',updated);store.audit(restoring?'draft.restore':'draft.save',draft.id);return view(updated);
  });
 }
 async function exportDraft(p){
  fields(p,['draftId','matterId','version']);const {draft,w,m,reply}=checked(p.draftId,p.matterId),snapshot=view(draft);
  const selected=p.version===undefined?snapshot.current:snapshot.versions.find(v=>v.version===p.version);if(!selected)throw Error('Versión no encontrada.');
  const edited=selected.version!==1;
  const answer={...reply,question:selected.title,text:(edited?'BORRADOR EDITADO POR EL USUARIO. Las referencias conservadas pertenecen a la respuesta original; el texto modificado no ha sido comprobado nuevamente.\n\n':'')+selected.text,citations:draft.original.citations,validation:{status:edited?'edited-draft-unverified':reply.validation?.status,citationIntegrity:!edited&&reply.validation?.citationIntegrity===true,requiresLawyerReview:true}};
  const bytes=await buildAnswerDocx({firm:w,matter:m||{title:'Conversación general del despacho'},answer});
  store.audit('draft.export',draft.id);return {name:`LEX-AI-escrito-v${selected.version}.docx`,mime:DOCX_MIME,base64:bytes.toString('base64')};
 }
 function presentMany(replies){
  const w=workspace();if(!w)return replies;
  const byReply=new Map(store.list('reply-draft').filter(d=>d.workspaceId===w.id).map(d=>[d.replyId,d]));
  return replies.map(reply=>{
   const draft=byReply.get(reply.id);if(!draft||draft.version<=1||draft.matterId!==(reply.matterId||''))return reply;
   if(digest({text:reply.text,citations:reply.citations||[]})!==draft.originalHash)return reply;
   const current=draft.current||view(draft).current;
   return {...reply,text:current.text,citations:[],editedDraft:{id:draft.id,version:current.version,title:current.title,originalHash:draft.originalHash},validation:{status:'edited-draft-unverified',citationIntegrity:false,requiresLawyerReview:true,legalAccuracy:'not-evaluated',checks:[]}};
  });
 }
 return {get,save:p=>append(p),restore:p=>append(p,true),export:exportDraft,presentMany,
  async open(p){if(!openFile)throw Error('Abrir escritos está disponible en la app de escritorio. Puedes exportar el DOCX.');const exported=await exportDraft(p);return openFile({name:exported.name,bytes:Buffer.from(exported.base64,'base64')});},
  list(){const w=workspace();return w?store.list('reply-draft').filter(d=>d.workspaceId===w.id).map(d=>view(d)):[];},
 };
}
