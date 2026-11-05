#!/usr/bin/env node
/**
 * Build the MLX LoRA dataset from accepted distillation examples.
 *   node scripts/distill/build-dataset.mjs --in artifacts/distill/examples-v1-s0.jsonl,... --out artifacts/distill/dataset-v1
 * Writes train.jsonl / valid.jsonl as {"messages":[...]} (the exact production
 * prompt plus the teacher's answer) and manifest.json with counts and hashes.
 * Validation holds whole seed conversations, so turns of one seed never span
 * both splits. Re-checks the sealed-law policy and the held-out dialogue cases.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leaksHeldOut } from './seeds.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SEALED = ['MX-FED-CPEUM', 'MX-FED-CCF', 'MX-FED-CNPCF', 'MX-FED-CNPP', 'MX-FED-LFT', 'MX-FED-CCOM', 'MX-FED-CFF', 'MX-FED-LAMP', 'MX-FED-LFPA', 'MX-FED-LSS'];
const sha = s => createHash('sha256').update(s).digest('hex');
const pick = (id, seed) => parseInt(sha(`valid:${seed}:${id}`).slice(0, 8), 16) / 0xffffffff;

export function buildDataset(examples, { heldOut = [], validShare = 0.05, seed = 'distill-v1' } = {}) {
  const seen = new Set(), rows = [], dropped = {};
  const drop = r => { dropped[r] = (dropped[r] || 0) + 1; };
  for (const e of examples) {
    if (!Array.isArray(e.messages) || typeof e.output !== 'string' || !e.output.trim()) { drop('malformed'); continue; }
    if ((e.lawIds || []).some(id => SEALED.includes(id))) { drop('sealed-law'); continue; }
    const userTurns = e.messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
    if (leaksHeldOut(userTurns.slice(0, 4000), heldOut)) { drop('held-out-similar'); continue; }
    const key = sha(JSON.stringify(e.messages) + '\u0000' + e.output);
    if (seen.has(key)) { drop('duplicate'); continue; }
    seen.add(key);
    rows.push({ seed: e.seed, category: e.category, kind: e.kind, messages: [...e.messages, { role: 'assistant', content: e.output }] });
  }
  const train = [], valid = [];
  for (const r of rows) (pick(r.seed, seed) < validShare ? valid : train).push({ messages: r.messages, _meta: { seed: r.seed, category: r.category, kind: r.kind } });
  const count = list => list.reduce((acc, r) => { const k = `${r._meta.category}/${r._meta.kind}`; acc[k] = (acc[k] || 0) + 1; return acc; }, {});
  return { train, valid, dropped, summary: { train: train.length, valid: valid.length, byCategory: { train: count(train), valid: count(valid) } } };
}

async function main() {
  const { values } = parseArgs({ options: { in: { type: 'string' }, out: { type: 'string' } } });
  const files = values.in.split(',').map(f => path.resolve(f));
  const examples = (await Promise.all(files.map(f => readFile(f, 'utf8')))).flatMap(t => t.trim().split('\n').filter(Boolean).map(l => JSON.parse(l)));
  const heldOut = (await readFile(path.join(ROOT, 'eval/dialogue/cases.jsonl'), 'utf8')).trim().split('\n').map(l => JSON.parse(l).turns.join(' '));
  const ds = buildDataset(examples, { heldOut });
  const out = path.resolve(values.out);
  await mkdir(out, { recursive: true });
  const write = async (name, list) => { const text = list.map(r => JSON.stringify({ messages: r.messages })).join('\n') + '\n'; await writeFile(path.join(out, name), text); return sha(text); };
  const manifest = {
    createdAt: new Date().toISOString(), synthetic: true, sources: 'public official legislation (train split, sealed W1 laws excluded) and synthetic conversations',
    teacher: [...new Set(examples.map(e => e.teacher))], inputs: files.map(f => path.relative(ROOT, f)),
    heldOut: { dialogueCases: 'eval/dialogue/cases.jsonl', sealedLaws: SEALED }, ...ds.summary, dropped: ds.dropped,
    sha256: { train: await write('train.jsonl', ds.train), valid: await write('valid.jsonl', ds.valid) },
    status: 'DATA_BUILT_NOT_TRAINED',
  };
  await writeFile(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify(manifest, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e.message); process.exitCode = 1; });
