import {openFragmentIndex, lexicalTerms} from './search.mjs';
import {rewriteQuery} from './query.mjs';
import {splitArticle, verifyFragment} from './fragments.mjs';
import {expandQuery} from './thesaurus.mjs';
import {fold} from './areas.mjs';
import {TITLES, stripLawTitles} from './references.mjs';

/** Same public source IDs as the service's citation resolver. Never opens a
 * private store, builds an index, downloads a model, or broadens jurisdiction. */
export function retrievePublic({question, recentTurns, jurisdiction, library, fallback = []}) {
  const request = rewriteQuery({question, recentTurns, matterJurisdiction: jurisdiction});
  // The legacy search can repeat the anchor; it cannot establish its neighbor.
  // Only the matching derived index may answer an article-navigation request.
  const safeFallback = request.reason === 'article-navigation' ? [] : fallback;
  if (typeof library?.status !== 'function' || jurisdiction !== 'MX-FED') return safeFallback;
  if (request.needsClarification) return [];
  let index;
  try { index = openFragmentIndex(); }
  catch (error) {
    // An optional derived index may be absent in packaged installations. Any
    // corruption/incompatible schema must surface instead of hiding a failure.
    if (error.code === 'ERR_SQLITE_ERROR' && /unable to open database file/.test(error.message)) return safeFallback;
    throw error;
  }
  try {
    if (index.status().sourceIndexSha256 !== library.status().indexSha256) return safeFallback;
    const hits = index.searchFragments({...request, limit: 6});
    const seen = new Set();
    return hits.filter(hit => {
      if (seen.has(hit.articleSourceId)) return false;
      seen.add(hit.articleSourceId); return true;
    }).map(hit => {
      const source = library.getSource(hit.articleSourceId);
      if (!source || source.jurisdiction !== jurisdiction || source.textSha256 !== hit.articleSha256) throw Error('Public fragment/source mismatch');
      const preferredPassage = choosePassage(source, request.query, hit);
      return {...source, preferredPassage};
    });
  } finally { index.close(); }
}

export function choosePassage(source, query, hit) {
  let content = stripLawTitles(query).replace(/\bmx-[a-z]{2,3}-[a-z0-9_-]+\b/g, '').replace(/\b(?:articulo|art)\.?\s+\d+(?:[-\s]+(?:bis|ter|quater))?/g, '');
  for (const title of Object.keys(TITLES)) content = content.replaceAll(title, '');
  content = content.replace(/\b(?:explica\w*|dice|establece|resume\w*|contenido|dispon\w*|lft|ccf|cnpp|cpf|cff|cpeum|lamp|lfpa|lss|lgsm|lgtoc|ccom)\b/g, '');
  const words = lexicalTerms(content, {expand:false}).filter(t => !/^\d+$/.test(t));
  const expansion = expandQuery(content, {jurisdiction:source.jurisdiction});
  let candidates = splitArticle(source, {maxChars:600}).filter(f => f.text.length >= 40);
  // Respect an explicitly requested fraction/inciso and the successor chosen by
  // the index, even if another paragraph has more keyword matches.
  if (/\b(?:fraccion|inciso)\b/.test(content) && hit) candidates = candidates.filter(f => f.start < hit.end && f.end > hit.start);
  const score = f => {
    const text = fold(f.text), tokens = new Set(text.match(/[\p{L}\p{N}]+/gu));
    return words.reduce((n,w) => n + (tokens.has(w) ? 2 : 0), 0)
      + expansion.terms.reduce((n,t) => n + (text.includes(t) ? .5 : 0), 0);
  };
  const fragment = candidates.sort((a,b) => score(b)-score(a) || a.start-b.start)[0];
  if (fragment && !verifyFragment(fragment, source)) throw Error('Selected passage provenance mismatch');
  return fragment;
}
