/** Rank fusion interface. Inputs are ordered best-first, already scope-filtered.
 * Vector hits may only rerank lexical IDs: they cannot introduce another scope.
 * No model or vector backend is loaded here. */
export function rankHybrid(lexical, optionalVector = []) {
  const vectorRanks = new Map();
  optionalVector.forEach((hit, i) => { if (!vectorRanks.has(hit.id)) vectorRanks.set(hit.id, i); });
  const seen = new Set();
  return lexical.filter(hit => {
    if (seen.has(hit.id)) return false;
    seen.add(hit.id); return true;
  }).map((hit, i) => ({...hit, score: 1 / (60 + i + 1) + (vectorRanks.has(hit.id) ? 1 / (60 + vectorRanks.get(hit.id) + 1) : 0)}))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
