#!/bin/bash
set -eu
umask 077
cd "$(dirname "$0")"
runtime="/Applications/LEX AI.app/Contents/Resources/app/runtime/node"
data="$HOME/Library/Application Support/mx.lexai.desktop"
if [[ ! -x "$runtime" ]]; then echo 'Instala LEX AI en Aplicaciones.'; exit 1; fi
if [[ ! -f "$data/office-addin/localhost.crt" ]]; then
  "$runtime" office-cert.mjs --data-dir "$data"
fi
for app in Word Excel; do
  case "$app" in Word) manifest=word-manifest.xml;; Excel) manifest=excel-manifest.xml;; esac
  dest="$HOME/Library/Containers/com.microsoft.$app/Data/Documents/wef"
  mkdir -p "$dest"
  if [[ -f "$dest/LEX-AI.xml" ]] && ! cmp -s "$manifest" "$dest/LEX-AI.xml"; then
    cp "$dest/LEX-AI.xml" "$data/office-addin/$app-previous-$(date +%s).xml"
  fi
  cp "$manifest" "$dest/LEX-AI.xml"
done
echo 'Paneles preparados. Revisa el certificado local antes de habilitarlo para esta cuenta de macOS.'
openssl x509 -in "$data/office-addin/localhost.crt" -noout -subject -fingerprint -sha256
echo 'Para habilitar HTTPS de localhost, ejecuta:'
printf 'security add-trusted-cert -r trustAsRoot -p ssl -s localhost -k "%s/Library/Keychains/login.keychain-db" "%s/office-addin/localhost.crt"\n' "$HOME" "$data"
