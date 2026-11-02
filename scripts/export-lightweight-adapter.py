#!/usr/bin/env python3
"""CPU-only selective Gemma3 adapter export. Default inspects; --execute writes.

This intermediate MLX bundle is NOT claimed importable in Ollama 0.40.6.
No MLX import, GPU, Ollama invocation, network or automatic promotion.
"""
import argparse, importlib.util, json, os, shutil, tempfile
from pathlib import Path
for key in ('OPENBLAS_NUM_THREADS','OMP_NUM_THREADS','VECLIB_MAXIMUM_THREADS'):
    os.environ[key]='1'
spec=importlib.util.spec_from_file_location('export_common',Path(__file__).with_name('export-trained-model.py'))
common=importlib.util.module_from_spec(spec);spec.loader.exec_module(common)
MODULES={f'model.layers.{layer}.self_attn.{proj}' for layer in (24,25) for proj in ('q_proj','v_proj')}
REPO='mlx-community/gemma-3-1b-it-4bit'
REV='2d44e83dc9e80843d22fb941d3d699a0b1351aa6'

def inspect(base,adapter):
    config=common.read_json(base/'config.json');ac=common.read_json(adapter/'adapter_config.json')
    common.require(config.get('model_type')=='gemma3_text' and config.get('num_hidden_layers')==26,'Expected Gemma3 text 26 layers')
    common.require(config.get('quantization')=={'bits':4,'group_size':64} and config.get('quantization_config')==config['quantization'],'Expected uniform affine q4 group64')
    common.require(ac.get('fine_tune_type')=='lora' and ac.get('num_layers')==2 and ac.get('lora_parameters')=={'rank':4,'scale':8.0,'dropout':0.0,'keys':['self_attn.q_proj','self_attn.v_proj']},'Unexpected LoRA configuration')
    tensors=common.inventory(base);lora=common.read_header(adapter/'adapters.safetensors')
    common.require(set(lora)=={m+'.'+s for m in MODULES for s in ('lora_a','lora_b')},'Exactly four q/v adapted matrices required')
    for m in MODULES:
        common.validate_triplet(tensors,m,4,64,2)
        output=1024 if m.endswith('q_proj') else 256
        common.require(tensors[m+'.weight']['shape']==[output,144],'Unexpected base projection shape')
        common.require(tensors[m+'.scales']['dtype']=='F16','Only F16 affine scales supported')
        common.require(lora[m+'.lora_a']['shape']==[1152,4] and lora[m+'.lora_b']['shape']==[4,output] and all(lora[m+'.'+s]['dtype']=='F32' for s in ('lora_a','lora_b')),'Unexpected adapter orientation/dtype')
    size=sum(t['size'] for name,t in tensors.items() if not any(name.startswith(m+'.') for m in MODULES))+sum((1024 if m.endswith('q_proj') else 256)*1152*2 for m in MODULES)
    common.require(size<2_000_000_000,'Export exceeds 2 GB cap')
    return config,tensors,lora,{'modules':sorted(MODULES),'tensorBytes':size,'scale':8.0,'rank':4,'formula':'W_q4_dequant_F16 + ((8 * B.T) @ A.T).astype(F16)','ollamaImportStatus':'blocked-pending-GGUF-or-proven-architecture-support','license':'Gemma Terms of Use'}

