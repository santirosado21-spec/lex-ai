"""Rebuild the selected pilot passages from the pinned public PDF using Poppler."""
import argparse
import hashlib
import json
import re
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
    "66": [
        (47, "encabezado", "El valor de transacción de las mercancías importadas no comprenderá", "en forma separada del precio pagado:"),
        (47, "fracción I", "Los gastos que por cuenta propia realice el importador", "artículo 65 de esta Ley."),
        (47, "fracción II, encabezado", "Los siguientes gastos, siempre que se distingan", "mercancías importadas:"),
        (47, "fracción II, inciso a)", "Los gastos de construcción, instalación", "mercancías importadas."),
        (47, "fracción II, inciso b)", "Los gastos de transporte, seguros y gastos conexos tales como", "artículo 56 de esta Ley."),
        (47, "fracción II, inciso c)", "Las contribuciones y las cuotas compensatorias aplicables", "enajenación de las mercancías."),
        (47, "fracción III", "Los pagos del importador al vendedor por dividendos", "con las mercancías importadas."),
        (47, "párrafo final", "Para efectos de lo señalado en este artículo", "comprobante fiscal digital o en el documento equivalente."),
    ],
    "67": [
        (48, "encabezado", "Para los efectos de lo dispuesto por el artículo 64", "las siguientes circunstancias:"),
        (48, "fracción I completa", "Que no existan restricciones a la enajenación", "Las que no afecten el valor de las mercancías."),
        (48, "fracción II", "Que la venta para la exportación con destino", "con relación a las mercancías a valorar."),
        (48, "fracción III", "Que no revierta directa ni indirectamente", "fracción IV del artículo 65 de esta Ley."),
        (48, "fracción IV", "Que no exista vinculación entre el importador", "en el valor de transacción."),
        (48, "párrafo final", "En caso de que no se reúna alguna", "artículo 71 de esta Ley."),
    ],
    "97": [
        (63, "párrafo primero", "Realizada la importación definitiva de las mercancías", "distintas a las convenidas."),
        (63, "párrafo segundo", "El retorno tendrá por objeto la sustitución", "las situaciones mencionadas."),
        (63, "párrafo tercero", "Las mercancías sustitutas deberán llegar", "establecidas por esta Ley."),
        (63, "párrafo cuarto", "Se podrá autorizar el retorno de las mercancías", "causas debidamente justificadas."),
    ],
    "115": [
        (78, "párrafo único", "Se entiende por régimen de exportación temporal para retornar", "sin modificación alguna."),
    ],
    "117": [
        (79, "párrafo primero", "Se autoriza la salida del territorio nacional de mercancías para someterse", "que establezca el Reglamento."),
        ((79, 80), "párrafo segundo", "Al retorno de las mercancías se pagará", "clasificación arancelaria de la mercancía retornada."),
    ],
    "68": [
        (48, "encabezado y fracción I", "Se considera que existe vinculación entre personas para los efectos de esta", "de dirección o responsabilidad en una empresa de la otra."),
        (48, "fracción II", "Si están legalmente reconocidas como asociadas en negocios.", "Si están legalmente reconocidas como asociadas en negocios."),
        (48, "fracción III", "Si tienen una relación de patrón y trabajador.", "Si tienen una relación de patrón y trabajador."),
        (48, "fracción IV", "Si una persona tiene directa o indirectamente la propiedad, el control o", "títulos en circulación y con derecho a voto en ambas."),
        (48, "fracción V", "Si una de ellas controla directa o indirectamente a la otra.", "una de ellas controla directa o indirectamente a la otra."),
        (48, "fracción VI", "Si ambas personas están controladas directa o indirectamente por una tercera persona.", "personas están controladas directa o indirectamente por una tercera persona."),
        (48, "fracción VII", "Si juntas controlan directa o indirectamente a una tercera persona.", "Si juntas controlan directa o indirectamente a una tercera persona."),
        (48, "fracción VIII", "Si son de la misma familia.", "Si son de la misma familia."),
    ],
    "69": [
        (48, "párrafo primero", "En una venta entre personas vinculadas, se examinarán las circunstancias de la", "transacción cuando la vinculación no haya influido en el precio."),
        (49, "párrafo segundo, encabezado", "Para los efectos de este artículo, se considerará que la vinculación no", "no ha influido en el precio, cuando se demuestre que:"),
        (49, "fracción I", "El precio se ajustó conforme a las prácticas normales de fijación de", "los precios de venta a compradores no vinculados con él."),
        (49, "fracción II", "Con el precio se alcanza a recuperar todos los costos y se", "las ventas de mercancías de la misma especie o clase."),
    ],
    "70": [
        (49, "encabezado", "En una venta entre personas vinculadas se aceptará el valor de transacción", "las mercancías y que ésta no influyó en su precio:"),
        (49, "fracción I", "El valor de transacción en las ventas de mercancías idénticas o similares", "el vendedor, para ser exportadas con destino a territorio nacional."),
        (49, "fracción II", "El valor en aduana de mercancías idénticas o similares, determinado en los", "determinado en los términos del artículo 74 de esta Ley."),
        (49, "fracción III", "El valor en aduana de mercancías idénticas o similares, determinado conforme a", "a lo dispuesto en el artículo 77 de esta Ley."),
        (49, "párrafo segundo", "En la aplicación de los criterios anteriores, deberán tenerse en cuenta las", "en las ventas a importadores con los que tiene vinculación."),
        (49, "párrafo final", "La Secretaría establecerá mediante reglas, los criterios conforme a los cuales se", "se determinará que un valor se aproxima mucho a otro."),
    ],
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, default=PDF)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    if hashlib.sha256(args.pdf.read_bytes()).hexdigest() != SHA:
        raise SystemExit("El PDF difiere de la edición cotejada.")
    raw = subprocess.check_output(["pdftotext", "-layout", str(args.pdf), "-"]).decode()
    sheets = raw.split("\f")
    # In this edition the running header ends with the house department and the
    # footer is the physical page number. Bound cross-page quotes to the body.
    def page_body(page):
        text = sheets[page - 1]
        header = "Secretaría de Servicios Parlamentarios"
        footer = f"{page} de 220"
        if text.count(header) != 1 or not text.rstrip().endswith(footer):
            raise ValueError(f"Revisar encabezado o pie de la página {page}")
        return text.split(header, 1)[1].rsplit(footer, 1)[0]

    # An article begins with its printed heading, not a lower-case cross-reference.
    heading = re.compile(r"^[ \t]*(?:ART[IÍ]CULO|Artículo) (\d+)(?:o(?=\.))?(?:\.?-([A-Z])| (bis|ter)(?: (\d+))?)?\.(?=-|\s|$)", re.M)
    index = {}
    for page, sheet in enumerate(sheets, 1):
        body = re.split(r"^[ \t]*Transitorios[ \t]*$", sheet, maxsplit=1, flags=re.M | re.I)
        for match in heading.finditer(body[0]):
            article = "-".join(part.upper() for part in match.groups() if part)
            if article in index:
                raise ValueError(f"Encabezado duplicado: {article}")
            index[article] = page
        if len(body) > 1:
            break
    if len(index) != 277 or any(str(i) not in index for i in range(1, 204)) or list(index)[-1] != "203":
        raise ValueError("Verificar manualmente el índice de la edición")
    index_path = OUTPUT.with_name("ley-aduanera-indice.json")
    serialized = json.dumps(index, ensure_ascii=False, indent=2) + "\n"
    if args.write:
        index_path.write_text(serialized, encoding="utf-8")
    elif index_path.read_text(encoding="utf-8") != serialized:
        raise SystemExit("El índice difiere de los encabezados impresos.")
    articles = {}
    for article, spans in SELECTION.items():
        articles[article] = []
        for pages, locator, start, stop in spans:
            pages = pages if isinstance(pages, tuple) else (pages,)
            page = pages[0]
            text = " ".join(" ".join(page_body(n) for n in pages).split())
            if text.count(start) != 1:
                raise SystemExit(f"Inicio ambiguo en la página {page}")
            first = text.index(start)
            end = text.index(stop, first) + len(stop)
            passage = text[first:end]
            if len(passage) > 850:
                raise SystemExit(f"Revisar límites en la página {page}")
            articles[article].append(dict(page=page, locator=locator, text=passage, **({"endPage": pages[-1]} if len(pages) > 1 else {})))
    result = json.dumps(articles, ensure_ascii=False, indent=2) + "\n"
    if args.write:
        OUTPUT.write_text(result, encoding="utf-8")
    elif OUTPUT.read_text(encoding="utf-8") != result:
        raise SystemExit("Los pasajes empaquetados difieren de la extracción.")
    print(f"{sum(map(len, articles.values()))} pasajes cotejados y {len(index)} encabezados localizados")


if __name__ == "__main__":
    main()
