"""Build a law-disjoint continuation dataset for strict multiline JSON grounding.

Only the system prompt is reused from the held-out application trace. Targets
are mechanical passage comparisons, not legal opinions. No MLX/GPU imports.
"""
import argparse
import hashlib
import json
import random
import re
import shutil
import tempfile
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlparse

TASKS = ('quote', 'injection', 'abstain', 'missing_source')
FORBIDDEN = ('$20,000', '15 de noviembre de 2026', 'Empresa Ejemplo Alfa',
             'Consultoría Ejemplo Beta', 'modificar unilateralmente el precio',
             'Contrasta la cláusula de modificación unilateral',
             'La validez y el cumplimiento de los contratos no puede dejarse al arbitrio')
CLAUSES = (
    'Archivo: cada participante conservará una copia del registro de recepción.',
    'Anexos: la relación de materiales se incorporará en una hoja separada.',
    'Comunicación: los avisos del proyecto se anotarán en el cuaderno de seguimiento.',
    'Revisión: las observaciones se reunirán en una lista compartida entre las partes.',
    'Entrega: la recepción del inventario se documentará mediante una constancia escrita.',
    'Custodia: el responsable guardará los originales en una carpeta identificada.',
    'Alcance: el encargo comprende únicamente la organización del archivo de práctica.',
    'Registro: las partes conservarán la lista de versiones del documento de trabajo.',
    'Acuse: la persona receptora anotará las piezas recibidas en el formato de control.',
    'Pendientes: las dudas sobre el anexo se recogerán en una nota para revisión posterior.',
)
QUESTIONS = (
    'Compara los dos pasajes aportados y distingue el documento interno de la copia jurídica. Señala los límites de la comparación.',
    'Resume por separado el pasaje documental y el jurídico, con citas de ambos y sin decidir su aplicación al caso.',
    'Prepara una nota breve de revisión documental basada únicamente en las dos fuentes y sus limitaciones.',
)


def sha(data):
    return hashlib.sha256(data.encode() if isinstance(data, str) else data).hexdigest()


def filehash(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def compact(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))


def token_length(tokenizer, row):
    messages = row['messages']
    prefix = tokenizer.apply_chat_template(messages[:-1], tokenize=True, return_dict=False,
                                          add_generation_prompt=True, enable_thinking=False)
    completion = tokenizer.encode(messages[-1]['content'] + '<turn|>\n', add_special_tokens=False)
    return len(prefix) + len(completion)


def excluded(row):
    text = compact(row)
    return any(term in text for term in FORBIDDEN) or (
        row['metadata']['lawId'] == 'MX-FED-CCF' and ':art:1797' in row['metadata']['sourceId'])


def workflow(row, system, variant):
    meta = row['metadata']
    source = json.loads(row['messages'][1]['content'])['sources'][0]
    quote = source['text']
    citation = json.loads(row['messages'][2]['content'])['citations'][0]
    if citation['quote'] != quote or citation['sourceId'] != source['id']:
        raise ValueError('Parent quote is not an exact source span')
    if urlparse(meta['sourceUrl']).hostname not in {'www.diputados.gob.mx', 'diputados.gob.mx', 'www.congresocdmx.gob.mx', 'congresocdmx.gob.mx'}:
        raise ValueError('Public source is not an approved official host')
    if any(not re.fullmatch('[0-9a-f]{64}', meta.get(key, '')) for key in ('textSha256', 'pdfSha256')):
        raise ValueError('Missing source proof')
    clause = CLAUSES[variant % len(CLAUSES)]
    document = 'DOCUMENTO SINTÉTICO DE PRÁCTICA. Sin clientes ni obligaciones reales.\n' + clause
    sources = [
        {'id': 'D1', 'category': 'internal-firm-document', 'text': document, 'allowedQuotes': [clause]},
        {'id': 'L1', 'category': 'official-public-legislation', 'article': source.get('article'),
         'text': quote, 'allowedQuotes': [quote], 'currentness': 'unverified'},
    ]
    first = f'El documento sintético recoge: «{clause}». Es un pasaje interno. [D1]'
    second = f'La copia jurídica aportada contiene: «{quote}». [L1]'
    limit = 'Estos pasajes se presentan para comparación documental; su relación jurídica, aplicación y vigencia requieren revisión profesional. [D1] [L1]'
    paragraphs = [first, second, limit] if variant % 2 else [first, second[:-5] + ' ' + limit]
    answer = {'analysis': '\n\n'.join(paragraphs), 'citations': [
        {'sourceId': 'D1', 'quote': clause}, {'sourceId': 'L1', 'quote': quote}]}
    answer_text = compact(answer)  # Escapes every newline INSIDE the JSON string.
    if '\n' in answer_text or '\r' in answer_text:
        raise ValueError('Unescaped control character in target JSON')
    metadata = dict(meta, id=sha(meta['id'] + ':workflow-v3'), task='workflow_compare',
                    synthetic=True, parentExampleId=meta['id'],
                    syntheticScope='internal document and task only; legal quote copied from public source',
                    targetMethod='verbatim-two-source-comparison-with-conservative-review-limit',
                    legalQuoteSha256=sha(quote), syntheticDocumentSha256=sha(document),
                    systemPromptSha256=sha(system))
    return {'messages': [{'role': 'system', 'content': system},
                         {'role': 'user', 'content': compact({'question': QUESTIONS[variant % len(QUESTIONS)], 'sources': sources})},
                         {'role': 'assistant', 'content': answer_text}], 'metadata': metadata}


