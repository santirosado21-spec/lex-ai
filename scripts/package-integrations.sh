#!/bin/bash
set -eu
cd "$(dirname "$0")/.."
sp=sharepoint-addin/lex-ai-sharepoint
(cd "$sp" && npm ci --no-fund --no-audit && npm run build)
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
cp integrations/* scripts/office-cert.mjs office-addin/*-manifest.xml "$sp/sharepoint/solution/lex-ai-sharepoint.sppkg" "$stage/"
mkdir -p artifacts
package_version=$(node -p "require('./package.json').version")
ditto -c -k "$stage" "artifacts/LEX-AI-complementos-${package_version}.zip"
