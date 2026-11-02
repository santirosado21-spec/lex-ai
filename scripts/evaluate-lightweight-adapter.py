"""Re-run paired inference only, with explicit Gemma3 chat-turn stopping."""
import argparse
import importlib
import importlib.util
import json
import resource
import signal
import sys
import time
from pathlib import Path

MODULE = Path(__file__).with_name('train-lightweight-adapter.py')
spec = importlib.util.spec_from_file_location('light_train', MODULE)
training = importlib.util.module_from_spec(spec)
spec.loader.exec_module(training)


def configure_turn_stop(tokenizer, base):
    return training.configure_turn_stop(tokenizer, base)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--adapter', type=Path, required=True)
    p.add_argument('--input', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--base', type=Path, default=training.ROOT / 'artifacts/lightweight/base-gemma3-1b')
    p.add_argument('--base-manifest', type=Path, default=training.ROOT / 'artifacts/lightweight/base-model-manifest.json')
    a = p.parse_args()
    if a.output.exists():
        raise ValueError('Preserve prior evaluation')
    provenance = training.verify_base(a.base, a.base_manifest)
    train_report = json.loads((a.adapter / 'training-report.json').read_text())
    config = json.loads((a.adapter / 'adapter_config.json').read_text())
    if train_report['adapterSha256'] != training.digest(a.adapter / 'adapters.safetensors') or train_report['adapterConfigSha256'] != training.digest(a.adapter / 'adapter_config.json'):
        raise ValueError('Adapter does not match training report')
    if Path(config['model']).resolve() != a.base.resolve() or config['fine_tune_type'] != 'lora' or config['num_layers'] != 2:
        raise ValueError('Adapter is not bound to small base')
    source = json.loads(a.input.read_text())
    if not 1 <= len(source['cases']) <= 18:
        raise ValueError('Case bound exceeded')
    report = {'status': 'RUNNING', 'scope': source['scope'], 'generation': source['generation'],
              'baseProvenance': provenance, 'scriptSha256': training.digest(__file__),
              'adapterSha256': train_report['adapterSha256'], 'inputSha256': training.digest(a.input),
              'cases': source['cases'], 'base': [], 'candidate': [], 'physical8GBValidation': False}
    release = training.claim_locks(training.ROOT / 'artifacts/training')
    started = time.monotonic()
    def interrupt(signum, frame):
        raise KeyboardInterrupt('Evaluation interrupted or timed out')
    signal.signal(signal.SIGTERM, interrupt)
    signal.signal(signal.SIGALRM, interrupt)
    signal.alarm(600)
    try:
        import mlx.core as mx
        from mlx_lm.utils import load
        from mlx_lm.tuner.utils import load_adapters
        from mlx_lm.sample_utils import make_sampler
        generate = importlib.import_module('mlx_lm.generate')
        generate.maybe_set_recommended_wired_limit = lambda: None
        mx.set_memory_limit(training.MEMORY_LIMIT)
        mx.set_wired_limit(min(training.MEMORY_LIMIT, mx.device_info()['max_recommended_working_set_size']))
        mx.set_cache_limit(64 * 1024**2)
        model, tokenizer = load(str(a.base), tokenizer_config={'trust_remote_code': False}, trust_remote_code=False)
        report['stopping'] = configure_turn_stop(tokenizer, a.base)
        for arm in ('base', 'candidate'):
            if arm == 'candidate':
                model = load_adapters(model, str(a.adapter))
            model.eval()
            for item in report['cases']:
                tokens = tokenizer.apply_chat_template(item['messages'], tokenize=True, add_generation_prompt=True)
                if len(tokens) + 512 > 4096:
                    raise ValueError('Context bound exceeded')
                raw, last, began = '', None, time.monotonic()
                for part in generate.stream_generate(model, tokenizer, prompt=tokens, max_tokens=512,
                        sampler=make_sampler(temp=0), max_kv_size=4096, prefill_step_size=128):
                    raw += part.text
                    last = part
                    if len(raw) > 40000 or mx.get_peak_memory() > training.MEMORY_LIMIT:
                        raise RuntimeError('Generation exceeded output/memory bound')
                report[arm].append({'id': item['id'], 'kind': item['kind'], 'raw': raw,
                    'elapsedSeconds': time.monotonic() - began, 'promptTokens': len(tokens),
                    'outputTokens': last.generation_tokens if last else 0, 'doneReason': last.finish_reason if last else 'empty'})
                a.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
                mx.clear_cache()
        report['status'] = 'GENERATED_NOT_SCORED'
    except BaseException as error:
        report.update(status='ERROR', error=f'{type(error).__name__}: {error}')
        raise
    finally:
        signal.alarm(0)
        report['durationSeconds'] = time.monotonic() - started
        report['peakProcessRssBytes'] = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * (1 if sys.platform == 'darwin' else 1024)
        if 'mx' in locals():
            report['peakMlxAllocationBytes'] = mx.get_peak_memory()
        a.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        release()
    print(json.dumps({k: report[k] for k in ('status', 'stopping', 'durationSeconds', 'peakMlxAllocationBytes', 'peakProcessRssBytes')}))


if __name__ == '__main__':
    main()
