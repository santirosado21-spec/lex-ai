#!/usr/bin/env python3
"""Fixed public/synthetic Nym contract inspection, never NN forwards or NER scoring."""
import argparse
import contextlib
import ctypes
from datetime import datetime, timezone
import errno
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import resource
import selectors
import signal
import socket
import stat
import subprocess
import sys
import time

ROOT=Path(__file__).resolve().parents[1]
ID='nym-contract-probe-v1'
SCRIPT='scripts/probe-privacy-nym-contract.py'
PROTOCOL='resources/privacy-nym-contract-probe-v1.json'
DOC='docs/architecture/privacy-nym-contract-probe-v1.md'
MANIFEST='resources/privacy-nym-int8-candidate-v1.json'
MANIFEST_SHA='0cc0bdd5af9847ba8915917c715becbe66be5adfe7395efba01673571204f297'
HELPER='scripts/prepare-privacy-nym-research.py'
HELPER_SHA='f7947e09e7b5087d68b9acdf12c281526d80cd99e46a84284d66781f2e69b535'
SOURCES=(SCRIPT,PROTOCOL,DOC,MANIFEST,HELPER)
CACHE='artifacts/privacy/models/nym-int8-local-v2'
CACHE_RECEIPT=CACHE+'/receipt.json'
RECEIPT_SHA='cb287aa208c76d95d4da9138e7139cdc48c5f19999d8438a7ff22eab65477a78'
ENV='artifacts/privacy/onnx-env'
PYTHON=ENV+'/bin/python'
FREEZE='docs/qa/privacy-nym-contract-probe-v1-freeze.json'
OUTPUT='artifacts/privacy/nym-contract-probe-v1'
EXPECTED_VERSIONS={'python':'3.12.13','onnxruntime':'1.31.1','tokenizers':'0.23.3','numpy':'2.5.4'}
LIMITS={'totalSeconds':60,'maximumRssBytes':1073741824,'sampleIntervalMs':20,'maximumSampleGapMs':50,'maximumWorkerStdoutBytes':32768,'maximumEvents':6,'maximumTokensPerFixture':512,'cpuThreads':1}
FIXTURES=(('spanish','Hola, esto es una prueba sintética.'),('emoji','Prueba 😀 de texto sintético.'),('nfd','Jose\u0301 escribe una nota sintética.'),('rfc-like','RFC sintético de prueba: XAXX010101000.'))
TOKENS=('<bos>','<eos>','<unk>','<pad>','<mask>','<start_of_turn>','<end_of_turn>')
DECLARED={'labelCount':81,'vocabSize':256000,'maximumPositions':8192,'tokenIds':{'bos':2,'cls':1,'eos':1,'sep':1,'pad':0,'mask':4}}
NONCE=b'LEX-NYM-CONTRACT-NETWORK-DENY-v1'
TENSOR_TYPES={'tensor(int64)','tensor(int32)','tensor(int16)','tensor(int8)','tensor(uint64)','tensor(uint32)','tensor(uint16)','tensor(uint8)','tensor(float)','tensor(float16)','tensor(double)','tensor(bool)','tensor(bfloat16)'}
class Failure(Exception):
 def __init__(self,code):self.code=code;super().__init__(code)
def require(ok,code):
 if not ok:raise Failure(code)
def sha(data):return hashlib.sha256(data).hexdigest()
def canonical(value):return json.dumps(value,sort_keys=True,separators=(',',':')).encode()
def now():return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
def exact(value,keys):require(isinstance(value,dict) and set(value)==set(keys),'IPC_SCHEMA')
def integer(v,low,high):return type(v) is int and low<=v<=high
def finite(v,high):return type(v) in (float,int) and math.isfinite(v) and 0<=v<=high

def plan():
 value={'schemaVersion':1,'id':ID,'action':'PLAN','scope':'public-fixed-synthetic-contract-inspection-only','productionEnabled':False,'authorizationGranted':False,'runtimeLoaded':False,'sessionRuns':0,'qualityEvaluated':False,'cache':CACHE,'cacheReceiptSha256':RECEIPT_SHA,'sourceManifestSha256':MANIFEST_SHA,'reviewedHelperSha256':HELPER_SHA,'freezePath':FREEZE,'outputDirectory':OUTPUT,'limits':dict(LIMITS),'expectedVersions':dict(EXPECTED_VERSIONS),'provider':'CPUExecutionProvider','graphOptimizations':'ORT_DISABLE_ALL','fixtures':[{'id':i,'text':t,'sha256':sha(t.encode())} for i,t in FIXTURES],'fullLicenseNoticeMissing':True,'redistributionAndProductReleaseBlocked':True,'physical8GBValidated':False}
 return {**value,'planSha256':sha(canonical(value))}
