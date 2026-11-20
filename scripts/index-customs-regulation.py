"""Rebuild the paginated articles from the pinned Chamber of Deputies PDF."""
import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "resources" / "trade"
PDF = ROOT / "reglamento-aduanero-2026.pdf"
DIGEST = "bcdfcd9073014aec4aefbacc01c9dd5b1f97f0da0c4556f0f506d20f12d77812"
heading = re.compile(r"^Artículo\.? +(\d+(?:-[A-Za-z])?)\.(?:-)?\s*")
division = re.compile(r"^(?:TÍTULO +[A-ZÁÉÍÓÚ]+|Capítulo +(?:[IVXLCDM]+|Único)|Sección +[\wÁÉÍÓÚ]+)$")
if hashlib.sha256(PDF.read_bytes()).hexdigest() != DIGEST:
    raise ValueError("Cambió la edición del Reglamento")
extracted = subprocess.check_output(["pdftotext", "-layout", str(PDF), "-"]).decode("utf-8")
pages = extracted.rstrip("\f").split("\f")
if len(pages) != 90:
    raise ValueError("Cambió la paginación del Reglamento")

rows = []
article = None
ended = False
for page, text in enumerate(pages, start=1):
    _, header, content = text.partition("Secretaría de Servicios Parlamentarios")
    footer = re.search(r"\s+" + str(page) + r" de 90\s*$", content)
    if not header or not footer:
        raise ValueError(f"Falta encabezado o pie en página {page}")
    paragraph = True
    for line in content[:footer.start()].splitlines():
        value = line.strip()
        if not value:
            paragraph = True
            continue
        if value == "TRANSITORIOS":
            ended = True
            break
        if division.fullmatch(value):
            article = None
            continue
        match = heading.match(value)
        if match:
            article = {"article": match[1], "page": page, "pages": []}
            rows.append(article)
            value = value[match.end():]
        if article is None or not value:
            continue
        if not article["pages"] or article["pages"][-1]["page"] != page:
            article["pages"].append({"page": page, "text": "", "starts": [0]})
        block = article["pages"][-1]
        if block["text"] and (paragraph or re.match(r"(?:Artículo|Párrafo|Fracción|Inciso) (?:reformad|adicionad|derogad|recorrid)", value)):
            block["starts"].append(len(block["text"]) + 1)
        paragraph = False
        block["text"] = (block["text"] + " " + " ".join(value.split())).lstrip()
    if ended:
        break
ids = {row["article"] for row in rows}
if not ended or len(rows) != len(ids) or len(ids) != 282 or not set(map(str, range(1, 250))).issubset(ids):
    raise ValueError("Revisar los encabezados del Reglamento")
for row in rows:
    if not row["pages"]:
        raise ValueError(f"Artículo sin texto {row['article']}")
(ROOT / "reglamento-aduanero-articulos.json").write_text(
    json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
