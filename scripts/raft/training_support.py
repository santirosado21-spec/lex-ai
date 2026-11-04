"""CPU-only dataset, masking, memory and checkpoint integrity checks."""
import collections
import importlib.metadata
import json
import re
import subprocess
import sys
from pathlib import Path

from build import AREAS, ROOT, digest, read_holdout, read_library, text_digest, validate_row
from diversity import enforce


def validate_dataset(data, library):
    manifest = json.loads((data / "manifest.json").read_text())
    if manifest.get("schemaVersion") != 2:
        raise ValueError("Retired template corpus: rebuild using complete authored responses")
    for name, expected in manifest.get('scripts', {}).items():
        if Path(name).name != name or digest(ROOT / 'scripts/raft' / name) != expected:
            raise ValueError('Dataset assembly/audit script changed: rebuild corpus')
    for name, expected in manifest.get("authoredResponseFiles", {}).items():
        if digest(ROOT / name) != expected:
            raise ValueError("Authored response bank changed: rebuild corpus")
    holdout = json.loads((data / "held-out-laws.json").read_text())
    if manifest["heldOutSha256"] != digest(data / "held-out-laws.json"):
        raise ValueError("Held-out declaration changed")
    current, origin = read_holdout(ROOT / "eval/areas/README.md")
    if current != holdout["heldOutLaws"]:
        raise ValueError("Evaluator law split changed: rebuild the RAFT corpus")
    if digest(library) != manifest["library"]["sha256"]:
        raise ValueError("Library snapshot changed")
    articles, _ = read_library(library)
    by_id = {a["sourceId"]: a for a in articles}
    held = set(holdout["allLawIds"])
    sealed = set(holdout["sealedEvaluationLawIds"])
    development = {x for ids in holdout["developmentHeldOutLaws"].values() for x in ids}
    if sealed & development or not (sealed | development).issubset(held):
        raise ValueError("Final/development law partitions overlap or are not reserved")
    splits, seen = {}, set()
    for split in ("train", "valid"):
        path = data / f"{split}.jsonl"
        if digest(path) != manifest["splits"][path.name]["sha256"]:
            raise ValueError("Dataset hash mismatch: " + split)
        rows = [json.loads(line) for line in path.read_text().splitlines()]
        if len(rows) != manifest["splits"][path.name]["rows"]:
            raise ValueError("Row count mismatch")
        for row in rows:
            if row["metadata"]["split"] != split:
                raise ValueError("Row mislabeled by split")
            validate_row(row, held, by_id)
            if sealed.intersection(row["metadata"]["lawIds"]):
                raise ValueError("Sealed evaluation law leaked into training/development")
            if split == "valid" and any(s["relevant"] and s.get("lawId") not in development for s in row["metadata"]["sources"]):
                raise ValueError("Validation target is not a development-held-out law")
            fingerprint = text_digest(json.dumps(row["messages"], ensure_ascii=False))
            if fingerprint in seen:
                raise ValueError("Duplicate or cross-split dialogue")
            seen.add(fingerprint)
        if set(r["metadata"]["area"] for r in rows) != set(AREAS):
            raise ValueError("Area coverage missing")
        measured = enforce(rows, require_prose=split == "train")
        if json.loads(json.dumps(measured)) != manifest['diversity'][split]:
            raise ValueError("Manifest diversity differs from measured data")
        splits[split] = rows
    supervised = {s: {m['content'] for r in rows for m in r['messages'] if m['role'] == 'assistant'}
                  for s, rows in splits.items()}
    if supervised['train'] & supervised['valid']:
        raise ValueError('Supervised assistant text shared across training/development')
    return splits, manifest, holdout