def protocol_document():
 return {'schemaVersion':1,'id':ID,'status':'inactive-requires-independent-review-root-freeze','productionEnabled':False,'planSha256':plan()['planSha256'],'limits':dict(LIMITS),'expectedVersions':dict(EXPECTED_VERSIONS),'sourceManifestSha256':MANIFEST_SHA,'reviewedHelperSha256':HELPER_SHA,'cacheReceiptSha256':RECEIPT_SHA,'sourcePaths':list(SOURCES),'freezePath':FREEZE,'outputDirectory':OUTPUT,'runtimeModelTokenLoadAuthorized':False,'nnForwardsAllowed':0,'externalDataAllowed':False,'customOpLibraryAllowed':False,'userTextAllowed':False,'declaredConfig':DECLARED,'fixtureHashes':{i:sha(t.encode()) for i,t in FIXTURES},'fullLicenseNoticeMissing':True,'redistributionAndProductReleaseBlocked':True,'privacyQualityAnd8GBValidated':False}

def helper():
 # Lazy, only explicit read-only handoff/probe/worker: PLAN never reads artifacts/sources.
 raw=(ROOT/HELPER).read_bytes();require(sha(raw)==HELPER_SHA,'HELPER_CHANGED')
 spec=importlib.util.spec_from_file_location('nym_public_preparation_helper',ROOT/HELPER);mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
 require(sha((ROOT/HELPER).read_bytes())==HELPER_SHA,'HELPER_CHANGED');return mod

def source_hashes(h,fd):
 result={p:sha(h.read_confined(fd,p,262144)) for p in SOURCES}
 require(result[HELPER]==HELPER_SHA and result[MANIFEST]==MANIFEST_SHA,'SOURCE_PIN_CHANGED')
 require(json.loads(h.read_confined(fd,PROTOCOL))==protocol_document(),'PROTOCOL_CHANGED');return result

def runtime_identity(check):
 base=ROOT/ENV;files=[]
 require(base.is_dir() and not base.is_symlink(),'RUNTIME_IDENTITY')
 for current,dirs,names in os.walk(base/'lib',followlinks=False):
  check();dirs[:]=sorted(d for d in dirs if d!='__pycache__')
  for d in dirs:require(not (Path(current)/d).is_symlink(),'RUNTIME_IDENTITY')
  for name in sorted(names):
   p=Path(current)/name;require(p.is_file() and not p.is_symlink(),'RUNTIME_IDENTITY');files.append(p)
 require(0<len(files)<=30000,'RUNTIME_IDENTITY');digest=hashlib.sha256()
 def filehash(p):
  acc=hashlib.sha256()
  with p.open('rb') as f:
   while True:
    check();chunk=f.read(65536)
    if not chunk:break
    acc.update(chunk)
  return acc.hexdigest()
 for p in sorted(files):digest.update(canonical([str(p.relative_to(base)),filehash(p)]))
 lock=filehash(ROOT/'artifacts/privacy/onnx-requirements.lock');binary=filehash((ROOT/PYTHON).resolve(strict=True));digest.update(canonical(['requirements',lock,'python',binary]))
 return {'algorithm':'relative-path-and-file-sha256-canonical-frames-v1','runtimeTreeSha256':digest.hexdigest(),'runtimeRegularFileCount':len(files),'pythonBinarySha256':binary,'requirementsSha256':lock,'expectedVersions':dict(EXPECTED_VERSIONS),'platform':sys.platform,'architecture':os.uname().machine}

def verify_cache(h,fd,check):
 raw=h.read_confined(fd,CACHE_RECEIPT);require(sha(raw)==RECEIPT_SHA,'CACHE_RECEIPT_CHANGED');r=json.loads(raw)
 require(r['state']=='complete-research-cache-not-loaded' and r['runtimeLoaded'] is False and r['sourceManifestSha256']==MANIFEST_SHA and r['postflight']['status']=='verified','CACHE_NOT_READY')
 cachefd=h.descend(fd,CACHE.split('/'))
 try:files=h.verify_published_files(cachefd,h.expected_payload_files(),check)
 finally:os.close(cachefd)
 return files

@contextlib.contextmanager
def total_deadline():
 require(hasattr(signal,'setitimer') and signal.getitimer(signal.ITIMER_REAL)==(0.,0.),'DEADLINE_UNAVAILABLE');old=signal.getsignal(signal.SIGALRM)
 def stop(*_):raise Failure('TOTAL_DEADLINE')
 signal.signal(signal.SIGALRM,stop);signal.setitimer(signal.ITIMER_REAL,LIMITS['totalSeconds'])
 try:yield
 finally:signal.setitimer(signal.ITIMER_REAL,0);signal.signal(signal.SIGALRM,old)

def handoff(check):
 h=helper();fd=h.root_fd(ROOT)
 try:return {'id':ID,'sourceHashes':source_hashes(h,fd),'runtimeIdentity':runtime_identity(check),'cacheFiles':verify_cache(h,fd,check),'cacheReceiptSha256':RECEIPT_SHA,'runtimeLoaded':False,'sessionRuns':0,'planSha256':plan()['planSha256']}
 finally:os.close(fd)

