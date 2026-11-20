"""Reconcile SNICE April 2024 with Article Primero and the two DOF amendments."""
import hashlib
import json
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1] / "resources/trade"
DOCUMENTS = (
    ("nico-22ago22.pdf", "c5fd56aa5e6d39623539e87ad15336f55d166b0649e616f0c3cedab682c21460"),
    ("nico-mod01_30jun23.pdf", "4cc5f6f38c1be002554ae66c3e6870e4541b5489b95850d6e060dfd9b13ecda9"),
    ("nico-mod02_22mar24.pdf", "f0906faff2fe6510f26798578f9993ad54d0014a4850983144c5bdbb2a317420"),
)
WORKBOOK = ("nico-abril24.xlsx", "86a16096525b0fdbc0d3cd5005ae44fbcbce356c6a9ba7ad16684aef956acd46")
LINE = re.compile(r"^\s*(\d{4}\.\d{2}\.\d{2})\s+(\d\d)(?:\s+(.+?))?\s*$")
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def checked(name, digest):
    path = ROOT / name
    if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
        raise ValueError(f"Edición distinta en {name}")
    return path


def agreements():
    current = {}
    for doc, source in enumerate(DOCUMENTS):
        layout = subprocess.check_output(["pdftotext", "-layout", checked(*source), "-"]).decode()
        section = None
        for page, content in enumerate(layout.split("\f"), 1):
            for line in content.splitlines():
                article = re.match(r"\s*Artículo (Primero|Segundo|Tercero)[.-]", line)
                if article:
                    section = article[1]
                row = LINE.match(line)
                if not row:
                    continue
                key = (row[1], row[2])
                if section == "Primero":
                    if key in current:
                        raise ValueError(f"Creación duplicada {key}")
                    current[key] = (doc, page, row[3] or "")
                elif doc and section == "Segundo":
                    if row[3] != "SUPRIMIDO":
                        raise ValueError(f"Revisar supresión {key}")
                    del current[key]
    return current


def spreadsheet():
    with ZipFile(checked(*WORKBOOK)) as book:
        strings = ["".join(t.text or "" for t in si.iter(NS + "t"))
                   for si in ET.fromstring(book.read("xl/sharedStrings.xml"))]
        sheet = ET.fromstring(book.read("xl/worksheets/sheet1.xml"))
        for row in sheet.iter(NS + "row"):
            number = int(row.attrib["r"])
            if number < 5:
                continue
            values = {}
            for cell in row.findall(NS + "c"):
                raw = cell.findtext(NS + "v")
                if raw is not None:
                    col = cell.attrib["r"].removesuffix(str(number))
                    values[col] = strings[int(raw)] if cell.get("t") == "s" else raw
            if number == 5:
                assert [values[c] for c in "BCD"] == ["FRACCIÓN ARANCELARIA", "NICO", "DESCRIPCIÓN"]
            elif values:
                yield number, values["B"], values["C"], values["D"].strip()


def main():
    current = agreements()
    result = []
    for number, code, nico, description in spreadsheet():
        doc, page, inline = current.pop((code, nico))
        if not description:
            raise ValueError(f"Descripción ausente en fila {number}")
        literal = inline.split() == description.split()
        result.append([code, nico, description, number, doc, page, literal])
    if current:
        raise ValueError(f"Faltan {len(current)} claves en el libro")
    Path(sys.argv[1]).write_bytes("".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n"
                                           for row in result).encode())
    print(len(result), "claves reconciliadas;", sum(row[-1] for row in result), "descripciones coincidentes en una línea")


if __name__ == "__main__":
    main()
