"""CPU-only export tests. No MLX import, model download, fusion or GPU use."""
import copy
import importlib.util
import json
from pathlib import Path
import struct
import tempfile
import unittest

import numpy as np
from safetensors import safe_open

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/export-trained-model.py"
SPEC = importlib.util.spec_from_file_location("model_export", SCRIPT)
export = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(export)

PREFIX = "language_model.model.layers.0"
LICENSE = "Apache License\nVersion 2.0\nEND OF TERMS AND CONDITIONS\n"


def fixture_config():
    quant = {"bits": 4, "group_size": 64, "mode": "affine"}
    quant.update({f"language_model.model.layers.{layer}.router.proj": {"bits": 8, "group_size": 64} for layer in range(30)})
    return {"model_type": "gemma4", "architectures": ["Gemma4ForConditionalGeneration"],
            "text_config": {"num_hidden_layers": 30, "num_experts": 2, "hidden_size": 64,
                            "moe_intermediate_size": 64, "attention_k_eq_v": True,
                            "num_attention_heads": 4, "num_key_value_heads": 2, "head_dim": 16,
                            "global_head_dim": 32,
                            "layer_types": ["full_attention" if layer % 6 == 5 else "sliding_attention" for layer in range(30)]},
            "quantization": quant, "quantization_config": copy.deepcopy(quant),
            "vision_config": {"hidden_size": 12}, "audio_config": None,
            "eos_token_id": [1, 106], "generation_config": {"temperature": 0.7}}


def fixture_tensors():
    values = {}
    codes = (np.arange(128, dtype=np.uint32).reshape(2, 64) + 13) % 256
    codes[0, :6] = [0, 1, 127, 128, 254, 255]
    packed = np.sum(codes.reshape(2, 16, 4) << np.array([0, 8, 16, 24], dtype=np.uint32), axis=-1, dtype=np.uint32)
    for layer in range(30):
        prefix = f"language_model.model.layers.{layer}"
        for number, part in enumerate(("gate_proj", "up_proj", "down_proj")):
            module = prefix + ".experts.switch_glu." + part
            values[module + ".weight"] = ("U32", np.arange(2 * 64 * 8, dtype="<u4").reshape(2, 64, 8) + number * 2000)
            values[module + ".scales"] = ("F16", np.full((2, 64, 1), number + 0.5, dtype="<f2"))
            values[module + ".biases"] = ("F16", np.full((2, 64, 1), -number - 0.25, dtype="<f2"))
        values[prefix + ".router.proj.weight"] = ("U32", packed)
        values[prefix + ".router.proj.scales"] = ("F32", np.array([[0.25], [0.5]], dtype="<f4"))
        values[prefix + ".router.proj.biases"] = ("F32", np.array([[-1.0], [-3.0]], dtype="<f4"))
    for module in export.DENSE_ADAPTED_MODULES:
        rows = 128 if ".layers.29." in module else 32 if module.endswith("v_proj") else 64
        values[module + ".weight"] = ("F16", np.linspace(-0.1, 0.1, rows * 64, dtype="<f2").reshape(rows, 64))
    values["language_model.model.norm.weight"] = ("BF16", np.array([0x3f80, 0x4000], dtype="<u2"))
    return values, codes


def write_fixture(path, tensors):
    header, chunks, offset = {"__metadata__": {"format": "mlx"}}, [], 0
    for name, (dtype, array) in sorted(tensors.items()):
        data = array.tobytes(order="C")
        header[name] = {"dtype": dtype, "shape": list(array.shape), "data_offsets": [offset, offset + len(data)]}
        chunks.append(data)
        offset += len(data)
    encoded = json.dumps(header).encode()
    encoded += b" " * (-len(encoded) % 8)
    path.write_bytes(struct.pack("<Q", len(encoded)) + encoded + b"".join(chunks))


def raw_bytes(tensor):
    with tensor["path"].open("rb") as stream:
        stream.seek(tensor["offset"])
        return stream.read(tensor["size"])


class ModelExportTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.base, self.adapter, self.fused = [self.root / name for name in ("base", "adapter", "fused")]
        for path in (self.base, self.adapter, self.fused):
            path.mkdir()
        self.config = fixture_config()
        self.values, self.codes = fixture_tensors()
        write_fixture(self.fused / "model.safetensors", self.values)
        export.write_json(self.fused / "config.json", self.config)
        export.write_json(self.base / "tokenizer_config.json", {"chat_template": "{{ messages }}", "eos_token": "<eos>"})
        export.write_json(self.base / "tokenizer.json", {"model": {"type": "BPE"}})
        export.write_json(self.base / "generation_config.json", {"eos_token_id": [1, 106]})
        (self.base / "README.md").write_text("Source model card\nlicense: apache-2.0\n")
        export.write_json(self.adapter / "adapter_config.json", {"num_layers": 1, "lora_parameters": {"rank": 4}})
        (self.adapter / "adapters.safetensors").write_bytes(b"synthetic adapter hash fixture")
        self.provenance = {"repo": export.BASE_REPO, "revision": export.BASE_REVISION,
                           "license": "Apache-2.0", "files": []}

    def transform(self, name="bundle"):
        output = self.root / name
        manifest = export.transform_bundle(self.base, self.adapter, self.fused, output,
                                            self.provenance, LICENSE, shard_bytes=2000)
        return output, manifest

    def test_axis1_order_and_byte_reversible_quantized_experts(self):
        output, _ = self.transform()
        tensors = export.inventory(output)
        for suffix in ("weight", "scales", "biases"):
            name = PREFIX + ".experts.gate_up_proj." + suffix
            dtype, gate = self.values[PREFIX + ".experts.switch_glu.gate_proj." + suffix]
            _, up = self.values[PREFIX + ".experts.switch_glu.up_proj." + suffix]
            result = np.frombuffer(raw_bytes(tensors[name]), dtype=gate.dtype).reshape(tensors[name]["shape"])
            np.testing.assert_array_equal(result, np.concatenate((gate, up), axis=1))
            self.assertEqual(result[:, :64, :].tobytes(), gate.tobytes())
            self.assertEqual(result[:, 64:, :].tobytes(), up.tobytes())
            self.assertEqual(tensors[name]["dtype"], dtype)
            down = tensors[PREFIX + ".experts.down_proj." + suffix]
            self.assertEqual(raw_bytes(down), self.values[PREFIX + ".experts.switch_glu.down_proj." + suffix][1].tobytes())
        self.assertFalse(any("switch_glu" in name for name in tensors))

    def test_external_safetensors_reader_accepts_exported_shards(self):
        output, _ = self.transform()
        tensor_count = 0
        for path in sorted(output.glob("*.safetensors")):
            with safe_open(path, framework="numpy") as reader:
                for name in reader.keys():
                    tensor_count += 1
                    self.assertEqual(reader.get_slice(name).get_shape(), export.read_header(path)[name]["shape"])
                    if name.endswith(".gate_up_proj.weight"):
                        expected = np.concatenate((self.values[PREFIX + ".experts.switch_glu.gate_proj.weight"][1],
                                                   self.values[PREFIX + ".experts.switch_glu.up_proj.weight"][1]), axis=1)
                        np.testing.assert_array_equal(reader.get_tensor(name), expected)
        self.assertEqual(tensor_count, len(export.inventory(output)))

    def test_dense_router_matches_affine_equation_exactly(self):
        output, manifest = self.transform()
        tensors = export.inventory(output)
        weight = tensors[PREFIX + ".router.proj.weight"]
        expected = self.codes.astype(np.float32) * np.array([[0.25], [0.5]], dtype=np.float32) + np.array([[-1.0], [-3.0]], dtype=np.float32)
        actual = np.frombuffer(raw_bytes(weight), dtype="<f4").reshape(2, 64)
        np.testing.assert_array_equal(actual, expected)
        self.assertEqual(weight["dtype"], "F32")
        self.assertNotIn(PREFIX + ".router.proj.scales", tensors)
        self.assertEqual(len(manifest["exporter"]["denseF32Routers"]), 30)
        self.assertIn(PREFIX + ".router.proj", manifest["exporter"]["denseF32Routers"])

    def test_bfloat16_router_companions_reconstruct_without_gpu(self):
        for suffix, bits in (("scales", 0x3f00), ("biases", 0xbf80)):
            self.values[PREFIX + ".router.proj." + suffix] = ("BF16", np.full((2, 1), bits, dtype="<u2"))
        write_fixture(self.fused / "model.safetensors", self.values)
        output, _ = self.transform()
        weight = export.inventory(output)[PREFIX + ".router.proj.weight"]
        np.testing.assert_array_equal(np.frombuffer(raw_bytes(weight), dtype="<f4").reshape(2, 64),
                                      self.codes.astype(np.float32) * 0.5 - 1.0)

    def test_config_tokenizer_and_frozen_bfloat16_preserved(self):
        before = copy.deepcopy(self.config)
        output, _ = self.transform()
        config = export.read_json(output / "config.json")
        self.assertIsNone(config["vision_config"])
        self.assertIsNone(config["audio_config"])
        self.assertEqual(config["text_config"], before["text_config"])
        self.assertEqual(config["eos_token_id"], before["eos_token_id"])
        self.assertEqual(config["generation_config"], before["generation_config"])
        self.assertEqual(config["quantization"], {"bits": 4, "group_size": 64, "mode": "affine"})
        self.assertEqual(config["quantization"], config["quantization_config"])
        self.assertEqual(self.config, before)
        self.assertEqual((output / "tokenizer_config.json").read_bytes(), (self.base / "tokenizer_config.json").read_bytes())
        tensor = export.inventory(output)["language_model.model.norm.weight"]
        self.assertEqual(raw_bytes(tensor), self.values["language_model.model.norm.weight"][1].tobytes())
        self.assertEqual(tensor["dtype"], "BF16")

    def test_manifest_hashes_license_and_experimental_status(self):
        original = {path: export.sha256(path) for directory in (self.base, self.adapter, self.fused)
                    for path in directory.iterdir()}
        output, manifest = self.transform()
        for item in manifest["files"]:
            self.assertEqual(export.file_record(output / item["file"]), item)
        self.assertEqual((output / "export-manifest.sha256").read_text().split()[0], export.sha256(output / "export-manifest.json"))
        self.assertEqual(manifest["source"]["revision"], export.BASE_REVISION)
        self.assertEqual(manifest["legalQuality"], "not-validated")
        self.assertIn("not-promoted", manifest["status"])
        self.assertIn("requires-isolated", manifest["runtimeCompatibility"])
        self.assertEqual((output / "LICENSE").read_text(), LICENSE)
        self.assertTrue((output / "Modelfile").read_text().startswith("FROM .\n"))
        directives=(output / "Modelfile").read_text().splitlines()
        self.assertEqual([line for line in directives if line.startswith("RENDERER ")], ["RENDERER gemma4-large"])
        self.assertEqual([line for line in directives if line.startswith("PARSER ")], ["PARSER gemma4"])
        self.assertEqual(manifest["exporter"]["ollamaRenderer"], "gemma4-large")
        self.assertEqual(manifest["exporter"]["ollamaParser"], "gemma4")
        self.assertEqual(manifest["exporter"]["precision"], "adapted-dense/rest-unchanged")
        self.assertEqual(original, {path: export.sha256(path) for path in original})

    def test_missing_or_malformed_expert_is_rejected_before_output(self):
        for change in ("missing", "wrong_shape", "unknown_name"):
            with self.subTest(change=change):
                values = copy.deepcopy(self.values)
                key = PREFIX + ".experts.switch_glu.up_proj.scales"
                if change == "missing":
                    del values[key]
                elif change == "wrong_shape":
                    values[key] = ("F16", np.zeros((2, 32, 2), dtype="<f2"))
                else:
                    values[key.replace("switch_glu", "other")] = values.pop(key)
                write_fixture(self.fused / "model.safetensors", values)
                with self.assertRaises(ValueError):
                    self.transform(change)
                self.assertFalse((self.root / change).exists())

    def test_any_unknown_quantization_override_is_rejected(self):
        config = copy.deepcopy(self.config)
        config["quantization"][PREFIX + ".self_attn.q_proj"] = {"bits": 8}
        config["quantization_config"] = copy.deepcopy(config["quantization"])
        with self.assertRaisesRegex(ValueError, "Unsupported per-module"):
            export.transform_config(config)
        config = copy.deepcopy(self.config)
        config["quantization"][PREFIX + ".router.proj"]["group_size"] = 32
        config["quantization_config"] = copy.deepcopy(config["quantization"])
        with self.assertRaisesRegex(ValueError, "Only affine 8-bit"):
            export.transform_config(config)

    def test_vision_weights_and_wrong_prefix_rejected(self):
        for name in ("vision_tower.weight", "model.language_model.norm.weight"):
            values = dict(self.values)
            values[name] = ("F32", np.ones((2, 2), dtype="<f4"))
            write_fixture(self.fused / "model.safetensors", values)
            with self.assertRaisesRegex(ValueError, "Non-text or unknown"):
                self.transform()

    def test_wrong_index_and_truncated_shard_rejected(self):
        export.write_json(self.fused / "model.safetensors.index.json", {"weight_map": {"wrong": "missing"}})
        with self.assertRaisesRegex(ValueError, "index differs"):
            export.inventory(self.fused)
        path = self.fused / "model.safetensors"
        path.write_bytes(path.read_bytes()[:-1])
        with self.assertRaisesRegex(ValueError, "missing tensor bytes"):
            export.read_header(path)

    def test_existing_output_is_never_replaced(self):
        output = self.root / "bundle"
        output.mkdir()
        (output / "keep").write_text("untouched")
        with self.assertRaisesRegex(ValueError, "already exists"):
            self.transform()
        self.assertEqual((output / "keep").read_text(), "untouched")

    def test_source_provenance_tampering_is_rejected(self):
        (self.base / "config.json").write_bytes((self.fused / "config.json").read_bytes())
        (self.base / "model.safetensors").write_bytes((self.fused / "model.safetensors").read_bytes())
        provenance = dict(self.provenance, files=[export.file_record(path) for path in sorted(self.base.iterdir())])
        manifest_path = self.root / "source.json"
        export.write_json(manifest_path, provenance)
        self.assertEqual(export.verify_source_manifest(self.base, manifest_path), provenance)
        (self.base / "model.safetensors").write_bytes(b"tampered")
        with self.assertRaisesRegex(ValueError, "hash mismatch"):
            export.verify_source_manifest(self.base, manifest_path)

    def test_nonfinite_router_rejected(self):
        self.values[PREFIX + ".router.proj.scales"] = ("F32", np.full((2, 1), np.nan, dtype="<f4"))
        write_fixture(self.fused / "model.safetensors", self.values)
        with self.assertRaisesRegex(ValueError, "Non-finite"):
            self.transform()

    def test_seven_dense_adapted_projections_are_preserved_byte_exactly(self):
        output, manifest = self.transform()
        tensors = export.inventory(output)
        self.assertEqual(len(manifest["exporter"]["denseAttention"]), 7)
        for module in export.DENSE_ADAPTED_MODULES:
            self.assertEqual(raw_bytes(tensors[module + ".weight"]), self.values[module + ".weight"][1].tobytes())
            self.assertEqual(tensors[module + ".weight"]["dtype"], "F16")
            self.assertNotIn(module + ".scales", tensors)

    def test_quantized_or_malformed_adapted_projections_are_rejected(self):
        module = sorted(export.DENSE_ADAPTED_MODULES)[0]
        for failure in ("quantized", "missing", "wrong_shape", "companions"):
            values = copy.deepcopy(self.values)
            if failure == "quantized":
                values[module + ".weight"] = ("U32", np.zeros((64, 8), dtype="<u4"))
            elif failure == "missing":
                del values[module + ".weight"]
            elif failure == "wrong_shape":
                values[module + ".weight"] = ("F16", np.zeros((32, 64), dtype="<f2"))
            else:
                values[module + ".scales"] = ("F16", np.zeros((64, 1), dtype="<f2"))
            write_fixture(self.fused / "model.safetensors", values)
            with self.subTest(failure=failure), self.assertRaisesRegex(ValueError, "Adapted attention"):
                self.transform(failure)

    def test_selective_helper_refuses_wrong_fusion_scope_without_importing_mlx(self):
        spec = importlib.util.spec_from_file_location("selective_fusion", SCRIPT.with_name("fuse-trained-adapter.py"))
        helper = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(helper)
        self.assertEqual(helper.EXPECTED_MODULES, export.DENSE_ADAPTED_MODULES)
        helper.require_expected_modules(list(export.DENSE_ADAPTED_MODULES))
        with self.assertRaises(ValueError):
            helper.require_expected_modules(list(export.DENSE_ADAPTED_MODULES)[:-1])
        with self.assertRaises(ValueError):
            helper.require_expected_modules(list(export.DENSE_ADAPTED_MODULES) + ["language_model.model.layers.1.mlp.gate_proj"])


if __name__ == "__main__":
    unittest.main()
