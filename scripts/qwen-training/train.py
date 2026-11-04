"""Bounded experimental Qwen 2B QLoRA, with public-data provenance and paired eval.

Only --run touches the GPU. Frozen recurrent prefix uses its supported eval
kernel; only final full-attention q/v projections receive rank-4 adapters.
"""
import argparse,collections,importlib.metadata,json,math,os,random,resource,signal,sys,time
from pathlib import Path
os.environ['HF_HUB_OFFLINE']='1'
os.environ['HF_HUB_DISABLE_TELEMETRY']='1'
os.environ['TOKENIZERS_PARALLELISM']='false'
from common import ROOT,claim_locks,digest,encode_row,verify_base
from curation import verify_dataset_curation
from monitor import ProgressMonitor
SEED=20261103
def select_rows(file,tokenizer,limit,maximum,all_laws=False):
 public={};synthetic=[];rejected=[];count=0
 for line in file.open():
  row=json.loads(line);meta=row['metadata'];count+=1
  if meta.get('synthetic'):
   if len(synthetic)<128:synthetic.append(row)
  elif meta['lawId']not in public:public[meta['lawId']]=row
 picked=[]
 # Mix public and conversation tasks; one public passage for each eligible
 # training law can be selected, without claiming an epoch over the full corpus.
 legal=list(public.values());random.Random(SEED).shuffle(legal)
 for i,row in enumerate(legal):
  picked.append(row)
  if i%4==0 and synthetic:picked.append(synthetic.pop(0))
 picked+=synthetic
 encoded=[]
 for row in picked:
  tokens,start=encode_row(row,tokenizer)
  if len(tokens)>maximum:rejected.append({'id':row['metadata']['id'],'tokens':len(tokens),'task':row['metadata']['task']});continue
  encoded.append((row,tokens,start))
  if len(encoded)>=limit:break
 return encoded,{'scannedRows':count,'selectedRows':len(encoded),'selectedLaws':sorted({r['metadata']['lawId']for r,_,_ in encoded if r['metadata']['lawId']}),'rejectedOverBudget':rejected,'fullDatasetRowsTrained':False}
