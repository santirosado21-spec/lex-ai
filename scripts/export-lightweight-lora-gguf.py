#!/usr/bin/env python3
"""Offline CPU F16 staging fallback; Ollama 0.40.6 rejects separate LoRA adapters.

Default: inspect headers/print plan only. --export-f16 creates a bounded, atomic
HF intermediate for official llama.cpp conversion. Never loads a model, invokes
Ollama, uses MLX/GPU, installs dependencies or executes a downloaded converter.
"""
import argparse,importlib.util,json,os,shutil,tempfile,subprocess,signal,sys,time
from pathlib import Path
spec=importlib.util.spec_from_file_location('selective',Path(__file__).with_name('export-lightweight-adapter.py'))
e=importlib.util.module_from_spec(spec);spec.loader.exec_module(e)
c=e.common

def plan_f16(base,adapter):
    config,tensors,lora,plan=e.inspect(base,adapter);total=0
    for name,t in tensors.items():
        if name.endswith(('.scales','.biases')):continue
        if t['dtype']=='U32':
            c.require(name.endswith('.weight'),'Unexpected U32 tensor');c.validate_triplet(tensors,name[:-7],4,64,2);total+=t['size']*4
        else:total+=t['size']
    c.require(total<3_000_000_000,'Unexpected F16 intermediate size')
    return config,tensors,lora,{**plan,'f16TensorBytes':total,'loraAdapterRoute':'rejected-by-Ollama-0.40.6','nextStep':'official pinned llama.cpp convert_hf_to_gguf then llama-quantize Q4_K_M; no inference on F16 intermediate','minimumFreeDiskBytes':7*1024**3}

def read_rows(tensor,start,count):
    import numpy as np
    rowbytes=tensor['size']//tensor['shape'][0]
    c.require(0<=start<tensor['shape'][0] and count>0 and start+count<=tensor['shape'][0],'Invalid row range')
    piece={**tensor,'offset':tensor['offset']+start*rowbytes,'size':count*rowbytes,'shape':[count,*tensor['shape'][1:]]}
    return c.read_tensor_numpy(piece)

def stream_dequant(triple,output,rows_per_chunk=64):
    import numpy as np
    weight,scales,biases=triple
    c.require(1<=rows_per_chunk<=64,'Row chunk outside bounds')
    for start in range(0,weight['shape'][0],rows_per_chunk):
        count=min(rows_per_chunk,weight['shape'][0]-start)
        packed,s,b=(read_rows(t,start,count) for t in triple)
        codes=((packed[...,None]>>np.arange(0,32,4,dtype=np.uint32))&15).reshape(count,-1).astype(np.float32)
        values=(codes*np.repeat(s.astype(np.float32),64,axis=1)+np.repeat(b.astype(np.float32),64,axis=1)).astype('<f2')
        c.require(np.isfinite(values).all(),'Non-finite dequantized weights');output.write(values.tobytes())

