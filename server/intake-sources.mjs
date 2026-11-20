import {certifiedWorkbook} from './corpus/practice-workbook.mjs';
import {tradeDocumentAnchorValues} from './privacy/trade-document-structure.mjs';
import {createHash,randomUUID} from 'node:crypto';
import {bindReviewedDocument,openReviewedDocument} from './privacy/intake-document-map.mjs';

const types={xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',txt:'text/plain',md:'text/markdown'};
const primaryLabels={contrato:'Contrato inicial',factura:'Factura inicial',pedimento:'Pedimento inicial',otro:'Soporte inicial'};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

export function caseSources(intake){
 if(!intake?.document)return [];
 return [{...(intake.primarySource??{id:'principal',label:primaryLabels[intake.documentKind]??'Soporte inicial'}),document:intake.document},...(intake.supports??[])];
}
export function sourceSummary(source){
 const {id,label,extension,byteHash}=source;
 const certificate=certifiedWorkbook(source);
 return {id,label,extension:extension??null,hasFile:Boolean(byteHash),...(certificate?{practiceQuestion:certificate.question}:{})};
}
export function knownParties(saved){
 return [saved.firm.name,saved.entry.client,saved.entry.title,saved.intake.supplier,
  ...caseSources(saved.intake).flatMap(row=>{
   const view=openReviewedDocument(row.document,saved.firm.id,saved.entry.id);
   return [...view.tokens.map(item=>item.value),...tradeDocumentAnchorValues(view.original)];
  })];
}
export function addCaseSource(store,saved,review,label){
 if(typeof label!=='string'||!label.trim()||label.length>100||/[\p{Cc}\[\]]/u.test(label))throw Error('Escribe un nombre local de hasta 100 caracteres.');
 const {intake,firm,entry}=saved,sources=caseSources(intake);
 const bytes=Buffer.from(review.base64,'base64'),byteHash=digest(bytes);
 const duplicate=sources.find(row=>row.byteHash===byteHash);
 if(duplicate)return {id:duplicate.id,duplicate:true};
 const document=bindReviewedDocument(review.protection,firm.id,entry.id);
 const info={id:randomUUID(),label:label.trim(),byteHash,extension:review.extension,...(review.extension==='xlsx'?{contextComplete:!review.protection.contextUnavailable}:{})};
 const original={id:info.id,matterId:entry.id,workspaceId:firm.id,base64:review.base64};
 store.put('intake-source',original);
 const next=intake.document?{supports:[...(intake.supports??[]),{...info,document}]}:
  {document,primarySource:info,documentKind:review.documentKind};
 store.put('intake-pilot',{...intake,...next});
 store.audit('intake.local.addSource',entry.id);
 return {id:info.id,duplicate:false};
}
export function readCaseFile(store,saved,id){
 const source=caseSources(saved.intake).find(row=>row.id===id);
 if(!source?.byteHash)throw Error('Este soporte conserva únicamente el texto extraído.');
 const original=store.get('intake-source',source.id,saved.entry.id);
 if(original?.workspaceId!==saved.firm.id||digest(Buffer.from(original.base64,'base64'))!==source.byteHash)
  throw Error('No se pudo verificar el original del expediente.');
 return {name:'Rejon-'+source.label.replace(/[^\p{L}\p{N} -]/gu,'_')+'.'+source.extension,base64:original.base64,mime:types[source.extension]};
}
export function openedCaseSources(saved){
 const rows=caseSources(saved?.intake);
 return rows.map((row,i)=>({
  id:row.id,label:'Documento '+(i+1)+' · '+row.label,
  original:openReviewedDocument(row.document,saved.firm.id,saved.entry.id).original,
  attribution:rows.length>1?{sourceId:row.id,sourceLabel:'Documento '+(i+1)+' · '+row.label}:{},
 }));
}
export function openedComparisonSources(saved){
 const all=caseSources(saved.intake);
 const pair=saved.intake.comparisonPair;
 return (pair?pair.map(id=>all.find(s=>s.id===id)):all.slice(0,1)).map(row=>{
  if(!row)throw Error('Falta un documento del cotejo.');
  return {id:row.id,label:'Documento '+(all.indexOf(row)+1)+' · '+row.label,original:openReviewedDocument(row.document,saved.firm.id,saved.entry.id).original};
 });
}
