"""Build the research inventory from a saved SAT RGCE 2026 catalogue page."""
import argparse
from datetime import date
from hashlib import sha256
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import urljoin, urlsplit

CATALOG = 'https://www.sat.gob.mx/minisitio/NormatividadRMFyRGCE/normatividad_rmf_rgce2026.html'
BASE = '/minisitio/NormatividadRMFyRGCE/documentos2026/rgce/'
FOLDERS = {'anexos': 'publicacion', 'anticipadas': 'anticipada', 'compiladas': 'compilacion'}
MONTHS = 'enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre'.split()


class Catalogue(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows = {}
        self.item = None
        self.anchor = None

    def handle_starttag(self, tag, attrs):
        if tag == 'li':
            self.item = {'text': [], 'links': []}
        if tag == 'a' and self.item is not None:
            self.anchor = {'href': dict(attrs).get('href', ''), 'label': []}

    def handle_data(self, text):
        if self.item is not None:
            self.item['text'].append(text)
        if self.anchor is not None:
            self.anchor['label'].append(text)

    def handle_endtag(self, tag):
        if tag == 'a' and self.anchor is not None:
            if self.item is not None:
                self.item['links'].append(self.anchor)
            self.anchor = None
        if tag == 'li' and self.item is not None:
            for link in self.item['links']:
                self.record(link, ''.join(self.item['text']))
            self.item = None

    def record(self, link, text):
        label = ' '.join(''.join(link['label']).split())
        if not re.search(r'\banexo\s+22\b', label, re.I):
            return
        url = urljoin(CATALOG, link['href'])
        target = urlsplit(url)
        if (target.scheme, target.netloc) != ('https', 'www.sat.gob.mx') or not target.path.startswith(BASE):
            return
        path = target.path[len(BASE):].split('/')
        if len(path) != 2 or path[0] not in FOLDERS or not path[1].lower().endswith('.pdf'):
            return
        dates = re.findall(r'publicad[ao] el (\d{1,2}) de (\w+) de (\d{4})', text, re.I)
        if len(dates) != 1:
            raise ValueError(f'Fecha del portal ambigua para {label}')
        day, month, year = dates[0]
        listed = date(int(year), MONTHS.index(month.lower()) + 1, int(day))
        entry = dict(tipo=FOLDERS[path[0]], titulo=label, fecha_en_portal=listed.isoformat(), url=url)
        if url in self.rows and self.rows[url] != entry:
            raise ValueError(f'Entradas contradictorias para {url}')
        self.rows[url] = entry


def index(snapshot):
    parser = Catalogue()
    parser.feed(snapshot.decode('utf-8-sig'))
    parser.close()
    if not parser.rows:
        raise ValueError('No se encontraron renglones del Anexo 22 de las RGCE')
    return dict(catalogo=CATALOG, sha256_catalogo=sha256(snapshot).hexdigest(),
                alcance='Inventario del portal. La fecha de entrada en vigor requiere cotejo con el DOF.',
                documentos=sorted(parser.rows.values(), key=lambda d: (d['fecha_en_portal'], d['tipo'], d['url'])))


if __name__ == '__main__':
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument('html', type=Path)
    args.add_argument('--pdf-dir', type=Path, help='PDF oficiales capturados por fecha, AAAA-MM-DD.pdf')
    options = args.parse_args()
    result = index(options.html.read_bytes())
    if options.pdf_dir:
        for entry in result['documentos']:
            if entry['tipo'] != 'publicacion':
                continue
            pdf = options.pdf_dir / (entry['fecha_en_portal'] + '.pdf')
            data = pdf.read_bytes()
            if not data.startswith(b'%PDF-'):
                raise ValueError(f'Archivo PDF inválido en {pdf}')
            info = subprocess.check_output(['pdfinfo', str(pdf)], text=True)
            pages = re.search(r'^Pages:\s+(\d+)', info, re.M)
            if not pages:
                raise ValueError(f'Falta el número de páginas de {pdf}')
            entry.update(sha256_pdf=sha256(data).hexdigest(), bytes=len(data), paginas=int(pages[1]))
    print(json.dumps(result, ensure_ascii=False, indent=2))
