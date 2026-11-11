import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tinyInventoryForTests,pinnedInventoryFromBytes,validateNymEncoding,decodeNymNative,NYM_LABELS,NYM_KINDS } from '../server/privacy/nym-int8-decoder-v2.mjs';
const added=(id,content)=>({id,content,special:false,normalized:false,lstrip:false,rstrip:false,single_word:false});
function fixture(text='Ana',tokens=['▁Ana'],ranges=[[0,3]],ids=tokens.map((_,i)=>1000+i),extras=[]){
 const n=ids.length+2;
 return {text,inventory:tinyInventoryForTests(Object.fromEntries(tokens.map((x,i)=>[x,ids[i]])),extras),encoding:{ids:[2,...ids,1],offsets:[[0,0],...ranges,[0,0]],specialMask:[1,...ids.map(()=>0),1],attentionMask:Array(n).fill(1),typeIds:Array(n).fill(0),sequenceIds:[null,...ids.map(()=>0),null],overflowing:[],offsetUnit:'unicode-codepoint'},logits:[Array.from({length:n},()=>[10,...Array(80).fill(-10)])]};
}
function blocked(f,code){const r=decodeNymNative(f);assert.equal(r.status,'blocked');assert.equal(r.failure,code);assert.equal(r.egressEligible,false);assert.equal(r.protectionPlan,null);return r;}
function python(code,input=null){
 const src=`import importlib.util,json,sys\ns=importlib.util.spec_from_file_location('nym_v2','scripts/privacy-nym-int8-worker-v2.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nx=json.load(sys.stdin)\n${code}`;
 const r=spawnSync('/usr/bin/python3',['-I','-B','-c',src],{input:JSON.stringify(input),encoding:'utf8',timeout:10000,maxBuffer:262144,env:{PATH:'/usr/bin:/bin'}});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);
}
test('first piece exact prefix, leading source space, later exact; no inverse trim',()=>{
 for(const f of [fixture(),fixture(' Ana',['▁Ana'],[[0,4]]),fixture('Ana X',['▁Ana','▁X'],[[0,3],[3,5]])])assert.equal(decodeNymNative(f).status,'native-complete');
 blocked(fixture('Ana',['Ana']),'CONTENT');blocked(fixture('Ana',['▁▁Ana']),'CONTENT');blocked(fixture(' Ana',['▁Ana'],[[1,4]]),'CONTENT');
 blocked(fixture('AnaX',['▁Ana','▁X'],[[0,3],[3,4]]),'CONTENT');
 blocked(fixture('Ana Ana',['▁Ana'],[[4,7]]),'COVERAGE');
});
test('exact added whitespace resets piece, consecutive entries retained; no forged flags/reset',()=>{
 const f=fixture('Ana\n\t\tX',['▁Ana','\n','\t\t','▁X'],[[0,3],[3,4],[4,6],[6,7]],[1000,108,198773,1001],[added(108,'\n'),added(198773,'\t\t')]);
 assert.equal(decodeNymNative(f).scannedTokens,6);
 assert.equal(decodeNymNative(fixture('\nAna',['\n','▁Ana'],[[0,1],[1,4]],[108,1000],[added(108,'\n')])).status,'native-complete');
 for(const flag of ['special','normalized','lstrip','rstrip','single_word']){
  const e=added(108,'\n');e[flag]=true;blocked(fixture('\nAna',['\n','▁Ana'],[[0,1],[1,4]],[108,1000],[e]),'CONTENT');
 }
 blocked(fixture('Ana\nX',['▁Ana','\n','X'],[[0,3],[3,4],[4,5]],[1000,108,1001],[added(108,'\n')]),'CONTENT');
 blocked(fixture('xx',['xx'],[[0,2]],[1000],[added(1000,'xx')]),'CONTENT');
});
test('single ASCII fallback only later full source slice; no multibyte/grouping or first fallback',()=>{
 assert.equal(decodeNymNative(fixture('A\r',['▁A','<0x0D>'],[[0,1],[1,2]])).status,'native-complete');
 blocked(fixture('\r',['<0x0D>'],[[0,1]]),'CONTENT');
 blocked(fixture('Aé',['▁A','<0xC3>'],[[0,1],[1,2]]),'CONTENT');
 blocked(fixture('Axx',['▁A','<0x78>'],[[0,1],[1,3]]),'CONTENT');
 blocked(fixture('A<0x78>',['▁A','<0x78>'],[[0,1],[1,7]]),'CONTENT');
});
test('original Unicode coordinates remain exact; overlap/zero/gaps/marker/UNK block',()=>{
 for(const text of ['José','Jose\u0301','東京','🧑‍⚖️']){
  const f=fixture(text,['▁'+text],[[0,[...text].length]]);f.logits[0][1]=Array(81).fill(-10);f.logits[0][1][35]=10;
  const r=decodeNymNative(f);assert.equal(r.status,'native-complete');assert.equal(r.nativeSpans[0].end,text.length);assert.equal(r.nativeSpans[0].utf8End,Buffer.byteLength(text));
 }
 blocked(fixture('😀',['▁😀','x'],[[0,1],[0,1]]),'OVERLAP');blocked(fixture('Ana',['▁Ana'],[[0,0]]),'OFFSET');blocked(fixture('Ana',['▁An'],[[0,2]]),'COVERAGE');blocked(fixture('▁',['▁▁'],[[0,1]]),'CONTENT');blocked(fixture('A',['▁A'],[[0,1]],[3]),'UNK');
});
test('all81 rows/O confidence/BIO remain strict and all40 native types unmapped',()=>{
 for(const kind of NYM_KINDS){const f=fixture();f.logits[0][1]=Array(81).fill(-10);f.logits[0][1][NYM_LABELS.indexOf('B-'+kind)]=10;const r=decodeNymNative(f);assert.equal(r.nativeSpans[0].kind,kind);assert.equal(r.mappingApproved,false);}
 const f=fixture();f.logits[0][1]=Array(81).fill(0);f.logits[0][1][0]=.1;blocked(f,'LOW_CONFIDENCE');
 for(const bad of [NaN,Infinity,true]){const x=fixture();x.logits[0][0][0]=bad;blocked(x,'NONFINITE');}
 const orphan=fixture();orphan.logits[0][1]=Array(81).fill(-10);orphan.logits[0][1][36]=10;blocked(orphan,'BIO_ORPHAN');
 const tie=fixture();tie.logits[0][0]=Array(81).fill(0);blocked(tie,'TIE');
});
test('tiny inventory is not IPC authority; full loader requires pinned bytes; limits strict',()=>{
 const f=fixture();f.inventory={raw:{1000:'▁Ana'}};blocked(f,'CONTENT');assert.throws(()=>pinnedInventoryFromBytes(Buffer.from('{}')));
 for(const value of [true,1.5]){const x=fixture();x.encoding.offsets[1][0]=value;blocked(x,'OFFSET');}
 const x=fixture();x.encoding.overflowing=[1];blocked(x,'OVERFLOW');blocked(fixture('a'.repeat(16385),['▁a'],[[0,1]]),'INPUT');
});
test('Python and JS pure witness and native result parity without runtime imports',()=>{
 const cases=[['Ana',['▁Ana'],[[0,3]]],[' Ana',['▁Ana'],[[0,4]]],['AnaX',['▁Ana','X'],[[0,3],[3,4]]],['A\r',['▁A','<0x0D>'],[[0,1],[1,2]]],['é',['é'],[[0,1]]],['▁',['▁▁'],[[0,1]]]];
 const values=cases.map(([text,tokens,ranges])=>{const f=fixture(text,tokens,ranges);return {...f,inventory:undefined,vocab:Object.fromEntries(tokens.map((t,i)=>[t,1000+i]))};});
 const r=python(`out=[]
for f in x:
 inv=m.tiny_inventory_for_tests(f['vocab']);out.append(m.decode_native(f['text'],f['encoding'],f['logits'],inv))
assert not any(k in sys.modules for k in ('tokenizers','numpy','onnxruntime'))
print(json.dumps(out))`,values);
 cases.forEach((a,i)=>assert.deepEqual(r[i],decodeNymNative(fixture(...a))));
});
const pySetup=`inv=m.tiny_inventory_for_tests({'▁Ana':1000,'x':1001,'<pad>':0})
e={'ids':[2,1000,1],'offsets':[[0,0],[0,3],[0,0]],'specialMask':[1,0,1],'attentionMask':[1,1,1],'typeIds':[0,0,0],'sequenceIds':[None,0,None],'overflowing':[],'offsetUnit':'unicode-codepoint'}
rows=[{'text':'Ana'} for _ in range(8)]
def feed(v):
 for i in range(8):
  item=m.copy.deepcopy(e);code=None
  if i==2:item['offsets'][1]=[0,0];code='OFFSET'
  if i==7:item['ids'][1]=0;code='CONTROL'
  v.accept({'event':'structural-start','index':i});v.accept({'event':'structural-done','index':i,'code':code,'tokenCount':3,'roundtripExact':False,'tokenSlicesExact':False,'encoding':item})
 v.accept({'event':'offset-proof','established':True})
`;
test('parent independently reconstructs six content witnesses; inverse mismatch retained; grant required',()=>{
 const r=python(pySetup+`v=m.EventValidator(rows,inv);feed(v)
assert not any('encoding' in event for event in v.events)
try:v.accept({'event':'forward-start','index':0});raise AssertionError()
except m.Failure:pass
v.granted=True;v.accept({'event':'forward-start','index':0})
print(json.dumps({'proof':v.proof,'forwards':v.forwards,'blocked':sum(not m.structurally_admitted(s) for s in v.structural),'inverse':v.structural[0]['roundtripExact']}))`);
 assert.deepEqual(r,{proof:true,forwards:1,blocked:2,inverse:false});
});
test('forged structural code/count/ID/endpoints/indices rejected transactionally',()=>{
 const r=python(pySetup+`bad=0
for mutate in ('count','boolindex','floatindex','id','range','falsecode'):
 v=m.EventValidator(rows,inv);v.accept({'event':'structural-start','index':0})
 event={'event':'structural-done','index':0,'code':None,'tokenCount':3,'roundtripExact':True,'tokenSlicesExact':True,'encoding':m.copy.deepcopy(e)}
 if mutate=='count':event['tokenCount']=513
 if mutate=='boolindex':event['index']=False
 if mutate=='floatindex':event['index']=0.0
 if mutate=='id':event['encoding']['ids'][1]=1001
 if mutate=='range':event['encoding']['offsets'][1]=[1,3]
 if mutate=='falsecode':event['code']='UNK'
 try:m.admit_event(v,event,lambda:None)
 except m.Failure:bad+=1
 assert len(v.events)==1 and not v.encodings
print(json.dumps(bad))`);assert.equal(r,6);
});
test('grant binds exact freeze/nonce/inventory-derived encodings; rejects stale, forged and late ACK',()=>{
 const r=python(pySetup+`v=m.EventValidator(rows,inv);feed(v)
ticket={'nonce':'a'*64,'freezeSha256':'b'*64,'identity':{'sourceHashes':{}}}
ack=m.grant(ticket,v.encodings);m.validate_grant(ack,ticket,v.encodings,lambda:None);bad=0
for key in ack:
 wrong=dict(ack);wrong[key]=False if key=='version' else 'forged'
 try:m.validate_grant(wrong,ticket,v.encodings,lambda:None)
 except m.Failure:bad+=1
try:m.validate_grant(ack,ticket,v.encodings,lambda:(_ for _ in ()).throw(m.Failure('DEADLINE')))
except m.Failure:bad+=1
print(json.dumps({'bad':bad,'fields':len(ack)}))`);assert.equal(r.bad,r.fields+1);
});
test('parent decoded endpoints must match actual contributing tokens; bool version rejected',()=>{
 const r=python(pySetup+`logits=[[[10]+[-10]*80,[-10]*35+[10]+[-10]*45,[10]+[-10]*80]]
result=m.decode_native('Ana',e,logits,inv);m.validate_result(result,'Ana',3,e,inv);bad=0
for field in ('version','codepointStart','tokenEnd','end'):
 wrong=m.copy.deepcopy(result)
 if field=='version':wrong[field]=True
 else:wrong['nativeSpans'][0][field]=True
 try:m.validate_result(wrong,'Ana',3,e,inv)
 except m.Failure:bad+=1
print(json.dumps(bad))`);assert.equal(r,4);
});
test('PLAN reads no files and imports no runtime; finite JSON rejects duplicates',()=>{
 const r=python(`m.read_fixed=lambda *args:(_ for _ in ()).throw(AssertionError('file read'))
p=m.plan();assert not any(k in sys.modules for k in ('tokenizers','numpy','onnxruntime'))
bad=0
for raw in ('{"x":1,"x":2}','{"x":NaN}'):
 try:m.strict_json(raw)
 except m.Failure:bad+=1
print(json.dumps({'plan':p['action'],'load':p['runtimeLoaded'],'bad':bad,'id':p['id']}))`);assert.deepEqual(r,{plan:'PLAN',load:false,bad:2,id:'nym-int8-native-decoder-v2'});
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
  m.pinned_inventory=lambda *args:m.tiny_inventory_for_tests({'▁Ana':1000})
  class RSS:
   def read(self,pid):return 1024
  m.Rss=RSS
  events=[{'event':'structural-start','index':0},{'event':'failed','code':'RUNTIME','phase':'WORKER','exceptionType':'OtherException'}]
  if mode=='complete':
   events=[]
   for i in range(8):events.extend([{'event':'structural-start','index':i},{'event':'structural-done','index':i,'code':'OVERFLOW','tokenCount':513,'roundtripExact':False,'tokenSlicesExact':False,'encoding':None}])
   events.extend([{'event':'offset-proof','established':False},{'event':'complete','forwards':0,'decoded':0,'blocked':8,'code':'OFFSET_PROOF_UNESTABLISHED'}])
  data=b''.join(m.canonical(e)+b'\\n' for e in events)
  class Pipe:
   closed=False
   def write(self,b):return len(b)
   def flush(self):pass
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

test('reviewed marker-run IDs are ordinary base BPE, never added-piece resets',()=>{
 const make=(raw='▁▁',part='  ',flags=added(139,'▁▁'),tail='Ana')=>fixture(part+'Ana',[raw,tail],[[0,[...part].length],[[...part].length,[...part].length+3]],[139,1000],[flags]);
 assert.equal(decodeNymNative(make()).status,'native-complete');
 blocked(make('▁▁','  ',added(139,'▁▁'),'▁Ana'),'CONTENT');
 blocked(make('▁▁','\u00a0\u00a0'),'OFFSET');
 blocked(make('▁▁','▁▁'),'OFFSET');
 const flags=added(139,'▁▁');flags.normalized=true;blocked(make('▁▁','  ',flags),'CONTENT');
 assert.throws(()=>make('▁▁▁','  '));
 assert.throws(()=>tinyInventoryForTests({'▁▁':140},[added(139,'▁▁')]));
 const wrongStart=fixture('   Ana',['▁▁','Ana'],[[1,3],[3,6]],[139,1000],[added(139,'▁▁')]);blocked(wrongStart,'CONTENT');
});
test('future worker forward plumbing is tested only with fake runtime modules',()=>{
 const r=python(`import types
from pathlib import Path
m.identity=lambda *a,**k:{'sourceHashes':{}};m.witnesses=lambda:[{'text':'Ana'}]*8;m.metadata=lambda:None
inv=m.tiny_inventory_for_tests({'▁Ana':1000,'<bos>':2,'<eos>':1,'<pad>':0});m.pinned_inventory=lambda *a:inv
m.PYTHON=sys.executable;m.VERSIONS['python']=sys.version.split()[0];m.os.environ['LEX_NYM_V2_WORKER']='required';m.sys.platform='darwin'
encoding=types.SimpleNamespace(ids=[2,1000,1],offsets=[(0,0),(0,3),(0,0)],special_tokens_mask=[1,0,1],attention_mask=[1,1,1],type_ids=[0,0,0],sequence_ids=[None,0,None],overflowing=[])
class Tokenizer:
 @staticmethod
 def from_file(path):return Tokenizer()
 calls=0
 def id_to_token(self,token):return inv.raw.get(token)
 def encode(self,text,add_special_tokens):
  item=m.copy.deepcopy(encoding);i=Tokenizer.calls;Tokenizer.calls+=1
  if i==2:item.offsets[1]=(0,0)
  if i==7:item.ids[1]=0
  return item
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
out=[];v=m.EventValidator([{'text':'Ana'}]*8,inv)
def emit(event):out.append(event);v.accept(event)
m.emit=emit
def acknowledge(ticket,encodings,deadline):
 assert Session.calls==0 and v.proof is True and len(v.structural)==8
 m.validate_grant(m.grant(ticket,v.encodings),ticket,encodings,lambda:m.check_deadline(deadline));v.granted=True
m.await_grant=acknowledge
m.worker({'deadline':m.time.monotonic()+10,'identity':{'sourceHashes':{}},'nonce':'a'*64,'freezeSha256':'b'*64})
success_calls=Session.calls;blocked=[]
for mode in ('missing','expired'):
 Tokenizer.calls=0;Session.calls=0;m.emit=lambda e:None
 def deny(*args):raise m.Failure('IPC' if mode=='missing' else 'DEADLINE')
 m.await_grant=deny
 try:m.worker({'deadline':m.time.monotonic()+10,'identity':{'sourceHashes':{}},'nonce':'a'*64,'freezeSha256':'b'*64})
 except m.Failure as error:blocked.append([error.code,Session.calls])
print(json.dumps({'denied':blocked,'fakeForwards':success_calls,'complete':v.finished,'nativeKinds':[v.results[i]['nativeSpans'][0]['kind'] for i in m.REQUIRED],'last':out[-1]}))`,null);
 assert.deepEqual(r.denied,[['IPC',0],['DEADLINE',0]]);assert.equal(r.fakeForwards,6);assert.equal(r.complete,true);assert.deepEqual(r.nativeKinds,Array(6).fill('GIVEN_NAME'));assert.deepEqual(r.last,{event:'complete',forwards:6,decoded:6,blocked:2,code:null});
});
test('bounded ACK reader rejects absence/EOF/trailing/forged/late packets without runtime imports',()=>{
 const r=python(pySetup+`import types
v=m.EventValidator(rows,inv);feed(v)
ticket={'nonce':'a'*64,'freezeSha256':'b'*64,'identity':{'sourceHashes':{}}};ack=m.grant(ticket,v.encodings)
results=[]
for mode in ('valid','absent','eof','trailing','forged','late'):
 clock=[0.0];m.time.monotonic=lambda:clock[0]
 class Selector:
  def register(self,*args):pass
  def select(self,seconds):
   clock[0]+=.02
   if mode=='late':clock[0]=1
   return [] if mode=='absent' else [1]
  def close(self):pass
 m.selectors.DefaultSelector=Selector;m.sys.stdin=types.SimpleNamespace(fileno=lambda:77);m.os.set_blocking=lambda *args:None
 value=dict(ack)
 if mode=='forged':value['nonce']='c'*64
 data=m.canonical(value)+b'\\n'
 if mode=='trailing':data+=b'{}'
 if mode=='eof':data=b''
 m.os.read=lambda *args:data
 try:m.await_grant(ticket,v.encodings,1);results.append('accepted')
 except m.Failure as error:results.append(error.code)
assert not any(k in sys.modules for k in ('tokenizers','numpy','onnxruntime'))
print(json.dumps(results))`);
 assert.deepEqual(r,['accepted','DEADLINE','IPC','IPC','IPC','DEADLINE']);
});

test('versioned runner binds all four v2 sources and a fresh v2 output, preserving v1 history',()=>{
 const c=python("print(json.dumps({'id':m.ID,'script':m.SCRIPT,'sources':list(m.SOURCES),'freeze':m.FREEZE,'output':m.OUTPUT,'plan':m.plan()}))");
 assert.equal(c.id,'nym-int8-native-decoder-v2');
 assert.equal(c.script,'scripts/privacy-nym-int8-worker-v2.py');
 assert.equal(c.freeze,'docs/qa/privacy-nym-int8-decoder-v2-freeze.json');
 assert.equal(c.output,'artifacts/privacy/nym-int8-decoder-v2-first');
 for(const source of ['scripts/privacy-nym-int8-worker-v2.py','server/privacy/nym-int8-decoder-v2.mjs','tests/privacy-nym-int8-decoder-v2.test.mjs','docs/architecture/privacy-nym-int8-decoder-v2.md'])assert.ok(c.sources.includes(source),source);
 for(const historical of ['scripts/privacy-nym-int8-worker.py','server/privacy/nym-int8-decoder.mjs','docs/qa/privacy-nym-int8-decoder-v1-freeze.json','artifacts/privacy/nym-int8-decoder-v1-first'])assert.ok(!c.sources.includes(historical));
 assert.equal(c.plan.outputDirectory,c.output);assert.equal(c.plan.freezePath,c.freeze);
 assert.equal(c.plan.action,'PLAN');assert.equal(c.plan.runtimeLoaded,false);assert.equal(c.plan.forwards,0);
});
