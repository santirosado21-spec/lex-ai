import {getPinnedPublicSource} from '../public-library.mjs';
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

// In a local installation the optional fragment index may be absent. Resolve
// editorial vocabulary against the exact public snapshot it was built from.
export function verifiedConceptSources(library,query,{jurisdiction,areas,lawId}){
 if(library?.status?.().indexSha256!==vocabulary.source.sha256)return [];
 const sources=new Map();
 for(const concept of expandQuery(query,{jurisdiction,areas}).concepts){
  for(const anchor of concept.anchors){
   if(sources.has(anchor.sourceId)||(lawId&&anchor.lawId!==lawId))continue;
   const row=getPinnedPublicSource(library,vocabulary.source.sha256,anchor.sourceId);
   if(row&&row.lawId===anchor.lawId&&row.article===anchor.article&&row.jurisdiction===jurisdiction&&
      row.textSha256===anchor.textSha256&&row.pdfSha256===anchor.pdfSha256)sources.set(row.sourceId,row);
  }
 }
 return [...sources.values()];
}
