"""Rebuild the local article directory from the pinned Chamber of Deputies PDF."""
import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "resources" / "trade"
PDF = ROOT / "reglamento-aduanero-2026.pdf"
DIGEST = "bcdfcd9073014aec4aefbacc01c9dd5b1f97f0da0c4556f0f506d20f12d77812"
heading = re.compile(r"^[ \t]*Artículo\.? +(\d+(?:-[A-Za-z])?)\.(?:-)?[ \t]*", re.M)
if hashlib.sha256(PDF.read_bytes()).hexdigest() != DIGEST:
    raise ValueError("Cambió la edición del Reglamento")
extracted = subprocess.check_output(["pdftotext", "-layout", str(PDF), "-"]).decode("utf-8")
body, stop, _ = re.split(r"(^[ \t]*TRANSITORIOS[ \t]*$)", extracted, maxsplit=1, flags=re.M)
rows = []
seen = set()
for page, text in enumerate(body.split("\f"), start=1):
    for match in heading.finditer(text):
        article = match.group(1)
        if article in seen:
            raise ValueError(f"Encabezado duplicado {article}")
        seen.add(article)
        passages = []
        if article in {"150", "174"}:
            paragraph = text[match.end():].split("\n\n", 1)[0]
            passages.append({"page": page, "locator": "párrafo primero" if article == "150" else "párrafo único",
                             "text": " ".join(paragraph.split())})
        rows.append({"article": article, "page": page, "passages": passages})
if len(rows) != 282 or not set(map(str, range(1, 250))).issubset(seen):
    raise ValueError("Revisar los encabezados del Reglamento")
(ROOT / "reglamento-aduanero-indice.json").write_text(
    json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
