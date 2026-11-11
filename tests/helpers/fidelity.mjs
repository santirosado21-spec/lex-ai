import assert from 'node:assert/strict';
import { open } from 'node:fs/promises';

/** Required-fidelity mode: missing corpus/tokenizer prerequisites fail loudly
 *  instead of skipping. Enabled with LEX_REQUIRE_FIDELITY=1 (npm run test:fidelity). */
export const FIDELITY_REQUIRED = process.env.LEX_REQUIRE_FIDELITY === '1';

/** Returns the prerequisite label when the asset is genuinely ABSENT, null when
 *  present and openable. Only ENOENT counts as a missing prerequisite: any other
 *  error (EACCES, EISDIR, ...) is rethrown so a corrupt or inaccessible asset is
 *  never masked as a skippable missing prerequisite. Corrupt-but-openable bytes
 *  surface later as integrity failures on the real open path. */
export async function missingPrerequisite(filePath, label) {
  try {
    const handle = await open(filePath, 'r');
    await handle.close();
    return null;
  } catch (error) {
    if (error && error.code === 'ENOENT') return label;
    throw error;
  }
}

/** Conditional gate for tests needing a fidelity asset.
 *  Returns false when the test may run. When the prerequisite is missing:
 *  default mode skips with an explicit reason; required mode fails naming the
 *  prerequisite. `required` is injectable for gate self-tests. */
export function fidelityGate(t, prereq, reason, required = FIDELITY_REQUIRED) {
  if (!prereq) return false;
  if (required) assert.fail(`FIDELITY PREREQUISITE MISSING: ${prereq}`);
  t.skip(`${prereq}; ${reason}`);
  return true;
}
