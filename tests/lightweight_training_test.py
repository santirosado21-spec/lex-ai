import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('light_training', Path(__file__).resolve().parents[1] / 'scripts/train-lightweight-adapter.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class Tokenizer:
    def apply_chat_template(self, messages, tokenize, add_generation_prompt):
        # Synthetic template with an intentionally non-Gemma4 EOS.
        text = ''.join(f'{x["role"]}:{x["content"]}|END3|' for x in messages)
        if add_generation_prompt:
            text += 'assistant:'
        return list(text.encode()) if tokenize else text

    def encode(self, text, add_special_tokens):
        assert not add_special_tokens
        return list(text.encode())


def row(index, task='quote'):
    return {'messages': [{'role': 'system', 'content': 's'}, {'role': 'user', 'content': 'u'}, {'role': 'assistant', 'content': '{}'}],
            'metadata': {'id': str(index), 'task': task, 'lawId': 'A', 'split': 'train'}}


class LightweightTrainingTests(unittest.TestCase):
    def test_template_derived_completion_and_mask_boundary(self):
        tokens, start = m.encode_row(row(1), Tokenizer())
        self.assertEqual(bytes(tokens[start:]), b'{}|END3|')
        self.assertNotIn(b'<turn|>', bytes(tokens))

    def test_template_prefix_mismatch_is_rejected(self):
        class Bad(Tokenizer):
            def apply_chat_template(self, messages, **kwargs):
                result = super().apply_chat_template(messages, **kwargs)
                if kwargs['add_generation_prompt']:
                    result = 'mismatch' + result
                return result
        with self.assertRaisesRegex(ValueError, 'generation prefix'):
            m.encode_row(row(1), Bad())

    def test_balanced_selection_no_target_truncation(self):
        rows = [row(i, str(i % 4)) for i in range(20)]
        rows[0]['messages'][-1]['content'] = 'x' * 1000
        data = m.Dataset(rows, Tokenizer(), 256, 8)
        self.assertEqual(len(data), 8)
        self.assertEqual(data.rejected, 1)
        self.assertTrue(all(len(v[0]) <= 256 for v in data.data))
        self.assertNotIn('0', [r['metadata']['id'] for r in data.rows])
        self.assertEqual(set(r['metadata']['task'] for r in data.rows), {'0', '1', '2', '3'})

    def fixture_base(self, root):
        base = root / 'base'
        base.mkdir()
        cfg = {'model_type': 'gemma3_text', 'hidden_size': 1152, 'num_hidden_layers': 26, 'quantization': {'bits': 4}}
        (base / 'config.json').write_text(json.dumps(cfg))
        for name in ('tokenizer.json', 'tokenizer_config.json', 'model.safetensors'):
            (base / name).write_bytes(b'test-only')
        manifest = {'repo': m.REPO, 'revision': m.REVISION, 'license': 'gemma',
                    'files': [{'file': p.name, 'bytes': p.stat().st_size, 'sha256': m.digest(p)} for p in base.iterdir()]}
        p = root / 'manifest.json'
        p.write_text(json.dumps(manifest))
        return base, p, manifest

    def test_pinned_small_base_hashes_and_architecture(self):
        with tempfile.TemporaryDirectory() as d:
            base, p, manifest = self.fixture_base(Path(d))
            self.assertEqual(m.verify_base(base, p)['revision'], m.REVISION)
            (base / 'model.safetensors').write_bytes(b'tampered')
            with self.assertRaisesRegex(ValueError, 'hash mismatch'):
                m.verify_base(base, p)

    def test_rejects_big_model_provenance_and_unlisted_weights(self):
        with tempfile.TemporaryDirectory() as d:
            base, p, manifest = self.fixture_base(Path(d))
            manifest['repo'] = 'mlx-community/gemma-4-26b-a4b-it-4bit'
            p.write_text(json.dumps(manifest))
            with self.assertRaisesRegex(ValueError, 'incompatible'):
                m.verify_base(base, p)
            manifest['repo'] = m.REPO
            p.write_text(json.dumps(manifest))
            (base / 'old-adapter.safetensors').write_bytes(b'old')
            with self.assertRaisesRegex(ValueError, 'Unlisted'):
                m.verify_base(base, p)

    def test_lock_collision_does_not_remove_foreign_owner(self):
        with tempfile.TemporaryDirectory() as d:
            directory = Path(d)
            (directory / 'gpu.lock').write_text('{"id":"foreign"}')
            with self.assertRaises(FileExistsError):
                m.claim_locks(directory)
            self.assertFalse((directory / 'pipeline.lock').exists())
            self.assertEqual(json.loads((directory / 'gpu.lock').read_text())['id'], 'foreign')

    def test_law_holdout_and_file_integrity(self):
        with tempfile.TemporaryDirectory() as d:
            directory = Path(d)
            manifest = {'lawGroups': {'train': ['A'], 'valid': ['B'], 'test': ['C']}, 'files': {}}
            for split, law in [('train', 'A'), ('valid', 'B'), ('test', 'C')]:
                r = row(1)
                r['metadata'].update(lawId=law, split=split)
                p = directory / f'{split}.jsonl'
                p.write_text(json.dumps(r) + '\n')
                manifest['files'][split] = {'sha256': m.digest(p)}
            p = directory / 'manifest.json'
            p.write_text(json.dumps(manifest))
            data, _ = m.read_data(directory)
            self.assertEqual(data['test'][0]['metadata']['lawId'], 'C')
            manifest['lawGroups']['test'].append('A')
            p.write_text(json.dumps(manifest))
            with self.assertRaisesRegex(ValueError, 'split leakage'):
                m.read_data(directory)


if __name__ == '__main__':
    unittest.main()
