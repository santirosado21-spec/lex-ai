"""Extract verified excerpts from the three AD_29-24 editions using Poppler."""
import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
import unicodedata

STAGES = [
    ('inicio', 'Inicio', [(81, 183, 'Apertura de la investigación', 'o por cualquier otra.'), (81, 191, 'Entrada en vigor', 'publicación en el DOF.')]),
    ('preliminar', 'Preliminar', [(265, 296, 'Cuota provisional', 'o por cualquier otra.'), (265, 298, 'Duración de la provisional', 'la presente Resolución.'), (265, 301, 'Prueba de otro origen', 'distinto a China.'), (265, 306, 'Entrada en vigor', 'publicación en el DOF.')]),
    ('final', 'Final', [(78, 3, 'Producto investigado', 'es perfiles y barras de aluminio.'), (103, 156, 'Características de los perfiles excluidos', 'a lo ancho.'), (136, 381, 'Cuota definitiva', 'o por cualquier otra.'), (136, 383, 'Prueba de otro origen', 'distinto a China.'), (136, 386, 'Entrada en vigor', 'publicación en el DOF.')])
]
class Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)

def normalize(text):
    return ''.join(c for c in unicodedata.normalize('NFKC', text).casefold() if c.isalnum())

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def extract(directory, html_dir, out):
    manifest = json.loads(Path('docs/research/defensa-comercial-AD_29-24.json').read_text())
    stages = []
    out.mkdir(parents=True, exist_ok=True)
    for index, (code, title, points) in enumerate(STAGES):
        act = manifest['actos'][index]
        raw = directory / f'edicion-{index}.pdf'
        doc = html_dir / act['documento']['archivo']
        if digest(doc) != act['documento']['sha256']:
            raise ValueError('Cambió el HTML de referencia')
        parser = Text()
        parser.feed(doc.read_text())
        html = normalize(' '.join(parser.parts))
        info = (html_dir / act['ficha']['archivo']).read_text()
        relative = re.search(r'href="(/notas/getNewsletter/[^"]+)"', info)[1]
        pages = subprocess.check_output(['pdftotext', '-layout', str(raw), '-']).decode().split('\f')
        stage = {'id': code, 'title': title, 'published': act['publicacion'], 'effective': act['entradaSegunTransitorio'],
                 'url': act['documento']['url'], 'editionUrl': 'https://sidof.segob.gob.mx'+relative,
                 'editionSha256': digest(raw), 'pages': {}, 'points': []}
        for page, point, label, until in points:
            matches = list(re.finditer(r'^\s*'+str(point)+r'\.\s+', pages[page-1], re.MULTILINE))
            if len(matches) != 1:
                raise ValueError(f'Punto ambiguo {point}')
            paragraph = ' '.join(pages[page-1][matches[0].end():].split())
            end = paragraph.index(until)+len(until)
            text = paragraph[:end]
            if normalize(str(point)+'. '+text) not in html:
                raise ValueError(f'El PDF y el HTML discrepan en {code} {point}')
            if page not in stage['pages']:
                name = f'ad29-{code}-{page}.pdf'
                target = out / name
                if not target.exists():
                    subprocess.run(['pdfseparate', '-f', str(page), '-l', str(page), str(raw), str(out/f'ad29-{code}-%d.pdf')], check=True)
                rendered = subprocess.check_output(['pdftotext', '-layout', str(target), '-']).decode()
                if normalize(rendered) != normalize(pages[page-1]):
                    raise ValueError(f'La página distribuida cambió: {name}')
                stage['pages'][page] = {'file': name, 'sha256': digest(target)}
            stage['points'].append({'point': point, 'label': label, 'page': page, 'text': text})
        stages.append(stage)
    (out/'ad29-pasajes.json').write_text(json.dumps(stages, ensure_ascii=False, indent=2)+'\n')

if __name__ == '__main__':
    cli = argparse.ArgumentParser(description=__doc__)
    for name in ['editions', 'html', 'out']:
        cli.add_argument(name, type=Path)
    args = cli.parse_args()
    extract(args.editions, args.html, args.out)
