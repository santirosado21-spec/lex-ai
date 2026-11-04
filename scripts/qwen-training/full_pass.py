"""One auditable full pass, exact row ordering, optimizer checkpoints, no auto-promotion.

Requires an all-rows token audit PASS and explicit --run plus the shared GPU lock.
--steps bounds an initial segment honestly; --resume-checkpoint restores Adam,
adapter and random state before continuing the same immutable shuffled epoch.
"""
import argparse,array,collections,json,math,os,random,resource,signal,time
from pathlib import Path
os.environ['HF_HUB_OFFLINE']='1';os.environ['HF_HUB_DISABLE_TELEMETRY']='1';os.environ['TOKENIZERS_PARALLELISM']='false'
from common import ROOT,claim_locks,digest,verify_base,build_schedule,snapshot_scripts
from curation import verify_dataset_curation
from monitor import ProgressMonitor
SEED=20261103
class TokenRows:
 def __init__(self,path):
  self.path=path;self.offsets=array.array('Q');self.synthetic_indices=[]
  with path.open('rb')as stream:
   while True:
    offset=stream.tell();line=stream.readline()
    if not line:break
    if b'"synthetic":true'in line and json.loads(line)['metadata'].get('synthetic'):self.synthetic_indices.append(len(self.offsets))
    self.offsets.append(offset)
  self.stream=path.open('rb')
 def __len__(self):return len(self.offsets)
 def __getitem__(self,index):
  self.stream.seek(self.offsets[index]);return json.loads(self.stream.readline())
 def close(self):self.stream.close()
