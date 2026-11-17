// Inventario de lotes Guerrero (solo lectura): articulos, transitorios, huecos de secuencia por documento, estados.
import fs from 'node:fs';import path from 'node:path';
const batches=process.argv.slice(2).map(Number);const rows=[];
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):e.name.endsWith('.json')?[path.join(d,e.name)]:[]);
for(const n of batches){const b=`artifacts/public-corpus/gro-oficial-${String(n).padStart(2,'0')}-2026-11-17/extractions`;for(const f of walk(b)){const e=JSON.parse(fs.readFileSync(f));const recs=e.records||[];const arts=recs.filter(r=>(r.recordKind??'articulo')==='articulo');const nums=arts.map(r=>parseInt(r.articleId)).filter(Number.isFinite);const set=new Set(nums);const mx=Math.max(0,...nums);const gaps=[];for(let i=1;i<=mx;i++)if(!set.has(i))gaps.push(i);
rows.push({batch:n,id:path.relative(b,f).split(path.sep)[0],art:arts.length,tr:recs.length-arts.length,max:mx,gaps:gaps.length,gapList:gaps.slice(0,8),status:e.status,published:e.published,indexed:e.indexed,legalReview:e.legalReview})}}
const t=rows.reduce((a,r)=>({docs:a.docs+1,art:a.art+r.art,tr:a.tr+r.tr,conHuecos:a.conHuecos+(r.gaps>0),sinArt:a.sinArt+(r.art===0)}),{docs:0,art:0,tr:0,conHuecos:0,sinArt:0});
console.log(JSON.stringify({totales:t,estadosNoCuarentena:rows.filter(r=>r.status!=='quarantined'||r.published||r.indexed).length,detalleHuecos:rows.filter(r=>r.gaps>0||r.art===0)},null,0));
