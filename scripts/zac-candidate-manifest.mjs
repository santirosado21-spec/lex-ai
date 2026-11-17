// Manifiesto del CANDIDATO (no liberacion): una extraccion por documento segun el mapa de seleccion del revisor (v36c), con sha256 de cada archivo.
import fs from 'fs';import path from 'path';import crypto from 'crypto';
const map=JSON.parse(fs.readFileSync('docs/qa/zac-mapa-seleccion-v36c-revisor-2026-11-17.json','utf8'));
const root='artifacts/public-corpus';const out=[];
for(let i=1;i<=15;i++){const n=String(i).padStart(2,'0');
 for(const layer of ['pdfparse','poppler']){const dir=`${root}/zac-v36c-${layer}-${n}-2026-11-17`;const rep=JSON.parse(fs.readFileSync(`${dir}/report.json`,'utf8'));
  for(const d of rep.documents){const sel=map.por_documento[d.id]?.layer;const want=sel==='poppler'?'poppler':'pdfparse';if(want!==layer||!d.extractionPath)continue;
   const file=`${dir}/${d.extractionPath}`;const buf=fs.readFileSync(file);const e=JSON.parse(buf);const k=e.records.reduce((a,r)=>{const t=r.recordKind??'articulo';a[t]=(a[t]||0)+1;return a;},{});
   out.push({documentId:d.id,layer,extractionPath:d.extractionPath,dir:path.basename(dir),extractionFileSha256:crypto.createHash('sha256').update(buf).digest('hex'),pdfSha256:e.pdfSha256,configSha256:e.configSha256,sourceUrl:e.sourceUrl,declaredPublicationAt:e.declaredPublicationAt,declaredAmendedAt:e.declaredAmendedAt,records:k,status:e.status,published:e.published,indexed:e.indexed,textReview:e.textReview,legalReview:e.legalReview,anomalies:e.documentAnomalies});}}}
const res={kind:'zacatecas-release-candidate-manifest',state:'cuarentena - candidato, nada liberado',mapa:'docs/qa/zac-mapa-seleccion-v36c-revisor-2026-11-17.json',generatedFrom:'v36c (part-14, commit 528458a)',documents:out.length,documents_list:out};
fs.writeFileSync('docs/qa/zac-candidato-v36c-manifest-2026-11-17.json',JSON.stringify(res,null,1));
const tot={};for(const o of out)for(const [k,v] of Object.entries(o.records))tot[k]=(tot[k]||0)+v;
console.log(out.length,tot,'flags:',[...new Set(out.map(o=>[o.status,o.published,o.indexed,o.textReview,o.legalReview].join('/')))]);