def encode_assistant_turns(row, tokenizer, max_length=4096):
    """Mask *all* assistant bodies and end markers, never user/system/padding.

    Use offsets on the exact complete chat render: independent prefix tokenization
    is unsafe when the template renders historical and final assistants differently.
    Empty thinking scaffolding is not supervised. Never truncate evidence/answers.
    """
    rendered = tokenizer.apply_chat_template(row["messages"], tokenize=False,
                                            add_generation_prompt=False, enable_thinking=False)
    blocks = list(re.finditer(r"<\|im_start\|>(system|user|assistant)\n(.*?)<\|im_end\|>", rendered, re.S))
    if len(blocks) != len(row["messages"]):
        raise ValueError("Unexpected chat serialization or injected control token")
    spans = []
    for block, message in zip(blocks, row["messages"]):
        if block.group(1) != message["role"]:
            raise ValueError("Serialized role mismatch")
        body = block.group(2)
        content = message["content"].strip()
        if message["role"] == "assistant":
            if body not in (content, "<think>\n\n</think>\n\n" + content):
                raise ValueError("Unexpected assistant content/thinking serialization")
            spans.append((block.start(2) + len(body) - len(content), block.end()))
        elif body != content:
            raise ValueError("Unexpected user/system content serialization")
    encoded = tokenizer(rendered, add_special_tokens=False, return_offsets_mapping=True)
    tokens, offsets = encoded["input_ids"], encoded["offset_mapping"]
    if len(tokens) > max_length:
        raise ValueError(f"{row['id']}: {len(tokens)} tokens > {max_length}; no truncation allowed")
    mask = [int(end > start and any(start >= lo and end <= hi for lo, hi in spans)) for start, end in offsets]
    if len(spans) != sum(m["role"] == "assistant" for m in row["messages"]):
        raise ValueError("Assistant turn omitted")
    for lo, hi in spans:
        if not any(bit and start >= lo and end <= hi for bit, (start, end) in zip(mask, offsets)):
            raise ValueError("An assistant turn has zero supervised tokens")
    if not sum(mask[1:]) or mask[0]:
        raise ValueError("Empty/invalid causal loss mask")
    return {"id": row["id"], "tokens": tokens, "mask": mask,
            "assistantTurns": len(spans), "metadata": {k: row["metadata"][k] for k in ("area", "type", "lawIds")}}


def memory_snapshot():
    """Conservative macOS available memory: free + inactive, excludes compressor."""
    if sys.platform != "darwin":
        raise RuntimeError("This recipe requires macOS Apple Silicon; memory guard unavailable")
    result = subprocess.run(["/usr/bin/vm_stat"], capture_output=True, text=True, check=True)
    size = re.search(r"page size of (\d+) bytes", result.stdout)
    values = {name: int(value) for name, value in re.findall(r"^([^:\n]+):\s+(\d+)\.", result.stdout, re.M)}
    if not size or not {"Pages free", "Pages inactive"}.issubset(values):
        raise RuntimeError("Could not measure memory; refuse to guess")
    page = int(size.group(1))
    return {"availableBytes": page * (values["Pages free"] + values["Pages inactive"]),
            "freeBytes": page * values["Pages free"], "inactiveBytes": page * values["Pages inactive"],
            "definition": "vm_stat free+inactive; compressed memory excluded"}


def require_memory(snapshot, minimum_gib):
    if snapshot["availableBytes"] < minimum_gib * 1024**3:
        raise RuntimeError(f"Insufficient available memory: {snapshot['availableBytes'] / 1024**3:.2f} GiB; requires {minimum_gib:.2f} GiB")


def environment_versions():
    result = {"python": sys.version.split()[0]}
    for package in ("mlx", "mlx-lm", "transformers", "tokenizers", "numpy"):
        try:
            result[package] = importlib.metadata.version(package)
        except importlib.metadata.PackageNotFoundError:
            result[package] = None
    return result


def verify_checkpoint(path, signature):
    checkpoint = json.loads((path / "checkpoint.json").read_text())
    if checkpoint["signature"] != signature or checkpoint["step"] < 1:
        raise ValueError("Resume configuration/data/base/script/environment mismatch")
    required = {"adapters.safetensors", "optimizer.safetensors", "random.safetensors", "adapter_config.json"}
    if set(checkpoint["files"]) != required:
        raise ValueError("Incomplete checkpoint file set")
    for name, expected in checkpoint["files"].items():
        candidate = path / name
        if candidate.is_symlink() or not candidate.is_file() or digest(candidate) != expected:
            raise ValueError("Corrupt checkpoint: " + name)
    return checkpoint


def token_summary(encoded):
    sizes = sorted(len(r["tokens"]) for r in encoded)
    return {"rows": len(sizes), "maxTokens": max(sizes), "minTokens": min(sizes),
            "p50Tokens": sizes[len(sizes) // 2], "totalTokens": sum(sizes),
            "supervisedTokens": sum(sum(r["mask"]) for r in encoded),
            "assistantTurns": sum(r["assistantTurns"] for r in encoded), "truncatedRows": 0,
            "byArea": dict(collections.Counter(r["metadata"]["area"] for r in encoded))}
