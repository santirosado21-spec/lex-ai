"""Local QLoRA with pinned public base, auditable data, checkpoints and baseline.

No Hub upload, external tracking, client documents or deployment approval.
"""
import argparse
import copy
import hashlib
import json
import math
import os
import re
import signal
import threading
import time
from argparse import Namespace
from pathlib import Path
from functools import partial

os.environ['HF_HUB_OFFLINE']='1'
os.environ['HF_HUB_DISABLE_TELEMETRY']='1'
os.environ['TOKENIZERS_PARALLELISM']='false'
from training_status import publish,now,ROOT

def filehash(path):
    digest=hashlib.sha256()
    with Path(path).open('rb')as stream:
        for chunk in iter(lambda:stream.read(4*1024*1024),b''):digest.update(chunk)
    return digest.hexdigest()

class TokenDataset:
    def __init__(self,rows,tokenizer,max_length):
        self.data=[];self.rows=[];self.rejected=0
        for row in rows:
            messages=row['messages']
            # Gemma4's inference prefix includes an empty thought channel when thinking is off.
            # Its full-chat training template omits that prefix. Build the completion after
            # the exact inference prefix so prompt masking never labels the wrong boundary.
            prefix=tokenizer.apply_chat_template(messages[:-1],tokenize=True,return_dict=False,add_generation_prompt=True,enable_thinking=False)
            completion=tokenizer.encode(messages[-1]['content']+'<turn|>\n',add_special_tokens=False)
            tokens=prefix+completion
            if len(tokens)>max_length or len(prefix)>=len(tokens):
                self.rejected+=1;continue
            self.data.append((tokens,len(prefix)));self.rows.append(row)
    def __len__(self):return len(self.data)
    def __getitem__(self,index):return self.data[index]
    def process(self,item):return item
    def evaluation_subset(self,count):
        groups={}
        for index,row in enumerate(self.rows):groups.setdefault(row['metadata']['task'],[]).append(index)
        indices=[]
        while len(indices)<min(count,len(self)):
            for key in sorted(groups):
                if groups[key] and len(indices)<count:indices.append(groups[key].pop(0))
        subset=object.__new__(TokenDataset)
        subset.data=[self.data[i]for i in indices];subset.rows=[self.rows[i]for i in indices];subset.rejected=0
        return subset

def masked_loss(model,batch,lengths):
    import mlx.core as mx
    import mlx.nn as nn
    targets=batch[:,1:];logits=model(batch[:,:-1])
    steps=mx.arange(1,targets.shape[1]+1)
    mask=mx.logical_and(steps>=lengths[:,0:1],steps<lengths[:,1:])
    ntokens=mask.sum()
    return (nn.losses.cross_entropy(logits,targets)*mask).astype(mx.float32).sum()/ntokens,ntokens

