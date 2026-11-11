#!/usr/bin/env python3
"""Inactive Rampart BIO adapter. Original code; upstream weights/config CC-BY-4.0.
Attribution: National Design Studio, pinned repository in the local manifest.
No downloads, remote code, pickle, Torch, upstream policy adoption or automatic load.
Pure helpers import without third-party dependencies. Inference requires --serve
inside the OS sandbox, explicitly prepared/hash-verified local files.
"""
import hashlib
import json
import math
import os
from pathlib import Path
import resource
import signal
import socket
import sys
import threading
import time
import unicodedata

ROOT=Path(__file__).resolve().parents[1]
MANIFEST=ROOT/'resources/privacy-token-ner-trace-v1.json'
CANDIDATE='rampart-q4-token-ner-trace-v1'
KINDS=['GIVEN_NAME','SURNAME','EMAIL','PHONE','URL','TAX_ID','BANK_ACCOUNT','ROUTING_NUMBER','GOVERNMENT_ID','PASSPORT','DRIVERS_LICENSE','BUILDING_NUMBER','STREET_NAME','SECONDARY_ADDRESS','CITY','STATE','ZIP_CODE']
LABELS=['O']+[prefix+kind for kind in KINDS for prefix in ['B-','I-']]
MAPPING={'GIVEN_NAME':'person','SURNAME':'person','EMAIL':'email','PHONE':'phone','BANK_ACCOUNT':'account','BUILDING_NUMBER':'address','STREET_NAME':'address','SECONDARY_ADDRESS':'address','ZIP_CODE':'address'}
FAIL={'status':'blocked','reasonCategory':'detector_failure','detections':[]}
class UnsupportedEntity(ValueError):pass
TRACE={'code':'UNKNOWN','streamIndex':None,'streamKind':None,'entityKind':None}
def diagnostic_raise(code,error,kind=None):
    TRACE['code']=code;TRACE['entityKind']=kind
    raise error

def terminal_diagnostic(error):
    if TRACE['code']=='UNKNOWN':
        TRACE['code']={'shape_or_overflow':'SHAPE','shape':'SHAPE','logits':'SHAPE','output_shape':'SHAPE','surrogate':'INPUT','special_tokens':'OFFSET','special_offset':'OFFSET','overlap':'OFFSET','token_loss':'COVERAGE','overflow':'OVERFLOW','input':'INPUT','segment':'INPUT','size':'INPUT','output_size':'SHAPE'}.get(str(error),'UNKNOWN')
    return dict(TRACE)

def utf16_offsets(text):
    out=[0]
    for char in text:
        if 0xD800<=ord(char)<=0xDFFF:raise ValueError('surrogate')
        out.append(out[-1]+(2 if ord(char)>0xFFFF else 1))
    return out

def validated_offsets(text,offsets,special,ids):
    if not isinstance(text,str) or not text or len(offsets)!=len(special) or len(ids)!=len(offsets) or not 2<=len(ids)<=512:diagnostic_raise('OVERFLOW' if len(ids)>512 else 'SHAPE',ValueError('shape_or_overflow'))
    utf16_offsets(text)
    if ids[0]!=2 or ids[-1]!=3 or special!=[1]+[0]*(len(ids)-2)+[1]:raise ValueError('special_tokens')
    covered=[False]*len(text);result=[];last=0
    for index,((start,end),is_special,token_id) in enumerate(zip(offsets,special,ids)):
        if is_special:
            if (start,end)!=(0,0):raise ValueError('special_offset')
            result.append((0,0));continue
        if token_id in [0,1,2,3,4] or type(start)!=int or type(end)!=int or not 0<=start<end<=len(text) or start<last:diagnostic_raise('UNK' if token_id==1 else 'OFFSET',ValueError('unknown_or_offset'))
        # BERT strips combining marks internally. Include trailing marks in the
        # original boundary; never manufacture a normalized replacement string.
        while end<len(text) and unicodedata.category(text[end]).startswith('M'):end+=1
        if start<last:raise ValueError('overlap')
        last=end;result.append((start,end))
        for pos in range(start,end):covered[pos]=True
    if any(not yes and not char.isspace() for char,yes in zip(text,covered)):raise ValueError('token_loss')
    return result

