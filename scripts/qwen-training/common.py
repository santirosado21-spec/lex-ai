import hashlib,json,os,uuid,random,shutil
from pathlib import Path
ROOT=Path(os.environ.get('LEX_PROJECT_ROOT',str(Path(__file__).resolve().parents[2]))).resolve()
REPO='mlx-community/Qwen3.5-2B-4bit'
REVISION='674aaa7240b91e8012fcad5d791b7dfe5ba90207'
def snapshot_scripts(output):
 folder=output/'reproduction-scripts';folder.mkdir()
 for file in Path(__file__).parent.glob('*.py'):shutil.copyfile(file,folder/file.name)
def build_schedule(count,synthetic_indices,seed,rehearsal_every=16):
 if len(set(synthetic_indices))!=len(synthetic_indices)or any(not 0<=i<count for i in synthetic_indices)or rehearsal_every<1:raise ValueError('Invalid rehearsal schedule')
 dialogue=list(synthetic_indices);random.Random(seed+1).shuffle(dialogue);order=list(range(count));random.Random(seed).shuffle(order)
 scheduled=[(index,'dialogue-warmup')for index in dialogue]
 for position,index in enumerate(order):
  scheduled.append((index,'corpus-epoch'))
  if dialogue and(position+1)%rehearsal_every==0:scheduled.append((dialogue[((position+1)//rehearsal_every-1)%len(dialogue)],'dialogue-rehearsal'))
 return scheduled
def digest(p):
 h=hashlib.sha256()
 with Path(p).open('rb')as stream:
  for chunk in iter(lambda:stream.read(4*1024**2),b''):h.update(chunk)
 return h.hexdigest()
def verify_base(base,manifest_path):
 manifest=json.loads(manifest_path.read_text())
 if manifest['repo']!=REPO or manifest['revision']!=REVISION or manifest['license']!='apache-2.0' or manifest['downloadedBytes']>3_000_000_000:raise ValueError('Base provenance mismatch')
 for item in manifest['files']:
  if Path(item['file']).name!=item['file']:raise ValueError('Unsafe base filename')
  p=base/item['file']
  if p.is_symlink()or not p.is_file()or p.stat().st_size!=item['bytes']or digest(p)!=item['sha256']:raise ValueError('Base hash mismatch: '+item['file'])
 config=json.loads((base/'config.json').read_text())
 if config.get('model_type')!='qwen3_5'or config.get('text_config',{}).get('num_hidden_layers')!=24 or config.get('quantization',{}).get('bits')!=4:raise ValueError('Unexpected small Qwen architecture')
 return {'repo':REPO,'revision':REVISION,'manifestSha256':digest(manifest_path),'weightSha256':digest(base/'model.safetensors'),'license':manifest['license']}
def encode_row(row,tokenizer):
 prefix=tokenizer.apply_chat_template(row['messages'][:-1],tokenize=False,add_generation_prompt=True,enable_thinking=False)
 full=tokenizer.apply_chat_template(row['messages'],tokenize=False,add_generation_prompt=False,enable_thinking=False)
 if not full.startswith(prefix)or len(full)<=len(prefix):raise ValueError('Chat completion does not extend exact inference prefix')
 start=tokenizer.encode(prefix,add_special_tokens=False);end=tokenizer.encode(full[len(prefix):],add_special_tokens=False)
 return start+end,len(start)
def claim_locks():
 identity=str(uuid.uuid4());owned=[];root=ROOT/'artifacts/training';root.mkdir(parents=True,exist_ok=True)
 try:
  for name in ['pipeline.lock','gpu.lock']:
   p=root/name
   with p.open('x')as stream:json.dump({'id':identity,'pid':os.getpid(),'mode':'qwen2b-local-training'},stream)
   owned.append(p)
 except BaseException:
  for p in owned:p.unlink()
  raise
 def release():
  for p in reversed(owned):
   if p.exists()and json.loads(p.read_text()).get('id')==identity:p.unlink()
 return release
