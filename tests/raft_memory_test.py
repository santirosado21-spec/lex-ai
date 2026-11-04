"""macOS accounting: speculative read-ahead is free, counted exactly once."""
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts/raft"))
from runtime_memory import memory_snapshot
from training_support import require_memory


class MemoryTests(unittest.TestCase):
    def snapshot(self, text):
        result = subprocess.CompletedProcess([], 0, text, "")
        with patch("runtime_memory.sys.platform", "darwin"), patch("runtime_memory.subprocess.run", return_value=result):
            return memory_snapshot()

    def test_speculative_counted_once_without_overlapping_counters(self):
        m = self.snapshot('Mach Virtual Memory Statistics: (page size of 16384 bytes)\nPages free: 10.\nPages inactive: 20.\nPages speculative: 30.\nPages active: 9000.\nPages purgeable: 9000.\nFile-backed pages: 9000.\nPages occupied by compressor: 9000.\n')
        self.assertEqual(m['availableBytes'], 60 * 16384)
        self.assertEqual(m['legacyAvailableBytes'], 30 * 16384)
        self.assertEqual(m['speculativeBytes'], 30 * 16384)
        with self.assertRaises(RuntimeError):
            require_memory(m, 2)

    def test_missing_speculative_refuses_to_guess(self):
        with self.assertRaises(RuntimeError):
            self.snapshot('page size of 16384 bytes\nPages free: 10.\nPages inactive: 20.\n')

    def test_malformed_page_size_refuses_to_guess(self):
        with self.assertRaises(RuntimeError):
            self.snapshot('page size unknown\nPages free: 10.\nPages inactive: 20.\nPages speculative: 30.\n')


if __name__ == '__main__':
    unittest.main()
