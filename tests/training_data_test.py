import importlib.util
import unittest
from pathlib import Path
MODULE=Path(__file__).resolve().parents[1]/'scripts/build-training-data.py'
spec=importlib.util.spec_from_file_location('training_data',MODULE);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
def row(law,split,text=None):
    text=text or f'Artículo {law}. Las partes del supuesto {law} conservarán una copia de este documento ficticio para su consulta posterior.'
    return {'id':law+'-1','lawId':law,'split':split,'articleId':'1','text':text,'textSha256':module.sha(text),'sourceUrl':'https://www.diputados.gob.mx/LeyesBiblio/pdf/fixture.pdf','pdfSha256':'0'*64}
class DataTests(unittest.TestCase):
    def test_verbatim_and_partitions(self):
        records,manifest=module.build_records([row('A','train'),row('B','validation'),row('C','test')]);self.assertEqual(manifest['counts'],{'train':4,'valid':4,'test':4})
        import json
        for records in records.values():
            for rec in records:
                prompt=json.loads(rec['messages'][1]['content']);answer=json.loads(rec['messages'][2]['content'])
                for cite in answer['citations']:self.assertTrue(any(cite['sourceId']==s['id']and cite['quote']in s['text']for s in prompt['sources']))
    def test_tampering_and_external_sources(self):
        a=row('A','train');a['text']+='edited';b=row('B','test');b['sourceUrl']='https://not-official.test/article';records,_=module.build_records([a,b]);self.assertFalse(any(records.values()))
    def test_same_law_in_multiple_splits_rejected(self):
        a=row('A','train');b=row('A','test','Artículo 2. Las partes podrán conservar un archivo de este texto ficticio con fines de revisión documental.')
        b['id']='A-2'
        with self.assertRaisesRegex(ValueError,'split leakage'):module.build_records([a,b])
    def test_exact_text_leakage_rejected(self):
        a=row('A','train');b=row('B','test',a['text'])
        with self.assertRaisesRegex(ValueError,'crosses'):module.build_records([a,b])
if __name__=='__main__':unittest.main()
