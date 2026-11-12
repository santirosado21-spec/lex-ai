// Harness de verificación extractor v17→v22 (revisión independiente 2026-11-11).
// Uso: node scripts/qa/clasificar-cambios.mjs [raiz-corpus] [fecha-corte-ISO] — por defecto artifacts/public-corpus y 2026-11-11T18:50:00-06:00.
import {readdirSync,statSync,readFileSync} from 'node:fs';
import path from 'node:path';
const root=process.argv[2]||'artifacts/public-corpus';
const threshold=new Date(process.argv[3]||'2026-11-11T18:50:00-06:00').getTime();
const batches=readdirSync(root).filter(d=>{try{return statSync(path.join(root,d,'extractions')).isDirectory();}catch{return false;}});
const summary={};
const sufRe=/^ART[ÍI]CULO\s+\d+\s+(BIS|TER|QU[ÁA]TER|QUINQUIES|SEXTUS|SEPTIMUS|OCTIES|NONUS|DECIES|DUODECIMUS)/i;
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
      const causes={trimOnly:0,headingRemoved:0,grewMidSentence:0,derogatedTrim:0,other:0};
      const otherSamples=[];
      for(const rec of cur.records){
        const old=p.get(rec.articleId);
        if(old===undefined)continue;
        if(old===rec.text)continue;
        let cls;
        if(rec.text.length<old.length&&old.startsWith(rec.text.slice(0,Math.min(rec.text.length,200)))){
          if(/ Derogado$/.test(rec.text)&&!/ Derogado$/.test(old))cls='derogatedTrim';
          else cls='trimOnly';
        }else if(rec.text.length>old.length&&rec.text.startsWith(old.slice(0,Math.min(old.length,200))))cls='grewMidSentence';
        else if(rec.text.length!==old.length){
          const removedLines=old.split('\n').filter(l=>!rec.text.includes(l));
          if(removedLines.some(l=>sufRe.test(l.trim())))cls='headingRemoved';
          else if(rec.text.includes(old.slice(0,200))||old.includes(rec.text.slice(0,200)))cls='trimOnly';
          else cls='other';
        }else cls='other';
        causes[cls]++;
        if(cls==='other'&&otherSamples.length<3)otherSamples.push(rec.articleId);
      }
      // dangling-signature scan on v19: suffixed-heading-looking lines left inside bodies
      const dangling=[];
      for(const rec of cur.records){
        for(const line of rec.text.split('\n').slice(1)){
          const t=line.trim();
          if(sufRe.test(t)&&!/DEROGADO/i.test(t)&&t.length<120)dangling.push(rec.articleId+' :: '+t.slice(0,90));
        }
      }
      summary[batch+'/'+doc]={causes,otherSamples,dangling:dangling.slice(0,10),danglingTotal:dangling.length,
        cov:{sl:cur.coverage?.removedSectionLines??0,sub:cur.coverage?.removedSubtitleLines??0,tr:cur.coverage?.removedTrailingRubrics??0,kept:cur.coverage?.keptAmbiguousStructuralLines??0}};
    }
  }
}
console.log(JSON.stringify(summary,null,1));
