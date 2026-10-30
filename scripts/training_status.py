"""Public-only local training telemetry. Never accepts firm documents."""
import json
import os
import threading
import copy
from datetime import datetime,timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
LOCK=threading.RLock()
def now():return datetime.now(timezone.utc).isoformat()
def publish(data):
    with LOCK:
        data={**copy.deepcopy(data),'updatedAt':now()}
        for folder in [ROOT/'artifacts/training',Path(os.environ.get('LEX_MONITOR_DIR',str(Path.home()/'Library/Application Support/LEX AI/public-monitor')))]:
            folder.mkdir(parents=True,exist_ok=True)
            target=folder/'training.json';temp=folder/'training.json.tmp'
            temp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');temp.chmod(0o600);temp.replace(target)
        return data
