#!/usr/bin/env python3
"""Offline behavioral RAFT LoRA recipe. Default/dry-run NEVER imports MLX or loads weights.

Training requires explicit --run after review. No downloads, fusion, activation,
old memorization adapters, or writes to the preserved base are permitted.
"""
import argparse
import collections
import json
import math
import os
import platform
import random
import signal
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/raft"))
from build import SEED, digest, text_digest, write_json
from runtime_memory import memory_snapshot
from training_support import (encode_assistant_turns, environment_versions,
                              require_memory, token_summary, validate_dataset, verify_checkpoint)

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

# At least 128 input positions: short SDPA vector kernels lack a backward path
# in the pinned MLX build. These synthetic IDs never receive an optimizer update.
BACKWARD_PROBE_TOKENS = tuple(range(1, 130))


def conversational_split(encoded):
    """Fixed public/synthetic chat subset; 128 rows never enter updates."""
    chats = [row for row in encoded["train"] if row["metadata"]["type"] == "chat"]
    if len(chats) != 640 or len({row["id"] for row in chats}) != 640:
        raise ValueError("Expected the audited 640 unique conversational rows")
    random.Random(SEED + 992).shuffle(chats)
    held, train = chats[:128], chats[128:]
    ids = {"train": [r["id"] for r in train], "conversationValidation": [r["id"] for r in held],
           "legalValidation": [r["id"] for r in encoded["valid"]]}
    if set(ids["train"]) & set(ids["conversationValidation"]):
        raise ValueError("Conversation split overlap")
    return {"train": train, "valid": encoded["valid"] + held}, ids


def verify_seeded_rng_resume(saved, random_state):
    """Read-only MLX state: verify exact reconstruction for this zero-dropout recipe.

    The model/LoRA initialization is replayed from SEED before loading adapters.
    Updates and validation perform no sampling. Refuse a changed RNG rather than
    pretending an unsupported item assignment restored it.
    """
    import mlx.core as mx
    current = list(random_state)
    if set(saved) != {str(i) for i in range(len(current))}:
        raise ValueError("RNG state layout differs")
    for index, value in enumerate(current):
        expected = saved[str(index)]
        if expected.shape != value.shape or expected.dtype != value.dtype:
            raise ValueError("RNG state shape/dtype differs")
        mx.eval(value, expected)
        if not bool(mx.array_equal(value, expected).item()):
            raise ValueError("Seeded RNG reconstruction mismatch; do not resume")


def verify_base(base, manifest_path):
    manifest = json.loads(manifest_path.read_text())
    if (manifest.get("repo") != "mlx-community/Qwen3.5-2B-4bit" or
        manifest.get("revision") != "674aaa7240b91e8012fcad5d791b7dfe5ba90207" or
        manifest.get("license") != "apache-2.0"):
        raise ValueError("Unexpected preserved base provenance")
    for entry in manifest["files"]:
        name = entry["file"]
        p = base / name
        if Path(name).name != name or p.is_symlink() or not p.is_file() or p.stat().st_size != entry["bytes"] or digest(p) != entry["sha256"]:
            raise ValueError("Preserved base differs from manifest: " + name)
    config = json.loads((base / "config.json").read_text())
    if config.get("model_type") != "qwen3_5" or config.get("quantization", {}).get("bits") != 4 or config["text_config"]["num_hidden_layers"] != 24:
        raise ValueError("Unexpected architecture or quantization")
    return {"manifestSha256": digest(manifest_path), "files": {e["file"]: e["sha256"] for e in manifest["files"]},
            "revision": manifest["revision"], "layers": 24, "quantizationBits": 4}


def enable_training_kernels(model):
    """Select differentiable recurrence; adapters in this recipe have dropout=0."""
    model.train()


