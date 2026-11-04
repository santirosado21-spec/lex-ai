"""One short CPU-only feasibility probe while the owned GPU job remains intact."""
import importlib,json,os,resource,time
os.environ['HF_HUB_OFFLINE']='1';os.environ['HF_HUB_DISABLE_TELEMETRY']='1';os.environ['TOKENIZERS_PARALLELISM']='false';os.environ['OMP_NUM_THREADS']='2';os.environ['VECLIB_MAXIMUM_THREADS']='2'
from common import ROOT,verify_base
def main():
 began=time.monotonic();base=ROOT/'artifacts/training/qwen-base-2b-4bit';provenance=verify_base(base,ROOT/'artifacts/training/qwen-base-manifest.json')
 import mlx.core as mx
 mx.set_default_device(mx.cpu)
 from mlx_lm.utils import load
 from mlx_lm.sample_utils import make_sampler
 generation=importlib.import_module('mlx_lm.generate');generation.maybe_set_recommended_wired_limit=lambda:None
 model,tokenizer=load(str(base),tokenizer_config={'trust_remote_code':False},trust_remote_code=False);model.freeze();model.eval();stream=mx.new_stream(mx.cpu)
 messages=[{'role':'system','content':'Eres LEX AI. Responde brevemente en español.'},{'role':'user','content':'Di listo.'}];prompt=tokenizer.apply_chat_template(messages,tokenize=False,add_generation_prompt=True,enable_thinking=False);tokens=tokenizer.encode(prompt,add_special_tokens=False);start=time.monotonic();output=[]
 for token,_ in generation.generate_step(mx.array(tokens),model,max_tokens=1,sampler=make_sampler(temp=0),stream=stream,prefill_step_size=64):output.append(token)
 print(json.dumps({'status':'CPU_PROBE_PASS','defaultDevice':str(mx.default_device()),'generationStream':str(stream),'durationSeconds':time.monotonic()-began,'generationSeconds':time.monotonic()-start,'promptTokens':len(tokens),'outputTokenIds':output,'text':tokenizer.decode(output),'peakProcessRssBytes':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,'base':provenance,'gpuLockModified':False}),flush=True)
if __name__=='__main__':main()
