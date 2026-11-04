"""Local progress only; backup the prior monitor and publish atomic heartbeats."""
import datetime,json,os,threading,uuid
from pathlib import Path
MONITOR=Path.home()/'Library/Application Support/LEX AI/public-monitor/training.json'
class ProgressMonitor:
 def __init__(self,run_dir,dataset,total,scope):
  self.file=MONITOR;self.file.parent.mkdir(parents=True,exist_ok=True);self.run_dir=run_dir
  backup=run_dir/'monitor-before.json'
  if self.file.exists()and not backup.exists():backup.write_bytes(self.file.read_bytes())
  self.data={'schemaVersion':1,'state':'loading','releaseStatus':'experimental','runScope':scope,'runDirectory':str(run_dir),'progress':{'step':0,'totalSteps':total},'dataset':dataset,'semanticLegalValidation':False,'defaultAppModelChanged':False};self.lock=threading.Lock();self.done=threading.Event();self.write();self.thread=threading.Thread(target=self.heartbeat,daemon=True);self.thread.start()
 def write(self):
  with self.lock:
   value={**self.data,'updatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()};raw=json.dumps(value,ensure_ascii=False,indent=2)+'\n'
  temporary=self.file.with_name('training.'+uuid.uuid4().hex+'.tmp')
  try:temporary.write_text(raw);os.replace(temporary,self.file)
  finally:temporary.unlink(missing_ok=True)
  (self.run_dir/'monitor-current.json').write_text(raw)
 def heartbeat(self):
  while not self.done.wait(20):self.write()
 def update(self,**values):
  with self.lock:self.data.update(values)
  self.write()
 def close(self,**values):
  self.done.set();self.thread.join(timeout=2);self.update(**values)
