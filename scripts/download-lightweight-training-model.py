"""Explicit download only: pinned 1B public model, no credentials or GPU."""
import hashlib
import json
import os
from pathlib import Path
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
REPO = 'mlx-community/gemma-3-1b-it-4bit'
REVISION = '2d44e83dc9e80843d22fb941d3d699a0b1351aa6'
EXPECTED_WEIGHT_BYTES = 732577304
DEST = Path(__file__).resolve().parents[1] / 'artifacts/lightweight/base-gemma3-1b'

def digest(p):
    h = hashlib.sha256()
    with p.open('rb') as f:
        for b in iter(lambda: f.read(4 * 1024**2), b''):
            h.update(b)
    return h.hexdigest()

if __name__ == '__main__':
    from huggingface_hub import snapshot_download
    manifest = DEST.parent / 'base-model-manifest.json'
    if manifest.exists():
        raise ValueError('Pinned manifest already exists; verify it rather than replacing it')
    snapshot_download(REPO, revision=REVISION, local_dir=DEST, token=False, max_workers=1,
                      allow_patterns=['*.json', '*.safetensors', '*.model', '*.jinja', 'README.md', 'LICENSE*'])
    files = [{'file': p.name, 'bytes': p.stat().st_size, 'sha256': digest(p)}
             for p in sorted(DEST.iterdir()) if p.is_file()]
    if (DEST / 'model.safetensors').stat().st_size != EXPECTED_WEIGHT_BYTES or sum(f['bytes'] for f in files) > 1024**3:
        raise ValueError('Unexpected download size; do not train')
    report = {'repo': REPO, 'revision': REVISION, 'license': 'gemma',
              'licenseUrl': 'https://ai.google.dev/gemma/terms',
              'licenseNotice': 'Gemma terms, not Apache-2.0. Distribution requires a separate license review.', 'files': files}
    manifest.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'status': 'DOWNLOADED_NOT_LOADED', 'bytes': sum(f['bytes'] for f in files), 'manifest': str(manifest)}))
