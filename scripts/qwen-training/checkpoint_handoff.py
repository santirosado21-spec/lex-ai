"""Intentional owned-job checkpoint handoff; verify identity and never bypass locks."""
import argparse,json,os,signal,subprocess,time
from pathlib import Path
from common import ROOT,digest
def main():
 p=argparse.ArgumentParser();p.add_argument('--pipeline',type=Path,required=True);p.add_argument('--timeout',type=int,default=180);a=p.parse_args();a.pipeline=a.pipeline.resolve();status=json.loads((a.pipeline/'pipeline-report.json').read_text())
 if status['phase']!='training'or status['status']!='RUNNING':raise ValueError('Pipeline is not in its owned training phase')
 pid=status['childPid'];supervisor=status['pid'];lock=ROOT/'artifacts/training/gpu.lock';owned=json.loads(lock.read_text())
 if owned['pid']!=pid:raise ValueError('Training is not the owner of the shared GPU lock')
 latest=a.pipeline/'training/latest-checkpoint.json';initial=json.loads(latest.read_text());target=initial['step']+500;began=time.monotonic();expected=str(a.pipeline/'training')
 def identity():
  command=subprocess.check_output(['ps','-p',str(pid),'-o','command='],text=True);parent=int(subprocess.check_output(['ps','-p',str(pid),'-o','ppid='],text=True).strip())
  if 'full_pass.py'not in command or expected not in command or parent!=supervisor:raise ValueError('Owned process identity changed; do not send a signal')
 identity()
 while True:
  if time.monotonic()-began>a.timeout:raise TimeoutError('Checkpoint handoff timeout; existing job was left intact')
  try:current=json.loads(latest.read_text())
  except json.JSONDecodeError:time.sleep(.1);continue
  if current['step']>=target:break
  time.sleep(.1)
 checkpoint=Path(current['path']);checkpoint_state=json.loads((checkpoint/'checkpoint.json').read_text())
 if digest(checkpoint/'checkpoint.json')!=current['checkpointSha256']:raise ValueError('Checkpoint identity mismatch')
 for name,value in checkpoint_state['files'].items():
  if digest(checkpoint/name)!=value:raise ValueError('Checkpoint is incomplete')
 identity();os.kill(pid,signal.SIGTERM)
 while True:
  try:os.kill(pid,0)
  except ProcessLookupError:break
  if time.monotonic()-began>a.timeout+30:raise TimeoutError('Owned child has not completed graceful shutdown; no other process touched')
  time.sleep(.1)
 if lock.exists():raise RuntimeError('GPU lock was not released; do not run evaluation')
 report={'status':'INTENTIONAL_CHECKPOINT_HANDOFF','reason':'Root-authorized real paired diagnostics without concurrent GPU inference; exact continuation resumes the complete checkpoint.','stoppedOwnedPid':pid,'priorSupervisorPid':supervisor,'checkpoint':str(checkpoint),'checkpointStep':current['step'],'checkpointSha256':current['checkpointSha256'],'startedAt':time.time(),'durationSeconds':time.monotonic()-began,'locksReleased':True,'noOtherProcessesTouched':True}
 file=a.pipeline/f'intentional-handoff-{current["step"]}.json'
 if file.exists():raise ValueError('Preserve prior handoff record')
 file.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report),flush=True)
if __name__=='__main__':main()