def assemble(records, manifest, system, tokenizer, max_tokens=1024, train_per_law=10, valid_per_law=2):
    laws = {k: set(v) for k, v in manifest['lawGroups'].items()}
    if laws['train'] & laws['valid'] or laws['train'] & laws['test'] or laws['valid'] & laws['test']:
        raise ValueError('Law-level split leakage')
    rejected = Counter()
    groups = {part: defaultdict(list) for part in records}
    for part, rows in records.items():
        for row in rows:
            meta = row['metadata']
            if meta['split'] != part or meta['lawId'] not in laws[part]:
                raise ValueError('Row does not match inherited law partition')
            groups[part][meta['lawId']].append(row)
    output = {'train': [], 'valid': list(records['valid']), 'test': list(records['test'])}
    workflow_counts = Counter()
    for part, per_law in [('train', train_per_law), ('valid', valid_per_law)]:
        for law_index, law in enumerate(sorted(laws[part])):
            candidates = sorted(groups[part][law], key=lambda r: sha(r['metadata']['id']))
            taken = 0
            for row in candidates:
                if taken >= per_law or (part == 'train' and workflow_counts[part] >= 2500):
                    break
                if row['metadata']['task'] != 'quote':
                    continue
                if excluded(row):
                    rejected['held_out_application_overlap'] += 1
                    continue
                candidate = workflow(row, system, law_index + taken)
                if token_length(tokenizer, candidate) > max_tokens:
                    rejected['workflow_over_token_budget'] += 1
                    continue
                output[part].append(candidate)
                workflow_counts[part] += 1
                taken += 1
            if not taken:
                raise ValueError(f'No bounded workflow example for {law}')
    replay_counts = Counter()
    for law_index, law in enumerate(sorted(laws['train'])):
        for offset in range(2):
            task = TASKS[(2 * law_index + offset) % len(TASKS)]
            candidates = sorted(groups['train'][law], key=lambda r: sha(r['metadata']['id']))
            row = next((r for r in candidates if r['metadata']['task'] == task and not excluded(r)), None)
            if row is None:
                raise ValueError(f'Missing original replay task {task}: {law}')
            output['train'].append(row)
            replay_counts[task] += 1
    random.Random(20261030).shuffle(output['train'])
    lengths = {}
    for part, rows in output.items():
        sizes = [token_length(tokenizer, row) for row in rows]
        if not sizes or max(sizes) > max_tokens:
            raise ValueError(f'{part}: inherited or generated data exceeds token budget; no truncation permitted')
        lengths[part] = {'max': max(sizes), 'min': min(sizes), 'examplesChecked': len(sizes)}
    return output, {'workflowCounts': dict(workflow_counts), 'replayCounts': dict(replay_counts),
                    'rejected': dict(rejected), 'tokenAudit': lengths}


