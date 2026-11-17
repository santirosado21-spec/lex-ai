// Compara por documento Guerrero las capas v37 pdfparse vs poppler (articulos, transitorios, prefacio, huecos). Solo lectura.
import fs from 'node:fs';import path from 'node:path';
const stat=(layer,n,d)=>{const dir=`artifacts/public-corpus/gro-v37-${layer}-${n}-2026-11-17`;const rep=JSON.parse(fs.readFileSync(path.join(dir,'report.json'))).documents.find(x=>x.id===d.id);if(!rep||rep.state!=='quarantined')return null;
 const e=JSON.parse(fs.readFileSync(path.join(dir,'extractions',d.id,rep.pdfSha256,rep.extractionConfigSha256+'.json')));const rs=e.records;const arts=rs.filter(r=>(r.recordKind??'articulo')==='articulo');const nums=new Set(arts.map(r=>parseInt(r.articleId)).filter(Number.isFinite));const mx=Math.max(0,...nums);let gaps=0;for(let i=1;i<=mx;i++)if(!nums.has(i))gaps++;
 return {art:arts.length,tr:rs.filter(r=>r.recordKind==='transitorio').length,pref:rs.filter(r=>r.recordKind==='prefacio-articulo-citado').length,max:mx,gaps,chars:arts.reduce((a,r)=>a+r.text.length,0)};};
const out={mismos:0,difieren:[],sinCapa:[]};
for(let b=1;b<=14;b++){const n=String(b).padStart(2,'0');const rep=JSON.parse(fs.readFileSync(`artifacts/public-corpus/gro-oficial-${n}-2026-11-17/report.json`));
 for(const d of rep.documents){const a=stat('pdfparse',n,d),p=stat('poppler',n,d);if(!a||!p){out.sinCapa.push(d.id);continue;}
  if(a.art===p.art&&a.tr===p.tr&&a.pref===p.pref&&a.gaps===p.gaps)out.mismos++;else out.difieren.push({id:d.id,pdfparse:a,poppler:p});}}
console.log(JSON.stringify(out));
