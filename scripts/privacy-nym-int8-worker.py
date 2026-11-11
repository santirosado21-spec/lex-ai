#!/usr/bin/env python3
"""Inactive Nym native decoder; standard-library PLAN by default. No automatic load/download.
Only a future independently reviewed fixed freeze admits the fixed structural packet.
No imports from the historically failed probe; no production mapping/egress authority.
"""
import ctypes
import copy
import hashlib
import json
import math
import os
from pathlib import Path
import selectors
import signal
import stat
import subprocess
import sys
import time

ROOT=Path(__file__).resolve().parents[1]
ID='nym-int8-native-decoder-v1'
SCRIPT='scripts/privacy-nym-int8-worker.py'
PROTOCOL='resources/privacy-nym-inference-development-v1.json'
PROTOCOL_SHA='5b3df7a6d443790edcdbac14d829745c090873f8440de98dc540ccf23137a2eb'
WITNESSES='resources/privacy-nym-structural-witnesses-v1.json'
WITNESSES_SHA='8c266b1fb5d49dc0929af610dd2484783d3cd71bd856c34baeb908bb082a0b24'
FREEZE='docs/qa/privacy-nym-int8-decoder-v1-freeze.json'
OUTPUT='artifacts/privacy/nym-int8-decoder-v1-first'
CACHE='artifacts/privacy/models/nym-int8-local-v2'
ENV='artifacts/privacy/onnx-env'
PYTHON=ENV+'/bin/python'
SOURCES=(SCRIPT,'server/privacy/nym-int8-decoder.mjs','tests/privacy-nym-int8-decoder.test.mjs','docs/architecture/privacy-nym-int8-decoder-v1.md',PROTOCOL,WITNESSES,'resources/privacy-nym-int8-candidate-v1.json')
VERSIONS={'python':'3.12.13','numpy':'2.5.4','onnxruntime':'1.31.1','tokenizers':'0.23.3'}
PINS={'revision':'4348999cd3c2e20c49615e9af7c6bbb45b64cd85','modelSha256':'139006aea2cbd8e709d322f056232570de54661f624143be4893aaa387190286','tokenizerSha256':'c299144e68dfec1dc536204a7ae3712710c5c6cade9269a83f5042250d47d8de'}
FILES=[('README.md',6717,'74c55f42afcad1e5c1ea9b059f37d9d48e5641e04628642a12444721c57f3d9e'),('int8/config.json',5688,'3f07065571e22bb73eba28ddb1fae4509c0cf703762e3bfa7a6ab2111cf7cb88'),('tokenizer_config.json',573,'02055b886266b1a475bc324da83e273fe96e4974002f9d970f26e94aa73e5885'),('.gitattributes',1687,'48030a73329817519a47704c56b3e891b4227a19742a138374b9f6ccde002004'),('int8/model_int8.onnx',138730982,PINS['modelSha256']),('int8/tokenizer.json',12389891,PINS['tokenizerSha256'])]
LIMITS={'totalMs':60000,'cleanupMs':1000,'combinedRssBytes':1073741824,'sampleIntervalMs':20,'maximumGapMs':50,'stdoutBytes':131072,'tokens':512,'inputBytes':16384,'fixtures':8,'forwards':8,'threads':1,'retries':0,'graphOptimization':'ORT_DISABLE_ALL'}
KINDS=['ACCOUNT_NUMBER','AGE','API_KEY','BUILDING_NUMBER','CITY','COMPANY_NAME','COUNTRY','CREDIT_DEBIT_CARD','CUSTOMER_ID','CVV','DATE','DATE_OF_BIRTH','DRIVERS_LICENSE','EMAIL','EMPLOYEE_ID','FAX_NUMBER','GENDER','GIVEN_NAME','GOVERNMENT_ID','IBAN','LICENSE_PLATE','MAC_ADDRESS','MEDICAL_RECORD_NUMBER','PASSPORT','PASSWORD','PHONE','PIN','ROUTING_NUMBER','SECONDARY_ADDRESS','SSN','STATE','STREET_ADDRESS','STREET_NAME','SURNAME','SWIFT_BIC','TAX_ID','TIME','URL','USERNAME','ZIP_CODE']
LABELS=['O']+[p+k for k in KINDS for p in ('B-','I-')]
CODES=set('INPUT SHAPE OVERFLOW SPECIAL UNK CONTROL OFFSET OVERLAP COVERAGE NONFINITE TIE LOW_CONFIDENCE BIO_ORPHAN BIO_KIND BIO_GAP UNKNOWN FREEZE IDENTITY PLATFORM DEADLINE RESOURCE SAMPLE_GAP RESOURCE_UNAVAILABLE IPC OUTPUT_LIMIT CLEANUP RUNTIME POSTPROCESSOR OFFSET_PROOF_UNESTABLISHED FORWARD_FAILURE CANCELLED WORKER_EXIT'.split())
class Failure(Exception):
 def __init__(self,code):self.code=code if code in CODES else 'UNKNOWN';super().__init__(self.code)
def need(ok,code):
 if not ok:raise Failure(code)
