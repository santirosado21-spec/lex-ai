// Read-only: lists tracked source files plus the exact frozen public-library pair that prepare-desktop's sourceFiles inventory expects, with bytes and sha256.
// It downloads and installs nothing, never writes into the repo, and does NOT approve anything: the output is marked
// unreviewed and has an empty runtime `files` list on purpose. Approving node/ollama binaries is a human provenance
// decision (see docs/qa/desktop-runtime-inventory-criteria-2026-11-17.md).
// Usage: node scripts/runtime-source-inventory.mjs [out.json]   (stdout when no path is given)
import {FROZEN_LIBRARY_FILES,frozenLibraryInventory} from '../server/frozen-library-artifact.mjs';
import {spawnSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {sourceInventory, regularFile, fileDigest} from '../server/desktop-target.mjs';

export const REQUIRED_SOURCES = Object.freeze(['server/main.mjs', 'resources/model-catalog.json', 'office-addin/word.html', 'package.json', 'package-lock.json', ...FROZEN_LIBRARY_FILES]);

export async function buildSourceInventory({root = process.cwd(), run = spawnSync, verifyFrozenLibrary = frozenLibraryInventory} = {}) {
 const tracked = run('git', ['ls-files', '-z', '--', 'server', 'resources', 'office-addin'], {cwd:root, encoding:'utf8', timeout:5000, maxBuffer:16 * 1024 * 1024});
 if (tracked.status !== 0) throw new Error('git ls-files failed');
 const head = run('git', ['rev-parse', 'HEAD'], {cwd:root, encoding:'utf8', timeout:5000});
 await verifyFrozenLibrary(root);
 const paths = [...new Set([...sourceInventory(tracked.stdout.split('\0').filter(Boolean)), ...FROZEN_LIBRARY_FILES, 'package.json', 'package-lock.json'])].sort();
 const sourceFiles = [];
 for (const entry of paths) { const {bytes, sha256} = await fileDigest(await regularFile(root, entry)); sourceFiles.push({path:entry, bytes, sha256}); }
 const missing = REQUIRED_SOURCES.filter(required => !sourceFiles.some(file => file.path === required));
 if (missing.length) throw new Error(`missing required sources: ${missing.join(', ')}`);
 return {schemaVersion:1, reviewStatus:'generated-unreviewed-no-runtime-approved', gitHead:head.status === 0 ? head.stdout.trim() : null, files:[], sourceFiles};
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
 try {
  const inventory = await buildSourceInventory();
  const text = JSON.stringify(inventory, null, 1) + '\n';
  if (process.argv[2]) await writeFile(process.argv[2], text, {flag:'wx'}); else process.stdout.write(text);
 } catch(e) {console.error('No se generó inventario: '+e.message);process.exitCode=1;}
}
