#!/bin/sh
# Developer command. The existing factory enforces destination, byte and time budgets.
set -eu
cd "$(dirname "$0")/.."
mode=${1:---plan}
case "$mode" in
  --plan|--live|--offline) ;;
  *) echo 'Uso: sh scripts/acquire-trade-pilot.sh [--plan|--live|--offline]' >&2; exit 2 ;;
esac
capture() {
  node scripts/legal-acquisition.mjs "$mode" --documents "$1" \
    --registry "resources/legal-acquisition-fed-$2.json" \
    --out "artifacts/public-corpus/comercio-20261119/$1"
}
capture lce expansion-14-2026-11-12
capture reg-lce reglamentos-02-2026-11-13
capture ladua expansion-2-2026-11-11
capture reg-ladua reglamentos-01-2026-11-13
capture ligie-2022 expansion-34-2026-11-12
