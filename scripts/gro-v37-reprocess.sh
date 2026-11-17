#!/bin/sh
# v37: reprocesa OFFLINE los lotes Guerrero a dirs NUEVOS gro-v37-<capa>-NN (capa pdfparse|poppler); nunca sobrescribe.
set -e
cd "$(dirname "$0")/.."
for n in ${BATCHES:-01 02 03 04 05 06 07 08 09 10 11 12 13 14}; do
 for layer in ${LAYERS:-pdfparse poppler}; do
  src=artifacts/public-corpus/gro-oficial-$n-2026-11-17;out=artifacts/public-corpus/gro-v37-$layer-$n-2026-11-17;reg=resources/legal-acquisition-gro-v37-$layer-$n-2026-11-17.json
  [ -e "$out" ] && { echo "refuso sobrescribir $out"; exit 1; }
  cp -r "$src" "$out"
  python3 -c "
import json
d=json.load(open('resources/legal-acquisition-gro-oficial-$n-2026-11-17.json'))
if '$layer'=='poppler':
    for x in d['documents']: x['textLayer']='poppler'
json.dump(d,open('$reg','w'),ensure_ascii=False,indent=1)"
  node scripts/legal-acquisition.mjs --offline --registry "$reg" --out "$out" > "/tmp/gro-v37-$layer-$n.log" 2>&1 || true
  echo "$n $layer $(python3 -c "import json;d=json.load(open('$out/report.json'));print(d['state'],len(d['documents']),sum(1 for x in d['documents'] if x['state']=='quarantined'))")"
 done
done
