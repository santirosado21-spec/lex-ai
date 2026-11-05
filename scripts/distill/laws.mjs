// Which laws distillation examples may contain. Sealed evaluation laws (W1),
// their RAFT validation counterparts and every non-train split are excluded,
// even as distractors, so the dialogue and area evaluations stay held out.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// RAFT validation counterparts (docs/qa/raft-dataset-2026-11-03.md).
const RAFT_VALIDATION = ['MX-FED-LRART6_MDR', 'MX-FED-CFPC', 'MX-FED-LGDNNA', 'MX-FED-LNEP', 'MX-FED-LFTSE', 'MX-FED-LCM', 'MX-FED-LFDC', 'MX-FED-LRFIYII_ART105', 'MX-FED-LFPCA', 'MX-FED-LISSSTE'];

export async function lawPolicy(library) {
  const manifest = JSON.parse(await readFile(path.join(ROOT, 'eval/areas/manifest.json'), 'utf8'));
  const sealed = new Set((manifest.heldOutLaws || []).map(l => l.law_id));
  if (sealed.size < 10) throw Error('Lista de leyes selladas incompleta; no se generan datos.');
  const excluded = new Set([...sealed, ...RAFT_VALIDATION]);
  const laws = library.status().laws;
  for (const law of laws) if (law.split !== 'train') excluded.add(law.id);
  const allowed = laws.filter(l => !excluded.has(l.id));
  return { sealed, excluded, allowed, isAllowed: id => !excluded.has(id) };
}
