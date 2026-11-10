#!/usr/bin/env python3
"""Fixed public build-asset preparation. No tokenizer/model/runtime imports."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import resource
import stat
import sys
import time

ID = 'nym-content-inventory-v1'
SOURCE = 'artifacts/privacy/models/nym-int8-local-v2/int8/tokenizer.json'
SOURCE_SHA = 'c299144e68dfec1dc536204a7ae3712710c5c6cade9269a83f5042250d47d8de'
SOURCE_BYTES = 12389891
REVISION = '4348999cd3c2e20c49615e9af7c6bbb45b64cd85'
OUTPUT = 'artifacts/privacy/nym-content-inventory-v1'
FREEZE = 'docs/qa/privacy-nym-content-inventory-v1-freeze.json'
POLICY = 'resources/privacy-nym-inventory-preparation-v1.json'
SOURCES = ('scripts/prepare-nym-content-inventory.py', POLICY,
           'tests/privacy-nym-inventory-preparation.test.mjs',
           'docs/architecture/privacy-nym-inventory-preparation-v1.md')
LIMITS = {'seconds': 30, 'peakRssBytes': 402653184, 'lineBytes': 4096,
          'inventoryBytes': 33554432, 'rows': 198804, 'addedEntries': 249}
FLAGS = ('single_word', 'lstrip', 'rstrip', 'normalized', 'special')

class Failure(Exception):
    pass

def require(ok, code):
    if not ok:
        raise Failure(code)

def canonical(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True,
                       separators=(',', ':'), allow_nan=False) + '\n').encode('utf8')

def unique_object(pairs):
    out = {}
    for k, v in pairs:
        require(k not in out, 'DUPLICATE_JSON_KEY')
        out[k] = v
    return out

def peak_rss():
    value = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return int(value if sys.platform == 'darwin' else value * 1024)

class Budget:
    def __init__(self, limits=LIMITS, clock=time.monotonic, rss=peak_rss):
        self.limits, self.clock, self.rss = limits, clock, rss
        self.start = clock()
        self.maximum = 0
    def check(self):
        self.maximum = max(self.maximum, self.rss())
        require(self.clock() - self.start <= self.limits['seconds'], 'DEADLINE')
        require(self.maximum <= self.limits['peakRssBytes'], 'RSS_LIMIT')
    def observation(self):
        return {'elapsedMs': round((self.clock()-self.start)*1000, 3),
                'processPeakRssBytes': self.maximum,
                'scope': 'OS process lifetime getrusage high-water, checkpointed after C parse/every loop/before publication; not instantaneous kill or sampled runtime guarantee'}

def open_dir(root, relative):
    fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        for part in relative.split('/'):
            require(part not in ('', '.', '..'), 'PATH')
            nxt = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
            os.close(fd); fd = nxt
        return fd
    except BaseException:
        os.close(fd); raise

def read_regular(root, relative, cap, budget):
    parent, leaf = relative.rsplit('/', 1)
    d = open_dir(root, parent)
    try:
        f = os.open(leaf, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=d)
        try:
            before = os.fstat(f)
            require(stat.S_ISREG(before.st_mode) and before.st_size <= cap, 'SOURCE_SIZE_TYPE')
            data = bytearray()
            while True:
                budget.check()
                b = os.read(f, min(65536, cap + 1 - len(data)))
                if not b: break
                data.extend(b); require(len(data) <= cap, 'READ_CAP')
            after = os.fstat(f)
            require((before.st_dev,before.st_ino,before.st_size,before.st_mtime_ns)==
                    (after.st_dev,after.st_ino,after.st_size,after.st_mtime_ns), 'SOURCE_DRIFT')
            return bytes(data)
        finally: os.close(f)
    finally: os.close(d)

def digest(data):
    return hashlib.sha256(data).hexdigest()

def validate_inventory(raw, budget, rows=198804, added_count=249):
    t = json.loads(raw, object_pairs_hook=unique_object,
                   parse_constant=lambda _: (_ for _ in ()).throw(Failure('NONFINITE_JSON')))
    budget.check()  # C parser is synchronous; no instantaneous interrupt claim.
    require(type(t) is dict and type(t.get('model')) is dict and t['model'].get('type')=='BPE', 'MODEL')
    model=t['model']
    require(all(type(model.get(k)) is bool for k in ('fuse_unk','byte_fallback','ignore_merges')), 'MODEL_FLAG_TYPE')
    require(model.get('dropout') is None or (type(model['dropout']) in (int,float) and 0<=model['dropout']<=1), 'MODEL_DROPOUT')
    require(all(model.get(k) is None or type(model[k]) is str for k in ('unk_token','continuing_subword_prefix','end_of_word_suffix')), 'MODEL_STRING_TYPE')
    vocab = model.get('vocab'); added = t.get('added_tokens')
    require(type(vocab) is dict and type(added) is list and len(added)==added_count, 'TABLE_TYPE_COUNT')
    by_id = {}; token_ids = {}; base_count = len(vocab)
    for token, i in vocab.items():
        budget.check()
        require(type(token) is str and token and type(i) is int and 0<=i<rows, 'BASE_TYPE_RANGE')
        require(i not in by_id, 'BASE_DUPLICATE_ID')
        by_id[i] = {'id':i,'token':token,'baseBpePresence':True,'added':None}; token_ids[token]=i
    seen_added=set()
    for a in added:
        budget.check()
        require(type(a) is dict and set(a)=={'id','content',*FLAGS}, 'ADDED_FIELDS')
        i, token = a['id'], a['content']
        require(type(i) is int and 0<=i<rows and type(token) is str and token, 'ADDED_TYPE_RANGE')
        require(all(type(a[k]) is bool for k in FLAGS), 'ADDED_FLAG_TYPE')
        require(i not in seen_added, 'ADDED_DUPLICATE_ID'); seen_added.add(i)
        require(token not in token_ids or token_ids[token]==i, 'CONTENT_ID_COLLISION')
        if i in by_id: require(by_id[i]['token']==token, 'ID_CONTENT_COLLISION')
        else: by_id[i]={'id':i,'token':token,'baseBpePresence':False,'added':None}
        token_ids[token]=i
        by_id[i]['added']={k:a[k] for k in FLAGS}
    require(len(by_id)==rows and all(i in by_id for i in range(rows)), 'UNION_NOT_CONTIGUOUS')
    budget.check()
    return by_id, {'baseBpeEntries':base_count,'addedEntries':len(added),'unionRows':len(by_id),
                   'addedOnlyRows':sum(not v['baseBpePresence'] for v in by_id.values())}

def write_all(fd, data):
    while data:
        n=os.write(fd,data); require(n>0,'WRITE_FAILED'); data=data[n:]

def publish_json(d, name, value):
    fd=os.open(name, os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o400,dir_fd=d)
    try: write_all(fd,canonical(value));os.fsync(fd)
    finally: os.close(fd)

def source_identity(root,budget):
    return {f:digest(read_regular(root,f,1048576,budget)) for f in SOURCES}

def prepare(root, freeze_path):
    budget=Budget(); d=None; primary=None; receipt={'id':ID,'status':'failed','inferencePerformed':False,'networkPerformed':False}
    try:
        require(freeze_path==FREEZE,'FREEZE_PATH')
        freeze_raw=read_regular(root,FREEZE,65536,budget)
        freeze=json.loads(freeze_raw,object_pairs_hook=unique_object)
        before=source_identity(root,budget)
        require(type(freeze) is dict and set(freeze)=={'id','status','rootAuthorization','independentReview','sourceHashes','tokenizerSha256','limits'},'FREEZE_SCHEMA')
        require(freeze['id']==ID and freeze['status']=='frozen-reviewed' and freeze['rootAuthorization']=='one-public-build-preparation' and freeze['independentReview']=='approved','FREEZE_AUTH')
        require(freeze['sourceHashes']==before and freeze['tokenizerSha256']==SOURCE_SHA and canonical(freeze['limits'])==canonical(LIMITS),'FREEZE_IDENTITY')
        parent,leaf=OUTPUT.rsplit('/',1);parentfd=open_dir(root,parent)
        try:
            os.mkdir(leaf,0o700,dir_fd=parentfd)
            d=os.open(leaf,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=parentfd)
        finally:os.close(parentfd)
        receipt.update(sourceHashes=before,freezeSha256=digest(freeze_raw),sourceTokenizerSha256=SOURCE_SHA)
        raw=read_regular(root,SOURCE,SOURCE_BYTES,budget)
        require(len(raw)==SOURCE_BYTES and digest(raw)==SOURCE_SHA,'TOKENIZER_IDENTITY')
        rows,counts=validate_inventory(raw,budget,LIMITS['rows'],LIMITS['addedEntries'])
        del raw
        fd=os.open('inventory.ndjson.partial',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o400,dir_fd=d)
        sha=hashlib.sha256();total=0
        try:
            for i in range(LIMITS['rows']):
                budget.check();line=canonical(rows[i]);require(len(line)<=LIMITS['lineBytes'],'LINE_CAP')
                total+=len(line);require(total<=LIMITS['inventoryBytes'],'OUTPUT_CAP')
                write_all(fd,line);sha.update(line)
            os.fsync(fd)
        finally:os.close(fd)
        # Posthash all inputs and exact freeze before exposing a complete artifact.
        require(read_regular(root,FREEZE,65536,budget)==freeze_raw,'FREEZE_DRIFT')
        require(source_identity(root,budget)==before,'SOURCE_DRIFT')
        raw=read_regular(root,SOURCE,SOURCE_BYTES,budget)
        require(len(raw)==SOURCE_BYTES and digest(raw)==SOURCE_SHA,'TOKENIZER_DRIFT');del raw
        budget.check()
        f=os.open('inventory.ndjson.partial',os.O_RDONLY|os.O_NOFOLLOW,dir_fd=d)
        try:
            st=os.fstat(f);require(stat.S_ISREG(st.st_mode) and stat.S_IMODE(st.st_mode)==0o400 and st.st_size==total,'OUTPUT_STATE')
            h=hashlib.sha256();n=0
            while True:
                budget.check();b=os.read(f,65536)
                if not b:break
                n+=len(b);h.update(b)
            require(n==total and h.hexdigest()==sha.hexdigest(),'OUTPUT_HASH')
        finally:os.close(f)
        header={'id':ID,'schemaVersion':1,'sourceTokenizerSha256':SOURCE_SHA,'revision':REVISION,
                'generatorSha256':before[SOURCES[0]],'protocolSha256':before[POLICY],
                'sourceHashes':before,'rowCount':LIMITS['rows'],'inventorySha256':sha.hexdigest(),
                'inventoryBytes':total,'counts':counts,'encoding':'UTF8 canonical JSON per row, sorted by raw ID'}
        budget.check()
        # link fails if final path exists; never overwrite or resume a previous leaf.
        os.link('inventory.ndjson.partial','inventory.ndjson',src_dir_fd=d,dst_dir_fd=d,follow_symlinks=False)
        os.unlink('inventory.ndjson.partial',dir_fd=d)
        publish_json(d,'header.json',header)
        budget.check()
        receipt.update(status='complete-build-asset',header=header)
    except Exception as e:
        primary=e
        receipt['failure']=str(e) if isinstance(e,Failure) else type(e).__name__ if type(e).__name__ in ('FileExistsError','FileNotFoundError','PermissionError','JSONDecodeError','UnicodeDecodeError') else 'PREPARATION_FAILURE'
    finally:
        receipt['resources']=budget.observation()
        if d is not None:
            try: publish_json(d,'receipt.json',receipt)
            finally: os.close(d)
    return 0 if primary is None else 1

def plan():
    return {'id':ID,'mode':'PLAN','source':SOURCE,'sourceSha256':SOURCE_SHA,'output':OUTPUT,
            'freeze':FREEZE,'limits':LIMITS,'executionAuthorized':False,'runtimeLimitsChanged':False}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--prepare',action='store_true');parser.add_argument('--freeze')
    args=parser.parse_args()
    if not args.prepare:
        require(args.freeze is None,'UNEXPECTED_FREEZE');print(json.dumps(plan(),sort_keys=True));return 0
    return prepare(Path(__file__).absolute().parent.parent,args.freeze)

if __name__=='__main__':
    sys.exit(main())
