import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
spec = importlib.util.spec_from_file_location('light_score', ROOT / 'scripts/score-lightweight-training.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
stop_spec = importlib.util.spec_from_file_location('light_eval_stop', ROOT / 'scripts/evaluate-lightweight-adapter.py')
stop_module = importlib.util.module_from_spec(stop_spec)
stop_spec.loader.exec_module(stop_module)


class ScoringTests(unittest.TestCase):
    def fixture(self):
        quote = 'Las partes del documento sintético conservarán una constancia escrita de la recepción.'
        source = {'id': 'D1', 'text': quote, 'allowedQuotes': [quote]}
        good = json.dumps({'analysis': 'El documento aportado conserva el siguiente pasaje para revisión profesional del asunto. [D1]',
                           'citations': [{'sourceId': 'D1', 'quote': quote}]})
        case = {'id': 'app:normal', 'kind': 'application-regression', 'case': {'evidence': [source], 'question': 'Resume el documento.'}}
        return {'cases': [case], 'base': [{'id': case['id'], 'kind': case['kind'], 'raw': good, 'doneReason': 'stop'}],
                'candidate': [{'id': case['id'], 'kind': case['kind'], 'raw': good, 'doneReason': 'stop'}]}

    def score(self, payload):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 'behavior.json'
            p.write_text(json.dumps(payload))
            return m.score(p)

    def test_valid_pair_is_only_technical_not_legal_approval(self):
        result = self.score(self.fixture())
        self.assertEqual(result['status'], 'TECHNICAL_PASS_REQUIRES_REVIEW')
        self.assertEqual(result['summary']['application-regression']['candidate']['passed'], 1)
        self.assertIn('pending', result['semanticReview'])

    def test_candidate_missing_reference_rejects_even_with_valid_json(self):
        data = self.fixture()
        answer = json.loads(data['candidate'][0]['raw'])
        answer['analysis'] = answer['analysis'].replace('[D1]', '')
        data['candidate'][0]['raw'] = json.dumps(answer)
        result = self.score(data)
        self.assertEqual(result['status'], 'REJECTED_TECHNICAL_FAILURE')
        self.assertEqual(result['summary']['application-regression']['base']['passed'], 1)
        self.assertEqual(result['summary']['application-regression']['candidate']['passed'], 0)

    def test_missing_or_reordered_cases_cannot_be_scored(self):
        data = self.fixture()
        data['candidate'] = []
        with self.assertRaisesRegex(ValueError, 'unpaired'):
            self.score(data)

    def test_chat_turn_stop_is_verified_and_added_without_removing_eos(self):
        class Tokenizer:
            eos_token_ids = {1}
            def convert_tokens_to_ids(self, token):
                return 106 if token == '<end_of_turn>' else None
            def add_eos_token(self, token):
                self.eos_token_ids = self.eos_token_ids | {self.convert_tokens_to_ids(token)}
        with tempfile.TemporaryDirectory() as d:
            base = Path(d)
            p = base / 'tokenizer.json'
            p.write_text(json.dumps({'added_tokens': [{'id': 106, 'content': '<end_of_turn>', 'special': True}]}))
            policy = stop_module.configure_turn_stop(Tokenizer(), base)
            self.assertEqual(policy['originalEosTokenIds'], [1])
            self.assertEqual(policy['effectiveEosTokenIds'], [1, 106])
            p.write_text(json.dumps({'added_tokens': [{'id': 999, 'content': '<end_of_turn>', 'special': True}]}))
            with self.assertRaisesRegex(ValueError, 'not verified'):
                stop_module.configure_turn_stop(Tokenizer(), base)


if __name__ == '__main__':
    unittest.main()