def checked_freeze(h,fd):
 raw=h.read_confined(fd,FREEZE,65536);f=json.loads(raw)
 require(set(f)=={'schemaVersion','id','status','scope','planSha256','sourceHashes','runtimeIdentity','cacheReceiptSha256','limits','independentReview','rootAuthorization'},'FREEZE_REJECTED')
 require(f['schemaVersion']==1 and f['id']==ID and f['status']=='frozen-reviewed' and f['scope']=='public-synthetic-contract-inspection-only' and f['planSha256']==plan()['planSha256'] and f['limits']==LIMITS and f['cacheReceiptSha256']==RECEIPT_SHA,'FREEZE_REJECTED')
 review=f['independentReview'];auth=f['rootAuthorization']
 require(set(review)=={'identity','reviewedAt','verdict','independentFromBuilder'} and review['verdict']=='APPROVE' and review['independentFromBuilder'] is True,'REVIEW_REQUIRED')
 require(set(auth)=={'by','authorizedAt','scope','status','missingLicenseNoticeAcknowledged'} and auth['scope']=='contract-inspection-only-zero-forwards' and auth['status']=='authorized' and auth['missingLicenseNoticeAcknowledged'] is True,'AUTH_REQUIRED')
 for obj,keys in ((review,('identity','reviewedAt')),(auth,('by','authorizedAt'))):
  for key in keys:require(isinstance(obj[key],str) and 1<=len(obj[key])<=160 and not any(ord(c)<32 for c in obj[key]),'FREEZE_REJECTED')
 require(review['identity']!=auth['by'],'REVIEW_REQUIRED');return f,sha(raw)

# Conservative supported ONNX envelope guard. Unknown function/training/sparse
# envelopes are unsupported, not guessed. Tensor raw_data bytes are never traversed.
def protobuf_fields(raw):
 data=memoryview(raw);p=0
 def varint():
  nonlocal p
  result=0
  for shift in range(0,70,7):
   require(p<len(data),'GRAPH_ENVELOPE');v=data[p];p+=1;result|=(v&127)<<shift
   if not v&128:return result
  raise Failure('GRAPH_ENVELOPE')
 count=0
 while p<len(data):
  count+=1;require(count<=1000000,'GRAPH_ENVELOPE');tag=varint();field,wire=tag>>3,tag&7;require(field>0,'GRAPH_ENVELOPE')
  if wire==0:value=varint()
  elif wire in (1,5):
   end=p+(8 if wire==1 else 4);require(end<=len(data),'GRAPH_ENVELOPE');value=data[p:end];p=end
  elif wire==2:
   size=varint();end=p+size;require(end<=len(data),'GRAPH_ENVELOPE');value=data[p:end];p=end
  else:raise Failure('GRAPH_ENVELOPE')
  yield field,wire,value

def guard_embedded_graph(raw):
 nodes=0
 def visit(data,kind,depth):
  nonlocal nodes
  nodes+=1;require(depth<=32 and nodes<=100000,'GRAPH_ENVELOPE')
  graph_count=0
  for field,wire,value in protobuf_fields(data):
   if kind=='model':
    require(field not in (20,25),'UNSUPPORTED_GRAPH_ENVELOPE')
    if field==7:require(wire==2,'GRAPH_ENVELOPE');graph_count+=1;visit(value,'graph',depth+1)
   elif kind=='graph':
    require(field!=15,'UNSUPPORTED_GRAPH_ENVELOPE')
    if field in (1,5):require(wire==2,'GRAPH_ENVELOPE');visit(value,'node' if field==1 else 'tensor',depth+1)
   elif kind=='node' and field==5:require(wire==2,'GRAPH_ENVELOPE');visit(value,'attribute',depth+1)
   elif kind=='attribute':
    require(field not in (22,23),'UNSUPPORTED_GRAPH_ENVELOPE')
    if field in (5,6,10,11):require(wire==2,'GRAPH_ENVELOPE');visit(value,'tensor' if field in (5,10) else 'graph',depth+1)
   elif kind=='tensor':
    require(field!=13,'EXTERNAL_DATA_UNSUPPORTED')
    if field==14:require(wire==0 and value==0,'EXTERNAL_DATA_UNSUPPORTED')
  if kind=='model':require(graph_count==1,'GRAPH_ENVELOPE')
 visit(raw,'model',0)

def tensor_nodes(nodes):
 require(isinstance(nodes,list) and 1<=len(nodes)<=4,'TENSOR_METADATA');rows=[]
 for node in nodes:
  name,typ,shape=node.name,node.type,node.shape
  require(isinstance(name,str) and re.fullmatch(r'[A-Za-z_][A-Za-z0-9_.:-]{0,127}',name) is not None and typ in TENSOR_TYPES and isinstance(shape,list) and len(shape)<=4,'TENSOR_METADATA')
  require(all(x is None or integer(x,0,1000000) or isinstance(x,str) and re.fullmatch(r'[A-Za-z_][A-Za-z0-9_:-]{0,63}',x) is not None for x in shape),'TENSOR_METADATA')
  rows.append({'name':name,'type':typ,'shape':shape})
 require(len({r['name'] for r in rows})==len(rows),'TENSOR_METADATA');return rows

def inspect_session(session):
 require(session.get_providers()==['CPUExecutionProvider'],'PROVIDER_MISMATCH')
 return {'inputs':tensor_nodes(session.get_inputs()),'outputs':tensor_nodes(session.get_outputs()),'providers':['CPUExecutionProvider'],'threads':1,'graphOptimizations':'ORT_DISABLE_ALL'}

