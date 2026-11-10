#!/usr/bin/env python3
"""Explicit fixed Nym research cache preparation; never imports a model runtime."""
import argparse
import contextlib
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import signal
import ssl
import stat
import time
from urllib.error import HTTPError
from urllib.parse import urljoin, urlsplit
from urllib.request import HTTPSHandler, HTTPRedirectHandler, ProxyHandler, Request, build_opener

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = 'resources/privacy-nym-int8-candidate-v1.json'
MANIFEST_SHA = '0cc0bdd5af9847ba8915917c715becbe66be5adfe7395efba01673571204f297'
POLICY = 'resources/privacy-nym-research-preparation-v1.json'
FREEZE = 'docs/qa/privacy-nym-research-preparation-v1-freeze.json'
OUTPUT = 'artifacts/privacy/models/nym-int8-local-v1'
REVISION = '4348999cd3c2e20c49615e9af7c6bbb45b64cd85'
PREFIX = 'https://huggingface.co/Wismut/nym-pii-multilingual-small/resolve/'+REVISION+'/'
SMALL = {
 'README.md': (6717, '74c55f42afcad1e5c1ea9b059f37d9d48e5641e04628642a12444721c57f3d9e'),
 'int8/config.json': (5688, '3f07065571e22bb73eba28ddb1fae4509c0cf703762e3bfa7a6ab2111cf7cb88'),
 'tokenizer_config.json': (573, '02055b886266b1a475bc324da83e273fe96e4974002f9d970f26e94aa73e5885'),
 '.gitattributes': (1687, '48030a73329817519a47704c56b3e891b4227a19742a138374b9f6ccde002004'),
}
LARGE = (
 {'path':'int8/model_int8.onnx','bytes':138730982,'sha256':'139006aea2cbd8e709d322f056232570de54661f624143be4893aaa387190286'},
 {'path':'int8/tokenizer.json','bytes':12389891,'sha256':'c299144e68dfec1dc536204a7ae3712710c5c6cade9269a83f5042250d47d8de'},
)
HOSTS = ('huggingface.co','cas-bridge.xethub.hf.co','cdn-lfs.huggingface.co','cdn-lfs-us-1.hf.co')
LIMITS = {'maximumTotalBytes':175*1024*1024,'requestSeconds':60,'batchSeconds':120,
          'gapSeconds':2,'maximumHTTPRequests':6,'maximumRedirectsPerFile':2,
          'concurrency':1,'retries':0}
REVIEWED = ('scripts/prepare-privacy-nym-research.py','tests/privacy-nym-preparation.test.mjs',
            POLICY,'docs/architecture/privacy-nym-research-preparation-v1.md',MANIFEST)
DIR_FLAGS = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW

class Failure(Exception):
    """Only fixed local category codes may leave the tool."""
    def __init__(self, code): self.code = code; super().__init__(code)

def sha(data): return hashlib.sha256(data).hexdigest()
def now(): return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
def require(ok, code):
    if not ok: raise Failure(code)

def plan():
    value = {'schemaVersion':1,'id':'nym-research-preparation-v1','action':'PLAN',
      'scope':'explicit-public-research-cache-only','productionEnabled':False,
      'authorizationGranted':False,'runtimeLoaded':False,'sourceManifest':MANIFEST,
      'sourceManifestSha256':MANIFEST_SHA,'revision':REVISION,'outputDirectory':OUTPUT,
      'freezePath':FREEZE,'limits':dict(LIMITS),'redirectHosts':list(HOSTS),
      'smallFiles':[{'path':p,'bytes':s,'sha256':h} for p,(s,h) in SMALL.items()],
      'largeFiles':[{**f,'url':PREFIX+f['path']} for f in LARGE],
      'expectedPayloadBytes':151135538,'fullLicenseNotice':'missing; redistribution/product release blocked',
      'researchAuthorization':'separate root decision and independent reviewed freeze required',
      'noRetriesResumeOverwriteOrInference':True,
      'completionPostflightRequired':{'freezeExactSha256Unchanged':True,'reviewedSourceFiles':5,'publishedPayloadFiles':6,'payloadSizeSha256RegularAndReadonly':True}}
    return {**value,'planSha256':sha(json.dumps(value,sort_keys=True,separators=(',',':')).encode())}

def parts(relative):
    require(isinstance(relative,str) and relative and not relative.startswith('/') and '\\' not in relative,'PATH_REJECTED')
    result=relative.split('/')
    require(all(p and p not in ('.','..') and all(c.isalnum() or c in '.-_' for c in p) for p in result),'PATH_REJECTED')
    return result

