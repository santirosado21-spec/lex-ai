import vocabulary from '../../resources/legal-thesaurus.json' with {type: 'json'};

const fold = value => String(value).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const concepts = vocabulary.entries.map(entry => ({...entry, pattern: new RegExp(`\\b(?:${entry.trigger})\\b`, 'u')}));

/** Expansion is metadata, never an authority or an instruction to the agent. */
export function expandQuery(query, {jurisdiction, areas} = {}) {
  const text = fold(query).slice(0, 8000);
  const matches = concepts.filter(entry => entry.pattern.test(text)
    && (!areas?.length || areas.includes(entry.area)));
  return {
    areas: [...new Set(matches.map(entry => entry.area))],
    terms: [...new Set(matches.flatMap(entry => entry.terms).map(fold))],
    concepts: matches.map(entry => ({id: entry.id, area: entry.area, terms: entry.terms.map(fold),
      // Never turn a federal vocabulary association into a state authority.
      anchors: entry.provenance.filter(source => source.jurisdiction === jurisdiction)})),
  };
}
