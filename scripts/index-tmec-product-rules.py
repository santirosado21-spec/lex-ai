"""Index printed tariff headings in Section B, retaining the original PDF page."""
import hashlib
import json
import re
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1] / "resources/trade"
source = root / "tmec-dof-20200629.pdf"
if hashlib.sha256(source.read_bytes()).hexdigest() != "ecea17b0e46a8f37f1391dae908548461ddcd0c8b385fcf19615576277622bbd":
    raise ValueError("Se requiere cotejo de la nueva edición del DOF.")
pages = subprocess.check_output(["pdftotext", "-layout", str(source), "-"]).decode().split("\f")
raw = subprocess.check_output(["pdftotext", "-raw", str(source), "-"]).decode().split("\f")
code = r"(?:\d{2}\.\d{2}|\d{4}\.\d{2}(?:\. *[a-z]{2})?)"
heading = re.compile(rf"^ {{0,8}}({code}(?: *[-–] *{code})?)(\d{{1,2}})?(?= {{2,}}| *$)")
chapters, entries = [], []
section = None
for page in range(86, 188):
    lines = pages[page-1].splitlines()[1:]
    for i, line in enumerate(lines):
        if "Sección C: Fracciones Arancelarias Revisadas" in line:
            break
        if re.match(r"^\s*Sección\s+[IVX]+\b", line, re.I):
            section = page
        chapter = re.match(r"^\s*Capítulo\s+(\d{1,2})\s{2,}(.+)", line)
        if chapter:
            title = chapter[2].strip()
            for continuation in lines[i+1:]:
                if not re.match(r"^[A-Za-zÁÉÍÓÚÑáéíóúñ]", continuation) or re.match(r"(?:Nota|Capítulo|Sección|Regla)\b", continuation):
                    break
                title += " " + continuation.strip()
            chapters.append(dict(number=int(chapter[1]), title=title, page=page, sectionPage=section))
        entry = heading.match(line)
        if not entry or not chapters:
            continue
        label = re.sub(r"\s*[-–]\s*", "-", entry[1]).replace(" ", "")
        if int(label[:2]) != chapters[-1]["number"]:
            continue
        item = dict(label=label, chapter=chapters[-1]["number"], page=page)
        raw_note = re.search(r"^" + re.escape(label) + r"(\d{1,2})(?=\s|$)", raw[page-1], re.M)
        if entry[2] or raw_note:
            item["footnote"] = int(entry[2] or raw_note[1])
        # Only accept a complete single sentence with a visible end boundary
        # on this same page. Complex alternatives and footnotes remain in the PDF.
        before = line[entry.end():].strip()
        if "footnote" not in item and before.startswith("Un cambio "):
            fragments = [before]
            for continuation in lines[i+1:]:
                if not continuation.strip():
                    continue
                if heading.match(continuation) or re.match(r"^\s*(Capítulo|Sección)\s", continuation):
                    quote = " ".join(" ".join(fragments).split())
                    if quote.endswith(".") and ";" not in quote and len(quote) <= 700 and not re.search(r"\. [A-ZÁÉÍÓÚÑ]|\bNota\b|\(\w\)", quote):
                        joined = re.sub(r"\s+", "", label + quote)
                        if joined in re.sub(r"\s+", "", raw[page-1]):
                            item["quote"] = quote
                    break
                if not re.match(r"^ {12,}\S", continuation):
                    break
                fragments.append(continuation.strip())
        duplicate = next((e for e in entries[-3:] if (e["label"],e["page"]) == (label,page)), None)
        if duplicate is None:
            entries.append(item)
        else:
            duplicate.pop("quote", None)
            if "footnote" in item:
                duplicate["footnote"] = item["footnote"]

if [c["number"] for c in chapters] != [n for n in range(1,98) if n != 77]:
    raise ValueError("El índice de capítulos difiere de la edición cotejada.")

# Keep complete short notes which precede the tariff table. Long blocks retain
# their printed location. Page headers are absent from this line sequence.
section_prefix, chapter_prefix = [], []
active = None
for page in range(86, 188):
    for line in pages[page-1].splitlines()[1:]:
        if "Sección C: Fracciones Arancelarias Revisadas" in line:
            break
        if re.match(r"^\s*Sección\s+[IVX]+\b", line, re.I):
            section_prefix, active = [], "section"
        elif (m := re.match(r"^\s*Capítulo\s+(\d{1,2})\s{2,}", line)):
            chapter_prefix, active = [], "chapter"
            current = chapters[int(m[1])-1 if int(m[1]) < 77 else int(m[1])-2]
            if section_prefix:
                current["sectionNotes"] = " ".join(section_prefix)
        elif active == "chapter" and (m := heading.match(line)) and int(m[1][:2]) == current["number"]:
            if chapter_prefix:
                current["chapterNotes"] = " ".join(chapter_prefix)
            active = None
        elif active in ("section", "chapter") and line.strip():
            target = section_prefix if active == "section" else chapter_prefix
            if target or re.match(r"^\s*(?:Nota|Regla)(?:s)?\b", line, re.I):
                target.append(" ".join(line.split()))
for c in chapters:
    for key in ("sectionNotes", "chapterNotes"):
        if len(c.get(key, "")) > 1250:
            c.pop(key)
            c[key+"InPdf"] = True

def span(page, start, stop):
    body = pages[page-1]
    return " ".join(body[body.index(start):body.index(stop, body.index(start))].split())

# Preserve both rows of the six-digit subheading. Section C is a four-country
# table; extract the Mexican column and the wrapped description by position.
table = pages[186]
line = next(line for line in table.splitlines() if "1806.10.aa" in line)
col = line.index("Con un contenido")
second = table.splitlines()[table.splitlines().index(line)+1]
assert line.split()[:4] == ["1806.10.aa","1806.10.10","1806.10.43","1806.10.01"]
cocoa = dict(rules=span(90, "1806.10\n", "1806.20 "),
             priority=span(86, "(c)    la regla aplicable", "(d)"),
             weight=span(86, "(e)    cualquier referencia", "(f)"),
             exceptionLead=next(l.strip() for l in pages[84].splitlines() if l.startswith("Cada Parte dispondrá")),
             exception=span(85, "(g)   un material", "(h)"),
             mexicanCode=line.split()[3], description=" ".join((line[col:]+" "+second[col:]).split()))
# A six-digit heading next to a more specific treaty fraction needs the
# correspondence table. Only the jointly checked cocoa dossier covers that case.
specifics = {e["label"].split(".")[0] + "." + e["label"].split(".")[1] for e in entries if re.search(r"\.[a-z]{2}",e["label"])}
for e in entries:
    if e["label"] in specifics or re.search(r"\.[a-z]{2}",e["label"]):
        e.pop("quote", None)
target = root / "tmec-4b-directorio.json"
target.write_text(json.dumps(dict(chapters=chapters, entries=entries, cocoa=cocoa, nonOriginating=span(86,"(d)    el requerimiento","(e)")), ensure_ascii=False, separators=(",",":"))+"\n")
print(f"{len(chapters)} capítulos y {len(entries)} referencias impresas")