def root_fd(root): return os.open(root, DIR_FLAGS)
def descend(fd, components, create=False):
    current=os.dup(fd)
    try:
        for part in components:
            if create:
                try: os.mkdir(part,0o700,dir_fd=current)
                except FileExistsError: pass
            nxt=os.open(part,DIR_FLAGS,dir_fd=current);os.close(current);current=nxt
        return current
    except BaseException:
        os.close(current);raise

def read_confined(fd, relative, maximum=256*1024):
    names=parts(relative);parent=descend(fd,names[:-1])
    try:
        child=os.open(names[-1],os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=parent)
        with os.fdopen(child,'rb') as stream:
            info=os.fstat(stream.fileno());require(stat.S_ISREG(info.st_mode) and info.st_size<=maximum,'SOURCE_REJECTED')
            raw=stream.read(maximum+1);require(len(raw)<=maximum and len(raw)==info.st_size,'SOURCE_REJECTED');return raw
    finally: os.close(parent)

def checked_sources(fd, freeze_relative):
    require(freeze_relative==FREEZE,'FREEZE_PATH_REJECTED')
    frozen_raw=read_confined(fd,FREEZE,65536);f=json.loads(frozen_raw)
    require(set(f)=={'schemaVersion','id','status','scope','planSha256','sourceHashes','limits','outputDirectory','independentReview','rootAuthorization'},'FREEZE_REJECTED')
    require(f['schemaVersion']==1 and f['id']=='nym-research-preparation-v1' and f['status']=='frozen-reviewed' and f['scope']=='public-research-cache-only' and f['planSha256']==plan()['planSha256'] and f['limits']==LIMITS and f['outputDirectory']==OUTPUT,'FREEZE_REJECTED')
    review=f['independentReview'];auth=f['rootAuthorization']
    require(set(review)=={'identity','reviewedAt','verdict','independentFromBuilder'} and review['verdict']=='APPROVE' and review['independentFromBuilder'] is True,'REVIEW_REQUIRED')
    require(set(auth)=={'by','authorizedAt','status','scope','missingLicenseNoticeAcknowledged'} and auth['status']=='authorized' and auth['scope']=='bounded-research-only' and auth['missingLicenseNoticeAcknowledged'] is True,'RESEARCH_AUTH_REQUIRED')
    for obj,keys in [(review,('identity','reviewedAt')),(auth,('by','authorizedAt'))]:
        for key in keys: require(isinstance(obj[key],str) and 1<=len(obj[key])<=160 and not any(ord(c)<32 for c in obj[key]),'FREEZE_REJECTED')
    require(review['identity']!=auth['by'] and set(f['sourceHashes'])==set(REVIEWED),'REVIEW_REQUIRED')
    source={p:read_confined(fd,p) for p in REVIEWED}
    require(all(isinstance(f['sourceHashes'][p],str) and sha(raw)==f['sourceHashes'][p] for p,raw in source.items()),'FROZEN_SOURCE_CHANGED')
    require(sha(source[MANIFEST])==MANIFEST_SHA,'MANIFEST_CHANGED')
    policy=json.loads(source[POLICY]);require(policy==policy_document(),'POLICY_CHANGED')
    m=json.loads(source[MANIFEST]);require(m['revision']==REVISION and m['productionEnabled'] is False and m['authorizationGranted'] is False,'MANIFEST_CHANGED')
    embedded={}
    for path,(size,digest) in SMALL.items():
        body=m['sourceBodies'][path];raw=body['text'].encode('utf-8')
        require(body['status']==200 and body['bytes']==size and body['sha256']==digest and len(raw)==size and sha(raw)==digest,'EMBEDDED_SOURCE_CHANGED')
        embedded[path]=raw
    listed={r['path']:r for r in m['files']}
    require(set(listed)==set(SMALL)|{r['path'] for r in LARGE},'MANIFEST_CHANGED')
    for row in LARGE:
        actual=listed[row['path']];require(all(actual[k]==row[k] for k in ('bytes','sha256')) and actual['url']==PREFIX+row['path'],'PAYLOAD_BINDING_CHANGED')
    require(m['license']['fullMITTextPresent'] is False and m['license']['LICENSERequestStatus']==404,'LICENSE_PROVENANCE_CHANGED')
    return {'freezeSha256':sha(frozen_raw),'sourceHashes':f['sourceHashes'],'embedded':embedded}

