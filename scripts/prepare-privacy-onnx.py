#!/usr/bin/env python3
"""Explicit developer preparation only. Never imported by inference/app startup."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.request
import venv

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'resources/privacy-detector-candidate-v2.json'
ENV = ROOT / 'artifacts/privacy/onnx-env'
PINS = ['onnxruntime==1.31.1', 'tokenizers==0.23.3', 'numpy==2.5.4']

def digest(p):
    h = hashlib.sha256()
    with p.open('rb') as f:
        for b in iter(lambda: f.read(1024 * 1024), b''): h.update(b)
    return h.hexdigest()

def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--prepare', action='store_true'); args = parser.parse_args()
    raw = MANIFEST.read_bytes(); manifest = json.loads(raw)
    destination = ROOT / manifest['download']['artifactDirectory']
    if destination != ROOT / 'artifacts/privacy/models/gliner-pii-small-uint8-v2': raise ValueError('directory')
    if not args.prepare:
        print(json.dumps({'action':'plan','modelBytes':sum(f['bytes'] for f in manifest['files']), 'runtimePins':PINS, 'explicitPreparationRequired':True})); return
    if sys.version_info[:2] != (3,12): raise ValueError('requires_existing_python_312')
    if manifest['model']['repository'] != 'knowledgator/gliner-pii-small-v1.0' or manifest['model']['revision'] != 'd21aad5b4a7ec82b3d0970fd1ac74a12c087d85e': raise ValueError('identity')
    total = sum(f['bytes'] for f in manifest['files'])
    if total > 100 * 1024 * 1024: raise ValueError('budget')
    destination.mkdir(parents=True, exist_ok=True)
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    downloaded = 0
    for spec in manifest['files']:
        relative = Path(spec['path'])
        if relative.is_absolute() or '..' in relative.parts: raise ValueError('path')
        target = destination / relative
        if target.is_symlink(): raise ValueError('symlink')
        if target.exists():
            if target.stat().st_size != spec['bytes'] or digest(target) != spec['sha256']: raise ValueError('existing_hash')
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.parent.resolve().is_relative_to(destination.resolve()): raise ValueError('path')
        url = f"https://huggingface.co/{manifest['model']['repository']}/resolve/{manifest['model']['revision']}/{spec['path']}"
        partial = target.with_suffix(target.suffix+'.partial')
        count = 0
        try:
            with opener.open(urllib.request.Request(url, headers={'User-Agent':'LEX-synthetic-ONNX-preparation/1'}), timeout=30) as response, partial.open('xb') as output:
                if not response.url.startswith('https://'): raise ValueError('redirect')
                while chunk := response.read(1024 * 1024):
                    count += len(chunk); downloaded += len(chunk)
                    if count > spec['bytes'] or downloaded > total: raise ValueError('size')
                    output.write(chunk)
            if count != spec['bytes'] or digest(partial) != spec['sha256']: raise ValueError('hash')
            partial.rename(target)
        finally:
            if partial.exists(): partial.unlink()
    if ENV.exists(): raise ValueError('runtime_already_exists_verify_manually_no_mutation')
    venv.EnvBuilder(with_pip=True).create(ENV)
    private_home = ROOT / 'artifacts/privacy/onnx-install-home'; private_home.mkdir(exist_ok=True)
    env = {'PATH':'/usr/bin:/bin','HOME':str(private_home),'LANG':'en_US.UTF-8','PIP_CONFIG_FILE':os.devnull,'PYTHONNOUSERSITE':'1'}
    wheelhouse = ROOT / 'artifacts/privacy/onnx-wheels'; wheelhouse.mkdir(exist_ok=False)
    python = str(ENV/'bin/python')
    subprocess.run([python,'-I','-m','pip','--isolated','download','--disable-pip-version-check','--no-cache-dir','--index-url','https://pypi.org/simple','--only-binary=:all:','--retries','0','--timeout','30','--dest',str(wheelhouse),*PINS],env=env,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=180)
    wheels = [{'file':p.name,'bytes':p.stat().st_size,'sha256':digest(p)} for p in sorted(wheelhouse.glob('*.whl'))]
    if sum(w['bytes'] for w in wheels) > 100*1024*1024: raise ValueError('runtime_budget')
    subprocess.run([python,'-I','-m','pip','--isolated','install','--disable-pip-version-check','--no-index','--find-links',str(wheelhouse),*PINS],env=env,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=120)
    freeze = subprocess.check_output([python,'-I','-m','pip','--isolated','freeze','--all'],env=env,text=True)
    (ROOT/'artifacts/privacy/onnx-requirements.lock').write_text(freeze)
    report = {'manifestSha256':hashlib.sha256(raw).hexdigest(),'modelRepository':manifest['model']['repository'],'modelRevision':manifest['model']['revision'],'verifiedModelBytes':total,'modelNetworkPayloadBytesThisRun':downloaded,'runtimeWheelPayloadBytes':sum(w['bytes'] for w in wheels),'networkAccounting':'Payload sizes only; HTTP/TLS/index overhead not measured.','runtimePins':PINS,'wheels':wheels,'python':sys.version.split()[0],'preparedAtUnix':time.time(),'inferencePerformed':False}
    (ROOT/'artifacts/privacy/onnx-preparation.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:report[k] for k in ['verifiedModelBytes','modelNetworkPayloadBytesThisRun','runtimeWheelPayloadBytes','inferencePerformed']}))

if __name__ == '__main__':
    try: main()
    except Exception:
        print('privacy_onnx_preparation_failed',file=sys.stderr); sys.exit(2)
