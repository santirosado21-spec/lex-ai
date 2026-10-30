#!/usr/bin/env python3
"""Offline Gemma 4 MLX adapter fusion and bounded-memory Ollama export.

The coordinator imports no MLX. Fusion runs in a child process; after it exits,
a separate CPU-only child streams safetensors into a new candidate bundle.
Nothing is imported into Ollama or promoted automatically.
"""
import argparse
import copy
import hashlib
import importlib.metadata
import json
import math
import os
from pathlib import Path
import re
import shutil
import struct
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

MLX_LM_VERSION = "0.32.2"
BASE_REPO = "mlx-community/gemma-4-26b-a4b-it-4bit"
BASE_REVISION = "0d77464eeb233a2da68ebf9d7dc4edaac7db956d"
LICENSE_URL = "https://www.apache.org/licenses/LICENSE-2.0.txt"
CHUNK_BYTES = 8 * 1024 * 1024
MAX_HEADER_BYTES = 64 * 1024 * 1024
DTYPE_BYTES = {"BOOL": 1, "U8": 1, "I8": 1, "I16": 2, "U16": 2,
               "F16": 2, "BF16": 2, "I32": 4, "U32": 4, "F32": 4,
               "I64": 8, "U64": 8, "F64": 8}
FLOAT_DTYPES = {"F16", "BF16", "F32"}
EXPERT_RE = re.compile(r"^(language_model\.model\.layers\.(\d+)\.experts)\.switch_glu\.(gate_proj|up_proj|down_proj)\.(weight|scales|biases)$")
ROUTER_RE = re.compile(r"^language_model\.model\.layers\.\d+\.router\.proj$")
DENSE_ADAPTED_MODULES = {
    f"language_model.model.layers.{layer}.self_attn.{projection}"
    for layer in (26, 27, 28, 29)
    for projection in (("q_proj",) if layer == 29 else ("q_proj", "v_proj"))
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for block in iter(lambda: stream.read(CHUNK_BYTES), b""):
            digest.update(block)
    return digest.hexdigest()


def write_json(path, value):
    Path(path).write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, f"Duplicate JSON key: {key}")
        result[key] = value
    return result


def read_json(path):
    return json.loads(Path(path).read_text(), object_pairs_hook=unique_object)


def read_header(path):
    """Validate offsets, shapes and byte sizes without reading tensor payloads."""
    path = Path(path)
    size = path.stat().st_size
    with path.open("rb") as stream:
        prefix = stream.read(8)
        require(len(prefix) == 8, f"Truncated safetensors prefix: {path.name}")
        length = struct.unpack("<Q", prefix)[0]
        require(2 <= length <= MAX_HEADER_BYTES and length + 8 <= size,
                f"Invalid safetensors header size: {path.name}")
        header = json.loads(stream.read(length), object_pairs_hook=unique_object)
    require(isinstance(header, dict), "Safetensors header must be an object")
    tensors, ranges = {}, []
    for name, value in header.items():
        if name == "__metadata__":
            continue
        shape, dtype, offsets = value["shape"], value["dtype"], value["data_offsets"]
        require(dtype in DTYPE_BYTES, f"Unsupported tensor dtype {dtype}: {name}")
        require(isinstance(shape, list) and all(type(x) is int and x > 0 for x in shape),
                f"Invalid or empty tensor dimensions: {name}")
        require(len(offsets) == 2 and all(type(x) is int for x in offsets), "Invalid offsets")
        start, end = offsets
        require(0 <= start <= end and end - start == math.prod(shape) * DTYPE_BYTES[dtype],
                f"Tensor byte/shape mismatch: {name}")
        ranges.append((start, end))
        tensors[name] = {"path": path, "offset": 8 + length + start,
                         "size": end - start, "shape": shape, "dtype": dtype}
    cursor = 0
    for start, end in sorted(ranges):
        require(start == cursor, f"Overlapping or non-contiguous tensor offsets: {path.name}")
        cursor = end
    require(8 + length + cursor == size, f"Trailing or missing tensor bytes: {path.name}")
    return tensors


def inventory(directory):
    directory = Path(directory)
    result, actual_map = {}, {}
    files = sorted(directory.glob("*.safetensors"))
    require(files, "No fused safetensors shards found")
    for path in files:
        for name, tensor in read_header(path).items():
            require(name not in result, f"Duplicate tensor across shards: {name}")
            result[name], actual_map[name] = tensor, path.name
    index = directory / "model.safetensors.index.json"
    if index.exists():
        require(read_json(index)["weight_map"] == actual_map,
                "Fused safetensors index differs from actual shards")
    return result


