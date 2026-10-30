import importlib.util
import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
spec=importlib.util.spec_from_file_location('train_legal',Path(__file__).resolve().parents[1]/'scripts/train-legal-adapter.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class TrainingMaskTests(unittest.TestCase):
    def test_padding_and_prompt_do_not_contribute(self):
        import mlx.core as mx
        with mx.stream(mx.cpu):
            batch=mx.zeros((1,128),dtype=mx.int32)
            loss,count=module.masked_loss(lambda x:mx.zeros((1,127,8)),batch,mx.array([[60,100]]))
            self.assertEqual(count.item(),40)
            self.assertAlmostEqual(loss.item(),2.0794415,places=5)

    def test_fixed_evaluation_cases_balanced_across_tasks(self):
        dataset=object.__new__(module.TokenDataset)
        dataset.rows=[{'metadata':{'task':str(i%4),'id':str(i)}}for i in range(16)]
        dataset.data=list(range(16));dataset.rejected=0
        first=dataset.evaluation_subset(8);second=dataset.evaluation_subset(8)
        self.assertEqual(first.data,second.data)
        self.assertEqual(len(set(first.data)),8)
        for task in range(4):self.assertEqual(sum(row['metadata']['task']==str(task)for row in first.rows),2)

if __name__=='__main__':unittest.main()
