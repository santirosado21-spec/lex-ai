"""Local research intake for an SJF CSV and its PDF receipt in the downloaded ZIP."""
import argparse
import csv
import hashlib
import io
import json
import os
from pathlib import Path
import re
import sqlite3
import stat
import unicodedata
from zipfile import ZipFile

LIMIT = 48 * 1024 * 1024
SOURCE = "https://bicentenario.scjn.gob.mx/manual-usuario-descarga"
FIELDS = {
    "registro": ("registro digital", "registro"),
    "rubro": ("rubro", "rubro (titulo y subtitulo)"),
    "texto": ("texto",), "tipo": ("tipo", "tipo de tesis"),
}


def norm(value):
    text = unicodedata.normalize("NFKD", value.casefold().strip())
    return " ".join("".join(c for c in text if not unicodedata.combining(c)).split())


def digest(value):
    return hashlib.sha256(value).hexdigest()


def unpack(raw):
    with ZipFile(io.BytesIO(raw)) as archive:
        parts = [info for info in archive.infolist() if not info.is_dir()]
        if len(parts) != 2 or sum(p.file_size for p in parts) > LIMIT:
            raise ValueError("Se espera un CSV y un acuse PDF dentro del límite de 48 MiB.")
        by_ext = {Path(info.filename).suffix.lower(): info for info in parts}
        if set(by_ext) != {".csv", ".pdf"}:
            raise ValueError("Falta el CSV o el acuse PDF.")
        # Never extract paths or trust filenames from the archive.
        csv_bytes = archive.read(by_ext[".csv"])
        receipt = archive.read(by_ext[".pdf"])
        if not receipt.startswith(b"%PDF-"):
            raise ValueError("El acuse no se reconoce como PDF.")
        return csv_bytes, receipt


def records(csv_bytes):
    encoding = "utf-16" if csv_bytes.startswith((b"\xff\xfe", b"\xfe\xff")) else "utf-8-sig"
    text = csv_bytes.decode(encoding, errors="strict")
    csv.field_size_limit(LIMIT)
    # Inspect only the header. Embedded commas and newlines in a thesis belong to the CSV reader.
    header = text.splitlines()[0] if text else ""
    delimiter = csv.Sniffer().sniff(header, delimiters=",;\t").delimiter
    reader = csv.DictReader(io.StringIO(text, newline=""), delimiter=delimiter, strict=True)
    names = {norm(name): name for name in reader.fieldnames or []}
    if len(names) != len(reader.fieldnames or []) or "" in names:
        raise ValueError("Encabezados duplicados o vacíos.")
    columns = {}
    for key, aliases in FIELDS.items():
        matches = [names[name] for name in aliases if name in names]
        if len(matches) != 1:
            raise ValueError(f"Se requiere una columna inequívoca de {key}.")
        columns[key] = matches[0]
    rows = []
    seen = set()
    for row in reader:
        if len(rows) >= 100 or None in row or any(v is None or "\0" in v for v in row.values()):
            raise ValueError("Exportación irregular o superior a cien fichas.")
        data = {key: row[column].strip() for key, column in columns.items()}
        rid = data["registro"]
        if not re.fullmatch(r"[1-9][0-9]{4,7}", rid) or rid in seen:
            raise ValueError("Registro digital inválido o repetido dentro del archivo.")
        if not data["rubro"] or not data["texto"] or norm(data["tipo"]) not in {"jurisprudencia","aislada","tesis aislada"}:
            raise ValueError("Falta el texto, rubro o tipo documentado de la tesis.")
        seen.add(rid)
        source_row = json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        rows.append((rid, digest(source_row.encode()), data, source_row))
    if not rows:
        raise ValueError("El CSV no contiene tesis.")
    return rows


