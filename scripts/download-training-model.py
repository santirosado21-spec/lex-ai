"""Download a pinned public checkpoint; never use Hub credentials or execute remote code.

Each checkpoint keeps its own manifest.  This prevents a lightweight candidate
from altering the provenance record of the existing 26B experiment.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path

os.environ['HF_HUB_DISABLE_TELEMETRY']='1'
from huggingface_hub import snapshot_download

ROOT=Path(__file__).resolve().parents[1]
DEFAULT_DEST=ROOT/'artifacts/training/base-gemma4-26b'
DEFAULT_REPO='mlx-community/gemma-4-26b-a4b-it-4bit'
DEFAULT_REVISION='0d77464eeb233a2da68ebf9d7dc4edaac7db956d'

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo',default=DEFAULT_REPO)
    parser.add_argument('--revision',default=DEFAULT_REVISION,
                        help='Immutable Hugging Face commit SHA or unique commit prefix; never a branch name.')
    parser.add_argument('--output',default=str(DEFAULT_DEST))
    parser.add_argument('--license',default='Apache-2.0')
    args=parser.parse_args()
    if not args.repo.startswith('mlx-community/') or not 7<=len(args.revision)<=40 or any(c not in '0123456789abcdef' for c in args.revision):
        raise ValueError('Only an mlx-community checkpoint fixed to a 7–40 character commit SHA/prefix is allowed')
    dest=Path(args.output).resolve()
    if dest==DEFAULT_DEST.resolve() and (dest/'base-manifest.json').exists():
        raise ValueError('Refusing to replace the existing base checkpoint manifest')
    dest.mkdir(parents=True,exist_ok=True)
    print(json.dumps({'event':'download-start','repo':args.repo,'revision':args.revision,'output':str(dest)}),flush=True)
    snapshot_download(args.repo,revision=args.revision,local_dir=dest,token=False,max_workers=2,
                      allow_patterns=['*.json','*.safetensors','*.model','*.jinja','README.md','LICENSE*'])
    files=[]
    for path in sorted(dest.iterdir()):
        if not path.is_file():continue
        digest=hashlib.sha256()
        with path.open('rb') as stream:
            for block in iter(lambda:stream.read(8*1024*1024),b''):digest.update(block)
        files.append({'file':path.name,'bytes':path.stat().st_size,'sha256':digest.hexdigest()})
    report={'repo':args.repo,'revision':args.revision,'license':args.license,'files':files}
    (dest/'base-manifest.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'event':'download-complete','files':len(files),'bytes':sum(x['bytes']for x in files)}),flush=True)

if __name__=='__main__':main()
