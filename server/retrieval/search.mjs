import {DatabaseSync} from 'node:sqlite';
import {AREAS, detectArea, fold} from './areas.mjs';
import {DEFAULT_INDEX, INDEX_APPLICATION_ID} from './build.mjs';
import {extractReference} from './references.mjs';
import {rankHybrid} from './rank.mjs';
import {verifyFragment} from './fragments.mjs';
import {expandQuery} from './thesaurus.mjs';

const STOP = new Set('a al algo ante aqui asi como con cual cuales cuando de del desde donde el ella ellos en era es esa ese eso esta este esto federal general ha hay la las le les ley lo los me mi mis muy no nos o para pero por porque puedo que quien se si sin sobre su sus te tengo tiene un una uno unos unas y ya articulo art consulta seguimiento fuera seria pasa caso'.split(' '));
export function lexicalTerms(query, {expand = true} = {}) {
  const q = fold(query);
  const tokens = (q.match(/[\p{L}\p{N}]+/gu) ?? []).filter(t => t.length > 1 && t.length <= 60 && !STOP.has(t));
  if (expand) tokens.push(...expandQuery(query).terms.flatMap(term => term.split(' ')).filter(t => t.length > 1 && !STOP.has(t)));
  return [...new Set(tokens)].slice(0, 48);
}

function articleOrder(a, b) {
  const number = s => Number(/^\d+/.exec(s)?.[0]);
  const suffix = s => fold(s).toUpperCase().replace(/^\d+-?/, '');
  const order = ['', 'BIS', 'TER', 'QUATER', 'QUINQUIES'];
  const x = suffix(a), y = suffix(b), headX = x.split('-')[0], headY = y.split('-')[0];
  return number(a) - number(b)
    || (order.includes(headX) && order.includes(headY) ? order.indexOf(headX) - order.indexOf(headY) : 0)
    || x.localeCompare(y, 'es', {numeric: true});
}

