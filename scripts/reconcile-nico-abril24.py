#!/usr/bin/env python3
"""Reconcile resources/trade/nico-abril24.jsonl (SNICE informative edition) against the
official 22-ago-2022 acuerdo plus its two published reforms (30-jun-2023, 22-mar-2024).
Compares (fraccion, NICO) pairs only, not descriptions or annotations. Needs pdftotext."""
import re,json,subprocess,sys
T='resources/trade/'
def txt(n): return subprocess.run(['pdftotext','-layout',T+n,'-'],capture_output=True,text=True,check=True).stdout
pair=re.compile(r'^\s*(\d{4}\.\d{2}\.\d{2})\s+(\d{2})(?:\s{2,}(.*))?$')
def rows(t): return [(m.group(1),m.group(2),(m.group(3) or '').strip()) for l in t.splitlines() if (m:=pair.match(l))]
res={(c,n) for c,n,_ in rows(txt('nico-22ago22.pdf'))}; base=len(res); log=[]
for f in ('nico-mod01_30jun23.pdf','nico-mod02_22mar24.pdf'):
    t=txt(f);k=t.find('Artículo Segundo')
    cre=rows(t[:k]);sup=[r for r in rows(t[k:]) if r[2].startswith('SUPRIMIDO')]
    assert all(r not in res for r in [(c,n) for c,n,_ in cre]) and all((c,n) in res for c,n,_ in sup)
    res|={(c,n) for c,n,_ in cre};res-={(c,n) for c,n,_ in sup};log.append((f,len(cre),len(sup)))
ab={(r[0],r[1]) for r in map(json.loads,open(T+'nico-abril24.jsonl'))}
print(json.dumps({'base':base,'mods':log,'computed':len(res),'abril24':len(ab),'solo_abril24':sorted(ab-res),'solo_calculado':sorted(res-ab)}))
