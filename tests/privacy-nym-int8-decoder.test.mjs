import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { NYM_KINDS,NYM_LABELS,NYM_PINS,decodeNymNative,validateNymEncoding,validateNymNativeResult,originalCoordinates } from '../server/privacy/nym-int8-decoder.mjs';
const row=(label='O')=>Array.from({length:81},(_,i)=>i===NYM_LABELS.indexOf(label)?10:-10);
function fixture(text='Ana',ranges=[[0,3]],labels=['B-GIVEN_NAME']){
 const ids=[2,...ranges.map(()=>1000),1],n=ids.length;
 return {text,encoding:{ids,offsets:[[0,0],...ranges,[0,0]],specialMask:[1,...ranges.map(()=>0),1],attentionMask:ids.map(()=>1),typeIds:ids.map(()=>0),sequenceIds:[null,...ranges.map(()=>0),null],overflowing:[],offsetUnit:'unicode-codepoint'},logits:[[row(),...labels.map(row),row()]]};
}
const blocked=(input,code)=>{const r=decodeNymNative(input);assert.equal(r.status,'blocked');assert.equal(r.failure,code);assert.deepEqual(r.nativeSpans,[]);assert.equal(r.protectionPlan,null);assert.equal(r.egressEligible,false);return r;};
function python(code,input){
 const source=`import importlib.util,json,sys\ns=importlib.util.spec_from_file_location('nym_pure','scripts/privacy-nym-int8-worker.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nx=json.load(sys.stdin)\n${code}\n`;
 const r=spawnSync('/usr/bin/python3',['-I','-B','-c',source],{cwd:process.cwd(),input:JSON.stringify(input),encoding:'utf8',timeout:10000,env:{PATH:'/usr/bin:/bin'},maxBuffer:262144});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);
}
test('all40 native kinds retained with exact81 pinned labels; no mappings',()=>{
 assert.equal(NYM_KINDS.length,40);assert.equal(NYM_LABELS.length,81);
 const plan=JSON.parse(readFileSync('resources/privacy-nym-inference-development-v1.json'));assert.deepEqual(Object.values(plan.decoder.nativeId2label),NYM_LABELS);
 for(const kind of NYM_KINDS){const r=decodeNymNative(fixture('Ana',[[0,3]],[`B-${kind}`]));assert.equal(r.nativeSpans[0].kind,kind);assert.equal(r.mappingApproved,false);assert.equal(r.offsetContractValidated,false);assert.equal(r.egressEligible,false);assert.deepEqual(r.detections,[]);}
});
test('Unicode original UTF16/UTF8 exact, accents/NFD/astral/ZWJ no normalization',()=>{
 for(const text of ['José','Jose\u0301','😀','🧑‍⚖️','東京','\r\nAna']){
  const r=decodeNymNative(fixture(text,[[0,[...text].length]],['B-GIVEN_NAME']));assert.equal(r.status,'native-complete');const s=r.nativeSpans[0];assert.equal(s.end,text.length);assert.equal(s.utf8End,Buffer.byteLength(text));assert.equal(s.codepointEnd,[...text].length);assert.equal(s.provenance.textSha256,createHash('sha256').update(text).digest('hex'));assert.equal(s.provenance.modelSha256,NYM_PINS.modelSha256);
 }
});
test('strict BIO and minimum token confidence; no name joining',()=>{
 const f=fixture('Ana Pérez',[[0,3],[4,9]],['B-GIVEN_NAME','I-GIVEN_NAME']);f.logits[0][2]=Array(81).fill(0);f.logits[0][2][36]=5;
 const r=decodeNymNative(f);assert.equal(r.nativeSpans.length,1);assert.ok(Math.abs(r.nativeSpans[0].score-1/(1+80*Math.exp(-5)))<1e-12);assert.equal(r.nativeSpans[0].end,9);
 blocked(fixture('Ana',[[0,3]],['I-GIVEN_NAME']),'BIO_ORPHAN');blocked(fixture('Ana Pérez',[[0,3],[4,9]],['B-GIVEN_NAME','I-SURNAME']),'BIO_KIND');
 const b=decodeNymNative(fixture('Ana Pérez',[[0,3],[4,9]],['B-GIVEN_NAME','B-SURNAME']));assert.equal(b.nativeSpans.length,2);
});
test('O is confidence checked; ties/nonfinite all rows fail closed',()=>{
 const o=fixture('Ana',[[0,3]],['O']);assert.equal(decodeNymNative(o).nativeSpans.length,0);
 o.logits[0][1]=Array(81).fill(0);o.logits[0][1][0]=.1;blocked(o,'LOW_CONFIDENCE');
 for(const i of [0,1,2]){const f=fixture();f.logits[0][i]=Array(81).fill(0);blocked(f,'TIE');}
 for(const value of [NaN,Infinity,-Infinity,'1',true]){const f=fixture();f.logits[0][1][0]=value;blocked(f,'NONFINITE');}
});
test('coverage, duplicate/overlap and offset unit mismatches reject without repair',()=>{
 blocked(fixture('Ana',[[0,2]],['O']),'COVERAGE');blocked(fixture('😀',[[0,1],[0,1]],['O','O']),'OVERLAP');blocked(fixture('Ana',[[0,2],[1,3]],['O','O']),'OVERLAP');
 const f=fixture('😀',[[0,2]],['O']);blocked(f,'OFFSET');f.encoding.offsetUnit='utf8';blocked(f,'OVERFLOW');
 const z=fixture();z.encoding.offsets[1]=[0,0];blocked(z,'OFFSET');assert.throws(()=>originalCoordinates('\ud800'));
});
test('512 total bound,16KiB and no overflow/truncation/windows',()=>{
 const f=fixture('a'.repeat(510),Array.from({length:510},(_,i)=>[i,i+1]),Array(510).fill('O'));assert.equal(decodeNymNative(f).status,'native-complete');
 blocked(fixture('a'.repeat(511),Array.from({length:511},(_,i)=>[i,i+1]),Array(511).fill('O')),'OVERFLOW');
 blocked(fixture('a'.repeat(16385),[[0,16385]],['O']),'INPUT');const over=fixture();over.encoding.overflowing=[{}];blocked(over,'OVERFLOW');
});
test('postprocessor/masks, IDs, internal specials/controls/UNK reject',()=>{
 for(const id of [0,1,2,4,6,106,107,198772,198803]){const f=fixture();f.encoding.ids[1]=id;blocked(f,'CONTROL');}
 const f=fixture();f.encoding.ids[1]=3;blocked(f,'UNK');for(const id of [-1,198804,1.1]){f.encoding.ids[1]=id;blocked(f,'SHAPE');}
 for(const k of ['attentionMask','specialMask','typeIds','sequenceIds']){const x=fixture();x.encoding[k][1]=null;blocked(x,'SPECIAL');}
 const wrong=fixture();wrong.encoding.ids[0]=1;blocked(wrong,'SPECIAL');wrong.encoding={...fixture().encoding,unexpected:'ignored?'};blocked(wrong,'SHAPE');
});
test('legitimate added whitespace runs are preserved and source checked',()=>{
 for(const [text,id] of [['\n',108],['  ',139],['\t\t',198773]]){const f=fixture(text,[[0,text.length]],['O']);f.encoding.ids[1]=id;assert.equal(decodeNymNative(f).status,'native-complete');f.text='x'.repeat(text.length);blocked(f,'OFFSET');}
});
test('validated prefix is diagnostic only after later hard failure',()=>{
 const f=fixture('Ana x Pérez',[[0,3],[4,5],[6,11]],['B-GIVEN_NAME','O','I-SURNAME']);const r=blocked(f,'BIO_ORPHAN');assert.equal(r.validatedPrefix.length,1);assert.equal(r.validatedPrefix[0].kind,'GIVEN_NAME');
});
test('parent reconstruction rejects dropped or forged native output',()=>{
 const f=fixture(),r=decodeNymNative(f);assert.deepEqual(validateNymNativeResult(r,f),r);
 for(const edit of [r=>r.nativeSpans=[],r=>r.nativeSpans[0].kind='TAX_ID',r=>r.nativeSpans[0].end=2,r=>r.egressEligible=true]){const changed=structuredClone(r);edit(changed);assert.throws(()=>validateNymNativeResult(changed,f));}
});
test('Python pure decoder mirrors JS across all40 native labels and Unicode',()=>{
 const fixtures=NYM_KINDS.map(k=>fixture('😀José',[[0,5]],[`B-${k}`]));fixtures.push(fixture('😀',[[0,1],[0,1]],['O','O']),fixture('Ana',[[0,3]],['I-GIVEN_NAME']));
 const values=python("print(json.dumps([m.decode_native(v['text'],v['encoding'],v['logits']) for v in x]))",fixtures);
 for(let i=0;i<fixtures.length;i++)assert.deepEqual(values[i],decodeNymNative(fixtures[i]));
});
test('PLAN imports no inference/tokenizer runtime and does not read cache',()=>{
 const p=python("print(json.dumps({'plan':m.plan(),'loaded':[k for k in ('onnxruntime','tokenizers','numpy','torch') if k in sys.modules]}))",null);assert.deepEqual(p.loaded,[]);assert.equal(p.plan.forwards,0);assert.equal(p.plan.executionAuthorized,false);
});
test('finite receipt validation retains prefix and rejects late/malformed/extra events',()=>{
 const r=python(`rows=[{'text':'Ana'}]*8;v=m.EventValidator(rows)
v.accept({'event':'structural-start','index':0})
before=list(v.events)
def late(): raise m.Failure('DEADLINE')
try: m.admit_event(v,{'event':'structural-done','index':0,'code':None,'tokenCount':3,'roundtripExact':True,'tokenSlicesExact':True},late)
except m.Failure: pass
bad=0
for e in [{'event':'failed','code':'RAW_SENTINEL','phase':'WORKER','exceptionType':'OtherException'},{'event':'structural-done','index':7,'code':None,'tokenCount':3,'roundtripExact':True,'tokenSlicesExact':True}]:
 try:v.accept(e)
 except m.Failure:bad+=1
print(json.dumps({'prefixUnchanged':v.events==before,'bad':bad}))`,null);assert.deepEqual(r,{prefixUnchanged:true,bad:2});
});
test('global offset proof false retains eight witnesses and permits zero forward',()=>{
 const r=python(`v=m.EventValidator([{'text':'Ana'}]*8)
for i in range(8):
 v.accept({'event':'structural-start','index':i});v.accept({'event':'structural-done','index':i,'code':'OVERLAP' if i==2 else None,'tokenCount':3,'roundtripExact':True,'tokenSlicesExact':i!=2})
v.accept({'event':'offset-proof','established':False})
rejected=False
try:v.accept({'event':'forward-start','index':0})
except m.Failure:rejected=True
v.accept({'event':'complete','forwards':0,'decoded':0,'blocked':8,'code':'OFFSET_PROOF_UNESTABLISHED'})
print(json.dumps({'rejected':rejected,'finished':v.finished,'prefix':len(v.events),'forwards':v.forwards}))`,null);assert.deepEqual(r,{rejected:true,finished:true,prefix:18,forwards:0});
});
test('mocked parent retains validated prefix before cleanup faults, late IPC and cancellation',()=>{
 const result=python(`import tempfile,pathlib,io,os
original_root=m.ROOT
reports=[]
for mode in ('cleanup','late','cancel','gap','complete'):
 with tempfile.TemporaryDirectory() as directory:
  m.ROOT=pathlib.Path(directory);(m.ROOT/m.OUTPUT).parent.mkdir(parents=True)
  clock=[0.0];m.time.monotonic=lambda:clock[0]
  identity={'sourceHashes':{},'runtimeIdentity':{},'cacheFiles':[]}
  freeze={'version':1,'id':m.ID,'status':'frozen-reviewed','rootAuthorization':'one-fixed-structural-run','independentReview':'approved','identity':identity,'limits':m.LIMITS,'witnessesSha256':m.WITNESSES_SHA}
  m.read_fixed=lambda *args:m.canonical(freeze)
  m.identity=lambda *args,**kwargs:identity
  m.witnesses=lambda:[{'text':'Ana'}]*8
  class RSS:
   def read(self,pid):return 1024
  m.Rss=RSS
  events=[{'event':'structural-start','index':0},{'event':'failed','code':'RUNTIME','phase':'WORKER','exceptionType':'OtherException'}]
  if mode=='complete':
   events=[]
   for i in range(8):events.extend([{'event':'structural-start','index':i},{'event':'structural-done','index':i,'code':'OVERLAP' if i==2 else None,'tokenCount':3,'roundtripExact':True,'tokenSlicesExact':i!=2}])
   events.extend([{'event':'offset-proof','established':False},{'event':'complete','forwards':0,'decoded':0,'blocked':8,'code':'OFFSET_PROOF_UNESTABLISHED'}])
  data=b''.join(m.canonical(e)+b'\\n' for e in events)
  class Pipe:
   closed=False
   def write(self,b):return len(b)
   def close(self):self.closed=True
   def fileno(self):return 99
  class Child:
   pid=777
   stdin=Pipe();stdout=Pipe();read=False;killed=False
   def poll(self):return 0 if self.read else None
   def wait(self,timeout):
    if mode=='cleanup':raise OSError('RAW_SENTINEL_PRIVATE')
    self.read=True;return 0
  child=Child();m.subprocess.Popen=lambda *args,**kwargs:child
  class Selector:
   def register(self,*args):pass
   def select(self,*args):
    if mode=='late':clock[0]=60
    if mode=='gap':clock[0]+=.06
    if mode=='cancel':raise KeyboardInterrupt('RAW_SENTINEL_PRIVATE')
    return [1] if not child.read else []
   def close(self):pass
  m.selectors.DefaultSelector=Selector
  def read(fd,n):child.read=True;return data
  m.os.read=read;m.os.set_blocking=lambda *args:None
  m.os.killpg=lambda *args:setattr(child,'killed',True)
  receipt=m.run();saved=json.loads((m.ROOT/m.OUTPUT/'receipt.json').read_text());prefix=json.loads((m.ROOT/m.OUTPUT/'before-cleanup.json').read_text())
  reports.append({'mode':mode,'status':saved['status'],'failure':saved['failure'],'prefix':len(saved['validatedPrefix']),'preCleanupPrefix':len(prefix['validatedPrefix']),'cleanupObserved':saved['cleanupObserved'],'sentinelLeaked':'RAW_SENTINEL_PRIVATE' in json.dumps(saved),'forwards':saved['counts']['forwardStarted'],'blocked':saved['counts']['blocked']})
print(json.dumps(reports))`,null);
 for(const r of result)assert.equal(r.sentinelLeaked,false);
 assert.equal(result[0].failure,'RUNTIME');assert.equal(result[0].prefix,2);assert.equal(result[0].preCleanupPrefix,2);assert.equal(result[0].cleanupObserved,false);
 assert.equal(result[1].failure,'DEADLINE');assert.equal(result[1].prefix,0);
 assert.equal(result[2].failure,'CANCELLED');
 assert.equal(result[3].failure,'SAMPLE_GAP');
 assert.equal(result[4].status,'complete-native-diagnostic');assert.equal(result[4].forwards,0);assert.equal(result[4].blocked,8);
});
test('future worker forward plumbing is tested only with fake runtime modules',()=>{
 const r=python(`import types
from pathlib import Path
m.identity=lambda *a,**k:{'sourceHashes':{}};m.witnesses=lambda:[{'text':'Ana'}]*8;m.metadata=lambda:None
m.PYTHON=sys.executable;m.VERSIONS['python']=sys.version.split()[0];m.os.environ['LEX_NYM_V1_WORKER']='required';m.sys.platform='darwin'
encoding=types.SimpleNamespace(ids=[2,1000,1],offsets=[(0,0),(0,3),(0,0)],special_tokens_mask=[1,0,1],attention_mask=[1,1,1],type_ids=[0,0,0],sequence_ids=[None,0,None],overflowing=[])
class Tokenizer:
 @staticmethod
 def from_file(path):return Tokenizer()
 def get_vocab(self,with_added_tokens):return {str(i):i for i in range(198804)}
 def encode(self,text,add_special_tokens):return encoding
 def decode(self,ids,skip_special_tokens):return 'Ana'
class Socket:
 def connect(self,address):raise PermissionError()
 def close(self):pass
sys.modules['socket']=types.SimpleNamespace(socket=Socket)
sys.modules['tokenizers']=types.SimpleNamespace(__version__=m.VERSIONS['tokenizers'],Tokenizer=Tokenizer)
sys.modules['numpy']=types.SimpleNamespace(__version__=m.VERSIONS['numpy'],int64='int64',float32='float32',asarray=lambda v,dtype:v)
rows=[[10]+[-10]*80,[-10]*35+[10]+[-10]*45,[10]+[-10]*80]
class Tensor:
 dtype='float32';shape=(1,3,81)
 def tolist(self):return [rows]
class Session:
 calls=0
 def __init__(self,model,sess_options,providers):
  assert sess_options.intra_op_num_threads==sess_options.inter_op_num_threads==1
  assert sess_options.graph_optimization_level=='DISABLED';assert providers==['CPUExecutionProvider']
 def get_providers(self):return ['CPUExecutionProvider']
 def get_inputs(self):return [types.SimpleNamespace(name=n,type='tensor(int64)',shape=['batch_size','sequence_length']) for n in ('input_ids','attention_mask')]
 def get_outputs(self):return [types.SimpleNamespace(name='logits',type='tensor(float)',shape=['batch_size','sequence_length',81])]
 def run(self,names,inputs):Session.calls+=1;assert set(inputs)=={'input_ids','attention_mask'};return [Tensor()]
sys.modules['onnxruntime']=types.SimpleNamespace(__version__=m.VERSIONS['onnxruntime'],SessionOptions=lambda:types.SimpleNamespace(),GraphOptimizationLevel=types.SimpleNamespace(ORT_DISABLE_ALL='DISABLED'),InferenceSession=Session)
m.read_fixed=lambda *a:b'fake-model';m.PINS['modelSha256']=m.sha(b'fake-model');m.graph_envelope=lambda b:None
out=[];m.emit=out.append;m.worker({'deadline':m.time.monotonic()+10,'identity':{'sourceHashes':{}}})
v=m.EventValidator([{'text':'Ana'}]*8)
for event in out:v.accept(event)
print(json.dumps({'fakeForwards':Session.calls,'complete':v.finished,'nativeKinds':[v.results[i]['nativeSpans'][0]['kind'] for i in range(8)],'last':out[-1]}))`,null);
 assert.equal(r.fakeForwards,8);assert.equal(r.complete,true);assert.deepEqual(r.nativeKinds,Array(8).fill('GIVEN_NAME'));assert.deepEqual(r.last,{event:'complete',forwards:8,decoded:8,blocked:0,code:null});
});
test('worker JSON gate rejects duplicate keys/nonfinite constants before receipt admission',()=>{
 const r=python(`bad=0
for raw in ('{"event":"complete","event":"failed"}','{"value":NaN}','{"value":Infinity}'):
 try:m.strict_json(raw)
 except m.Failure:bad+=1
print(json.dumps({'bad':bad}))`,null);assert.equal(r.bad,3);
});
test('parent IPC rejects out-of-bound admitted token counts and non-integer indices',()=>{
 const r=python(`badCounts=badIndices=0
for count in (0,2,513,3.0,True,False):
 v=m.EventValidator([{'text':'A'}]*8);v.accept({'event':'structural-start','index':0})
 try:v.accept({'event':'structural-done','index':0,'code':None,'tokenCount':count,'roundtripExact':True,'tokenSlicesExact':True})
 except m.Failure:badCounts+=1
 assert len(v.events)==1 and not v.structural
validRow=lambda i:{'event':'structural-done','index':i,'code':None,'tokenCount':3,'roundtripExact':True,'tokenSlicesExact':True}
encoding={'ids':[2,1000,1],'offsets':[[0,0],[0,1],[0,0]],'specialMask':[1,0,1],'attentionMask':[1,1,1],'typeIds':[0,0,0],'sequenceIds':[None,0,None],'overflowing':[],'offsetUnit':'unicode-codepoint'}
result=m.decode_native('A',encoding,[[[10]+[-10]*80]*3])
for name in ('structural-start','structural-done','forward-start','forward-returned','decoded'):
 for index in (False,True,0.0,1.0):
  target=int(index);v=m.EventValidator([{'text':'A'}]*8);event={'event':name,'index':index}
  if name=='structural-start':v.structural=[validRow(i) for i in range(target)]
  elif name=='structural-done':v.pending=target;event={**validRow(target),'index':index}
  else:
   v.structural=[validRow(i) for i in range(8)];v.proof=True;v.results={i:result for i in range(target)}
   if name!='forward-start':v.forward=target
   if name=='decoded':v.returned=True;event['result']=result
  try:v.accept(event)
  except m.Failure:badIndices+=1
  assert not v.events
# Proof and forward gates themselves recheck counts, even if state is corrupted after admission.
for gate in ('offset-proof','forward-start'):
 v=m.EventValidator([{'text':'A'}]*8);v.structural=[validRow(i) for i in range(8)];v.structural[0]['tokenCount']=513
 if gate=='forward-start':v.proof=True
 try:v.accept({'event':gate,**({'established':True} if gate=='offset-proof' else {'index':0})});assert False
 except m.Failure:pass
# Explicitly blocked overflow witnesses remain recorded, never become admitted.
v=m.EventValidator([{'text':'A'}]*8)
for i in range(8):
 v.accept({'event':'structural-start','index':i});v.accept({'event':'structural-done','index':i,'code':'OVERFLOW','tokenCount':513,'roundtripExact':True,'tokenSlicesExact':True})
v.accept({'event':'offset-proof','established':False})
assert not any(m.structurally_admitted(x) for x in v.structural)
print(json.dumps({'badCounts':badCounts,'badIndices':badIndices,'blockedWitnesses':len(v.structural)}))`,null);
 assert.deepEqual(r,{badCounts:6,badIndices:20,blockedWitnesses:8});
});
test('parent result versions, scanned counts and all coordinates require strict nonbool integers',()=>{
 const f=fixture('A',[[0,1]],['B-GIVEN_NAME']);const r=python(`import copy
base=m.decode_native(x['text'],x['encoding'],x['logits']);m.validate_result(base,'A',3)
rejected=0
for field in ('version','scannedTokens'):
 for value in (True,False,float(base[field])):
  changed=copy.deepcopy(base);changed[field]=value
  try:m.validate_result(changed,'A',3)
  except m.Failure:rejected+=1
for field in ('start','end','codepointStart','codepointEnd','utf8Start','utf8End','tokenStart','tokenEnd'):
 original=base['nativeSpans'][0][field]
 for value in (bool(original),float(original)):
  changed=copy.deepcopy(base);changed['nativeSpans'][0][field]=value
  try:m.validate_result(changed,'A',3)
  except m.Failure:rejected+=1
for tokens in (True,False,3.0,0,2,513):
 try:m.validate_result(base,'A',tokens)
 except m.Failure:rejected+=1
print(json.dumps({'rejected':rejected}))`,f);
 assert.equal(r.rejected,28);
});
