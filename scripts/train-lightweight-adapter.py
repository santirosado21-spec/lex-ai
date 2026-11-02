"""Offline, bounded Gemma3 1B LoRA; preparation is CPU-only unless --run.

Never reuse the 26B adapter. Same held-out laws; no semantic quality claim.
"""
import argparse
import copy
import hashlib
import importlib.metadata
import importlib
import json
import math
import os
import resource
import signal
import shutil
import sys
import time
import uuid
from argparse import Namespace
from pathlib import Path
from functools import partial

os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'
ROOT = Path(__file__).resolve().parents[1]
REPO = 'mlx-community/gemma-3-1b-it-4bit'
REVISION = '2d44e83dc9e80843d22fb941d3d699a0b1351aa6'
MEMORY_LIMIT = 3 * 1024**3


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for chunk in iter(lambda: f.read(4 * 1024**2), b''):
            h.update(chunk)
    return h.hexdigest()


def verify_base(base, manifest_path):
    manifest = json.loads(manifest_path.read_text())
    if manifest['repo'] != REPO or manifest['revision'] != REVISION or manifest['license'] != 'gemma':
        raise ValueError('Small-model base provenance/license mismatch; 26B adapters are incompatible')
    listed = set()
    for entry in manifest['files']:
        name = entry['file']
        if Path(name).name != name or name in listed:
            raise ValueError('Unsafe or duplicate manifest filename')
        listed.add(name)
        p = base / name
        if p.is_symlink() or not p.is_file() or p.stat().st_size != entry['bytes'] or digest(p) != entry['sha256']:
            raise ValueError('Base file hash mismatch')
    if not {'config.json', 'tokenizer.json', 'tokenizer_config.json', 'model.safetensors'} <= listed:
        raise ValueError('Incomplete base manifest')
    if {p.name for p in base.glob('*.safetensors')} != {n for n in listed if n.endswith('.safetensors')}:
        raise ValueError('Unlisted base weights')
    if sum((base / n).stat().st_size for n in listed) > 1024**3:
        raise ValueError('Small base exceeds 1 GiB download budget')
    cfg = json.loads((base / 'config.json').read_text())
    if cfg.get('model_type') != 'gemma3_text' or cfg.get('hidden_size') != 1152 or cfg.get('num_hidden_layers') != 26 or cfg.get('quantization', {}).get('bits') != 4:
        raise ValueError('Unexpected small-model architecture')
    return {'repo': REPO, 'revision': REVISION, 'manifestSha256': digest(manifest_path), 'license': 'gemma'}


def encode_row(row, tokenizer):
    # Derive both completion and boundary from THIS model's template. Gemma3 uses
    # <end_of_turn>, not Gemma4's <turn|>; no hand-written cross-model suffix.
    prefix_text = tokenizer.apply_chat_template(row['messages'][:-1], tokenize=False, add_generation_prompt=True)
    full_text = tokenizer.apply_chat_template(row['messages'], tokenize=False, add_generation_prompt=False)
    if not full_text.startswith(prefix_text) or len(full_text) <= len(prefix_text):
        raise ValueError('Tokenizer completion does not extend its exact generation prefix')
    # BPE may merge the prefix's trailing newline with the assistant's opening
    # brace when tokenizing the full conversation. Preserve the actual inference
    # prefix tokens, then encode the template-derived completion without BOS.
    prefix = tokenizer.encode(prefix_text, add_special_tokens=False)
    completion = tokenizer.encode(full_text[len(prefix_text):], add_special_tokens=False)
    return prefix + completion, len(prefix)


def configure_turn_stop(tokenizer, base):
    tokens = json.loads((base / 'tokenizer.json').read_text())['added_tokens']
    turn = next((t for t in tokens if t['content'] == '<end_of_turn>' and t.get('special')), None)
    if not turn or tokenizer.convert_tokens_to_ids('<end_of_turn>') != turn['id']:
        raise ValueError('Chat turn stop token is not verified in pinned tokenizer')
    before = sorted(tokenizer.eos_token_ids)
    tokenizer.add_eos_token('<end_of_turn>')
    return {'originalEosTokenIds': before, 'effectiveEosTokenIds': sorted(tokenizer.eos_token_ids),
            'chatTurnTokenId': turn['id'], 'reason': 'Pinned chat template terminates assistant turns with this special token; base config lists only <eos>'}


