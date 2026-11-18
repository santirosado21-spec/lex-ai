// DEV-ONLY residual-leak measurement. Reads eval/privacy/dev.jsonl ONLY (tuning split); never heldout.jsonl.
// No network, no provider. For each gold identifier (with OCR/case/spacing variants) it asks: would the local
// detector's ranges cover the WHOLE string that the cloud route would then replace by markers? A partly covered
// or uncovered identifier counts as a leak. Not a validation: 36 dev cases, synthetic variants, no heldout.
// usage: node scripts/measure-cloud-leak.mjs [out.json] [baseline|variants]
import {readFile,writeFile} from 'node:fs/promises';
import {createLocalPrivacyDetector} from '../server/privacy/detector.mjs';
import {createVariantAwareDetector} from '../server/privacy/detector-variants.mjs';
import {createProvenanceRegistry,privacyTextHash} from '../server/privacy/provenance.mjs';

const make=process.argv[3]==='variants'?createVariantAwareDetector:createLocalPrivacyDetector;
const rows=(await readFile(new URL('../eval/privacy/dev.jsonl',import.meta.url),'utf8')).trim().split('\n').map(line=>JSON.parse(line));
const idCats=new Set(['rfc','curp','clabe','account','phone','case_id']);
const variants={
 plain:(text)=>text,
 upper:(text,cat)=>cat==='person'||cat==='organization'?text.toUpperCase():null,
 linebreak:(text,cat)=>(cat==='person'||cat==='organization')&&text.includes(' ')?text.replace(' ','\n'):null,
 ocr_swap:(text,cat)=>idCats.has(cat)?text.replace(/O/g,'0').replace(/I/g,'1'):null,
 spaced:(text,cat)=>idCats.has(cat)&&text.length>=8?text.replace(/(.{4})/g,'$1 ').trim():null,
};
const results=[];
for(const row of rows){
 if(row.expectedStatus!=='complete'||!row.entities.length)continue;
 const segment=row.segments[0];
 for(const [name,fn] of Object.entries(variants)){
  let text='',cursor=0;const golds=[];let applicable=false;
  for(const entity of [...row.entities].sort((a,b)=>a.start-b.start)){
   const original=segment.text.slice(entity.start,entity.end),changed=fn(original,entity.category);
   text+=segment.text.slice(cursor,entity.start);const start=text.length;text+=changed??original;cursor=entity.end;
   if(changed!==null){applicable=true;golds.push({category:entity.category,start,end:text.length});}
  }
  if(!applicable)continue;text+=segment.text.slice(cursor);
  const provenance=createProvenanceRegistry(),detector=make({provenanceRegistry:provenance});
  const source=provenance.registerSource({objectId:'S',version:'v1',scope:row.scope,classification:'private',
   extraction:{status:'complete',extractorVersion:'measure-v1',originalSha256:privacyTextHash(text)},segments:[{id:'SEG1',path:'content',text}]});
  const result=await detector.detect({scope:row.scope,segments:source.segments});
  const leaked=[];
  for(const gold of golds){
   const covered=new Array(gold.end-gold.start).fill(false);
   for(const d of result.detections)for(let i=Math.max(d.start,gold.start);i<Math.min(d.end,gold.end);i++)covered[i-gold.start]=true;
   if(!covered.every(Boolean))leaked.push(gold.category);
  }
  results.push({caseId:row.id,variant:name,status:result.status,golds:golds.length,leaked});
 }
}
const byVariant={};
for(const r of results){const v=byVariant[r.variant]??={cases:0,casesWithLeak:0,leakedEntities:0,totalEntities:0,leakedByCategory:{}};
 v.cases++;v.totalEntities+=r.golds;v.leakedEntities+=r.leaked.length;if(r.leaked.length)v.casesWithLeak++;
 for(const c of r.leaked)v.leakedByCategory[c]=(v.leakedByCategory[c]??0)+1;}
const report={split:'dev-only',detector:make({provenanceRegistry:createProvenanceRegistry()}).version,byVariant,residual:results.filter(r=>r.leaked.length)};
if(process.argv[2]&&process.argv[2]!=='-')await writeFile(process.argv[2],JSON.stringify(report,null,1));
console.log(JSON.stringify({detector:report.detector,byVariant}));
