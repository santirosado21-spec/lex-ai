#!/usr/bin/env python3
"""Cotejo de huecos Guerrero contra el PDF (solo lectura): por documento con huecos en el manifiesto v37, clasifica cada hueco como
'ausente-en-pdf' (no hay encabezado Articulo N al inicio de linea en pdftotext) o 'en-pdf-no-extraido' (si lo hay). No clasifica el motivo juridico del salto."""
import json,glob,re,subprocess,unicodedata as u
def fold(s):return ''.join(c for c in u.normalize('NFKD',s) if not u.combining(c))
m=json.load(open('docs/qa/gro-corte-v37-manifest-2026-11-17.json'))
out=[]
for d in m['documents_list']:
    if not d['huecos']:continue
    pdf=glob.glob(f"artifacts/public-corpus/gro-oficial-{d['batch']}-2026-11-17/acquisitions/snapshots/{d['documentId']}/*.pdf")[0]
    t=fold(subprocess.run(['pdftotext',pdf,'-'],capture_output=True,text=True).stdout)
    inpdf={int(x) for x in re.findall(r'(?im)^[ \t]*art[ií]culo[\s\.]*(\d{1,4})\b',t)}
    anywhere=lambda n:bool(re.search(r'(?i)art[ií]culo[\s\.]*%d\b'%n,t))
    en=[g for g in d['huecos'] if g in inpdf]; ab=[g for g in d['huecos'] if g not in inpdf]
    out.append({'id':d['documentId'],'huecos':len(d['huecos']),'enPdfNoExtraido':en[:15],'ausentesEnPdf':len(ab),'ausentesPeroMencionadosEnTexto':[g for g in ab if anywhere(g)][:10]})
print(json.dumps(out))
