"""Rebuild the selected pilot passages from the pinned public PDF using Poppler."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "resources/trade/ley-aduanera-2025.pdf"
OUTPUT = ROOT / "resources/trade/ley-aduanera-pasajes.json"
SHA = "43927095d22ff7bc7780e78132d2160b5050b5f76026b539daec32be09d7341d"
# Reviewed printed pages. Only whitespace between lines is normalized.
SELECTION = {
    "36": [
        (25, "párrafo primero", "Quienes introduzcan o extraigan", "tecnológico de identificación."),
        (25, "párrafo tercero", "En los pedimentos en los que aparezca", "mandatarios autorizados."),
    ],
    "36-A": [
        (25, "párrafo primero", "Para efectos del artículo 36, en relación", "transmitida y presentada:"),
        (26, "fracción I, inciso a)", "La relativa al valor y demás datos", "59-A de la presente Ley."),
        (26, "fracción I, inciso b)", "La contenida en el conocimiento de embarque", "documento de transporte que corresponda."),
    ],
    "64": [
        (46, "párrafo primero", "La base gravable del impuesto general", "establezca otra base gravable."),
        (46, "párrafo segundo", "El valor en aduana de las mercancías será", "artículo 71 de esta Ley."),
        (46, "párrafo tercero", "Se entiende por valor de transacción", "artículo 65 de esta Ley."),
        (46, "párrafo cuarto", "Se entiende por precio pagado", "en beneficio de éste."),
    ],
    "65": [
        (46, "fracción I, encabezado", "Los elementos que a continuación se mencionan", "precio pagado por las mercancías:"),
        (46, "fracción I, inciso d)", "Los gastos de transporte, seguros y gastos conexos", "artículo 56 de esta Ley."),
        (47, "fracción III", "Las regalías y derechos de licencia", "incluidos en el precio pagado."),
        (47, "párrafo final", "Para la determinación del valor de transacción", "datos objetivos y cuantificables."),
    ],
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, default=PDF)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    if hashlib.sha256(args.pdf.read_bytes()).hexdigest() != SHA:
        raise SystemExit("El PDF difiere de la edición cotejada.")
    pages = {}
    articles = {}
    for article, spans in SELECTION.items():
        articles[article] = []
        for page, locator, start, stop in spans:
            if page not in pages:
                text = subprocess.check_output(["pdftotext", "-layout", "-f", str(page), "-l", str(page),
                                                str(args.pdf), "-"]).decode()
                pages[page] = " ".join(text.split())
            text = pages[page]
            if text.count(start) != 1:
                raise SystemExit(f"Inicio ambiguo en la página {page}")
            first = text.index(start)
            end = text.index(stop, first) + len(stop)
            passage = text[first:end]
            if len(passage) > 850:
                raise SystemExit(f"Revisar límites en la página {page}")
            articles[article].append(dict(page=page, locator=locator, text=passage))
    result = json.dumps(articles, ensure_ascii=False, indent=2) + "\n"
    if args.write:
        OUTPUT.write_text(result, encoding="utf-8")
    elif OUTPUT.read_text(encoding="utf-8") != result:
        raise SystemExit("Los pasajes empaquetados difieren de la extracción.")
    print(f"{sum(map(len, articles.values()))} pasajes cotejados en {len(pages)} páginas")


if __name__ == "__main__":
    main()
