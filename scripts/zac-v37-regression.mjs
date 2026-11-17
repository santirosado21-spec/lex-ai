// Regresion v37 vs candidato v36c: por documento (misma capa), compara registros articulo/transitorio/prefacio por id+hash de texto. Solo lectura.
import fs from 'node:fs';import path from 'node:path';
const m=JSON.parse(fs.readFileSync('docs/qa/zac-candidato-v36c-manifest-2026-11-17.json','utf8'));
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):e.name.endsWith('.json')?[path.join(d,e.name)]:[]);
const key=e=>[...(e.records||[]).map(r=>`${r.recordKind??'articulo'}|${r.articleId??r.ordinalLabel}|${r.textSha256}`),...(e.transitories||[]).map(r=>`t|${r.ordinalLabel}|${r.textSha256}`),...(e.prefaceRecords||[]).map(r=>`p|${r.articleId}|${r.textSha256}`)].sort();
let same=0,diff=[];
for(const d of m.documents_list){
  const dir=d.dir.replace('zac-v36c-','zac-v37-');const cand=path.join('artifacts/public-corpus',d.dir,d.extractionPath);const e0=JSON.parse(fs.readFileSync(cand));
  const rep=JSON.parse(fs.readFileSync(path.join('artifacts/public-corpus',dir,'report.json'))).documents.find(x=>x.id===d.documentId);
  const f=rep?[path.join('artifacts/public-corpus',dir,'extractions',d.documentId,d.pdfSha256,rep.extractionConfigSha256+'.json')].filter(fs.existsSync):[];
  const e1=f.length?JSON.parse(fs.readFileSync(f[0])):null;
  if(!e1){diff.push({id:d.documentId,why:'sin extraccion v37'});continue;}
  const a=key(e0),b=key(e1);if(JSON.stringify(a)===JSON.stringify(b))same++;else{const sa=new Set(a),sb=new Set(b);diff.push({id:d.documentId,layer:d.layer,solo36c:a.filter(x=>!sb.has(x)).length,solo37:b.filter(x=>!sa.has(x)).length,v37:e1.extractorVersion});}
}
console.log(JSON.stringify({documentos:m.documents_list.length,identicos:same,diferentes:diff.length,detalle:diff.slice(0,30)}));
