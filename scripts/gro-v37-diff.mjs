// Compara por documento la extraccion v36 (gro-oficial) con v37 (gro-v37): ids de articulo ganados/perdidos y texto cambiado. Solo lectura.
import fs from 'node:fs';import path from 'node:path';
const load=(prefix,n,d)=>{const dir=`artifacts/public-corpus/${prefix}-${n}-2026-11-17`;const rep=JSON.parse(fs.readFileSync(path.join(dir,'report.json'))).documents.find(x=>x.id===d.id);return JSON.parse(fs.readFileSync(path.join(dir,'extractions',d.id,d.pdfSha256,rep.extractionConfigSha256+'.json')));};
const out={igual:0,mejora:[],cambioSinPerdida:[],perdidas:[]};
for(let b=1;b<=14;b++){const n=String(b).padStart(2,'0');const rep=JSON.parse(fs.readFileSync(`artifacts/public-corpus/gro-oficial-${n}-2026-11-17/report.json`));
 for(const d of rep.documents){if(d.state!=='quarantined')continue;const a=load('gro-oficial',n,d),c=load('gro-v37',n,d);
  const A=new Map(a.records.filter(r=>(r.recordKind??'articulo')==='articulo').map(r=>[r.articleId,r.textSha256])),C=new Map(c.records.filter(r=>(r.recordKind??'articulo')==='articulo').map(r=>[r.articleId,r.textSha256]));
  const lost=[...A.keys()].filter(k=>!C.has(k)),gained=[...C.keys()].filter(k=>!A.has(k)),changed=[...A.keys()].filter(k=>C.has(k)&&C.get(k)!==A.get(k));
  if(!lost.length&&!gained.length&&!changed.length)out.igual++;
  else if(lost.length)out.perdidas.push({id:d.id,lost:lost.slice(0,10),n:lost.length,gained:gained.length,changed:changed.length});
  else out.mejora.push({id:d.id,gained:gained.length,changed:changed.length,antes:A.size,despues:C.size});}}
console.log(JSON.stringify({igual:out.igual,conGanancia_sinPerdida:out.mejora.length,conPerdida:out.perdidas.length,perdidas:out.perdidas,mejora:out.mejora}));