/** Explicit reader lifetime; no global connection and no writes during search. */
export function openFragmentIndex(file = DEFAULT_INDEX) {
  const db = new DatabaseSync(file, {readOnly: true});
  try {
    db.exec('PRAGMA query_only=ON; PRAGMA trusted_schema=OFF; PRAGMA cache_size=-8192;');
    if (db.prepare('PRAGMA application_id').get().application_id !== INDEX_APPLICATION_ID || db.prepare('PRAGMA user_version').get().user_version !== 1) throw new Error('Unsupported fragment index');
    const metadata = JSON.parse(db.prepare("SELECT value FROM metadata WHERE key='index'").get()?.value ?? 'null');
    if (metadata?.kind !== 'public-legal-fragments' || metadata.privateDocumentsIncluded !== false) throw new Error('Invalid fragment metadata');
    function searchFragments({query, areas, jurisdiction, limit = 10, contextReference = null} = {}) {
      if (typeof query !== 'string' || !query.trim() || query.length > 8000) throw new Error('Invalid query');
      if (typeof jurisdiction !== 'string' || !/^MX-[A-Z]{2,3}$/.test(jurisdiction)) throw new Error('Explicit jurisdiction required');
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('Invalid result limit');
      const inferred = detectArea(query);
      const filterAreas = areas ?? (inferred[0] === 'otros' ? [] : inferred);
      if (!Array.isArray(filterAreas) || filterAreas.length > AREAS.length || filterAreas.some(a => !AREAS.includes(a))) throw new Error('Invalid areas');
      const reference = extractReference(query);
      // Multiple explicit laws/articles require independent, scoped requests.
      if (reference.ambiguous || reference.lawId && !reference.lawId.startsWith(jurisdiction + '-')) return [];
      let article = reference.article;
      if (reference.navigation && article) {
        if (!reference.lawId) return [];
        const identifiers = db.prepare('SELECT DISTINCT article FROM articles WHERE jurisdiction=? AND law_id=?').all(jurisdiction, reference.lawId).map(r => r.article).sort(articleOrder);
        const i = identifiers.findIndex(id => fold(id).toUpperCase() === article);
        article = i < 0 ? null : identifiers[i + (reference.navigation === 'next' ? 1 : -1)];
        if (!article) return [];
      }
      const filters = ['a.jurisdiction=?'], params = [jurisdiction];
      if (reference.lawId) { filters.push('a.law_id=?'); params.push(reference.lawId); }
      if (article) { filters.push("replace(a.article,'Á','A')=?"); params.push(fold(article).toUpperCase()); }
      if (filterAreas.length) {
        filters.push(`EXISTS(SELECT 1 FROM law_areas la WHERE la.law_id=a.law_id AND la.area IN (${filterAreas.map(() => '?').join(',')}))`);
        params.push(...filterAreas);
      }
      // Prefer the latest stored version without asserting currentness. Never
      // combine two historical versions of the same article in one result set.
      filters.push('a.is_latest=1');
      const fraction = /\bfraccion\s+([ivxlcdm]+)\b/.exec(fold(query))?.[1]?.toUpperCase();
      const inciso = /\binciso\s+([a-zñ])\b/.exec(fold(query))?.[1];
      if (fraction) { filters.push("rtrim(json_extract(f.payload,'$.fraction'),'.)–-')=?"); params.push(fraction); }
      if (inciso) { filters.push("rtrim(json_extract(f.payload,'$.inciso'),')')=?"); params.push(inciso); }
      const exact = Boolean(article && reference.lawId);
      const terms = lexicalTerms(query);
      const expansion = expandQuery(query, {jurisdiction, areas: filterAreas});
      if (!exact && contextReference?.lawId?.startsWith(jurisdiction + '-') && typeof contextReference.article === 'string') {
        expansion.concepts.push({id:'thread:context', terms:[], anchors:[{lawId:contextReference.lawId, article:contextReference.article}]});
      }
      if (!exact && !terms.length) return [];
      const select = 'SELECT f.text,f.payload AS fragment,a.payload AS source,a.text AS article_text';
      let rows;
      // Even within an exact article, rank the matching fraction before the
      // lead paragraph. Plain article requests fall back to source order.
      const contentQuery = query.replace(/\bMX-[A-Z]{2,3}-[A-Z0-9_-]+\b/gi, '').replace(/\b(?:art[íi]culo|art\.?)\s+\d+(?:[-\s]+(?:BIS|TER|QUATER|[A-Z]))?/gi, '').replace(/\bfracci[óo]n\s+[IVXLCDM]+\b/gi, '').replace(/\binciso\s+[a-zñ]\)?/gi, '');
      const meaningful = exact ? lexicalTerms(contentQuery).filter(t => !['siguiente', 'anterior', 'posterior', 'previo', 'explica', 'explicame', 'dice', 'establece'].includes(t)) : terms;
      if (meaningful.length) {
        const match = meaningful.map(t => `"${t}"`).join(' OR ');
        // Materialize FTS scores once. CROSS JOIN fixes the join order so SQLite
        // cannot rerun the text match for each scoped article/fragment. Scope
        // predicates still apply BEFORE LIMIT; no global candidate truncation.
        rows = db.prepare(`WITH matched AS MATERIALIZED (
          SELECT rowid,rank AS lexicalScore FROM fragments_fts WHERE fragments_fts MATCH ?
        ), selected AS MATERIALIZED (
          SELECT f.rowid,matched.lexicalScore FROM matched
          CROSS JOIN fragments f ON f.rowid=matched.rowid CROSS JOIN articles a ON a.id=f.article_source_id
          WHERE ${filters.join(' AND ')} ORDER BY matched.lexicalScore,a.id,f.ordinal LIMIT ?
        ) ${select},selected.lexicalScore FROM selected JOIN fragments f ON f.rowid=selected.rowid JOIN articles a ON a.id=f.article_source_id ORDER BY selected.lexicalScore,a.id,f.ordinal`).all(match, ...params, exact ? limit : Math.max(60, limit * 6));
      }
      if (!exact && expansion.concepts.length) {
        const anchors = [...new Map(expansion.concepts.flatMap(c => c.anchors).map(a => [a.lawId + ':' + a.article, a])).values()];
        if (anchors.length) {
          const anchorFilter = anchors.map(() => '(a.law_id=? AND a.article=?)').join(' OR ');
          const anchored = db.prepare(`${select},0 AS lexicalScore FROM fragments f JOIN articles a ON a.id=f.article_source_id WHERE ${filters.join(' AND ')} AND (${anchorFilter}) ORDER BY a.id,f.ordinal`).all(...params, ...anchors.flatMap(a => [a.lawId, a.article]));
          rows = [...new Map([...(rows ?? []), ...anchored].map(row => [JSON.parse(row.fragment).id, row])).values()];
        }
        const original = lexicalTerms(query, {expand: false});
        const generic = new Set(['amparo:objeto', 'seguridad-social:alta', 'fiscal:revision', 'civil:acuerdo', 'mercantil:comercio']);
        const score = row => {
          const source = JSON.parse(row.source), text = fold(row.text);
          const words = new Set(text.match(/[\p{L}\p{N}]+/gu));
          const overlap = original.reduce((n, term) => n + (words.has(term) ? 1 : 0), 0);
          let authority = 0, semantic = 0;
          for (const concept of expansion.concepts) {
            const boost = generic.has(concept.id) && expansion.concepts.length > 1 ? 1 : 5;
            if (concept.anchors.some(a => a.lawId === source.lawId && a.article === source.article)) authority = Math.max(authority, boost);
            semantic += Math.min(2, concept.terms.filter(term => text.includes(term)).length) * .5;
          }
          return authority + Math.min(4, overlap) + Math.min(3, semantic) + Math.min(1, -row.lexicalScore / 20);
        };
        rows = rows.map(row => ({...row, retrievalScore: score(row)})).sort((a,b) => b.retrievalScore - a.retrievalScore || a.lexicalScore - b.lexicalScore || JSON.parse(a.fragment).start - JSON.parse(b.fragment).start);
      }
      if (exact && !rows?.length) {
        rows = db.prepare(`${select},0 AS lexicalScore FROM fragments f JOIN articles a ON a.id=f.article_source_id WHERE ${filters.join(' AND ')} ORDER BY a.id,f.ordinal LIMIT ?`).all(...params, limit);
      }
      // One passage per article prevents long enumerations occupying all top-3
      // slots. Explicit article/fraction requests retain their original contract.
      if (!exact) {
        const seen = new Set();
        rows = (rows ?? []).filter(row => { const id = JSON.parse(row.source).id; if (seen.has(id)) return false; seen.add(id); return true; });
      }
      return rankHybrid((rows ?? []).slice(0, limit).map(row => {
        const source = JSON.parse(row.source), fragment = {...JSON.parse(row.fragment), text: row.text};
        if (!verifyFragment(fragment, {...source, text: row.article_text})) throw new Error('Fragment provenance mismatch');
        const areas = db.prepare('SELECT area FROM law_areas WHERE law_id=? ORDER BY area').all(source.lawId).map(r => r.area);
        return {...source, ...fragment, sourceId: fragment.id, law: source.lawId, areas,
          excerpt: fragment.text, articleTextSha256: fragment.articleSha256,
          sourceIndexSha256: metadata.sourceIndexSha256, lexicalScore: row.lexicalScore,
          currentness: 'unverified', legalAccuracy: 'not-evaluated'};
      })).slice(0, limit);
    }
    return {searchFragments, status: () => structuredClone(metadata), close: () => db.close()};
  } catch (error) { db.close(); throw error; }
}

/** Convenience facade. For repeated calls use openFragmentIndex once. */
export function searchFragments({indexPath = DEFAULT_INDEX, ...request} = {}) {
  const index = openFragmentIndex(indexPath);
  try { return index.searchFragments(request); } finally { index.close(); }
}
