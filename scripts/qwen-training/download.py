"""Explicit CPU-only download of the pinned small training base; no upload/GPU."""
import hashlib,json,os,time,urllib.request
from pathlib import Path
os.environ['HF_HUB_DISABLE_TELEMETRY']='1'
os.environ['HF_HUB_DISABLE_PROGRESS_BARS']='1'
ROOT=Path(__file__).resolve().parents[2]
REPO='mlx-community/Qwen3.5-2B-4bit'
REVISION='674aaa7240b91e8012fcad5d791b7dfe5ba90207'
UPSTREAM='15852e8c16360a2fea060d615a32b45270f8a8fc'
DEST=ROOT/'artifacts/training/qwen-base-2b-4bit'
EXPECTED={'model.safetensors':('713fe7e5d3c3965f7106b0d0ee17615f7869c23c8d327996df8c1196fbcf07d5',1722271785),'tokenizer.json':('87a7830d63fcf43bf241c3c5242e96e62dd3fdc29224ca26fed8ea333db72de4',19989343),'config.json':('beb7fc5a6e0405fe332821cf1a8ef7b69bb390a8c8933171647de5579debf949',3113),'chat_template.jinja':('273d8e0e683b885071fb17e08d71e5f2a5ddfb5309756181681de4f5a1822d80',7755)}
def digest(p):
 h=hashlib.sha256()
 with Path(p).open('rb')as stream:
  for chunk in iter(lambda:stream.read(4*1024**2),b''):h.update(chunk)
 return h.hexdigest()
def main():
 from huggingface_hub import HfApi,hf_hub_download
 info=HfApi().model_info(REPO,revision=REVISION,files_metadata=True,token=False)
 if info.sha!=REVISION:raise ValueError('Revision changed')
 selected=[f for f in info.siblings if Path(f.rfilename).name==f.rfilename and(f.rfilename.endswith(('.json','.jinja','.safetensors'))or f.rfilename=='README.md')]
 if sum(f.size or 0 for f in selected)>3_000_000_000:raise ValueError('Download budget exceeded')
 DEST.mkdir(parents=True,exist_ok=True);files=[]
 for entry in selected:
  name=entry.rfilename;p=DEST/name
  hf_hub_download(REPO,name,revision=REVISION,local_dir=DEST,token=False)
  value=digest(p)
  if p.stat().st_size!=entry.size:raise ValueError('Size mismatch: '+name)
  if name in EXPECTED and(value,p.stat().st_size)!=EXPECTED[name]:raise ValueError('Pinned hash mismatch: '+name)
  if entry.lfs and value!=entry.lfs.sha256:raise ValueError('LFS hash mismatch: '+name)
  files.append({'file':name,'bytes':p.stat().st_size,'sha256':value})
  print(json.dumps({'downloaded':name,'bytes':p.stat().st_size}),flush=True)
 license_url=f'https://huggingface.co/Qwen/Qwen3.5-2B/resolve/{UPSTREAM}/LICENSE'
 with urllib.request.urlopen(license_url,timeout=30)as response:raw=response.read(65537)
 if len(raw)>65536 or hashlib.sha256(raw).hexdigest()!='bbedc3fda3305820b977265f01b8619d87570a6739de3a5582c3464840f1e57a':raise ValueError('Upstream license mismatch')
 (DEST/'LICENSE').write_bytes(raw);files.append({'file':'LICENSE','bytes':len(raw),'sha256':digest(DEST/'LICENSE')})
 report={'repo':REPO,'revision':REVISION,'upstreamRepo':'Qwen/Qwen3.5-2B','upstreamRevision':UPSTREAM,'license':'apache-2.0','licenseURL':license_url,'files':files,'downloadedBytes':sum(f['bytes']for f in files),'status':'VERIFIED_BASE_NOT_LOADED','basePreserved':True,'observedAt':time.time(),'scriptSha256':digest(__file__)}
 manifest=DEST.parent/'qwen-base-manifest.json'
 if manifest.exists():
  prior=json.loads(manifest.read_text())
  if prior['files']!=files or prior['revision']!=REVISION:raise ValueError('Preserve previous base manifest; mismatch')
 else:manifest.write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps({'status':report['status'],'bytes':report['downloadedBytes'],'manifest':str(manifest)}))
if __name__=='__main__':main()
