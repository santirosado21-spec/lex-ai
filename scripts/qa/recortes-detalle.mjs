// Harness de verificación extractor v17→v22 (revisión independiente 2026-11-11).
// Uso: node scripts/qa/recortes-detalle.mjs [raiz-corpus] [fecha-corte-ISO] — por defecto artifacts/public-corpus y 2026-11-11T18:50:00-06:00.
import {readdirSync,statSync,readFileSync} from 'node:fs';
import path from 'node:path';
const root=process.argv[2]||'artifacts/public-corpus';
const threshold=new Date(process.argv[3]||'2026-11-11T18:50:00-06:00').getTime();
const batches=readdirSync(root).filter(d=>{try{return statSync(path.join(root,d,'extractions')).isDirectory();}catch{return false;}});
const out=[];
for(const batch of batches){
  const exRoot=path.join(root,batch,'extractions');
  for(const doc of readdirSync(exRoot)){
    for(const pdfSha of readdirSync(path.join(exRoot,doc))){
      const dir=path.join(exRoot,doc,pdfSha);
      let files;try{files=readdirSync(dir).filter(f=>f.endsWith('.json'));}catch{continue;}
      if(files.length<2)continue;
      files.sort((a,b)=>statSync(path.join(dir,a)).mtimeMs-statSync(path.join(dir,b)).mtimeMs);
      const prevFiles=files.filter(f=>statSync(path.join(dir,f)).mtimeMs<threshold);
      if(!prevFiles.length)continue;
      const prev=JSON.parse(readFileSync(path.join(dir,prevFiles[prevFiles.length-1]),'utf8'));
      const cur=JSON.parse(readFileSync(path.join(dir,files[files.length-1]),'utf8'));
      const p=new Map(prev.records.map(x=>[x.articleId,x.text]));
      for(const rec of cur.records){
        const old=p.get(rec.articleId);
        if(old===undefined||old===rec.text)continue;
        if(rec.text.length<old.length&&old.startsWith(rec.text.slice(0,Math.min(rec.text.length,120)))){
          out.push(batch+'/'+doc+' '+rec.articleId+' TRIMMED_TAIL: '+old.slice(rec.text.length).slice(0,220).replace(/\n/g,' | '));
        }
      }
    }
  }
}
console.log(out.join('\n'));
