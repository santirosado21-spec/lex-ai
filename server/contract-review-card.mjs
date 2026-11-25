// Manual work product only. No generation, legal inference or remote retrieval.
import {createHash} from 'node:crypto';
import {canonicalJson} from './canonical-json.mjs';
import {readFileSync} from 'node:fs';
import {exportContractReviewCard} from './contract-review-card-export.mjs';
import {caseSources} from './intake-sources.mjs';
import {openReviewedDocument} from './privacy/intake-document-map.mjs';
const hash=text=>createHash('sha256').update(text).digest('hex');
const exact=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))throw Error('Campos de ficha inválidos.');};
const plain=(v,max,required=false)=>{if(typeof v!=='string'||v.length>max||required&&!v.trim()||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(v))throw Error('Texto de ficha inválido.');return v;};
export function createContractReviewCards({store,current,legalSources=[]}){
 const laws=()=>legalSources.filter(s=>/^legal-snapshots\/[a-z]+\.pdf$/.test(s.snapshotPath??'')).map(s=>{
  const bytes=readFileSync(new URL('../resources/'+s.snapshotPath,import.meta.url));
  if(hash(s.text)!==s.sha256||hash(bytes)!==s.originalSha256)throw Error('La copia jurídica no supera su integridad.');
  return {id:s.id,label:s.title+' · '+s.article,text:s.text,sha256:s.sha256,pdfSha256:s.originalSha256,version:s.version,url:s.url,pages:s.pages,retrievedAt:s.retrievedAt,jurisdiction:s.jurisdiction,warning:'Copia local. Vigencia y aplicabilidad no verificadas.'};
 });
 function context(){const saved=current();if(!store.protectedRecords||!saved||saved.intake.workspaceId!==saved.firm.id||saved.intake.matterId!==saved.entry.id||saved.entry.workspaceId!==saved.firm.id)throw Error('Abre un expediente cifrado.');return saved;}
 function materials(saved){return {documents:caseSources(saved.intake).map(s=>{const text=openReviewedDocument(s.document,saved.firm.id,saved.entry.id).original;return {id:s.id,label:s.label,text,sha256:hash(text)};}),laws:laws()};}
 function citation(value,rows,legal=false){exact(value,['id','sha256','start','end','quote',...(legal?['pdfSha256','version']:[])]);const row=rows.find(s=>s.id===value.id);if(!row||legal&&(row.pdfSha256!==value.pdfSha256||row.version!==value.version)||row.sha256!==value.sha256||!Number.isSafeInteger(value.start)||!Number.isSafeInteger(value.end)||value.start<0||value.end<=value.start||value.end>row.text.length||value.end-value.start>1600||!value.quote?.trim()||row.text.slice(value.start,value.end)!==value.quote)throw Error('La evidencia cambió o no corresponde al texto. Vuelve a seleccionarla.');return {...value};}
 return {dispatch(action,payload){
  const saved=context();
  if(action==='intake.reviewMaterials'){exact(payload,[]);return materials(saved);}
  if(action==='intake.reviewCards'){exact(payload,[]);let m;try{m=materials(saved);}catch{m={documents:[],laws:[]};}return {cards:(saved.intake.contractReviewCards??[]).map(card=>{let evidenceCurrent=true;try{citation(card.input.document,m.documents);if(card.input.law){citation(card.input.law,m.laws,true);const law=m.laws.find(r=>r.id===card.input.law.id);if(law.pdfSha256!==card.legal?.pdfSha256||law.version!==card.legal?.version)evidenceCurrent=false;}}catch{evidenceCurrent=false;}return {...card,evidenceCurrent};})};}
  if(action==='intake.exportReviewCard'){
   exact(payload,['id','revision']);
   const card=(saved.intake.contractReviewCards??[]).find(c=>c.id===payload.id);
   if(!card||!Number.isSafeInteger(payload.revision)||card.revision!==payload.revision)throw Error('La ficha guardada cambió. Recarga antes de exportar.');
   const checked=this.dispatch('intake.reviewCards',{}).cards.find(c=>c.id===card.id);
   const exportContext=value=>canonicalJson([value.firm.id,value.entry.id,value.intake.id,value.firm.name??null,value.entry.client??null,value.entry.title??null]);
   const snapshot=canonicalJson(card),scope=exportContext(saved);
   return exportContractReviewCard({firm:saved.firm,matter:saved.entry,card:checked}).then(file=>{
    const active=context(),latest=(active.intake.contractReviewCards??[]).find(c=>c.id===card.id);
    if(exportContext(active)!==scope||!latest||canonicalJson(latest)!==snapshot)throw Error('El expediente o la ficha cambió durante la exportación. Repite desde el guardado actual.');
    const still=this.dispatch('intake.reviewCards',{}).cards.find(c=>c.id===card.id);
    if(still?.evidenceCurrent!==checked.evidenceCurrent)throw Error('La evidencia cambió durante la exportación. Recarga antes de exportar.');
    store.audit('intake.local.exportReviewCard',card.id);return file;
   });
  }
  exact(payload,['id','revision','document','law','kind','observation','nextStep','status','partyRole','jurisdiction','asOf','coverage']);
  if(typeof payload.id!=='string'||!/^[-a-f0-9]{36}$/.test(payload.id)||!Number.isSafeInteger(payload.revision)||payload.revision<0)throw Error('Identidad de ficha inválida.');
  for(const [key,max] of [['observation',2400],['nextStep',1200],['partyRole',120],['jurisdiction',120],['asOf',10]])plain(payload[key],max,key==='observation');
  if(payload.asOf&&(!/^\d{4}-\d{2}-\d{2}$/.test(payload.asOf)||!Number.isFinite(Date.parse(payload.asOf))||new Date(payload.asOf).toISOString().slice(0,10)!==payload.asOf))throw Error('Fecha inválida.');
  if(!['documental','negociacion','juridica-manual'].includes(payload.kind)||!['pendiente','revisado-por-usuario'].includes(payload.status)||!['no-declarada','excerpt','full'].includes(payload.coverage))throw Error('Estado de ficha inválido.');
  return store.transaction(()=>{
   const active=context(),rows=active.intake.contractReviewCards??[],previous=rows.find(r=>r.id===payload.id),m=materials(active);
   const document=citation(payload.document,m.documents),law=payload.law===null?null:citation(payload.law,m.laws,true);
   const body={...payload,document,law};
   if(previous&&previous.revision===payload.revision+1&&canonicalJson(previous.input)===canonicalJson(body))return previous;
   if((previous?.revision??0)!==payload.revision||!previous&&rows.length>=40)throw Error('La ficha cambió. Conserva tus cambios y recarga antes de guardar.');
   const legal=law?m.laws.find(r=>r.id===law.id):null;
   if(previous&&previous.input.document.id===document.id&&previous.input.document.sha256!==document.sha256)throw Error('El texto contractual cambió. Crea otra ficha tras revisarlo.');
   if(previous&&previous.input.document.id===document.id&&previous.input.coverage==='excerpt'&&payload.coverage==='full')throw Error('Un extracto no se convierte en revisión completa en esta ficha. Crea otra ficha con la cobertura correcta.');
   if(previous?.input.law&&law?.id===previous.input.law.id&&(previous.legal?.pdfSha256!==legal.pdfSha256||previous.legal?.version!==legal.version))throw Error('La edición jurídica cambió. Crea otra ficha tras revisarla.');
   const card={id:payload.id,revision:payload.revision+1,input:body,documentLabel:m.documents.find(r=>r.id===document.id).label,legal:legal?{...legal,text:undefined}:null,updatedAt:new Date().toISOString(),authorship:'Comentario manual del usuario. La integridad textual no valida el razonamiento.'};
   store.put('intake-pilot',{...active.intake,contractReviewCards:[...rows.filter(r=>r.id!==payload.id),card]});store.audit('intake.local.contractReviewCard',active.entry.id);return card;
  });
 }};
}
