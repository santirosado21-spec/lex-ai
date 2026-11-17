import {parsePdfInWorker} from '/home/sandbox/rejon-clone/server/legal-library.mjs';
import fs from 'fs';import cp from 'child_process';
const reg=JSON.parse(fs.readFileSync('resources/legal-acquisition-zac-repair-v34-2026-11-17.json','utf8'));
for(const id of process.argv.slice(2)){const p=cp.execSync('ls artifacts/public-corpus/zac-oficial-*-2026-11-17/acquisitions/snapshots/zac-ley-'+id+'/*.pdf').toString().split('\n')[0];
const a=await parsePdfInWorker(p,reg.sources[0],{pdfSha256:'v',retrievedAt:'2026-11-17'});const b=await parsePdfInWorker(p,{...reg.sources[0],textLayer:'poppler'},{pdfSha256:'v',retrievedAt:'2026-11-17'});
const A=new Set(a.records.map(r=>r.articleId)),B=new Set(b.records.map(r=>r.articleId));
console.log(id,'solo-pdfparse',[...A].filter(x=>!B.has(x)),'solo-poppler',[...B].filter(x=>!A.has(x)));}
