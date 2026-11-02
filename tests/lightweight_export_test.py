import importlib.util,json,struct,tempfile,unittest
from pathlib import Path
import numpy as np
spec=importlib.util.spec_from_file_location('lightweight_export',Path(__file__).resolve().parents[1]/'scripts/export-lightweight-adapter.py')
e=importlib.util.module_from_spec(spec);spec.loader.exec_module(e)
def safetensors(path,arrays):
    header={};payload=[];offset=0
    for name,a in arrays.items():
        data=a.tobytes();header[name]={'dtype':{np.dtype('uint32'):'U32',np.dtype('float16'):'F16',np.dtype('float32'):'F32'}[a.dtype],'shape':list(a.shape),'data_offsets':[offset,offset+len(data)]};offset+=len(data);payload.append(data)
    raw=json.dumps(header).encode();raw+=b' '*(-len(raw)%8);path.write_bytes(struct.pack('<Q',len(raw))+raw+b''.join(payload))
class ExportTests(unittest.TestCase):
    def test_scale_orientation_and_affine_codes(self):
        packed=np.full((2,8),0x76543210,dtype=np.uint32);scales=np.array([[0.5],[2]],dtype=np.float16);biases=np.array([[-1],[3]],dtype=np.float16)
        a=np.arange(64*4,dtype=np.float32).reshape(64,4)/1024;b=np.array([[1,2],[3,4],[5,6],[7,8]],dtype=np.float32)/16
        result=e.fuse_arrays(packed,scales,biases,a,b)
        expected=np.empty((2,64),dtype=np.float16)
        for row in range(2):
            for col in range(64):
                base=np.float16((col%8)*float(scales[row,0])+float(biases[row,0]));delta=np.float16(sum(8*float(b[k,row])*float(a[col,k]) for k in range(4)));expected[row,col]=np.float16(base+delta)
        np.testing.assert_array_equal(result,expected)
        self.assertFalse(np.array_equal(result,e.fuse_arrays(packed,scales,biases,a,b,scale=2)))
    def test_invalid_shapes_and_nonfinite_rejected(self):
        p=np.zeros((2,8),dtype=np.uint32);s=np.ones((2,1),dtype=np.float16);a=np.zeros((64,4),dtype=np.float32);b=np.zeros((4,2),dtype=np.float32)
        with self.assertRaises(ValueError):e.fuse_arrays(p,s,s,a.T,b)
        a[0,0]=np.nan
        with self.assertRaises(ValueError):e.fuse_arrays(p,s,s,a,b)
    def fixture(self,root):
        base=root/'base';adapter=root/'adapter';base.mkdir();adapter.mkdir()
        config={'model_type':'gemma3_text','num_hidden_layers':26,'quantization':{'bits':4,'group_size':64},'quantization_config':{'bits':4,'group_size':64}}
        (base/'config.json').write_text(json.dumps(config));(base/'tokenizer_config.json').write_text('{}')
        weights={'model.norm.weight':np.array([1,2,3],dtype=np.float16)};lora={}
        for m in sorted(e.MODULES):
            rows=1024 if m.endswith('q_proj') else 256
            weights[m+'.weight']=np.zeros((rows,144),dtype=np.uint32);weights[m+'.scales']=np.ones((rows,18),dtype=np.float16);weights[m+'.biases']=np.ones((rows,18),dtype=np.float16)
            lora[m+'.lora_a']=np.full((1152,4),0.125,dtype=np.float32);lora[m+'.lora_b']=np.full((4,rows),0.25,dtype=np.float32)
        safetensors(base/'model.safetensors',weights);safetensors(adapter/'adapters.safetensors',lora)
        (adapter/'adapter_config.json').write_text(json.dumps({'fine_tune_type':'lora','num_layers':2,'lora_parameters':{'rank':4,'scale':8.0,'dropout':0.0,'keys':['self_attn.q_proj','self_attn.v_proj']}}))
        manifest=root/'base-manifest.json';manifest.write_text(json.dumps({'repo':e.REPO,'revision':e.REV,'license':'gemma','files':[e.common.file_record(p) for p in sorted(base.iterdir())]}))
        dataset=root/'dataset.json';dataset.write_text('{"synthetic":true}');report=root/'report.json';report.write_text('{"completed":true}')
        return base,adapter,manifest,dataset,report
    def test_export_preserves_unadapted_bytes_and_inputs_provenance(self):
        with tempfile.TemporaryDirectory() as d:
            r=Path(d);base,adapter,manifest,dataset,report=self.fixture(r);before=e.common.sha256(base/'model.safetensors');a=e.common.sha256(adapter/'adapters.safetensors')
            result=e.export(base,adapter,r/'out',manifest,dataset,report);t=e.common.inventory(r/'out')
            self.assertEqual(e.common.sha256(base/'model.safetensors'),before);self.assertEqual(e.common.sha256(adapter/'adapters.safetensors'),a)
            np.testing.assert_array_equal(e.common.read_tensor_numpy(t['model.norm.weight']),np.array([1,2,3],dtype=np.float16))
            for m in e.MODULES:
                self.assertNotIn(m+'.scales',t);self.assertNotIn(m+'.biases',t);self.assertEqual(t[m+'.weight']['dtype'],'F16');self.assertTrue(np.all(e.common.read_tensor_numpy(t[m+'.weight'])==2))
            self.assertEqual(result['inputs']['adapter']['sha256'],a);self.assertEqual(result['license'],'Gemma Terms of Use');self.assertLess(sum(f['bytes'] for f in result['files']),2e9)
            with self.assertRaises(ValueError):e.export(base,adapter,r/'out',manifest,dataset,report)
    def test_manifest_tamper_and_wrong_modules_fail_before_export(self):
        with tempfile.TemporaryDirectory() as d:
            r=Path(d);base,adapter,manifest,dataset,report=self.fixture(r);(base/'tokenizer_config.json').write_text('{"changed":true}')
            with self.assertRaises(ValueError):e.export(base,adapter,r/'out',manifest,dataset,report)
            self.assertFalse((r/'out').exists())
            safetensors(adapter/'adapters.safetensors',{'wrong.lora_a':np.zeros((1,4),dtype=np.float32)})
            with self.assertRaises(ValueError):e.inspect(base,adapter)
if __name__=='__main__':unittest.main()
