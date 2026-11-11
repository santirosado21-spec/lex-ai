import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {NYM_KINDS,NYM_LABELS,decodeNymNative} from '../server/privacy/nym-int8-decoder.mjs';

function fixture(kind){
 const label=NYM_LABELS.indexOf(`B-${kind}`);
 const row=selected=>Array.from({length:81},(_,i)=>i===selected?10:-10);
 return {text:'😀José',encoding:{ids:[2,1000,1],offsets:[[0,0],[0,5],[0,0]],specialMask:[1,0,1],attentionMask:[1,1,1],typeIds:[0,0,0],sequenceIds:[null,0,null],overflowing:[],offsetUnit:'unicode-codepoint'},logits:[[row(0),row(label),row(0)]]};
}

test('V1 pure Python and JS preserve 40 labels and original coordinates across platforms',()=>{
 const cases=NYM_KINDS.map(fixture);
 const source="import importlib.util,json,sys\ns=importlib.util.spec_from_file_location('nym_pure','scripts/privacy-nym-int8-worker.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nx=json.load(sys.stdin)\nprint(json.dumps({'results':[m.decode_native(v['text'],v['encoding'],v['logits']) for v in x],'loaded':[k for k in ('onnxruntime','tokenizers','numpy','torch') if k in sys.modules]}))";
 const child=spawnSync('/usr/bin/python3',['-I','-B','-c',source],{cwd:process.cwd(),input:JSON.stringify(cases),encoding:'utf8',timeout:10000,env:{PATH:'/usr/bin:/bin'},maxBuffer:262144});
 assert.equal(child.status,0,child.stderr);
 const result=JSON.parse(child.stdout);assert.deepEqual(result.loaded,[]);assert.equal(result.results.length,40);
 for(let i=0;i<cases.length;i++){
  const py=result.results[i],js=decodeNymNative(cases[i]);
  assert.equal(py.nativeSpans.length,1);assert.equal(js.nativeSpans.length,1);
  const pyScore=py.nativeSpans[0].score,jsScore=js.nativeSpans[0].score;
  delete py.nativeSpans[0].score;delete js.nativeSpans[0].score;
  assert.deepEqual(py,js);
  assert.ok(Number.isFinite(pyScore)&&Number.isFinite(jsScore));
  assert.ok(Math.abs(pyScore-jsScore)<1e-12,`kind ${NYM_KINDS[i]}: score differs beyond floating-point tolerance`);
 }
});