def policy_document():
    return {'schemaVersion':1,'id':'nym-research-preparation-v1','status':'inactive-development-tool-requires-reviewed-freeze','productionEnabled':False,'automaticDownload':False,'sourceManifest':MANIFEST,'sourceManifestSha256':MANIFEST_SHA,'revision':REVISION,'fixedOutputDirectory':OUTPUT,'fixedFreezePath':FREEZE,'planSha256':plan()['planSha256'],'limits':dict(LIMITS),'allowedRedirectHosts':list(HOSTS),'fullLicenseNoticeMissing':True,'distributionAndProductReleaseBlocked':True,'boundedResearchOnlyRootDecisionRequired':True,'runtimeLoadAllowed':False,'trainingAllowed':False,'providerEgressAllowed':False,'completionPostflightRequired':{'freezeExactSha256Unchanged':True,'reviewedSourceFiles':5,'publishedPayloadFiles':6,'payloadSizeSha256RegularAndReadonly':True}}

class Store:
    def __init__(self, fd):
        names=parts(OUTPUT);parent=descend(fd,names[:-1],create=True)
        try:
            os.mkdir(names[-1],0o700,dir_fd=parent) # Exclusive leaf, never retry/resume.
            self.fd=os.open(names[-1],DIR_FLAGS,dir_fd=parent)
        finally: os.close(parent)
        self.ledger=os.open('ledger.jsonl',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600,dir_fd=self.fd)
    def event(self,event):
        write_all(self.ledger,(json.dumps(event,sort_keys=True,separators=(',',':'))+'\n').encode());os.fsync(self.ledger)
    def parent(self,path):
        names=parts(path);return descend(self.fd,names[:-1],create=True),names[-1]
    def partial(self,path):
        parent,name=self.parent(path)
        try: child=os.open(name+'.partial',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600,dir_fd=parent)
        except BaseException: os.close(parent);raise
        return parent,name,child
    def publish(self,parent,name,child):
        os.fsync(child);os.fchmod(child,0o400)
        # link is an atomic publish-if-absent; rename/replace would overwrite.
        os.link(name+'.partial',name,src_dir_fd=parent,dst_dir_fd=parent,follow_symlinks=False)
        os.unlink(name+'.partial',dir_fd=parent);os.fsync(parent)
    def copy(self,path,data):
        parent,name,child=self.partial(path)
        try: write_all(child,data);self.publish(parent,name,child)
        finally: os.fchmod(child,0o400);os.close(child);os.close(parent)
    def close(self):
        try: os.fsync(self.ledger);os.fchmod(self.ledger,0o400)
        finally: os.close(self.ledger);os.close(self.fd)

def write_all(fd,data):
    offset=0
    while offset<len(data):
        n=os.write(fd,data[offset:]);require(n>0,'FILE_WRITE_FAILED');offset+=n

def checked_url(url, initial=False):
    require(isinstance(url,str) and len(url)<=16384 and not any(ord(c)<=32 or ord(c)==127 for c in url) and '\\' not in url,'URL_REJECTED')
    try: value=urlsplit(url);port=value.port
    except Exception: raise Failure('URL_REJECTED') from None
    require(value.scheme=='https' and value.hostname in HOSTS and port in (None,443) and value.username is None and value.password is None and not value.fragment and bool(value.path) and len(value.path)<=4096,'URL_REJECTED')
    if initial: require(url in {PREFIX+f['path'] for f in LARGE},'INITIAL_URL_REJECTED')
    return value

def safe_url(url):
    value=checked_url(url)
    return {'host':value.hostname,'path':value.path,'querySha256':sha(value.query.encode()) if value.query else None}

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs): return None

@contextlib.contextmanager
def transport(url,timeout):
    checked_url(url)
    opener=build_opener(ProxyHandler({}),NoRedirect(),HTTPSHandler(context=ssl.create_default_context()))
    request=Request(url,headers={'User-Agent':'LEX-AI-Nym-Research-Preparation/1.0','Accept':'application/octet-stream','Accept-Encoding':'identity'})
    try: response=opener.open(request,timeout=timeout)
    except HTTPError as error: response=error
    try: yield response
    finally: response.close()

@contextlib.contextmanager
def request_alarm(seconds):
    require(hasattr(signal,'setitimer') and signal.getitimer(signal.ITIMER_REAL)==(0.0,0.0),'ABSOLUTE_DEADLINE_UNAVAILABLE')
    previous=signal.getsignal(signal.SIGALRM)
    def expired(*_): raise Failure('ABSOLUTE_DEADLINE')
    signal.signal(signal.SIGALRM,expired);signal.setitimer(signal.ITIMER_REAL,seconds)
    try: yield
    finally: signal.setitimer(signal.ITIMER_REAL,0);signal.signal(signal.SIGALRM,previous)

