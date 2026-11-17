#!/bin/sh
# v37: igual que v36b + fecha de ultima reforma declarada en cabecera acepta "Ultima Reforma POG" sin acento y fechas con mes en texto. Dirs NUEVOS zac-v37-*; nunca sobrescribe.
# Escribe en directorios NUEVOS zac-v37-<capa>-NN; nunca sobrescribe reportes ni directorios previos.
set -e
cd "$(dirname "$0")/.."
for n in ${BATCHES:-01 02 03 04 05 06 07 08 09 10 11 12 13 14 15}; do
  reg=resources/legal-acquisition-zac-oficial-$n-2026-11-17.json
  src=artifacts/public-corpus/zac-oficial-$n-2026-11-17
  for layer in pdfparse poppler; do
    out=artifacts/public-corpus/zac-v37-$layer-$n-2026-11-17
    [ -e "$out" ] && { echo "refuso sobrescribir $out"; exit 1; }
    cp -r "$src" "$out"
    r=resources/legal-acquisition-zac-v37-$layer-$n-2026-11-17.json
    python3 -c "
import json
d=json.load(open('$reg'));dates=json.load(open('docs/qa/zac-index-dates-2026-11-17.json'))['documents']
for x in d['documents']:
    x['declaredPublicationAt']=dates[x['id']]['officialDate']
    if '$layer'=='poppler': x['textLayer']='poppler'
json.dump(d,open('$r','w'),ensure_ascii=False,indent=1)"
    node scripts/legal-acquisition.mjs --offline --registry "$r" --out "$out" > "/tmp/zac-v37-$layer-$n.log" 2>&1 || true
    echo "$n $layer $(python3 -c "import json;d=json.load(open('$out/report.json'));print(d['state'],len(d['documents']),sum(1 for x in d['documents'] if x['state']=='quarantined'))")"
  done
done
