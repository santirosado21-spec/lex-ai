"""Offline paired conversation diagnostics for a verified RAFT checkpoint."""
import argparse
import importlib
import json
import os
from pathlib import Path
import re
import signal
import sys
import time
import unicodedata

os.environ.update(HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1", HF_HUB_DISABLE_TELEMETRY="1", TOKENIZERS_PARALLELISM="false")
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/raft"))
from build import digest, write_json
from runtime_memory import memory_snapshot
from training_support import require_memory, verify_checkpoint
from raft_train import verify_base
from common import claim_locks


def normalized(text):
    return "".join(c for c in unicodedata.normalize("NFKD", text.casefold()) if not unicodedata.combining(c))


def score(case, text, finish_reason):
    value = normalized(text)
    checks = {"nonempty": bool(text.strip()), "finished": finish_reason == "stop",
              "noUnprovidedCitations": not bool(re.search(r"\[(?:S|L)\d+\]", text))}
    if case.get("required"):
        checks["requiredContext"] = all(normalized(x) in value for x in case["required"])
    if case.get("forbidden"):
        checks["noForbiddenContent"] = not any(normalized(x) in value for x in case["forbidden"])
    if case.get("anyOf"):
        checks["expectedSignal"] = any(normalized(x) in value for x in case["anyOf"])
    if case.get("maxWords"):
        checks["requestedBrevity"] = len(text.split()) <= case["maxWords"]
    if case.get("noNumbers"):
        checks["noInventedNumericDeadline"] = not bool(re.search(r"\d", text))
    return checks


def validate_suite(path, training):
    suite = json.loads(path.read_text())
    if not suite.get("cases") or len({x["id"] for x in suite["cases"]}) != len(suite["cases"]):
        raise ValueError("Invalid conversation case set")
    train_text = normalized(training.read_text())
    if any(normalized(name) in train_text for name in suite["heldOutNames"]):
        raise ValueError("Evaluation identity leaked into training")
    return suite


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--checkpoint", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--suite", type=Path, default=ROOT / "eval/conversation-nightly-2026-11-03.json")
    p.add_argument("--wall-seconds", type=int, default=1800)
    a = p.parse_args()
    if not 60 <= a.wall_seconds <= 3600 or a.output.exists():
        raise ValueError("Evaluation bounds/output invalid")
    state = json.loads((a.checkpoint / "checkpoint.json").read_text())
    verify_checkpoint(a.checkpoint, state["signature"])
    base = Path(state["signature"]["config"]["model"])
    manifest = ROOT / "artifacts/training/qwen-base-manifest.json"
    provenance = verify_base(base, manifest)
    if provenance != state["signature"]["base"] or digest(ROOT / "artifacts/raft/manifest.json") != state["signature"]["dataManifestSha256"]:
        raise ValueError("Base/dataset checkpoint mismatch")
    suite = validate_suite(a.suite, ROOT / "artifacts/raft/train.jsonl")
    require_memory(memory_snapshot(), 7)
    a.output.mkdir(parents=True)
    report = {"status": "RUNNING", "checkpoint": str(a.checkpoint), "checkpointSha256": digest(a.checkpoint / "checkpoint.json"),
              "suiteSha256": digest(a.suite), "suite": suite, "base": provenance, "arms": {},
              "candidateActivated": False, "legalValidation": False, "physical8GBValidation": False,
              "scope": "Synthetic mechanical conversation checks with inspectable paired outputs; not semantic or professional validation."}
    started = time.monotonic()
    release = claim_locks()
    def interrupted(signum, frame):
        raise KeyboardInterrupt("Evaluation time/signal limit")
    signal.signal(signal.SIGALRM, interrupted)
    signal.signal(signal.SIGTERM, interrupted)
    signal.alarm(a.wall_seconds)
    try:
        import mlx.core as mx
        from mlx_lm.utils import load
        from mlx_lm.tuner.utils import load_adapters
        from mlx_lm.sample_utils import make_sampler
        generation = importlib.import_module("mlx_lm.generate")
        generation.maybe_set_recommended_wired_limit = lambda: None
        limit = 5 * 1024**3
        mx.set_memory_limit(limit)
        mx.set_wired_limit(min(limit, mx.device_info()["max_recommended_working_set_size"]))
        mx.set_cache_limit(64 * 1024**2)
        model, tokenizer = load(str(base), tokenizer_config={"trust_remote_code": False}, trust_remote_code=False)
        model.freeze()
        model.eval()
        tokenizer.add_eos_token("<|im_end|>")
        system = {"role": "system", "content": "Eres LEX AI. Conversa en español con claridad y brevedad. Usa solo el contexto de este chat; reconoce lo que no sabes. No inventes fuentes, nombres ni plazos legales. No tienes permiso de ejecutar acciones ni enviar mensajes."}
        for arm in ("base", "candidate"):
            if arm == "candidate":
                load_adapters(model, str(a.checkpoint))
                model.eval()
            outputs = []
            report["arms"][arm] = {"cases": outputs}
            for case in suite["cases"]:
                require_memory(memory_snapshot(), 2)
                messages = [system] + case["messages"]
                prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True, enable_thinking=False)
                tokens = tokenizer.encode(prompt, add_special_tokens=False)
                if len(tokens) + 160 > 4096:
                    raise ValueError("Evaluation exceeds context; no truncation")
                text, last = "", None
                tick = time.monotonic()
                for item in generation.stream_generate(model, tokenizer, prompt=tokens, max_tokens=160,
                        sampler=make_sampler(temp=0), max_kv_size=4096, prefill_step_size=128):
                    text += item.text
                    last = item
                    if len(text) > 12000 or mx.get_peak_memory() > limit:
                        raise RuntimeError("Evaluation memory/output guard")
                reason = last.finish_reason if last else "empty"
                checks = score(case, text, reason)
                outputs.append({"id": case["id"], "text": text, "doneReason": reason, "checks": checks,
                                "elapsedSeconds": time.monotonic() - tick,
                                "outputTokens": last.generation_tokens if last else 0})
                write_json(a.output / "paired-conversation.json", report)
                mx.clear_cache()
            bits = [b for row in outputs for b in row["checks"].values()]
            report["arms"][arm]["summary"] = {"passed": sum(bits), "total": len(bits), "cases": len(outputs)}
        report["status"] = "PAIRED_CONVERSATION_DIAGNOSTIC_COMPLETE_EXPERIMENTAL"
        report["peakMlxBytes"] = mx.get_peak_memory()
    except BaseException as error:
        report.update(status="FAILED", error=f"{type(error).__name__}: {error}")
        raise
    finally:
        signal.alarm(0)
        report["elapsedSeconds"] = time.monotonic() - started
        report["baseFilesModified"] = [name for name, sha in provenance["files"].items() if digest(base / name) != sha]
        if report["baseFilesModified"]:
            report["status"] = "FAILED_BASE_INTEGRITY"
        write_json(a.output / "paired-conversation.json", report)
        release()
    print(json.dumps({"status": report["status"], "summaries": {k: v["summary"] for k, v in report["arms"].items()}}), flush=True)


if __name__ == "__main__":
    main()