class Batch:
    def __init__(self,store,*,request_transport=transport,clock=time.monotonic,sleep=time.sleep,alarm=request_alarm):
        self.store,self.transport,self.clock,self.sleep,self.alarm=store,request_transport,clock,sleep,alarm
        self.started=clock();self.last_start=None
        self.receipt={'schemaVersion':1,'id':'nym-research-preparation-v1','scope':'bounded-public-research-cache-only','state':'running','postflight':{'status':'not-reached'},'startedAt':now(),'requests':[],'files':[],'bodyBytesReceived':0,'embeddedBytesCopied':0,'payloadBytesPublished':0,'runtimeLoaded':False,'inferencePerformed':False,'productionEnabled':False,'fullLicenseNoticeMissing':True,'distributionAndProductReleaseBlocked':True,'automaticRetry':False,'httpCountMeaning':'Dispatched anonymous transport attempts, including transport failures; actual wire delivery remains unknown without response. Reserved requests blocked before transport are excluded.'}
    def remaining(self):
        left=LIMITS['batchSeconds']-(self.clock()-self.started);require(left>0,'BATCH_DEADLINE');return left
    def record(self,event): self.store.event(event)
    def download(self,file):
        url=PREFIX+file['path'];checked_url(url,initial=True);redirects=0
        while True:
            require(len(self.receipt['requests'])<LIMITS['maximumHTTPRequests'],'HTTP_BUDGET')
            wait=max(0,LIMITS['gapSeconds']-(self.clock()-self.last_start)) if self.last_start is not None else 0
            require(wait<self.remaining(),'BATCH_DEADLINE')
            if wait: self.sleep(wait)
            timeout=min(LIMITS['requestSeconds'],self.remaining());self.last_start=self.clock();deadline=self.last_start+timeout
            rec={'id':len(self.receipt['requests'])+1,'file':file['path'],'target':safe_url(url),'requestedAt':now(),'httpStatus':None,'bodyBytesReceived':0,'state':'reserved','dispatchStarted':False}
            self.receipt['requests'].append(rec);self.record({'event':'request-reserved',**rec})
            def check():
                self.remaining();require(self.clock()<deadline,'ABSOLUTE_DEADLINE')
            try:
                with self.alarm(timeout):
                    self.record({'event':'request-dispatch-intent','id':rec['id']})
                    rec['state']='dispatched';rec['dispatchStarted']=True
                    with self.transport(url,timeout) as response:
                        check();require(response.geturl()==url,'HIDDEN_REDIRECT')
                        require(type(response.status) is int and 100<=response.status<=599,'HTTP_STATUS');rec['httpStatus']=response.status
                        if response.status in (301,302,303,307,308):
                            headers=response.headers
                            if hasattr(headers,'get_all'): require(len(headers.get_all('Location',[]))==1,'REDIRECT_REJECTED')
                            location=headers.get('Location');require(isinstance(location,str) and len(location)<=16384,'REDIRECT_REJECTED')
                            rec['locationSha256']=sha(location.encode());target=urljoin(url,location);checked_url(target)
                            rec['redirectTarget']=safe_url(target);require(redirects<LIMITS['maximumRedirectsPerFile'],'REDIRECT_BUDGET')
                            redirects+=1;url=target;rec['state']='redirect';check();self.record({'event':'response',**rec});continue
                        require(response.status==200,'HTTP_STATUS')
                        for name in ('Content-Length','Content-Encoding'):
                            if hasattr(response.headers,'get_all'): require(len(response.headers.get_all(name,[]))<=1,'HEADERS_REJECTED')
                        require(response.headers.get('Content-Encoding','identity').lower()=='identity','CONTENT_ENCODING')
                        length=response.headers.get('Content-Length')
                        require(length is None or isinstance(length,str) and length.isdigit() and int(length)==file['bytes'],'CONTENT_LENGTH')
                        self.record({'event':'response-headers',**rec})
                        parent,name,child=self.store.partial(file['path']);total=0;hasher=hashlib.sha256()
                        try:
                            while True:
                                check();chunk=response.read1(min(65536,file['bytes']-total+1));check()
                                require(isinstance(chunk,bytes),'BODY_REJECTED')
                                if not chunk: break
                                rec['bodyBytesReceived']+=len(chunk);self.receipt['bodyBytesReceived']+=len(chunk)
                                require(total+len(chunk)<=file['bytes'] and self.receipt['bodyBytesReceived']+self.receipt['embeddedBytesCopied']<=LIMITS['maximumTotalBytes'],'BODY_LIMIT')
                                write_all(child,chunk);total+=len(chunk);hasher.update(chunk)
                            require(total==file['bytes'],'TRUNCATED_BODY');require(hasher.hexdigest()==file['sha256'],'HASH_MISMATCH');check()
                            self.store.publish(parent,name,child);self.receipt['payloadBytesPublished']+=total
                        finally: os.fchmod(child,0o400);os.close(child);os.close(parent)
                        rec['state']='verified';self.receipt['files'].append({**file,'status':'hash-verified-readonly','origin':'anonymous-fixed-payload'});self.record({'event':'file-verified',**rec});return
            except BaseException as error:
                rec['state']='failed';rec['failureCode']=error.code if isinstance(error,Failure) else ('CANCELLED' if isinstance(error,(KeyboardInterrupt,SystemExit)) else 'IO_OR_TRANSPORT_FAILURE');self.record({'event':'request-failed',**rec});raise
            finally: rec['finishedAt']=now()