SCHEMA = """
CREATE TABLE IF NOT EXISTS sjf_export(
 sha TEXT PRIMARY KEY, csv_sha TEXT NOT NULL, receipt_sha TEXT NOT NULL, original_zip BLOB NOT NULL
);
CREATE TABLE IF NOT EXISTS sjf_thesis(
 id INTEGER PRIMARY KEY, registry TEXT NOT NULL, row_sha TEXT NOT NULL, rubric TEXT NOT NULL,
 kind TEXT NOT NULL, body TEXT NOT NULL, original_row TEXT NOT NULL, UNIQUE(registry,row_sha)
);
CREATE VIRTUAL TABLE IF NOT EXISTS sjf_search USING fts5(rubric,body,tokenize='unicode61 remove_diacritics 2');
CREATE TABLE IF NOT EXISTS sjf_export_row(
 export_sha TEXT NOT NULL REFERENCES sjf_export(sha), thesis_id INTEGER NOT NULL REFERENCES sjf_thesis(id),
 PRIMARY KEY(export_sha,thesis_id)
);
"""


def ingest(file, dbpath):
    with file.open("rb") as stream:
        raw = stream.read(LIMIT + 1)
    if len(raw) > LIMIT:
        raise ValueError("El ZIP supera 48 MiB.")
    payload, receipt = unpack(raw)
    rows = records(payload)
    sha = digest(raw)
    # The original receipt can contain details of the downloader. Keep the research store private.
    fd = os.open(dbpath, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or stat.S_IMODE(info.st_mode) & 0o077:
            raise ValueError("Usa un archivo de investigación privado con permisos 0600.")
    finally:
        os.close(fd)
    db = sqlite3.connect(dbpath)
    try:
        db.execute("PRAGMA foreign_keys=ON")
        db.executescript(SCHEMA)
        db.execute("BEGIN IMMEDIATE")
        if db.execute("SELECT 1 FROM sjf_export WHERE sha=?", (sha,)).fetchone():
            return {"archivo": sha, "registros": len(rows), "versiones_nuevas": 0}
        db.execute("INSERT INTO sjf_export VALUES(?,?,?,?)", (sha,digest(payload),digest(receipt),raw))
        added = 0
        for rid, row_sha, data, original in rows:
            previous = db.execute("SELECT id FROM sjf_thesis WHERE registry=? AND row_sha=?", (rid,row_sha)).fetchone()
            if previous:
                thesis_id = previous[0]
            else:
                cur = db.execute("INSERT INTO sjf_thesis(registry,row_sha,rubric,kind,body,original_row) VALUES(?,?,?,?,?,?)",
                                 (rid,row_sha,data["rubro"],data["tipo"],data["texto"],original))
                thesis_id = cur.lastrowid
                db.execute("INSERT INTO sjf_search(rowid,rubric,body) VALUES(?,?,?)", (thesis_id,data["rubro"],data["texto"]))
                added += 1
            db.execute("INSERT INTO sjf_export_row VALUES(?,?)", (sha,thesis_id))
        db.commit()
        return {"archivo":sha, "registros":len(rows), "versiones_nuevas":added}
    finally:
        db.close()


def search(dbpath, query):
    words = re.findall(r"[^\W_]+",query,flags=re.UNICODE)
    if not words or len(words)>12 or len(query)>200:
        raise ValueError("Introduce de una a doce palabras o un registro digital.")
    db = sqlite3.connect(dbpath.resolve().as_uri()+"?mode=ro",uri=True)
    try:
        if len(words)==1 and words[0].isascii() and words[0].isdigit():
            rows = db.execute("SELECT registry,kind,rubric,row_sha FROM sjf_thesis WHERE registry=? ORDER BY id LIMIT 50",(words[0],))
        else:
            expr=" AND ".join('"'+word+'"' for word in words)
            rows = db.execute("SELECT t.registry,t.kind,t.rubric,t.row_sha FROM sjf_search s JOIN sjf_thesis t ON t.id=s.rowid WHERE sjf_search MATCH ? ORDER BY rank,t.id LIMIT 50",(expr,))
        return [{"registro":rid,"tipo":kind,"rubro":rubric,"version":sha,"estado":"pendiente de cotejo",
                 "ficha":"https://sjf2.scjn.gob.mx/detalle/tesis/"+rid} for rid,kind,rubric,sha in rows]
    finally:
        db.close()


if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__,epilog="Formato documentado por la SCJN: "+SOURCE)
    parser.add_argument("--db",required=True,type=Path)
    group=parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--zip",type=Path)
    group.add_argument("--buscar")
    args=parser.parse_args()
    result=ingest(args.zip,args.db) if args.zip else search(args.db,args.buscar)
    print(json.dumps(result,ensure_ascii=False,indent=2))
