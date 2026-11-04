"""Detach our own full-pass pipeline and record its PID/log; never touch app data.

Continuation restores the pilot's exact adapter+Adam+verified deterministic RNG.
After the full pass, run the same paired evaluation; never activate a candidate.
"""
import argparse,json,os,subprocess,sys,time
from pathlib import Path
from common import ROOT,digest,snapshot_scripts
from curation import verify_curated_source
from monitor import ProgressMonitor,MONITOR
def main():
 p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);p.add_argument('--resume-checkpoint',type=Path,required=True);p.add_argument('--previous-evaluation',type=Path,required=True);p.add_argument('--practice-evaluation',type=Path);p.add_argument('--worker',action='store_true');a=p.parse_args();a.output=a.output.resolve();a.resume_checkpoint=a.resume_checkpoint.resolve();a.previous_evaluation=a.previous_evaluation.resolve()
 checkpoint=a.resume_checkpoint/'checkpoint.json'
 if not checkpoint.is_file():raise ValueError('A complete checkpoint is required')
 curation=verify_curated_source();state=json.loads(checkpoint.read_text());previous=json.loads(a.previous_evaluation.read_text())
 if state['config'].get('sourceCorpusSha256')!=curation['corpusSha256']or previous.get('sourceCuration')!=curation:raise ValueError('Do not reuse an adapter, optimizer or evaluation from the superseded unaudited input')
 if not a.worker:
  if a.output.exists():raise ValueError('Preserve previous detached runs')
  a.output.mkdir(parents=True);snapshot_scripts(a.output)
  command=[sys.executable,str(Path(__file__).resolve()),'--output',str(a.output),'--resume-checkpoint',str(a.resume_checkpoint),'--previous-evaluation',str(a.previous_evaluation),'--worker']
  if a.practice_evaluation:command.extend(['--practice-evaluation',str(a.practice_evaluation.resolve())])
  with(a.output/'pipeline.log').open('xb')as log:
   child=subprocess.Popen(command,cwd=ROOT,stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
  power=None
  if Path('/usr/bin/caffeinate').is_file():power=subprocess.Popen(['/usr/bin/caffeinate','-i','-w',str(child.pid)],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
  report={'status':'STARTED_DETACHED','sourceCuration':curation,'pid':child.pid,'parentPid':os.getpid(),'caffeinatePid':power.pid if power else None,'powerAssertion':'idle-system-sleep-only-until-supervisor-exit'if power else'not-installed','powerLimitations':'Does not prevent lid/manual sleep, shutdown, reboot, power loss or process termination; resume a complete checkpoint.','startedAt':time.time(),'command':command,'log':str(a.output/'pipeline.log'),'resumeCheckpointSha256':digest(checkpoint),'scriptSha256':digest(__file__),'candidateActivated':False,'completionNotificationConfigured':False};(a.output/'launch.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report));return
 report={'status':'RUNNING','sourceCuration':curation,'pid':os.getpid(),'startedAt':time.time(),'stages':[],'candidateActivated':False,'completionNotificationConfigured':False}
 target=a.output/'pipeline-report.json'
 scripts=a.output/'reproduction-scripts';environment={**os.environ,'LEX_PROJECT_ROOT':str(ROOT)}
 prior=a.previous_evaluation
 stages=[('training',[sys.executable,str(scripts/'full_pass.py'),'--output',str(a.output/'training'),'--resume-checkpoint',str(a.resume_checkpoint),'--checkpoint-every','500','--wall-seconds','43200','--previous-evaluation',str(prior),'--run']),('evaluation',[sys.executable,str(scripts/'evaluate.py'),'--adapter',str(a.output/'training'),'--output',str(a.output/'evaluation')]),('posthoc-scoring',[sys.executable,str(scripts/'score_behavior.py'),'--evaluation',str(a.output/'evaluation/paired-evaluation.json')])]
 if a.practice_evaluation:stages[0][1].extend(['--practice-evaluation',str(a.practice_evaluation.resolve())])
 try:
  for name,command in stages:
   report['phase']=name;target.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'phase':name,'command':command}),flush=True);child=subprocess.Popen(command,cwd=ROOT,env=environment);report['childPid']=child.pid;target.write_text(json.dumps(report,indent=2)+'\n');code=child.wait();report['stages'].append({'name':name,'exitCode':code,'finishedAt':time.time()})
   if code:raise RuntimeError(f'{name} exited {code}; preserve failure and latest complete checkpoint')
  trained=json.loads((a.output/'training/training-report.json').read_text())
  if not trained.get('fullPassCompleted'):raise ValueError('Training did not finish the full scheduled pass')
  evaluated=json.loads((a.output/'evaluation/paired-evaluation.json').read_text())
  if evaluated['status']!='PAIRED_EVALUATED_EXPERIMENTAL':raise ValueError('Paired evaluation incomplete')
  scored=json.loads((a.output/'evaluation/paired-evaluation-score-v2.json').read_text());report['status']='FULL_PASS_AND_PAIRED_EVAL_COMPLETE_EXPERIMENTAL';report['adapterSha256']=trained['adapterSha256'];report['candidateSummary']=scored['arms']['candidateArm'];report['behaviorStatus']=scored['status'];report['professionalLegalValidation']=False
  current=json.loads(MONITOR.read_text());monitor=ProgressMonitor(a.output,current['dataset'],trained['scheduledSteps'],'completed-full-epoch');monitor.close(state='completed',phase='full-pass-and-evaluation-complete',releaseStatus='experimental'if scored['arms']['candidateArm']['allChecksPassed']else'rejected',progress={'step':trained['completedStep'],'totalSteps':trained['scheduledSteps']},fullPassCompleted=True,lastEvaluation={'status':scored['status'],'casesPassed':scored['arms']['candidateArm']['casesPassed'],'casesTotal':scored['arms']['candidateArm']['casesTotal'],'defaultPromotion':'BLOCKED'},message='La corrida y evaluación terminaron; el candidato no se ha activado ni validado profesionalmente.')
 except BaseException as error:report['status']='FAILED_OR_INTERRUPTED_RESUMABLE';report['error']=f'{type(error).__name__}: {error}';raise
 finally:report['finishedAt']=time.time();target.write_text(json.dumps(report,indent=2)+'\n')
if __name__=='__main__':main()
