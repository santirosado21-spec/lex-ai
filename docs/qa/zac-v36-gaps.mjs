import {parsePdfInWorker} from '../../server/legal-library.mjs';
import fs from 'fs';import cp from 'child_process';
const reg=JSON.parse(fs.readFileSync('resources/legal-acquisition-zac-repair-v34-2026-11-17.json','utf8'));
const dirs=cp.execSync('ls -d artifacts/public-corpus/zac-oficial-*-2026-11-17/acquisitions/snapshots/zac-ley-*').toString().trim().split('\n');
const out=[];
for(const d of dirs){const id=d.split('zac-ley-')[1];const pdf=fs.readdirSync(d).find(f=>f.endsWith('.pdf'));
 for(const layer of ['pdf-parse','poppler']){try{const r=await parsePdfInWorker(d+'/'+pdf,{...reg.sources[0],lawId:'zac-ley-'+id,...(layer==='poppler'?{textLayer:'poppler'}:{})},{pdfSha256:'v',retrievedAt:'2026-11-17'});
  const nums=r.records.map(x=>x.articleId).filter(a=>/^\d+$/.test(a)).map(Number);const set=new Set(nums);const max=nums.length?Math.max(...nums):0;const gaps=[];for(let n=1;n<=max;n++)if(!set.has(n))gaps.push(n);
  out.push({id,layer,records:r.records.length,max,gaps:gaps.slice(0,12),gapCount:gaps.length});}catch(e){out.push({id,layer,error:e.message.slice(0,50)});}}}
fs.writeFileSync('/tmp/zac-v36-gaps.json',JSON.stringify(out));
const bad=out.filter(o=>o.layer==='poppler'&&(o.gapCount>0||o.error||o.records===0));
console.log(JSON.stringify(bad));
