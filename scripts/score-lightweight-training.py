"""CPU-only scoring of paired generations; preserves raw evidence and model weights."""
import argparse
import hashlib
import importlib.util
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def score(path):
    report = json.loads(path.read_text())
    cases = report['cases']
    ids = [c['id'] for c in cases]
    if len(ids) != len(set(ids)) or not ids:
        raise ValueError('Invalid case IDs')
    for arm in ('base', 'candidate'):
        if [r['id'] for r in report[arm]] != ids:
            raise ValueError('Incomplete or unpaired generation report')
    module_path = ROOT / 'scripts/evaluate-legal-adapter.py'
    spec = importlib.util.spec_from_file_location('reference_eval', module_path)
    evaluator = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(evaluator)
    node_code = """
import {assess} from './scripts/evaluate-lightweight-skills.mjs';
let input='';for await(const chunk of process.stdin)input+=chunk;
const entries=JSON.parse(input);
console.log(JSON.stringify(entries.map(e=>assess(e.raw,e.case,e.doneReason))));
"""
    applications = []
    for arm in ('base', 'candidate'):
        for row, case in zip(report[arm], cases):
            if case['kind'] == 'application-regression':
                applications.append({'raw': row['raw'], 'case': case['case'], 'doneReason': row['doneReason']})
    proc = subprocess.run(['node', '--input-type=module', '-e', node_code], cwd=ROOT,
                          input=json.dumps(applications), text=True, capture_output=True, timeout=30, check=True)
    app_scores = iter(json.loads(proc.stdout))
    scored = {}
    for arm in ('base', 'candidate'):
        scored[arm] = []
        for row, case in zip(report[arm], cases):
            if case['kind'] == 'law-heldout':
                assessment = evaluator.assess(row['raw'], case['row'])
                assessment['finished'] = row['doneReason'] != 'length'
                assessment['passed'] = assessment['passed'] and assessment['finished']
            else:
                assessment = next(app_scores)
            scored[arm].append({'id': row['id'], 'kind': row['kind'], **assessment})
    summary = {kind: {arm: {'cases': sum(r['kind'] == kind for r in scored[arm]),
                           'passed': sum(r['kind'] == kind and r['passed'] for r in scored[arm])}
                      for arm in ('base', 'candidate')}
               for kind in sorted({c['kind'] for c in cases})}
    passed = all(r['passed'] for r in scored['candidate'])
    return {'status': 'TECHNICAL_PASS_REQUIRES_REVIEW' if passed else 'REJECTED_TECHNICAL_FAILURE',
            'scope': 'Paired MLX unconstrained diagnostic. No schema-constrained Ollama verification and no professional legal validation.',
            'inputSha256': digest(path), 'scorerSha256': digest(__file__),
            'referenceEvaluatorSha256': digest(module_path),
            'applicationEvaluatorSha256': digest(ROOT / 'scripts/evaluate-lightweight-skills.mjs'),
            'semanticReview': 'pending; raw outputs require case-specific inspection',
            'summary': summary, 'results': scored}


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('input', type=Path)
    p.add_argument('--output', type=Path, required=True)
    a = p.parse_args()
    if a.output.exists():
        raise ValueError('Preserve previous scoring output')
    result = score(a.input)
    a.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'status': result['status'], 'summary': result['summary']}))
