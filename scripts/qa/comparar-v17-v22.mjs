// Harness de verificación extractor v17→v22 (revisión independiente 2026-11-11).
// Uso: node scripts/qa/comparar-v17-v22.mjs [raiz-corpus] [fecha-corte-ISO] — por defecto artifacts/public-corpus y 2026-11-11T18:50:00-06:00.
import {readdirSync,statSync,readFileSync} from 'node:fs';
import path from 'node:path';
const root=process.argv[2]||'artifacts/public-corpus';
const batches=readdirSync(root).filter(d=>{try{return statSync(path.join(root,d,'extractions')).isDirectory();}catch{return false;}});
const rows=[];
for(const batch of batches){
  const exRoot=path.join(root,batch,'extractions');
  for(const doc of readdirSync(exRoot)){
    const docDir=path.join(exRoot,doc);
    for(const pdfSha of readdirSync(docDir)){
      const dir=path.join(docDir,pdfSha);
      let files;
      try{files=readdirSync(dir).filter(f=>f.endsWith('.json'));}catch{continue;}
      if(files.length<2){rows.push({batch,doc,pdfSha:pdfSha.slice(0,12),note:'single-generation',files:files.length});continue;}
      files.sort((a,b)=>statSync(path.join(dir,a)).mtimeMs-statSync(path.join(dir,b)).mtimeMs);
      const threshold=new Date(process.argv[3]||'2026-11-11T18:50:00-06:00').getTime();
      const prevFiles=files.filter(f=>statSync(path.join(dir,f)).mtimeMs<threshold);
      if(!prevFiles.length){rows.push({batch,doc,note:'no-v17-generation'});continue;}
      const prev=JSON.parse(readFileSync(path.join(dir,prevFiles[prevFiles.length-1]),'utf8'));
      const cur=JSON.parse(readFileSync(path.join(dir,files[files.length-1]),'utf8'));
      const map=r=>new Map(r.records.map(x=>[x.articleId,x]));
      const p=map(prev),c=map(cur);
      const added=[...c.keys()].filter(k=>!p.has(k)).sort();
      const removed=[...p.keys()].filter(k=>!c.has(k)).sort();
      const changed=[...c.keys()].filter(k=>p.has(k)&&p.get(k).textSha256!==c.get(k).textSha256);
      const deltas=changed.map(k=>({id:k,dChars:c.get(k).text.length-p.get(k).text.length}));
      rows.push({batch,doc,prevFile:prevFiles[prevFiles.length-1].slice(0,12),curFile:files[files.length-1].slice(0,12),
        prevRecords:prev.records.length,curRecords:cur.records.length,added,removed,changedCount:changed.length,
        changed:changed.length<=40?deltas:changed.length,
        anomalies:cur.documentAnomalies??[],
        coverage:cur.coverage?{removedSectionLines:cur.coverage.removedSectionLines,removedSubtitleLines:cur.coverage.removedSubtitleLines,removedTrailingRubrics:cur.coverage.removedTrailingRubrics,keptAmbiguousStructuralLines:cur.coverage.keptAmbiguousStructuralLines,discards:(cur.coverage.discardedSamples??[]).length}:null});
    }
  }
}
console.log(JSON.stringify(rows,null,1));
