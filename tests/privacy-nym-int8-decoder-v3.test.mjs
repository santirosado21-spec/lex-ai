import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tinyInventoryForTests,pinnedInventoryFromBytes,validateNymEncoding,decodeNymNative,NYM_LABELS,NYM_KINDS } from '../server/privacy/nym-int8-decoder-v3.mjs';
const added=(id,content)=>({id,content,special:false,normalized:false,lstrip:false,rstrip:false,single_word:false});
function fixture(text='Ana',tokens=['▁Ana'],ranges=[[0,3]],ids=tokens.map((_,i)=>1000+i),extras=[]){
 const n=ids.length+2;
 return {text,inventory:tinyInventoryForTests(Object.fromEntries(tokens.map((x,i)=>[x,ids[i]])),extras),encoding:{ids:[2,...ids,1],offsets:[[0,0],...ranges,[0,0]],specialMask:[1,...ids.map(()=>0),1],attentionMask:Array(n).fill(1),typeIds:Array(n).fill(0),sequenceIds:[null,...ids.map(()=>0),null],overflowing:[],offsetUnit:'unicode-codepoint'},logits:[Array.from({length:n},()=>[10,...Array(80).fill(-10)])]};
}
function blocked(f,code){const r=decodeNymNative(f);assert.equal(r.status,'blocked');assert.equal(r.failure,code);assert.equal(r.egressEligible,false);assert.equal(r.protectionPlan,null);return r;}
function python(code,input=null){
 const src=`import importlib.util,json,sys\ns=importlib.util.spec_from_file_location('nym_v2','scripts/privacy-nym-int8-worker-v3.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nx=json.load(sys.stdin)\n${code}`;
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
print(json.dumps({'plan':p['action'],'load':p['runtimeLoaded'],'bad':bad,'id':p['id']}))`);assert.deepEqual(r,{plan:'PLAN',load:false,bad:2,id:'nym-int8-native-decoder-v3'});
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
m.PYTHON=sys.executable;m.VERSIONS['python']=sys.version.split()[0];m.os.environ['LEX_NYM_V3_WORKER']='required';m.sys.platform='darwin'
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

test('versioned runner binds all five v3 sources and a fresh v3 output, preserving v1/v2 history',()=>{
 const c=python("print(json.dumps({'id':m.ID,'script':m.SCRIPT,'sources':list(m.SOURCES),'freeze':m.FREEZE,'output':m.OUTPUT,'plan':m.plan()}))");
 assert.equal(c.id,'nym-int8-native-decoder-v3');
 assert.equal(c.script,'scripts/privacy-nym-int8-worker-v3.py');
 assert.equal(c.freeze,'docs/qa/privacy-nym-int8-decoder-v3-freeze.json');
 assert.equal(c.output,'artifacts/privacy/nym-int8-decoder-v3-first');
 for(const source of ['resources/privacy-nym-streaming-inventory-v3.json','scripts/privacy-nym-int8-worker-v3.py','server/privacy/nym-int8-decoder-v3.mjs','tests/privacy-nym-int8-decoder-v3.test.mjs','docs/architecture/privacy-nym-int8-decoder-v3.md'])assert.ok(c.sources.includes(source),source);
 for(const historical of ['scripts/privacy-nym-int8-worker.py','server/privacy/nym-int8-decoder.mjs','docs/qa/privacy-nym-int8-decoder-v1-freeze.json','artifacts/privacy/nym-int8-decoder-v1-first'])assert.ok(!c.sources.includes(historical));
 assert.equal(c.plan.outputDirectory,c.output);assert.equal(c.plan.freezePath,c.freeze);
 assert.equal(c.plan.action,'PLAN');assert.equal(c.plan.runtimeLoaded,false);assert.equal(c.plan.forwards,0);
});
const streamSetup=`import io
flags={k:False for k in ('special','normalized','lstrip','rstrip','single_word')}
def row(i,token,added=None):return {'id':i,'token':token,'baseBpePresence':True,'added':added}
def wire(rows):return b''.join(m.canonical(r)+b'\\n' for r in rows)
def load(data,count,added=0,observe=lambda:None,digest=None):return m.parse_inventory_stream(io.BytesIO(data),count,added,len(data),digest or m.sha(data),observe)
`;
test('stream uses binary LF, strict UTF8 and bounded reads; Unicode line separators remain content',()=>{
 const r=python(streamSetup+`rows=[row(0,'a\\u2028b'),row(1,'c\\u0085d'),row(2,'\\n',flags)];data=wire(rows)
class SmallReads:
 def __init__(self):self.at=0;self.calls=0
 def read(self,n):
  assert n==4096;self.calls+=1;chunk=data[self.at:self.at+3];self.at+=len(chunk);return chunk
stream=SmallReads();checks=[0]
def observe():checks[0]+=1
inv=m.parse_inventory_stream(stream,3,1,len(data),m.sha(data),observe)
assert inv.raw[0]=='a\\u2028b' and inv.raw[1]=='c\\u0085d';assert inv.added[2]['content']=='\\n'
assert m.copy.deepcopy(inv) is inv
immutable=0
for target,key in ((inv.raw,0),(inv.added[2],'special')):
 try:target[key]=False
 except TypeError:immutable+=1
print(json.dumps({'rows':len(inv.raw),'checks':checks[0],'reads':stream.calls,'immutable':immutable}))`);
 assert.equal(r.rows,3);assert.equal(r.immutable,2);assert.ok(r.checks>=2*r.reads);
});
test('stream rejects gaps/duplicates/boolIDs/baseflags/types/UTF8/noncanonical/trailing/oversize/hash corruption',()=>{
 const r=python(streamSetup+`good=[row(0,'A'),row(1,'B')];cases=[]
for changed in ([row(0,'A'),row(0,'B')],[row(0,'A'),row(2,'B')],[row(False,'A')],[row(0,'A'),row(1,'A')],[{**row(0,'A'),'baseBpePresence':1}],[{**row(0,'A'),'baseBpePresence':False}],[row(0,'A',{**flags,'special':0})],[row(0,'A',{'special':False})],[row(0,'\\ud800')]):
 try:cases.append((wire(changed),len(changed),int(changed[0]['added'] is not None)))
 except UnicodeError:cases.append((b'{"added":null,"baseBpePresence":true,"id":0,"token":"\\\\ud800"}\\n',1,0))
cases += [(wire(good)[:-1],2,0),(wire(good)+b'\\n',2,0),(wire(good)+b'{}',2,0),(b'\\xff\\n',1,0),(wire([row(0,'A')]).replace(b'"id":0',b'"id":0,"id":0'),1,0),(wire([row(0,'A')]).replace(b'"id":0',b'"id": 0'),1,0),(wire([row(0,'x'*4096)]),1,0)]
bad=0
for data,n,added in cases:
 try:load(data,n,added)
 except (m.Failure,ValueError,UnicodeError):bad+=1
try:load(wire(good),2,digest='0'*64)
except m.Failure:bad+=1
print(json.dumps({'bad':bad,'expected':len(cases)+1}))`);assert.equal(r.bad,r.expected);
});
test('stream callbacks interrupt allocation/parsing on deadline, resource and sample-gap failures',()=>{
 const r=python(streamSetup+`data=wire([row(i,'t'+str(i)) for i in range(100)]);out=[]
for code in ('DEADLINE','RESOURCE','SAMPLE_GAP'):
 checks=[0]
 def observe():
  checks[0]+=1
  if checks[0]==5:raise m.Failure(code)
 try:load(data,100,observe=observe)
 except m.Failure as error:out.append([error.code,checks[0]])
print(json.dumps(out))`);assert.deepEqual(r,[['DEADLINE',5],['RESOURCE',5],['SAMPLE_GAP',5]]);
});
test('event admission does not deep-copy vocabulary and preserves old state on a late event',()=>{
 const r=python(pySetup+`v=m.EventValidator(rows,inv);feed(v)
class NoCopy:
 def __deepcopy__(self,memo):raise AssertionError('vocabulary copy')
v.inventory=NoCopy()
calls=[0]
def check():
 calls[0]+=1
 if calls[0]==2:raise m.Failure('DEADLINE')
v.granted=True;before=len(v.events)
try:m.admit_event(v,{'event':'forward-start','index':0},check)
except m.Failure:pass
assert v.forward is None and len(v.events)==before
print(json.dumps({'unchanged':True,'checks':calls[0]}))`);assert.deepEqual(r,{unchanged:true,checks:2});
});
test('prepared header/receipt require exact provenance, completed status and strict counts',()=>{
 const r=python(`header={'counts':{'addedEntries':249,'addedOnlyRows':0,'baseBpeEntries':198804,'unionRows':198804},'encoding':'UTF8 canonical JSON per row, sorted by raw ID','generatorSha256':m.PREP_SOURCES['scripts/prepare-nym-content-inventory.py'],'id':'nym-content-inventory-v1','inventoryBytes':m.ASSETS['inventory.ndjson']['bytes'],'inventorySha256':m.ASSETS['inventory.ndjson']['sha256'],'protocolSha256':m.PREP_SOURCES['resources/privacy-nym-inventory-preparation-v1.json'],'revision':m.PINS['revision'],'rowCount':198804,'schemaVersion':1,'sourceHashes':m.PREP_SOURCES,'sourceTokenizerSha256':m.PINS['tokenizerSha256']}
receipt={'freezeSha256':m.PREP_FREEZE,'header':header,'id':header['id'],'inferencePerformed':False,'networkPerformed':False,'resources':{'elapsedMs':1,'processPeakRssBytes':1,'scope':'synthetic fixture'},'sourceHashes':m.PREP_SOURCES,'sourceTokenizerSha256':m.PINS['tokenizerSha256'],'status':'complete-build-asset'}
m.validate_prepared_metadata(header,receipt);bad=0
for field in ('schemaVersion','rowCount','inventorySha256','sourceTokenizerSha256','sourceHashes','generatorSha256'):
 h=m.copy.deepcopy(header);h[field]=True if field in ('schemaVersion','rowCount') else 'wrong'
 try:m.validate_prepared_metadata(h,receipt)
 except m.Failure:bad+=1
for field in ('status','freezeSha256','networkPerformed','inferencePerformed'):
 r=m.copy.deepcopy(receipt);r[field]='wrong'
 try:m.validate_prepared_metadata(header,r)
 except m.Failure:bad+=1
print(json.dumps(bad))`);assert.equal(r,10);
});
test('prepared-file opens reject symlinks, writable files, wrong mode/size and inode replacement using tiny fixtures',()=>{
 const r=python(`import tempfile,pathlib,os
bad=0
with tempfile.TemporaryDirectory() as directory:
 m.ROOT=pathlib.Path(directory);m.PREPARED='asset';base=m.ROOT/'asset';base.mkdir(mode=0o700)
 m.ASSETS={'inventory.ndjson':{'bytes':1,'sha256':m.sha(b'x')}};p=base/'inventory.ndjson';p.write_bytes(b'x');p.chmod(0o400)
 f,before=m.open_prepared('inventory.ndjson');m.same_asset(f,before,'inventory.ndjson');f.close()
 for mode in ('writable','directory','size','link','hardlink','replacement'):
  p.unlink(missing_ok=True);p.write_bytes(b'x');p.chmod(0o400);base.chmod(0o700)
  if mode=='writable':p.chmod(0o600)
  if mode=='directory':base.chmod(0o755)
  if mode=='size':p.chmod(0o600);p.write_bytes(b'xx');p.chmod(0o400)
  if mode=='link':p.unlink();p.symlink_to(base/'target')
  if mode=='hardlink':os.link(p,base/'second')
  try:
   f,before=m.open_prepared('inventory.ndjson')
   with f:
    if mode=='replacement':p.unlink();p.write_bytes(b'x');p.chmod(0o400)
    m.same_asset(f,before,'inventory.ndjson')
  except (m.Failure,OSError):bad+=1
  (base/'second').unlink(missing_ok=True)
print(json.dumps(bad))`);assert.equal(r,6);
});
test('critical v2 and v3 content/BIO/encoding functions are byte-identical; prepared bindings fixed',()=>{
 const r=python(`import ast,pathlib
old=pathlib.Path('scripts/privacy-nym-int8-worker-v2.py').read_text();new=pathlib.Path('scripts/privacy-nym-int8-worker-v3.py').read_text()
def functions(source):
 tree=ast.parse(source);return {n.name:ast.get_source_segment(source,n) for n in tree.body if isinstance(n,ast.FunctionDef)}
a=functions(old);b=functions(new)
assert all(a[k]==b[k] for k in ('coordinates','validate_encoding','content_witness','decode_native','validate_result','validate_grant','await_grant'))
assert "CACHE+'/int8/tokenizer.json'" not in b['metadata'] and "CACHE+'/int8/config.json'" in b['metadata']
assert '.splitlines(' not in b['parse_inventory_stream']
assert len(m.PREP_SOURCES)==4 and all(p in m.SOURCES for p in m.PREP_SOURCES)
assert m.PROTOCOL in m.SOURCES and m.PROTOCOL=='resources/privacy-nym-streaming-inventory-v3.json'
print(json.dumps({'identical':True,'sources':list(m.SOURCES),'assets':m.ASSETS}))`);
 assert.equal(r.identical,true);assert.equal(r.assets['inventory.ndjson'].sha256,'34ec3e534699ab59b4a25a040c3a536aa54ef057056948d785f4260a3bbc9f5d');
 assert.ok(r.sources.includes('server/privacy/nym-int8-decoder-v3.mjs'));
});
test('v3 protocol digest and JS critical functions retain frozen v2 semantics',()=>{
 const old=readFileSync('server/privacy/nym-int8-decoder-v2.mjs','utf8'),current=readFileSync('server/privacy/nym-int8-decoder-v3.mjs','utf8');
 const core=s=>s.slice(s.indexOf('export function validateNymEncoding'),s.indexOf('// Inventory handles'));
 assert.equal(core(current),core(old));assert.equal(current.slice(current.indexOf('function witnessContent')),old.slice(old.indexOf('function witnessContent')));
 const p=python("print(json.dumps({'protocol':m.PROTOCOL,'sha':m.PROTOCOL_SHA}))");assert.equal(createHash('sha256').update(readFileSync(p.protocol)).digest('hex'),p.sha);
});
test('stream total cap rejects before read and callbacks remain bounded between parsed rows',()=>{
 const r=python(streamSetup+`class NoRead:
 def read(self,n):raise AssertionError('oversized admission read')
try:m.parse_inventory_stream(NoRead(),1,0,33554433,'0'*64,lambda:None);raise AssertionError()
except m.Failure:pass
rows=[row(i,'x'+str(i)) for i in range(64)];data=wire(rows);checks=[0]
def check():checks[0]+=1
inv=load(data,64,observe=check)
assert len(inv.raw)==64 and checks[0]>=8
print(json.dumps({'cap':True,'checks':checks[0]}))`);assert.equal(r.cap,true);assert.ok(r.checks>=8);
});
