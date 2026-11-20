"""Index the SNICE bulletin for research. The original HTML can be replayed offline."""
import argparse
from datetime import datetime
from hashlib import sha256
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import parse_qs, urlsplit
from urllib.request import urlopen

SOURCE = "https://www.snice.gob.mx/cs/avi/snice/historicos.dof.html"


class Bulletin(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows = []
        self.cells = None
        self.text = None
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.cells, self.links, self.text = [], [], None
        elif tag == "td" and self.cells is not None:
            self.text = []
        elif tag == "a" and self.text is not None:
            href = dict(attrs).get("href")
            if href and href not in self.links:
                self.links.append(href.strip())

    def handle_data(self, data):
        if self.text is not None:
            self.text.append(data)

    def handle_endtag(self, tag):
        if tag == "td" and self.text is not None:
            self.cells.append(" ".join("".join(self.text).split()))
            self.text = None
        elif tag == "tr" and self.cells is not None:
            self.rows.append((self.cells, self.links))
            self.cells, self.text = None, None


def dof_code(url):
    parts = urlsplit(url)
    if parts.scheme not in {"http", "https"} or parts.hostname not in {
        "www.dof.gob.mx", "dof.gob.mx", "www.diariooficial.gob.mx", "diariooficial.gob.mx"
    }:
        return None
    value = parse_qs(parts.query).get("codigo", [""])[0]
    return value if re.fullmatch(r"[0-9]{7}", value) else None


def index(raw):
    table = Bulletin()
    table.feed(raw.decode("utf-8-sig"))
    table.close()
    publications, unresolved = [], []
    for cells, links in table.rows:
        if not any(cells) or cells[0].casefold() == "fecha":
            continue
        try:
            date = datetime.strptime(cells[0], "%d.%m.%Y").date().isoformat()
        except ValueError:
            date = None
        if not date or len(cells) != 3 or not cells[1] or not cells[2]:
            unresolved.append({"cells": cells, "links": links})
            continue
        codes = sorted({code for link in links if (code := dof_code(link))})
        publications.append({"date": date, "title": cells[1], "authority": cells[2],
                             "links": links, "dofCodes": codes})
    if not publications:
        raise ValueError("SNICE no devolvió publicaciones reconocibles.")
    return {"source": SOURCE, "sha256": sha256(raw).hexdigest(), "bytes": len(raw),
            "publications": publications, "unresolved": unresolved}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="Directorio de investigación")
    parser.add_argument("--input", type=Path, help="Reprocesar un HTML ya descargado")
    options = parser.parse_args()
    if options.input:
        content = options.input.read_bytes()
    else:
        with urlopen(SOURCE, timeout=30) as response:
            content = response.read()
    result = index(content)
    options.output.mkdir(parents=True, exist_ok=True)
    prefix = options.output / ("snice-dof-" + result["sha256"])
    prefix.with_suffix(".html").write_bytes(content)
    prefix.with_suffix(".json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(len(result["publications"]), "filas fechadas,", len(result["unresolved"]), "por revisar.", prefix)