def expected_payload_files():
    return ([{'path':p,'bytes':size,'sha256':digest} for p,(size,digest) in SMALL.items()]
            + [dict(f) for f in LARGE])

def verify_published_files(fd, files, check):
    """Read-only streaming postflight; production callers pass only fixed six pins."""
    verified=[]
    for expected in files:
        check();names=parts(expected['path']);parent=None;child=None
        try:
            parent=descend(fd,names[:-1])
            child=os.open(names[-1],os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=parent)
            before=os.fstat(child)
            require(stat.S_ISREG(before.st_mode) and before.st_size==expected['bytes'] and stat.S_IMODE(before.st_mode)==0o400,'POSTFLIGHT_PAYLOAD_CHANGED')
            signature=lambda value:(value.st_dev,value.st_ino,value.st_size,value.st_mtime_ns,value.st_ctime_ns,stat.S_IMODE(value.st_mode))
            total=0;hasher=hashlib.sha256()
            while True:
                check();chunk=os.read(child,min(65536,expected['bytes']-total+1));check()
                if not chunk:break
                total+=len(chunk);require(total<=expected['bytes'],'POSTFLIGHT_PAYLOAD_CHANGED');hasher.update(chunk)
            after=os.fstat(child)
            require(total==expected['bytes'] and hasher.hexdigest()==expected['sha256'] and signature(before)==signature(after),'POSTFLIGHT_PAYLOAD_CHANGED')
            # Recheck name-to-fd identity after reading; do not follow a replaced symlink.
            named=os.stat(names[-1],dir_fd=parent,follow_symlinks=False)
            require(signature(named)==signature(after) and stat.S_ISREG(named.st_mode),'POSTFLIGHT_PAYLOAD_CHANGED')
            verified.append({**expected,'readonly':True,'postflight':'exact-byte-sha256'})
        except Failure:raise
        except Exception:raise Failure('POSTFLIGHT_PAYLOAD_CHANGED') from None
        finally:
            if child is not None:os.close(child)
            if parent is not None:os.close(parent)
    return verified

def unchanged_sources(fd, initial, check):
    check()
    try:
        frozen_raw=read_confined(fd,FREEZE,65536)
        require(sha(frozen_raw)==initial['freezeSha256'],'POSTFLIGHT_FREEZE_CHANGED')
    except Failure as error:
        if error.code=='POSTFLIGHT_FREEZE_CHANGED':raise
        raise Failure('POSTFLIGHT_FREEZE_CHANGED') from None
    except Exception:raise Failure('POSTFLIGHT_FREEZE_CHANGED') from None
    try:
        current=checked_sources(fd,FREEZE)
        require(current['freezeSha256']==initial['freezeSha256'] and current['sourceHashes']==initial['sourceHashes'],'POSTFLIGHT_SOURCE_CHANGED')
    except Exception:raise Failure('POSTFLIGHT_SOURCE_CHANGED') from None
    check();return current

def postflight(fd, store_fd, initial, check):
    unchanged_sources(fd,initial,check)
    published=verify_published_files(store_fd,expected_payload_files(),check)
    # The payload reread may take time: rebind freeze/sources again after it.
    current=unchanged_sources(fd,initial,check)
    return {'status':'verified','freezeSha256':current['freezeSha256'],
            'sourceHashes':current['sourceHashes'],'publishedFiles':published}