def encoding_summary(id,text,encoding,vocab_ids,unk):
 ids=list(encoding.ids);offsets=[list(x) for x in encoding.offsets];mask=list(encoding.attention_mask);special=list(encoding.special_tokens_mask)
 require(1<=len(ids)<LIMITS['maximumTokensPerFixture'] and len(ids)==len(offsets)==len(mask)==len(special) and not encoding.overflowing,'TOKENIZER_SHAPE')
 require(all(integer(x,0,1000000) and x in vocab_ids for x in ids) and all(type(x) is int and x==1 for x in mask) and all(type(x) is int and x in (0,1) for x in special),'TOKENIZER_SHAPE')
 nbytes=len(text.encode());require(all(len(r)==2 and integer(r[0],0,nbytes) and integer(r[1],r[0],nbytes) for r in offsets),'TOKENIZER_OFFSET')
 cp=all(end<=len(text) for start,end in offsets);covered=set();previous=0;overlap=False;nonmonotonic=False;zero=0
 for (start,end),sp in zip(offsets,special):
  if sp:continue
  zero+=start==end;overlap|=start<previous;nonmonotonic|=end<previous;previous=end
  if cp:covered.update(range(start,end))
 return {'id':id,'inputSha256':sha(text.encode()),'tokenCount':len(ids),'ids':ids,'offsets':offsets,'specialMask':special,'attentionShape':[len(mask)],'attentionOnes':sum(mask),'unknownTokenCount':sum(x==unk for x in ids) if unk is not None else None,'codepointCompatible':cp,'utf8ByteCompatible':True,'coveredNonWhitespace':all(i in covered or c.isspace() for i,c in enumerate(text)) if cp else None,'overlapObserved':overlap,'nonmonotonicObserved':nonmonotonic,'zeroLengthNonSpecialCount':zero,'offsetUnitStatus':'compatibility-only-unverified-for-decoding'}

def inspect_tokenizer(tokenizer):
 tokenizer.no_truncation();tokenizer.no_padding();vocab=tokenizer.get_vocab(with_added_tokens=True)
 require(isinstance(vocab,dict) and 1<=len(vocab)<=1000000 and all(integer(i,0,1000000) for i in vocab.values()),'TOKENIZER_VOCAB')
 ids=set(vocab.values());special={t:tokenizer.token_to_id(t) for t in TOKENS};require(all(v is None or integer(v,0,1000000) and v in ids for v in special.values()),'TOKENIZER_VOCAB')
 return {'vocabWithAdded':tokenizer.get_vocab_size(with_added_tokens=True),'vocabWithoutAdded':tokenizer.get_vocab_size(with_added_tokens=False),'vocabUniqueIds':len(ids),'minimumId':min(ids),'maximumId':max(ids),'specialTokenIds':special,'fixtures':[encoding_summary(i,t,tokenizer.encode(t),ids,special['<unk>']) for i,t in FIXTURES]}

def network_denial_probe(socket_factory=socket.socket):
 try:
  with socket_factory() as client:client.settimeout(.2);client.connect(('127.0.0.1',9));client.sendall(NONCE)
 except PermissionError as error:require(error.errno==errno.EPERM,'NETWORK_DENIAL_NOT_CONFIRMED');return {'networkDeniedEPERM':True,'probeNonceSha256':sha(NONCE)}
 except Exception:raise Failure('NETWORK_DENIAL_NOT_CONFIRMED') from None
 raise Failure('NETWORK_DENIAL_NOT_CONFIRMED')

def self_rss():
 value=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss;return value if sys.platform=='darwin' else value*1024

