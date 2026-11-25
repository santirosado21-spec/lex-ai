// Fixed preannotated synthetic practice, not a detector or an import route.
import {createHash} from 'node:crypto';
import {bindReviewedDocument,openReviewedDocument} from './privacy/intake-document-map.mjs';
const folio='ENSAYO-NATIVO-4702';
const texts=[`Contrato ficticio ${folio}.\n\nEntrega en 20 días. El comprador acepta la revisión.`,`Contrato ficticio ${folio}.\n\nEntrega en 30 días. El comprador no acepta la revisión.`];
export const nativePractice=Object.freeze({id:'native-compare-v1',sha256:createHash('sha256').update(JSON.stringify(texts)).digest('hex'),documents:2});
const expectedHash='8671e63a999e62fb661229b238396d32be494e2c302996cb6c586fb55c3485e0';
export function installNativePractice({store,workspace,createWorkspace,createMatter}){
 if(nativePractice.sha256!==expectedHash)throw Error('La práctica fija no supera su huella.');
 if(!store.protectedRecords)throw Error('La práctica requiere cifrado.');
 return store.transaction(()=>{
  const existing=workspace();
  if(existing){const intake=store.list('intake-pilot')[0];if(store.list('intake-pilot').length===1&&store.list('matter').length===1&&intake?.workspaceId===existing.id&&intake?.nativePractice?.sha256===nativePractice.sha256&&intake.primarySource?.id==='native-practice-a'&&intake.supports?.length===1&&intake.supports[0].id==='native-practice-b'&&[intake.document,intake.supports[0].document].every((doc,i)=>openReviewedDocument(doc,existing.id,intake.matterId).original===texts[i]))return {loaded:true,duplicate:true,...nativePractice};throw Error('La práctica requiere un expediente vacío.');}
  if(!store.protectedRecords||store.list('matter').length||store.list('intake-pilot').length)throw Error('La práctica requiere un expediente cifrado vacío.');
  const firm=createWorkspace({name:'Despacho ficticio de práctica',practiceAreas:['Mercantil']});
  const entry=createMatter({client:'Cliente ficticio de práctica',title:'Cotejo sintético preanotado',jurisdiction:'MX-FED'});
  const documents=texts.map(text=>{const start=text.indexOf(folio);return bindReviewedDocument({restored:text,needsReview:true,parts:[{text:text.slice(0,start)},{start,end:start+folio.length,label:'Folio sintético'},{text:text.slice(start+folio.length)}]},firm.id,entry.id);});
  store.put('intake-pilot',{id:'intake-'+firm.id,workspaceId:firm.id,matterId:entry.id,documentKind:'contrato',document:documents[0],primarySource:{id:'native-practice-a',label:'Contrato ficticio · Base'},supports:[{id:'native-practice-b',label:'Contrato ficticio · Revisión',document:documents[1]}],drafts:{},nativePractice:{...nativePractice,preannotated:true}});
  store.audit('intake.native.fixedPractice',entry.id);
  return {loaded:true,duplicate:false,...nativePractice};
 });
}