class Dataset:
    def __init__(self, rows, tokenizer, maximum, limit):
        groups = {}
        for row in rows:
            groups.setdefault(row['metadata']['task'], []).append(row)
        self.rows, self.data, self.rejected = [], [], 0
        while groups and len(self.rows) < limit:
            for task in sorted(list(groups)):
                if len(self.rows) >= limit:
                    break
                row = groups[task].pop(0)
                if not groups[task]:
                    del groups[task]
                tokens, start = encode_row(row, tokenizer)
                if len(tokens) > maximum:
                    self.rejected += 1
                    continue
                self.rows.append(row)
                self.data.append((tokens, start))
        if len(self.data) < 8:
            raise ValueError('Too few complete examples; no truncation allowed')

    def __len__(self):
        return len(self.data)

    def __getitem__(self, index):
        return self.data[index]

    def process(self, item):
        return item


def read_data(directory):
    manifest = json.loads((directory / 'manifest.json').read_text())
    laws = {p: set(manifest['lawGroups'][p]) for p in ('train', 'valid', 'test')}
    if laws['train'] & laws['valid'] or laws['train'] & laws['test'] or laws['valid'] & laws['test']:
        raise ValueError('Law split leakage')
    rows = {}
    for split in laws:
        p = directory / f'{split}.jsonl'
        if digest(p) != manifest['files'][split]['sha256']:
            raise ValueError('Dataset file integrity mismatch')
        rows[split] = [json.loads(line) for line in p.read_text().splitlines() if line.strip()]
        for row in rows[split]:
            meta = row['metadata']
            if meta['split'] != split or meta['lawId'] not in laws[split]:
                raise ValueError('Row violates law partition')
    return rows, manifest


def masked_loss(model, batch, lengths):
    import mlx.core as mx
    import mlx.nn as nn
    targets = batch[:, 1:]
    logits = model(batch[:, :-1])
    positions = mx.arange(1, targets.shape[1] + 1)
    mask = mx.logical_and(positions >= lengths[:, 0:1], positions < lengths[:, 1:])
    count = mask.sum()
    return (nn.losses.cross_entropy(logits, targets) * mask).astype(mx.float32).sum() / count, count