def decode(text,offsets,special,ids,logits):
    offsets=validated_offsets(text,offsets,special,ids)
    if len(logits)!=len(ids):raise ValueError('shape')
    units=utf16_offsets(text);spans=[];active=None
    def flush():
        nonlocal active
        if active is not None:
            kind,start,end,score=active
            if kind not in MAPPING:diagnostic_raise('UNMAPPED',UnsupportedEntity('unmapped'),kind)
            spans.append({'start':units[start],'end':units[end],'category':MAPPING[kind],'score':score});active=None
    for (start,end),is_special,row in zip(offsets,special,logits):
        if len(row)!=35 or any(not isinstance(x,(float,int)) or not math.isfinite(x) for x in row):raise ValueError('logits')
        if is_special:flush();continue
        maximum=max(row);weights=[math.exp(x-maximum) for x in row];winner=max(range(35),key=row.__getitem__);confidence=weights[winner]/sum(weights)
        if confidence<.4:diagnostic_raise('LOW_CONFIDENCE',ValueError('uncertain'))
        label=LABELS[winner]
        if label=='O':flush();continue
        prefix,kind=label.split('-',1)
        if prefix=='B':flush();active=(kind,start,end,confidence)
        else:
            if active is None or active[0]!=kind or any(not c.isspace() for c in text[active[2]:start]):diagnostic_raise('BIO_ORPHAN' if active is None else 'BIO_INVALID',ValueError('invalid_bio'))
            active=(kind,active[1],end,min(active[3],confidence))
    flush();return spans

def rss():
    value=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return value if sys.platform=='darwin' else value*1024

def watch_memory():
    while True:
        if rss()>924*1024*1024:os._exit(3)
        time.sleep(.025)

def verify_sandbox():
    try:
        with socket.socket() as client:client.settimeout(.2);client.connect(('127.0.0.1',9))
    except PermissionError:pass
    except Exception:raise ValueError('network_not_denied')
    else:raise ValueError('network_not_denied')
    for relative in ['eval/privacy-v2/dev.jsonl','scripts/eval-privacy-v2.mjs']:
        try:
            with (ROOT/relative).open('rb') as source:source.read(1)
        except PermissionError:pass
        else:raise ValueError('corpus_not_denied')
    return {'networkDenied':True,'corpusReadDenied':True,'generalFilesystemSandbox':False}

