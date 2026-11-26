// Document-specific preservation, not a general legal-classification rule.
// Bound to the reviewed 90-page Chamber PDF. Every original tail byte remains
// in postBodyRecords.rawText; normalized transitories are separate views.
import {createHash} from 'node:crypto';
const SHA='bcdfcd9073014aec4aefbacc01c9dd5b1f97f0da0c4556f0f506d20f12d77812';
const digest=s=>createHash('sha256').update(s).digest('hex');
const normalized=s=>s.replace(/\s+/gu,' ').trim();
export function regulationPostBody(pages,source,{pdfSha256,versionId,lines}){
 if(pdfSha256!==SHA||source.lawId!=='MX-FED-REG-LADUA')return null;
 if(pages.length!==90||pages.some((p,i)=>p.number!==i+1))throw Error('Reglamento post-body page sequence changed');
 const markerCount=text=>(text.match(/TRANSITORIOS/g)??[]).length;
 if(markerCount(pages[80].text)!==1||markerCount(pages[88].text)!==1)throw Error('Reglamento post-body boundaries ambiguous');
 const first=pages[80].text.indexOf('TRANSITORIOS');
 const last=pages[88].text.lastIndexOf('TRANSITORIOS');
 if(first<0||last<0||!pages[88].text.includes('ARTÍCULO ÚNICO'))throw Error('Reglamento post-body boundaries changed');
 const excludedLines=[];
 // The pinned document's running title is not a provision, even if source.title
 // is an abbreviated catalog label. Preserve it in raw and log this view-only exclusion.
 lines=lines.filter(l=>{
  if(l.page<81||normalized(l.text)!=='REGLAMENTO DE LA LEY ADUANERA')return true;
  const rawLineIndices=pages[l.page-1].text.split('\n').flatMap((text,i)=>normalized(text)===normalized(l.text)?[i]:[]);
  excludedLines.push({...l,rawLineIndices,reason:'pinned-running-title'});
  return false;
 });
 const reformLines=lines.filter(l=>l.page>=89);
 const markers=reformLines.flatMap((l,i)=>l.text==='TRANSITORIOS'?[i]:[]);
 if(markers.length!==1)throw Error('Reglamento normalized transitory boundary missing or ambiguous');
 const records=[];
 const add=(kind,group,parts)=>{
  const rawText=parts.map(p=>p.text).join('');
  records.push({id:`${versionId}:post:${records.length+1}`,lawId:source.lawId,versionId,recordKind:kind,group,classificationVersion:1,pdfSha256:SHA,sourceUrl:source.url,sourcePages:parts.map(p=>p.page),pageTexts:parts,rawText,textSha256:digest(rawText),quality:{status:'quarantined',legalAccuracy:'not-evaluated',currentness:'unverified'}});
 };
 add('original-transitory-block','reglamento-original-2015',[{page:81,text:pages[80].text.slice(first)}]);
 for(let page=82;page<=88;page++)add('rgce-amount-annex','rgce-amount-annex-page-'+page,[{page,text:pages[page-1].text}]);
 add('amendment-decree','decreto-reforma-2026-02-23',[{page:89,text:pages[88].text.slice(0,last)}]);
 add('reform-transitory-block','decreto-reforma-2026-02-23',[{page:89,text:pages[88].text.slice(last)},{page:90,text:pages[89].text}]);
 const expected=pages[80].text.slice(first)+pages.slice(81).map(p=>p.text).join('');
 if(records.map(r=>r.rawText).join('')!==expected)throw Error('Reglamento post-body preservation failed');
 const transitories=[];
 const ORD=/^(Primero|Segundo|Tercero|Cuarto|Quinto|Sexto)\./i;
 for(const [group,subset,count] of [
  ['reglamento-original-2015',lines.filter(l=>l.page===81),6],
  ['decreto-reforma-2026-02-23',reformLines.slice(markers[0]+1),5],
 ]){
  let cur=null;let found=0;
  const flush=()=>{if(!cur)return;const text=normalized(cur.lines.map(l=>l.text).join(' '));transitories.push({id:`${versionId}:trans:${transitories.length+1}`,lawId:source.lawId,versionId,ordinal:cur.ordinal,group,text,sourcePages:[...new Set(cur.lines.map(l=>l.page))],textSha256:digest(text),recordKind:'transitorio',quality:{status:'quarantined',legalAccuracy:'not-evaluated',currentness:'unverified'}});cur=null;};
  for(const l of subset){if(/^Dado en|^Ciudad de México|^En cumplimiento/i.test(l.text)){flush();break;}const m=ORD.exec(l.text);if(m){flush();found++;cur={ordinal:m[1].toUpperCase(),lines:[l]};}else if(cur)cur.lines.push(l);}
  flush();if(found!==count)throw Error('Reglamento transitory heading count changed');
 }
 return {postBodyRecords:records,transitories,normalizationExclusions:excludedLines};
}