def main():
 p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);p.add_argument('--base',type=Path,default=ROOT/'artifacts/training/qwen-base-2b-4bit');p.add_argument('--base-manifest',type=Path,default=ROOT/'artifacts/training/qwen-base-manifest.json');p.add_argument('--data',type=Path,default=ROOT/'artifacts/training/qwen-curated-dataset-v2');p.add_argument('--iters',type=int,default=320);p.add_argument('--seq-length',type=int,default=512,choices=[256,384,512]);p.add_argument('--run',action='store_true');p.add_argument('--smoke',action='store_true');p.add_argument('--resume',type=Path);p.add_argument('--memory-gib',type=float,default=4);p.add_argument('--wall-seconds',type=int,default=1800);a=p.parse_args()
 if a.output.exists():raise ValueError('Output exists; preserve prior evidence')
 if not 1<=a.iters<=1000 or not 2<=a.memory_gib<=6 or not 30<=a.wall_seconds<=3600:raise ValueError('Training resource bounds exceeded')
 provenance=verify_base(a.base,a.base_manifest);dataset=verify_dataset_curation(a.data)
 if a.resume:
  resume_config=json.loads((a.resume.parent/'adapter_config.json').read_text())
  if resume_config.get('sourceCorpusSha256')!=dataset['inputSha256']or resume_config.get('sourceAuditSha256')!=dataset['sourceCuration']['independentAuditSha256']:raise ValueError('Do not resume a superseded unaudited adapter')
 laws=dataset['lawGroups']
 if any(set(laws[x])&set(laws[y])for x,y in [('train','valid'),('train','test'),('valid','test')]):raise ValueError('Law leakage')
 for split in ['train','valid','test']:
  if digest(a.data/f'{split}.jsonl')!=dataset['files'][split]['sha256']:raise ValueError('Dataset hash mismatch')
 from transformers import AutoTokenizer
 tokenizer=AutoTokenizer.from_pretrained(str(a.base),local_files_only=True,trust_remote_code=False)
 selected={};selection={}
 for split,limit in [('train',max(a.iters,320)),('valid',4 if a.smoke else 12),('test',0 if a.smoke else 12)]:
  if not limit:continue
  selected[split],selection[split]=select_rows(a.data/f'{split}.jsonl',tokenizer,limit,a.seq_length)
  if len(selected[split])<2:raise ValueError('Too few complete sequences; no truncation permitted')
 a.output.mkdir(parents=True)
 for split,rows in selected.items():(a.output/f'effective-{split}.jsonl').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n'for r,_,_ in rows))
 config={'num_layers':1,'fine_tune_type':'lora','lora_parameters':{'rank':4,'scale':8.0,'dropout':0.0,'keys':['self_attn.q_proj','self_attn.v_proj']},'model':str(a.base.resolve()),'seed':SEED,'max_seq_length':a.seq_length,'learning_rate':1e-4,'batch_size':1,'frozenPrefixEvaluationMode':True,'sourceCorpusSha256':dataset['inputSha256'],'sourceAuditSha256':dataset['sourceCuration']['independentAuditSha256']}
 report={'status':'PREPARED_NOT_TRAINED','base':provenance,'datasetManifestSha256':digest(a.data/'manifest.json'),'scriptSha256':digest(__file__),'commonSha256':digest(Path(__file__).with_name('common.py')),'selection':selection,'config':config,'requestedSteps':a.iters,'smoke':a.smoke,'memoryLimitBytes':int(a.memory_gib*1024**3),'metrics':[],'baseWeightsModified':False,'defaultAppModelChanged':False,'semanticLegalValidation':False,'physical8GBValidation':False,'effectiveFiles':{s:digest(a.output/f'effective-{s}.jsonl')for s in selected},'installed':{name:importlib.metadata.version(name)for name in ['mlx','mlx-lm','transformers','safetensors']}}
 (a.output/'preparation.json').write_text(json.dumps(report,indent=2)+'\n');(a.output/'adapter_config.json').write_text(json.dumps(config,indent=2)+'\n')
 print(json.dumps({'status':report['status'],'selection':{s:{k:v for k,v in r.items()if k!='rejectedOverBudget'}for s,r in selection.items()}}),flush=True)
 if not a.run:return
 release=claim_locks();started=time.monotonic();limit=report['memoryLimitBytes'];report['status']='RUNNING';seen=[]
 monitor=ProgressMonitor(a.output,{'train':dataset['rowCounts']['train'],'validation':dataset['rowCounts']['valid'],'test':dataset['rowCounts']['test'],'laws':len(dataset['lawGroups']['train'])},a.iters,'smoke'if a.smoke else'bounded-pilot')
 def interrupted(signum,frame):raise KeyboardInterrupt('Training interrupted or wall limit exceeded')
 signal.signal(signal.SIGTERM,interrupted);signal.signal(signal.SIGALRM,interrupted);signal.alarm(a.wall_seconds)
 try:
  import mlx.core as mx,mlx.nn as nn,mlx.optimizers as opt
  from mlx.utils import tree_flatten
  from mlx_lm.utils import load
  from mlx_lm.tuner.utils import linear_to_lora_layers
  mx.random.seed(SEED);mx.set_memory_limit(limit);mx.set_wired_limit(min(limit,mx.device_info()['max_recommended_working_set_size']));mx.set_cache_limit(64*1024**2)
  model,model_tokenizer=load(str(a.base),tokenizer_config={'trust_remote_code':False},trust_remote_code=False)
  model.freeze();linear_to_lora_layers(model,1,config['lora_parameters']);model.eval()
  trainable=dict(tree_flatten(model.trainable_parameters()))
  if not trainable or any(not key.startswith('language_model.model.layers.23.self_attn.')or not key.endswith(('lora_a','lora_b'))for key in trainable):raise ValueError('Adapter ownership escaped final full-attention block')
  if a.resume:model.load_weights(str(a.resume),strict=False);report['resumedAdapterSha256']=digest(a.resume)
  mx.eval(model.parameters());report['trainableParameters']=sum(value.size for value in trainable.values())
  def loss(model,tokens,start):
   batch=mx.array([tokens],dtype=mx.int32);logits=model(batch[:,:-1]);targets=batch[:,1:];mask=mx.arange(1,len(tokens))[None,:]>=start;value=(nn.losses.cross_entropy(logits,targets)*mask).astype(mx.float32).sum()/mask.sum();return value
  def guard():
   if mx.get_peak_memory()>limit:raise RuntimeError('MLX allocation exceeded training limit')
   if time.monotonic()-started>a.wall_seconds:raise RuntimeError('Wall time limit exceeded')
  def evaluate():
   values={}
   for split in ['valid','test']:
    if split not in selected:continue
    each=[]
    for _,tokens,start in selected[split]:
     result=loss(model,tokens,start);mx.eval(result);guard();each.append(float(result.item()));mx.clear_cache()
    values[split]={'loss':sum(each)/len(each),'examples':len(each),'perExample':each}
   return values
  monitor.update(state='evaluating',message='Evaluación inicial con fuentes retenidas.');report['baseline']=evaluate();(a.output/'training-report.json').write_text(json.dumps(report,indent=2)+'\n');monitor.update(state='training',message='Entrenamiento local experimental en curso.')
  optimizer=opt.Adam(learning_rate=config['learning_rate']);gradient=nn.value_and_grad(model,loss)
  for step in range(1,a.iters+1):
   row,tokens,start=selected['train'][(step-1)%len(selected['train'])];began=time.monotonic();value,grads=gradient(model,tokens,start);optimizer.update(model,grads);mx.eval(model.trainable_parameters(),optimizer.state,value);guard();number=float(value.item())
   if not math.isfinite(number):raise RuntimeError('Nonfinite training loss')
   seen.append(row['metadata']);metric={'step':step,'loss':number,'sequenceTokens':len(tokens),'completionTokens':len(tokens)-start,'elapsedSeconds':time.monotonic()-began,'peakMlxBytes':mx.get_peak_memory()};report['metrics'].append(metric)
   monitor.update(state='training',progress={'step':step,'totalSteps':a.iters},metrics=metric)
   if step==1 or step%10==0 or step==a.iters:print(json.dumps(metric),flush=True)
   if step%20==0 or step==a.iters:
    mx.save_safetensors(str(a.output/f'{step:07d}_adapters.safetensors'),dict(tree_flatten(model.trainable_parameters())));(a.output/'progress.json').write_text(json.dumps({'status':'TRAINING','metrics':report['metrics']},indent=2)+'\n')
   mx.clear_cache()
  monitor.update(state='evaluating',message='Evaluación del candidato con fuentes retenidas.');report['candidate']=evaluate();mx.save_safetensors(str(a.output/'adapters.safetensors'),dict(tree_flatten(model.trainable_parameters())))
  report['trainedNonzeroBWeights']=sum(int(mx.sum(mx.abs(value)>0).item())for key,value in tree_flatten(model.trainable_parameters())if key.endswith('lora_b'))
  if not report['trainedNonzeroBWeights']:raise RuntimeError('Adapter did not update')
  report['adapterSha256']=digest(a.output/'adapters.safetensors');report['adapterConfigSha256']=digest(a.output/'adapter_config.json');report['status']='TRAINED_EXPERIMENTAL_NOT_PROMOTED'
 except BaseException as error:
  report['status']='FAILED';report['error']=f'{type(error).__name__}: {error}';raise
 finally:
  signal.alarm(0);report['durationSeconds']=time.monotonic()-started;report['completedSteps']=len(seen);report['trainedUniqueRows']=len({r['id']for r in seen});report['trainedUniquePublicSources']=len({r['sourceId']for r in seen if r.get('sourceId')});report['trainedLawIds']=sorted({r['lawId']for r in seen if r.get('lawId')});report['trainedTaskCounts']=dict(collections.Counter(r['task']for r in seen));report['trainedRows']=seen;report['peakProcessRssBytes']=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
  if 'mx'in locals():report['peakMlxAllocationBytes']=mx.get_peak_memory()
  report['baseWeightSha256After']=digest(a.base/'model.safetensors');report['baseWeightsModified']=report['baseWeightSha256After']!=provenance['weightSha256'];(a.output/'training-report.json').write_text(json.dumps(report,indent=2)+'\n');monitor.close(state='completed'if report['status']=='TRAINED_EXPERIMENTAL_NOT_PROMOTED'else'failed',releaseStatus='experimental'if report['status']=='TRAINED_EXPERIMENTAL_NOT_PROMOTED'else'rejected',message='Corrida experimental terminada; candidato sin activar.'if report['status']=='TRAINED_EXPERIMENTAL_NOT_PROMOTED'else'La corrida falló; se conservó la evidencia.',actualCompletedSteps=len(seen));release()
 print(json.dumps({k:report[k]for k in ['status','completedSteps','trainableParameters','adapterSha256','baseline','candidate','peakMlxAllocationBytes']}),flush=True)
if __name__=='__main__':main()
