// Offline, deterministic diagnosis of an already recorded DEV run. No ONNX import/forward.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createTokenNerDetector} from '../server/privacy/token-ner-candidate.mjs';
import {projectPrivacyCase} from '../server/privacy/operational-v2.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const base='artifacts/privacy/rampart-dev-v1-20261110-first';
const paths={dev:'eval/privacy-development-v3/cases.jsonl',predictions:`${base}/predictions.json`,score:`${base}/score.json`,execution:`${base}/execution.json`,worker:'scripts/privacy-token-ner-worker.py',driver:'server/privacy/token-ner-candidate.mjs',tokenizer:'artifacts/privacy/candidate-discovery-20261110/rampart-pinned-tokenizer.json'};
const bytes=Object.fromEntries(await Promise.all(Object.entries(paths).map(async([k,p])=>[k,await readFile(p)])));
if(sha(bytes.dev)!=='511f2da926df75a84a9624147d61bbff189bfa72cd5c931f71f437d41a83552d')throw Error('dev_hash');
const rows=bytes.dev.toString().trimEnd().split('\n').map(JSON.parse),recorded=JSON.parse(bytes.predictions),score=JSON.parse(bytes.score),execution=JSON.parse(bytes.execution);
for(const [file,digest] of Object.entries(execution.binding.identity.sourceHashes))if(sha(await readFile(file))!==digest)throw Error('source_changed');
if(sha(bytes.tokenizer)!=='98ade711428b42a1b5343c403a73344535e92de8e19359cdb567ef34da210259')throw Error('tokenizer_hash');
const tokenCode=`import json,runpy,sys
from tokenizers import Tokenizer
m=runpy.run_path('scripts/privacy-token-ner-worker.py')
t=Tokenizer.from_file('artifacts/privacy/candidate-discovery-20261110/rampart-pinned-tokenizer.json');t.no_truncation();t.no_padding()
out=[]
for row in json.load(sys.stdin):
 streams=[]
 for i,segment in enumerate(row['segments']):
  for kind in ['text','path']:
   text=segment[kind];e=t.encode(text);cause=None
   try:m['validated_offsets'](text,e.offsets,e.special_tokens_mask,e.ids)
   except ValueError as error:cause=str(error)
   streams.append({'index':i,'kind':kind,'tokens':len(e.ids),'unknownTokens':e.ids.count(1),'pureFailure':cause})
 out.append({'id':row['id'],'streams':streams})
assert 'onnxruntime' not in sys.modules
print(json.dumps(out))`;
const py=spawnSync('artifacts/privacy/onnx-env/bin/python',['-I','-B','-c',tokenCode],{input:JSON.stringify(rows.map(r=>({id:r.id,segments:r.segments.map(s=>({text:s.text,path:s.path}))}))),encoding:'utf8',timeout:15000,maxBuffer:1024*1024,env:{PATH:'/usr/bin:/bin',LANG:'en_US.UTF-8'}});
if(py.status!==0)throw Error('tokenizer_replay_failed');const tokens=JSON.parse(py.stdout);
const key=d=>JSON.stringify([d.segmentId,d.start,d.end,d.category]);
const summarize=(gold,det)=>{const g=new Set(gold.map(key)),p=new Set(det.map(key));return {tp:[...p].filter(k=>g.has(k)).length,fp:[...p].filter(k=>!g.has(k)).length,fn:[...g].filter(k=>!p.has(k)).length};};
const sum=list=>list.reduce((a,b)=>({tp:a.tp+b.tp,fp:a.fp+b.fp,fn:a.fn+b.fn}),{tp:0,fp:0,fn:0});
const increment=(o,k,n=1)=>o[k]=(o[k]??0)+n;
const cases=[];
for(const row of rows){
 let backendCalls=0;const rules=await createTokenNerDetector({backend:{async detect(){backendCalls++;return {status:'complete',reasonCategory:null,detections:[]};}}}).detect(projectPrivacyCase(row));
 const actual=recorded.predictions.find(p=>p.id===row.id);if(!actual)throw Error('missing');
 const g=new Set(row.entities.map(key)),r=new Set(rules.detections.map(key)),a=new Set(actual.detections.map(key));
 const lostRuleTrue=rules.detections.filter(d=>g.has(key(d))&&!a.has(key(d)));
 const newDetections=actual.detections.filter(d=>!r.has(key(d)));
 const fpGeometry={sameCategoryOverlap:0,otherCategoryOverlap:0,noGoldOverlap:0};const learnedOnlyCategories={},categoryConfusions={};
 for(const d of newDetections)increment(learnedOnlyCategories,d.category);
 for(const d of actual.detections.filter(d=>!g.has(key(d)))){
  const overlaps=row.entities.filter(e=>e.segmentId===d.segmentId&&e.start<d.end&&d.start<e.end);
  for(const e of overlaps)increment(categoryConfusions,`${d.category}->${e.category}`);
  increment(fpGeometry,overlaps.some(e=>e.category===d.category)?'sameCategoryOverlap':overlaps.length?'otherCategoryOverlap':'noGoldOverlap');
 }
 cases.push({id:row.id,expectedStatus:row.expectedStatus,expectedReason:row.blockReason,goldCategories:row.entities.map(e=>e.category),actualStatus:actual.status,actualReason:actual.reasonCategory,actualExact:summarize(row.entities,actual.detections),ruleOnlyStatus:rules.status,ruleOnlyReason:rules.reasonCategory,ruleOnlyExact:summarize(row.entities,rules.detections),wouldReachLearnedBackend:backendCalls===1,lostExactRuleTrueCategories:lostRuleTrue.map(d=>d.category),retainedRuleCompatible:actual.detections.filter(d=>r.has(key(d))).length,learnedOnlyExact:summarize(row.entities,newDetections),learnedOnlyCount:newDetections.length,fpGeometry,learnedOnlyCategories,categoryConfusions,tokenization:tokens.find(t=>t.id===row.id).streams});
}
const groups={};for(const c of cases){const k=c.actualReason??'complete';groups[k]??={total:0,requiredBlocks:0,unexpectedBlocks:0,expectedComplete:0,ruleTrueLost:0,tokenizerWouldFail:0,tokenizerPass:0};const g=groups[k];g.total++;g[c.actualStatus==='complete'?'expectedComplete':c.expectedStatus==='blocked'?'requiredBlocks':'unexpectedBlocks']++;g.ruleTrueLost+=c.lostExactRuleTrueCategories.length;if(c.wouldReachLearnedBackend){if(c.tokenization.some(s=>s.pureFailure))g.tokenizerWouldFail++;else g.tokenizerPass++;}}
const lostByCategory={},fpGeometry={},newByCategory={},categoryConfusions={};for(const c of cases){for(const k of c.lostExactRuleTrueCategories)increment(lostByCategory,k);for(const [k,n] of Object.entries(c.fpGeometry))increment(fpGeometry,k,n);for(const [k,n] of Object.entries(c.learnedOnlyCategories))increment(newByCategory,k,n);for(const [k,n] of Object.entries(c.categoryConfusions))increment(categoryConfusions,k,n);}

