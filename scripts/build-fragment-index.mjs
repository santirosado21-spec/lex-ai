#!/usr/bin/env node
import {DatabaseSync} from 'node:sqlite';
import {writeFile} from 'node:fs/promises';
import {buildFragmentIndex, DEFAULT_INPUT, DEFAULT_INDEX} from '../server/retrieval/build.mjs';
import {classifyLaw} from '../server/retrieval/areas.mjs';

const args = process.argv.slice(2);
function option(name, fallback) {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Missing ${name}`);
  return args[i + 1];
}
try {
  if (args.includes('--help')) {
    console.log('node scripts/build-fragment-index.mjs [--input FILE] [--out FILE] [--write-area-map]\n--write-area-map regenerates resources/law-areas.json only; run build in a new process afterwards.');
  } else if (args.includes('--write-area-map')) {
    const db = new DatabaseSync(option('--input', DEFAULT_INPUT), {readOnly: true});
    let map;
    try {
      map = Object.fromEntries(db.prepare("SELECT law_id,json_extract(payload,'$.title') AS title FROM articles GROUP BY law_id ORDER BY law_id").all().map(row => [row.law_id, classifyLaw({lawId: row.law_id, title: row.title})]));
    } finally { db.close(); }
    await writeFile(new URL('../resources/law-areas.json', import.meta.url), JSON.stringify(map, null, 2) + '\n');
    console.log(JSON.stringify({laws: Object.keys(map).length, outputFile: 'resources/law-areas.json'}));
  } else {
    console.log(JSON.stringify(await buildFragmentIndex({inputFile: option('--input', DEFAULT_INPUT), outputFile: option('--out', DEFAULT_INDEX)}), null, 2));
  }
} catch (error) { console.error(JSON.stringify({state: 'failed', error: error.message})); process.exitCode = 1; }
