"""Bounded offline night run: fresh pilot, verified resume, training, paired eval."""
import argparse
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/raft"))
from build import digest, write_json
from runtime_memory import memory_snapshot
from training_support import verify_checkpoint


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--hours", type=float, default=8)
    p.add_argument("--mode", choices=["run", "status", "stop"], default="run")
    a = p.parse_args()
    out = a.output.resolve()
    if not out.is_relative_to(ROOT / "artifacts/raft") or out == ROOT / "artifacts/raft" or not 1 <= a.hours <= 12:
        raise ValueError("Night run bounds/output invalid")
    state_file = out / "night-state.json"
    if a.mode != "run":
        state = json.loads(state_file.read_text())
        if a.mode == "stop":
            pid = state["supervisorPid"]
            command = subprocess.check_output(["ps", "-p", str(pid), "-o", "command="], text=True)
            if str(Path(__file__).resolve()) not in command or str(out) not in command:
                raise RuntimeError("PID no longer belongs to this night run")
            os.kill(pid, signal.SIGTERM)
        else:
            live = Path(state.get("phaseOutput", out)) / "step-metrics.jsonl"
            if live.is_file():
                try: state["latestLiveStep"] = json.loads(live.read_text().splitlines()[-1])
                except (IndexError, json.JSONDecodeError): pass
            print(json.dumps(state, indent=2))
        return
    out.mkdir(parents=True, exist_ok=True)
    if state_file.exists():
        raise RuntimeError("Preserve the existing night run; choose a new output")
    lock = ROOT / "artifacts/raft/night-supervisor.lock"
    with lock.open("x") as f:
        json.dump({"pid": os.getpid(), "output": str(out)}, f)
    recipe = ROOT / "scripts/qwen-training/raft_train.py"
    evaluation = ROOT / "scripts/qwen-training/raft_conversation_eval.py"
    suite = ROOT / "eval/conversation-nightly-2026-11-03.json"
    immutable = {str(x): digest(x) for x in [recipe, evaluation, suite] + sorted((ROOT / "scripts/raft").glob("*.py"))}
    state = {"supervisorPid": os.getpid(), "startedAt": time.time(), "deadline": time.time() + a.hours * 3600,
             "candidateActivated": False, "profile": {"layers": 4, "rank": 8, "memoryGiB": 6, "startAvailableGiB": 8,
             "reserveGiB": 2, "saveEvery": 25, "validationEvery": 100, "targetStep": 384,
             "focus": "conversation", "epochs": 3, "trainRows": 512, "heldOutConversationRows": 128}, "scripts": immutable}
    child = None
    awake = None
    def save(status, **items):
        state.update(status=status, updatedAt=time.time(), **items)
        temporary = state_file.with_suffix('.partial')
        write_json(temporary, state)
        temporary.replace(state_file)
    def stop(signum, frame):
        if child is not None and child.poll() is None:
            child.terminate()
            try: child.wait(timeout=120)
            except subprocess.TimeoutExpired:
                save("STOP_PENDING_CHILD_EXIT")
                raise RuntimeError("Child did not exit after termination request")
        save("STOPPED_BY_SIGNAL")
        raise SystemExit(128 + signum)
    def remaining(): return state["deadline"] - time.time()
    def resources(reserve_seconds):
        while True:
            if any(digest(Path(path)) != sha for path, sha in immutable.items()):
                raise RuntimeError("Recipe/evaluation changed; do not continue")
            if remaining() < reserve_seconds:
                raise RuntimeError("Night time budget exhausted while waiting for resources")
            memory = memory_snapshot()
            occupied = any((ROOT / path).exists() for path in ["artifacts/raft/training.lock", "artifacts/training/pipeline.lock", "artifacts/training/gpu.lock"])
            if not occupied and memory["availableBytes"] >= state["profile"]["startAvailableGiB"] * 1024**3:
                return
            save("WAITING_FOR_RESOURCES", availableBytes=memory["availableBytes"], anotherTrainingLock=occupied)
            time.sleep(20)
    def run(command, name):
        nonlocal child
        with (out / f"{name}.log").open("x") as log:
            child = subprocess.Popen(command, cwd=ROOT, stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT,
                                     start_new_session=True, env={**os.environ, "HF_HUB_OFFLINE": "1", "TRANSFORMERS_OFFLINE": "1", "HF_HUB_DISABLE_TELEMETRY": "1", "PYTHONUNBUFFERED": "1"})
            save(name.upper(), childPid=child.pid, command=command)
            return child.wait()
    def train(name, target, checkpoint=None, wall=1200):
        resources(1800)
        phase = out / name
        command = [sys.executable, str(recipe), "--run", "--steps", str(target), "--memory-gib", "6", "--min-free-gib", "8",
                   "--reserve-gib", "2", "--layers", "4", "--lora-rank", "8", "--save-every", "25", "--validation-every", "100", "--wait-start-seconds", "300",
                   "--focus", "conversation", "--epochs", "3",
                   "--wall-seconds", str(wall), "--output", str(phase)]
        if checkpoint: command += ["--resume", str(checkpoint)]
        save("PHASE_PREPARED", phaseOutput=str(phase))
        code = run(command, name)
        report = json.loads((phase / "training-report.json").read_text())
        complete = code == 0 and report.get("status") == "TRAINED_EXPERIMENTAL_NOT_LEGALLY_VALIDATED" and report.get("completedStep") == target
        bounded = name == "main" and report.get("status") == "INTERRUPTED_RESUMABLE" and "KeyboardInterrupt" in report.get("error", "") and "latestCheckpoint" in report
        if not (complete or bounded) or report.get("baseFilesModified") != [] or not report.get("gradientProbePassed"):
            raise RuntimeError(f"{name} failed without automatic retry: {report.get('error', report.get('status'))}")
        if checkpoint and not report.get("rngResumeVerified"):
            raise RuntimeError("Resume did not verify the exact seeded RNG state")
        if report.get("peakMlxBytes", 7 * 1024**3) > 6 * 1024**3:
            raise RuntimeError("Training exceeded the measured allocation bound")
        latest = Path(report["latestCheckpoint"]).resolve()
        if latest.parent != phase:
            raise RuntimeError("Checkpoint escaped its phase")
        record = verify_checkpoint(latest, report["signature"])
        save("PHASE_VERIFIED" if complete else "TIME_BUDGET_CHECKPOINTED", completedStep=record["step"], checkpoint=str(latest),
             peakMlxBytes=report["peakMlxBytes"], phaseOutput=str(phase), phaseComplete=complete)
        return latest
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    try:
        save("PREPARING")
        awake = subprocess.Popen(["/usr/bin/caffeinate", "-i", "-w", str(os.getpid())], stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        first = train("pilot", 1)
        second = train("resume-check", 2, first)
        wall = min(25200, int(remaining()) - 2100)
        if wall < 60: raise RuntimeError("No time remaining for training")
        latest = train("main", state["profile"]["targetStep"], second, wall)
        resources(300)
        code = run([sys.executable, str(evaluation), "--checkpoint", str(latest), "--output", str(out / "evaluation"),
                    "--wall-seconds", str(min(1800, int(remaining()) - 60))], "evaluation")
        report = json.loads((out / "evaluation/paired-conversation.json").read_text())
        if code or report.get("status") != "PAIRED_CONVERSATION_DIAGNOSTIC_COMPLETE_EXPERIMENTAL" or report.get("baseFilesModified") != []:
            raise RuntimeError("Paired evaluation failed; outputs retained, candidate inactive")
        save("FINISHED_EXPERIMENTAL_NOT_ACTIVATED", evaluation=str(out / "evaluation/paired-conversation.json"),
             summaries={k: v["summary"] for k, v in report["arms"].items()})
    except Exception as error:
        save("FAILED_NO_AUTOMATIC_RETRY", error=f"{type(error).__name__}: {error}")
        raise
    finally:
        if awake is not None and awake.poll() is None: awake.terminate()
        if lock.exists() and json.loads(lock.read_text()).get("pid") == os.getpid(): lock.unlink()


if __name__ == "__main__":
    main()
