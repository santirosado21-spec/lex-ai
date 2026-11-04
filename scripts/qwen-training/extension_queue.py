"""Detached, bounded state-law continuation queued behind the exact federal job.

Waiting owns no GPU lock and never interrupts another process. It requires the
federal full-pass + evaluation to finish, then trains one complete new-source
phase and compares the same frozen parent to the new candidate. No activation.
"""
import argparse,json,os,subprocess,sys,time
from pathlib import Path
from common import ROOT,digest,snapshot_scripts
from extension_curation import verify_extension_dataset
from curation import verify_curated_source
from monitor import ProgressMonitor
def main():
 p=argparse.ArgumentParser();p.add_argument('--wait-for-pipeline',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--data',type=Path,default=ROOT/'artifacts/training/qwen-state-corrective-dataset-v1');p.add_argument('--pilot-evaluation',type=Path,default=ROOT/'artifacts/training/qwen-state-corrective-pilot-400-evaluation-v1/paired-practice-score-v2.json');p.add_argument('--worker',action='store_true');a=p.parse_args();a.output=a.output.resolve();a.wait_for_pipeline=a.wait_for_pipeline.resolve();a.data=a.data.resolve();a.pilot_evaluation=a.pilot_evaluation.resolve();manifest=verify_extension_dataset(a.data);dataset_sha=digest(a.data/'manifest.json');pilot=json.loads(a.pilot_evaluation.read_text())
 if pilot['extensionCuration']!=manifest['extensionCuration']:raise ValueError('Pilot evaluation does not match queued source')
 if not a.worker:
  if a.output.exists():raise ValueError('Preserve previous queue')
  if not(a.wait_for_pipeline/'launch.json').is_file():raise ValueError('Queue requires an existing exact federal launch')
  a.output.mkdir(parents=True);snapshot_scripts(a.output);script=a.output/'reproduction-scripts/extension_queue.py';command=[sys.executable,str(script),'--wait-for-pipeline',str(a.wait_for_pipeline),'--output',str(a.output),'--data',str(a.data),'--pilot-evaluation',str(a.pilot_evaluation),'--worker'];env={**os.environ,'LEX_PROJECT_ROOT':str(ROOT)}
  with(a.output/'queue.log').open('xb')as log:child=subprocess.Popen(command,cwd=ROOT,env=env,stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
  record={'status':'QUEUED_NOT_TRAINED','pid':child.pid,'command':command,'log':str(a.output/'queue.log'),'waitForPipeline':str(a.wait_for_pipeline),'federalLaunchSha256':digest(a.wait_for_pipeline/'launch.json'),'extensionDatasetManifestSha256':dataset_sha,'extensionCuration':manifest['extensionCuration'],'candidateActivated':False,'completionNotificationConfigured':False,'createdAt':time.time()};(a.output/'launch.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record));return
 report={'status':'WAITING_FOR_FEDERAL_FULL_PASS','pid':os.getpid(),'waitForPipeline':str(a.wait_for_pipeline),'extensionDatasetManifestSha256':dataset_sha,'priorStatePilotEvaluation':{'path':str(a.pilot_evaluation),'sha256':digest(a.pilot_evaluation),'candidate':pilot['arms']['candidateArm']['summary'],'releaseGate':pilot['releaseGate']},'startedAt':time.time(),'stages':[],'candidateActivated':False,'gpuLockHeldWhileWaiting':False,'professionalLegalValidation':False,'completionNotificationConfigured':False};file=a.output/'queue-report.json';started=time.monotonic();scripts=a.output/'reproduction-scripts';power=None
 def write():report['updatedAt']=time.time();file.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 try:
  write()
  while True:
   if time.monotonic()-started>16*3600:raise TimeoutError('Bounded queue wait expired; no process interrupted')
   status_file=a.wait_for_pipeline/'pipeline-report.json'
   if status_file.exists():
    try:status=json.loads(status_file.read_text())
    except json.JSONDecodeError:time.sleep(.2);continue
    if status['status']=='FULL_PASS_AND_PAIRED_EVAL_COMPLETE_EXPERIMENTAL':break
    if status['status']!='RUNNING':raise ValueError('Federal job did not complete. Preserve queue and explicitly requeue against its authorized continuation.')
    # Verify the owner still exists; never infer completion from a stale file.
    try:os.kill(status['pid'],0)
    except ProcessLookupError:raise RuntimeError('Federal supervisor exited without complete status')
    report['federalPhase']=status.get('phase');report['federalSupervisorPid']=status['pid'];write()
   time.sleep(20)
  training=json.loads((a.wait_for_pipeline/'training/training-report.json').read_text());federal=verify_curated_source()
  if not training['fullPassCompleted']or training['status']!='TRAINED_EXPERIMENTAL_NOT_PROMOTED'or training['sourceCuration']!=federal or training['completedStep']!=training['scheduledSteps']:raise ValueError('Federal completion/source gate failed')
  if digest(a.data/'manifest.json')!=dataset_sha:raise ValueError('Queued dataset identity changed')
  verify_extension_dataset(a.data);checkpoint=Path(training['latestCheckpoint']);state=json.loads((checkpoint/'checkpoint.json').read_text())
  if state['step']!=training['completedStep']or state['config'].get('extensionDatasetSha256'):raise ValueError('Parent is not the verified final federal checkpoint')
  for name,value in state['files'].items():
   if digest(checkpoint/name)!=value:raise ValueError('Federal parent checkpoint corrupt')
  report.update({'status':'RUNNING_STATE_CONTINUATION','parentCheckpoint':str(checkpoint),'parentCheckpointSha256':digest(checkpoint/'checkpoint.json'),'federalEvaluation':status.get('behaviorStatus'),'semanticReleaseGate':'Experimental only regardless of loss or diagnostic scores; no promotion'})
  if Path('/usr/bin/caffeinate').is_file():power=subprocess.Popen(['/usr/bin/caffeinate','-i','-w',str(os.getpid())],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);report['caffeinatePid']=power.pid
  environment={**os.environ,'LEX_PROJECT_ROOT':str(ROOT)}
  stages=[('state-training',[sys.executable,str(scripts/'extension_train.py'),'--output',str(a.output/'training'),'--data',str(a.data),'--parent-checkpoint',str(checkpoint),'--previous-state-evaluation',str(a.pilot_evaluation),'--wall-seconds','21600','--run']),('paired-state-practice-evaluation',[sys.executable,str(scripts/'practice_evaluate.py'),'--checkpoint','RESOLVED_FROM_COMPLETED_PHASE','--baseline-checkpoint',str(checkpoint),'--output',str(a.output/'evaluation'),'--extension-suite']),('posthoc-strict-scoring',[sys.executable,str(scripts/'practice_score.py'),'--evaluation',str(a.output/'evaluation/paired-practice.json')])]
  for name,command in stages:
   # Evaluation checkpoint follows the real schedule, never a hardcoded estimate.
   if name=='paired-state-practice-evaluation':
    trained=json.loads((a.output/'training/training-report.json').read_text())
    if not trained['fullPassCompleted']:raise ValueError('New-source full phase incomplete; preserve latest resumable checkpoint')
    command[command.index('--checkpoint')+1]=trained['latestCheckpoint']
   report['phase']=name;write();child=subprocess.Popen(command,cwd=ROOT,env=environment);report['childPid']=child.pid;write();code=child.wait();report['stages'].append({'name':name,'exitCode':code,'finishedAt':time.time()});write()
   if code:raise RuntimeError(name+' failed; checkpoint and failure retained')
  evaluated=json.loads((a.output/'evaluation/paired-practice.json').read_text());strict=json.loads((a.output/'evaluation/paired-practice-score-v2.json').read_text());report.update({'status':'STATE_FULL_PHASE_AND_PAIRED_EVAL_COMPLETE_EXPERIMENTAL','candidateSummary':evaluated['candidateArm']['summary'],'baselineSummary':evaluated['baseArm']['summary'],'strictCandidateSummary':strict['arms']['candidateArm']['summary'],'strictBaselineSummary':strict['arms']['baseArm']['summary'],'releaseGate':strict['releaseGate'],'evaluatedReportSha256':digest(a.output/'evaluation/paired-practice.json')})
  monitor=ProgressMonitor(a.output,{'train':manifest['rowCounts']['train'],'validation':manifest['rowCounts']['valid'],'test':manifest['rowCounts']['test'],'laws':3},trained['scheduledSteps'],'completed-state-corrective-phase');summary=strict['arms']['candidateArm']['summary'];monitor.close(state='completed',releaseStatus='experimental'if summary['checksPassed']==summary['checksTotal']and not strict['releaseGate']['measuredRegression']else'rejected',phase='state-phase-and-paired-evaluation-complete',progress={'step':trained['completedStep'],'totalSteps':trained['scheduledSteps']},fullPassCompleted=True,trainedPublicSources=len(trained['trainedPublicSources']),releaseGate=strict['releaseGate'],lastPracticeEvaluation={'status':strict['status'],'candidate':summary,'baseline':strict['arms']['baseArm']['summary'],'reportSha256':report['evaluatedReportSha256']},message='Pasada estatal y evaluación terminadas; candidato experimental sin activar ni validación jurídica.')
 except BaseException as error:report['status']='FAILED_OR_INCOMPLETE_NOT_PROMOTED';report['error']=f'{type(error).__name__}: {error}';raise
 finally:report['finishedAt']=time.time();write()
if __name__=='__main__':main()
