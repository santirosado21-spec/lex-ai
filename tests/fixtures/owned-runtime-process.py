"""Synthetic Linux process fixture. No model, product imports, files or network."""
import json
import os
import signal
import subprocess
import sys
import time

mode = sys.argv[1]
if mode == "memory-tree":
    import resource
    resource.setrlimit(resource.RLIMIT_AS, (96 * 1024**2, 96 * 1024**2))
    # Two simultaneous children each below their inherited per-process cap.
    code = "import time; p=bytearray(64*1024**2); print(len(p),flush=True); time.sleep(5)"
    children = []
    try:
        for _ in range(2):
            children.append(subprocess.Popen([sys.executable, "-c", code], stdout=subprocess.PIPE, text=True))
        sizes = [int(c.stdout.readline()) for c in children]
        print(json.dumps({"allocatedTotal": sum(sizes), "perProcessLimit": 96 * 1024**2}), flush=True)
    finally:
        for c in children:
            c.kill()
            c.wait(timeout=1)
    sys.exit(0)

if mode == "memory":
    import resource
    resource.setrlimit(resource.RLIMIT_AS, (96 * 1024**2, 96 * 1024**2))
    try:
        payload = bytearray(int(sys.argv[2]) * 1024**2)
        print(json.dumps({"allocated": len(payload), "limitKind": "RLIMIT_AS", "limitBytes": 96 * 1024**2}), flush=True)
    except MemoryError:
        print(json.dumps({"blocked": True, "limitKind": "RLIMIT_AS", "limitBytes": 96 * 1024**2}), flush=True)
    sys.exit(0)

# Fixture-owned safety deadline, including when the test runner fails.
signal.signal(signal.SIGALRM, lambda *_: os._exit(124))
signal.alarm(15)
if mode in ("stubborn", "leaf-stubborn"):
    signal.signal(signal.SIGTERM, signal.SIG_IGN)
payload = bytearray(24 * 1024**2)
if mode.startswith("leaf"):
    print(json.dumps({"pid": os.getpid(), "pgid": os.getpgrp()}), flush=True)
    while True:
        time.sleep(0.05)

child = subprocess.Popen(
    [sys.executable, __file__, "leaf-stubborn" if mode == "stubborn" else "leaf"],
    stdout=subprocess.PIPE, text=True, start_new_session=(mode == "escaped")
)
try:
    leaf = json.loads(child.stdout.readline())
    print(json.dumps({"pid": os.getpid(), "pgid": os.getpgrp(), "leaf": leaf}), flush=True)
    # Reap the child while the leader remains alive. An orphan zombie after a
    # group KILL is classified as exited, not as disappearance from /proc.
    while True:
        child.poll()
        time.sleep(0.05)
finally:
    child.kill()
    child.wait(timeout=1)
