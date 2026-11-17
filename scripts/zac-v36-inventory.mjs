// Inventario por id de las extracciones v36 (dos capas) vs la extraccion v33 original. Control interno, NO validacion legal ni liberacion.
import fs from 'fs';import path from 'path';
const root='artifacts/public-corpus';const V=process.env.V||'v36';const out={};
const load=dir=>{const rep=JSON.parse(fs.readFileSync(path.join(dir,'report.json'),'utf8'));const m={};for(const d of rep.documents){if(!d.extractionPath){m[d.id]={state:d.state};continue;}
 const e=JSON.parse(fs.readFileSync(path.join(dir,d.extractionPath),'utf8'));const arts=e.records.filter(r=>(r.recordKind??'articulo')==='articulo');const tr=e.records.filter(r=>r.recordKind==='transitorio');
 const nums=arts.map(r=>r.articleId).filter(a=>/^\d+$/.test(a)).map(Number);const set=new Set(nums);const mx=nums.length?Math.max(...nums):0;const gaps=[];for(let n=1;n<=mx;n++)if(!set.has(n))gaps.push(n);
 m[d.id]={state:d.state,articles:arts.length,transitorios:tr.length,prefacioPreservado:e.records.filter(r=>r.recordKind==='prefacio-articulo-citado').length,declaredPublicationAt:e.declaredPublicationAt??null,maxNumeric:mx,sequenceGaps:gaps,declaredAmendedAt:e.declaredAmendedAt,anomalies:e.documentAnomalies,parser:e.coverage?.parser?.engine??'pdf-parse',extractorConfigSha256:e.configSha256};}return m;};
// Original v33 dirs: read the extraction files directly (batch 10's report.json was overwritten by an earlier single-document offline run, so the report is not a reliable index).
const loadOrig=dir=>{const m={};const ex=path.join(dir,'extractions');for(const id of fs.readdirSync(ex)){const pdfs=fs.readdirSync(path.join(ex,id));const files=pdfs.flatMap(p=>fs.readdirSync(path.join(ex,id,p)).map(f=>path.join(ex,id,p,f)));
 if(!files.length){m[id]={state:'no-extraction'};continue;}const e=JSON.parse(fs.readFileSync(files[0],'utf8'));m[id]={state:'quarantined',articles:e.records.filter(r=>(r.recordKind??'articulo')==='articulo').length};}return m;};
for(let i=1;i<=15;i++){const n=String(i).padStart(2,'0');
 const o=loadOrig(`${root}/zac-oficial-${n}-2026-11-17`),a=load(`${root}/zac-${V}-pdfparse-${n}-2026-11-17`),b=load(`${root}/zac-${V}-poppler-${n}-2026-11-17`);
 for(const id of Object.keys(b))out[id]={v33:{articles:o[id]?.articles??null,state:o[id]?.state??'no-extraction'},pdfparse_v36:a[id],poppler_v36:b[id]};}
fs.writeFileSync(`docs/qa/zac-${V}-inventory-2026-11-17.json`,JSON.stringify(out,null,1));
const ids=Object.keys(out);const sum=(k,f)=>ids.reduce((s,id)=>s+(out[id][k]?.[f]??0),0);
console.log({docs:ids.length,v33_articles:ids.reduce((s,id)=>s+(out[id].v33.articles??0),0),pdfparse_articles:sum('pdfparse_v36','articles'),poppler_articles:sum('poppler_v36','articles'),pdfparse_trans:sum('pdfparse_v36','transitorios'),poppler_trans:sum('poppler_v36','transitorios'),
 pdfparse_withdate:ids.filter(id=>out[id].pdfparse_v36?.declaredAmendedAt).length,poppler_withdate:ids.filter(id=>out[id].poppler_v36?.declaredAmendedAt).length,
 poppler_prefacio:sum('poppler_v36','prefacioPreservado'),pdfparse_prefacio:sum('pdfparse_v36','prefacioPreservado'),withPubDate:ids.filter(id=>out[id].poppler_v36?.declaredPublicationAt).length,poppler_withgaps:ids.filter(id=>out[id].poppler_v36?.sequenceGaps?.length).length,pdfparse_withgaps:ids.filter(id=>out[id].pdfparse_v36?.sequenceGaps?.length).length});
