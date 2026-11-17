import assert from 'node:assert/strict';

// Only native span scores may vary across floating-point implementations.
// Coordinates, decisions, provenance and every other field remain byte-exact.
export function assertNativeScoreParity(actual, expected) {
  const normalized = structuredClone(actual);
  for (const key of ['nativeSpans', 'validatedPrefix']) {
    assert.equal(actual[key].length, expected[key].length, key);
    for (let i = 0; i < actual[key].length; i++) {
      const a = actual[key][i].score, b = expected[key][i].score;
      assert.ok(Number.isFinite(a) && Number.isFinite(b), `${key}[${i}] finite score`);
      assert.ok(a >= .4 && a <= 1 && b >= .4 && b <= 1, `${key}[${i}] score domain`);
      assert.ok(Math.abs(a - b) < 1e-12, `${key}[${i}] score tolerance`);
      normalized[key][i].score = b;
    }
  }
  assert.deepEqual(normalized, expected);
}