def worker():
 # Private parent protocol, no text/path/URL/corpus parameter and no model run API.
 stage='initial';started=time.monotonic();stdout_bytes=0
 def emit(event,data):
  nonlocal stdout_bytes
  packet={'event':event,'data':data,'elapsedMs':round((time.monotonic()-started)*1000,3),'peakRssBytes':self_rss()};raw=canonical(packet)+b'\n';stdout_bytes+=len(raw);require(stdout_bytes<=LIMITS['maximumWorkerStdoutBytes'],'STDOUT_BUDGET');sys.stdout.buffer.write(raw);sys.stdout.buffer.flush()
 try:
  require(os.environ.get('LEX_NYM_CONTRACT_WORKER')=='required' and sys.platform=='darwin','WORKER_CAPABILITY')
  raw=sys.stdin.buffer.readline(8193);require(len(raw)<=8192 and raw.endswith(b'\n'),'WORKER_CAPABILITY');ticket=json.loads(raw)
  exact(ticket,('id','parentPid','sourceHashes','freezeSha256','runtimeIdentity'))
  require(ticket['id']==ID and ticket['parentPid']==os.getppid() and set(ticket['sourceHashes'])==set(SOURCES),'WORKER_CAPABILITY')
  stage='sandbox';emit('sandbox',network_denial_probe())
  h=helper();fd=h.root_fd(ROOT)
  try:
   for p in (SCRIPT,PROTOCOL,MANIFEST,HELPER):require(sha(h.read_confined(fd,p))==ticket['sourceHashes'][p],'WORKER_SOURCE_CHANGED')
   require(json.loads(h.read_confined(fd,PROTOCOL))==protocol_document(),'PROTOCOL_CHANGED')
   verify_cache(h,fd,lambda:None)
   stage='imports'
   import numpy as np
   import onnxruntime as ort
   from tokenizers import Tokenizer
   import tokenizers
   versions={'python':sys.version.split()[0],'onnxruntime':ort.__version__,'tokenizers':tokenizers.__version__,'numpy':np.__version__}
   require(versions==EXPECTED_VERSIONS,'RUNTIME_VERSION_MISMATCH');emit('versions',versions)
   binary_sha=sha(Path(sys.executable).resolve(strict=True).read_bytes());require(binary_sha==ticket['runtimeIdentity']['pythonBinarySha256'],'RUNTIME_IDENTITY')
   stage='graph';model=h.read_confined(fd,CACHE+'/int8/model_int8.onnx',138730982);require(len(model)==138730982 and sha(model)=='139006aea2cbd8e709d322f056232570de54661f624143be4893aaa387190286','MODEL_CHANGED');guard_embedded_graph(model)
   options=ort.SessionOptions();options.intra_op_num_threads=1;options.inter_op_num_threads=1;options.execution_mode=ort.ExecutionMode.ORT_SEQUENTIAL;options.graph_optimization_level=ort.GraphOptimizationLevel.ORT_DISABLE_ALL;options.log_severity_level=4
   session=ort.InferenceSession(model,sess_options=options,providers=['CPUExecutionProvider']);emit('graph',inspect_session(session));del session;del model
   stage='tokenizer';cachefd=h.descend(fd,(CACHE+'/int8').split('/'));tokfd=None
   try:
    tokfd=os.open('tokenizer.json',os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=cachefd)
    require(stat.S_ISREG(os.fstat(tokfd).st_mode),'TOKENIZER_CHANGED')
    tokenizer=Tokenizer.from_file('/dev/fd/'+str(tokfd));emit('tokenizer',inspect_tokenizer(tokenizer));del tokenizer
   finally:
    if tokfd is not None:os.close(tokfd)
    os.close(cachefd)
   stage='postflight';verify_cache(h,fd,lambda:None)
  finally:os.close(fd)
  emit('complete',{'sessionRuns':0,'nerPredictions':0,'qualityEvaluated':False});return 0
 except BaseException as error:
  try:emit('failed',{'stage':stage,'failureCode':error.code if isinstance(error,Failure) else 'WORKER_LOAD_OR_METADATA_FAILURE'})
  except BaseException:pass
  return 2

# Worker IPC has exact finite schemas; no raw model description, header or exceptions.
def validate_event(event):
 exact(event,('event','data','elapsedMs','peakRssBytes'));require(finite(event['elapsedMs'],60000) and integer(event['peakRssBytes'],0,2**48),'IPC_SCHEMA');kind=event['event'];data=event['data']
 require(kind in ('sandbox','versions','graph','tokenizer','complete','failed'),'IPC_SCHEMA')
 if kind=='sandbox':exact(data,('networkDeniedEPERM','probeNonceSha256'));require(data=={'networkDeniedEPERM':True,'probeNonceSha256':sha(NONCE)},'IPC_SCHEMA')
 elif kind=='versions':require(data==EXPECTED_VERSIONS,'IPC_SCHEMA')
 elif kind=='graph':
  exact(data,('inputs','outputs','providers','threads','graphOptimizations'));require(data['providers']==['CPUExecutionProvider'] and data['threads']==1 and data['graphOptimizations']=='ORT_DISABLE_ALL','IPC_SCHEMA')
  class Node:
   def __init__(self,row):exact(row,('name','type','shape'));self.name=row['name'];self.type=row['type'];self.shape=row['shape']
  require(tensor_nodes([Node(r) for r in data['inputs']])==data['inputs'] and tensor_nodes([Node(r) for r in data['outputs']])==data['outputs'],'IPC_SCHEMA')
 elif kind=='tokenizer':
  exact(data,('vocabWithAdded','vocabWithoutAdded','vocabUniqueIds','minimumId','maximumId','specialTokenIds','fixtures'))
  require(all(integer(data[k],0,1000000) for k in ('vocabWithAdded','vocabWithoutAdded','vocabUniqueIds','minimumId','maximumId')) and data['minimumId']<=data['maximumId'] and data['vocabUniqueIds']>0,'IPC_SCHEMA');exact(data['specialTokenIds'],TOKENS);require(all(x is None or integer(x,0,1000000) for x in data['specialTokenIds'].values()),'IPC_SCHEMA');require(isinstance(data['fixtures'],list) and len(data['fixtures'])==4,'IPC_SCHEMA')
  for row,(id,text) in zip(data['fixtures'],FIXTURES):
   exact(row,('id','inputSha256','tokenCount','ids','offsets','specialMask','attentionShape','attentionOnes','unknownTokenCount','codepointCompatible','utf8ByteCompatible','coveredNonWhitespace','overlapObserved','nonmonotonicObserved','zeroLengthNonSpecialCount','offsetUnitStatus'))
   class Encoding:pass
   e=Encoding();e.ids=row['ids'];e.offsets=row['offsets'];e.special_tokens_mask=row['specialMask'];e.attention_mask=[1]*len(e.ids);e.overflowing=[]
   require(encoding_summary(id,text,e,set(e.ids),data['specialTokenIds']['<unk>'])==row,'IPC_SCHEMA')
 elif kind=='complete':require(data=={'sessionRuns':0,'nerPredictions':0,'qualityEvaluated':False},'IPC_SCHEMA')
 else:
  exact(data,('stage','failureCode'));require(data['stage'] in ('initial','sandbox','imports','graph','tokenizer','postflight') and isinstance(data['failureCode'],str) and re.fullmatch('[A-Z_]{1,64}',data['failureCode']) is not None,'IPC_SCHEMA')
 return event

