// Manifiesto del corte Guerrero v37 (CUARENTENA). Regla de seleccion por documento, determinista y trazable:
// Poppler por defecto (separa transitorios); pdf-parse solo si Poppler extrae MENOS articulos o MAS huecos que pdf-parse.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');const docs=[];
const load=(layer,n,d)=>{const dir=`gro-v37-${layer}-${n}-2026-11-17`;const rep=JSON.parse(fs.readFileSync(`artifacts/public-corpus/${dir}/report.json`)).documents.find(x=>x.id===d.id);if(!rep||rep.state!=='quarantined')return null;const p=path.join('extractions',d.id,rep.pdfSha256,rep.extractionConfigSha256+'.json');const bytes=fs.readFileSync(path.join('artifacts/public-corpus',dir,p));const e=JSON.parse(bytes);
 const arts=e.records.filter(r=>(r.recordKind??'articulo')==='articulo');const nums=new Set(arts.map(r=>parseInt(r.articleId)).filter(Number.isFinite));const mx=Math.max(0,...nums);const gaps=[];for(let i=1;i<=mx;i++)if(!nums.has(i))gaps.push(i);
 return {dir,layer,extractionPath:p,extractionFileSha256:sha(bytes),pdfSha256:rep.pdfSha256,extractorVersion:e.extractorVersion,articulos:arts.length,transitorios:e.records.filter(r=>r.recordKind==='transitorio').length,prefacio:e.records.filter(r=>r.recordKind==='prefacio-articulo-citado').length,maxArticulo:mx,huecos:gaps,status:e.status,published:e.published,indexed:e.indexed,textReview:e.textReview,legalReview:e.legalReview};};
const excluded=[];
for(let b=1;b<=14;b++){const n=String(b).padStart(2,'0');const rep=JSON.parse(fs.readFileSync(`artifacts/public-corpus/gro-oficial-${n}-2026-11-17/report.json`));
 for(const d of rep.documents){const a=load('pdfparse',n,d),p=load('poppler',n,d);if(!a||!p){excluded.push({id:d.id,motivo:d.state+(d.errorCategory?':'+d.errorCategory:'')});continue;}
  const usePdf=p.articulos<a.articulos||p.huecos.length>a.huecos.length;const s=usePdf?a:p;docs.push({documentId:d.id,batch:n,...s,motivoSeleccion:usePdf?'poppler-pierde-articulos-o-agrega-huecos':'poppler-por-defecto'});}}
const tot=docs.reduce((t,x)=>({documentos:t.documentos+1,articulos:t.articulos+x.articulos,transitorios:t.transitorios+x.transitorios,prefacio:t.prefacio+x.prefacio,conHuecos:t.conHuecos+(x.huecos.length>0)}),{documentos:0,articulos:0,transitorios:0,prefacio:0,conHuecos:0});
const bad=docs.filter(x=>x.status!=='quarantined'||x.published!==false||x.indexed!==false||x.legalReview!=='pending').length;
const m={kind:'guerrero-v37-quarantined-cut-manifest',nota:'CUARENTENA. Adquisicion parcial: no es validacion, liberacion ni vigencia certificada. Sin paridad Luthor.',extractorVersion:37,totales:tot,estadosIndebidos:bad,excluidos:excluded,documents_list:docs};
fs.writeFileSync('docs/qa/gro-corte-v37-manifest-2026-11-17.json',JSON.stringify(m,null,1)+'\n');
console.log(JSON.stringify({tot,bad,excluded,poppler:docs.filter(x=>x.layer==='poppler').length,pdfparse:docs.filter(x=>x.layer==='pdfparse').map(x=>x.documentId),conHuecos:docs.filter(x=>x.huecos.length).map(x=>[x.documentId,x.articulos,x.maxArticulo,x.huecos.length,x.huecos.slice(0,6).join(',')])}));
