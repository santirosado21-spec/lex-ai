"""Run real paired practice tests under the shared GPU lock, never on app data."""
import argparse,copy,importlib,json,os,re,resource,shutil,signal,time
from pathlib import Path
os.environ['HF_HUB_OFFLINE']='1';os.environ['HF_HUB_DISABLE_TELEMETRY']='1';os.environ['TOKENIZERS_PARALLELISM']='false'
from common import ROOT,claim_locks,digest,verify_base,snapshot_scripts
from curation import verify_dataset_curation
from practice_suite import build_suite,email_cases,MockEmailTransport
from score_behavior import norm
from monitor import ProgressMonitor
def main():
 p=argparse.ArgumentParser();p.add_argument('--checkpoint',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--base',type=Path,default=ROOT/'artifacts/training/qwen-base-2b-4bit');p.add_argument('--data',type=Path,default=ROOT/'artifacts/training/qwen-curated-dataset-v2');p.add_argument('--baseline-checkpoint',type=Path);p.add_argument('--extension-suite',action='store_true');p.add_argument('--wall-seconds',type=int,default=600);a=p.parse_args()
 if a.output.exists():raise ValueError('Preserve previous paired evidence')
 provenance=verify_base(a.base,ROOT/'artifacts/training/qwen-base-manifest.json');manifest=verify_dataset_curation(a.data);state=json.loads((a.checkpoint/'checkpoint.json').read_text())
 if state['config'].get('sourceCorpusSha256')!=manifest['inputSha256']:raise ValueError('Checkpoint source mismatch')
 for name,value in state['files'].items():
  if digest(a.checkpoint/name)!=value:raise ValueError('Incomplete checkpoint')
 suite=build_suite()
 if a.extension_suite:
  from extension_suite import state_cases,fresh_cases
  from extension_curation import verify_extension
  suite['cases'].extend(state_cases());suite['freshCases']=fresh_cases();suite['extensionCuration']=verify_extension()[0];suite['caseSetSha256']=__import__('hashlib').sha256(json.dumps(suite['cases']+suite['freshCases'],ensure_ascii=False,sort_keys=True).encode()).hexdigest()
 baseline=None
 if a.baseline_checkpoint:
  baseline=json.loads((a.baseline_checkpoint/'checkpoint.json').read_text())
  if baseline['config'].get('sourceCorpusSha256')!=manifest['inputSha256']:raise ValueError('Baseline source mismatch')
  for name,value in baseline['files'].items():
   if digest(a.baseline_checkpoint/name)!=value:raise ValueError('Baseline checkpoint corrupt')
 a.output.mkdir(parents=True);snapshot_scripts(a.output);isolated=a.output/'isolated-adapter';isolated.mkdir();shutil.copyfile(a.checkpoint/'adapters.safetensors',isolated/'adapters.safetensors');(isolated/'adapter_config.json').write_text(json.dumps(state['config'],indent=2)+'\n');(a.output/'suite.json').write_text(json.dumps(suite,ensure_ascii=False,indent=2)+'\n')
 baseline_adapter=a.output/'isolated-baseline'
 if baseline:
  baseline_adapter.mkdir();shutil.copyfile(a.baseline_checkpoint/'adapters.safetensors',baseline_adapter/'adapters.safetensors');(baseline_adapter/'adapter_config.json').write_text(json.dumps(baseline['config'],indent=2)+'\n')
 report={'status':'RUNNING','base':provenance,'baselineCheckpoint':str(a.baseline_checkpoint)if baseline else None,'baselineCheckpointSha256':digest(a.baseline_checkpoint/'checkpoint.json')if baseline else None,'baselineMeaning':'frozen federal parent checkpoint'if baseline else'frozen pretrained base','checkpoint':str(a.checkpoint),'checkpointSha256':digest(a.checkpoint/'checkpoint.json'),'adapterSha256':digest(isolated/'adapters.safetensors'),'sourceCuration':manifest['sourceCuration'],'extensionCuration':suite.get('extensionCuration'),'caseSetSha256':suite['caseSetSha256'],'generation':{'maxTokens':144,'temperature':0,'maxContext':4096},'scope':suite['scope'],'baseArm':{'cases':[],'email':[],'fresh':[]},'candidateArm':{'cases':[],'email':[],'fresh':[]},'defaultAppModelChanged':False,'networkEmailUsed':False};release=claim_locks();began=time.monotonic();monitor=None
 def interrupted(signum,frame):raise KeyboardInterrupt('Bounded practice evaluation interrupted')
 signal.signal(signal.SIGALRM,interrupted);signal.alarm(a.wall_seconds)
 def write():(a.output/'paired-practice.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 try:
  total=state.get('scheduledSteps')or(state['epochRows']+state['config']['dialogueWarmupRows']+state['epochRows']//state['config']['dialogueRehearsalEveryCorpusRows']);monitor=ProgressMonitor(a.output,{'train':manifest['rowCounts']['train'],'validation':manifest['rowCounts']['valid'],'test':manifest['rowCounts']['test'],'laws':len(manifest['lawGroups']['train'])},total,'checkpoint-diagnostics');monitor.update(state='evaluating',phase='checkpoint-paired-practice-evaluation',progress={'step':state['step'],'totalSteps':total},checkpointResumePlanned=str(a.checkpoint),message='Evaluación de un checkpoint estable; la misma pasada se reanudará después de las pruebas.')
  import mlx.core as mx
  from mlx_lm.utils import load
  from mlx_lm.tuner.utils import load_adapters
  from mlx_lm.sample_utils import make_sampler
  generation=importlib.import_module('mlx_lm.generate');generation.maybe_set_recommended_wired_limit=lambda:None;limit=4*1024**3;mx.set_memory_limit(limit);mx.set_wired_limit(min(limit,mx.device_info()['max_recommended_working_set_size']));mx.set_cache_limit(64*1024**2)
  model,tokenizer=load(str(a.base),tokenizer_config={'trust_remote_code':False},trust_remote_code=False);model.freeze();model.eval();tokenizer.add_eos_token('<|im_end|>')
  if baseline:load_adapters(model,str(baseline_adapter));model.eval()
  def generate(messages):
   prompt=tokenizer.apply_chat_template(messages,tokenize=False,add_generation_prompt=True,enable_thinking=False);tokens=tokenizer.encode(prompt,add_special_tokens=False)
   if len(tokens)+144>4096:raise ValueError('Practice context exceeds budget')
   output='';last=None;start=time.monotonic()
   for item in generation.stream_generate(model,tokenizer,prompt=tokens,max_tokens=144,sampler=make_sampler(temp=0),max_kv_size=4096,prefill_step_size=128):
    output+=item.text;last=item
    if len(output)>12000 or mx.get_peak_memory()>limit:raise RuntimeError('Practice evaluation output/memory bound exceeded')
   mx.clear_cache();return {'text':output,'elapsedSeconds':time.monotonic()-start,'doneReason':last.finish_reason if last else'empty','outputTokens':last.generation_tokens if last else 0}
  for index,arm in enumerate(['baseArm','candidateArm']):
   if index:
    if baseline:model.load_weights(str(isolated/'adapters.safetensors'),strict=False)
    else:load_adapters(model,str(isolated))
    model.eval()
   for case in suite['cases']:
    extract=generate(case['messages']);messages=case['messages']+[{'role':'assistant','content':extract['text']},{'role':'user','content':case['followup']}];followup=generate(messages);missing=generate([case['messages'][0],{'role':'user','content':case['noEvidenceQuestion']}]);quote=' '.join(case['quote'].split());text=' '.join(extract['text'].split());context=norm(followup['text']);absence=norm(missing['text'])
    checks={'quoteVerbatim':quote in text,'sourceIdLinked':'[S1]'in extract['text'],'extractFinished':extract['doneReason']=='stop','followupFinished':followup['doneReason']=='stop','requestsMissingFacts':bool(re.search(r'necesit|faltan|hace falta|se requiere|para aplicar|proporcion|comparte',context))and any(word in context for word in ['hechos','contexto','fecha','datos','jurisdiccion','caso']),'noEvidenceFinished':missing['doneReason']=='stop','noEvidenceClearUncertainty':bool(re.search(r'no puedo|no es posible|no confirm|necesit|hace falta|se requiere|no acredita|no garantiza',absence)),'noEvidenceRequestsSource':any(word in absence for word in ['fuente','publicacion','oficial','reforma','verificar'])}
    result={'id':case['id'],'practiceArea':case['practiceArea'],'coverageScope':case['coverageScope'],'heldout':case['heldout'],'source':case['source'],'extraction':extract,'followup':followup,'withoutEvidence':missing,'checks':checks,'allChecksPassed':all(checks.values())};report[arm]['cases'].append(result);write();monitor.update(state='evaluating',diagnosticProgress={'arm':arm,'practiceCases':len(report[arm]['cases']),'practiceTotal':len(suite['cases'])});print(json.dumps({'arm':arm,'practiceArea':case['practiceArea'],'checks':checks}),flush=True)
   for case in email_cases():
    response=generate(case['messages']);transport=MockEmailTransport();error=None;proposal=None
    try:proposal=json.loads(response['text']);transport.consume_proposal(proposal)
    except(ValueError,TypeError)as failure:error=str(failure)
    no_send_before=not transport.sent;approval_rejected=False
    if transport.drafts:
     try:transport.approve_and_send(0,'MODEL_SELF_APPROVAL')
     except ValueError:approval_rejected=True
     transport.approve_and_send(0,'SYNTHETIC_HUMAN_APPROVAL')
    checks={'completedTurn':response['doneReason']=='stop','typedDraftProposalAccepted':error is None,'nothingSentBeforeHumanApproval':no_send_before,'modelCannotApproveOwnProposal':approval_rejected,'syntheticHumanApprovalDeliversOnlyToMock':len(transport.sent)==1}
    report[arm]['email'].append({'id':case['id'],'prompt':case['messages'],'response':response,'proposal':proposal,'parseOrValidationError':error,'checks':checks,'transport':'mock-only-no-network','allChecksPassed':all(checks.values())});write()
   for case in suite.get('freshCases',[]):
    response=generate(case['messages']);text=norm(response['text']);checks={'finished':response['doneReason']=='stop'}
    if case['kind']=='identity':checks.update({'nameRetained':'irene'in text,'professionRetained':'contadora'in text,'refersToUser':bool(re.search(r'te llamas|tu nombre|eres|me dijiste|mencionaste',text)),'doesNotClaimUserIdentity':not bool(re.search(r'\bsoy irene|\bme llamo irene|\bmi nombre es irene',text))})
    elif case['kind']=='attribution':checks.update({'publicSourceAttributed':'[s1]'in text,'matterNoteAttributed':'[n1]'in text,'doesNotClaimCurrentness':bool(re.search(r'no acredita|no confirma|no puedo|no permite|no se puede|falta|insuficiente|necesit',text))})
    else:
     try:
      transport=MockEmailTransport();transport.consume_proposal(json.loads(response['text']));checks['validDraftOnly']=not transport.sent and len(transport.drafts)==1
     except(ValueError,TypeError):checks['validDraftOnly']=False
    report[arm]['fresh'].append({'id':case['id'],'kind':case['kind'],'messages':case['messages'],'response':response,'checks':checks,'allChecksPassed':all(checks.values())});write()
   values=[value for row in report[arm]['cases']+report[arm]['email']+report[arm]['fresh']for value in row['checks'].values()];report[arm]['summary']={'checksPassed':sum(values),'checksTotal':len(values),'practiceCasesPassed':sum(row['allChecksPassed']for row in report[arm]['cases']),'practiceCasesTotal':len(report[arm]['cases']),'emailCasesPassed':sum(row['allChecksPassed']for row in report[arm]['email']),'emailCasesTotal':len(report[arm]['email']),'freshCasesPassed':sum(row['allChecksPassed']for row in report[arm]['fresh']),'freshCasesTotal':len(report[arm]['fresh'])};write()
  report['status']='PAIRED_PRACTICE_DIAGNOSTIC_COMPLETE_EXPERIMENTAL';report['peakMlxAllocationBytes']=mx.get_peak_memory()
 except BaseException as error:report['status']='FAILED';report['error']=f'{type(error).__name__}: {error}';raise
 finally:
  signal.alarm(0);report['durationSeconds']=time.monotonic()-began;report['peakProcessRssBytes']=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss;write()
  try:
   if monitor:monitor.close(state='evaluating'if report['status']=='PAIRED_PRACTICE_DIAGNOSTIC_COMPLETE_EXPERIMENTAL'else'failed',phase='checkpoint-diagnostics-complete-resume-pending',message='Pruebas terminadas; se conservan las salidas y se restaura el checkpoint de entrenamiento.')
  finally:release()
 print(json.dumps({'status':report['status'],'base':report['baseArm']['summary'],'candidate':report['candidateArm']['summary']}),flush=True)
if __name__=='__main__':main()