def main():
 p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);p.add_argument('--tokens',type=Path,default=ROOT/'artifacts/training/qwen-curated-tokenized-v1');p.add_argument('--data',type=Path,default=ROOT/'artifacts/training/qwen-curated-dataset-v2');p.add_argument('--base',type=Path,default=ROOT/'artifacts/training/qwen-base-2b-4bit');p.add_argument('--base-manifest',type=Path,default=ROOT/'artifacts/training/qwen-base-manifest.json');p.add_argument('--resume-checkpoint',type=Path);p.add_argument('--steps',type=int,default=0);p.add_argument('--checkpoint-every',type=int,default=100);p.add_argument('--memory-gib',type=float,default=4);p.add_argument('--wall-seconds',type=int,default=43200);p.add_argument('--previous-evaluation',type=Path);p.add_argument('--practice-evaluation',type=Path);p.add_argument('--run',action='store_true');a=p.parse_args()
 if a.output.exists():raise ValueError('Choose a new output; preserve all previous checkpoints')
 if not 2<=a.memory_gib<=6 or not 60<=a.wall_seconds<=172800 or not 1<=a.checkpoint_every<=1000:raise ValueError('Resource bounds exceeded')
 provenance=verify_base(a.base,a.base_manifest);audit=json.loads((a.tokens/'manifest.json').read_text());dataset=verify_dataset_curation(a.data)
 if digest(a.data/'manifest.json')!=audit['inputManifestSha256']:raise ValueError('Source dataset provenance changed')
 if audit['status']!='PASS_ALL_ROWS_FIT'or audit['truncatedRows']or audit['maxLength']>512:raise ValueError('A complete, untruncated token audit is required')
 for split in ['train','valid','test']:
  if digest(a.tokens/f'{split}.jsonl')!=audit['splits'][split]['sha256']:raise ValueError('Token file changed')
 rows=TokenRows(a.tokens/'train.jsonl');schedule=build_schedule(len(rows),rows.synthetic_indices,SEED);total=len(schedule)if not a.steps else a.steps
 if not 1<=total<=len(schedule):raise ValueError('Steps must be within this single epoch and its documented rehearsal')
 a.output.mkdir(parents=True);snapshot_scripts(a.output);config={'num_layers':1,'fine_tune_type':'lora','lora_parameters':{'rank':4,'scale':8.0,'dropout':0.0,'keys':['self_attn.q_proj','self_attn.v_proj']},'model':str(a.base.resolve()),'seed':SEED,'learning_rate':1e-4,'batch_size':1,'max_seq_length':512,'frozenPrefixEvaluationMode':True,'sourceCorpusSha256':dataset['inputSha256'],'sourceAuditSha256':dataset['sourceCuration']['independentAuditSha256'],'dialogueWarmupRows':len(rows.synthetic_indices),'dialogueRehearsalEveryCorpusRows':16,'scheduleSha256':__import__('hashlib').sha256(json.dumps(schedule,separators=(',',':')).encode()).hexdigest()}
 (a.output/'adapter_config.json').write_text(json.dumps(config,indent=2)+'\n')
 report={'status':'PREPARED_NOT_TRAINED','base':provenance,'tokenManifestSha256':digest(a.tokens/'manifest.json'),'trainTokenFileSha256':audit['splits']['train']['sha256'],'scriptSha256':digest(__file__),'config':config,'sourceCuration':dataset['sourceCuration'],'epochRows':len(rows),'scheduledSteps':len(schedule),'requestedFinalStep':total,'completedStep':0,'fullPassCompleted':False,'baseWeightsModified':False,'defaultAppModelChanged':False,'semanticLegalValidation':False,'physical8GBValidation':False,'memoryLimitBytes':int(a.memory_gib*1024**3),'metrics':[]}
 (a.output/'preparation.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:report[k]for k in ['status','epochRows','requestedFinalStep']}),flush=True)
 if not a.run:rows.close();return
 release=claim_locks();started=time.monotonic();limit=report['memoryLimitBytes'];report['status']='RUNNING';trained_sources=set();trained_laws=set();tasks=collections.Counter();phase_counts=collections.Counter();begin=0;monitor=None
 def stop(signum,frame):raise KeyboardInterrupt('Bounded training interrupted; resume the latest complete checkpoint')
 signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGALRM,stop);signal.alarm(a.wall_seconds)
 try:
  monitor=ProgressMonitor(a.output,{'train':dataset['rowCounts']['train'],'validation':dataset['rowCounts']['valid'],'test':dataset['rowCounts']['test'],'laws':len(dataset['lawGroups']['train'])},total,'full-epoch'if total==len(schedule)else'full-epoch-prefix')
  monitor.update(phase='pilot-loading'if total<len(schedule)else'full-loading',pilot=total<len(schedule),fullScheduleSteps=len(schedule),epochRows=len(rows),trainedPublicSources=0,trainedCorpusRows=0)
  if a.previous_evaluation:
   prior=json.loads(a.previous_evaluation.read_text())
   if prior.get('sourceCuration')!=dataset['sourceCuration']:raise ValueError('Previous evaluation source curation differs; never carry superseded quality metrics')
   candidate=prior['arms']['candidateArm'];last={'status':prior['status'],'checksPassed':candidate['checksPassed'],'checksTotal':candidate['checksTotal'],'casesPassed':candidate['casesPassed'],'casesTotal':candidate['casesTotal'],'failedCases':[r['id']for r in candidate['cases']if not r['allChecksPassed']],'reportSha256':digest(a.previous_evaluation),'path':str(a.previous_evaluation)};report['lastEvaluation']=last;monitor.update(lastEvaluation=last,knownLimitations=['El objetivo legal enseña copia contextual y formato; no demuestra razonamiento jurídico.','El piloto conserva los fallos observados y registrados, sin ocultarlos con la pérdida.','El candidato permanece experimental e inactivo.'])
  if a.practice_evaluation:
   practice=json.loads(a.practice_evaluation.read_text())
   if practice.get('sourceCuration')!=dataset['sourceCuration']:raise ValueError('Practice evaluation source curation differs')
   diagnostic={'status':practice['status'],'base':practice['baseArm'].get('summary'),'candidate':practice['candidateArm'].get('summary'),'failedPracticeCases':[r['id']for r in practice['candidateArm']['cases']if not r['allChecksPassed']],'reportSha256':digest(a.practice_evaluation),'path':str(a.practice_evaluation)};report['lastPracticeEvaluation']=diagnostic;monitor.update(lastPracticeEvaluation=diagnostic)
  import mlx.core as mx,mlx.nn as nn,mlx.optimizers as opt
  from mlx.utils import tree_flatten,tree_unflatten
  from mlx_lm.utils import load
  from mlx_lm.tuner.utils import linear_to_lora_layers
  mx.random.seed(SEED);mx.set_memory_limit(limit);mx.set_wired_limit(min(limit,mx.device_info()['max_recommended_working_set_size']));mx.set_cache_limit(64*1024**2)
  model,tokenizer=load(str(a.base),tokenizer_config={'trust_remote_code':False},trust_remote_code=False);model.freeze();linear_to_lora_layers(model,1,config['lora_parameters']);model.eval();optimizer=opt.Adam(learning_rate=config['learning_rate'])
  trainable=dict(tree_flatten(model.trainable_parameters()))
  if not trainable or any(not key.startswith('language_model.model.layers.23.self_attn.')or not key.endswith(('lora_a','lora_b'))for key in trainable):raise ValueError('Adapter scope escaped the final full-attention block')
  mx.eval(model.parameters());report['trainableParameters']=sum(value.size for value in trainable.values())
  if a.resume_checkpoint:
   checkpoint=json.loads((a.resume_checkpoint/'checkpoint.json').read_text())
   if checkpoint['trainTokenFileSha256']!=report['trainTokenFileSha256']or checkpoint['baseWeightSha256']!=provenance['weightSha256']or checkpoint['config']!=config:raise ValueError('Resume provenance/config mismatch')
   for name,value in checkpoint['files'].items():
    if digest(a.resume_checkpoint/name)!=value:raise ValueError('Incomplete/corrupt checkpoint')
   model.load_weights(str(a.resume_checkpoint/'adapters.safetensors'),strict=False);optimizer.state=tree_unflatten(list(mx.load(str(a.resume_checkpoint/'optimizer.safetensors')).items()));saved_random=mx.load(str(a.resume_checkpoint/'random.safetensors'))['state'];mx.eval(saved_random,mx.random.state[0]);
   if not bool(mx.array_equal(saved_random,mx.random.state[0]).item()):raise ValueError('Deterministic no-dropout RNG reconstruction mismatch')
   report['randomResume']='identical seeded state verified; eval/no-dropout updates consume no randomness';begin=checkpoint['step'];report['resumedFrom']=str(a.resume_checkpoint);report['completedStep']=begin
   trained_sources=set(checkpoint['trainedSources']);trained_laws=set(checkpoint['trainedLaws']);tasks.update(checkpoint['taskCounts']);phase_counts.update(checkpoint.get('phaseCounts',{}));monitor.update(progress={'step':begin,'totalSteps':total})
  if begin>=total:raise ValueError('Requested final step must exceed resume step')
  def loss(model,tokens,start):
   if len(tokens)>512:raise ValueError('Do not truncate an over-budget row')
   batch=mx.array([tokens],dtype=mx.int32);logits=model(batch[:,:-1]);targets=batch[:,1:];mask=mx.arange(1,len(tokens))[None,:]>=start;return(nn.losses.cross_entropy(logits,targets)*mask).astype(mx.float32).sum()/mask.sum()
  grad=nn.value_and_grad(model,loss)
  def checkpoint(step):
   destination=a.output/f'checkpoint-{step:07d}';destination.mkdir()
   mx.save_safetensors(str(destination/'adapters.safetensors'),dict(tree_flatten(model.trainable_parameters())));mx.save_safetensors(str(destination/'optimizer.safetensors'),dict(tree_flatten(optimizer.state)));mx.save_safetensors(str(destination/'random.safetensors'),{'state':mx.random.state[0]})
   state={'step':step,'epochRows':len(rows),'config':config,'trainTokenFileSha256':report['trainTokenFileSha256'],'baseWeightSha256':provenance['weightSha256'],'trainedSources':sorted(trained_sources),'trainedLaws':sorted(trained_laws),'taskCounts':dict(tasks),'phaseCounts':dict(phase_counts),'files':{name:digest(destination/name)for name in ['adapters.safetensors','optimizer.safetensors','random.safetensors']}}
   (destination/'checkpoint.json').write_text(json.dumps(state,indent=2)+'\n');(a.output/'latest-checkpoint.json').write_text(json.dumps({'path':str(destination),'step':step,'checkpointSha256':digest(destination/'checkpoint.json')},indent=2)+'\n');report['latestCheckpoint']=str(destination)
  with(a.output/'row-trace.jsonl').open('w')as trace:
   for step in range(begin+1,total+1):
    index,phase=schedule[step-1];row=rows[index];began=time.monotonic();value,grads=grad(model,row['tokens'],row['start']);optimizer.update(model,grads);mx.eval(model.trainable_parameters(),optimizer.state,value);number=float(value.item())
    if not math.isfinite(number)or mx.get_peak_memory()>limit:raise RuntimeError('Nonfinite loss or MLX memory bound exceeded')
    meta=row['metadata'];trained_sources.add(meta['sourceId'])if meta.get('sourceId')else None;trained_laws.add(meta['lawId'])if meta.get('lawId')else None;tasks[meta['task']]+=1;phase_counts[phase]+=1
    metric={'step':step,'phase':phase,'loss':number,'tokens':len(row['tokens']),'elapsedSeconds':time.monotonic()-began,'peakMlxBytes':mx.get_peak_memory()};report['metrics'].append(metric);report['completedStep']=step;trace.write(json.dumps({'step':step,'phase':phase,'id':meta['id'],'lawId':meta.get('lawId'),'sourceId':meta.get('sourceId'),'task':meta['task']})+'\n');monitor.update(state='training',phase='pilot-training'if total<len(schedule)else'full-training',progress={'step':step,'totalSteps':total},metrics=metric,fullEpochRows=len(rows),fullScheduleSteps=len(schedule),trainedPublicSources=len(trained_sources),trainedCorpusRows=phase_counts['corpus-epoch'],message='Piloto experimental; no representa el corpus completo.'if total<len(schedule)else'Entrenamiento local de todo el corpus elegible; las fuentes retenidas no ajustan pesos.')
    if step==begin+1 or step%10==0:print(json.dumps(metric),flush=True)
    if step%a.checkpoint_every==0 or step==total:trace.flush();checkpoint(step);(a.output/'training-report.json').write_text(json.dumps(report,indent=2)+'\n')
    mx.clear_cache()
  mx.save_safetensors(str(a.output/'adapters.safetensors'),dict(tree_flatten(model.trainable_parameters())));report['adapterSha256']=digest(a.output/'adapters.safetensors');report['fullPassCompleted']=total==len(schedule);report['status']='TRAINED_EXPERIMENTAL_NOT_PROMOTED'
 except BaseException as error:report['status']='INTERRUPTED_RESUMABLE'if report.get('latestCheckpoint')else'FAILED';report['error']=f'{type(error).__name__}: {error}';raise
 finally:
  signal.alarm(0);rows.close();report['durationSeconds']=time.monotonic()-started;report['trainedUniquePublicSources']=len(trained_sources);report['trainedLaws']=sorted(trained_laws);report['taskCounts']=dict(tasks);report['phaseCounts']=dict(phase_counts);report['peakProcessRssBytes']=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
  if'mx'in locals():report['peakMlxAllocationBytes']=mx.get_peak_memory()
  report['baseWeightSha256After']=digest(a.base/'model.safetensors');report['baseWeightsModified']=report['baseWeightSha256After']!=provenance['weightSha256'];(a.output/'training-report.json').write_text(json.dumps(report,indent=2)+'\n')
  try:
   if monitor:monitor.close(state='evaluating'if report['status']=='TRAINED_EXPERIMENTAL_NOT_PROMOTED'else'failed',phase='training-complete-evaluation-pending'if report['status']=='TRAINED_EXPERIMENTAL_NOT_PROMOTED'else'training-failed',releaseStatus='experimental'if report['status']=='TRAINED_EXPERIMENTAL_NOT_PROMOTED'else'rejected',message='Segmento experimental terminado; evaluación pendiente y candidato sin activar.'if report['status']=='TRAINED_EXPERIMENTAL_NOT_PROMOTED'else'Corrida interrumpida; se conservó el último checkpoint completo.',actualCompletedSteps=report['completedStep'],fullPassCompleted=report['fullPassCompleted'])
  finally:release()
 print(json.dumps({k:report[k]for k in ['status','completedStep','fullPassCompleted','trainedUniquePublicSources','adapterSha256']}),flush=True)
if __name__=='__main__':main()