def fuse_arrays(packed,scales,biases,a,b,scale=8.0):
    import numpy as np
    common.require(packed.dtype==np.dtype('uint32') and packed.ndim==2,'Packed q4 must be rank2 U32')
    width=packed.shape[1]*8;rows=packed.shape[0]
    common.require(scales.shape==biases.shape==(rows,width//64) and a.shape==(width,4) and b.shape==(4,rows),'Invalid fusion shapes')
    codes=((packed[...,None]>>np.arange(0,32,4,dtype=np.uint32))&15).reshape(rows,width).astype(np.float32)
    weight=(codes*np.repeat(scales.astype(np.float32),64,axis=1)+np.repeat(biases.astype(np.float32),64,axis=1)).astype(np.float16)
    # MLX-LM 0.32.2 LoRALinear.fuse uses self.scale directly, not alpha/rank.
    delta=((np.float32(scale)*b.T.astype(np.float32))@a.T.astype(np.float32)).astype(np.float16)
    result=(weight+delta).astype('<f2')
    common.require(np.isfinite(result).all(),'Non-finite fused projection')
    return result

def verify_manifest(base,manifest):
    m=common.read_json(manifest)
    common.require(m.get('repo')==REPO and m.get('revision')==REV and m.get('license')=='gemma','Unexpected pinned base provenance')
    names=set()
    for item in m.get('files',[]):
        name=item['file'];common.require(Path(name).name==name and name not in names,'Invalid manifest filename');names.add(name)
        p=base/name;common.require(p.is_file() and not p.is_symlink() and common.file_record(p)==item,'Base checksum mismatch: '+name)
    common.require({'config.json','tokenizer_config.json'}|{p.name for p in base.glob('*.safetensors')}<=names,'Manifest omits required files')
    return m

def export(base,adapter,output,manifest,dataset,report):
    common.require(not output.exists() and not output.is_relative_to(base) and not output.is_relative_to(adapter),'Output must be new and separate')
    config,tensors,lora,plan=inspect(base,adapter);verify_manifest(base,manifest)
    inputs=[adapter/'adapters.safetensors',adapter/'adapter_config.json',manifest,dataset,report]
    before=[common.file_record(p) for p in inputs]
    output.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='lex-gemma-export-',dir=output.parent) as scratch:
        staging=Path(scratch)/'bundle';staging.mkdir();plans=[]
        for m in sorted(MODULES):
            dense=fuse_arrays(*(common.read_tensor_numpy(tensors[m+'.'+s]) for s in ('weight','scales','biases')),common.read_tensor_numpy(lora[m+'.lora_a']),common.read_tensor_numpy(lora[m+'.lora_b']))
            payload=Path(scratch)/(m+'.bin');payload.write_bytes(dense.tobytes())
            plans.append(common.direct_plan(m+'.weight',{'path':payload,'offset':0,'size':payload.stat().st_size,'shape':list(dense.shape),'dtype':'F16'}))
        for name,tensor in sorted(tensors.items()):
            if not any(name.startswith(m+'.') for m in MODULES):plans.append(common.direct_plan(name,tensor))
        common.write_shards(plans,staging)
        for item in common.read_json(manifest)['files']:
            name=item['file']
            if name.endswith('.safetensors') or name=='model.safetensors.index.json':continue
            shutil.copyfile(base/name,staging/name)
        # Keep global q4 config: dense modules have no scales/biases companions.
        common.write_json(staging/'config.json',config)
        common.require([common.file_record(p) for p in inputs]==before,'Inputs changed during export')
        files=[common.file_record(p) for p in sorted(staging.iterdir()) if p.is_file()]
        common.require(sum(f['bytes'] for f in files)<2_000_000_000,'Bundle exceeds 2 GB cap')
        result={**plan,'schemaVersion':1,'experimental':True,'qualityStatus':'not-evaluated','inputs':dict(zip(['adapter','adapterConfig','baseManifest','dataset','trainingReport'],before)),'baseRepo':REPO,'baseRevision':REV,'licenseUrl':'https://ai.google.dev/gemma/terms','files':files,'unchangedTensors':'streamed byte-for-byte; only four q/v matrices replaced','cpuArithmetic':'F32 matmul then F16 cast; not asserted bit-identical to GPU kernels'}
        common.write_json(staging/'export-manifest.json',result);os.rename(staging,output)
    return result

def main():
    p=argparse.ArgumentParser(description=__doc__)
    for name in ('base','adapter'):p.add_argument('--'+name,type=Path,required=True)
    for name in ('output','base-manifest','dataset','training-report'):p.add_argument('--'+name,type=Path)
    p.add_argument('--execute',action='store_true');args=p.parse_args()
    base,adapter=args.base.resolve(),args.adapter.resolve()
    if not args.execute:result=inspect(base,adapter)[3]
    else:
        common.require(all([args.output,args.base_manifest,args.dataset,args.training_report]),'Execute requires output, base-manifest, dataset, training-report')
        result=export(base,adapter,args.output.resolve(),args.base_manifest.resolve(),args.dataset.resolve(),args.training_report.resolve())
    print(json.dumps(result,indent=2))
if __name__=='__main__':main()
