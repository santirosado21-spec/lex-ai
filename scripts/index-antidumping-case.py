"""Verify the six public SIDOF files for AD_29-24 and print their research manifest."""
import hashlib
import json
import re
import sys
from datetime import date, timedelta
from html.parser import HTMLParser
from pathlib import Path

class VisibleText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)

def capture(directory, name):
    raw = (directory / name).read_bytes()
    parser = VisibleText()
    parser.feed(raw.decode('utf-8'))
    text = ' '.join(' '.join(parser.parts).split())
    return text, {'archivo': name, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}

def verify(directory):
    stages = [
        ('inicio', '5750993', '2025-03-05', {183: 'inicio de la investigación', 191: 'día siguiente'}),
        ('preliminar', '5777408', '2025-12-29', {296: '1.55', 298: 'cuatro meses', 301: 'origen', 306: 'día siguiente'}),
        ('final', '5797943', '2026-09-04', {381: '1.58', 383: 'origen', 386: 'día siguiente'}),
    ]
    records = []
    base = 'https://sidof.segob.gob.mx/notas/'
    for stage, identifier, published, anchors in stages:
        body, original = capture(directory, identifier + '.html')
        info, metadata = capture(directory, identifier + '.ficha.html')
        day = date.fromisoformat(published)
        if 'Publicado el: ' + day.strftime('%d-%m-%Y') not in info:
            raise ValueError('Fecha no confirmada en la ficha ' + identifier)
        if 'AD_29-24' not in body or 'perfiles y barras de aluminio' not in body.lower():
            raise ValueError('Expediente o producto distinto en ' + identifier)
        for number, anchor in anchors.items():
            # The last occurrence avoids references to earlier numbered findings.
            start = list(re.finditer(r'(?<!\S)' + str(number) + r'\.\s+', body))
            if not start:
                raise ValueError(f'Falta el punto {number} de {identifier}')
            passage = re.split(r'(?<!\S)' + str(number + 1) + r'\.\s+', body[start[-1].end():], maxsplit=1)[0]
            if anchor not in passage:
                raise ValueError(f'Cambió el punto {number} de {identifier}')
        records.append({'etapa': stage, 'publicacion': published, 'entradaSegunTransitorio': (day+timedelta(days=1)).isoformat(),
                        'puntos': list(anchors), 'documento': {'url': base+'docFuente/'+identifier, **original},
                        'ficha': {'url': base+identifier, **metadata}})
    return {'expediente': 'AD_29-24', 'uso': 'investigación', 'actos': records}

if __name__ == '__main__':
    print(json.dumps(verify(Path(sys.argv[1])), ensure_ascii=False, indent=2))