def claim_locks(directory):
    directory.mkdir(parents=True, exist_ok=True)
    identity, owned = str(uuid.uuid4()), []
    try:
        for name in ('pipeline.lock', 'gpu.lock'):
            p = directory / name
            with p.open('x') as f:
                json.dump({'id': identity, 'pid': os.getpid(), 'mode': 'lightweight-training'}, f)
            owned.append(p)
    except BaseException:
        for p in owned:
            p.unlink()
        raise
    def release():
        for p in reversed(owned):
            if p.exists() and json.loads(p.read_text()).get('id') == identity:
                p.unlink()
    return release


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', type=Path, default=ROOT / 'artifacts/lightweight/base-gemma3-1b')
    parser.add_argument('--base-manifest', type=Path, default=ROOT / 'artifacts/lightweight/base-model-manifest.json')
    parser.add_argument('--data', type=Path, default=ROOT / 'artifacts/training/dataset-v2')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--run', action='store_true')
    parser.add_argument('--iters', type=int, default=3)
    parser.add_argument('--seq-length', type=int, choices=[256, 512], default=512)
    parser.add_argument('--train-examples', type=int, default=256)
    parser.add_argument('--eval-examples', type=int, default=8)
    parser.add_argument('--application-cases', type=Path)
    args = parser.parse_args()
    if not 1 <= args.iters <= 100 or not 8 <= args.train_examples <= 2048 or not 8 <= args.eval_examples <= 32:
        raise ValueError('Training/evaluation bounds exceeded')
    if args.output.exists():
        raise ValueError('Output exists; preserve previous evidence')
    provenance = verify_base(args.base.resolve(), args.base_manifest.resolve())
    rows, manifest = read_data(args.data)
    from transformers import AutoTokenizer
    tokenizer = AutoTokenizer.from_pretrained(str(args.base), local_files_only=True, trust_remote_code=False)
    sets = {p: Dataset(rows[p], tokenizer, args.seq_length, args.train_examples if p == 'train' else args.eval_examples) for p in rows}
    args.output.mkdir(parents=True)
    shutil.copyfile(__file__, args.output / 'trainer-executed.py')
    cfg_audit = {'status': 'PREPARED_NOT_TRAINED', 'base': provenance, 'datasetManifestSha256': digest(args.data / 'manifest.json'),
                 'scriptSha256': digest(__file__), 'tokenizerConfigSha256': digest(args.base / 'tokenizer_config.json'),
                 'sourceTestSha256': manifest['files']['test']['sha256'], 'batchSize': 1, 'rank': 4, 'layers': 2,
                 'maxSequenceLength': args.seq_length, 'iters': args.iters, 'mlxAllocationLimitBytes': MEMORY_LIMIT,
                 'semanticLegalValidation': False, 'physical8GBValidation': False, 'baseWeightsModified': False,
                 'prior26BAdapterUsed': False, 'cases': {p: [r['metadata'] for r in s.rows] for p, s in sets.items()},
                 'tokens': {p: {'maximum': max(len(v[0]) for v in s.data), 'selected': len(s), 'rejectedOverBudget': s.rejected} for p, s in sets.items()}}
    for split, dataset in sets.items():
        p = args.output / f'effective-{split}.jsonl'
        p.write_text(''.join(json.dumps(r, ensure_ascii=False) + '\n' for r in dataset.rows))
    cfg_audit['effectiveFiles'] = {s: digest(args.output / f'effective-{s}.jsonl') for s in sets}
    behavior_cases = [{'id': r['metadata']['id'], 'kind': 'law-heldout', 'messages': r['messages'][:-1], 'row': r}
                      for r in sets['test'].rows[:8]]
    if args.application_cases:
        app_report = json.loads(args.application_cases.read_text())
        bundle = app_report.get('bundle', app_report)
        cfg_audit['applicationCaseSourceSha256'] = digest(args.application_cases)
        for case in bundle['cases']:
            behavior_cases.append({'id': case['id'], 'kind': 'application-regression', 'messages': case['enabled'], 'case': case})
    cfg_audit['behaviorCaseIds'] = [c['id'] for c in behavior_cases]
    if len(behavior_cases) > 18:
        raise ValueError('At most 18 behavioral cases in this bounded run')
    (args.output / 'preparation.json').write_text(json.dumps(cfg_audit, indent=2) + '\n')
    if not args.run:
        print(json.dumps({'status': cfg_audit['status'], 'tokens': cfg_audit['tokens']}))
        return
    if importlib.metadata.version('mlx-lm') != '0.32.2':
        raise ValueError('Review MLX-LM API before changing pinned version')
    release = claim_locks(ROOT / 'artifacts/training')
    started = time.monotonic()
    report = dict(cfg_audit, status='RUNNING', startedAt=time.time(), metrics=[], hostPlatform=sys.platform)
    def interrupt(signum, frame):
        raise KeyboardInterrupt('Bounded training interrupted or timed out')
    signal.signal(signal.SIGTERM, interrupt)
    signal.signal(signal.SIGALRM, interrupt)
    signal.alarm(600)
    try:
        import numpy as np
        import mlx.core as mx
        from mlx.utils import tree_flatten
        from mlx_lm.utils import load
        import mlx_lm.lora as lora
        import mlx_lm.tuner.trainer as trainer
        from mlx_lm.tuner.trainer import TrainingCallback
        generate_module = importlib.import_module('mlx_lm.generate')
        from mlx_lm.sample_utils import make_sampler
        np.random.seed(20261101)
        mx.set_memory_limit(min(MEMORY_LIMIT, mx.device_info()['max_recommended_working_set_size']))
        mx.set_cache_limit(64 * 1024**2)
        mx.set_wired_limit(min(MEMORY_LIMIT, mx.device_info()['max_recommended_working_set_size']))
        # Upstream trainer otherwise raises the wired limit to the HOST's 24 GB recommendation.
        trainer.maybe_set_recommended_wired_limit = lambda: None
        generate_module.maybe_set_recommended_wired_limit = lambda: None
        lora.train = partial(trainer.train, loss=masked_loss)
        model, inference_tokenizer = load(str(args.base), tokenizer_config={'trust_remote_code': False}, trust_remote_code=False)
        stopping = configure_turn_stop(inference_tokenizer, args.base)
        model.freeze()
        mx.eval(model.parameters())
        model.eval()
        behavioral = {'scope': 'Paired MLX base versus adapter with identical prompts. Unconstrained diagnostic, not equivalent to schema-constrained Ollama production or semantic legal validation.',
                      'generation': {'temperature': 0, 'maxTokens': 512, 'maxContext': 4096, 'prefillStep': 128, 'schemaConstrained': False}, 'stopping': stopping,
                      'cases': behavior_cases, 'base': [], 'candidate': []}
        def generate_cases(arm):
            model.eval()
            for item in behavior_cases:
                prompt = inference_tokenizer.apply_chat_template(item['messages'], tokenize=True, add_generation_prompt=True)
                if len(prompt) + 512 > 4096:
                    raise ValueError('Behavior prompt exceeds explicit context budget')
                began = time.monotonic()
                text, last = '', None
                for token in generate_module.stream_generate(model, inference_tokenizer, prompt=prompt,
                        max_tokens=512, sampler=make_sampler(temp=0), max_kv_size=4096, prefill_step_size=128):
                    text += token.text
                    last = token
                    if len(text) > 40000 or mx.get_peak_memory() > MEMORY_LIMIT:
                        raise RuntimeError('Behavior generation exceeded output/memory bound')
                behavioral[arm].append({'id': item['id'], 'kind': item['kind'], 'raw': text,
                    'elapsedSeconds': time.monotonic() - began, 'promptTokens': len(prompt),
                    'outputTokens': last.generation_tokens if last else 0, 'doneReason': last.finish_reason if last else 'empty'})
                (args.output / 'behavior-paired.json').write_text(json.dumps(behavioral, ensure_ascii=False, indent=2) + '\n')
                mx.clear_cache()
        generate_cases('base')
        report['baseline'] = {p: float(trainer.evaluate(model, sets[p], batch_size=1, num_batches=-1, max_seq_length=args.seq_length, loss=masked_loss)) for p in ('valid', 'test')}
        cfg = copy.deepcopy(lora.CONFIG_DEFAULTS)
        cfg.update(model=str(args.base.resolve()), data=str(args.data.resolve()), train=True, num_layers=2,
                   batch_size=1, iters=args.iters, val_batches=-1, learning_rate=1e-5,
                   steps_per_report=1, steps_per_eval=min(10, args.iters), save_every=min(10, args.iters),
                   max_seq_length=args.seq_length, grad_checkpoint=True, adapter_path=str(args.output.resolve()),
                   mask_prompt=True, seed=20261101, resume_adapter_file=None,
                   lora_parameters={'rank': 4, 'scale': 8.0, 'dropout': 0.0, 'keys': ['self_attn.q_proj', 'self_attn.v_proj']})
        class Callback(TrainingCallback):
            def on_train_loss_report(self, info):
                if not math.isfinite(info['train_loss']) or mx.get_peak_memory() > MEMORY_LIMIT:
                    raise RuntimeError('Invalid loss or allocation budget exceeded')
                report['metrics'].append(dict(info))
                (args.output / 'progress.json').write_text(json.dumps({'status': 'TRAINING', 'metrics': report['metrics']}, indent=2) + '\n')
            def on_val_loss_report(self, info):
                if not math.isfinite(info['val_loss']):
                    raise RuntimeError('Nonfinite validation loss')
        lora.train_model(Namespace(**cfg), model, sets['train'], sets['valid'], Callback())
        model.eval()
        report['candidate'] = {p: float(trainer.evaluate(model, sets[p], batch_size=1, num_batches=-1, max_seq_length=args.seq_length, loss=masked_loss)) for p in ('valid', 'test')}
        report['peakMlxAllocationBytes'] = mx.get_peak_memory()
        trainable = tree_flatten(model.trainable_parameters())
        report['trainableParameters'] = sum(value.size for _, value in trainable)
        report['trainedNonzeroBWeights'] = sum(int(mx.sum(mx.abs(v) > 0).item()) for k, v in trainable if k.endswith('lora_b'))
        if not report['trainedNonzeroBWeights']:
            raise RuntimeError('No trained adapter weights')
        report.update(status='TRAINED_EXPERIMENTAL_NOT_PROMOTED', adapterSha256=digest(args.output / 'adapters.safetensors'),
                      adapterConfigSha256=digest(args.output / 'adapter_config.json'), config=cfg, behavioralEvaluation='pending')
        generate_cases('candidate')
        report['behavioralEvaluation'] = 'paired raw generations complete; deterministic scoring and semantic review pending'
        report['behaviorPairedSha256'] = digest(args.output / 'behavior-paired.json')
    except BaseException as error:
        report.update(status='FAILED', error=f'{type(error).__name__}: {error}')
        raise
    finally:
        signal.alarm(0)
        report['durationSeconds'] = time.monotonic() - started
        report['peakProcessRssBytes'] = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * (1 if sys.platform == 'darwin' else 1024)
        report['processRssScope'] = 'OS process high-water RSS; not whole-system or guaranteed Metal/unified-memory usage'
        if 'mx' in locals():
            report['peakMlxAllocationBytes'] = mx.get_peak_memory()
        (args.output / 'training-report.json').write_text(json.dumps(report, indent=2) + '\n')
        release()
    print(json.dumps({k: report[k] for k in ('status', 'baseline', 'candidate', 'peakMlxAllocationBytes', 'adapterSha256')}))


if __name__ == '__main__':
    main()
