"""Extract appendix 9 from the three pinned SAT publications with physical PDF pages."""
from hashlib import sha256
from pathlib import Path
import json
import re
import subprocess

root = Path(__file__).resolve().parents[1]
trade = root / 'resources/trade'
inventory = json.loads((root / 'docs/research/sat-anexo22-2026-11-19.json').read_text())
sectors = {
    'Secretaría de Economía': 'SE', 'Secretaría de Agricultura y Desarrollo Rural': 'SADER',
    'Secretaría de Salud': 'SALUD', 'Secretaría de Medio Ambiente y Recursos Naturales': 'SEMARNAT',
    'Comisión Intersecretarial para el Control del Proceso y Uso de Plaguicidas, Fertilizantes y Sustancias Tóxicas': 'CICOPLAFEST',
    'Secretaría de la Defensa Nacional': 'SEDENA', 'Secretaría de Energía': 'SENER',
    'Instituto Nacional de Antropología e Historia': 'INAH', 'Instituto Nacional de Bellas Artes y Literatura': 'INBAL',
    'Consejo Nacional Mexicano del Café o los Consejos Estatales': 'CAFÉ',
    'Consejo Regulador del Tequila': 'CRT', 'Comisión Reguladora de Energía': 'CRE',
}


def rows_for(pdf):
    pages = subprocess.check_output(['pdftotext', '-layout', str(pdf), '-']).decode().split('\f')
    rows = []
    active = False
    agency = None
    for page, text in enumerate(pages, 1):
        lines = text.splitlines()
        for pos, line in enumerate(lines):
            stripped = line.strip()
            if stripped == 'Apéndice 9':
                active = True
                continue
            if active and re.fullmatch(r'Apéndice \d+', stripped):
                return rows
            if not active:
                continue
            if re.fullmatch(r'Clave\s+Descripción', stripped):
                previous = [line.strip() for line in lines[:pos] if line.strip()]
                agency = next((value for name, value in sectors.items() if ' '.join(previous[-2:]).endswith(name)), None)
                if agency is None:
                    raise ValueError(f'Autoridad pendiente en {pdf.name}, página {page}')
            key = re.match(r'^\s*([A-Z][A-Z0-9])\s{2,}(.+)$', line)
            if key:
                if not agency:
                    raise ValueError('Falta autoridad')
                description = [key[2].strip()]
                for more in lines[pos + 1:]:
                    if not re.match(r'^\s{6,}\S', more) or more.strip().startswith('…'):
                        break
                    description.append(more.strip())
                rows.append(dict(agency=agency, code=key[1], page=page, text=' '.join(description)))
    return rows


def main():
    editions = []
    for publication in (d for d in inventory['documentos'] if d['tipo'] == 'publicacion'):
        date = publication['fecha_en_portal']
        pdf = trade / f'anexo22-{date}.pdf'
        digest = sha256(pdf.read_bytes()).hexdigest()
        if digest != publication['sha256_pdf']:
            raise ValueError('La publicación ha cambiado')
        rows = rows_for(pdf)
        if not rows or len({(r['agency'], r['code']) for r in rows}) != len(rows):
            raise ValueError(f'Cobertura o duplicado por autoridad en {date}')
        editions.append(dict(date=date, sha256=digest, url=publication['url'], rows=rows))
    out = {'authorities': {v: k for k, v in sectors.items()}, 'editions': editions}
    (trade / 'anexo22-apendice9.json').write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    main()
