#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
package_version=$(node -p "JSON.parse(require('fs').readFileSync('package.json','utf8')).version")
if [[ ! "$package_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo 'Invalid package version' >&2
  exit 1
fi
mkdir -p artifacts
dmg_path="artifacts/LEX-AI-${package_version}-arm64.dmg"
if [[ -e "$dmg_path" || -e "$dmg_path.sha256" ]]; then
  dmg_path="artifacts/LEX-AI-${package_version}-arm64-$(date -u +%Y%m%dT%H%M%SZ)-$$.dmg"
fi
if [[ -e "$dmg_path" || -e "$dmg_path.sha256" ]]; then
  echo 'Refusing to overwrite an existing package' >&2
  exit 1
fi
bash scripts/sign-local.sh
app_path='src-tauri/target/release/bundle/macos/LEX AI.app'
stage_path=$(mktemp -d /private/tmp/lex-dmg-stage.XXXXXX)
trap 'rm -rf "$stage_path"' EXIT
ditto "$app_path" "$stage_path/LEX AI.app"
ln -s /Applications "$stage_path/Applications"
codesign --verify --deep --strict "$stage_path/LEX AI.app"
hdiutil create -format UDZO -volname 'LEX AI' -srcfolder "$stage_path" "$dmg_path"
hdiutil verify "$dmg_path"
shasum -a 256 "$dmg_path" > "$dmg_path.sha256"
printf 'Package: %s\n' "$dmg_path"
