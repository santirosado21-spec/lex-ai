import importlib.util,io,json,tempfile,unittest
from pathlib import Path
import numpy as np
from lightweight_export_test import ExportTests,safetensors
spec=importlib.util.spec_from_file_location('fallback',Path(__file__).resolve().parents[1]/'scripts/export-lightweight-lora-gguf.py');f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
class FallbackTests(unittest.TestCase):
    def test_gguf_dense_projections_and_other_quantized_matrix_gate(self):
        records=[{'name':name,'shape':list(shape),'type':'F16'} for name,shape in f.ADAPTED_GGUF.items()]+[{'name':'blk.0.attn_q.weight','shape':[1152,1024],'type':'Q4_K'}]
        self.assertEqual(f.check_tensor_records(records),{'Q4_K':1})
        records[0]['type']='Q4_K'
        with self.assertRaises(ValueError):f.check_tensor_records(records)
        records[0]['type']='F16';records[-1]['type']='F16'
        with self.assertRaises(ValueError):f.check_tensor_records(records)
    def test_rss_tree_counts_descendants_only(self):
        self.assertEqual(f.rss_tree('10 1 100\n11 10 200\n12 11 300\n20 1 99999',10),600*1024)
        with self.assertRaises(ValueError):f.rss_tree('10 1 nope',10)

    def test_stream_chunks_and_final_short_chunk(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'q.safetensors';rows=130;packed=np.full((rows,8),0xfedcba98,dtype=np.uint32);s=np.full((rows,1),0.5,dtype=np.float16);b=np.full((rows,1),-2,dtype=np.float16)
            safetensors(p,{'w':packed,'s':s,'b':b});h=f.c.read_header(p);out=io.BytesIO();f.stream_dequant([h['w'],h['s'],h['b']],out)
            actual=np.frombuffer(out.getvalue(),dtype=np.float16).reshape(rows,64);expected=np.tile(np.arange(8,16)*0.5-2,(rows,8));np.testing.assert_array_equal(actual,expected)
            with self.assertRaises(ValueError):f.stream_dequant([h['w'],h['s'],h['b']],io.BytesIO(),65)
    def test_f16_export_removes_quant_metadata_keeps_norm_and_fuses_once(self):
        with tempfile.TemporaryDirectory() as d:
            r=Path(d);base,adapter,manifest,dataset,report=ExportTests().fixture(r)
            result=f.export_f16(base,adapter,r/'out',manifest,dataset,report);h=f.c.inventory(r/'out');config=json.loads((r/'out/config.json').read_text());self.assertNotIn('quantization',config);self.assertNotIn('quantization_config',config)
            self.assertFalse(result['inferenceAllowed']);self.assertEqual(result['fusionCount'],1);np.testing.assert_array_equal(f.c.read_tensor_numpy(h['model.norm.weight']),[1,2,3]);self.assertFalse(any(k.endswith(('.scales','.biases')) for k in h))
            for m in f.e.MODULES:self.assertTrue(np.all(f.c.read_tensor_numpy(h[m+'.weight'])==2))
if __name__=='__main__':unittest.main()