def verify_base(base):
    # New lightweight bases carry an adjacent manifest.  Retain the old global
    # manifest only for the already-recorded 26B experiment.
    manifest_path=base/'base-manifest.json'
    if not manifest_path.exists():manifest_path=base.parent/'base-model-manifest.json'
    manifest=json.loads(manifest_path.read_text())
    if not (manifest.get('repo','').startswith('mlx-community/gemma-4-') and re.fullmatch(r'[0-9a-f]{7,40}',manifest.get('revision',''))):raise ValueError('Unexpected base provenance')
    for entry in manifest['files']:
        path=base/entry['file']
        if path.parent!=base or path.stat().st_size!=entry['bytes'] or filehash(path)!=entry['sha256']:raise ValueError('Base file hash mismatch')
    return {'repo':manifest['repo'],'revision':manifest['revision'],'license':manifest.get('license'),'manifestSha256':filehash(manifest_path)}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--base',default='artifacts/training/base-gemma4-26b');parser.add_argument('--data',default='artifacts/training/dataset-v1');parser.add_argument('--output',default='artifacts/training/lex-gemma4-lora-v1');parser.add_argument('--iters',type=int,default=200);parser.add_argument('--seq-length',type=int,default=512);parser.add_argument('--rank',type=int,default=4);parser.add_argument('--layers',type=int,default=4);parser.add_argument('--learning-rate',type=float,default=2e-5);parser.add_argument('--eval-batches',type=int,default=8);parser.add_argument('--skip-baseline',action='store_true');parser.add_argument('--resume-adapter',type=Path);parser.add_argument('--model-label',default='local MLX instruction base');args=parser.parse_args()
    if not 1<=args.iters<=2000 or not 128<=args.seq_length<=1024 or not 1<=args.eval_batches<=64 or not 1<=args.rank<=16 or not 1<=args.layers<=4 or not 0<args.learning_rate<=1e-3:raise ValueError('Training bounds invalid')
    base=Path(args.base).resolve();data=Path(args.data).resolve();out=Path(args.output).resolve();out.mkdir(parents=True,exist_ok=True)
    if(out/'adapters.safetensors').exists():raise ValueError('Preserve existing adapter: choose a new output directory')
    parent=None
    if args.resume_adapter:
        resumed=args.resume_adapter.resolve()
        if resumed==out:raise ValueError('Continue training into a separate output directory')
        previous=json.loads((resumed/'adapter_config.json').read_text())
        if previous['num_layers']!=args.layers or previous['lora_parameters']['rank']!=args.rank or previous['fine_tune_type']!='lora' or set(previous['lora_parameters']['keys'])!={'self_attn.q_proj','self_attn.v_proj'} or Path(previous['model']).resolve()!=base:raise ValueError('Parent adapter configuration differs')
        prior_report=json.loads((resumed/'training-report.json').read_text())
        parent={'adapterSha256':filehash(resumed/'adapters.safetensors'),'configSha256':filehash(resumed/'adapter_config.json'),'steps':prior_report.get('totalSteps',prior_report['steps'])}
        if parent['adapterSha256']!=prior_report['adapterSha256']:raise ValueError('Parent adapter training report mismatch')
    manifest=json.loads((data/'manifest.json').read_text())
    for part in ['train','valid','test']:
        if filehash(data/f'{part}.jsonl')!=manifest['files'][part]['sha256']:raise ValueError('Dataset hash mismatch')
    lock=ROOT/'artifacts/training/gpu.lock';lock.parent.mkdir(parents=True,exist_ok=True)
    try:handle=lock.open('x')
    except FileExistsError:raise RuntimeError('Training GPU lock exists. Verify its owner before recovery.')
    handle.write(json.dumps({'pid':os.getpid(),'startedAt':now(),'output':str(out)}));handle.close()
    status={'state':'loading','id':out.name,'baseModel':args.model_label,'candidateModel':out.name,'startedAt':now(),'phase':'loading','progress':{'step':0,'totalSteps':args.iters},'metrics':{},'releaseStatus':'not-trained','artifacts':{'adapterReady':False,'downloadPackageReady':False}}
    events=[];done=threading.Event();publish(status)
    def heartbeat():
        while not done.wait(15):publish(status)
    thread=threading.Thread(target=heartbeat,daemon=True);thread.start()
    def interrupt(signum,frame):raise KeyboardInterrupt('Training interrupted')
    signal.signal(signal.SIGTERM,interrupt);signal.signal(signal.SIGINT,interrupt)
    started=time.monotonic()
    try:
        provenance=verify_base(base)
        import numpy as np
        np.random.seed(20261030)
        import mlx.core as mx
        from mlx.utils import tree_flatten
        from mlx_lm.utils import load
        from mlx_lm.lora import CONFIG_DEFAULTS,train_model
        from mlx_lm.tuner.trainer import evaluate,TrainingCallback
        import mlx_lm.lora as lora_module
        from mlx_lm.tuner.trainer import train as upstream_train
        lora_module.train=partial(upstream_train,loss=masked_loss)
        mx.set_memory_limit(min(mx.device_info()['max_recommended_working_set_size'],19*1024**3))
        mx.set_cache_limit(256*1024**2)
        model,tokenizer=load(str(base),tokenizer_config={'trust_remote_code':False},trust_remote_code=False)
        model.freeze();mx.eval(model.parameters())
        sets={key:TokenDataset([json.loads(line)for line in(data/f'{key}.jsonl').read_text().splitlines()if line],tokenizer,args.seq_length)for key in ['train','valid','test']}
        if any(len(value)<8 for value in sets.values()):raise ValueError('Too few complete examples fit context; do not truncate target responses')
        status['dataset']={'train':len(sets['train']),'validation':len(sets['valid']),'test':len(sets['test']),'laws':sum(len(v)for v in manifest['lawGroups'].values())}
        dataset_audit={'counts':status['dataset'],'filteredByTokenBudget':{key:value.rejected for key,value in sets.items()},'datasetManifestSha256':filehash(data/'manifest.json'),'maxSeqLength':args.seq_length,'promptMasked':True,'thinking':False}
        (out/'dataset-audit.json').write_text(json.dumps(dataset_audit,indent=2)+'\n')
        for key,value in sets.items():
            (out/f'effective-{key}.jsonl').write_text(''.join(json.dumps(row,ensure_ascii=False)+'\n'for row in value.rows))
        evaluation_sets={key:sets[key].evaluation_subset(args.eval_batches)for key in ['valid','test']}
        (out/'loss-evaluation-cases.json').write_text(json.dumps({key:[row['metadata']for row in value.rows]for key,value in evaluation_sets.items()},indent=2)+'\n')
        if not args.skip_baseline:
            status.update(state='baseline',phase='baseline-loss',message='Midiendo pérdida del modelo base en particiones separadas.');publish(status)
            baseline={}
            for part in ['valid','test']:
                baseline[part+'Loss']=float(evaluate(model,evaluation_sets[part],batch_size=1,num_batches=-1,max_seq_length=args.seq_length,loss=masked_loss))
            baseline['batchesPerSplit']=args.eval_batches
            (out/'baseline.json').write_text(json.dumps(baseline,indent=2)+'\n');status['evaluation']={'baseline':baseline,'scope':manifest['scope']}
        cfg=copy.deepcopy(CONFIG_DEFAULTS);cfg.update(model=str(base),data=str(data),train=True,num_layers=args.layers,batch_size=1,iters=args.iters,val_batches=4,learning_rate=args.learning_rate,steps_per_report=1,steps_per_eval=25,save_every=10,max_seq_length=args.seq_length,grad_checkpoint=True,adapter_path=str(out),mask_prompt=True,seed=20261030,lora_parameters={'rank':args.rank,'scale':8.0,'dropout':0.0,'keys':['self_attn.q_proj','self_attn.v_proj']})
        class Callback(TrainingCallback):
            best=math.inf
            def on_train_loss_report(self,info):
                if not math.isfinite(info['train_loss']):raise ValueError('Non-finite training loss')
                status['progress']['step']=int(info['iteration']);status['metrics'].update(trainLoss=float(info['train_loss']),peakMemoryGB=float(info['peak_memory']));status['artifacts']['adapterReady']=(out/'adapters.safetensors').exists()
                events.append({'type':'train',**info,'at':now()});(out/'metrics.jsonl').open('a').write(json.dumps(events[-1])+'\n');publish(status)
            def on_val_loss_report(self,info):
                if not math.isfinite(info['val_loss']):raise ValueError('Non-finite validation loss')
                status['metrics']['validationLoss']=float(info['val_loss']);events.append({'type':'validation',**info,'at':now()});(out/'metrics.jsonl').open('a').write(json.dumps(events[-1])+'\n')
                if info['iteration']>0 and info['val_loss']<self.best:
                    self.best=info['val_loss'];mx.save_safetensors(str(out/'best-validation.safetensors'),dict(tree_flatten(model.trainable_parameters())))
                publish(status)
        status.update(state='training',phase='qlora',message='Ajustando adaptadores de atención; pesos base congelados.');publish(status)
        cfg['val_batches']=-1
        if parent:cfg['resume_adapter_file']=str(args.resume_adapter.resolve()/'adapters.safetensors')
        train_model(Namespace(**cfg),model,sets['train'],evaluation_sets['valid'],Callback())
        status.update(state='evaluating',phase='candidate-loss');publish(status);model.eval()
        candidate={}
        for part in ['valid','test']:
            candidate[part+'Loss']=float(evaluate(model,evaluation_sets[part],batch_size=1,num_batches=-1,max_seq_length=args.seq_length,loss=masked_loss))
        candidate['peakMemoryGB']=mx.get_peak_memory()/1e9
        status.setdefault('evaluation',{})['candidate']=candidate
        status['evaluation']['scope']=manifest['scope']
        status['evaluation']['passed']=False # Quality gate requires a separate behavioral evaluation, never loss alone.
        weights=mx.load(str(out/'adapters.safetensors'))
        nonzero=sum(int(mx.sum(mx.abs(value)>0).item())for key,value in weights.items()if key.endswith('lora_b'))
        if nonzero==0:raise ValueError('Adapter produced no trained nonzero B weights')
        report={'status':'TRAINED_EXPERIMENTAL','steps':args.iters,'adapterSha256':filehash(out/'adapters.safetensors'),'trainedNonzeroBWeights':nonzero,'candidate':candidate,'baseline':status.get('evaluation',{}).get('baseline'),'durationSeconds':time.monotonic()-started,'config':cfg,'dataset':dataset_audit,'behavioralEvaluation':'pending','legalValidity':'not-reviewed'}
        report['baseRevision']=provenance['revision'];report['baseProvenance']=provenance
        report['trainingScriptSha256']=filehash(Path(__file__))
        if parent:
            if filehash(args.resume_adapter.resolve()/'adapters.safetensors')!=parent['adapterSha256'] or filehash(args.resume_adapter.resolve()/'adapter_config.json')!=parent['configSha256']:raise ValueError('Parent adapter changed during training')
            if report['adapterSha256']==parent['adapterSha256']:raise ValueError('Continued training did not change adapter weights')
            report['parentAdapter']=parent;report['totalSteps']=parent['steps']+args.iters
        report['lossMask']='promptEnd <= targetPosition < unpaddedTokenCount'
        report['evaluationSampling']='fixed balanced cases; every selected case evaluated before and after training'
        report['lossEvaluationCasesSha256']=filehash(out/'loss-evaluation-cases.json')
        (out/'training-report.json').write_text(json.dumps(report,indent=2)+'\n')
        status.update(state='completed',phase='trained-awaiting-behavioral-evaluation',releaseStatus='experimental',message='Adaptador entrenado. Falta evaluación conductual e importación del candidato; no se ha reemplazado el modelo de la aplicación.',artifacts={'adapterReady':True,'downloadPackageReady':False});publish(status)
        print(json.dumps(report,indent=2),flush=True)
    except BaseException as error:
        status.update(state='failed',phase='error',message=f'{type(error).__name__}: {error}',releaseStatus='rejected');publish(status);raise
    finally:
        done.set();thread.join(timeout=2);lock.unlink(missing_ok=True)
if __name__=='__main__':main()
