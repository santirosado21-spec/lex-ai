// Inventario de lotes Guerrero (solo lectura): articulos, transitorios, huecos de secuencia por documento, estados.
// P=<prefijo de dirs> (gro-oficial | gro-v37). Selecciona, por documento, la extraccion que cita el report.json del lote.
import fs from 'node:fs';import path from 'node:path';
const prefix=process.env.P||'gro-oficial';const batches=process.argv.slice(2).map(Number);const rows=[];
for(const n of batches){const dir=`artifacts/public-corpus/${prefix}-${String(n).padStart(2,'0')}-2026-11-17`;const rep=JSON.parse(fs.readFileSync(path.join(dir,'report.json')));
 for(const d of rep.documents){if(d.state!=='quarantined'){rows.push({batch:n,id:d.id,estado:d.state,art:0,tr:0,gaps:0,sinExtraccion:true});continue;}
  const f=path.join(dir,'extractions',d.id,d.pdfSha256,d.extractionConfigSha256+'.json');const e=JSON.parse(fs.readFileSync(f));const recs=e.records||[];
  const arts=recs.filter(r=>(r.recordKind??'articulo')==='articulo');const nums=arts.map(r=>parseInt(r.articleId)).filter(Number.isFinite);const set=new Set(nums);const mx=Math.max(0,...nums);const gaps=[];for(let i=1;i<=mx;i++)if(!set.has(i))gaps.push(i);
  rows.push({batch:n,id:d.id,art:arts.length,tr:recs.length-arts.length,pref:(e.prefaceRecords||[]).length,max:mx,gaps:gaps.length,gapList:gaps.slice(0,8),status:e.status,published:e.published,indexed:e.indexed,legalReview:e.legalReview,anomalias:(e.documentAnomalies||[]).filter(a=>/restart|v37/.test(a))});}}
const q=rows.filter(r=>!r.sinExtraccion);
const t=q.reduce((a,r)=>({docs:a.docs+1,art:a.art+r.art,tr:a.tr+r.tr,conHuecos:a.conHuecos+(r.gaps>0),sinArt:a.sinArt+(r.art===0)}),{docs:0,art:0,tr:0,conHuecos:0,sinArt:0});
console.log(JSON.stringify({prefix,totales:t,noCuarentenados:rows.filter(r=>r.sinExtraccion).map(r=>r.id),estadosIndebidos:q.filter(r=>r.status!=='quarantined'||r.published||r.indexed).length,detalleHuecos:q.filter(r=>r.gaps>0||r.art===0),conAnomaliaV37:q.filter(r=>r.anomalias.length).map(r=>[r.id,r.anomalias])}));