def bounded_projection_loss(hidden, positions, targets, projection, chunk_size=16):
    """Exact supervised-token mean; recompute output chunks during backward.

    The frozen tied head needs no weight gradients. Checkpointing each projection
    avoids retaining assistant_tokens * vocabulary logits for the whole dialogue.
    """
    import mlx.core as mx
    import mlx.nn as nn
    if not positions or len(positions) != len(targets) or chunk_size < 1:
        raise ValueError("Invalid supervised projection targets")

    total = mx.array(0.0)
    for offset in range(0, len(positions), chunk_size):
        indices = mx.array(positions[offset:offset + chunk_size], dtype=mx.int32)
        labels = mx.array([targets[offset:offset + chunk_size]], dtype=mx.int32)
        # Bind labels per chunk, but do not ask checkpoint's VJP to differentiate
        # integer indices/targets. Only the hidden states require gradients.
        def chunk_loss(states, indices=indices, labels=labels):
            logits = projection(states[:, indices, :])
            return nn.losses.cross_entropy(logits.astype(mx.float32), labels, reduction="sum")
        total = total + mx.checkpoint(chunk_loss)(hidden)
    return total / len(positions)


def checkpointed_delta_update(original, chunk_size=32):
    """Rematerialize recurrent states in bounded chunks, preserving state VJPs.

    Installed only in this training process. Inference keeps the SDK's fast path;
    no stop_gradient, detached state, token truncation or dependency edits.
    """
    import mlx.core as mx
    if chunk_size < 1:
        raise ValueError("Invalid recurrence chunk size")

    def update(q, k, v, a, b, A_log, dt_bias, state=None, mask=None, *,
               use_kernel=True, lower_bound=None, allow_neg_eigval=False):
        options = dict(use_kernel=use_kernel, lower_bound=lower_bound, allow_neg_eigval=allow_neg_eigval)
        if use_kernel or q.shape[1] <= chunk_size:
            return original(q, k, v, a, b, A_log, dt_bias, state, mask, **options)
        if state is None:
            state = mx.zeros((q.shape[0], v.shape[2], v.shape[3], k.shape[3]), dtype=mx.float32)
        outputs = []
        for offset in range(0, q.shape[1], chunk_size):
            span = slice(offset, offset + chunk_size)
            chunk_mask = None if mask is None else mask[:, span]
            def block(qc, kc, vc, ac, bc, log, bias, previous, chunk_mask=chunk_mask):
                return original(qc, kc, vc, ac, bc, log, bias, previous, chunk_mask, **options)
            result, state = mx.checkpoint(block)(q[:, span], k[:, span], v[:, span],
                a[:, span], b[:, span], A_log, dt_bias, state)
            outputs.append(result)
        return mx.concatenate(outputs, axis=1), state

    return update


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--run", action="store_true")
    parser.add_argument("--data", type=Path, default=ROOT / "artifacts/raft")
    parser.add_argument("--library", type=Path, default=ROOT / "resources/public-library.sqlite")
    parser.add_argument("--base", type=Path, default=ROOT / "artifacts/training/qwen-base-2b-4bit")
    parser.add_argument("--base-manifest", type=Path, default=ROOT / "artifacts/training/qwen-base-manifest.json")
    parser.add_argument("--output", type=Path, default=ROOT / "artifacts/raft/dry-run")
    parser.add_argument("--resume", type=Path, help="Complete RAFT checkpoint directory; output must be a new directory")
    parser.add_argument("--epochs", type=int, default=1)
    parser.add_argument("--steps", type=int, default=0, help="Absolute final optimizer step; 0 = full planned epochs")
    parser.add_argument("--grad-accum", type=int, default=4)
    parser.add_argument("--max-seq-length", type=int, default=4096)
    parser.add_argument("--learning-rate", type=float, default=1e-5)
    parser.add_argument("--memory-gib", type=float, default=8)
    parser.add_argument("--min-free-gib", type=float, default=10)
    parser.add_argument("--reserve-gib", type=float, default=2)
    parser.add_argument("--wall-seconds", type=int, default=21600)
    parser.add_argument("--save-every", type=int, default=25)
    parser.add_argument("--validation-every", type=int, default=100)
    parser.add_argument("--layers", type=int, default=24)
    parser.add_argument("--lora-rank", type=int, choices=[4, 8, 16], default=16)
    parser.add_argument("--wait-start-seconds", type=int, default=0)
    parser.add_argument("--focus", choices=["all", "conversation"], default="all")
    args = parser.parse_args()
    args.output = args.output.resolve()
    if not args.output.is_relative_to((ROOT / "artifacts/raft").resolve()) or args.output == args.data.resolve():
        raise ValueError("Output must be a new subdirectory under artifacts/raft, separate from data")
    if args.output.exists():
        raise ValueError("Preserve previous evidence: choose a new --output directory")
    if (not 1 <= args.epochs <= 5 or not 1 <= args.grad_accum <= 32 or
        not 512 <= args.max_seq_length <= 4096 or not 0 < args.learning_rate <= 1e-4 or
        not 4 <= args.memory_gib <= 16 or args.reserve_gib < 2 or
        args.min_free_gib < args.memory_gib + args.reserve_gib or not 60 <= args.wall_seconds <= 86400 or
        not 1 <= args.save_every <= 250 or not 1 <= args.validation_every <= 1250 or
        not 1 <= args.layers <= 24 or not 0 <= args.wait_start_seconds <= 600):
        raise ValueError("Resource/configuration bounds violated")
    if args.run and (platform.system() != "Darwin" or platform.machine() != "arm64"):
        raise RuntimeError("Training requires Apple Silicon macOS")
    return args


