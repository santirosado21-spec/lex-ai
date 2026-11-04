"""Versioned runtime memory guard; corpus assembly scripts remain preserved."""
import re
import subprocess
import sys


def memory_snapshot():
    """Kernel free + inactive; vm_stat prints speculative separately from free.

    Apple system_cmds/vm_stat/vm_stat.c subtracts speculative_count when
    printing Pages free. Include it exactly once, without adding overlapping
    purgeable/file-backed counters or counting compressed/active pages.
    """
    if sys.platform != "darwin":
        raise RuntimeError("This recipe requires macOS Apple Silicon; memory guard unavailable")
    result = subprocess.run(["/usr/bin/vm_stat"], capture_output=True, text=True, check=True)
    size = re.search(r"page size of (\d+) bytes", result.stdout)
    values = {name: int(value) for name, value in re.findall(r"^([^:\n]+):\s+(\d+)\.", result.stdout, re.M)}
    if not size or not {"Pages free", "Pages inactive", "Pages speculative"}.issubset(values):
        raise RuntimeError("Could not measure memory; refuse to guess")
    page = int(size.group(1))
    legacy = page * (values["Pages free"] + values["Pages inactive"])
    return {"availableBytes": legacy + page * values["Pages speculative"],
            "legacyAvailableBytes": legacy, "speculativeBytes": page * values["Pages speculative"],
            "freeBytes": page * values["Pages free"], "inactiveBytes": page * values["Pages inactive"],
            "definition": "v2: vm_stat free+inactive+speculative; compressed/active memory excluded"}