const report={version:1,diagnosticOnly:true,inferenceExecuted:false,onnxImported:false,provenance:Object.fromEntries(Object.entries(paths).map(([k,p])=>[k,{path:p,sha256:sha(bytes[k])}])),recordedExact:score.metrics.exact.micro,recordedMacroPrecision:score.metrics.exact.macro,recordedStatuses:execution.statuses,ruleOnlyExact:sum(cases.map(c=>c.ruleOnlyExact)),groups,lostExactRuleTrueByCategory:lostByCategory,learnedOnly:{count:cases.reduce((n,c)=>n+c.learnedOnlyCount,0),tp:cases.reduce((n,c)=>n+c.learnedOnlyExact.tp,0),fp:cases.reduce((n,c)=>n+c.learnedOnlyExact.fp,0)},learnedOnlyCategories:newByCategory,recordedFpGeometry:fpGeometry,categoryConfusions,clean:cases.filter(c=>!c.goldCategories.length&&c.expectedStatus==='complete').map(c=>({id:c.id,status:c.actualStatus,reason:c.actualReason,falsePositives:c.actualExact.fp})),tokenizer:{maximumTokens:Math.max(...tokens.flatMap(t=>t.streams.map(s=>s.tokens))),failedCaseIds:cases.filter(c=>c.tokenization.some(s=>s.pureFailure)).map(c=>c.id),failureKinds:[...new Set(tokens.flatMap(t=>t.streams.map(s=>s.pureFailure)).filter(Boolean))]},cases,unknown:['Recorded generic failures do not distinguish low confidence, invalid BIO, model output validation or other runtime failures.','Recorded ambiguous_context does not distinguish unsupported learned labels from path findings when rule replay reaches backend.','Rules-compatible detections may also coincide with learned output; origin cannot be uniquely attributed without per-source telemetry.','Tokenizer failure is a sufficient replay failure for that stream, not proof that the original run reached it before an earlier model failure.']};
const actualTotals=sum(cases.map(c=>c.actualExact));for(const k of ['tp','fp','fn'])if(actualTotals[k]!==score.metrics.exact.micro[k])throw Error('score_replay_mismatch');
const destination='docs/qa/privacy-token-ner-v1-diagnosis-2026-11-10.json',serialized=JSON.stringify(report,null,2)+'\n';
if(process.argv.length===3&&process.argv[2]==='--check'){if(await readFile(destination,'utf8')!==serialized)throw Error('diagnosis_changed');}
else if(process.argv.length===2)await writeFile(destination,serialized,{flag:'wx'});
else throw Error('invalid_argument');
console.log(JSON.stringify({...report,cases:undefined,provenance:undefined},null,2));
