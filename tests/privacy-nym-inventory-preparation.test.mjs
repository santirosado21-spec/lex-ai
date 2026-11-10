import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('inventory preparation: stdlib synthetic tests, no actual cache/runtime/network', () => {
  const code = String.raw`
import importlib.util,json,pathlib,tempfile,unittest,unittest.mock as mock,os
spec=importlib.util.spec_from_file_location('inventory','scripts/prepare-nym-content-inventory.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

def fixture():
 return {'model':{'type':'BPE','vocab':{'a':0,'b':1},'fuse_unk':False,'byte_fallback':True,'ignore_merges':False},'added_tokens':[{'id':2,'content':'c',**{k:False for k in m.FLAGS}}]}
def raw(t=None):return json.dumps(fixture() if t is None else t).encode()
def budget():return m_original_budget(clock=lambda:0,rss=lambda:1)
class Cases(unittest.TestCase):
 def test_union_presence(self):
  rows,c=m.validate_inventory(raw(),budget(),3,1)
  self.assertEqual(c,{'baseBpeEntries':2,'addedEntries':1,'unionRows':3,'addedOnlyRows':1})
  self.assertTrue(rows[0]['baseBpePresence']);self.assertFalse(rows[2]['baseBpePresence'])
 def test_flags_and_ids(self):
  for field,value in [('id',True),('id',3),('content',''),('special',1)]:
   t=fixture();t['added_tokens'][0][field]=value
   with self.subTest(field=field,value=value),self.assertRaises(m.Failure):m.validate_inventory(raw(t),budget(),3,1)
 def test_model_flags(self):
  t=fixture();t['model']['byte_fallback']=1
  with self.assertRaises(m.Failure):m.validate_inventory(raw(t),budget(),3,1)
 def test_duplicate_base_id(self):
  t=fixture();t['model']['vocab']['b']=0
  with self.assertRaises(m.Failure):m.validate_inventory(raw(t),budget(),3,1)
 def test_duplicate_json_key(self):
  with self.assertRaises(m.Failure):m.validate_inventory(b'{"model":{},"model":{}}',budget(),3,1)
 def test_collision(self):
  t=fixture();t['added_tokens'][0]['id']=0
  with self.assertRaises(m.Failure):m.validate_inventory(raw(t),budget(),3,1)
 def test_duplicate_added(self):
  t=fixture();t['added_tokens']*=2
  with self.assertRaises(m.Failure):m.validate_inventory(raw(t),budget(),3,2)
 def test_count_and_union(self):
  for rows,count in [(4,1),(3,2)]:
   with self.assertRaises(m.Failure):m.validate_inventory(raw(),budget(),rows,count)
 def test_deadline_rss(self):
  b=budget();b.clock=lambda:31
  with self.assertRaisesRegex(m.Failure,'DEADLINE'):b.check()
  b=budget();b.rss=lambda:402653185
  with self.assertRaisesRegex(m.Failure,'RSS_LIMIT'):b.check()
 def test_plan_no_io(self):
  with mock.patch('builtins.open',side_effect=AssertionError),mock.patch.object(m.os,'open',side_effect=AssertionError),mock.patch.object(m.Path,'read_bytes',side_effect=AssertionError):
   self.assertFalse(m.plan()['executionAuthorized'])
 def setup_tree(self,root):
  for f in (*m.SOURCES,m.SOURCE,m.FREEZE):
   p=root/f;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b'fixture' if f!=m.SOURCE else raw())
  (root/m.OUTPUT).parent.mkdir(parents=True,exist_ok=True)
  freeze={'id':m.ID,'status':'frozen-reviewed','rootAuthorization':'one-public-build-preparation','independentReview':'approved','sourceHashes':m.source_identity(root,budget()),'tokenizerSha256':m.SOURCE_SHA,'limits':m.LIMITS}
  (root/m.FREEZE).write_bytes(m.canonical(freeze))
 def run_fake(self,kind=None):
  with tempfile.TemporaryDirectory() as tmp:
   root=pathlib.Path(tmp);limits={**m.LIMITS,'rows':3,'addedEntries':1}
   if kind=='line':limits['lineBytes']=1
   if kind=='cap':limits['inventoryBytes']=1
   with mock.patch.object(m,'LIMITS',limits),mock.patch.object(m,'SOURCE_BYTES',len(raw())),mock.patch.object(m,'SOURCE_SHA',m.digest(raw())),mock.patch.object(m,'Budget',side_effect=lambda:m_original_budget(limits=limits,clock=lambda:0,rss=lambda:1)):
    self.setup_tree(root)
    if kind=='exists':(root/m.OUTPUT).mkdir()
    if kind=='symlink':
     (root/m.SOURCE).unlink();(root/m.SOURCE).symlink_to(root/m.SOURCES[0])
    if kind=='hash':(root/m.SOURCE).write_bytes(b'X'*len(raw()))
    original=m.read_regular;seen=0
    original_validate=m.validate_inventory
    def validate(*a):
     result=original_validate(*a)
     if kind=='deadline':a[1].clock=lambda:31
     if kind=='rss':a[1].rss=lambda:402653185
     return result
    def read(*a):
     nonlocal seen
     if a[1]==m.SOURCE:
      seen+=1
      if kind=='mutation' and seen==2:(root/m.SOURCE).write_bytes(b'X'*len(raw()))
     return original(*a)
    with mock.patch.object(m,'read_regular',side_effect=read),mock.patch.object(m,'validate_inventory',side_effect=validate):result=m.prepare(root,m.FREEZE)
    output=root/m.OUTPUT
    if kind is None:
     self.assertEqual(result,0);r=json.loads((output/'receipt.json').read_text());self.assertEqual(r['status'],'complete-build-asset')
     self.assertEqual(len((output/'inventory.ndjson').read_text().splitlines()),3)
     self.assertEqual((output/'inventory.ndjson').stat().st_mode&0o777,0o400)
     self.assertEqual(output.stat().st_mode&0o777,0o700)
    else:
     self.assertEqual(result,1);self.assertFalse((output/'inventory.ndjson').exists())
 def test_fake_success(self):self.run_fake()
 def test_hash_caps_leaf_symlink_mutation(self):
  for kind in ('hash','line','cap','exists','symlink','mutation','deadline','rss'):
   with self.subTest(kind=kind):self.run_fake(kind)
 def test_failed_deadline_before_publish(self):
  with tempfile.TemporaryDirectory() as tmp:
   b=m.Budget(clock=lambda:0,rss=lambda:1);b.clock=lambda:31
   with self.assertRaises(m.Failure):m.validate_inventory(raw(),b,3,1)
 def test_short_write(self):
  chunks=[]
  def write(fd,data):chunks.append(data[:1]);return 1
  with mock.patch.object(m.os,'write',side_effect=write):m.write_all(7,b'abc')
  self.assertEqual(b''.join(chunks),b'abc')
m_original_budget=m.Budget
unittest.main(verbosity=2)
`;
  const r=spawnSync('python3',['-I','-B','-c',code],{encoding:'utf8',timeout:20000,maxBuffer:65536});
  assert.equal(r.status,0,r.stdout+r.stderr);
});