def build(parent, trace, base, output, tokenizer=None):
    parent, trace, base, output = map(Path, (parent, trace, base, output))
    if output.exists():
        raise ValueError('Output already exists; refusing to replace dataset')
    manifest = json.loads((parent / 'manifest.json').read_text())
    records = {}
    for part in ('train', 'valid', 'test'):
        path = parent / f'{part}.jsonl'
        if filehash(path) != manifest['files'][part]['sha256']:
            raise ValueError('Parent dataset hash mismatch')
        records[part] = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
        if len(records[part]) != manifest['files'][part]['examples']:
            raise ValueError('Parent example count mismatch')
    corpus = parent / 'source-corpus.jsonl'
    if filehash(corpus) != manifest['sourceFileSha256']:
        raise ValueError('Parent source corpus hash mismatch')
    system = json.loads(trace.read_text())['messages'][0]
    if system['role'] != 'system' or 'Devuelve SOLO JSON válido' not in system['content']:
        raise ValueError('Trace does not contain expected application system prompt')
    if tokenizer is None:
        from transformers import AutoTokenizer
        tokenizer = AutoTokenizer.from_pretrained(str(base), local_files_only=True, trust_remote_code=False)
    output_records, audit = assemble(records, manifest, system['content'], tokenizer)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix=output.name + '.building-', dir=output.parent))
    try:
        shutil.copyfile(corpus, temporary / 'source-corpus.jsonl')
        files = {}
        for part, rows in output_records.items():
            path = temporary / f'{part}.jsonl'
            if part == 'test':
                shutil.copyfile(parent / 'test.jsonl', path)
            elif part == 'valid':
                original = (parent / 'valid.jsonl').read_bytes()
                if original and not original.endswith(b'\n'):
                    raise ValueError('Parent validation JSONL lacks final newline')
                path.write_bytes(original + ''.join(compact(r) + '\n' for r in rows[len(records['valid']):]).encode())
            else:
                path.write_text(''.join(compact(r) + '\n' for r in rows))
            files[part] = {'sha256': filehash(path), 'examples': len(rows)}
        if files['test']['sha256'] != manifest['files']['test']['sha256']:
            raise ValueError('Frozen test changed')
        result = dict(audit, lawGroups=manifest['lawGroups'], counts={k: len(v) for k,v in output_records.items()}, files=files,
                      sourceFileSha256=manifest['sourceFileSha256'], builderSha256=filehash(__file__),
                      scope='Strict multiline JSON, two-source verbatim grounding and conservative review limits, with original task replay. Does not establish professional legal accuracy or current law.',
                      parentManifestSha256=filehash(parent / 'manifest.json'), frozenTestSha256=files['test']['sha256'],
                      applicationSystemPromptSha256=sha(system['content']), maxSequenceLength=1024, truncation=False,
                      tokenizer={'configSha256': filehash(base / 'tokenizer_config.json'),
                                 'chatTemplateSha256': filehash(base / 'chat_template.jinja'),
                                 'tokenizerSha256': filehash(base / 'tokenizer.json'),
                                 'method': 'generation prefix, enable_thinking=False; completion JSON + <turn|> newline; no BOS on completion'},
                      heldOutApplicationExclusions=list(FORBIDDEN), syntheticDocumentsOnly=True)
        (temporary / 'manifest.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
        temporary.rename(output)
        return result
    finally:
        if temporary.exists():
            shutil.rmtree(temporary)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--parent', default='artifacts/training/dataset-v2')
    p.add_argument('--trace', default='artifacts/training/runtime-v2-r2/candidate-synthetic-trace.json')
    p.add_argument('--base', default='artifacts/training/base-gemma4-26b')
    p.add_argument('--output', default='artifacts/training/dataset-v3')
    a = p.parse_args()
    result = build(a.parent, a.trace, a.base, a.output)
    print(json.dumps({k: result[k] for k in ('counts', 'workflowCounts', 'replayCounts', 'tokenAudit', 'files', 'rejected')}, indent=2))


if __name__ == '__main__':
    main()
