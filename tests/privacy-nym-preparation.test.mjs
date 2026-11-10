import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const suite = String.raw`
import contextlib, importlib.util, io, json, os, pathlib, shutil, stat, tempfile, time, unittest
from unittest import mock
spec=importlib.util.spec_from_file_location('nym_prep','scripts/prepare-privacy-nym-research.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
REAL=pathlib.Path.cwd()
class Clock:
 def __init__(self):self.t=0.
 def __call__(self):return self.t
 def sleep(self,s):self.t+=s
class Headers(dict):
 def get_all(self,k,default=None):return [self[k]] if k in self else (default or [])
class Response:
 def __init__(self,status=200,data=b'abc',headers=None,advance=None,dribble=0):
  self.status=status;self.data=data;self.headers=Headers(headers or {});self.advance=advance;self.dribble=dribble;self.url=None
 def geturl(self):return self.url
 def read1(self,n):
  if self.advance:self.advance.t+=self.dribble
  result=self.data[:n];self.data=self.data[n:];return result
class Network:
 def __init__(self,responses):self.responses=list(responses);self.calls=[]
 @contextlib.contextmanager
 def __call__(self,url,timeout):
  self.calls.append((url,timeout));r=self.responses.pop(0)
  if isinstance(r,BaseException):raise r
  r.url=url;yield r
TINY={'path':'int8/model_int8.onnx','bytes':3,'sha256':m.sha(b'abc')}
class StoreTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=pathlib.Path(self.tmp.name);self.fd=m.root_fd(self.root);self.store=m.Store(self.fd);self.clock=Clock()
 def tearDown(self):self.store.close();os.close(self.fd);self.tmp.cleanup()
 def batch(self,responses):
  net=Network(responses);return m.Batch(self.store,request_transport=net,clock=self.clock,sleep=self.clock.sleep,alarm=lambda _:contextlib.nullcontext()),net
 def output(self,path):return self.root/m.OUTPUT/path
 def test_exact_success_readonly_and_ledger(self):
  b,n=self.batch([Response(headers={'Content-Length':'3'})]);b.download(TINY)
  self.assertEqual(self.output(TINY['path']).read_bytes(),b'abc');self.assertEqual(stat.S_IMODE(self.output(TINY['path']).stat().st_mode),0o400)
  self.assertEqual(len(n.calls),1);self.assertEqual(b.receipt['bodyBytesReceived'],3);self.assertEqual(b.receipt['files'][0]['sha256'],TINY['sha256'])
 def test_hash_mismatch_retains_readonly_partial(self):
  b,n=self.batch([Response(data=b'xyz')])
  with self.assertRaisesRegex(m.Failure,'HASH_MISMATCH'):b.download(TINY)
  self.assertFalse(self.output(TINY['path']).exists());self.assertEqual(self.output(TINY['path']+'.partial').read_bytes(),b'xyz');self.assertEqual(stat.S_IMODE(self.output(TINY['path']+'.partial').stat().st_mode),0o400)
 def test_truncated(self):
  b,n=self.batch([Response(data=b'ab')])
  with self.assertRaisesRegex(m.Failure,'TRUNCATED_BODY'):b.download(TINY)
  self.assertEqual(len(n.calls),1)
 def test_oversize_before_write(self):
  b,n=self.batch([Response(data=b'abcd')])
  with self.assertRaisesRegex(m.Failure,'BODY_LIMIT'):b.download(TINY)
  self.assertEqual(self.output(TINY['path']+'.partial').read_bytes(),b'');self.assertEqual(b.receipt['bodyBytesReceived'],4)
 def test_wrong_content_length_no_partial(self):
  b,n=self.batch([Response(headers={'Content-Length':'4'})])
  with self.assertRaisesRegex(m.Failure,'CONTENT_LENGTH'):b.download(TINY)
  self.assertFalse(self.output(TINY['path']+'.partial').exists())
 def test_aggregate_cap(self):
  b,n=self.batch([Response()]);b.receipt['embeddedBytesCopied']=m.LIMITS['maximumTotalBytes']-2
  with self.assertRaisesRegex(m.Failure,'BODY_LIMIT'):b.download(TINY)
  self.assertEqual(self.output(TINY['path']+'.partial').read_bytes(),b'')
 def test_allowed_signed_redirect_redacted_and_gap(self):
  target='https://cas-bridge.xethub.hf.co/xet/model?Signature=PRIVATE-SIGNED-VALUE'
  b,n=self.batch([Response(status=302,headers={'Location':target}),Response()]);b.download(TINY)
  self.assertEqual(len(n.calls),2);self.assertEqual(self.clock.t,2);text=json.dumps(b.receipt)+self.output('ledger.jsonl').read_text();self.assertNotIn('PRIVATE-SIGNED-VALUE',text);self.assertNotIn('?Signature',text);self.assertIn(m.sha('Signature=PRIVATE-SIGNED-VALUE'.encode()),text)
 def test_new_exact_hf_cdn_host_accepted(self):
  target='https://us.aws.cdn.hf.co/xet-bridge-us/public/payload?Signature=NEW-PRIVATE-SIGNED'
  b,n=self.batch([Response(status=302,headers={'Location':target}),Response()]);b.download(TINY)
  self.assertEqual(len(n.calls),2);self.assertEqual(self.output(TINY['path']).read_bytes(),b'abc')
  self.assertEqual(b.receipt['requests'][0]['redirectSummary']['hostname'],'us.aws.cdn.hf.co');self.assertNotIn('NEW-PRIVATE-SIGNED',json.dumps(b.receipt))
 def test_new_host_lookalike_rejected_with_summary(self):
  b,n=self.batch([Response(status=302,headers={'Location':'https://us.aws.cdn.hf.co.evil.example/p?sig=PRIVATE-LOOKALIKE'})])
  with self.assertRaisesRegex(m.Failure,'URL_REJECTED'):b.download(TINY)
  self.assertEqual(len(n.calls),1);self.assertEqual(b.receipt['requests'][0]['redirectSummary']['hostname'],'us.aws.cdn.hf.co.evil.example');self.assertNotIn('PRIVATE-LOOKALIKE',json.dumps(b.receipt))
 def test_new_host_downgrade_and_wrong_port_rejected(self):
  for url in ['http://us.aws.cdn.hf.co/file','https://us.aws.cdn.hf.co:444/file']:
   b,n=self.batch([Response(status=302,headers={'Location':url})])
   with self.subTest(url=url),self.assertRaisesRegex(m.Failure,'URL_REJECTED'):b.download(TINY)
   self.assertEqual(len(n.calls),1);self.assertIn('redirectSummary',b.receipt['requests'][0])
 def test_rejected_target_summary_never_reflects_secrets(self):
  url='https://USERNAME-PRIVATE:PASSWORD-PRIVATE@us.aws.cdn.hf.co.evil.example:444/x?Signature=SIGNED-PRIVATE#FRAGMENT-PRIVATE'
  b,n=self.batch([Response(status=302,headers={'Location':url})])
  with self.assertRaisesRegex(m.Failure,'URL_REJECTED'):b.download(TINY)
  summary=b.receipt['requests'][0]['redirectSummary'];self.assertEqual(summary['scheme'],'https');self.assertEqual(summary['port'],444);self.assertTrue(summary['containsUserInfo']);self.assertTrue(summary['containsFragment']);self.assertEqual(summary['locationSha256'],m.sha(url.encode()))
  output=json.dumps(b.receipt)+self.output('ledger.jsonl').read_text()
  for secret in ['USERNAME-PRIVATE','PASSWORD-PRIVATE','SIGNED-PRIVATE','FRAGMENT-PRIVATE','?Signature=']:self.assertNotIn(secret,output)
 def test_unexpected_redirect_host(self):
  b,n=self.batch([Response(status=302,headers={'Location':'https://evil.example/token?secret=hidden'})])
  with self.assertRaisesRegex(m.Failure,'URL_REJECTED'):b.download(TINY)
  self.assertEqual(len(n.calls),1);self.assertNotIn('secret=hidden',json.dumps(b.receipt));self.assertIn('locationSha256',b.receipt['requests'][0])
 def test_redirect_limit(self):
  rs=[Response(status=302,headers={'Location':'https://cdn-lfs.huggingface.co/model?sig='+str(i)}) for i in range(3)]
  b,n=self.batch(rs)
  with self.assertRaisesRegex(m.Failure,'REDIRECT_BUDGET'):b.download(TINY)
  self.assertEqual(len(n.calls),3)
 def test_http_count_before_dispatch(self):
  rs=[Response(status=302,headers={'Location':'https://cdn-lfs.huggingface.co/model'}) for _ in range(2)];b,n=self.batch(rs)
  with mock.patch.dict(m.LIMITS,{'maximumHTTPRequests':2}):
   with self.assertRaisesRegex(m.Failure,'HTTP_BUDGET'):b.download(TINY)
  self.assertEqual(len(n.calls),2)
 def test_bad_urls_blocked_before_second_http(self):
  for url in ['http://huggingface.co/model','https://u:p@huggingface.co/model','https://huggingface.co:444/model','https://huggingface.co/model#frag','https://huggingface.co.evil.example/model','https://cdn-lfs-evil.huggingface.co/model']:
   b,n=self.batch([Response(status=302,headers={'Location':url})])
   with self.subTest(url=url),self.assertRaises(m.Failure):b.download(TINY)
   self.assertEqual(len(n.calls),1)
 def test_wrong_initial_url(self):
  b,n=self.batch([])
  with self.assertRaisesRegex(m.Failure,'INITIAL_URL_REJECTED'):b.download({**TINY,'path':'other.onnx'})
  self.assertFalse(n.calls)
 def test_dribble_does_not_reset_deadline(self):
  b,n=self.batch([Response(advance=self.clock,dribble=31)])
  with self.assertRaisesRegex(m.Failure,'ABSOLUTE_DEADLINE'):b.download(TINY)
  self.assertEqual(len(n.calls),1);self.assertFalse(self.output(TINY['path']).exists())
 def test_gap_cannot_exceed_batch_deadline(self):
  b,n=self.batch([]);b.last_start=119;self.clock.t=119
  with self.assertRaisesRegex(m.Failure,'BATCH_DEADLINE'):b.download(TINY)
  self.assertFalse(n.calls)
 def test_partial_os_write_completes(self):
  original=os.write
  with mock.patch.object(m.os,'write',side_effect=lambda fd,data:original(fd,data[:2])):self.store.copy('test.json',b'abcdefg')
  self.assertEqual(self.output('test.json').read_bytes(),b'abcdefg')
 def test_disk_write_failure_retains_partial(self):
  with mock.patch.object(m.os,'write',side_effect=OSError('/private/SECRET-DISK-PATH')):
   with self.assertRaises(OSError):self.store.copy('test.json',b'abc')
  self.assertTrue(self.output('test.json.partial').exists());self.assertEqual(stat.S_IMODE(self.output('test.json.partial').stat().st_mode),0o400)
 def test_file_overwrite_never_replaces(self):
  self.store.copy('test.json',b'old')
  with self.assertRaises(FileExistsError):self.store.copy('test.json',b'new')
  self.assertEqual(self.output('test.json').read_bytes(),b'old')
 def test_final_symlink_rejected(self):
  outside=self.root/'outside';outside.write_bytes(b'keep');self.output('link.json').symlink_to(outside)
  with self.assertRaises(FileExistsError):self.store.copy('link.json',b'new')
  self.assertEqual(outside.read_bytes(),b'keep')
 def test_partial_symlink_rejected(self):
  outside=self.root/'outside';outside.write_bytes(b'keep');self.output('link.json.partial').symlink_to(outside)
  with self.assertRaises(FileExistsError):self.store.copy('link.json',b'new')
  self.assertEqual(outside.read_bytes(),b'keep')
 def test_existing_leaf_rejected(self):
  with self.assertRaises(FileExistsError):m.Store(self.fd)
 def test_compressed_response_rejected(self):
  b,n=self.batch([Response(headers={'Content-Encoding':'gzip'})])
  with self.assertRaisesRegex(m.Failure,'CONTENT_ENCODING'):b.download(TINY)
 def test_postflight_six_readonly_files(self):
  records=[]
  for f in m.expected_payload_files():
   data=('synthetic:'+f['path']).encode();self.store.copy(f['path'],data);records.append({'path':f['path'],'bytes':len(data),'sha256':m.sha(data)})
  checked=m.verify_published_files(self.store.fd,records,lambda:None)
  self.assertEqual(len(checked),6);self.assertTrue(all(f['readonly'] for f in checked))
 def test_postflight_same_size_hash_drift(self):
  self.store.copy('test.json',b'abc');p=self.output('test.json');p.chmod(0o600);p.write_bytes(b'xyz');p.chmod(0o400)
  with self.assertRaisesRegex(m.Failure,'POSTFLIGHT_PAYLOAD_CHANGED'):m.verify_published_files(self.store.fd,[{'path':'test.json','bytes':3,'sha256':m.sha(b'abc')}],lambda:None)
 def test_postflight_writable_file_rejected(self):
  self.store.copy('test.json',b'abc');self.output('test.json').chmod(0o600)
  with self.assertRaisesRegex(m.Failure,'POSTFLIGHT_PAYLOAD_CHANGED'):m.verify_published_files(self.store.fd,[{'path':'test.json','bytes':3,'sha256':m.sha(b'abc')}],lambda:None)
 def test_postflight_symlink_rejected(self):
  p=self.root/'external';p.write_bytes(b'abc');p.chmod(0o400);self.output('test.json').symlink_to(p)
  with self.assertRaisesRegex(m.Failure,'POSTFLIGHT_PAYLOAD_CHANGED'):m.verify_published_files(self.store.fd,[{'path':'test.json','bytes':3,'sha256':m.sha(b'abc')}],lambda:None)
 def test_postflight_missing_file_rejected(self):
  with self.assertRaisesRegex(m.Failure,'POSTFLIGHT_PAYLOAD_CHANGED'):m.verify_published_files(self.store.fd,[{'path':'missing.json','bytes':3,'sha256':m.sha(b'abc')}],lambda:None)
class FreezeTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=pathlib.Path(self.tmp.name)
  for relative in m.REVIEWED:
   dest=self.root/relative;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes((REAL/relative).read_bytes())
  self.f={'schemaVersion':1,'id':'nym-research-preparation-v2','status':'frozen-reviewed','scope':'public-research-cache-only','planSha256':m.plan()['planSha256'],'sourceHashes':{p:m.sha((self.root/p).read_bytes()) for p in m.REVIEWED},'limits':dict(m.LIMITS),'outputDirectory':m.OUTPUT,'independentReview':{'identity':'offline-test-reviewer','reviewedAt':'2026-11-10T00:00:00Z','verdict':'APPROVE','independentFromBuilder':True},'rootAuthorization':{'by':'offline-test-root','authorizedAt':'2026-11-10T00:00:00Z','status':'authorized','scope':'bounded-research-only','missingLicenseNoticeAcknowledged':True}}
  self.writefreeze()
 def tearDown(self):self.tmp.cleanup()
 def writefreeze(self):
  path=self.root/m.FREEZE;path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(self.f))
 def check(self):
  fd=m.root_fd(self.root)
  try:return m.checked_sources(fd,m.FREEZE)
  finally:os.close(fd)
 def test_valid_freeze_binds_four_small_sources(self):
  value=self.check();self.assertEqual(set(value['embedded']),set(m.SMALL));self.assertEqual(sum(map(len,value['embedded'].values())),14665)
 def test_reviewer_and_root_required(self):
  self.f['independentReview']['verdict']='pending';self.writefreeze()
  with self.assertRaisesRegex(m.Failure,'REVIEW_REQUIRED'):self.check()
 def test_changed_source_blocks_before_output_network(self):
  (self.root/m.POLICY).write_text('{}');net=Network([])
  with self.assertRaisesRegex(m.Failure,'FROZEN_SOURCE_CHANGED'):m.prepare(m.FREEZE,root=self.root,request_transport=net)
  self.assertFalse(net.calls);self.assertFalse((self.root/m.OUTPUT).exists())
 def test_manifest_cannot_be_reapproved_or_changed(self):
  path=self.root/m.MANIFEST;value=json.loads(path.read_text());value['authorizationGranted']=True;path.write_text(json.dumps(value));self.f['sourceHashes'][m.MANIFEST]=m.sha(path.read_bytes());self.writefreeze()
  with self.assertRaisesRegex(m.Failure,'MANIFEST_CHANGED'):self.check()
 def test_source_symlink_rejected(self):
  path=self.root/m.POLICY;path.unlink();path.symlink_to(REAL/m.POLICY)
  with self.assertRaises(OSError):self.check()
 def test_output_parent_symlink_rejected_no_network(self):
  outside=self.root/'elsewhere';outside.mkdir();(self.root/'artifacts').symlink_to(outside);net=Network([])
  with self.assertRaises(OSError):m.prepare(m.FREEZE,root=self.root,request_transport=net)
  self.assertFalse(net.calls);self.assertFalse(list(outside.iterdir()))
 def test_failure_receipt_metadata_only_readonly_finite(self):
  net=Network([OSError('https://cdn.example/?SECRET /private/SECRET')]);clock=Clock()
  r=m.prepare(m.FREEZE,root=self.root,request_transport=net,clock=clock,sleep=clock.sleep,alarm=lambda _:contextlib.nullcontext())
  self.assertEqual(r['state'],'failed-retained-no-resume');self.assertEqual(r['actualHTTPRequests'],1);self.assertEqual(r['bodyBytesReceived'],0);self.assertEqual(r['embeddedBytesCopied'],14665);self.assertFalse(r['runtimeLoaded']);text=(self.root/m.OUTPUT/'receipt.json').read_text();self.assertNotIn('SECRET',text);self.assertEqual(stat.S_IMODE((self.root/m.OUTPUT/'receipt.json').stat().st_mode),0o400)
  with self.assertRaises(FileExistsError):m.prepare(m.FREEZE,root=self.root,request_transport=net)
  self.assertEqual(len(net.calls),1)
 def test_deadline_unavailable_no_dispatch_count(self):
  @contextlib.contextmanager
  def unavailable(_):raise m.Failure('ABSOLUTE_DEADLINE_UNAVAILABLE');yield
  net=Network([]);clock=Clock();r=m.prepare(m.FREEZE,root=self.root,request_transport=net,clock=clock,sleep=clock.sleep,alarm=unavailable)
  self.assertEqual(r['actualHTTPRequests'],0);self.assertFalse(net.calls);self.assertEqual(r['failureCode'],'ABSOLUTE_DEADLINE_UNAVAILABLE')
 def run_fake_complete_with_tamper(self,tamper):
  # No network or large payloads: pretend the two downloads completed only to
  # exercise postflight's mandatory independent rereads, not download correctness.
  calls=[];root=self.root
  def fake_download(batch,row):
   calls.append(row['path']);batch.receipt['payloadBytesPublished']+=row['bytes']
   if len(calls)==2:tamper(root)
  net=Network([]);clock=Clock()
  with mock.patch.object(m.Batch,'download',new=fake_download):
   result=m.prepare(m.FREEZE,root=root,request_transport=net,clock=clock,sleep=clock.sleep,alarm=lambda _:contextlib.nullcontext())
  self.assertEqual(len(calls),2);self.assertFalse(net.calls);self.assertEqual(result['actualHTTPRequests'],0)
  self.assertEqual(result['state'],'failed-retained-no-resume');self.assertFalse(result['runtimeLoaded']);self.assertEqual(result['postflight']['status'],'failed')
  self.assertTrue((root/m.OUTPUT/'ledger.jsonl').exists());self.assertTrue((root/m.OUTPUT/'receipt.json').exists())
  with self.assertRaises((m.Failure,OSError)):m.prepare(m.FREEZE,root=root,request_transport=net)
  self.assertFalse(net.calls)
  return result
 def test_postflight_source_drift_blocks_complete(self):
  r=self.run_fake_complete_with_tamper(lambda root:(root/m.POLICY).write_text('{}'))
  self.assertEqual(r['failureCode'],'POSTFLIGHT_SOURCE_CHANGED')
 def test_postflight_freeze_bytes_drift_blocks_complete(self):
  def tamper(root):
   p=root/m.FREEZE;p.write_text(p.read_text()+'\n')
  r=self.run_fake_complete_with_tamper(tamper);self.assertEqual(r['failureCode'],'POSTFLIGHT_FREEZE_CHANGED')
 def test_postflight_final_payload_drift_blocks_complete(self):
  def tamper(root):
   p=root/m.OUTPUT/'README.md';size=p.stat().st_size;p.chmod(0o600);p.write_bytes(b'x'*size);p.chmod(0o400)
  r=self.run_fake_complete_with_tamper(tamper);self.assertEqual(r['failureCode'],'POSTFLIGHT_PAYLOAD_CHANGED')
 def test_postflight_source_symlink_blocks_complete(self):
  def tamper(root):
   p=root/m.POLICY;p.unlink();p.symlink_to(REAL/m.POLICY)
  r=self.run_fake_complete_with_tamper(tamper);self.assertEqual(r['failureCode'],'POSTFLIGHT_SOURCE_CHANGED')
 def test_v1_freeze_path_and_v1_id_rejected(self):
  net=Network([])
  with self.assertRaisesRegex(m.Failure,'FREEZE_PATH_REJECTED'):m.prepare('docs/qa/privacy-nym-research-preparation-v1-freeze.json',root=self.root,request_transport=net)
  self.f['id']='nym-research-preparation-v1';self.writefreeze()
  with self.assertRaisesRegex(m.Failure,'FREEZE_REJECTED'):m.prepare(m.FREEZE,root=self.root,request_transport=net)
  self.assertFalse(net.calls);self.assertFalse((self.root/m.OUTPUT).exists())
 def test_v1_output_is_preserved_not_resumed(self):
  old=self.root/'artifacts/privacy/models/nym-int8-local-v1';old.mkdir(parents=True);(old/'receipt.json').write_bytes(b'v1-failed-kept')
  fd=m.root_fd(self.root)
  try:store=m.Store(fd);store.close()
  finally:os.close(fd)
  self.assertEqual(m.OUTPUT,'artifacts/privacy/models/nym-int8-local-v2');self.assertEqual((old/'receipt.json').read_bytes(),b'v1-failed-kept');self.assertTrue((self.root/m.OUTPUT).is_dir())
 def test_v2_needs_its_own_freeze_not_existing_v1(self):
  v1=self.root/'docs/qa/privacy-nym-research-preparation-v1-freeze.json';v1.write_text(json.dumps({**self.f,'id':'nym-research-preparation-v1'}));(self.root/m.FREEZE).unlink();net=Network([])
  with self.assertRaises(FileNotFoundError):m.prepare(m.FREEZE,root=self.root,request_transport=net)
  self.assertFalse(net.calls);self.assertFalse((self.root/m.OUTPUT).exists());self.assertEqual(json.loads(v1.read_text())['id'],'nym-research-preparation-v1')
 def test_arbitrary_freeze_path_rejected(self):
  with self.assertRaisesRegex(m.Failure,'FREEZE_PATH_REJECTED'):m.prepare('../elsewhere.json',root=self.root)
class PureTests(unittest.TestCase):
 def test_plan_no_file_network_or_artifact_access(self):
  with mock.patch.object(m,'root_fd',side_effect=AssertionError()),mock.patch.object(m,'transport',side_effect=AssertionError()),mock.patch.object(pathlib.Path,'read_bytes',side_effect=AssertionError()),mock.patch.object(m.os,'open',side_effect=AssertionError()):
   with contextlib.redirect_stdout(io.StringIO()) as out:self.assertEqual(m.main([]),0)
  value=json.loads(out.getvalue());self.assertEqual(value['action'],'PLAN');self.assertFalse(value['runtimeLoaded'])
 def test_cli_error_sanitized(self):
  with contextlib.redirect_stdout(io.StringIO()) as out:
   with self.assertRaises(SystemExit):m.main(['--url','https://user:SECRET@example.test/private'])
  self.assertNotIn('SECRET',out.getvalue());self.assertIn('CLI_ARGUMENT_REJECTED',out.getvalue())
 def test_traversal_rejected(self):
  for path in ['../test','/tmp/x','a//b','a/./b','a/../b','a\\b']:
   with self.subTest(path=path),self.assertRaises(m.Failure):m.parts(path)
 def test_absolute_alarm_interrupts_blocking_call(self):
  with self.assertRaisesRegex(m.Failure,'ABSOLUTE_DEADLINE'):
   with m.request_alarm(.01):time.sleep(.05)
 def test_only_one_exact_new_host_added(self):
  self.assertEqual(set(m.HOSTS),{'huggingface.co','cas-bridge.xethub.hf.co','cdn-lfs.huggingface.co','cdn-lfs-us-1.hf.co','us.aws.cdn.hf.co'})
 def test_summary_does_not_depend_on_accepting_url(self):
  with mock.patch.object(m,'checked_url',side_effect=AssertionError('guard must not be needed')):
   r=m.redirect_summary('http://unknown.example:444/x?sig=PRIVATE#SECRET','a'*64)
  self.assertEqual(r['scheme'],'http');self.assertEqual(r['hostname'],'unknown.example');self.assertEqual(r['port'],444);self.assertTrue(r['containsFragment']);self.assertNotIn('PRIVATE',json.dumps(r));self.assertNotIn('SECRET',json.dumps(r))
 def test_no_model_runtime_imports(self):
  import ast
  tree=ast.parse((REAL/'scripts/prepare-privacy-nym-research.py').read_text());names=[]
  for node in ast.walk(tree):
   if isinstance(node,ast.Import):names += [x.name for x in node.names]
   elif isinstance(node,ast.ImportFrom):names.append(node.module)
  self.assertFalse(any(n.split('.')[0] in {'onnxruntime','onnx','numpy','tokenizers','torch','transformers','huggingface_hub'} for n in names))
unittest.main(argv=['offline-nym-preparation-tests'],verbosity=1)
`;

test('Nym preparation: offline injected transport, freeze, disk and absolute deadline checks',()=>{
  const python=existsSync('/opt/homebrew/bin/python3')?'/opt/homebrew/bin/python3':'python3';
  const result=spawnSync(python,['-I','-B','-c',suite],{
    cwd:fileURLToPath(new URL('../',import.meta.url)),encoding:'utf8',timeout:30_000,
    env:{PATH:process.env.PATH,LANG:'en_US.UTF-8',PYTHONNOUSERSITE:'1'},
  });
  assert.equal(result.status,0,result.stderr||result.error?.message);
  assert.match(result.stderr,/Ran 53 tests/);
  assert.match(result.stderr,/\bOK\b/);
});
