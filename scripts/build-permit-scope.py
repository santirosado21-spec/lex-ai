"""Rebuild the fraction/NICO table from the official aluminium or sugar agreement saved from SIDOF."""
from hashlib import sha256
from html.parser import HTMLParser
from pathlib import Path
import json
import re
import sys


class Table(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tables = []
        self.cell = None
        self.spans = {}

    def handle_starttag(self, tag, attrs):
        if tag == 'table':
            self.tables.append([])
        elif tag == 'tr':
            self.tables[-1].append([])
        elif tag in ('td', 'th'):
            self.cell = []
            self.span = int(dict(attrs).get('rowspan', '1'))

    def handle_data(self, text):
        if self.cell is not None:
            self.cell.append(text)

    def handle_endtag(self, tag):
        if tag in ('td', 'th') and self.cell is not None:
            row = self.tables[-1][-1]
            value = ' '.join(''.join(self.cell).split())
            if self.span > 1:
                self.spans[(len(self.tables), len(self.tables[-1]), len(row))] = (self.span, value)
            row.append(value)
            self.cell = None


def extract(snapshot):
    parser = Table()
    parser.feed(snapshot.decode('utf-8'))
    [table] = [t for t in parser.tables if t and [v.replace(' ', '') for v in t[0]] == ['Fracciónarancelaria/NICO', 'Descripción', 'Acotación']]
    fractions = {}
    fraction = None
    table_no = parser.tables.index(table) + 1
    for (number, start, column), (span, value) in parser.spans.items():
        if number == table_no:
            if column != 2:
                raise ValueError('Acotación combinada en columna inesperada')
            for line in table[start:start + span - 1]:
                if len(line) != 2:
                    raise ValueError('Estructura de celdas combinadas inesperada')
                line.append(value)
    for code, text, scope in table[1:]:
        if re.fullmatch(r'\d{4}\.\d{2}\.\d{2}', code):
            if code in fractions:
                raise ValueError('Fracción duplicada')
            fraction = {'description': text, 'scope': scope, 'nicos': {}}
            fractions[code] = fraction
        elif re.fullmatch(r'\d{2}', code) and fraction and code not in fraction['nicos']:
            fraction['nicos'][code] = {'description': text, 'scope': scope}
        else:
            raise ValueError('Renglón inesperado: ' + code)
    if any(not f['nicos'] for f in fractions.values()):
        raise ValueError('Fracción sin NICO')
    return {'sourceSha256': sha256(snapshot).hexdigest(), 'fractions': fractions}


if __name__ == '__main__':
    print(json.dumps(extract(Path(sys.argv[1]).read_bytes()), ensure_ascii=False, indent=2))
