import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


m = load('workflow_data', 'build-workflow-training-data.py')
original = load('original_data', 'build-training-data.py')


class Tokenizer:
    def apply_chat_template(self, messages, **kwargs):
        assert kwargs == dict(tokenize=True, return_dict=False, add_generation_prompt=True, enable_thinking=False)
        return list(range(100))

    def encode(self, text, **kwargs):
        assert text.endswith('<turn|>\n')
        assert kwargs == {'add_special_tokens': False}
        return list(range(len(text) // 4))


def fixtures():
    rows = []
    for law, split in [('A', 'train'), ('B', 'train'), ('C', 'valid'), ('D', 'test')]:
        for article in range(1, 4):
            text = f'Artículo {article} de {law}: este es un pasaje ficticio de prueba para verificar citas y la separación de los datos por ley.'
            rows.append({'id': f'{law}:art:{article}', 'lawId': law, 'split': split,
                         'articleId': str(article), 'text': text, 'textSha256': m.sha(text),
                         'sourceUrl': 'https://www.diputados.gob.mx/LeyesBiblio/pdf/fixture.pdf',
                         'pdfSha256': 'a' * 64})
    return original.build_records(rows)


class WorkflowDataTests(unittest.TestCase):
    def setUp(self):
        self.records, self.manifest = fixtures()
        self.system = 'Devuelve SOLO JSON válido. Usa únicamente las fuentes aportadas.'

    def quote(self):
        return next(r for r in self.records['train'] if r['metadata']['task'] == 'quote')

    def test_strict_escaped_multiline_targets_exact_citations(self):
        for variant in range(10):
            row = m.workflow(self.quote(), self.system, variant)
            text = row['messages'][2]['content']
            self.assertNotIn('\n', text)
            self.assertIn('\\n\\n', text)
            answer = json.loads(text)
            prompt = json.loads(row['messages'][1]['content'])
            self.assertEqual(set(answer), {'analysis', 'citations'})
            self.assertEqual(len(answer['analysis'].split('\n\n')), 2 + variant % 2)
            for paragraph in answer['analysis'].split('\n\n'):
                self.assertRegex(paragraph, r'\[(D1|L1)\]$')
            self.assertEqual({c['sourceId'] for c in answer['citations']}, {'D1', 'L1'})
            for citation in answer['citations']:
                source = next(s for s in prompt['sources'] if s['id'] == citation['sourceId'])
                self.assertIn(citation['quote'], source['allowedQuotes'])
                self.assertIn(citation['quote'], source['text'])
            self.assertIn('requieren revisión profesional', answer['analysis'])
            self.assertTrue(row['metadata']['synthetic'])
            self.assertFalse(any(t in m.compact(row) for t in m.FORBIDDEN))
            for key in ('pdfSha256', 'textSha256', 'sourceUrl', 'sourceId', 'lawId', 'split'):
                self.assertEqual(row['metadata'][key], self.quote()['metadata'][key])

    def test_retains_test_validation_and_replays_all_original_tasks(self):
        output, audit = m.assemble(self.records, self.manifest, self.system, Tokenizer())
        self.assertEqual(output['test'], self.records['test'])
        self.assertEqual(output['valid'][:len(self.records['valid'])], self.records['valid'])
        self.assertEqual(audit['workflowCounts'], {'train': 6, 'valid': 2})
        self.assertEqual(audit['replayCounts'], dict.fromkeys(m.TASKS, 1))
        for split, rows in output.items():
            self.assertTrue(all(r['metadata']['lawId'] in self.manifest['lawGroups'][split] for r in rows))

    def test_rejects_split_leakage(self):
        self.manifest['lawGroups']['test'].append('A')
        with self.assertRaisesRegex(ValueError, 'split leakage'):
            m.assemble(self.records, self.manifest, self.system, Tokenizer())

    def test_never_truncates_original_long_rows(self):
        self.records['test'][0]['messages'][-1]['content'] = 'X' * 5000
        with self.assertRaisesRegex(ValueError, 'no truncation'):
            m.assemble(self.records, self.manifest, self.system, Tokenizer())

    def test_rejects_non_official_source_or_bad_quote(self):
        row = self.quote()
        row['metadata']['sourceUrl'] = 'https://external.test/fixture.pdf'
        with self.assertRaisesRegex(ValueError, 'official host'):
            m.workflow(row, self.system, 0)
        row['metadata']['sourceUrl'] = 'https://www.diputados.gob.mx/fixture.pdf'
        answer = json.loads(row['messages'][2]['content'])
        answer['citations'][0]['quote'] = 'inventado'
        row['messages'][2]['content'] = json.dumps(answer)
        with self.assertRaisesRegex(ValueError, 'exact source span'):
            m.workflow(row, self.system, 0)

    def test_application_fixture_exclusions(self):
        row = self.quote()
        self.assertFalse(m.excluded(row))
        row['metadata']['lawId'] = 'MX-FED-CCF'
        row['metadata']['sourceId'] = 'MX-FED-CCF@revision:art:1797'
        self.assertTrue(m.excluded(row))

    def setup_disk(self, root):
        parent = root / 'parent'
        parent.mkdir()
        manifest = dict(self.manifest, files={})
        for split, rows in self.records.items():
            p = parent / f'{split}.jsonl'
            p.write_text(''.join(json.dumps(r, ensure_ascii=False) + '\n' for r in rows))
            manifest['files'][split] = {'sha256': m.filehash(p), 'examples': len(rows)}
        (parent / 'source-corpus.jsonl').write_text('synthetic source proof fixture\n')
        manifest['sourceFileSha256'] = m.filehash(parent / 'source-corpus.jsonl')
        (parent / 'manifest.json').write_text(json.dumps(manifest))
        trace = root / 'trace.json'
        trace.write_text(json.dumps({'messages': [{'role': 'system', 'content': self.system},
                                               {'role': 'user', 'content': 'HELD OUT QUESTION NEVER COPIED'}]}))
        base = root / 'base'
        base.mkdir()
        for name in ('tokenizer_config.json', 'tokenizer.json', 'chat_template.jinja'):
            (base / name).write_text('{}')
        return parent, trace, base

    def test_build_freezes_test_bytes_and_parent_without_trace_question(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            parent, trace, base = self.setup_disk(root)
            before = {p.name: m.filehash(p) for p in parent.iterdir()}
            result = m.build(parent, trace, base, root / 'output', Tokenizer())
            self.assertEqual((parent / 'test.jsonl').read_bytes(), (root / 'output/test.jsonl').read_bytes())
            self.assertTrue((root / 'output/valid.jsonl').read_bytes().startswith((parent / 'valid.jsonl').read_bytes()))
            self.assertEqual(before, {p.name: m.filehash(p) for p in parent.iterdir()})
            self.assertNotIn('HELD OUT QUESTION', (root / 'output/train.jsonl').read_text())
            self.assertEqual(result['frozenTestSha256'], before['test.jsonl'])
            for split in self.records:
                self.assertEqual(result['files'][split]['sha256'], m.filehash(root / f'output/{split}.jsonl'))
            with self.assertRaisesRegex(ValueError, 'already exists'):
                m.build(parent, trace, base, root / 'output', Tokenizer())

    def test_build_rejects_tampered_parent(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            parent, trace, base = self.setup_disk(root)
            with (parent / 'train.jsonl').open('a') as f:
                f.write('\n')
            with self.assertRaisesRegex(ValueError, 'hash mismatch'):
                m.build(parent, trace, base, root / 'output', Tokenizer())
            self.assertFalse((root / 'output').exists())


if __name__ == '__main__':
    unittest.main()
