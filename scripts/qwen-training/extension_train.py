"""Explicit new-source phase transition from a verified federal checkpoint.

Frozen base/final-block LoRA and Adam/RNG preserved; the source phase has its
own step count and immutable schedule. Never resumes the federal run from this
branch, and never promotes the result. Full mode covers every eligible row.
"""
import argparse,collections,hashlib,json,math,os,random,signal,time
from pathlib import Path
os.environ['HF_HUB_OFFLINE']='1';os.environ['TOKENIZERS_PARALLELISM']='false'
from common import ROOT,claim_locks,digest,verify_base,snapshot_scripts
from extension_curation import verify_extension_dataset
from curation import verify_curated_source
from full_pass import TokenRows
from monitor import ProgressMonitor
def extension_schedule(legal_count,corrective_count,seed=20261104):
 if legal_count<1 or corrective_count<1:raise ValueError('Both public laws and corrective dialogue are required')
 legal=list(range(legal_count));dialogue=list(range(corrective_count));random.Random(seed).shuffle(legal);random.Random(seed+1).shuffle(dialogue)
 order=[('corrective',i)for i in dialogue]
 for n,index in enumerate(legal):order.extend([('legal',index),('corrective',dialogue[n%len(dialogue)])])
 return order
def main():
 p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);p.add_argument('--parent-checkpoint',type=Path,required=True);p.add_argument('--data',type=Path,default=ROOT/'artifacts/training/qwen-state-corrective-dataset-v1');p.add_argument('--steps',type=int,default=0);p.add_argument('--resume-checkpoint',type=Path);p.add_argument('--previous-state-evaluation',type=Path);p.add_argument('--wall-seconds',type=int,default=21600);p.add_argument('--run',action='store_true');a=p.parse_args()
 if a.output.exists():raise ValueError('Preserve previous phase artifacts')
 if not 60<=a.wall_seconds<=43200:raise ValueError('Hard wall bound exceeded')
 manifest=verify_extension_dataset(a.data);federal=verify_curated_source();base=ROOT/'artifacts/training/qwen-base-2b-4bit';provenance=verify_base(base,ROOT/'artifacts/training/qwen-base-manifest.json');parent=json.loads((a.parent_checkpoint/'checkpoint.json').read_text())
 if parent['config'].get('sourceCorpusSha256')!=federal['corpusSha256']or parent['baseWeightSha256']!=provenance['weightSha256']or parent['config'].get('extensionDatasetSha256'):raise ValueError('Parent must be an uncontaminated federal checkpoint')
 for name,value in parent['files'].items():
  if digest(a.parent_checkpoint/name)!=value:raise ValueError('Parent checkpoint corrupted')
 legal=TokenRows(a.data/'train.jsonl');dialogue=TokenRows(a.data/'corrective.jsonl');schedule=extension_schedule(len(legal),len(dialogue));total=a.steps or len(schedule)
 if not 1<=total<=len(schedule):raise ValueError('Invalid bounded phase length')
 config={**parent['config'],'extensionDatasetSha256':digest(a.data/'manifest.json'),'extensionScheduleSha256':hashlib.sha256(json.dumps(schedule,separators=(',',':')).encode()).hexdigest(),'extensionObjective':'new audited public passages and fixed 1:1 corrective conversational rehearsal','extensionParentCheckpointSha256':digest(a.parent_checkpoint/'checkpoint.json')}
 a.output.mkdir(parents=True);snapshot_scripts(a.output);(a.output/'adapter_config.json').write_text(json.dumps(config,indent=2)+'\n')
 report={'status':'PREPARED_NOT_TRAINED','config':config,'sourceCuration':federal,'extensionCuration':manifest['extensionCuration'],'parentCheckpoint':str(a.parent_checkpoint),'parentFederalStep':parent['step'],'parentCheckpointSha256':digest(a.parent_checkpoint/'checkpoint.json'),'phase':'state-corrective-pilot'if total<len(schedule)else'state-corrective-full','scheduledSteps':len(schedule),'requestedSteps':total,'completedStep':0,'fullPassCompleted':False,'publicLawSteps':0,'correctiveSteps':0,'trainedPublicSources':[],'trainedLaws':[],'metrics':[],'base':provenance,'candidateActivated':False,'professionalLegalValidation':False,'physical8GBValidation':False}
 target=a.output/'training-report.json'
 def write():target.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 write()
 if not a.run:legal.close();dialogue.close();return
 release=claim_locks();began=time.monotonic();monitor=None;sources=set();laws=set();start=0
 def stop(signum,frame):raise KeyboardInterrupt('Bounded state phase interrupted; complete checkpoints preserved')
 signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGALRM,stop);signal.alarm(a.wall_seconds)
 try:
  monitor=ProgressMonitor(a.output,{'train':manifest['rowCounts']['train'],'validation':manifest['rowCounts']['valid'],'test':manifest['rowCounts']['test'],'laws':3},total,report['phase']);monitor.update(state='loading',phase=report['phase'],pilot=total<len(schedule),fullScheduleSteps=len(schedule),parentFederalStep=parent['step'],knownLimitations=['Diagnóstico federal: cero de nueve áreas superó todos los controles; falta de preguntas sobre hechos.','Corpus contextual/correctivo, sin validación jurídica ni activación.'])
  if a.previous_state_evaluation:
   prior=json.loads(a.previous_state_evaluation.read_text())
   if prior['extensionCuration']!=manifest['extensionCuration']:raise ValueError('Prior state evaluation came from different source curation')
   prior_state={'meaning':'historical state pilot on an earlier federal parent; not the current full-phase outcome','path':str(a.previous_state_evaluation),'reportSha256':digest(a.previous_state_evaluation),'status':prior['status'],'candidate':prior['arms']['candidateArm']['summary'],'releaseGate':prior['releaseGate']};report['priorStatePilotEvaluation']=prior_state;monitor.update(priorStatePilotEvaluation=prior_state,knownLimitations=['El piloto estatal mejoró algunas preguntas sobre hechos, pero empeoró respuestas sin evidencia y perdió una cita.','El informe final bloquea promoción si hay respuestas incompletas, pérdida de citas o cualquier fallo de aceptación.','El modelo anterior y el modelo predeterminado de la aplicación se conservan.'])
  import mlx.core as mx,mlx.nn as nn,mlx.optimizers as opt
  from mlx.utils import tree_flatten,tree_unflatten
  from mlx_lm.utils import load
  from mlx_lm.tuner.utils import linear_to_lora_layers
  limit=4*1024**3;mx.random.seed(config['seed']);mx.set_memory_limit(limit);mx.set_wired_limit(min(limit,mx.device_info()['max_recommended_working_set_size']));mx.set_cache_limit(64*1024**2)
  model,tokenizer=load(str(base),tokenizer_config={'trust_remote_code':False},trust_remote_code=False);model.freeze();linear_to_lora_layers(model,1,config['lora_parameters']);model.eval();optimizer=opt.Adam(learning_rate=config['learning_rate']);mx.eval(model.parameters())
  if any(not key.startswith('language_model.model.layers.23.self_attn.')or not key.endswith(('lora_a','lora_b'))for key,_ in tree_flatten(model.trainable_parameters())):raise ValueError('Trainable scope escaped')
  restore=a.resume_checkpoint or a.parent_checkpoint;state=json.loads((restore/'checkpoint.json').read_text())
  if a.resume_checkpoint and(state['config']!=config or state['parentCheckpointSha256']!=report['parentCheckpointSha256']):raise ValueError('Phase resume provenance changed')
  for name,value in state['files'].items():
   if digest(restore/name)!=value:raise ValueError('Restore checkpoint corrupt')
  model.load_weights(str(restore/'adapters.safetensors'),strict=False);optimizer.state=tree_unflatten(list(mx.load(str(restore/'optimizer.safetensors')).items()));saved=mx.load(str(restore/'random.safetensors'))['state'];mx.eval(saved,mx.random.state[0])
  if not bool(mx.array_equal(saved,mx.random.state[0]).item()):raise ValueError('Exact deterministic RNG reconstruction failed')
  report['optimizerRestored']=True;report['randomStateVerified']=True
  if a.resume_checkpoint:
   start=state['step'];sources=set(state['trainedSources']);laws=set(state['trainedLaws']);report['publicLawSteps']=state['publicLawSteps'];report['correctiveSteps']=state['correctiveSteps']
  if start>=total:raise ValueError('Resume must advance')
  def loss(model,tokens,offset):
   if len(tokens)>512:raise ValueError('No truncation permitted')
   batch=mx.array([tokens],dtype=mx.int32);logits=model(batch[:,:-1]);mask=mx.arange(1,len(tokens))[None,:]>=offset;return(nn.losses.cross_entropy(logits,batch[:,1:])*mask).astype(mx.float32).sum()/mask.sum()
  grad=nn.value_and_grad(model,loss)
  def checkpoint(step):
   dest=a.output/f'checkpoint-{step:07d}';dest.mkdir();mx.save_safetensors(str(dest/'adapters.safetensors'),dict(tree_flatten(model.trainable_parameters())));mx.save_safetensors(str(dest/'optimizer.safetensors'),dict(tree_flatten(optimizer.state)));mx.save_safetensors(str(dest/'random.safetensors'),{'state':mx.random.state[0]})
   saved={'step':step,'epochRows':len(legal),'scheduledSteps':len(schedule),'config':config,'parentCheckpointSha256':report['parentCheckpointSha256'],'baseWeightSha256':provenance['weightSha256'],'trainedSources':sorted(sources),'trainedLaws':sorted(laws),'publicLawSteps':report['publicLawSteps'],'correctiveSteps':report['correctiveSteps'],'files':{name:digest(dest/name)for name in ['adapters.safetensors','optimizer.safetensors','random.safetensors']}}
   (dest/'checkpoint.json').write_text(json.dumps(saved,indent=2)+'\n');(a.output/'latest-checkpoint.json').write_text(json.dumps({'path':str(dest),'step':step,'checkpointSha256':digest(dest/'checkpoint.json')},indent=2)+'\n');report['latestCheckpoint']=str(dest)
  report['status']='RUNNING'
  with(a.output/'row-trace.jsonl').open('w')as trace:
   for step in range(start+1,total+1):
    kind,index=schedule[step-1];row=(legal if kind=='legal'else dialogue)[index];before=time.monotonic();value,grads=grad(model,row['tokens'],row['start']);optimizer.update(model,grads);mx.eval(model.trainable_parameters(),optimizer.state,value);number=float(value.item())
    if not math.isfinite(number)or mx.get_peak_memory()>limit:raise RuntimeError('Loss/resource bound exceeded')
    meta=row['metadata'];report['publicLawSteps'if kind=='legal'else'correctiveSteps']+=1
    if kind=='legal':sources.add(meta['sourceId']);laws.add(meta['lawId'])
    metric={'step':step,'kind':kind,'loss':number,'elapsedSeconds':time.monotonic()-before,'peakMlxBytes':mx.get_peak_memory()};report['metrics'].append(metric);report['completedStep']=step;trace.write(json.dumps({'step':step,'kind':kind,**meta})+'\n');monitor.update(state='training',phase=report['phase'],progress={'step':step,'totalSteps':total},metrics=metric,trainedPublicSources=len(sources),publicLawSteps=report['publicLawSteps'],correctiveSteps=report['correctiveSteps'])
    if step==start+1 or step%10==0:print(json.dumps(metric),flush=True)
    if step%100==0 or step==total:trace.flush();checkpoint(step);write()
    mx.clear_cache()
  mx.save_safetensors(str(a.output/'adapters.safetensors'),dict(tree_flatten(model.trainable_parameters())));report['adapterSha256']=digest(a.output/'adapters.safetensors');report['status']='TRAINED_EXPERIMENTAL_NOT_PROMOTED';report['fullPassCompleted']=total==len(schedule)
 except BaseException as error:report['status']='INTERRUPTED_RESUMABLE'if report.get('latestCheckpoint')else'FAILED';report['error']=f'{type(error).__name__}: {error}';raise
 finally:
  signal.alarm(0);report['durationSeconds']=time.monotonic()-began;report['trainedPublicSources']=sorted(sources);report['trainedLaws']=sorted(laws);report['baseWeightsModified']=digest(base/'model.safetensors')!=provenance['weightSha256'];write();legal.close();dialogue.close()
  try:
   if monitor:monitor.close(state='evaluating'if report['status']=='TRAINED_EXPERIMENTAL_NOT_PROMOTED'else'failed',releaseStatus='experimental',phase='state-corrective-evaluation-pending',message='Ajuste estatal experimental; sin activar y con evaluación pendiente.')
  finally:release()
 print(json.dumps({k:report[k]for k in ['status','completedStep','publicLawSteps','correctiveSteps','fullPassCompleted']}),flush=True)
if __name__=='__main__':main()