def main():
    args = parse_args()
    args.output.mkdir(parents=True)
    started = time.monotonic()
    report = {"status": "VALIDATING", "trainingStarted": False, "completedStepsThisRun": 0,
              "completedStep": 0, "metrics": [], "validation": [], "candidateActivated": False,
              "legalValidation": False, "physical8GBValidation": False, "weightsLoaded": False}
    base_info = None
    lock = None
    try:
        report["environment"] = environment_versions()
        splits, dataset, heldout = validate_dataset(args.data, args.library)
        base_info = verify_base(args.base, args.base_manifest)
        report["base"] = base_info
        report["memoryAtPreparation"] = memory_snapshot()
        report["wouldPassStartMemoryGuard"] = report["memoryAtPreparation"]["availableBytes"] >= args.min_free_gib * 1024**3
        from transformers import AutoTokenizer
        tokenizer = AutoTokenizer.from_pretrained(str(args.base.resolve()), local_files_only=True,
                                                  trust_remote_code=False, use_fast=True)
        if not tokenizer.is_fast:
            raise ValueError("Fast tokenizer offsets required for exact assistant masks")
        encoded = {}
        for split, rows in splits.items():
            encoded[split] = [encode_assistant_turns(r, tokenizer, args.max_seq_length) for r in rows]
        report["auditedCorpusTokens"] = {s: token_summary(rows) for s, rows in encoded.items()}
        if args.focus == "conversation":
            encoded, selection = conversational_split(encoded)
            write_json(args.output / "effective-split.json", selection)
            report["effectiveSplitSha256"] = digest(args.output / "effective-split.json")
        report["tokens"] = {s: token_summary(rows) for s, rows in encoded.items()}
        report["heldOut"] = {"sealedEvaluationLawIds": heldout["sealedEvaluationLawIds"],
                             "developmentHeldOutLaws": heldout["developmentHeldOutLaws"],
                             "trainingOverlap": 0, "sealedEvaluationUsedForValidation": False}
        schedule = []
        for epoch in range(args.epochs):
            order = list(range(len(encoded["train"])))
            random.Random(SEED + epoch).shuffle(order)
            schedule.extend(order)
        steps = math.ceil(len(schedule) / args.grad_accum)
        final_step = args.steps or steps
        if not 1 <= final_step <= steps:
            raise ValueError("--steps must be within the immutable epoch schedule")
        config = {"model": str(args.base.resolve()), "fine_tune_type": "lora", "num_layers": args.layers,
                  "lora_parameters": {"rank": args.lora_rank, "scale": 2.0, "dropout": 0.0},
                  "targetModules": f"all supported linear projections in last {args.layers} of 24 decoder layers",
                  "seed": SEED, "learning_rate": args.learning_rate, "batch_size": 1,
                  "focus": args.focus, "effectiveSplitSha256": report.get("effectiveSplitSha256"),
                  "gradientAccumulation": args.grad_accum, "epochs": args.epochs,
                  "max_seq_length": args.max_seq_length, "save_every": args.save_every,
                  "validation_every": args.validation_every,
                  "rngResumePolicy": "seeded-no-stochastic-updates-exact-verification-v1",
                  "loss": "all assistant body/end tokens only; token-weighted accumulation",
                  "gradientCheckpointing": True, "trainingKernelPolicy": "differentiable-train-fast-eval-v1",
                  "outputProjectionChunk": 16, "outputProjectionCheckpointing": True,
                  "recurrentCheckpointChunk": 32,
                  "maxMlxBytes": int(args.memory_gib * 1024**3),
                  "minimumAvailableGiB": args.min_free_gib, "reserveGiB": args.reserve_gib}
        report.update(config=config, estimatedOptimizerSteps=steps, requestedFinalStep=final_step,
                      estimatedMicrobatches=len(schedule), dataManifestSha256=digest(args.data / "manifest.json"))
        script_files = [Path(__file__)] + sorted(p for p in (ROOT / "scripts/raft").rglob("*")
                                                if p.suffix in {".py", ".tsv", ".jsonl", ".txt"} and "__pycache__" not in p.parts)
        signature = {"config": config, "base": base_info, "environment": report["environment"],
                     "dataManifestSha256": report["dataManifestSha256"],
                     "scheduleSha256": text_digest(json.dumps(schedule)),
                     "scripts": {str(p.relative_to(ROOT)): digest(p) for p in script_files}}
        report["signature"] = signature
        write_json(args.output / "adapter_config.json", config)
        for file in script_files:
            target = args.output / "reproduction" / file.relative_to(ROOT)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(file.read_bytes())
        checkpoint_state = verify_checkpoint(args.resume, signature) if args.resume else None
        begin = checkpoint_state["step"] if checkpoint_state else 0
        if begin >= final_step:
            raise ValueError("Resume checkpoint already reached requested final step")
        report["completedStep"] = begin
        report["resumeVerified"] = bool(checkpoint_state)
        if not args.run:
            report["status"] = "DRY_RUN_VALIDATED_NOT_TRAINED"
            return
        # This branch is never reached by default or --dry-run.
        # Tokenizer/dataset preparation can change available memory after the
        # outer supervisor's check. Wait here without weights, never weaken the
        # same allocation + reserve requirement to cross that race.
        deadline = time.monotonic() + args.wait_start_seconds
        while memory_snapshot()["availableBytes"] < args.min_free_gib * 1024**3 and time.monotonic() < deadline:
            report["status"] = "WAITING_FOR_START_MEMORY"
            report["startMemory"] = memory_snapshot()
            write_json(args.output / "training-report.json", report)
            print(json.dumps({"phase": "waiting-for-start-memory", "availableBytes": report["startMemory"]["availableBytes"]}), flush=True)
            time.sleep(min(10, max(0, deadline - time.monotonic())))
        require_memory(memory_snapshot(), args.min_free_gib)
        for name in ("pipeline.lock", "gpu.lock"):
            if (ROOT / "artifacts/training" / name).exists():
                raise RuntimeError("Existing training lock; coordinate with its owner before running")
        lock = ROOT / "artifacts/raft/training.lock"
        with lock.open("x") as f:
            json.dump({"pid": os.getpid(), "output": str(args.output)}, f)
        report["trainingStarted"] = True
        run_training(args, report, encoded, schedule, signature, checkpoint_state, final_step)
    except BaseException as error:
        report["status"] = "INTERRUPTED_RESUMABLE" if report.get("latestCheckpoint") else "FAILED"
        report["error"] = f"{type(error).__name__}: {error}"
        raise
    finally:
        if base_info:
            changed = [name for name, expected in base_info["files"].items() if digest(args.base / name) != expected]
            report["baseFilesModified"] = changed
            if changed:
                report["status"] = "FAILED_BASE_INTEGRITY"
        report["elapsedSeconds"] = time.monotonic() - started
        write_json(args.output / "training-report.json", report)
        if lock and lock.exists():
            owner = json.loads(lock.read_text())
            if owner.get("pid") == os.getpid():
                lock.unlink()
        print(json.dumps({k: report.get(k) for k in ("status", "trainingStarted", "weightsLoaded",
                         "completedStepsThisRun", "estimatedOptimizerSteps", "tokens", "wouldPassStartMemoryGuard", "error")}, ensure_ascii=False))
        if report.get("baseFilesModified"):
            raise RuntimeError("Preserved base changed; reject candidate and inspect integrity report")


