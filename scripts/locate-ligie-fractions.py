"""Locate printed eight-digit tariff codes in a pinned official LIGIE capture."""
import argparse
import csv
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

OFFICIAL = "https://www.diputados.gob.mx/LeyesBiblio/pdf/LIGIE_2022.pdf"
CODE = re.compile(r"(?<![\d.])([0-9]{4}\.[0-9]{2}\.[0-9]{2})(?!\d|\.\d)")
DEFAULT = (Path(__file__).resolve().parents[1] / "artifacts/public-corpus"
           / "comercio-20261119/ligie-2022/acquisitions")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--adquisicion", type=Path, default=DEFAULT)
    parser.add_argument("--sha256", required=True)
    parser.add_argument("--fraccion", help="Código de ocho dígitos, con o sin puntos")
    args = parser.parse_args()
    if not re.fullmatch(r"[0-9a-f]{64}", args.sha256):
        parser.error("Especifica la huella SHA-256 de la edición que deseas consultar.")
    wanted = args.fraccion
    if wanted and not re.fullmatch(r"(?:\d{8}|\d{4}\.\d{2}\.\d{2})", wanted):
        parser.error("La fracción debe tener ocho dígitos.")
    root = args.adquisicion.resolve()
    source = json.loads((root / "manifest.json").read_text())["sources"]["ligie-2022"]
    version = next((v for v in source["versions"] if v["sha256"] == args.sha256), None)
    if not version or version["url"] != OFFICIAL or version["finalUrl"] != OFFICIAL:
        parser.error("Falta la edición oficial seleccionada en el manifiesto.")
    pdf = (root / version["snapshotPath"]).resolve()
    if root not in pdf.parents or hashlib.sha256(pdf.read_bytes()).hexdigest() != args.sha256:
        parser.error("El PDF local no coincide con la adquisición seleccionada.")
    extracted = subprocess.run(["pdftotext", "-layout", "-enc", "UTF-8", str(pdf), "-"],
                               stdout=subprocess.PIPE, check=True).stdout.decode()
    output = csv.writer(sys.stdout)
    output.writerow(["fraccion", "pagina_pdf", "linea_extraida", "sha256", "enlace_publico", "estado"])
    for page, text in enumerate(extracted.split("\f"), 1):
        for number, line in enumerate(text.splitlines(), 1):
            for code in dict.fromkeys(CODE.findall(line)):
                if wanted and code.replace(".", "") != wanted.replace(".", ""):
                    continue
                output.writerow([code, page, number, args.sha256, f"{OFFICIAL}#page={page}",
                                 "localizador_pendiente_de_cotejo"])


if __name__ == "__main__":
    main()
