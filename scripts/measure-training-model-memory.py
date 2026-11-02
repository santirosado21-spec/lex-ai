"""Measure local MLX model memory with a fixed, short text workload.

This is a hardware observation, not an 8 GB-machine certification.  It records
both MLX unified-memory allocation and macOS process peak resident memory.
"""
import argparse
import json
import os
import platform
import resource
import signal
import time
from pathlib import Path

os.environ['HF_HUB_OFFLINE']='1';os.environ['HF_HUB_DISABLE_TELEMETRY']='1';os.environ['TOKENIZERS_PARALLELISM']='false'
from training_status import ROOT,now

PROMPT='Resume en una oración: una cita legal requiere revisar su fuente y no confirma vigencia actual.'

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base',required=True)
    parser.add_argument('--output',required=True)
    parser.add_argument('--max-tokens',type=int,default=64)
    args=parser.parse_args()
    if not 1<=args.max_tokens<=256:raise ValueError('max-tokens must be between 1 and 256')
    output=Path(args.output).resolve()
    if output.exists():raise ValueError('Refusing to overwrite an existing memory measurement')
    lock=ROOT/'artifacts/training/gpu.lock';lock.parent.mkdir(parents=True,exist_ok=True)
    with lock.open('x')as stream:stream.write(json.dumps({'pid':os.getpid(),'startedAt':now(),'mode':'memory-measurement','base':str(Path(args.base).resolve())}))
    try:
        from importlib.util import module_from_spec,spec_from_file_location
        spec=spec_from_file_location('lex_train_preflight',ROOT/'scripts/train-legal-adapter.py')
        preflight=module_from_spec(spec);spec.loader.exec_module(preflight)
        identity=preflight.verify_base(Path(args.base).resolve())
        import mlx.core as mx
        from mlx_lm import generate,load
        from mlx_lm.sample_utils import make_sampler
        mx.set_memory_limit(min(mx.device_info()['max_recommended_working_set_size'],19*1024**3));mx.set_cache_limit(256*1024**2)
        started=time.monotonic();model,tokenizer=load(str(Path(args.base).resolve()),trust_remote_code=False,tokenizer_config={'trust_remote_code':False})
        mx.eval(model.parameters())
        load_seconds=time.monotonic()-started
        loaded_peak=mx.get_peak_memory()
        prompt=tokenizer.apply_chat_template([{'role':'user','content':PROMPT}],tokenize=False,add_generation_prompt=True,enable_thinking=False)
        generated=generate(model,tokenizer,prompt=prompt,max_tokens=args.max_tokens,sampler=make_sampler(temp=0),verbose=False)
        mx.eval(mx.array([0]))
        report={'measuredAt':now(),'base':identity,'platform':platform.platform(),'machine':platform.machine(),'workload':{'prompt':PROMPT,'maxTokens':args.max_tokens,'generatedCharacters':len(generated)},'loadSeconds':load_seconds,'mlxPeakUnifiedMemoryBytes':int(mx.get_peak_memory()),'mlxPeakAtLoadBytes':int(loaded_peak),'mlxActiveMemoryBytes':int(mx.get_active_memory()),'processPeakResidentRaw':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,'processPeakResidentUnit':'bytes on macOS; inspect platform above before cross-platform comparison','scope':'Actual local measurement on this machine and workload. It is not a certification for an 8 GB Mac or a legal-quality evaluation.'}
        output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
        print(json.dumps(report,ensure_ascii=False,indent=2))
    finally:lock.unlink(missing_ok=True)

if __name__=='__main__':main()
