import importlib.util,json,pathlib,unittest,subprocess
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('grounded_train',ROOT/'scripts/train-grounded-lightweight.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class GroundedPreparationTests(unittest.TestCase):
 def test_prompt_batch_mapping_cannot_masquerade_as_token_ids(self):
  class WrongTokenizer:
   def apply_chat_template(self,*a,**k):return 'prefix'
   def encode(self,*a,**k):return {'input_ids':[1,2],'attention_mask':[1,1]}
  with self.assertRaisesRegex(ValueError,'integer IDs'):m.prompt_tokens(WrongTokenizer(),[])
 def test_preserves_official_sources_and_law_split(self):
  rows,_=m.select_source_rows(ROOT/'artifacts/lightweight/adapter-v1')
  self.assertEqual({s:len(r) for s,r in rows.items()},{'train':255,'valid':8,'test':8})
  groups={s:{r['metadata']['lawId'] for r in rr} for s,rr in rows.items()}
  self.assertFalse(groups['train']&groups['valid']);self.assertFalse(groups['train']&groups['test']);self.assertFalse(groups['valid']&groups['test'])
  self.assertFalse({'MX-FED-CCF','MX-FED-CPEUM'}&set.union(*groups.values()))
  for rr in rows.values():
   for r in rr:
    self.assertTrue(r['metadata']['publicExcerptParentId'])
    self.assertEqual(len(json.loads(r['messages'][1]['content'])['sources']),1)
 def test_length_rejection_keeps_complete_boundary_row(self):
  rows=[{'metadata':{'id':str(n),'task':'quotation'},'size':n} for n in [1536,1537]]
  with patch.object(m.prior,'encode_row',side_effect=lambda r,t:([1]*r['size'],100)):
   d=m.TokenDataset(rows,None)
  self.assertEqual(len(d),1);self.assertEqual(len(d[0][0]),1536)
  self.assertEqual(d.rejected,[{'id':'1537','tokens':1537,'task':'quotation'}])
 def test_rejects_invalid_mask(self):
  with patch.object(m.prior,'encode_row',return_value=([1,2],2)):
   with self.assertRaisesRegex(ValueError,'mask'):m.TokenDataset([{'metadata':{'id':'x','task':'x'}}],None)
 def test_actual_validator_accepts_targets_and_rejects_misattributed_quotes(self):
  p=ROOT/'artifacts/lightweight/adapter-grounded-v2'
  if not p.exists():self.skipTest('CPU preparation not yet generated')
  rows=[json.loads(x) for x in (p/'effective-train.jsonl').read_text().splitlines()]
  js="""import {validateGroundedOutput as check} from './server/grounded-output.mjs';let input='';for await(const c of process.stdin)input+=c;for(const r of JSON.parse(input)){check(r.messages.at(-1).content,r.evidence);const bad=JSON.parse(r.messages.at(-1).content);bad.paragraphs[1].quote=bad.paragraphs[0].quote;let rejected=false;try{check(JSON.stringify(bad),r.evidence)}catch{rejected=true}if(!rejected)throw Error('Mismatched source accepted');}console.log('validated');"""
  result=subprocess.run(['node','--input-type=module','-e',js],input=json.dumps(rows),text=True,capture_output=True,cwd=ROOT,check=True)
  self.assertEqual(result.stdout.strip(),'validated')
 def test_prepared_actual_targets_masks_and_exclusions(self):
  p=ROOT/'artifacts/lightweight/adapter-grounded-v2'
  if not p.exists():self.skipTest('CPU preparation not yet generated')
  from transformers import AutoTokenizer
  tok=AutoTokenizer.from_pretrained(str(ROOT/'artifacts/lightweight/base-gemma3-1b'),local_files_only=True,trust_remote_code=False)
  app=json.loads((p/'application-cases.json').read_text())
  for c in app['cases']:
   tokens=m.prompt_tokens(tok,c['enabled'])
   self.assertIsInstance(tokens,list);self.assertGreater(len(tokens),100)
   self.assertTrue(all(isinstance(t,int) for t in tokens));self.assertLessEqual(len(tokens)+512,4096)
  for split in ['train','valid','test']:
   rows=[json.loads(x) for x in (p/f'effective-{split}.jsonl').read_text().splitlines()]
   d=m.TokenDataset(rows,tok);self.assertEqual(len(d),len(rows));self.assertFalse(d.rejected)
   for r in rows:
    target=json.loads(r['messages'][-1]['content']);self.assertEqual(set(target),{'paragraphs'})
    self.assertEqual({v['sourceId'] for v in target['paragraphs']},{'D1','L1'})
    for part in target['paragraphs']:
     source=next(s for s in r['evidence'] if s['id']==part['sourceId'])
     self.assertIn(part['quote'],source['allowedQuotes']);self.assertEqual(part['text'],part['quote'])
    self.assertNotIn('SECRETO_ENTRENAMIENTO_FALSO',r['messages'][-1]['content'])

if __name__=='__main__':unittest.main()
