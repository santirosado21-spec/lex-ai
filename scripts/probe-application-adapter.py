"""One synthetic application prompt against a real adapter, before export."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import time

os.environ['HF_HUB_OFFLINE']='1';os.environ['TOKENIZERS_PARALLELISM']='false'
ROOT=Path(__file__).resolve().parents[1]
def main():
    p=argparse.ArgumentParser();p.add_argument('--adapter',required=True,type=Path);p.add_argument('--trace',default='artifacts/training/runtime-v2-r2/candidate-synthetic-trace.json',type=Path);p.add_argument('--repetition-penalty',type=float,default=1.0);a=p.parse_args()
    adapter=a.adapter.resolve();trace=json.loads(a.trace.read_text());messages=trace['messages'];payload=json.loads(messages[-1]['content']);sources={s['id']:s for s in payload['sources']}
    if set(sources)!={'D1','L1'}:raise ValueError('Expected the isolated two-source synthetic fixture')
    lock=ROOT/'artifacts/training/gpu.lock'
    with lock.open('x')as f:f.write(json.dumps({'pid':os.getpid(),'mode':'application-adapter-probe'}))
    report={'scope':'Synthetic application protocol probe, not legal accuracy','adapter':adapter.name,'traceSha256':hashlib.sha256(a.trace.read_bytes()).hexdigest()}
    try:
        import mlx.core as mx
        from mlx_lm import load,generate
        from mlx_lm.sample_utils import make_sampler,make_logits_processors
        mx.set_memory_limit(mx.device_info()['max_recommended_working_set_size']);mx.set_cache_limit(256*1024**2)
        model,tok=load(str(ROOT/'artifacts/training/base-gemma4-26b'),adapter_path=str(adapter),trust_remote_code=False)
        prompt=tok.apply_chat_template(messages,tokenize=False,add_generation_prompt=True,enable_thinking=False)
        report['sampling']={'temperature':0,'repetitionPenalty':a.repetition_penalty,'repetitionContextSize':64}
        start=time.monotonic();raw=generate(model,tok,prompt=prompt,max_tokens=768,sampler=make_sampler(temp=0),logits_processors=make_logits_processors(repetition_penalty=a.repetition_penalty,repetition_context_size=64),verbose=False)
        report.update(raw=raw,elapsedSeconds=time.monotonic()-start,peakMemoryGB=mx.get_peak_memory()/1e9)
        value=json.loads(raw)
        if set(value)!={'analysis','citations'}or not isinstance(value['analysis'],str):raise ValueError('Invalid application JSON shape')
        cited=set()
        for c in value['citations']:
            if set(c)!={'sourceId','quote'}or c['sourceId']not in sources or not isinstance(c['quote'],str)or len(c['quote'])<12 or c['quote']not in sources[c['sourceId']]['text']or f"[{c['sourceId']}]"not in value['analysis']:raise ValueError('Invalid application citation')
            cited.add(c['sourceId'])
        if cited!=set(sources):raise ValueError('Both synthetic document and official source must be cited')
        paragraphs=[s for s in value['analysis'].split('\n\n')if s.strip()]
        if not 2<=len(paragraphs)<=4 or any(not any(f'[{id}]'in text for id in sources)for text in paragraphs):raise ValueError('Every substantive paragraph needs a reference')
        report['status']='PASS'
    except Exception as error:
        report.update(status='FAIL',error=f'{type(error).__name__}: {error}')
    finally:
        lock.unlink(missing_ok=True);(adapter/f'application-probe-rp{a.repetition_penalty}.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items()if k!='raw'},indent=2),flush=True)
    if report['status']!='PASS':raise SystemExit(1)
if __name__=='__main__':main()
