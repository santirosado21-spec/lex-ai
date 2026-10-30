#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
app_path='src-tauri/target/release/bundle/macos/LEX AI.app'
# Only Finder metadata inside our generated bundle; do not remove quarantine or change OS policy.
xattr -dr com.apple.FinderInfo "$app_path"
xattr -dr com.apple.ResourceFork "$app_path"
codesign --force --sign - "$app_path"
codesign --verify --deep --strict "$app_path"
