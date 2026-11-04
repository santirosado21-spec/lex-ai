"""Fixed conversation holdout is excluded from every training epoch."""
import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts/qwen-training"))
from raft_train import conversational_split


class ConversationSplitTests(unittest.TestCase):
    def data(self):
        return {"train": [{"id": f"chat-{i}", "metadata": {"type": "chat"}} for i in range(640)] +
                         [{"id": "legal-train", "metadata": {"type": "grounded"}}],
                "valid": [{"id": "legal-valid", "metadata": {"type": "grounded"}}]}

    def test_fixed_holdout_never_enters_train_and_legal_validation_stays(self):
        data = self.data()
        before = copy.deepcopy(data)
        result, ids = conversational_split(data)
        self.assertEqual(data, before)
        self.assertEqual(len(result['train']), 512)
        self.assertEqual(len(result['valid']), 129)
        self.assertFalse(set(ids['train']) & set(ids['conversationValidation']))
        self.assertNotIn('legal-train', ids['train'])
        self.assertEqual(ids['legalValidation'], ['legal-valid'])
        self.assertEqual(ids, conversational_split(self.data())[1])

    def test_changed_or_duplicate_chat_pool_is_rejected(self):
        for duplicate in [False, True]:
            data = self.data()
            if duplicate:
                data['train'][1]['id'] = data['train'][0]['id']
            else:
                data['train'].pop(0)
            with self.assertRaises(ValueError):
                conversational_split(data)


if __name__ == '__main__':
    unittest.main()
