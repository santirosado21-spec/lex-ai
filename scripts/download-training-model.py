"""Download a pinned public checkpoint; never use Hub credentials or execute remote code."""
import hashlib
import json
import os
from pathlib import Path

os.environ['HF_HUB_DISABLE_TELEMETRY']='1'
from huggingface_hub import snapshot_download

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'artifacts/training/base-gemma4-26b'
REPO='mlx-community/gemma-4-26b-a4b-it-4bit'
REVISION='0d77464eeb233a2da68ebf9d7dc4edaac7db956d'

if __name__=='__main__':
    DEST.mkdir(parents=True,exist_ok=True)
    print(json.dumps({'event':'download-start','repo':REPO,'revision':REVISION}),flush=True)
    snapshot_download(REPO,revision=REVISION,local_dir=DEST,token=False,max_workers=2,
                      allow_patterns=['*.json','*.safetensors','*.model','*.jinja','README.md','LICENSE*'])
    files=[]
    for path in sorted(DEST.iterdir()):
        if not path.is_file():continue
        digest=hashlib.sha256()
        with path.open('rb') as stream:
            for block in iter(lambda:stream.read(8*1024*1024),b''):digest.update(block)
        files.append({'file':path.name,'bytes':path.stat().st_size,'sha256':digest.hexdigest()})
    report={'repo':REPO,'revision':REVISION,'license':'Apache-2.0','files':files}
    (DEST.parent/'base-model-manifest.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'event':'download-complete','files':len(files),'bytes':sum(x['bytes']for x in files)}),flush=True)