def export_f16(base,adapter,output,manifest,dataset,report):
    c.require(not output.exists() and not output.is_relative_to(base) and not output.is_relative_to(adapter),'Output must be new and separate')
    config,tensors,lora,plan=plan_f16(base,adapter);e.verify_manifest(base,manifest)
    inputs=[adapter/'adapters.safetensors',adapter/'adapter_config.json',manifest,dataset,report];before=[c.file_record(p) for p in inputs]
    output.parent.mkdir(parents=True,exist_ok=True);c.require(shutil.disk_usage(output.parent).free>=7*1024**3,'At least7GiB free disk required')
    with tempfile.TemporaryDirectory(prefix='lex-f16-',dir=output.parent) as tmp:
        staging=Path(tmp)/'bundle';staging.mkdir();plans=[]
        for name,t in sorted(tensors.items()):
            if name.endswith(('.scales','.biases')):continue
            module=name[:-7] if name.endswith('.weight') else None
            if t['dtype']!='U32':plans.append(c.direct_plan(name,t));continue
            payload=Path(tmp)/(name+'.bin')
            with payload.open('xb') as stream:
                if module in e.MODULES:
                    dense=e.fuse_arrays(*(c.read_tensor_numpy(tensors[module+'.'+s]) for s in ('weight','scales','biases')),c.read_tensor_numpy(lora[module+'.lora_a']),c.read_tensor_numpy(lora[module+'.lora_b']))
                    stream.write(dense.tobytes())
                else:stream_dequant([tensors[module+'.'+s] for s in ('weight','scales','biases')],stream)
            plans.append(c.direct_plan(name,{'path':payload,'offset':0,'size':payload.stat().st_size,'shape':[t['shape'][0],t['shape'][1]*8],'dtype':'F16'}))
        c.write_shards(plans,staging)
        for item in c.read_json(manifest)['files']:
            name=item['file']
            if name.endswith('.safetensors') or name=='model.safetensors.index.json':continue
            shutil.copyfile(base/name,staging/name)
        config.pop('quantization',None);config.pop('quantization_config',None);c.write_json(staging/'config.json',config)
        c.require([c.file_record(p) for p in inputs]==before,'Inputs changed during export')
        files=[c.file_record(p) for p in sorted(staging.iterdir()) if p.is_file()];c.require(sum(f['bytes'] for f in files)<3_000_000_000,'F16 staging exceeds3GB')
        result={**plan,'schemaVersion':1,'experimental':True,'inferenceAllowed':False,'qualityStatus':'not-evaluated','inputs':dict(zip(['adapter','adapterConfig','baseManifest','dataset','trainingReport'],before)),'files':files,'normTransform':'none; official converter must apply Gemma norm shift once','quantizationShiftWarning':'MLX affine q4 dequantization followed by GGUF Q4_K_M is not equivalent to original base quantization','fusionCount':1}
        c.write_json(staging/'export-manifest.json',result);os.rename(staging,output)
    return result

def rss_tree(text,pid):
    rows=[tuple(map(int,line.split())) for line in text.splitlines() if line.strip()]
    c.require(all(len(r)==3 and min(r)>=0 for r in rows),'Invalid RSS snapshot')
    owned={pid};changed=True
    while changed:
        changed=False
        for child,parent,rss in rows:
            if parent in owned and child not in owned:owned.add(child);changed=True
    return sum(rss*1024 for child,parent,rss in rows if child in owned)

def run_cpu(command):
    c.require(command,'Missing CPU command')
    # Prove monitoring works before starting any export/converter child.
    probe=subprocess.run(['/bin/ps','-axo','pid=,ppid=,rss='],capture_output=True,text=True,check=True,timeout=3)
    c.require(rss_tree(probe.stdout,os.getpid())>0,'RSS monitoring unavailable')
    env={**os.environ,'CUDA_VISIBLE_DEVICES':'','HF_HUB_OFFLINE':'1','TRANSFORMERS_OFFLINE':'1','HF_HUB_DISABLE_TELEMETRY':'1','OMP_NUM_THREADS':'1','OPENBLAS_NUM_THREADS':'1','VECLIB_MAXIMUM_THREADS':'1'}
    child=subprocess.Popen(command,env=env,start_new_session=True);peak=0;started=time.monotonic()
    try:
        while child.poll() is None:
            snap=subprocess.run(['/bin/ps','-axo','pid=,ppid=,rss='],capture_output=True,text=True,check=True,timeout=3)
            peak=max(peak,rss_tree(snap.stdout,child.pid))
            c.require(peak<=3*1024**3,'CPU export exceeded3GiB process-tree RSS')
            c.require(time.monotonic()-started<1800,'CPU conversion exceeded30minutes')
            time.sleep(.25)
        c.require(child.returncode==0,f'CPU command exited {child.returncode}')
        print(json.dumps({'cpuOnlyCommand':command[0],'peakRssBytes':peak,'elapsedSeconds':round(time.monotonic()-started,3),'exitCode':child.returncode}),flush=True)
    finally:
        if child.poll() is None:
            os.killpg(child.pid,signal.SIGKILL);child.wait()

