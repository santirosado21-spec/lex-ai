#!/bin/sh
# Reprocesa offline los snapshots de Zacatecas con el extractor v36 en directorios NUEVOS (los originales no se tocan).
# Capa A: pdf-parse (v36). Capa B: Poppler (registry con textLayer=poppler). Ambas quedan en cuarentena.
set -e
cd "$(dirname "$0")/.."
for n in 01 02 03 04 05 06 07 08 09 10 11 12 13 14 15; do
  reg=resources/legal-acquisition-zac-oficial-$n-2026-11-17.json
  src=artifacts/public-corpus/zac-oficial-$n-2026-11-17
  for layer in pdfparse poppler; do
    out=artifacts/public-corpus/zac-v36-$layer-$n-2026-11-17
    rm -rf "$out"; cp -r "$src" "$out"
    r=$reg
    if [ "$layer" = poppler ]; then
      r=/tmp/zac-reg-poppler-$n.json
      python3 -c "import json,sys;d=json.load(open('$reg'));[x.__setitem__('textLayer','poppler') for x in d['documents']];json.dump(d,open('$r','w'),ensure_ascii=False,indent=1)"
    fi
    node scripts/legal-acquisition.mjs --offline --registry "$r" --out "$out" > "/tmp/zac-v36-$layer-$n.log" 2>&1 || true
    echo "$n $layer $(python3 -c "import json;d=json.load(open('$out/report.json'));print(d['state'],len(d['documents']),sum(1 for x in d['documents'] if x['state']=='quarantined'))")"
  done
done
