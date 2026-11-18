import test from 'node:test';import assert from 'node:assert/strict';
import {validateGroundedOutput,settleText,TEXT_CAP} from '../server/grounded-output.mjs';
import {validateMixedOutput} from '../server/grounded-output-mixed.mjs';
import {generateValidated,RETRY_INSTRUCTION,INCOMPLETE_MESSAGE,TIMEOUT_MESSAGE} from '../server/bounded-generation.mjs';
const quote='Artículo 1797. La validez y el cumplimiento del contrato no pueden dejarse al arbitrio de uno de los contratantes.';
const evidence=[{id:'L1',text:quote,allowedQuotes:[quote]}];
const first='El artículo 1797 describe un límite al arbitrio de los contratantes en el contrato.';
const filler=' Esta regla protege la validez del contrato y evita que una sola parte decida si se cumple o no, de modo que la ley impone un equilibrio entre las partes que firman y por eso el texto';
const cut=(head,tail=filler)=>(head+tail+tail).slice(0,TEXT_CAP);
const raw=text=>JSON.stringify({paragraphs:[{sourceId:'L1',quote,text}]});
const okText='El artículo 1797 describe un límite al arbitrio de los contratantes, salvo pacto distinto.';

test('evidence of the exact limit: a model that fills the schema cap is cut at 350 characters mid-sentence',()=>{
 const t=cut(first);assert.equal(t.length,TEXT_CAP);assert.doesNotMatch(t,/[.!?]$/);
});
test('a cut paragraph is rejected, never trimmed to its last complete sentence',()=>{
 for(const t of [cut(first),cut('Dice que el contrato exige firma de ambas partes. Además, aplica salvo pacto en contrario y siempre que'),cut('x'.repeat(10)+filler)]){
  assert.throws(()=>validateGroundedOutput(raw(t),evidence),e=>e.code==='TRUNCATED_TEXT');
  assert.throws(()=>validateMixedOutput(raw(t),evidence),e=>e.code==='TRUNCATED_TEXT');
 }
});
test('reaching the cap is rejected even when the last character is a period (punctuation is not proof of meaning)',()=>{
 const t=(first+filler+filler).slice(0,TEXT_CAP-1)+'.';assert.equal(t.length,TEXT_CAP);
 assert.throws(()=>settleText(t),e=>e.code==='TRUNCATED_TEXT');
});
test('a final caveat lost to the cut is not hidden by a clean-looking earlier sentence',()=>{
 const t=cut('El contrato obliga a pagar 1,500 pesos según el art. 47 de la ley. Sin embargo, esa obligación no aplica cuando',' el deudor demuestre el pago previo ante notario y el acreedor lo hubiera aceptado por escrito en los términos que la ley fija para estos casos particulares ');
 assert.throws(()=>settleText(t),e=>e.code==='TRUNCATED_TEXT');
});
test('abbreviations and numbers: short complete text near the cap is accepted; an open abbreviation at the end is not',()=>{
 let near='Conforme al art. 47 de la ley, el pago de $1,500.50 debe hacerse en la fecha pactada. El contrato describe el plazo con claridad. Ambas partes conocen la forma de pago. ';
 while(near.length<330)near+='Cumple. ';near=near.trim();
 assert.ok(near.length>=330&&near.length<TEXT_CAP-1,String(near.length));assert.match(near,/\.$/);
 assert.equal(settleText(near),near);
 const open=('palabra '.repeat(45)).trim().slice(0,321)+' conforme al art.';assert.ok(open.length>=330&&open.length<349);
 assert.throws(()=>settleText(open),e=>e.code==='TRUNCATED_TEXT');
 assert.equal(settleText(okText),okText);
});
test('unsupported numbers still reject on complete text',()=>{
 const bad='El pago debe efectuarse dentro de 30 días según este contrato y la ley aplicable.';
 assert.throws(()=>validateGroundedOutput(raw(bad),evidence),e=>e.code==='UNSUPPORTED_PARAGRAPH');
});