ADAPTED_GGUF={f'blk.{layer}.attn_{projection}.weight':(1152,1024 if projection=='q' else 256) for layer in (24,25) for projection in ('q','v')}
def check_tensor_records(records):
    by_name={r['name']:r for r in records}
    c.require(len(by_name)==len(records),'Duplicate GGUF tensors')
    for name,shape in ADAPTED_GGUF.items():
        c.require(name in by_name and tuple(by_name[name]['shape'])==shape and by_name[name]['type']=='F16','Adapted GGUF tensor must retain exact shape and F16: '+name)
    quantized={}
    for r in records:
        if r['name'] in ADAPTED_GGUF:continue
        if len(r['shape'])>=2:
            c.require(r['type'].startswith(('Q','IQ','TQ')),'Unexpected unquantized matrix: '+r['name'])
            quantized[r['type']]=quantized.get(r['type'],0)+1
    c.require(quantized,'No remaining quantized matrices')
    return quantized

def verify_gguf(output,reference,gguf_package):
    import hashlib
    c.require(output.is_file() and output.stat().st_size<=2_000_000_000,'Final GGUF missing or exceeds2GB')
    sys.path.insert(0,str(gguf_package));from gguf import GGUFReader
    result=GGUFReader(str(output),'r');original=GGUFReader(str(reference),'r')
    records=[{'name':t.name,'type':t.tensor_type.name,'shape':[int(n) for n in t.shape]} for t in result.tensors]
    counts=check_tensor_records(records);reference_by={t.name:t for t in original.tensors};dense=[]
    for t in result.tensors:
        if t.name not in ADAPTED_GGUF:continue
        before=reference_by.get(t.name);c.require(before is not None and before.tensor_type.name=='F16' and tuple(before.shape)==tuple(t.shape),'Dense reference mismatch')
        actual_hash=hashlib.sha256(t.data.tobytes()).hexdigest();expected_hash=hashlib.sha256(before.data.tobytes()).hexdigest()
        c.require(actual_hash==expected_hash,'Adapted dense tensor changed during quantization: '+t.name)
        dense.append({'name':t.name,'sha256':actual_hash,'shape':[int(n) for n in t.shape],'type':'F16'})
    return {'status':'structural-pass','qualityStatus':'not-evaluated','final':c.file_record(output),'reference':c.file_record(reference),'preservedAdaptedTensors':dense,'otherMatrixQuantizationCounts':counts}

def main():
    p=argparse.ArgumentParser(description=__doc__)
    for name in ('base','adapter'):p.add_argument('--'+name,type=Path,required=True)
    for name in ('output','base-manifest','dataset','training-report'):p.add_argument('--'+name,type=Path)
    p.add_argument('--export-f16',action='store_true');a=p.parse_args();base,adapter=a.base.resolve(),a.adapter.resolve()
    if not a.export_f16:result=plan_f16(base,adapter)[3]
    else:
        c.require(all([a.output,a.base_manifest,a.dataset,a.training_report]),'F16 export requires all provenance and output arguments')
        result=export_f16(base,adapter,a.output.resolve(),a.base_manifest.resolve(),a.dataset.resolve(),a.training_report.resolve())
    print(json.dumps(result,indent=2))
if __name__=='__main__':
    if len(sys.argv)>1 and sys.argv[1]=='--run-cpu':run_cpu(sys.argv[2:])
    elif len(sys.argv)==5 and sys.argv[1]=='--verify-gguf':print(json.dumps(verify_gguf(Path(sys.argv[2]),Path(sys.argv[3]),Path(sys.argv[4])),indent=2))
    else:main()
