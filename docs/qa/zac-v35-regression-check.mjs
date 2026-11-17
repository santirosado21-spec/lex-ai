import {parsePdfInWorker} from '/home/sandbox/rejon-clone/server/legal-library.mjs';
import fs from 'fs';import cp from 'child_process';
const reg=JSON.parse(fs.readFileSync('resources/legal-acquisition-zac-repair-v34-2026-11-17.json','utf8'));const source=reg.sources[0];
const dirs=cp.execSync('ls -d artifacts/public-corpus/zac-oficial-*-2026-11-17/acquisitions/snapshots/zac-ley-*').toString().trim().split('\n');
let worse=[],better=[],same=0,n=0;
for(const d of dirs){const id=d.split('zac-ley-')[1];const pdf=fs.readdirSync(d).find(f=>f.endsWith('.pdf'));if(!pdf)continue;
 const root=d.split('/acquisitions')[0];const ex=cp.execSync(`ls ${root}/extractions/zac-ley-${id}/*/*.json 2>/dev/null|head -1`).toString().trim();
 const old=ex?JSON.parse(fs.readFileSync(ex,'utf8')).records.length:0;
 try{const r=await parsePdfInWorker(d+'/'+pdf,{...source,lawId:'zac-ley-'+id},{pdfSha256:'v',retrievedAt:'2026-11-17'});const nw=r.records.length;n++;
  if(nw<old)worse.push([id,old,nw]);else if(nw>old)better.push([id,old,nw]);else same++;}catch(e){worse.push([id,old,'ERR']);}}
console.log({n,same,better:better.length,worse});console.log(JSON.stringify(better.slice(0,40)));
