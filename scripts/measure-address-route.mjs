// Measurement only: runs the dev set through the executable cloud route (fake fetch records outbound bytes).
import {readFileSync} from 'node:fs';
import {setup} from './lib-route-probe.mjs';
const rows=readFileSync(new URL('../eval/privacy-trade/dev-addresses-v1.jsonl',import.meta.url),'utf8').trim().split('\n').map(l=>JSON.parse(l));
const h=setup();const o={pos:0,blocked:0,sentFullAddress:0,sentSomeAddressToken:0,sentClean:0,neg:0,negBlocked:0,negSentUnchanged:0,negSentAltered:0};const det=[];
for(const r of rows){
 const before=h.sent.length;let err=null;
 try{await h.ask(r.text);}catch(e){err=e?.code||e?.message||String(e);}
 const raw=h.sent.length>before?h.sent.at(-1).raw:null;
 const out=raw?JSON.parse(raw).messages.at(-1).content:null;
 if(r.kind==='negative'){o.neg++;if(err)o.negBlocked++;else if(out===r.text)o.negSentUnchanged++;else o.negSentAltered++;det.push([err?'NEG-BLOCKED':out===r.text?'NEG-UNCHANGED':'NEG-ALTERED',r.id,err||(out===r.text?'':out)]);continue;}
 o.pos++;const g=r.sensitive[0];const addr=r.text.slice(g.start,g.end);
 if(err){o.blocked++;det.push(['BLOCKED',r.id,err]);continue;}
 const toks=addr.match(/[\p{L}\p{N}]{4,}/gu)||[];const leaked=toks.filter(t=>out.includes(t));
 if(out.includes(addr))o.sentFullAddress++;
 if(leaked.length)o.sentSomeAddressToken++;else o.sentClean++;
 det.push([leaked.length?'LEAK-TOKENS':'SENT-CLEAN',r.id,leaked.join(' ')]);
}
console.log(JSON.stringify(o));
if(process.argv.includes('--rows'))for(const l of det)console.log(l.join(' | '));