class Runtime:
    def __init__(self):
        started=time.perf_counter();probe=verify_sandbox();raw=MANIFEST.read_bytes();m=json.loads(raw)
        expected_mapping={kind:MAPPING.get(kind) for kind in KINDS}
        if m['id']!=CANDIDATE or m['productionEnabled'] is not False or m['automaticDownload'] is not False or m['runtime']['id2label']!={str(i):label for i,label in enumerate(LABELS)} or m['runtime']['mapping']!=expected_mapping or m['runtime']['confidenceFloor']!=.4 or m['runtime']['maxTokens']!=512:raise ValueError('manifest')
        directory=ROOT/'artifacts/privacy/models/rampart-q4-token-ner-v1'
        if m['artifactDirectory']!=str(directory.relative_to(ROOT)) or directory.is_symlink():raise ValueError('path')
        expected={'README.md','LICENSE','config.json','tokenizer.json','tokenizer_config.json','onnx/model_q4.onnx'}
        if len(m['files'])!=6 or {f['path'] for f in m['files']}!=expected or sum(f['bytes'] for f in m['files'])>175*1024*1024:raise ValueError('files')
        for f in m['files']:
            p=directory/f['path']
            if not p.resolve().is_relative_to(directory.resolve()) or p.is_symlink() or p.stat().st_size!=f['bytes']:raise ValueError('file')
            h=hashlib.sha256()
            with p.open('rb') as stream:
                for chunk in iter(lambda:stream.read(1024*1024),b''):h.update(chunk)
            if h.hexdigest()!=f['sha256']:raise ValueError('hash')
        config=json.loads((directory/'config.json').read_bytes())
        if config['model_type']!='bert' or config['max_position_embeddings']!=512 or config['id2label']!=m['runtime']['id2label']:raise ValueError('config')
        import numpy as np
        import onnxruntime as ort
        from tokenizers import Tokenizer
        self.np=np;self.tokenizer=Tokenizer.from_file(str(directory/'tokenizer.json'));self.tokenizer.no_truncation();self.tokenizer.no_padding()
        opts=ort.SessionOptions();opts.intra_op_num_threads=1;opts.inter_op_num_threads=1;opts.execution_mode=ort.ExecutionMode.ORT_SEQUENTIAL;opts.log_severity_level=4
        self.session=ort.InferenceSession(str(directory/'onnx/model_q4.onnx'),opts,providers=['CPUExecutionProvider'])
        self.inputs={i.name:i.type for i in self.session.get_inputs()}
        if set(self.inputs) not in ({'input_ids','attention_mask'},{'input_ids','attention_mask','token_type_ids'}) or set(self.inputs.values())!={'tensor(int64)'} or [o.name for o in self.session.get_outputs()]!=['logits']:raise ValueError('tensor_contract')
        self.metadata={'candidateId':CANDIDATE,'manifestSha256':hashlib.sha256(raw).hexdigest(),'executionProvider':'CPUExecutionProvider','cpuThreads':1,'loadLatencyMs':(time.perf_counter()-started)*1000,'peakRssBytes':rss(),'sandboxProbe':probe,'modelSha256':next(f['sha256'] for f in m['files'] if f['path'].endswith('.onnx'))}
    def infer(self,text):
        encoded=self.tokenizer.encode(text)
        if encoded.overflowing:raise ValueError('overflow')
        validated_offsets(text,encoded.offsets,encoded.special_tokens_mask,encoded.ids)
        data={'input_ids':encoded.ids,'attention_mask':encoded.attention_mask,'token_type_ids':encoded.type_ids}
        output=self.session.run(['logits'],{k:self.np.asarray([data[k]],dtype=self.np.int64) for k in self.inputs})[0]
        if output.shape!=(1,len(encoded.ids),35) or not self.np.isfinite(output).all():raise ValueError('output_shape')
        return decode(text,encoded.offsets,encoded.special_tokens_mask,encoded.ids,output[0].tolist())
    def request(self,value):
        if not isinstance(value,dict) or set(value)!={'segments'} or not isinstance(value['segments'],list) or not 1<=len(value['segments'])<=512:raise ValueError('input')
        seen=set();total=0;detections=[]
        for stream_index,segment in enumerate(value['segments']):
            TRACE.update(streamIndex=stream_index//2,streamKind='text' if stream_index%2==0 else 'path')
            if not isinstance(segment,dict) or set(segment)!={'id','text'} or not isinstance(segment['id'],str) or not 1<=len(segment['id'])<=120 or segment['id'] in seen or not isinstance(segment['text'],str) or not segment['text']:raise ValueError('segment')
            seen.add(segment['id']);total+=utf16_offsets(segment['text'])[-1]
            if total>7000:raise ValueError('size')
            detections.extend({'segmentId':segment['id'],**span} for span in self.infer(segment['text']))
            if len(detections)>2048:raise ValueError('output_size')
        return {'status':'complete','reasonCategory':None,'detections':detections}

def main():
    if sys.argv[1:]!=['--serve'] or os.environ.get('LEX_PRIVACY_NETWORK_SANDBOX')!='required':raise ValueError('explicit_sandbox_required')
    threading.Thread(target=watch_memory,daemon=True).start();signal.signal(signal.SIGALRM,lambda *_:os._exit(4));signal.alarm(15)
    runtime=Runtime();signal.alarm(0);print(json.dumps({'ready':runtime.metadata}),flush=True)
    while True:
        line=sys.stdin.buffer.readline(32769)
        if not line:return
        if len(line)>32768 or not line.endswith(b'\n'):return
        TRACE.update(code='UNKNOWN',streamIndex=None,streamKind=None,entityKind=None)
        signal.alarm(15)
        try:
            result=runtime.request(json.loads(line.decode('utf8')));TRACE.update(code='COMPLETE',entityKind=None)
        except UnsupportedEntity as error:
            terminal_diagnostic(error);result={'status':'blocked','reasonCategory':'ambiguous_context','detections':[]}
        except Exception as error:
            terminal_diagnostic(error);result=dict(FAIL)
        result['diagnostic']=dict(TRACE)
        signal.alarm(0);result['peakRssBytes']=rss();print(json.dumps(result,allow_nan=False),flush=True)
if __name__=='__main__':
    try:main()
    except Exception:print(json.dumps(FAIL),flush=True);sys.exit(2)
