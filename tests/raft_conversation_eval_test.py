"""CPU-only negative checks for the nightly conversation diagnostic scorer."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts/qwen-training"))
from raft_conversation_eval import score, validate_suite


class ConversationEvaluationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.suite = json.loads((ROOT / "eval/conversation-nightly-2026-11-03.json").read_text())

    def case(self, identity):
        return next(x for x in self.suite["cases"] if x["id"] == identity)

    def test_correct_context_is_required_and_truncated_output_is_not_success(self):
        case = self.case("name-followup")
        self.assertTrue(all(score(case, "Te llamas Dafne Niebla.", "stop").values()))
        self.assertFalse(all(score(case, "Te llamas Ulises Tizon.", "stop").values()))
        self.assertFalse(all(score(case, "Te llamas Dafne Niebla.", "length").values()))

    def test_thread_isolation_and_unprovided_citations_fail(self):
        case = self.case("fresh-thread-isolation")
        self.assertTrue(all(score(case, "No conozco tu nombre todavía.", "stop").values()))
        self.assertFalse(all(score(case, "No sé, quizá Dafne.", "stop").values()))
        self.assertFalse(all(score(case, "No conozco tu nombre [S1].", "stop").values()))

    def test_draft_send_claims_and_numeric_deadlines_fail(self):
        self.assertFalse(all(score(self.case("draft-followup"), "Ya envié el correo. Dafne Niebla.", "stop").values()))
        self.assertFalse(all(score(self.case("missing-legal-context"), "Necesito datos; quizá sean 15 días.", "stop").values()))

    def test_evaluation_names_must_be_absent_from_training(self):
        with tempfile.TemporaryDirectory() as folder:
            training = Path(folder) / "train.jsonl"
            training.write_text("Datos enteramente ficticios sin nombres retenidos.")
            path = ROOT / "eval/conversation-nightly-2026-11-03.json"
            self.assertEqual(len(validate_suite(path, training)["cases"]), 10)
            training.write_text("Hola, soy Dafne Niebla.")
            with self.assertRaisesRegex(ValueError, "leaked"):
                validate_suite(path, training)


if __name__ == "__main__":
    unittest.main()