def exact(x,keys):return type(x) is dict and set(x)==set(keys)
def integer(x):return type(x) is int
def white(c):return ord(c) in set(range(9,14))|{32,133,160,5760,8232,8233,8239,8287,12288}|set(range(8192,8203))
def sha(b):return hashlib.sha256(b).hexdigest()
def canonical(x):return json.dumps(x,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()
def strict_json(raw):
 def pairs(items):
  out={}
  for key,value in items:
   need(key not in out,'IPC');out[key]=value
  return out
 def invalid(value):raise Failure('IPC')
 return json.loads(raw,object_pairs_hook=pairs,parse_constant=invalid)

def coordinates(text):
 need(type(text) is str and 0<len(text) and not any(0xd800<=ord(c)<=0xdfff for c in text),'INPUT');need(len(text.encode())<=16384,'INPUT')
 u=[0];b=[0]
 for c in text:u.append(u[-1]+(2 if ord(c)>65535 else 1));b.append(b[-1]+len(c.encode()))
 return u,b

def validate_encoding(text,e):
 u,b=coordinates(text)
 need(exact(e,('ids','offsets','specialMask','attentionMask','typeIds','sequenceIds','overflowing','offsetUnit')),'SHAPE')
 need(e['offsetUnit']=='unicode-codepoint' and type(e['overflowing']) is list and not e['overflowing'],'OVERFLOW')
 need(type(e['ids']) is list and 3<=len(e['ids'])<=512,'OVERFLOW');n=len(e['ids'])
 need(all(type(e[k]) is list and len(e[k])==n for k in ('ids','offsets','specialMask','attentionMask','typeIds','sequenceIds')),'SHAPE')
 last=0;covered=set()
 for i,(token,pair) in enumerate(zip(e['ids'],e['offsets'])):
  special=i in (0,n-1)
  need(integer(token) and 0<=token<=198803,'SHAPE')
  need(type(e['attentionMask'][i]) is int and e['attentionMask'][i]==1 and type(e['typeIds'][i]) is int and e['typeIds'][i]==0 and type(e['specialMask'][i]) is int and e['specialMask'][i]==int(special) and (e['sequenceIds'][i] is None if special else type(e['sequenceIds'][i]) is int and e['sequenceIds'][i]==0),'SPECIAL')
  need(type(pair) in (list,tuple) and len(pair)==2 and all(integer(v) for v in pair),'OFFSET');a,z=pair
  if special:need(token==(2 if i==0 else 1) and a==z==0,'SPECIAL');continue
  need(token!=3,'UNK');need(token>107 and token not in (198772,198803),'CONTROL')
  need(0<=a<z<=len(text),'OFFSET');need(a>=last,'OVERLAP');last=z;covered.update(range(a,z))
  if 108<=token<=138:need(text[a:z]=='\n'*(token-107),'OFFSET')
  if 139<=token<=168:need(text[a:z]==' '*(token-137),'OFFSET')
  if 198773<=token<=198802:need(text[a:z]=='\t'*(token-198771),'OFFSET')
 need(all(white(c) or i in covered for i,c in enumerate(text)),'COVERAGE');return u,b

def decode_native(text,encoding,logits):
 prefix=[];phase='INPUT'
 base={'version':1,'candidateId':ID,'diagnosticOnly':True,'egressEligible':False,'mappingApproved':False,'protectionPlan':None,'detections':[],'offsetContractValidated':False}
 try:
  phase='ENCODING';u,b=validate_encoding(text,encoding);provenance={**PINS,'textSha256':sha(text.encode())};phase='LOGITS';n=len(encoding['ids'])
  need(type(logits) is list and len(logits)==1 and type(logits[0]) is list and len(logits[0])==n,'SHAPE');active=None
  for i,row in enumerate(logits[0]):
   need(type(row) is list and len(row)==81,'SHAPE');need(all(type(x) in (int,float) and math.isfinite(x) for x in row),'NONFINITE')
   maximum=max(row);winners=[j for j,x in enumerate(row) if x==maximum];need(len(winners)==1,'TIE')
   if encoding['specialMask'][i]:
    if active:prefix.append({**active,'provenance':dict(provenance)});active=None
    continue
   score=1/sum(math.exp(x-maximum) for x in row);need(math.isfinite(score) and score>=.4,'LOW_CONFIDENCE')
   label=LABELS[winners[0]];a,z=encoding['offsets'][i];phase='BIO'
   if label=='O' or label.startswith('B-'):
    if active:prefix.append({**active,'provenance':dict(provenance)});active=None
   if label=='O':continue
   kind=label[2:]
   if label.startswith('B-'):active={'kind':kind,'start':u[a],'end':u[z],'codepointStart':a,'codepointEnd':z,'utf8Start':b[a],'utf8End':b[z],'tokenStart':i,'tokenEnd':i+1,'score':score}
   else:
    need(active is not None,'BIO_ORPHAN');need(active['kind']==kind,'BIO_KIND');need(all(white(c) for c in text[active['codepointEnd']:a]),'BIO_GAP')
    active.update(end=u[z],codepointEnd=z,utf8End=b[z],tokenEnd=i+1,score=min(active['score'],score))
  if active:prefix.append({**active,'provenance':dict(provenance)})
  return {**base,'status':'native-complete','failure':None,'phase':'COMPLETE','nativeSpans':prefix,'validatedPrefix':[],'scannedTokens':n}
 except Failure as e:return {**base,'status':'blocked','failure':e.code,'phase':phase,'nativeSpans':[],'validatedPrefix':prefix,'scannedTokens':None}

def plan():return {'version':1,'id':ID,'action':'PLAN','executionAuthorized':False,'runtimeLoaded':False,'forwards':0,'mappingApproved':False,'egressEligible':False,'limits':LIMITS,'freezePath':FREEZE,'outputDirectory':OUTPUT,'witnessesSha256':WITNESSES_SHA,'offsetProofRequired':True}

def check_deadline(deadline):need(time.monotonic()<deadline,'DEADLINE')
def read_fixed(relative,maximum):
 path=ROOT/relative;need(not Path(relative).is_absolute() and '..' not in Path(relative).parts,'IDENTITY')
 current=ROOT
 for part in Path(relative).parts:
  current=current/part;need(not current.is_symlink(),'IDENTITY')
 with path.open('rb') as f:
  need(stat.S_ISREG(os.fstat(f.fileno()).st_mode),'IDENTITY');data=f.read(maximum+1)
 need(len(data)<=maximum,'IDENTITY');return data

def identity(deadline,observe=None,parent_source_pins=None):
 def check():
  check_deadline(deadline)
  if observe is not None:observe()
 sources={p:(parent_source_pins[p] if parent_source_pins is not None and p.startswith("docs/") else sha(read_fixed(p,262144))) for p in SOURCES};need(sources[PROTOCOL]==PROTOCOL_SHA and sources[WITNESSES]==WITNESSES_SHA,'IDENTITY')
 def filehash(path):
  acc=hashlib.sha256()
  with path.open('rb') as f:
   while True:
    check();chunk=f.read(65536)
    if not chunk:break
    acc.update(chunk)
  return acc.hexdigest()
 cache=[]
 for p,size,digest in FILES:
  path=ROOT/CACHE/p
  current=ROOT
  for part in Path(CACHE+'/'+p).parts:
   current=current/part;need(not current.is_symlink(),'IDENTITY')
  need(path.is_file() and not path.is_symlink() and path.stat().st_size==size and stat.S_IMODE(path.stat().st_mode)==0o400,'IDENTITY');need(filehash(path)==digest,'IDENTITY');cache.append({'path':p,'bytes':size,'sha256':digest})
 base=ROOT/ENV;files=[];need(base.is_dir() and not base.is_symlink(),'IDENTITY')
 for current,dirs,names in os.walk(base/'lib',followlinks=False):
  check();dirs[:]=sorted(d for d in dirs if d!='__pycache__')
  for name in dirs+names:need(not (Path(current)/name).is_symlink(),'IDENTITY')
  for name in sorted(names):
   p=Path(current)/name;need(p.is_file(),'IDENTITY');files.append(p)
 need(0<len(files)<=30000,'IDENTITY');digest=hashlib.sha256()
 for p in sorted(files):digest.update(canonical([str(p.relative_to(base)),filehash(p)]))
 lock=filehash(ROOT/'artifacts/privacy/onnx-requirements.lock');binary=filehash((ROOT/PYTHON).resolve(strict=True));digest.update(canonical(['requirements',lock,'python',binary]))
 return {'sourceHashes':sources,'cacheFiles':cache,'runtimeIdentity':{'algorithm':'relative-path-and-file-sha256-canonical-frames-v1','runtimeTreeSha256':digest.hexdigest(),'runtimeRegularFileCount':len(files),'pythonBinarySha256':binary,'requirementsSha256':lock,'expectedVersions':VERSIONS,'platform':sys.platform,'architecture':os.uname().machine}}

def witnesses():
 raw=read_fixed(WITNESSES,32768);need(sha(raw)==WITNESSES_SHA,'IDENTITY');packet=strict_json(raw);rows=packet['fixtures'];need(len(rows)==8,'INPUT')
 for row in rows:
  text=row['text'];u,b=coordinates(text);need(sha(text.encode())==row['utf8Sha256'] and b[-1]==row['utf8Bytes'] and u[-1]==row['javascriptUtf16Units'] and len(text)==row['pythonCodepoints'],'INPUT')
 return rows

def metadata():
 d=strict_json(read_fixed(CACHE+'/int8/tokenizer.json',12389891));config=strict_json(read_fixed(CACHE+'/int8/config.json',5688))
 expected={'type':'TemplateProcessing','single':[{'SpecialToken':{'id':'<bos>','type_id':0}},{'Sequence':{'id':'A','type_id':0}},{'SpecialToken':{'id':'<eos>','type_id':0}}],'pair':[{'SpecialToken':{'id':'<bos>','type_id':0}},{'Sequence':{'id':'A','type_id':0}},{'SpecialToken':{'id':'<eos>','type_id':0}},{'Sequence':{'id':'B','type_id':0}},{'SpecialToken':{'id':'<eos>','type_id':0}}],'special_tokens':{'<bos>':{'id':'<bos>','ids':[2],'tokens':['<bos>']},'<eos>':{'id':'<eos>','ids':[1],'tokens':['<eos>']}}}
 need(d['post_processor']==expected and d['normalizer']=={'type':'Replace','pattern':{'String':' '},'content':'▁'} and d['pre_tokenizer']=={'type':'Metaspace','replacement':'▁','prepend_scheme':'always','split':True} and d['truncation'] is None and d['padding'] is None and d['model']['byte_fallback'] is True,'POSTPROCESSOR')
 need(config['id2label']=={str(i):v for i,v in enumerate(LABELS)},'IDENTITY');return d

def encoding_dict(e):return {'ids':e.ids,'offsets':[list(x) for x in e.offsets],'specialMask':e.special_tokens_mask,'attentionMask':e.attention_mask,'typeIds':e.type_ids,'sequenceIds':e.sequence_ids,'overflowing':[1 for _ in e.overflowing],'offsetUnit':'unicode-codepoint'}
def emit(event):
 data=canonical(event)+b'\n';need(len(data)<=131072,'OUTPUT_LIMIT');sys.stdout.buffer.write(data);sys.stdout.buffer.flush()

# Loaded only by the future authorized sandboxed child, never PLAN or pure tests.
def worker(ticket):
 deadline=ticket['deadline'];check=lambda:check_deadline(deadline);check();need(sys.platform=='darwin' and os.environ.get('LEX_NYM_V1_WORKER')=='required','PLATFORM')
 # The parent validated the exact freeze; the child independently verifies immutable identities.
 need(identity(deadline,parent_source_pins=ticket['identity']['sourceHashes'])==ticket['identity'],'IDENTITY');need(Path(sys.executable).resolve()==(ROOT/PYTHON).resolve() and sys.version.split()[0]==VERSIONS['python'],'RUNTIME');rows=witnesses();metadata();check()
 import socket
 sock=socket.socket()
 try:
  try:sock.connect(('127.0.0.1',9))
  except PermissionError:pass
  except OSError:raise Failure('PLATFORM')
  else:raise Failure('PLATFORM')
 finally:sock.close()
 import tokenizers
 need(tokenizers.__version__==VERSIONS['tokenizers'],'RUNTIME')
 tokenizer=tokenizers.Tokenizer.from_file(str(ROOT/CACHE/'int8/tokenizer.json'));check()
 vocab=tokenizer.get_vocab(with_added_tokens=True);need(set(vocab.values())==set(range(198804)),'IDENTITY')
 encoded=[];structural=[]
 for i,row in enumerate(rows):
  check();emit({'event':'structural-start','index':i});e=tokenizer.encode(row['text'],add_special_tokens=True);check();item=encoding_dict(e);code=None
  try:validate_encoding(row['text'],item)
  except Failure as error:code=error.code
  # Exact decode-to-original equality is additional evidence; never normalize/search/repair.
  roundtrip=tokenizer.decode(e.ids,skip_special_tokens=True)==row['text'];check()
  slices=code is None and all(tokenizer.decode([token],skip_special_tokens=False)==row['text'][a:z] for token,(a,z),special in zip(e.ids,e.offsets,e.special_tokens_mask) if not special);check()
  structural.append(code is None and roundtrip and slices);encoded.append(item)
  emit({'event':'structural-done','index':i,'code':code,'tokenCount':len(e.ids),'roundtripExact':roundtrip,'tokenSlicesExact':slices})
 # Independent discriminating witnesses0..6 must all establish original-source agreement.
 # Intentional literal-special witness7 remains individually blocked; it cannot veto/control proof.
 proof=all(structural[:7]);emit({'event':'offset-proof','established':proof});check()
 if not proof:
  emit({'event':'complete','forwards':0,'decoded':0,'blocked':8,'code':'OFFSET_PROOF_UNESTABLISHED'});return
 import numpy as np
 import onnxruntime as ort
 need(np.__version__==VERSIONS['numpy'] and ort.__version__==VERSIONS['onnxruntime'] and sys.version.split()[0]==VERSIONS['python'],'RUNTIME');check()
 options=ort.SessionOptions();options.intra_op_num_threads=1;options.inter_op_num_threads=1;options.graph_optimization_level=ort.GraphOptimizationLevel.ORT_DISABLE_ALL;options.log_severity_level=4
 model=read_fixed(CACHE+'/int8/model_int8.onnx',138730982);need(sha(model)==PINS['modelSha256'],'IDENTITY');graph_envelope(model);check();session=ort.InferenceSession(model,sess_options=options,providers=['CPUExecutionProvider']);del model;check()
 need(session.get_providers()==['CPUExecutionProvider'],'RUNTIME')
 need([(x.name,x.type,x.shape) for x in session.get_inputs()]==[('input_ids','tensor(int64)',['batch_size','sequence_length']),('attention_mask','tensor(int64)',['batch_size','sequence_length'])] and [(x.name,x.type,x.shape) for x in session.get_outputs()]==[('logits','tensor(float)',['batch_size','sequence_length',81])],'SHAPE')
 forwards=decoded=blocked=0
 for i,(row,item,admitted) in enumerate(zip(rows,encoded,structural)):
  check()
  if not admitted:blocked+=1;continue
  emit({'event':'forward-start','index':i});forwards+=1
  try:out=session.run(['logits'],{'input_ids':np.asarray([item['ids']],dtype=np.int64),'attention_mask':np.asarray([item['attentionMask']],dtype=np.int64)})
  except Exception:raise Failure('FORWARD_FAILURE')
  check();need(type(out) is list and len(out)==1 and out[0].dtype==np.float32 and out[0].shape==(1,len(item['ids']),81),'SHAPE');emit({'event':'forward-returned','index':i})
  result=decode_native(row['text'],item,out[0].tolist());check();decoded+=int(result['status']=='native-complete');blocked+=int(result['status']=='blocked');emit({'event':'decoded','index':i,'result':result});check()
 emit({'event':'complete','forwards':forwards,'decoded':decoded,'blocked':blocked,'code':None})

def graph_envelope(raw):
 # Bounded ONNX protobuf traversal; raw tensor bytes are never interpreted as fields.
 def fields(raw):
  data=memoryview(raw);p=0;count=0
  def varint():
   nonlocal p
   value=0
   for shift in range(0,70,7):
    need(p<len(data),'SHAPE');x=data[p];p+=1;value|=(x&127)<<shift
    if not x&128:return value
   raise Failure('SHAPE')
  while p<len(data):
   count+=1;need(count<=1000000,'SHAPE');tag=varint();f,w=tag>>3,tag&7;need(f>0,'SHAPE')
   if w==0:v=varint()
   elif w in (1,2,5):
    size=varint() if w==2 else 8 if w==1 else 4;end=p+size;need(end<=len(data),'SHAPE');v=data[p:end];p=end
   else:raise Failure('SHAPE')
   yield f,w,v
 nodes=0
 def visit(raw,kind,depth):
  nonlocal nodes
  nodes+=1;need(nodes<=100000 and depth<=32,'SHAPE');graphs=0
  for f,w,v in fields(raw):
   if kind=='model':
    need(f not in (20,25),'SHAPE')
    if f==7:need(w==2,'SHAPE');graphs+=1;visit(v,'graph',depth+1)
   elif kind=='graph':
    need(f!=15,'SHAPE')
    if f in (1,5):need(w==2,'SHAPE');visit(v,'node' if f==1 else 'tensor',depth+1)
   elif kind=='node':
    if f==5:need(w==2,'SHAPE');visit(v,'attribute',depth+1)
    if f==7:need(w==2 and bytes(v) in (b'',b'ai.onnx',b'com.microsoft'),'SHAPE')
   elif kind=='attribute':
    need(f not in (22,23),'SHAPE')
    if f in (5,6,10,11):need(w==2,'SHAPE');visit(v,'tensor' if f in (5,10) else 'graph',depth+1)
   elif kind=='tensor':
    need(f!=13 and (f!=14 or w==0 and v==0),'SHAPE')
  if kind=='model':need(graphs==1,'SHAPE')
 visit(raw,'model',0)

def structurally_admitted(row):
 return (row['code'] is None and integer(row['tokenCount']) and 3<=row['tokenCount']<=512
         and row['roundtripExact'] is True and row['tokenSlicesExact'] is True)

class EventValidator:
 def __init__(self,rows):self.rows=rows;self.events=[];self.structural=[];self.pending=None;self.proof=None;self.forward=None;self.returned=False;self.results={};self.finished=False;self.forwards=0
 def accept(self,event):
  need(type(event) is dict and not self.finished,'IPC');name=event.get('event')
  if 'index' in event:need(integer(event['index']) and 0<=event['index']<8,'IPC')
  if name=='structural-start':
   need(exact(event,('event','index')) and self.pending is None and self.proof is None and event['index']==len(self.structural) and integer(event['index']) and event['index']<8,'IPC');self.pending=event['index']
  elif name=='structural-done':
   need(exact(event,('event','index','code','tokenCount','roundtripExact','tokenSlicesExact')) and self.pending is not None and event['index']==self.pending and (event['code'] is None or type(event['code']) is str and event['code'] in CODES) and integer(event['tokenCount']) and 0<=event['tokenCount']<=16386 and (event['code'] is not None or 3<=event['tokenCount']<=512) and type(event['roundtripExact']) is bool and type(event['tokenSlicesExact']) is bool,'IPC');self.structural.append(event);self.pending=None
  elif name=='offset-proof':
   need(exact(event,('event','established')) and len(self.structural)==8 and self.pending is None and self.proof is None and type(event['established']) is bool,'IPC')
   need(event['established']==all(structurally_admitted(x) for x in self.structural[:7]),'IPC');self.proof=event['established']
  elif name=='forward-start':
   need(exact(event,('event','index')) and self.proof is True and self.forward is None and integer(event['index']) and 0<=event['index']<8,'IPC');i=event['index'];expected=[j for j,x in enumerate(self.structural) if structurally_admitted(x) and j not in self.results];need(expected and i==expected[0],'IPC');need(i not in self.results and structurally_admitted(self.structural[i]),'IPC');self.forward=i;self.returned=False;self.forwards+=1;need(self.forwards<=8,'IPC')
  elif name=='forward-returned':
   need(exact(event,('event','index')) and self.forward is not None and event['index']==self.forward and not self.returned,'IPC');self.returned=True
  elif name=='decoded':
   need(exact(event,('event','index','result')) and self.forward is not None and event['index']==self.forward and self.returned,'IPC');validate_result(event['result'],self.rows[self.forward]['text'],self.structural[self.forward]['tokenCount']);self.results[self.forward]=event['result'];self.forward=None;self.returned=False
  elif name=='complete':
   need(exact(event,('event','forwards','decoded','blocked','code')) and self.proof is not None and self.forward is None and self.pending is None,'IPC')
   need(all(integer(event[k]) and 0<=event[k]<=8 for k in ('forwards','decoded','blocked')),'IPC');decoded=sum(x['status']=='native-complete' for x in self.results.values());need(event['forwards']==self.forwards and event['decoded']==decoded and event['blocked']==8-decoded,'IPC')
   if self.proof:need(event['code'] is None and len(self.results)==sum(structurally_admitted(x) for x in self.structural),'IPC')
   else:need(event['code']=='OFFSET_PROOF_UNESTABLISHED' and self.forwards==0 and not self.results,'IPC')
   self.finished=True
  elif name=='failed':
   need(exact(event,('event','code','phase','exceptionType')) and event['code'] in CODES and event['phase'] in ('WORKER','STRUCTURAL','FORWARD') and event['exceptionType'] in ('Failure','OtherException'),'IPC');self.finished=True
  else:raise Failure('IPC')
  self.events.append(json.loads(canonical(event)));return self.events[-1]

def validate_result(result,text,tokens):
 keys=('version','candidateId','diagnosticOnly','egressEligible','mappingApproved','protectionPlan','detections','offsetContractValidated','status','failure','phase','nativeSpans','validatedPrefix','scannedTokens')
 need(integer(tokens) and 3<=tokens<=512,'IPC')
 need(exact(result,keys) and integer(result['version']) and result['version']==1 and result['candidateId']==ID and result['diagnosticOnly'] is True and result['egressEligible'] is False and result['mappingApproved'] is False and result['offsetContractValidated'] is False and result['protectionPlan'] is None and result['detections']==[],'IPC')
 complete=result['status']=='native-complete';need(complete or result['status']=='blocked','IPC')
 need(result['phase'] in ('INPUT','ENCODING','LOGITS','BIO','COMPLETE'),'IPC')
 if complete:need(result['failure'] is None and result['phase']=='COMPLETE' and result['validatedPrefix']==[] and integer(result['scannedTokens']) and result['scannedTokens']==tokens,'IPC')
 else:need(result['failure'] in CODES and result['nativeSpans']==[] and result['scannedTokens'] is None,'IPC')
 spans=result['nativeSpans'] if complete else result['validatedPrefix'];need(type(spans) is list and len(spans)<=510,'IPC');u,b=coordinates(text);last=0;last_token=0
 for span in spans:
  need(exact(span,('kind','start','end','codepointStart','codepointEnd','utf8Start','utf8End','tokenStart','tokenEnd','score','provenance')),'IPC');a=span['codepointStart'];z=span['codepointEnd']
  need(integer(a) and integer(z) and 0<=a<z<=len(text) and a>=last and span['kind'] in KINDS,'IPC');last=z
  need(all(integer(span[k]) for k in ('start','end','codepointStart','codepointEnd','utf8Start','utf8End','tokenStart','tokenEnd')),'IPC')
  need(span['start']==u[a] and span['end']==u[z] and span['utf8Start']==b[a] and span['utf8End']==b[z] and integer(span['tokenStart']) and integer(span['tokenEnd']) and max(1,last_token)<=span['tokenStart']<span['tokenEnd']<=tokens-1,'IPC');last_token=span['tokenEnd']
  need(type(span['score']) in (int,float) and math.isfinite(span['score']) and .4<=span['score']<=1 and span['provenance']=={**PINS,'textSha256':sha(text.encode())},'IPC')

def admit_event(validator,event,check):
 check();candidate=copy.deepcopy(validator);accepted=candidate.accept(event);check()
 return candidate,accepted

class Rss:
 def __init__(self):
  need(sys.platform=='darwin','PLATFORM');self.lib=ctypes.CDLL('/usr/lib/libproc.dylib');self.fn=self.lib.proc_pidinfo;self.fn.argtypes=[ctypes.c_int,ctypes.c_int,ctypes.c_uint64,ctypes.c_void_p,ctypes.c_int];self.fn.restype=ctypes.c_int
 def read(self,pid):
  buf=ctypes.create_string_buffer(96);need(self.fn(pid,4,0,buf,96)==96,'RESOURCE_UNAVAILABLE');return int.from_bytes(buf.raw[8:16],sys.byteorder)

def sandbox():
 q=lambda p:json.dumps(str(ROOT/p))
 denied=['eval','docs','scripts/eval-privacy.mjs','scripts/eval-privacy-v2.mjs','scripts/run-privacy-ablation-v3.mjs','scripts/run-privacy-token-ner-v1.mjs','scripts/run-privacy-token-ner-composition-v2.mjs']
 privacy=ROOT/'artifacts/privacy'
 if privacy.is_dir():
  denied.extend(str(p.relative_to(ROOT)) for p in privacy.iterdir() if p.name not in ('models','onnx-env','onnx-requirements.lock'))
 return '(version 1)(allow default)(deny network*)(deny file-write*)(allow file-write* (literal "/dev/null"))(deny file-read* '+ ' '.join('(subpath '+q(p)+')' for p in denied)+')'

def write_exclusive(path,value):
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 try:
  data=canonical(value)+b'\n'
  while data:n=os.write(fd,data);data=data[n:]
  os.fsync(fd);os.fchmod(fd,0o400)
 finally:os.close(fd)

def run():
 started=time.monotonic();deadline=started+60;active_deadline=deadline-1;child=None;selector=None;record=None;validator=None;primary=None;phase='PREFLIGHT';last=None;samples=0;peak=0;gap=0;exit_code=None;cleanup=[];timings=[]
 receipt={'version':1,'id':ID,'status':'failed','diagnosticOnly':True,'egressEligible':False,'mappingApproved':False,'qualityEvaluated':False,'validatedPrefix':[],'failure':None,'phase':phase,'exceptionType':None,'workerExitCode':None,'cleanupObserved':False,'cleanupFailures':[],'limits':LIMITS,'resourceScope':'sampled parent plus owned worker; not hard peak or physical8GB validation','counts':{'attempted':0,'admitted':0,'forwardStarted':0,'forwardReturned':0,'decoded':0,'blocked':0}}
 def check():check_deadline(active_deadline)
 def sample(rss):
  nonlocal last,samples,peak,gap
  now=time.monotonic()
  if last is not None:gap=max(gap,(now-last)*1000);need(gap<=50,'SAMPLE_GAP')
  last=now;value=rss.read(os.getpid())
  if child is not None and child.poll() is None:
   try:value+=rss.read(child.pid)
   except Failure:
    if child.poll() is None:raise
  peak=max(peak,value);samples+=1;need(value<=1073741824,'RESOURCE')
 def snapshot():
  events=[] if validator is None else validator.events
  receipt['validatedPrefix']=list(events);receipt['eventObservedElapsedMs']=list(timings);receipt['counts']={'attempted':sum(e['event']=='structural-start' for e in events),'admitted':sum(e['event']=='structural-done' and structurally_admitted(e) for e in events),'forwardStarted':sum(e['event']=='forward-start' for e in events),'forwardReturned':sum(e['event']=='forward-returned' for e in events),'decoded':sum(e['event']=='decoded' for e in events),'blocked':sum(e['event']=='structural-done' and (e['code'] is not None or not e['roundtripExact'] or not e['tokenSlicesExact']) or e['event']=='decoded' and e['result']['status']=='blocked' for e in events)}
  if validator is not None and validator.finished and validator.proof is False:receipt['counts']['blocked']=8
  receipt.update(sampledPeakCombinedRssBytes=peak,samples=samples,maximumObservedSampleGapMs=round(gap,3),elapsedMs=round((time.monotonic()-started)*1000,3),workerExitCode=exit_code)
 try:
  raw=read_fixed(FREEZE,65536);freeze=strict_json(raw)
  need(exact(freeze,('version','id','status','rootAuthorization','independentReview','identity','limits','witnessesSha256')) and integer(freeze['version']) and freeze['version']==1 and freeze['id']==ID and freeze['status']=='frozen-reviewed' and freeze['rootAuthorization']=='one-fixed-structural-run' and freeze['independentReview']=='approved' and freeze['limits']==LIMITS and freeze['witnessesSha256']==WITNESSES_SHA,'FREEZE')
  rss=Rss();sample(rss)
  def observe():
   if last is None or (time.monotonic()-last)*1000>=20:sample(rss)
  initial=identity(active_deadline,observe);need(freeze['identity']==initial,'IDENTITY');rows=witnesses();check()
  output=ROOT/OUTPUT;current=ROOT
  for part in Path(OUTPUT).parts[:-1]:
   current=current/part;need(current.is_dir() and not current.is_symlink(),'IDENTITY')
  output.mkdir(mode=0o700);record=output
  receipt.update(freezeSha256=sha(raw),identity=initial,witnessesSha256=WITNESSES_SHA)
  write_exclusive(output/'started.json',{'version':1,'id':ID,'freezeSha256':sha(raw),'identity':initial,'witnessesSha256':WITNESSES_SHA,'diagnosticOnly':True})
  ledger=os.open(output/'ledger.jsonl',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600);validator=EventValidator(rows)
  try:
   phase='DISPATCH';sample(rss);check()
   env={'PATH':'/usr/bin:/bin','LANG':'en_US.UTF-8','PYTHONNOUSERSITE':'1','TOKENIZERS_PARALLELISM':'false','OMP_NUM_THREADS':'1','OPENBLAS_NUM_THREADS':'1','HF_HUB_OFFLINE':'1','TRANSFORMERS_OFFLINE':'1','LEX_NYM_V1_WORKER':'required'}
   child=subprocess.Popen(['/usr/bin/sandbox-exec','-p',sandbox(),str(ROOT/PYTHON),'-I','-B',str(ROOT/SCRIPT),'--worker'],cwd='/',env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,start_new_session=True)
   ticket=canonical({'deadline':active_deadline,'identity':initial})+b'\n';need(len(ticket)<=4096,'IPC');child.stdin.write(ticket);child.stdin.close();check();os.set_blocking(child.stdout.fileno(),False);selector=selectors.DefaultSelector();selector.register(child.stdout,selectors.EVENT_READ);buffer=b'';total=0
   while True:
    phase='MONITOR';check();sample(rss);alive=child.poll() is None
    ready=selector.select(.02 if alive else 0);check();sample(rss)
    if ready:
     data=os.read(child.stdout.fileno(),131073);total+=len(data);need(total<=131072,'OUTPUT_LIMIT');buffer+=data
     while b'\n' in buffer:
      check();line,buffer=buffer.split(b'\n',1);validator,event=admit_event(validator,strict_json(line),check);timings.append(round((time.monotonic()-started)*1000,3));snapshot();encoded=canonical({'value':event,'observedElapsedMs':timings[-1]})+b'\n'
      while encoded:n=os.write(ledger,encoded);encoded=encoded[n:]
      os.fsync(ledger)
      if event['event']=='failed':raise Failure(event['code'])
     if not data and not alive:break
    if not alive and not ready:break
   exit_code=child.wait(timeout=max(.001,min(1,active_deadline-time.monotonic())));need(not buffer and exit_code==0 and validator.finished and samples>0,'WORKER_EXIT');check()
   phase='POSTFLIGHT';need(read_fixed(FREEZE,65536)==raw and identity(active_deadline,observe)==initial,'IDENTITY');check();receipt['status']='complete-native-diagnostic';receipt['offsetProofEstablished']=validator.proof
  finally:
   snapshot();os.fsync(ledger);os.close(ledger)
 except BaseException as error:
  primary=error.code if isinstance(error,Failure) else 'CANCELLED' if isinstance(error,KeyboardInterrupt) else 'UNKNOWN';receipt.update(failure=primary,phase=phase,exceptionType='Failure' if isinstance(error,Failure) else 'OtherException')
 finally:
  # Retain only already validated events before any cleanup operation can fail.
  snapshot()
  if record is not None:
   try:write_exclusive(record/'before-cleanup.json',receipt)
   except Exception:cleanup.append('RECEIPT')
  if selector is not None:
   try:selector.close()
   except Exception:cleanup.append('SELECTOR')
  if child is not None:
   try:
    if child.poll() is None:os.killpg(child.pid,signal.SIGKILL)
   except ProcessLookupError:pass
   except Exception:cleanup.append('KILL')
   try:exit_code=child.wait(timeout=max(.001,min(1,deadline-time.monotonic())));receipt['cleanupObserved']=True
   except Exception:cleanup.append('WAIT')
   for pipe in (child.stdin,child.stdout):
    try:
     if pipe is not None:pipe.close()
    except Exception:cleanup.append('PIPE')
  else:receipt['cleanupObserved']=True
  if time.monotonic()>=deadline:cleanup.append('DEADLINE')
  if cleanup or not receipt['cleanupObserved']:
   receipt['status']='failed';receipt['failure']=primary or 'CLEANUP'
  receipt['cleanupFailures']=cleanup;snapshot()
  if record is not None:write_exclusive(record/'receipt.json',receipt)
 return receipt

def main():
 if sys.argv[1:] in ([],['--plan']):print(json.dumps(plan()));return 0
 if sys.argv[1:]==['--run']:
  cancelled=False
  def cancel(signum,frame):
   nonlocal cancelled
   if not cancelled:
    cancelled=True;raise Failure('CANCELLED')
  signal.signal(signal.SIGTERM,cancel)
  result=run();print(json.dumps({k:result[k] for k in ('id','status','failure','diagnosticOnly','egressEligible','counts','cleanupObserved')}));return 0 if result['status']=='complete-native-diagnostic' else 2
 if sys.argv[1:]==['--worker']:
  try:
   raw=sys.stdin.buffer.readline(32769);need(len(raw)<=32768 and raw.endswith(b'\n'),'IPC');ticket=strict_json(raw);need(exact(ticket,('deadline','identity')) and type(ticket['deadline']) in (int,float) and math.isfinite(ticket['deadline']) and 0<ticket['deadline']-time.monotonic()<=59,'IPC');worker(ticket);return 0
  except BaseException as error:
   emit({'event':'failed','code':error.code if isinstance(error,Failure) else 'UNKNOWN','phase':'WORKER','exceptionType':'Failure' if isinstance(error,Failure) else 'OtherException'});return 2
 print(json.dumps({'id':ID,'status':'blocked','failure':'FREEZE','runtimeLoaded':False,'forwards':0}));return 2
if __name__=='__main__':
 try:code=main()
 except BaseException:
  print(json.dumps({'id':ID,'status':'blocked','failure':'UNKNOWN','diagnosticOnly':True,'egressEligible':False}));code=2
 raise SystemExit(code)