def effective_quant(config, module):
    quant = config["quantization"]
    override = quant.get(module, {})
    require(isinstance(override, dict), f"Unsupported quantization override: {module}")
    return {key: override.get(key, quant.get(key, "affine" if key == "mode" else None))
            for key in ("bits", "group_size", "mode")}


def validate_triplet(tensors, module, bits, group_size, rank):
    names = [module + "." + suffix for suffix in ("weight", "scales", "biases")]
    require(all(name in tensors for name in names), f"Missing quantization companion: {module}")
    weight, scales, biases = [tensors[name] for name in names]
    require(weight["dtype"] == "U32", f"Expected packed U32 weight: {module}")
    require(scales["dtype"] in FLOAT_DTYPES and scales["dtype"] == biases["dtype"],
            f"Unsupported scale/bias dtype: {module}")
    require(len(weight["shape"]) == rank and len(scales["shape"]) == rank,
            f"Unexpected quantized tensor rank: {module}")
    logical_in = weight["shape"][-1] * (32 // bits)
    require(logical_in % group_size == 0 and
            scales["shape"] == weight["shape"][:-1] + [logical_in // group_size] and
            biases["shape"] == scales["shape"], f"Invalid quantization shapes: {module}")
    return weight, scales, biases


def transform_config(config):
    result = copy.deepcopy(config)
    require(result.get("model_type") == "gemma4", "Only Gemma 4 is supported")
    require(result.get("architectures") == ["Gemma4ForConditionalGeneration"],
            "Unexpected Gemma 4 architecture")
    require(isinstance(result.get("text_config"), dict), "Missing text_config")
    quant = result.get("quantization", {})
    require({k: quant.get(k) for k in ("bits", "group_size", "mode")} ==
            {"bits": 4, "group_size": 64, "mode": "affine"},
            "Only the pinned affine 4-bit / group 64 base is supported")
    if "quantization_config" in result:
        require(result["quantization_config"] == quant, "Conflicting quantization configs")
    for module, value in quant.items():
        if module in {"bits", "group_size", "mode"}:
            continue
        require(ROUTER_RE.fullmatch(module) is not None and isinstance(value, dict),
                f"Unsupported per-module quantization override: {module}")
        require(set(value) <= {"bits", "group_size", "mode"},
                f"Unsupported quantization override fields: {module}")
        require(effective_quant(result, module) == {"bits": 8, "group_size": 64, "mode": "affine"},
                f"Only affine 8-bit router overrides are supported: {module}")
    # Ollama's prequant importer ignores MLX per-module overrides. Routers are
    # exported as dense F32; retaining these overrides would misdescribe them.
    result["quantization"] = {"bits": 4, "group_size": 64, "mode": "affine"}
    result["quantization_config"] = copy.deepcopy(result["quantization"])
    result["vision_config"] = None
    result["audio_config"] = None
    if "has_vision" in result:
        result["has_vision"] = False
    return result


def direct_plan(name, tensor):
    return {"name": name, "shape": list(tensor["shape"]), "dtype": tensor["dtype"],
            "size": tensor["size"], "segments": [(tensor, 0, tensor["size"])]}


def concatenate_axis1(name, gate, up):
    require(len(gate["shape"]) == 3 and gate["shape"] == up["shape"] and
            gate["dtype"] == up["dtype"], f"Gate/up shape or dtype mismatch: {name}")
    shape = list(gate["shape"])
    per_expert = gate["size"] // shape[0]
    segments = []
    # Concatenating whole files would mix expert identities. Interleave each
    # expert's gate rows then up rows, preserving packed words and scale rows.
    for expert in range(shape[0]):
        segments.extend((tensor, expert * per_expert, per_expert) for tensor in (gate, up))
    shape[1] *= 2
    return {"name": name, "shape": shape, "dtype": gate["dtype"],
            "size": gate["size"] + up["size"], "segments": segments}


def validate_dense_attention(tensors, config):
    text = config["text_config"]
    require(text.get("num_hidden_layers") == 30 and text.get("attention_k_eq_v") is True,
            "Selective fusion expects the 30-layer Gemma 4 K=V architecture")
    require(len(text.get("layer_types", [])) == 30, "Missing attention layer types")
    require(text["layer_types"][26:30] == ["sliding_attention"] * 3 + ["full_attention"],
            "Unexpected adapted attention pattern")
    details = []
    for module in sorted(DENSE_ADAPTED_MODULES):
        weight = tensors.get(module + ".weight")
        require(weight is not None and weight["dtype"] in FLOAT_DTYPES,
                f"Adapted attention must be dense floating point: {module}")
        require(module + ".scales" not in tensors and module + ".biases" not in tensors,
                f"Adapted attention retains quantization companions: {module}")
        layer = int(module.split("layers.")[1].split(".")[0])
        head_dim = text["global_head_dim"] if layer == 29 else text["head_dim"]
        heads = text["num_attention_heads"] if module.endswith("q_proj") else text["num_key_value_heads"]
        require(weight["shape"] == [heads * head_dim, text["hidden_size"]],
                f"Adapted attention shape disagrees with config: {module}")
        details.append({"module": module, "dtype": weight["dtype"], "shape": weight["shape"]})
    require(not any(name.startswith("language_model.model.layers.29.self_attn.v_proj.") for name in tensors),
            "K=V layer 29 must not contain v_proj")
    return details


def build_plan(tensors, config):
    exported_config = transform_config(config)
    validate_dense_attention(tensors, config)
    text = config["text_config"]
    layers, experts = text["num_hidden_layers"], text["num_experts"]
    hidden, intermediate = text["hidden_size"], text["moe_intermediate_size"]
    require(all(type(x) is int and x > 0 for x in (layers, experts, hidden, intermediate)),
            "Invalid MoE architecture dimensions")
    groups, consumed, plans, dense_routers = {}, set(), [], []
    for name in tensors:
        require(name.startswith("language_model."), f"Non-text or unknown tensor prefix: {name}")
        require(not any(marker in name for marker in (".vision", ".audio", ".multi_modal", ".embed_vision")),
                f"Non-text tensor inside language model: {name}")
        if ".experts." in name:
            match = EXPERT_RE.fullmatch(name)
            require(match is not None, f"Unknown expert layout: {name}")
            groups[int(match.group(2))] = match.group(1)
    require(set(groups) == set(range(layers)), "Missing or extra MoE layer groups")
    for layer, prefix in sorted(groups.items()):
        modules = [prefix + ".switch_glu." + part for part in ("gate_proj", "up_proj", "down_proj")]
        for module in modules:
            require(effective_quant(config, module) == {"bits": 4, "group_size": 64, "mode": "affine"},
                    f"Unsupported expert quantization: {module}")
            validate_triplet(tensors, module, 4, 64, 3)
        gate, up, down = [tensors[module + ".weight"] for module in modules]
        require(gate["shape"] == up["shape"] == [experts, intermediate, hidden // 8] and
                down["shape"] == [experts, hidden, intermediate // 8] and
                hidden % 64 == 0 and intermediate % 64 == 0,
                f"Expert dimensions disagree with config: layer {layer}")
        for suffix in ("weight", "scales", "biases"):
            names = [module + "." + suffix for module in modules]
            plans.append(concatenate_axis1(prefix + ".gate_up_proj." + suffix,
                                           tensors[names[0]], tensors[names[1]]))
            plans.append(direct_plan(prefix + ".down_proj." + suffix, tensors[names[2]]))
            consumed.update(names)
    for module in config["quantization"]:
        if not ROUTER_RE.fullmatch(module):
            continue
        triple = validate_triplet(tensors, module, 8, 64, 2)
        require(triple[0]["shape"] == [experts, hidden // 4], f"Invalid router dimensions: {module}")
        require(experts * hidden * 4 <= 64 * 1024 * 1024, "Router exceeds CPU transform memory bound")
        plans.append({"name": module + ".weight", "dtype": "F32", "shape": [experts, hidden],
                      "size": experts * hidden * 4, "router": triple})
        consumed.update(module + "." + suffix for suffix in ("weight", "scales", "biases"))
        dense_routers.append(module)
    require(len(dense_routers) == layers, "Expected one explicitly configured 8-bit router per layer")
    for name, tensor in sorted(tensors.items()):
        if name not in consumed:
            plans.append(direct_plan(name, tensor))
    require(len({plan["name"] for plan in plans}) == len(plans), "Transformed tensor name collision")
    return sorted(plans, key=lambda plan: plan["name"]), exported_config, dense_routers


def read_tensor_numpy(tensor):
    import numpy as np
    require(tensor["size"] <= 64 * 1024 * 1024, "CPU tensor read exceeds bound")
    with tensor["path"].open("rb") as stream:
        stream.seek(tensor["offset"])
        data = stream.read(tensor["size"])
    require(len(data) == tensor["size"], "Source tensor truncated during export")
    dtype = tensor["dtype"]
    if dtype == "BF16":
        values = (np.frombuffer(data, dtype="<u2").astype(np.uint32) << 16).view(np.float32)
    else:
        values = np.frombuffer(data, dtype={"U32": "<u4", "F16": "<f2", "F32": "<f4"}[dtype])
    return values.reshape(tensor["shape"])


def dense_router_bytes(triple):
    """Exact affine q8 unpacking in CPU F32, without another quantization."""
    import numpy as np
    packed, scales, biases = [read_tensor_numpy(tensor) for tensor in triple]
    codes = ((packed[..., None] >> np.array([0, 8, 16, 24], dtype=np.uint32)) & 255)
    codes = codes.reshape(packed.shape[0], -1).astype(np.float32)
    values = codes * np.repeat(scales.astype(np.float32), 64, axis=-1)
    values += np.repeat(biases.astype(np.float32), 64, axis=-1)
    require(np.isfinite(values).all(), "Non-finite dequantized router")
    return values.astype("<f4", copy=False).tobytes(order="C")


def copy_segment(output, tensor, relative_offset, size):
    with tensor["path"].open("rb") as source:
        source.seek(tensor["offset"] + relative_offset)
        while size:
            data = source.read(min(size, CHUNK_BYTES))
            require(data, "Source tensor truncated during streaming")
            output.write(data)
            size -= len(data)


def write_shards(plans, output, shard_bytes=512 * 1024 * 1024):
    require(shard_bytes > 0, "Invalid shard size")
    batches, current, current_size = [], [], 0
    for plan in plans:
        if current and current_size + plan["size"] > shard_bytes:
            batches.append(current)
            current, current_size = [], 0
        current.append(plan)
        current_size += plan["size"]
    if current:
        batches.append(current)
    weight_map = {}
    for number, batch in enumerate(batches, 1):
        filename = f"model-{number:05d}-of-{len(batches):05d}.safetensors"
        header, offset = {"__metadata__": {"format": "mlx"}}, 0
        for plan in batch:
            header[plan["name"]] = {"dtype": plan["dtype"], "shape": plan["shape"],
                                     "data_offsets": [offset, offset + plan["size"]]}
            offset += plan["size"]
            weight_map[plan["name"]] = filename
        encoded = json.dumps(header, separators=(",", ":")).encode()
        encoded += b" " * (-len(encoded) % 8)
        with (output / filename).open("xb") as stream:
            stream.write(struct.pack("<Q", len(encoded)))
            stream.write(encoded)
            for plan in batch:
                if "router" in plan:
                    data = dense_router_bytes(plan["router"])
                    require(len(data) == plan["size"], "Dense router byte count mismatch")
                    stream.write(data)
                else:
                    for tensor, start, size in plan["segments"]:
                        copy_segment(stream, tensor, start, size)
        read_header(output / filename)
    write_json(output / "model.safetensors.index.json", {
        "metadata": {"total_size": sum(plan["size"] for plan in plans)}, "weight_map": weight_map})


def file_record(path):
    return {"file": path.name, "bytes": path.stat().st_size, "sha256": sha256(path)}


def verify_source_manifest(base, manifest_path):
    manifest = read_json(manifest_path)
    require(manifest.get("repo") == BASE_REPO and manifest.get("revision") == BASE_REVISION,
            "Base provenance must match the pinned Gemma 4 checkpoint")
    require(manifest.get("license", "").lower() == "apache-2.0", "Unexpected base license")
    files = manifest.get("files", [])
    require(files and len({item["file"] for item in files}) == len(files), "Invalid base file list")
    for item in files:
        name = item["file"]
        require(Path(name).name == name and name not in {".", ".."}, "Unsafe provenance filename")
        path = base / name
        require(path.is_file() and not path.is_symlink(), f"Missing or symlinked base file: {name}")
        require(file_record(path) == item, f"Base provenance hash mismatch: {name}")
    actual_weights = {path.name for path in base.glob("*.safetensors")}
    listed = {item["file"] for item in files}
    require(actual_weights and actual_weights <= listed and {"config.json", "tokenizer_config.json"} <= listed,
            "Source manifest must cover all base weights and configuration")
    return manifest


def copy_runtime_files(base, fused, output):
    names = {"tokenizer.json", "tokenizer.model", "tokenizer_config.json", "special_tokens_map.json",
             "added_tokens.json", "generation_config.json", "chat_template.jinja"}
    for name in sorted(names):
        source = fused / name if (fused / name).is_file() else base / name
        if source.is_file():
            shutil.copyfile(source, output / name)
    require((output / "tokenizer_config.json").is_file() and
            any((output / name).is_file() for name in ("tokenizer.json", "tokenizer.model")),
            "Missing tokenizer files")
    tokenizer = read_json(output / "tokenizer_config.json")
    require(tokenizer.get("chat_template") or (output / "chat_template.jinja").is_file(),
            "Missing source chat template")
    for name in ("README.md", "NOTICE", "NOTICE.txt"):
        if (base / name).is_file():
            destination = "SOURCE_MODEL_CARD.md" if name == "README.md" else name
            shutil.copyfile(base / name, output / destination)


def transform_bundle(base, adapter, fused, output, provenance, license_text, shard_bytes=512 * 1024 * 1024):
    require(not output.exists(), "Export output already exists")
    require("Apache License" in license_text and "Version 2.0" in license_text and
            "END OF TERMS AND CONDITIONS" in license_text, "Full Apache 2.0 license text is required")
    tensors = inventory(fused)
    plans, config, routers = build_plan(tensors, read_json(fused / "config.json"))
    output.mkdir()
    write_shards(plans, output, shard_bytes)
    write_json(output / "config.json", config)
    copy_runtime_files(base, fused, output)
    if (fused / "fusion-report.json").is_file():
        shutil.copyfile(fused / "fusion-report.json", output / "fusion-report.json")
    (output / "LICENSE").write_text(license_text)
    # Ollama's generic gemma4 renderer omits the empty thought channel. This
    # checkpoint's HF template and training prefix require gemma4-large when
    # think:false; copying chat_template.jinja alone does not select it.
    (output / "Modelfile").write_text('FROM .\nRENDERER gemma4-large\nPARSER gemma4\nLICENSE """' + license_text.rstrip() + '\n"""\n')
    (output / "README.md").write_text(
        "# LEX AI experimental local model candidate\n\n"
        "Derived from " + BASE_REPO + " at revision " + BASE_REVISION + ".\n\n"
        "Changes: local adapter fusion preserving seven trained attention projections as dense weights, "
        "expert tensor layout conversion, text-only configuration, and CPU F32 dequantization of 8-bit routers. "
        "Other weights retain their precision.\n\n"
        "This artifact is not a legally validated model. Training, runtime import and held-out "
        "evaluation must be reviewed separately. It is not automatically promoted or published.\n\n"
        "License: Apache-2.0; see LICENSE and SOURCE_MODEL_CARD.md. "
        "No Google endorsement or trademark permission is implied.\n")
    inventory(output)
    manifest = {
        "schemaVersion": 1, "createdAt": datetime.now(timezone.utc).isoformat(),
        "status": "experimental-not-evaluated-not-promoted", "textOnly": True,
        "runtimeCompatibility": "requires-isolated-Ollama-import-and-inference-validation",
        "legalQuality": "not-validated", "license": "Apache-2.0", "licenseSource": LICENSE_URL,
        "source": provenance,
        "adapter": {"files": [file_record(adapter / name) for name in
                               ("adapter_config.json", "adapters.safetensors")],
                    "configuration": read_json(adapter / "adapter_config.json")},
        "exporter": {"scriptSha256": sha256(Path(__file__)), "mlxLmVersion": MLX_LM_VERSION,
                     "ollamaRenderer": "gemma4-large", "ollamaParser": "gemma4",
                     "precision": "adapted-dense/rest-unchanged",
                     "precisionNote": "Selective fusion preserves frozen weights; CPU import translation additionally dequantizes the listed routers to F32.",
                     "denseAttention": validate_dense_attention(tensors, read_json(fused / "config.json")),
                     "fusionHelperSha256": sha256(Path(__file__).with_name("fuse-trained-adapter.py")),
                     "layout": "Gemma4 MLX q4 experts fused axis 1, gate then up per expert",
                     "denseF32Routers": routers, "streamChunkBytes": CHUNK_BYTES,
                     "shardTargetBytes": shard_bytes},
        "files": [file_record(path) for path in sorted(output.iterdir()) if path.is_file()],
    }
    write_json(output / "export-manifest.json", manifest)
    digest = sha256(output / "export-manifest.json")
    (output / "export-manifest.sha256").write_text(digest + "  export-manifest.json\n")
    return manifest


def offline_environment():
    environment = os.environ.copy()
    environment.update(HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1", HF_HUB_DISABLE_TELEMETRY="1",
                       TOKENIZERS_PARALLELISM="false", DO_NOT_TRACK="1")
    return environment


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("base", "adapter", "output"):
        parser.add_argument("--" + name, required=True, type=Path)
    parser.add_argument("--source-manifest", type=Path)
    parser.add_argument("--license-file", required=True, type=Path, help="Local full Apache 2.0 license text")
    parser.add_argument("--shard-mib", type=int, default=512)
    parser.add_argument("--_transform-fused", type=Path, help=argparse.SUPPRESS)
    args = parser.parse_args()
    base, adapter, output = [getattr(args, name).resolve() for name in ("base", "adapter", "output")]
    require(base.is_dir() and adapter.is_dir(), "Base and adapter must be existing local directories")
    require(not output.exists(), "Output must be a new directory")
    for source in (base, adapter):
        require(output != source and not output.is_relative_to(source) and not source.is_relative_to(output),
                "Output must be separate from base and adapter")
    require(1 <= args.shard_mib <= 4096, "Shard target must be between 1 and 4096 MiB")
    for name in ("adapter_config.json", "adapters.safetensors"):
        require((adapter / name).is_file(), f"Missing adapter file: {name}")
    manifest_path = (args.source_manifest or base.parent / "base-model-manifest.json").resolve()
    if args._transform_fused:
        # Parent has already hashed the source before fusion. Rehashing the
        # adapter below detects changes between fusion and this CPU stage.
        provenance = read_json(manifest_path)
        transform_bundle(base, adapter, args._transform_fused.resolve(), output, provenance,
                         args.license_file.read_text(), args.shard_mib * 1024 * 1024)
        return
    require(importlib.metadata.version("mlx-lm") == MLX_LM_VERSION,
            "Run the exporter with the pinned training venv (MLX-LM 0.32.2)")
    verify_source_manifest(base, manifest_path)
    transform_config(read_json(base / "config.json"))
    adapter_before = {name: sha256(adapter / name) for name in ("adapter_config.json", "adapters.safetensors")}
    license_text = args.license_file.read_text()
    require("END OF TERMS AND CONDITIONS" in license_text, "Supply the full local Apache 2.0 license")
    output.parent.mkdir(parents=True, exist_ok=True)
    bytes_base = sum(path.stat().st_size for path in base.glob("*.safetensors"))
    require(shutil.disk_usage(output.parent).free > 2 * bytes_base + 2 * 1024**3,
            "Insufficient disk space for fused intermediate plus candidate")
    environment = offline_environment()
    with tempfile.TemporaryDirectory(prefix=".lex-model-export-", dir=output.parent) as temporary:
        work = Path(temporary)
        fused, bundle = work / "fused", work / "bundle"
        print(json.dumps({"event": "fusion-start", "precision": "adapted-dense/rest-unchanged"}), flush=True)
        subprocess.run([sys.executable, str(Path(__file__).with_name("fuse-trained-adapter.py")), "--model", str(base),
                        "--adapter-path", str(adapter), "--save-path", str(fused)],
                       env=environment, check=True)
        require(all(sha256(adapter / name) == digest for name, digest in adapter_before.items()),
                "Adapter changed during fusion")
        print(json.dumps({"event": "cpu-export-start"}), flush=True)
        subprocess.run([sys.executable, str(Path(__file__).resolve()), "--base", str(base),
                        "--adapter", str(adapter), "--output", str(bundle), "--source-manifest", str(manifest_path),
                        "--license-file", str(args.license_file.resolve()), "--shard-mib", str(args.shard_mib),
                        "--_transform-fused", str(fused)], env=environment, check=True)
        require(all(sha256(adapter / name) == digest for name, digest in adapter_before.items()),
                "Adapter changed during export")
        require(not output.exists(), "Output appeared during export; refusing to replace it")
        bundle.rename(output)
    print(json.dumps({"event": "export-complete", "output": str(output),
                      "status": "experimental-not-evaluated-not-promoted"}), flush=True)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError, importlib.metadata.PackageNotFoundError) as exc:
        print(f"Export failed: {exc}", file=sys.stderr)
        sys.exit(1)