class Recorder:
 def __init__(self,h,rootfd):
  parent=h.descend(rootfd,OUTPUT.split('/')[:-1],create=True)
  try:os.mkdir(OUTPUT.split('/')[-1],0o700,dir_fd=parent);self.fd=os.open(OUTPUT.split('/')[-1],h.DIR_FLAGS,dir_fd=parent)
  finally:os.close(parent)
  self.ledger=os.open('ledger.jsonl',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600,dir_fd=self.fd)
 def event(self,value):
  raw=canonical(value)+b'\n';n=0
  while n<len(raw):n+=os.write(self.ledger,raw[n:])
  os.fsync(self.ledger)
 def finish(self,receipt):
  fd=os.open('receipt.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600,dir_fd=self.fd)
  try:
   raw=canonical(receipt)+b'\n';n=0
   while n<len(raw):n+=os.write(fd,raw[n:])
   os.fsync(fd);os.fchmod(fd,0o400)
  finally:os.close(fd)
 def close(self):os.fsync(self.ledger);os.fchmod(self.ledger,0o400);os.close(self.ledger);os.close(self.fd)

def sandbox_profile():
 q=lambda p:json.dumps(str(ROOT/p))
 return '(version 1)(allow default)(deny network*)(deny file-write*)(allow file-write* (literal "/dev/null"))(deny file-read* (subpath '+q(Path('eval'))+') (subpath '+q(Path('docs'))+'))'

class RssSampler:
 def __init__(self):
  require(sys.platform=='darwin','PLATFORM_UNSUPPORTED');self.lib=ctypes.CDLL('/usr/lib/libproc.dylib');self.fn=self.lib.proc_pidinfo;self.fn.argtypes=[ctypes.c_int,ctypes.c_int,ctypes.c_uint64,ctypes.c_void_p,ctypes.c_int];self.fn.restype=ctypes.c_int
 def sample(self,pid):
  buf=ctypes.create_string_buffer(96);n=self.fn(pid,4,0,buf,96);require(n==96,'RSS_UNAVAILABLE');return int.from_bytes(buf.raw[8:16],sys.byteorder)

def observe_worker(ticket,record,check):
 sampler=RssSampler();profile=sandbox_profile();env={'PATH':'/usr/bin:/bin','LANG':'en_US.UTF-8','PYTHONNOUSERSITE':'1','TOKENIZERS_PARALLELISM':'false','OMP_NUM_THREADS':'1','OPENBLAS_NUM_THREADS':'1','HF_HUB_OFFLINE':'1','TRANSFORMERS_OFFLINE':'1','LEX_NYM_CONTRACT_WORKER':'required'}
 child=None;events=[];raw_buffer=b'';total=0;peak=0;samples=0;max_gap=0;last=None;complete=False
 telemetry={'sampledPeakCombinedRssBytes':0,'samples':0,'maximumObservedSampleGapMs':0,'workerReportedPeakRssBytes':None,'resourceScope':'sampled partial RSS plus worker-reported peak when available; not physical8GB validation'}
 try:
  child=subprocess.Popen(['/usr/bin/sandbox-exec','-p',profile,str(ROOT/PYTHON),'-I','-B',str(ROOT/SCRIPT),'--worker'],cwd='/',env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,start_new_session=True)
  record.event({'event':'worker-dispatch','network':'sandbox-required','sessionRunsAllowed':0});ticket={**ticket,'parentPid':os.getpid()};child.stdin.write(canonical(ticket)+b'\n');child.stdin.close();os.set_blocking(child.stdout.fileno(),False)
  sel=selectors.DefaultSelector();sel.register(child.stdout,selectors.EVENT_READ)
  try:
   while True:
    check();alive=child.poll() is None
    if alive:
     sampled=time.monotonic()
     if last is not None:max_gap=max(max_gap,(sampled-last)*1000);require(max_gap<=LIMITS['maximumSampleGapMs'],'RSS_MONITOR_DELAY')
     last=sampled
     try:current=sampler.sample(child.pid)
     except Failure:
      if child.poll() is None:raise
      current=None
     if current is not None:peak=max(peak,current+self_rss());samples+=1;telemetry.update(sampledPeakCombinedRssBytes=peak,samples=samples,maximumObservedSampleGapMs=round(max_gap,3));require(peak<=LIMITS['maximumRssBytes'],'RSS_LIMIT')
    ready=sel.select(LIMITS['sampleIntervalMs']/1000 if alive else 0)
    if ready:
     chunk=os.read(child.stdout.fileno(),32769);total+=len(chunk);require(total<=LIMITS['maximumWorkerStdoutBytes'],'STDOUT_BUDGET');raw_buffer+=chunk
     while b'\n' in raw_buffer:
      line,raw_buffer=raw_buffer.split(b'\n',1);event=validate_event(json.loads(line));events.append(event);require(len(events)<=LIMITS['maximumEvents'],'IPC_SCHEMA');telemetry['workerReportedPeakRssBytes']=max(telemetry['workerReportedPeakRssBytes'] or 0,event['peakRssBytes']);require(event['peakRssBytes']+self_rss()<=LIMITS['maximumRssBytes'],'RSS_LIMIT');record.event({'event':'worker-event','value':event})
      expected=('sandbox','versions','graph','tokenizer','complete')
      if event['event']=='failed':raise Failure('WORKER_REPORTED_FAILURE')
      require(len(events)<=len(expected) and event['event']==expected[len(events)-1],'IPC_ORDER');complete=event['event']=='complete'
     if not chunk and not alive:break
    if not alive and not ready:break
   require(not raw_buffer and child.wait(timeout=1)==0 and complete and samples>0,'WORKER_INCOMPLETE');return events,telemetry
  finally:sel.close()
 finally:
  if child is not None:
   if child.poll() is None:
    try:os.killpg(child.pid,signal.SIGKILL)
    except ProcessLookupError:pass
   try:child.wait(timeout=2)
   finally:
    if child.stdout:child.stdout.close()
    if child.stdin and not child.stdin.closed:child.stdin.close()
  # Keep any valid prefix and partial RSS on finite failure.
  observe_worker.partial={'workerEvents':events,'resourceObservations':telemetry}

observe_worker.partial={}
def comparisons(events):
 graph=next(e['data'] for e in events if e['event']=='graph');tok=next(e['data'] for e in events if e['event']=='tokenizer');special=tok['specialTokenIds'];actual={'bos':special['<bos>'],'cls':special['<bos>'],'eos':special['<eos>'],'sep':special['<eos>'],'pad':special['<pad>'],'mask':special['<mask>']}
 return {'declaredConfig':DECLARED,'tokenizerBosSymbolId':special['<bos>'],'tokenizerClsUsesBosSymbolPerDescriptor':True,'specialIdComparisons':{k:{'declared':v,'observedSymbolId':actual[k],'matches':actual[k]==v if actual[k] is not None else None} for k,v in DECLARED['tokenIds'].items()},'vocabWithAddedMatchesDeclared':tok['vocabWithAdded']==DECLARED['vocabSize'],'outputClassDimensions':[{'output':r['name'],'lastDimension':r['shape'][-1] if r['shape'] else None,'matches81':r['shape'][-1]==81 if r['shape'] and type(r['shape'][-1]) is int else None} for r in graph['outputs']],'notes':'Observations and descriptor-symbol comparisons only. No inferred repair/remapping/ID validity, quantization equivalence, NER accuracy or global offset guarantee.'}

def probe():
 started=time.monotonic()
 def check():require(time.monotonic()-started<LIMITS['totalSeconds'],'TOTAL_DEADLINE')
 h=helper();fd=h.root_fd(ROOT);record=None;receipt={'schemaVersion':1,'id':ID,'state':'preflight','startedAt':now(),'sessionRuns':0,'qualityEvaluated':False,'productionEnabled':False,'fullLicenseNoticeMissing':True,'redistributionAndProductReleaseBlocked':True,'physical8GBValidated':False,'workerEvents':[]}
 try:
  f,fsha=checked_freeze(h,fd);receipt.update(freezeSha256=fsha,sourceHashes=source_hashes(h,fd));require(receipt['sourceHashes']==f['sourceHashes'],'SOURCE_CHANGED');identity=runtime_identity(check);require(identity==f['runtimeIdentity'],'RUNTIME_IDENTITY');cache=verify_cache(h,fd,check);check();record=Recorder(h,fd);receipt.update(state='running',runtimeIdentity=identity,cacheReceiptSha256=RECEIPT_SHA,cacheFiles=cache,limits=dict(LIMITS));record.event({'event':'probe-started','freezeSha256':fsha,'planSha256':plan()['planSha256']})
  try:
   events,observations=observe_worker({'id':ID,'sourceHashes':f['sourceHashes'],'freezeSha256':fsha,'runtimeIdentity':identity},record,check);receipt.update(workerEvents=events,resourceObservations=observations,observedComparisons=comparisons(events))
   require(sha(h.read_confined(fd,FREEZE))==fsha and source_hashes(h,fd)==f['sourceHashes'],'POSTFLIGHT_SOURCE_CHANGED');verify_cache(h,fd,check);require(runtime_identity(check)==identity,'POSTFLIGHT_RUNTIME_CHANGED');check();receipt['state']='complete-contract-observed-zero-forwards'
  except BaseException as error:
   receipt.update(observe_worker.partial);receipt['state']='failed-retained-no-retry';receipt['failureCode']=error.code if isinstance(error,Failure) else 'PARENT_OR_IPC_FAILURE'
  finally:
   receipt.update(finishedAt=now(),elapsedMs=round((time.monotonic()-started)*1000,3));record.event({'event':'probe-finished','state':receipt['state'],'failureCode':receipt.get('failureCode')});record.finish(receipt)
  return receipt
 finally:
  if record is not None:record.close()
  os.close(fd)

class Parser(argparse.ArgumentParser):
 def error(self,message):print(json.dumps({'state':'blocked','failureCode':'CLI_ARGUMENT_REJECTED'}));raise SystemExit(2)
def main(argv=None):
 parser=Parser(description=__doc__);group=parser.add_mutually_exclusive_group();group.add_argument('--plan',action='store_true');group.add_argument('--handoff',action='store_true');group.add_argument('--probe',action='store_true');group.add_argument('--self-test',action='store_true');group.add_argument('--worker',action='store_true',help=argparse.SUPPRESS);parser.add_argument('--freeze');args=parser.parse_args(argv)
 try:
  if args.worker:require(args.freeze is None,'CLI_ARGUMENT_REJECTED');return worker()
  if args.self_test:require(args.freeze is None,'CLI_ARGUMENT_REJECTED');return self_tests()
  if args.probe:
   require(args.freeze==FREEZE,'FREEZE_PATH_REJECTED')
   with total_deadline():result=probe()
   print(json.dumps({'state':result['state'],'sessionRuns':0,'qualityEvaluated':False,'productionEnabled':False}));return 0 if result['state']=='complete-contract-observed-zero-forwards' else 2
  require(args.freeze is None,'CLI_ARGUMENT_REJECTED')
  if args.handoff:
   start=time.monotonic()
   with total_deadline():result=handoff(lambda:require(time.monotonic()-start<60,'TOTAL_DEADLINE'))
   print(json.dumps(result,sort_keys=True));return 0
  print(json.dumps(plan(),sort_keys=True,indent=2));return 0
 except BaseException as error:
  print(json.dumps({'state':'blocked','failureCode':error.code if isinstance(error,Failure) else 'LOCAL_PREFLIGHT_OR_RUNTIME_FAILURE','sessionRuns':0}));return 2

# Tests are fixed synthetic structures only: no helper/artifacts/runtime imports or sockets.
def self_tests():
 import unittest
 from unittest import mock
 class Tests(unittest.TestCase):
  def test_plan_pure(self):
   with mock.patch.object(Path,'read_bytes',side_effect=AssertionError()),mock.patch.object(os,'open',side_effect=AssertionError()),mock.patch.object(socket,'socket',side_effect=AssertionError()):self.assertEqual(plan()['sessionRuns'],0)
  def test_tensor_guards(self):
   class Node:name='input_ids';type='tensor(int64)';shape=['batch','sequence']
   self.assertEqual(tensor_nodes([Node()])[0]['shape'],['batch','sequence']);Node.name='/private/secret'
   with self.assertRaises(Failure):tensor_nodes([Node()])
  def test_session_never_forward(self):
   class Node:name='logits';type='tensor(float)';shape=[1,'sequence',81]
   class Fake:
    def get_providers(self):return ['CPUExecutionProvider']
    def get_inputs(self):return [Node()]
    def get_outputs(self):return [Node()]
    def run(self,*_):raise AssertionError('forbidden')
   self.assertEqual(inspect_session(Fake())['outputs'][0]['shape'][-1],81)
  def test_encoding_bounds_and_overflow(self):
   class E:ids=[2,3];offsets=[(0,0),(0,1)];attention_mask=[1,1];special_tokens_mask=[1,0];overflowing=[]
   self.assertTrue(encoding_summary('synthetic','😀',E(),{2,3},None)['codepointCompatible']);E.offsets=[(0,0),(0,9)]
   with self.assertRaises(Failure):encoding_summary('synthetic','😀',E(),{2,3},None)
  def test_encoding_shape(self):
   class E:ids=[1]*512;offsets=[];attention_mask=[];special_tokens_mask=[];overflowing=[]
   with self.assertRaises(Failure):encoding_summary('synthetic','a',E(),{1},1)
  def test_network_probe_requires_eperm_no_socket(self):
   class Fake:
    def __enter__(self):return self
    def __exit__(self,*_):pass
    def settimeout(self,*_):pass
    def connect(self,*_):raise PermissionError(errno.EPERM,'synthetic')
   self.assertTrue(network_denial_probe(Fake)['networkDeniedEPERM'])
  def test_external_tensor_rejected(self):
   # Model.graph(7) -> Graph.initializer(5) -> Tensor.data_location(14)=EXTERNAL(1).
   with self.assertRaisesRegex(Failure,'EXTERNAL_DATA_UNSUPPORTED'):guard_embedded_graph(bytes([0x3a,4,0x2a,2,0x70,1]))
  def test_embedded_graph_and_invalid_envelope(self):
   guard_embedded_graph(bytes([0x3a,0]))
   with self.assertRaises(Failure):guard_embedded_graph(bytes([0x3a,9,1]))
  def test_ipc_rejects_unknown_fields(self):
   event={'event':'complete','data':{'sessionRuns':0,'nerPredictions':0,'qualityEvaluated':False},'elapsedMs':1,'peakRssBytes':1};validate_event(event);event['rawPrivatePath']='not permitted'
   with self.assertRaises(Failure):validate_event(event)
 result=unittest.TextTestRunner(stream=sys.stderr,verbosity=1).run(unittest.defaultTestLoader.loadTestsFromTestCase(Tests));return 0 if result.wasSuccessful() else 2

if __name__=='__main__':raise SystemExit(main())
