// Measurement only. Usage: node scripts/measure-address-dev.mjs [local|variants] [--rows]
import {readFile} from 'node:fs/promises';
import {createLocalPrivacyDetector} from '../server/privacy/detector.mjs';
import {createVariantAwareDetector} from '../server/privacy/detector-variants.mjs';
import {createProvenanceRegistry,privacyTextHash} from '../server/privacy/provenance.mjs';
const make=process.argv[2]==='local'?createLocalPrivacyDetector:createVariantAwareDetector;
const rows=(await readFile(new URL('../eval/privacy-trade/dev-addresses-v1.jsonl',import.meta.url),'utf8')).trim().split('\n').map(l=>JSON.parse(l));
const scope={workspaceId:'W',matterId:'M',threadId:'T'};
const out={strict:0,overlap:0,none:0,pos:0,blockedOrNotComplete:0,negFP:0,neg:0,residualPresent:0};const detail=[];
for(const r of rows){
 const p=createProvenanceRegistry();
 const s=p.registerSource({objectId:'S',version:'v1',scope,classification:'private',extraction:{status:'complete',extractorVersion:'dev-v1',originalSha256:privacyTextHash(r.text)},segments:[{id:'SEG1',path:'content',text:r.text}]});
 const res=await make({provenanceRegistry:p}).detect({scope,segments:s.segments});
 const d=res.detections;
 if(res.status!=='complete')out.blockedOrNotComplete++;
 if(r.kind==='negative'){out.neg++;if(d.length){out.negFP++;detail.push(['FP',r.id,r.text,d.map(x=>x.category+':'+r.text.slice(x.start,x.end)).join('; ')]);}continue;}
 out.pos++;const g=r.sensitive[0];const cov=new Array(g.end-g.start).fill(false);let ov=false;
 for(const x of d)for(let i=Math.max(x.start,g.start);i<Math.min(x.end,g.end);i++){cov[i-g.start]=true;ov=true;}
 // whitespace inside the span need not be covered individually
 const full=[...r.text.slice(g.start,g.end)].every((ch,i)=>cov[i]||/\s/.test(ch));
 if(full)out.strict++;else if(ov)out.overlap++;else out.none++;
 // masked-text residual proxy: blank out detections, look for any alnum token (>=4 chars) of the address left
 let m=r.text.split('');for(const x of d)for(let i=x.start;i<x.end;i++)m[i]='#';
 const left=m.join('').slice(g.start,g.end).match(/[\p{L}\p{N}]{4,}/gu)||[];
 if(left.length)out.residualPresent++;
 detail.push([full?'STRICT':ov?'PARTIAL':'MISSED',r.id,r.format,left.length?'residual: '+left.join(' '):'']);
}
console.log(JSON.stringify({detector:make({provenanceRegistry:createProvenanceRegistry()}).version,...out}));
if(process.argv.includes('--rows'))for(const l of detail)console.log(l.join(' | '));