const engine=outputs=>{const calls=[];return {calls,generate:async function*(turn){calls.push(turn.map(m=>m.content));const o=outputs[Math.min(calls.length-1,outputs.length-1)];if(o instanceof Error)throw o;yield o.slice(0,40);yield o.slice(40);}};};
const validate=r=>validateGroundedOutput(r,evidence).validated;
const messages=[{role:'system',content:'S'},{role:'user',content:'Q'}];

test('retry: truncated first output, valid second output succeeds with exactly one retry and the brief instruction',async()=>{
 const e=engine([raw(cut(first)),raw(okText)]);
 const r=await generateValidated({generate:e.generate,validate,messages});
 assert.equal(r.attempts,2);assert.equal(e.calls.length,2);assert.equal(e.calls[1].at(-1),RETRY_INSTRUCTION);assert.equal(e.calls[0].length,2);
 assert.equal(r.value.citations.length,1);assert.match(r.value.text,/salvo pacto distinto\. \[L1\]$/);
});
test('retry: persistent truncation ends in an explicit incomplete-response error and shows no trimmed version',async()=>{
 const e=engine([raw(cut(first))]);
 await assert.rejects(generateValidated({generate:e.generate,validate,messages}),err=>err.code==='INCOMPLETE_RESPONSE'&&err.message===INCOMPLETE_MESSAGE);
 assert.equal(e.calls.length,2);
});
test('retry: valid first output makes one call; other validation failures are not retried',async()=>{
 const e1=engine([raw(okText)]);assert.equal((await generateValidated({generate:e1.generate,validate,messages})).attempts,1);assert.equal(e1.calls.length,1);
 const e2=engine([raw('El pago debe efectuarse dentro de 30 días según este contrato y la ley aplicable.')]);
 await assert.rejects(generateValidated({generate:e2.generate,validate,messages}),e=>e.code==='UNSUPPORTED_PARAGRAPH');assert.equal(e2.calls.length,1);
 const e3=engine([new Error('boom')]);await assert.rejects(generateValidated({generate:e3.generate,validate,messages}),/boom/);assert.equal(e3.calls.length,1);
});
test('retry: aborted signal is honored and engine output over the character budget fails',async()=>{
 const ac=new AbortController();ac.abort();
 await assert.rejects(generateValidated({generate:engine([raw(okText)]).generate,validate,messages,signal:ac.signal}),/cancelado/);
 await assert.rejects(generateValidated({generate:engine(['x'.repeat(100)]).generate,validate,messages,maxChars:50}),/límite de salida/);
});

test('shared budget: the retry cannot start after the cycle deadline and the character budget is shared',async()=>{
 let t=0;const now=()=>t;
 const slow=engine([raw(cut(first))]);
 const gen=async function*(turn,o){t+=100;yield* slow.generate(turn,o);};
 await assert.rejects(generateValidated({generate:gen,validate,messages,deadlineMs:100,now}),new RegExp(TIMEOUT_MESSAGE));
 assert.equal(slow.calls.length,1);
 const e=engine([raw(cut(first))]);const size=raw(cut(first)).length;
 await assert.rejects(generateValidated({generate:e.generate,validate,messages,maxChars:size+10}),/límite de salida/);
 assert.equal(e.calls.length,2);
});
test('shared budget: a slow engine is aborted at the deadline and a caller abort mid-stream stops without retry',async()=>{
 const hang=async function*(turn,o){await new Promise((_,rej)=>o.signal.addEventListener('abort',()=>rej(Object.assign(new Error('aborted'),{name:'AbortError'}))));yield 'x';};
 await assert.rejects(generateValidated({generate:hang,validate,messages,deadlineMs:40}),new RegExp(TIMEOUT_MESSAGE));
 const ac=new AbortController();let calls=0;
 const mid=async function*(turn,o){calls++;setTimeout(()=>ac.abort(),10);await new Promise((_,rej)=>o.signal.addEventListener('abort',()=>rej(new Error('aborted'))));yield 'x';};
 await assert.rejects(generateValidated({generate:mid,validate,messages,signal:ac.signal}),/cancelado\./);
 assert.equal(calls,1);
});
