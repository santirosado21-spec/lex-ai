import {parsePdfInWorker} from '/home/sandbox/rejon-clone/server/legal-library.mjs';
import fs from 'fs';import cp from 'child_process';
const reg=JSON.parse(fs.readFileSync('/home/sandbox/rejon-clone/resources/legal-acquisition-zac-repair-v34-2026-11-17.json','utf8'));
const source=reg.sources[0];
const H=/^\s*(?:ART[IÍ]CULO|Art[íi]culo)\s*(\d+)\s*(?:\/?[oº°])?\s*(?:\.-|[.\-])?\s*(?:\d{1,2}\.)?\s*$|^\s*Art[íi]culo(\d+)\./;
const ids=process.argv.slice(2);
for(const id of ids){
 const p=cp.execSync('ls /home/sandbox/rejon-clone/artifacts/public-corpus/zac-oficial-*-2026-11-17/acquisitions/snapshots/zac-ley-'+id+'/*.pdf').toString().trim().split('\n')[0];
 const txt=cp.execSync('pdftotext -enc UTF-8 '+p+' -',{maxBuffer:1<<28}).toString();
 const g=new Set();for(const l of txt.split('\n')){const m=H.exec(l);if(m)g.add(Number(m[1]||m[2]));}
 try{
  const r=await parsePdfInWorker(p,source,{pdfSha256:'v',retrievedAt:'2026-11-17'});
  const e=new Set(r.records.map(x=>x.articleId).filter(a=>/^\d+$/.test(String(a))).map(Number));
  const miss=[...g].filter(n=>!e.has(n)).sort((a,b)=>a-b);
  console.log(id,'poppler',g.size,'extraidos',e.size,'faltan',miss.length,miss.slice(0,10).join(','),'|',(r.documentAnomalies||[]).join(','));
 }catch(er){console.log(id,'ERR',er.message.slice(0,60));}
}