def prepare(freeze_relative,*,root=ROOT,request_transport=transport,clock=time.monotonic,sleep=time.sleep,alarm=request_alarm):
    fd=root_fd(root)
    try:
        bindings=checked_sources(fd,freeze_relative) # No output/HTTP before freeze and every source checked.
        store=Store(fd)
    except BaseException:
        os.close(fd);raise
    batch=Batch(store,request_transport=request_transport,clock=clock,sleep=sleep,alarm=alarm)
    batch.receipt.update(freezeSha256=bindings['freezeSha256'],sourceHashes=bindings['sourceHashes'],sourceManifestSha256=MANIFEST_SHA,limits=dict(LIMITS),planSha256=plan()['planSha256'])
    try:
        batch.record({'event':'research-cache-started','sourceManifestSha256':MANIFEST_SHA,'freezeSha256':bindings['freezeSha256']})
        for path,data in bindings['embedded'].items():
            batch.remaining();store.copy(path,data);batch.receipt['payloadBytesPublished']+=len(data);batch.receipt['embeddedBytesCopied']+=len(data)
            batch.receipt['files'].append({'path':path,'bytes':len(data),'sha256':sha(data),'status':'hash-verified-readonly','origin':'reviewed-embedded-source'})
        for row in LARGE: batch.download(row);batch.remaining()
        require(batch.receipt['payloadBytesPublished']==plan()['expectedPayloadBytes'],'PACKAGE_INCOMPLETE')
        batch.record({'event':'postflight-started'})
        batch.receipt['postflight']={'status':'running'}
        batch.receipt['postflight']=postflight(fd,store.fd,bindings,batch.remaining)
        batch.record({'event':'postflight-verified','files':len(batch.receipt['postflight']['publishedFiles']),'freezeSha256':bindings['freezeSha256']})
        batch.receipt['state']='complete-research-cache-not-loaded'
    except BaseException as error:
        batch.receipt['state']='failed-retained-no-resume';batch.receipt['failureCode']=error.code if isinstance(error,Failure) else ('CANCELLED' if isinstance(error,(KeyboardInterrupt,SystemExit)) else 'IO_OR_TRANSPORT_FAILURE')
        if batch.receipt['postflight']['status']=='running':
            batch.receipt['postflight']={'status':'failed','failureCode':batch.receipt['failureCode']}
    finally:
        batch.receipt.update(finishedAt=now(),elapsedMs=round((clock()-batch.started)*1000,3),actualHTTPRequests=sum(r['dispatchStarted'] for r in batch.receipt['requests']))
        try:
            batch.record({'event':'batch-finished','state':batch.receipt['state'],'actualHTTPRequests':batch.receipt['actualHTTPRequests'],'bodyBytesReceived':batch.receipt['bodyBytesReceived'],'failureCode':batch.receipt.get('failureCode')})
            store.copy('receipt.json',(json.dumps(batch.receipt,sort_keys=True,indent=2)+'\n').encode())
        finally:
            try:store.close()
            finally:os.close(fd)
    return batch.receipt

class SafeParser(argparse.ArgumentParser):
    def error(self,message):
        print(json.dumps({'state':'blocked-before-output','failureCode':'CLI_ARGUMENT_REJECTED'}));raise SystemExit(2)

def main(argv=None):
    parser=SafeParser(description=__doc__)
    mode=parser.add_mutually_exclusive_group();mode.add_argument('--plan',action='store_true');mode.add_argument('--prepare',action='store_true')
    parser.add_argument('--freeze')
    args=parser.parse_args(argv)
    if not args.prepare:
        if args.freeze: parser.error('--freeze requires --prepare')
        print(json.dumps(plan(),sort_keys=True,indent=2));return 0
    if args.freeze!=FREEZE:
        print(json.dumps({'state':'blocked-before-output','failureCode':'FREEZE_PATH_REJECTED'}));return 2
    try:
        result=prepare(args.freeze)
        print(json.dumps({k:result[k] for k in ['state','actualHTTPRequests','bodyBytesReceived','runtimeLoaded','inferencePerformed','productionEnabled']}));return 0 if result['state']=='complete-research-cache-not-loaded' else 2
    except Exception as error:
        print(json.dumps({'state':'blocked-before-output-or-receipt-failure','failureCode':error.code if isinstance(error,Failure) else 'LOCAL_PREFLIGHT_OR_IO_FAILURE'}));return 2

if __name__=='__main__': raise SystemExit(main())
