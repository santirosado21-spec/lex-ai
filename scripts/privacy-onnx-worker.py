#!/usr/bin/env python3
"""Opt-in local GLiNER ONNX adapter. No downloads, Torch, pickle or remote code.
Algorithm references (Apache-2.0): ur chade/GLiNER commit
2dc5de256b81668bbd9b3a8a8e5ce62765750551 data_processing/{tokenizer,processor,utils}.py
and decoding/decoder.py TokenDecoder. Reimplemented with tokenizers/NumPy/ORT:
regex word splitting, entity prompts, first-subtoken mask, sigmoid BIO boundaries,
minimum inside/boundary score and greedy flat span selection. Original input is
never normalized for offsets: tokenizer NFC is internal; spans use regex offsets.
The full reference license/source hashes are in artifacts/privacy/onnx-references.
"""
import hashlib
import importlib.metadata
import json
import math
import os
from pathlib import Path
import re
import resource
import signal
import socket
import sys
import threading
import time

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT/'resources/privacy-detector-candidate-v2.json'
MAX_LINE = 32768
MAX_RSS = 924 * 1024 * 1024  # reserve 100 MiB for the Node candidate supervisor
WORDS = re.compile(r'\w+(?:[-_]\w+)*|\S')
FAIL = {'status':'blocked','reasonCategory':'detector_failure','detections':[]}

def rss():
    value=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return value if sys.platform=='darwin' else value*1024

def watch_memory():
    while True:
        if rss()>MAX_RSS: os._exit(3)
        time.sleep(.025)

