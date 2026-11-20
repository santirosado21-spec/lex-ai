"""Rebuild the nine certification elements from the pinned public Mexican PDF."""
import hashlib
import json
import re
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1] / "resources" / "trade"
source = root / "tmec-capitulo5-procedimientos.pdf"
digest = hashlib.sha256(source.read_bytes()).hexdigest()
if digest != "3cea565ba5be5040878e9332bd0c3f06fc408ae6676c84161de34d613ce33b93":
    raise ValueError("La edición del tratado cambió.")

pages = subprocess.check_output(["pdftotext", "-layout", str(source), "-"]).decode().split("\f")
rows = []
for page in [17, 18]:
    for line in pages[page-1].splitlines():
        line = line.strip()
        if not line or re.fullmatch(r"5-A-[12]", line):
            continue
        heading = re.fullmatch(r"(\d)\.\s+(.+)", line)
        if heading:
            rows.append(dict(point=int(heading[1]), label=heading[2], pages=[page], text=""))
        elif rows:
            row = rows[-1]
            if page not in row["pages"]:
                row["pages"].append(page)
            row["text"] = (row["text"]+" "+" ".join(line.split())).strip()
if [r["point"] for r in rows] != list(range(1,10)) or not all(r["text"] for r in rows):
    raise ValueError("Faltan numerales en el anexo.")
target = root / "tmec-anexo-5a.json"
target.write_text(json.dumps(rows, ensure_ascii=False, indent=2)+"\n")
