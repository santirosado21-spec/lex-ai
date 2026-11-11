import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createTokenNerDetector,startTokenNerWorker} from '../server/privacy/token-ner-candidate.mjs';
const scope={workspaceId:'SYNTH_W',matterId:'SYNTH_M',threadId:'SYNTH_T'};
const input=(text='Texto genérico.')=>({scope,segments:[{id:'s',path:'/content',text,originScope:scope,classification:'synthetic'}],operational:{processorStatus:'ok',segments:[{id:'s',mediaType:'text/plain',extractionStatus:'complete',assessment:'known'}]}});
const complete=detections=>({status:'complete',reasonCategory:null,detections});
const fail={status:'blocked',reasonCategory:'detector_failure',detections:[]};
function python(code,executable='python3'){
 const result=spawnSync(executable,['-I','-B','-c',"import runpy\nm=runpy.run_path('scripts/privacy-token-ner-worker.py')\n"+code],{encoding:'utf8',timeout:5000,env:{PATH:'/usr/bin:/bin',LANG:'en_US.UTF-8'}});assert.equal(result.status,0,result.stderr);
}
test('pure strict BIO decoding: original UTF16, combining accents, whitespace, no date invention',()=>{
 python(`text='😀 Jose\\u0301  Ruiz'; offsets=[(0,0),(0,1),(2,6),(9,13),(0,0)]; special=[1,0,0,0,1]; ids=[2,10,11,12,3]
def logits(labels):
 return [[20.0 if i==label else -20.0 for i in range(35)] for label in labels]
r=m['decode'](text,offsets,special,ids,logits([0,0,1,2,0]))
assert r==[{'start':3,'end':14,'category':'person','score':1.0}]
date='10/11/2026'; assert m['decode'](date,[(0,0),(0,10),(0,0)],[1,0,1],[2,5,3],logits([0,0,0]))==[]
assert 'onnxruntime' not in __import__('sys').modules
`);
});
test('unmapped kinds, orphan/wrong I, NaN, uncertainty, unknown tokens and truncation block',()=>{
 python(`def check(fn,kind=ValueError):
 try:fn()
 except kind:pass
 else:raise AssertionError('not blocked')
def rows(label):return [[20.0 if i==j else -20.0 for i in range(35)] for j in [0,label,0]]
args=('X',[(0,0),(0,1),(0,0)],[1,0,1],[2,5,3])
for kind in m['KINDS']:
 label=m['LABELS'].index('B-'+kind)
 if kind not in m['MAPPING']:check(lambda:m['decode'](*args,rows(label)),m['UnsupportedEntity'])
 else:assert m['decode'](*args,rows(label))[0]['category']==m['MAPPING'][kind]
check(lambda:m['decode'](*args,rows(2)))
check(lambda:m['decode'](*args,[[float('nan')]*35]*3))
check(lambda:m['decode'](*args,[[0.0]*35]*3))
check(lambda:m['validated_offsets']('X',args[1],args[2],[2,1,3]))
check(lambda:m['validated_offsets']('XY',args[1],args[2],args[3]))
check(lambda:m['validated_offsets']('x',[(0,0)]*513,[1]*513,[2]*513))
check(lambda:m['utf16_offsets']('\\ud800'))
`);
});
test('actual pinned tokenizer metadata preserves accents and rejects unknown emoji without ONNX load',()=>{
 python(`from tokenizers import Tokenizer
p='artifacts/privacy/candidate-discovery-20261110/rampart-pinned-tokenizer.json'
t=Tokenizer.from_file(p);t.no_truncation();t.no_padding()
for text in ['José Álvarez','Jose\\u0301 A\\u0301lvarez','10/11/2026','Nube\\tRobles']:
 e=t.encode(text);m['validated_offsets'](text,e.offsets,e.special_tokens_mask,e.ids)
e=t.encode('😀');assert 1 in e.ids
try:m['validated_offsets']('😀',e.offsets,e.special_tokens_mask,e.ids)
except ValueError:pass
else:raise AssertionError('unknown emoji dropped')
e=t.encode('nombre '*520);assert len(e.ids)>512
assert 'onnxruntime' not in __import__('sys').modules
`,'artifacts/privacy/onnx-env/bin/python');
});
test('rules retained, operational envelope only, paths protected, unsupported outputs block',async()=>{
 let calls=0;const detector=createTokenNerDetector({backend:{async detect(value){calls++;assert.deepEqual(Object.keys(value),['segments']);assert.equal(value.segments[1].text,'/content');return complete([]);}}});
 const result=await detector.detect(input('Correo sintético ana@example.com.'));assert.ok(result.detections.some(d=>d.category==='email'));
 assert.deepEqual(await detector.detect({...input(),expectedStatus:'complete'}),fail);assert.equal(calls,1);
 const unsupported=createTokenNerDetector({backend:{async detect(){return {status:'blocked',reasonCategory:'ambiguous_context',detections:[]};}}});assert.equal((await unsupported.detect(input())).reasonCategory,'ambiguous_context');
 const paths=createTokenNerDetector({backend:{async detect(){return complete([{segmentId:'P0',start:1,end:8,category:'person',score:.8}]);}}});assert.equal((await paths.detect(input())).reasonCategory,'ambiguous_context');
 for(const output of [complete([{segmentId:'T0',start:0,end:999,category:'person',score:.8}]),complete([{segmentId:'T0',start:0,end:4,category:'rfc',score:.8}]),{status:'blocked',reasonCategory:'ambiguous_context',detections:[],raw:'leak'}])assert.deepEqual(await createTokenNerDetector({backend:{async detect(){return output;}}}).detect(input()),fail);
});
test('timeout closes signal, no auto retry, provenance failure precedes backend',async()=>{
 let calls=0,aborted=false;const d=createTokenNerDetector({timeoutMs:5,backend:{async detect(_,options){calls++;options.signal.addEventListener('abort',()=>aborted=true);return new Promise(()=>{});}}});
 assert.deepEqual(await d.detect(input()),fail);assert.equal(aborted,true);assert.deepEqual(await d.detect(input()),fail);assert.equal(calls,1);
 const bad=input();bad.segments[0].originScope={...scope,matterId:'OTHER'};let invoked=false;
 const isolated=createTokenNerDetector({backend:{async detect(){invoked=true;return complete([]);}}});assert.equal((await isolated.detect(bad)).reasonCategory,'scope_mismatch');assert.equal(invoked,false);
});
test('pinned metadata hashes, bounded payload and absent review never start a worker',async()=>{
 const m=JSON.parse(await readFile('resources/privacy-token-ner-candidate-v1.json'));assert.equal(m.productionEnabled,false);assert.equal(m.automaticDownload,false);assert.ok(m.files.reduce((n,f)=>n+f.bytes,0)<175*1024*1024);
 for(const f of m.files.filter(f=>!f.path.endsWith('.onnx'))){const b=await readFile('artifacts/privacy/candidate-discovery-20261110/rampart-pinned-'+f.path);assert.equal(b.length,f.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),f.sha256);}
 await assert.rejects(startTokenNerWorker());await assert.rejects(startTokenNerWorker({reviewedManifestSha256:'0'.repeat(64)}));
});
