"""Build reproducible page references and research-only cell candidates from a pinned LIGIE PDF."""
import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path
import re
import subprocess
import xml.etree.ElementTree as ET
import io

PDF_SHA = "955510d7ea82cf42d18c72e3146f999af254c0fda5eda3f12a1fd1c10e9864ce"
CODE = re.compile(r"(?<![\d.])([0-9]{4}\.[0-9]{2}\.[0-9]{2})(?!\d|\.\d)")


def checked_cells(words, independent, top, bottom, borders):
    def extract(source):
        result = []
        for left, right in zip(borders, borders[1:]):
            contained = [w for w in source if left < (w[0]+w[2])/2 < right and top < (w[1]+w[3])/2 < bottom]
            result.append(" ".join(w[4] for w in sorted(contained, key=lambda w: (round(w[1],0), w[0]))))
        return result
    primary = extract(words)
    return primary if primary == extract(independent) else None


def blank_edge_text(words, independent, drawings):
    # A continuation has an empty code, unit and both tax cells. Retain the
    # complete column geometry so unrelated tables on facing pages cannot join.
    rules=sorted({round(r.y0,1) for r in drawings if r.height<2 and r.width>15 and r.x0<96<r.x1 and 98<r.y0<735})
    found={}
    if len(rules)<2:
        return found
    for key,top,bottom in [("first",rules[0],rules[1]),("last",rules[-2],rules[-1])]:
        if key=="first" and top>125 or key=="last" and bottom<670:
            continue
        mid=(top+bottom)/2
        cols=sorted({round(r.x0,1) for r in drawings if r.width<2 and r.height>4 and r.y0<mid<r.y1})
        if len(cols) not in (6,7) or not cols[0]<96<cols[1]:
            continue
        cells=checked_cells(words,independent,top,bottom,cols)
        if cells and cells[-4] and sum(bool(c) for c in cells)==1:
            found[key]=(cols,cells[-4])
    return found


def joined_text(left,right):
    return bool(left and right and right[0].islower() and not left.endswith((".","!",":",";","?")))


def cell_candidate(words, independent, drawings, word):
    # Use horizontal rules crossing the middle of the code to delimit this row.
    x = (word[0] + word[2]) / 2
    y = (word[1] + word[3]) / 2
    rules = sorted({round(r.y0, 1) for r in drawings if r.height < 2 and r.width > 15 and r.x0 < x < r.x1})
    above = [v for v in rules if v < y]
    below = [v for v in rules if v > y]
    if not above or not below:
        return None
    top, bottom = above[-1], below[0]
    if bottom - top > 225:
        return None
    # Full vertical cell borders must cross the code. Fragments in a neighbouring cell
    # never qualify as a row even when they have the same eight-digit pattern.
    borders = sorted({round(r.x0, 1) for r in drawings if r.width < 2 and r.height > 4 and r.y0 < y < r.y1})
    if len(borders) not in (6, 7) or not borders[0] < x < borders[1]:
        return None
    cells = checked_cells(words, independent, top, bottom, borders)
    if not cells:
        return None
    if cells[0] != word[4] or len(cells)==6 and cells[1]:
        return None
    desc, unit, imp, exp = cells[-4:]
    if not desc or not unit or not imp or not exp:
        return None
    return {"description":desc,"unit":unit,"import":imp,"export":exp,"_cols":borders,
            "_first":top==rules[0] and top<125,"_last":bottom==rules[-1] and bottom>670}



def build(pdf, output, candidates=None):
    if hashlib.sha256(pdf.read_bytes()).hexdigest() != PDF_SHA:
        raise ValueError("La huella de la edición no coincide.")
    layout = subprocess.check_output(["pdftotext","-layout","-enc","UTF-8",str(pdf),"-"]).decode().split("\f")
    if len(layout)!=895 or layout[-1].strip():
        raise ValueError("La paginación difiere de la edición seleccionada.")
    locations = defaultdict(list)
    for page, text in enumerate(layout[:-1],1):
        for code in sorted(set(CODE.findall(text))):
            locations[code].append(page)
    data = {"sha256":PDF_SHA,"pages":894,"locations":dict(sorted(locations.items()))}
    output.write_text(json.dumps(data,ensure_ascii=False,separators=(",",":"))+"\n")
    if candidates:
        import pymupdf
        bbox=subprocess.check_output(["pdftotext","-bbox","-enc","UTF-8",str(pdf),"-"])
        pages=(el for _,el in ET.iterparse(io.BytesIO(bbox),events=("end",)) if el.tag.endswith("}page"))
        matched={}
        edges={}

        with pymupdf.open(pdf) as document, candidates.open("w") as report:
            for i, page in enumerate(document):
                alternate=next(pages)
                independent=[(*[float(w.attrib[k]) for k in ("xMin","yMin","xMax","yMax")],w.text or "")
                             for w in alternate if w.tag.endswith("}word")]
                alternate.clear()
                words=page.get_text("words")
                possible=[w for w in words if w[0]<135 and CODE.fullmatch(w[4])]
                rules=[d["rect"] for d in page.get_drawings() if d["type"]=="f"]
                edges[i+1]=blank_edge_text(words,independent,rules)
                for w in possible:
                    row=cell_candidate(words,independent,rules,w)
                    if row and i+1 in locations.get(w[4],[]):
                        key=w[4]+"@"+str(i+1)
                        # A page with duplicate matching rows requires direct review.
                        matched[key]=None if key in matched else row
            for key,row in sorted(matched.items()):
                if row:
                    code,page=key.split("@")
                    page=int(page)
                    cols=row.pop("_cols")
                    adjacent=[]
                    for is_edge,neighbor,end in [(row.pop("_first"),page-1,"last"),(row.pop("_last"),page+1,"first")]:
                        if not is_edge or neighbor not in edges:
                            continue
                        adjacent.append(neighbor)
                        other=edges[neighbor].get(end)
                        if not other or cols!=other[0]:
                            continue
                        left,right=(other[1],row["description"]) if neighbor<page else (row["description"],other[1])
                        if joined_text(left,right):
                            row["description"]=left+" "+right
                            row.setdefault("continued",[]).append(neighbor)
                    if adjacent:
                        row["adjacent"]=adjacent
                    report.write(json.dumps({"page":page,"code":code,**row},ensure_ascii=False)+"\n")
    print(len(locations),"fracciones mencionadas,",sum(map(len,locations.values())),"pares de fracción y página.")


if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf",type=Path)
    parser.add_argument("index",type=Path)
    parser.add_argument("--candidates",type=Path,help="Renglones con acuerdo entre Poppler y PyMuPDF")
    args=parser.parse_args()
    build(args.pdf,args.index,args.candidates)
