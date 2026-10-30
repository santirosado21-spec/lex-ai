"""Tiny CPU-only fixtures for experimental model release gates and TAR integrity."""
import contextlib
import copy
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import struct
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/package-trained-model.py"
SPEC = importlib.util.spec_from_file_location("model_package", SCRIPT)
package = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(package)
ARCHIVE_ROOT = "LEX-Gemma4-Experimental/"


def save_json(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n")


def record(path):
    return {"file": path.name, "bytes": path.stat().st_size, "sha256": package.digest(path)}


class ModelPackageTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.candidate, self.adapter = self.root / "candidate", self.root / "adapter"
        self.candidate.mkdir()
        self.adapter.mkdir()
        self.output = self.root / "model.tar"
        self.runtime_path = self.root / "runtime.json"
        self.adapter_config = {"model": str(package.ROOT / "artifacts/training/base"),
                               "data": str(package.ROOT / "artifacts/training/data"),
                               "adapter_path": str(package.ROOT / "artifacts/training/adapter")}
        save_json(self.adapter / "adapter_config.json", self.adapter_config)
        (self.adapter / "adapters.safetensors").write_bytes(b"synthetic adapter fixture")
        adapter_sha = package.digest(self.adapter / "adapters.safetensors")
        config_sha = package.digest(self.adapter / "adapter_config.json")
        header = json.dumps({"fixture.weight": {"dtype": "F32", "shape": [1], "data_offsets": [0, 4]}}).encode()
        header += b" " * (-len(header) % 8)
        shard = "model-00001-of-00001.safetensors"
        (self.candidate / shard).write_bytes(struct.pack("<Q", len(header)) + header + struct.pack("<f", 1))
        save_json(self.candidate / "model.safetensors.index.json", {"weight_map": {"fixture.weight": shard}})
        save_json(self.candidate / "config.json", {"model_type": "gemma4"})
        save_json(self.candidate / "tokenizer_config.json", {"chat_template": "synthetic"})
        save_json(self.candidate / "tokenizer.json", {"version": "1.0"})
        (self.candidate / "LICENSE").write_text("Apache-2.0 synthetic packaging fixture\n")
        (self.candidate / "Modelfile").write_text("FROM .\nRENDERER gemma4-large\nPARSER gemma4\n")
        self.manifest = {"schemaVersion": 1, "source": {"repo": "public/base", "revision": "a" * 40},
                         "adapter": {"files": [record(self.adapter / name) for name in ("adapters.safetensors", "adapter_config.json")],
                                     "configuration": self.adapter_config},
                         "files": [record(path) for path in sorted(self.candidate.iterdir())]}
        contract = {"dataSha256": "b" * 64, "caseIds": ["case1", "case2"], "base": {"revision": "a" * 40}}
        self.reports = {
            "training-report.json": {"status": "TRAINED_EXPERIMENTAL", "steps": 400, "adapterSha256": adapter_sha,
                                     "config": self.adapter_config},
            "dataset-audit.json": {"counts": {"test": 2}},
            "behavior-base.json": {"contract": copy.deepcopy(contract), "mode": "base"},
            "behavior-candidate.json": {"contract": copy.deepcopy(contract), "mode": "candidate",
                                        "gate": {"passed": True}, "adapterSha256": adapter_sha, "adapterConfigSha256": config_sha},
            "behavior-imported.json": {"contract": copy.deepcopy(contract), "mode": "imported",
                                       "gate": {"passed": True}, "adapterSha256": adapter_sha, "adapterConfigSha256": config_sha,
                                       "scope": "Synthetic protocol test, not legal validity", "metrics": {"cases": 2},
                                       "cases": [{"id": "case1", "passed": True}, {"id": "case2", "passed": True}],
                                       "runtime": {"modelName": "lex-gemma4-experimental:v2-r2", "modelDigest": "c" * 64,
                                                   "endpoint": "http://127.0.0.1:12345"}},
        }
        self.runtime = {"status": "PASS", "technicalGatePassed": True,
                        "model": "lex-gemma4-experimental:v2-r2", "importedModelDigest": "c" * 64}
        self.persist()

    def persist(self):
        save_json(self.candidate / "export-manifest.json", self.manifest)
        digest = package.digest(self.candidate / "export-manifest.json")
        (self.candidate / "export-manifest.sha256").write_text(digest + "  export-manifest.json\n")
        self.runtime["exportManifestSha256"] = digest
        for name, value in self.reports.items():
            save_json(self.adapter / name, value)
        self.runtime["importedBehaviorSha256"] = package.digest(self.adapter / "behavior-imported.json")
        save_json(self.runtime_path, self.runtime)

    def run_package(self):
        argv = [str(SCRIPT), "--candidate", str(self.candidate), "--adapter", str(self.adapter),
                "--runtime-report", str(self.runtime_path), "--output", str(self.output)]
        with patch.object(sys, "argv", argv), contextlib.redirect_stdout(io.StringIO()):
            package.main()

    def test_valid_tiny_package_redacts_manifest_and_preserves_payload_hashes(self):
        before = {path: package.digest(path) for path in self.candidate.iterdir()}
        self.run_package()
        self.assertTrue(self.output.is_file())
        self.assertEqual(self.output.with_suffix(".tar.sha256").read_text().split()[0], package.digest(self.output))
        with tarfile.open(self.output) as archive:
            def read(name): return archive.extractfile(ARCHIVE_ROOT + name).read()
            manifest_bytes = read("model/export-manifest.json")
            distributed = json.loads(manifest_bytes)
            metadata = json.loads(read("DISTRIBUTION.json"))
            distributed_sha = hashlib.sha256(manifest_bytes).hexdigest()
            self.assertEqual(read("model/export-manifest.sha256").decode().split()[0], distributed_sha)
            self.assertEqual(metadata["distributedExportManifestSha256"], distributed_sha)
            self.assertEqual(metadata["verifiedOriginalExportManifestSha256"], self.runtime["exportManifestSha256"])
            self.assertNotEqual(distributed_sha, self.runtime["exportManifestSha256"])
            self.assertTrue(metadata["redactionOnly"])
            self.assertEqual(distributed["files"], self.manifest["files"])
            self.assertNotIn(str(package.ROOT), manifest_bytes.decode())
            self.assertIn("${LEX_PROJECT}", manifest_bytes.decode())
            self.assertEqual(metadata["passedCases"], 2)
            self.assertEqual(metadata["evaluatedCases"], 2)
            for entry in distributed["files"]:
                data = read("model/" + entry["file"])
                self.assertEqual(hashlib.sha256(data).hexdigest(), entry["sha256"])
                self.assertEqual(len(data), entry["bytes"])
            for name, sha in metadata["evaluationDistributedSha256"].items():
                data = read("evaluations/" + name)
                self.assertEqual(hashlib.sha256(data).hexdigest(), sha)
                self.assertNotIn(str(package.ROOT), data.decode())
                self.assertNotIn('"endpoint"', data.decode())
            self.assertEqual(metadata["evaluationOriginalSha256"]["behavior-imported.json"], self.runtime["importedBehaviorSha256"])
        self.assertEqual(before, {path: package.digest(path) for path in before})

    def test_runtime_failure_probe_or_missing_gate_rejected(self):
        for status, passed in [("FAIL", True), ("COMPATIBLE_BUT_REJECTED", False), ("PROBE_COMPLETED", True), ("PASS", False)]:
            self.runtime.update(status=status, technicalGatePassed=passed)
            save_json(self.runtime_path, self.runtime)
            with self.subTest(status=status, passed=passed), self.assertRaisesRegex(ValueError, "Runtime and technical"):
                self.run_package()
            self.assertFalse(self.output.exists())

    def test_manifest_checksum_mismatch_rejected(self):
        (self.candidate / "export-manifest.sha256").write_text("0" * 64 + "  export-manifest.json\n")
        with self.assertRaisesRegex(ValueError, "checksum mismatch"):
            self.run_package()

    def test_export_payload_tampering_rejected(self):
        (self.candidate / "tokenizer.json").write_text("tampered")
        with self.assertRaisesRegex(ValueError, "integrity mismatch"):
            self.run_package()

    def test_export_adapter_and_training_report_must_match_actual_adapter(self):
        for failure in ("export_weights", "export_config", "training_report", "evaluation_config"):
            manifest_before, reports_before = copy.deepcopy(self.manifest), copy.deepcopy(self.reports)
            if failure.startswith("export"):
                filename = "adapters.safetensors" if failure == "export_weights" else "adapter_config.json"
                next(item for item in self.manifest["adapter"]["files"] if item["file"] == filename)["sha256"] = "0" * 64
            elif failure == "training_report":
                self.reports["training-report.json"]["adapterSha256"] = "0" * 64
            else:
                self.reports["behavior-candidate.json"]["adapterConfigSha256"] = "0" * 64
            self.persist()
            with self.subTest(failure=failure), self.assertRaisesRegex(ValueError, "different adapter"):
                self.run_package()
            self.manifest, self.reports = manifest_before, reports_before
        self.assertFalse(self.output.exists())

    def test_required_runtime_file_omitted_from_manifest_rejected(self):
        self.manifest["files"] = [entry for entry in self.manifest["files"] if entry["file"] != "tokenizer_config.json"]
        self.persist()
        with self.assertRaisesRegex(ValueError, "required runtime files"):
            self.run_package()

    def test_unlisted_or_missing_shard_rejected(self):
        shard = "model-00001-of-00001.safetensors"
        self.manifest["files"] = [entry for entry in self.manifest["files"] if entry["file"] != shard]
        self.persist()
        with self.assertRaisesRegex(ValueError, "file list differ"):
            self.run_package()
        (self.candidate / shard).unlink()
        with self.assertRaisesRegex(ValueError, "referenced model shards"):
            self.run_package()

    def test_extra_disk_file_and_duplicate_manifest_entry_rejected(self):
        (self.candidate / "unlisted.json").write_text("{}")
        with self.assertRaisesRegex(ValueError, "file list differ"):
            self.run_package()
        (self.candidate / "unlisted.json").unlink()
        self.manifest["files"].append(copy.deepcopy(self.manifest["files"][0]))
        self.persist()
        with self.assertRaisesRegex(ValueError, "duplicated"):
            self.run_package()

    def test_behavioral_gate_pairing_and_runtime_evidence_must_match(self):
        self.reports["behavior-candidate.json"]["gate"]["passed"] = False
        self.persist()
        with self.assertRaisesRegex(ValueError, "Behavioral gate"):
            self.run_package()
        self.reports["behavior-candidate.json"]["gate"]["passed"] = True
        self.reports["behavior-candidate.json"]["contract"]["dataSha256"] = "different"
        self.persist()
        with self.assertRaisesRegex(ValueError, "not paired"):
            self.run_package()
        self.reports["behavior-candidate.json"]["contract"] = copy.deepcopy(self.reports["behavior-base.json"]["contract"])
        self.persist()
        self.runtime["importedBehaviorSha256"] = "0" * 64
        save_json(self.runtime_path, self.runtime)
        with self.assertRaisesRegex(ValueError, "different behavioral evidence"):
            self.run_package()

    def test_existing_archive_is_never_replaced(self):
        self.output.write_bytes(b"existing distribution")
        with self.assertRaisesRegex(ValueError, "Preserve existing"):
            self.run_package()
        self.assertEqual(self.output.read_bytes(), b"existing distribution")


if __name__ == "__main__":
    unittest.main()
