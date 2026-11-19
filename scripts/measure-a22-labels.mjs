// Dev measurement: official Anexo 22 field-name labels (18 verified by QA) with invented values + positive controls.
// Reports detector-level spans (label vs value, strict coverage of sensitive spans) and route-level outbound text, one fresh harness per case (provider maxCalls).
import {readFileSync} from 'node:fs';
import {createVariantAwareDetector} from '../server/privacy/detector-variants.mjs';
import {createProvenanceRegistry,privacyTextHash} from '../server/privacy/provenance.mjs';
import {setup} from './lib-route-probe.mjs';
const rows=readFileSync(new URL('../eval/privacy-trade/a22-labels-dev-v1.jsonl',import.meta.url),'utf8').trim().split('\n').map(l=>JSON.parse(l));
const scope={workspaceId:'W',matterId:'M',threadId:'T'};
const o={labelCases:0,labelFlagged:0,labelSpanOnLabel:0,labelSpanOnValueOnly:0,sensitiveCases:0,sensitiveStrict:0,controls:0,controlsStrict:0,routeBlocked:0,routeUnchanged:0,routeAltered:0};const lines=[];
for(const r of rows){
 const p=createProvenanceRegistry();
 const s=p.registerSource({objectId:'S',version:'v1',scope,classification:'private',extraction:{status:'complete',extractorVersion:'a22-v1',originalSha256:privacyTextHash(r.text)},segments:[{id:'SEG1',path:'content',text:r.text}]});
 const d=(await createVariantAwareDetector({provenanceRegistry:p}).detect({scope,segments:s.segments})).detections;
 const spans=d.map(x=>`${x.category}:${JSON.stringify(r.text.slice(x.start,x.end))}`).join('; ');
 const onLabel=d.some(x=>x.start<r.labelEnd);
 let strict='';
 for(const g of r.sensitive){const cov=[...r.text.slice(g.start,g.end)].every((ch,i)=>/\s/.test(ch)||d.some(x=>x.start<=g.start+i&&x.end>g.start+i));strict+=cov?'STRICT ':'NOT-STRICT ';
  if(r.kind==='control'){o.controls++;if(cov)o.controlsStrict++;}else{o.sensitiveCases++;if(cov)o.sensitiveStrict++;}}
 if(r.kind==='label'&&r.sensitive.length===0){o.labelCases++;if(d.length)o.labelFlagged++;if(onLabel)o.labelSpanOnLabel++;else if(d.length)o.labelSpanOnValueOnly++;}
 const h=setup();let err=null;try{await h.ask(r.text);}catch(e){err=e?.code||String(e);}
 const out=err?null:JSON.parse(h.sent.at(-1).raw).messages.at(-1).content;
 const route=err?`BLOCKED(${err})`:out===r.text?'UNCHANGED':'ALTERED -> '+JSON.stringify(out);
 if(err)o.routeBlocked++;else if(out===r.text)o.routeUnchanged++;else o.routeAltered++;
 lines.push([r.kind,r.id,JSON.stringify(r.text),'det='+(spans||'-'),strict.trim(),'route='+route].filter(Boolean).join(' | '));
}
console.log(JSON.stringify(o));
if(process.argv.includes('--rows'))for(const l of lines)console.log(l);