def run_training(args, report, encoded, schedule, signature, resume, final_step):
    import mlx.core as mx
    import mlx.nn as nn
    import mlx.optimizers as optim
    from mlx.utils import tree_flatten, tree_map, tree_unflatten
    from mlx_lm.utils import load
    from mlx_lm.tuner.trainer import grad_checkpoint
    from mlx_lm.tuner.utils import linear_to_lora_layers
    from mlx_lm.models import qwen3_5

    started = time.monotonic()
    limit = report["config"]["maxMlxBytes"]
    mx.set_memory_limit(limit)
    mx.set_wired_limit(min(limit, mx.device_info()["max_recommended_working_set_size"]))
    mx.set_cache_limit(64 * 1024**2)
    mx.random.seed(SEED)

    def stop(signum, frame):
        raise KeyboardInterrupt("Training interrupted; resume latest complete checkpoint")

    old_term = signal.signal(signal.SIGTERM, stop)
    old_alarm = signal.signal(signal.SIGALRM, stop)
    signal.alarm(args.wall_seconds)
    original_delta_update = qwen3_5.gated_delta_update
    qwen3_5.gated_delta_update = checkpointed_delta_update(original_delta_update,
        report["config"]["recurrentCheckpointChunk"])

    def guard():
        require_memory(memory_snapshot(), args.reserve_gib)
        if mx.get_peak_memory() > limit or time.monotonic() - started > args.wall_seconds:
            raise RuntimeError("Training memory/time bound exceeded")

    try:
        model, _ = load(str(args.base.resolve()), tokenizer_config={"trust_remote_code": False}, trust_remote_code=False)
        report["weightsLoaded"] = True
        model.freeze()
        linear_to_lora_layers(model, args.layers, report["config"]["lora_parameters"])
        if len(model.layers) != 24:
            raise ValueError("Expected all 24 decoder layers")
        per_layer = []
        for i, layer in enumerate(model.layers):
            trainable = dict(tree_flatten(layer.trainable_parameters()))
            adapted = i >= 24 - args.layers
            if (adapted and not trainable) or (not adapted and trainable) or any(not k.endswith(("lora_a", "lora_b")) for k in trainable):
                raise ValueError(f"Invalid adapter coverage in layer {i}")
            per_layer.append({"layer": i, "adapted": adapted, "parameters": sum(v.size for v in trainable.values()), "modules": sorted(trainable)})
        all_trainable = dict(tree_flatten(model.trainable_parameters()))
        if any(not k.endswith(("lora_a", "lora_b")) or ".layers." not in k for k in all_trainable):
            raise ValueError("Trainable parameters escaped decoder LoRA adapters")
        report["adapterCoverage"] = per_layer
        report["trainableParameters"] = sum(v.size for v in all_trainable.values())
        # Dropout stays zero, but Qwen3.5 must use its differentiable recurrence
        # for updates. eval() selects a CustomKernel without a backward pass.
        enable_training_kernels(model)
        for cls in {type(layer) for layer in model.layers}:
            grad_checkpoint(next(layer for layer in model.layers if type(layer) is cls))
        optimizer = optim.Adam(learning_rate=args.learning_rate)
        optimizer.init(model.trainable_parameters())
        mx.eval(model.parameters(), optimizer.state)
        begin = 0
        if resume:
            restored_adapters = mx.load(str(args.resume / "adapters.safetensors"))
            if set(restored_adapters) != set(all_trainable) or any(restored_adapters[k].shape != all_trainable[k].shape for k in all_trainable):
                raise ValueError("Checkpoint adapter keys/shapes do not cover the configured LoRA")
            model.load_weights(str(args.resume / "adapters.safetensors"), strict=False)
            restored = tree_unflatten(list(mx.load(str(args.resume / "optimizer.safetensors")).items()))
            optimizer.state = restored
            saved_rng = mx.load(str(args.resume / "random.safetensors"))
            verify_seeded_rng_resume(saved_rng, mx.random.state)
            report["rngResumeVerified"] = True
            mx.eval(model.trainable_parameters(), optimizer.state, mx.random.state)
            begin = resume["step"]
            if int(optimizer.step.item()) != begin:
                raise ValueError("Optimizer step differs from checkpoint")
            report["resumedFrom"] = str(args.resume)

        def selected_logits(m, tokens, positions):
            # Pinned architecture's exact tied-output projection. Project only
            # supervised positions to avoid allocating seq_len * 248320 logits.
            hidden = m.language_model.model(tokens)
            return m.language_model.model.embed_tokens.as_linear(hidden[:, positions, :])

        probe = mx.array([[1, 2, 3, 4, 5, 6, 7, 8]], dtype=mx.int32)
        pos = mx.array([0, 3, 6], dtype=mx.int32)
        reference = model(probe)[:, pos, :]
        selected = selected_logits(model, probe, pos)
        mx.eval(reference, selected)
        if not bool(mx.allclose(reference, selected, atol=2e-3, rtol=2e-3).item()):
            raise RuntimeError("Selected-position logits differ from full model")
        report["selectedLogitEquivalencePassed"] = True
        del reference, selected
        mx.clear_cache()
        guard()

        def loss(m, tokens, mask):
            target_positions = [i for i in range(1, len(tokens)) if mask[i]]
            inputs = mx.array([tokens[:-1]], dtype=mx.int32)
            hidden = m.language_model.model(inputs)
            return bounded_projection_loss(hidden, [i - 1 for i in target_positions],
                [tokens[i] for i in target_positions], m.language_model.model.embed_tokens.as_linear,
                report["config"]["outputProjectionChunk"])

        gradient = nn.value_and_grad(model, loss)

        # Exercise the actual backward path before the expensive full validation.
        # No optimizer update, random sampling, or dataset/split modification.
        probe_tokens = list(BACKWARD_PROBE_TOKENS)
        probe_value, probe_grads = gradient(model, probe_tokens, [False] * (len(probe_tokens) - 4) + [True] * 4)
        mx.eval(probe_value, probe_grads)
        if not math.isfinite(float(probe_value.item())) or not all(
            bool(mx.all(mx.isfinite(g)).item()) for _, g in tree_flatten(probe_grads)
        ):
            raise RuntimeError("Nonfinite backward probe; no optimizer update")
        report["gradientProbePassed"] = True
        report["gradientProbeInputTokens"] = len(probe_tokens) - 1
        del probe_value, probe_grads
        mx.clear_cache()
        guard()
        write_json(args.output / "training-report.json", report)
        print(json.dumps({"phase": "backward-probe-passed", "peakMlxBytes": mx.get_peak_memory()}), flush=True)

        def evaluate(step):
            totals = collections.defaultdict(lambda: [0.0, 0, 0])
            model.eval()
            try:
                for row in encoded["valid"]:
                    value = loss(model, row["tokens"], row["mask"])
                    mx.eval(value)
                    number = float(value.item())
                    if not math.isfinite(number):
                        raise RuntimeError("Nonfinite validation loss")
                    count = sum(row["mask"][1:])
                    keys = ["all", "area:" + row["metadata"]["area"]]
                    if row["metadata"]["type"] == "chat":
                        keys += ["conversation"]
                    else:
                        target_laws = set(row["metadata"]["lawIds"]) & set(x for v in report["heldOut"]["developmentHeldOutLaws"].values() for x in v)
                        if len(target_laws) != 1:
                            raise ValueError("Ambiguous development law")
                        keys += ["legal", "law:" + next(iter(target_laws))]
                    for key in keys:
                        totals[key][0] += number * count
                        totals[key][1] += count
                        totals[key][2] += 1
                    mx.clear_cache()
                    guard()
            finally:
                enable_training_kernels(model)
            result = {"step": step, "groups": {k: {"loss": v[0] / v[1], "supervisedTokens": v[1], "rows": v[2]} for k, v in totals.items()}}
            report["validation"].append(result)
            write_json(args.output / "training-report.json", report)
            return result

        def checkpoint(step):
            temp = args.output / f"checkpoint-{step:07d}.partial"
            dest = args.output / f"checkpoint-{step:07d}"
            temp.mkdir()
            mx.eval(model.trainable_parameters(), optimizer.state, mx.random.state)
            mx.save_safetensors(str(temp / "adapters.safetensors"), dict(tree_flatten(model.trainable_parameters())))
            # Scalar hyperparameters, if any, are explicitly stored as arrays.
            mx.save_safetensors(str(temp / "optimizer.safetensors"), {k: mx.array(v) for k, v in tree_flatten(optimizer.state)})
            mx.save_safetensors(str(temp / "random.safetensors"), {str(i): v for i, v in enumerate(mx.random.state)})
            write_json(temp / "adapter_config.json", report["config"])
            names = ["adapters.safetensors", "optimizer.safetensors", "random.safetensors", "adapter_config.json"]
            state = {"step": step, "nextMicrobatch": min(step * args.grad_accum, len(schedule)),
                     "signature": signature, "files": {name: digest(temp / name) for name in names}}
            write_json(temp / "checkpoint.json", state)
            temp.rename(dest)
            report["latestCheckpoint"] = str(dest)
            write_json(args.output / "latest-checkpoint.json", {"path": str(dest), "step": step, "sha256": digest(dest / "checkpoint.json")})
            write_json(args.output / "training-report.json", report)

        report["status"] = "TRAINING_EXPERIMENTAL"
        evaluate(begin)
        with (args.output / "step-metrics.jsonl").open("x") as metrics:
            for step in range(begin + 1, final_step + 1):
                guard()
                tick = time.monotonic()
                indices = schedule[(step - 1) * args.grad_accum:step * args.grad_accum]
                accumulated, total_tokens, loss_sum = None, 0, 0.0
                for index in indices:
                    row = encoded["train"][index]
                    value, grads = gradient(model, row["tokens"], row["mask"])
                    mx.eval(value, grads)
                    number = float(value.item())
                    if not math.isfinite(number):
                        raise RuntimeError("Nonfinite training loss")
                    count = sum(row["mask"][1:])
                    weighted = tree_map(lambda g: g * count, grads)
                    accumulated = weighted if accumulated is None else tree_map(lambda a, b: a + b, accumulated, weighted)
                    mx.eval(accumulated)
                    total_tokens += count
                    loss_sum += number * count
                    mx.clear_cache()
                    guard()
                grads = tree_map(lambda g: g / total_tokens, accumulated)
                finite = mx.all(mx.stack([mx.all(mx.isfinite(g)) for _, g in tree_flatten(grads)]))
                mx.eval(finite)
                if not bool(finite.item()):
                    raise RuntimeError("Nonfinite gradient; no optimizer update")
                grads, grad_norm = optim.clip_grad_norm(grads, 1.0)
                optimizer.update(model, grads)
                mx.eval(model.trainable_parameters(), optimizer.state, grad_norm)
                guard()
                metric = {"step": step, "loss": loss_sum / total_tokens, "supervisedTokens": total_tokens,
                          "microbatches": len(indices), "rowIds": [encoded["train"][i]["id"] for i in indices],
                          "gradientNorm": float(grad_norm.item()), "elapsedSeconds": time.monotonic() - tick,
                          "peakMlxBytes": mx.get_peak_memory()}
                report["metrics"].append(metric)
                report["completedStep"] = step
                report["completedStepsThisRun"] += 1
                metrics.write(json.dumps(metric) + "\n")
                metrics.flush()
                if step % 10 == 0 or step == begin + 1:
                    print(json.dumps(metric), flush=True)
                if step % args.save_every == 0 or step == final_step:
                    checkpoint(step)
                if step % args.validation_every == 0 or step == final_step:
                    evaluate(step)
                mx.clear_cache()
        report["status"] = "TRAINED_EXPERIMENTAL_NOT_LEGALLY_VALIDATED"
    finally:
        qwen3_5.gated_delta_update = original_delta_update
        signal.alarm(0)
        signal.signal(signal.SIGTERM, old_term)
        signal.signal(signal.SIGALRM, old_alarm)
        report["peakMlxBytes"] = mx.get_peak_memory()


if __name__ == "__main__":
    main()