def sha_file(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
    return h.hexdigest()

def utf16_offsets(text):
    offsets=[0]
    for char in text:
        if 0xD800<=ord(char)<=0xDFFF:raise ValueError('unicode')
        offsets.append(offsets[-1]+(2 if ord(char)>0xFFFF else 1))
    return offsets

def split_words(text,max_words=2048):
    offsets=utf16_offsets(text); words=list(WORDS.finditer(text))
    if len(words)>max_words:raise ValueError('coverage')
    previous=0
    for word in words:
        if text[previous:word.start()].strip():raise ValueError('coverage')
        previous=word.end()
    if text[previous:].strip():raise ValueError('coverage')
    return words,offsets

def decode(logits,words,offsets,labels,threshold):
    # Actual pinned export is [1, words, labels, 3], despite misleading axis names.
    scores=[]
    for row in logits:
        scores.append([[1/(1+math.exp(-max(-700,min(700,float(v))))) for v in cell] for cell in row])
    spans=[]
    for label in range(len(labels)):
        starts=[i for i,row in enumerate(scores) if row[label][0]>threshold]
        ends=[i for i,row in enumerate(scores) if row[label][1]>threshold]
        for start in starts:
            for end in ends:
                if end<start:continue
                inside=[scores[i][label][2] for i in range(start,end+1)]
                if any(score<threshold for score in inside):continue
                score=min(scores[start][label][0],scores[end][label][1],*inside)
                spans.append((start,end,label,score))
                if len(spans)>4096:raise ValueError('candidates')
    selected=[]
    for span in sorted(spans,key=lambda item:-item[3]):
        if not any(span[0]<=old[1] and old[0]<=span[1] for old in selected):selected.append(span)
    return [{'start':offsets[words[start].start()],'end':offsets[words[end].end()], 'category':labels[label]['category'],'score':score} for start,end,label,score in sorted(selected)]

def verify_sandbox():
    # Loopback-only syscall probe: refuse startup if networking is allowed.
    try:
        with socket.socket() as client:
            client.settimeout(.2);client.connect(('127.0.0.1',9))
    except PermissionError:pass
    except Exception:raise ValueError('network_not_denied')
    else:raise ValueError('network_not_denied')
    for relative in ['eval/privacy-v2/dev.jsonl','scripts/eval-privacy-v2.mjs']:
        try:
            with (ROOT/relative).open('rb') as source:source.read(1)
        except PermissionError:pass
        else:raise ValueError('evaluation_read_not_denied')
    return {'networkDenied':True,'devCorpusReadDenied':True,'evaluatorReadDenied':True,'generalFilesystemSandbox':False}

class Runtime:
    def __init__(self):
        start=time.perf_counter();sandbox=verify_sandbox();raw=MANIFEST.read_bytes();self.manifest=json.loads(raw);self.manifest_hash=hashlib.sha256(raw).hexdigest()
        m=self.manifest
        if m['id']!='gliner-pii-small-uint8-local-v2' or m['productionEnabled'] is not False:raise ValueError('manifest')
        directory=ROOT/m['download']['artifactDirectory']
        if directory != ROOT/'artifacts/privacy/models/gliner-pii-small-uint8-v2' or directory.is_symlink():raise ValueError('path')
        for spec in m['files']:
            p=directory/spec['path']
            if not p.resolve().is_relative_to(directory.resolve()) or p.is_symlink() or p.stat().st_size!=spec['bytes'] or sha_file(p)!=spec['sha256']:raise ValueError('hash')
        config=json.loads((directory/'gliner_config.json').read_bytes())
        if config['span_mode']!='token_level' or config['words_splitter_type']!='whitespace' or config['subtoken_pooling']!='first' or config['class_token_index']!=50368 or config['max_len']!=2048 or config['max_width']!=12:raise ValueError('config')
        self.labels=m['runtime']['labels'];self.threshold=m['runtime']['threshold'];self.max_tokens=config['encoder_config']['max_position_embeddings']
        if len(self.labels)!=5 or not 0<self.threshold<1:raise ValueError('labels')
        import numpy as np
        import onnxruntime as ort
        from tokenizers import Tokenizer
        self.np=np;self.tokenizer=Tokenizer.from_file(str(directory/'tokenizer.json'))
        self.tokenizer.no_truncation();self.tokenizer.no_padding()
        if self.tokenizer.token_to_id('<<ENT>>')!=50368 or self.tokenizer.token_to_id('<<SEP>>')!=50369:raise ValueError('tokens')
        options=ort.SessionOptions();options.intra_op_num_threads=1;options.inter_op_num_threads=1;options.execution_mode=ort.ExecutionMode.ORT_SEQUENTIAL;options.log_severity_level=4
        self.session=ort.InferenceSession(str(directory/'onnx/model_quint8.onnx'),options,providers=['CPUExecutionProvider'])
        if {i.name:i.type for i in self.session.get_inputs()}!={k:'tensor(int64)' for k in ['input_ids','attention_mask','words_mask','text_lengths']}:raise ValueError('input_shape')
        if len(self.session.get_outputs())!=1 or self.session.get_outputs()[0].name!='logits':raise ValueError('output_shape')
        self.metadata={'candidateId':m['id'],'manifestSha256':self.manifest_hash,'modelRevision':m['model']['revision'],'modelSha256':next(f['sha256'] for f in m['files'] if f['path'].endswith('.onnx')),'runtimeVersions':{p:importlib.metadata.version(p) for p in ['numpy','onnxruntime','tokenizers']},'python':sys.version.split()[0],'loadLatencyMs':(time.perf_counter()-start)*1000,'peakRssBytes':rss(),'cpuThreads':1,'executionProvider':'CPUExecutionProvider','networkSandboxRequired':True,'sandboxProbe':sandbox}
    def infer(self,text):
        words,offsets=split_words(text)
        if not words:return []
        prompt=[]
        for label in self.labels:prompt.extend(['<<ENT>>',label['label']])
        prompt.append('<<SEP>>')
        encoded=self.tokenizer.encode(prompt+[w.group() for w in words],is_pretokenized=True)
        if len(encoded.ids)>self.max_tokens or encoded.overflowing:raise ValueError('truncation')
        if set(w for w in encoded.word_ids if w is not None)!=set(range(len(prompt)+len(words))):raise ValueError('token_loss')
        if encoded.ids.count(50368)!=len(self.labels) or encoded.ids.count(50369)!=1:raise ValueError('label_injection')
        mask=[];previous=None
        for wid in encoded.word_ids:
            mask.append(wid-len(prompt)+1 if wid is not None and wid>=len(prompt) and wid!=previous else 0);previous=wid
        if sorted(v for v in mask if v)!=list(range(1,len(words)+1)):raise ValueError('word_mask')
        np=self.np
        feeds={name:np.asarray([data],dtype=np.int64) for name,data in [('input_ids',encoded.ids),('attention_mask',encoded.attention_mask),('words_mask',mask),('text_lengths',[len(words)])]}
        output=self.session.run(['logits'],feeds)[0]
        if output.shape!=(1,len(words),len(self.labels),3) or not np.isfinite(output).all():raise ValueError('output')
        return decode(output[0].tolist(),words,offsets,self.labels,self.threshold)
    def request(self,value):
        if not isinstance(value,dict) or set(value)!= {'segments'} or not isinstance(value['segments'],list) or not 1<=len(value['segments'])<=512:raise ValueError('input')
        detections=[];seen=set();units=0
        for segment in value['segments']:
            if not isinstance(segment,dict) or set(segment)!= {'id','text'} or not isinstance(segment['id'],str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}',segment['id']) or segment['id'] in seen or not isinstance(segment['text'],str) or not segment['text']:raise ValueError('segment')
            seen.add(segment['id']);units+=utf16_offsets(segment['text'])[-1]
            if units>7000:raise ValueError('size')
            for span in self.infer(segment['text']):detections.append({'segmentId':segment['id'],**span})
            if len(detections)>2048:raise ValueError('output_size')
        return {'status':'complete','reasonCategory':None,'detections':detections}

def main():
    if sys.argv[1:]!=['--serve'] or os.environ.get('LEX_PRIVACY_NETWORK_SANDBOX')!='required':raise ValueError('explicit_sandbox_required')
    threading.Thread(target=watch_memory,daemon=True).start()
    signal.signal(signal.SIGALRM,lambda *_:os._exit(4));signal.alarm(15)
    runtime=Runtime();signal.alarm(0)
    print(json.dumps({'ready':runtime.metadata}),flush=True)
    while True:
        line=sys.stdin.buffer.readline(MAX_LINE+1)
        if not line:return
        if len(line)>MAX_LINE or not line.endswith(b'\n'):
            print(json.dumps(FAIL),flush=True);return
        signal.alarm(15)
        try:result=runtime.request(json.loads(line.decode('utf-8')))
        except Exception:result=dict(FAIL)
        signal.alarm(0)
        result['peakRssBytes']=rss();print(json.dumps(result,allow_nan=False),flush=True)

if __name__=='__main__':
    try:main()
    except Exception:
        print(json.dumps(FAIL),flush=True);sys.exit(2)
