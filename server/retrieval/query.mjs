import {LAW_AREAS, detectArea, fold} from './areas.mjs';
export {detectArea} from './areas.mjs';
export {rankHybrid} from './rank.mjs';
export {searchFragments, openFragmentIndex} from './search.mjs';

import {TITLES, extractReference, stripLawTitles} from './references.mjs';
export {extractReference} from './references.mjs';

function turnText(turn) {
  if (typeof turn === 'string') return turn.slice(0, 4000);
  if (!turn || ['system', 'tool', 'developer'].includes(turn.role)) return '';
  return String(turn.question ?? turn.user ?? (turn.role === 'user' ? turn.content : '') ?? '').slice(0, 4000);
}
function turnReference(turn) {
  const fromQuestion = extractReference(turnText(turn));
  if (fromQuestion.lawId && fromQuestion.article || fromQuestion.ambiguous) return fromQuestion;
  // Citation metadata is preferred over the prose of an assistant response.
  const citations = turn?.citations ?? [];
  const refs = citations.filter(c => c && typeof c.lawId === 'string' && (c.article || c.articleId));
  const unique = new Map(refs.map(c => [`${c.lawId}:${c.article ?? c.articleId}`, c]));
  if (unique.size > 1) return {...fromQuestion, ambiguous: true};
  if (unique.size === 1) { const c = [...unique.values()][0]; return {lawId: c.lawId, article: String(c.article ?? c.articleId), ambiguous: false}; }
  if (turn?.role === 'assistant') return extractReference(String(turn.content ?? '').slice(0, 4000));
  return fromQuestion;
}

/** Pure, deterministic rewriting. Caller supplies only same-firm/matter/thread
 * turns, oldest first. Output is a retrieval request, never legal evidence. */
export function rewriteQuery({question, recentTurns = [], matterJurisdiction = null} = {}) {
  if (typeof question !== 'string' || !question.trim() || question.length > 4000) throw new Error('Invalid question');
  if (!Array.isArray(recentTurns)) throw new Error('Invalid recent turns');
  if (matterJurisdiction !== null && !/^MX-[A-Z]{2,3}$/.test(matterJurisdiction)) throw new Error('Invalid jurisdiction');
  let query = question.trim();
  const q = fold(query).replace(/^[¿¡\s]+/, '');
  const current = extractReference(query);
  const isFollowUp = text => /^(?:y\b|tambien\b|entonces\b|eso\b|ese\b|esa\b|esto\b|aquello\b|el siguiente\b|el anterior\b|sobre lo anterior\b|respecto de lo anterior\b|amplia\b|explica(?:me)? mas\b|continua\b|en ese caso\b|hazlo\b|haz\b|resumelo\b|mas breve\b|mas cort[oa]\b|mas simple\b|mas sencillo\b|en pocas palabras\b|en (?:una|dos|tres) (?:lineas?|oraciones?|frases?)\b|explicalo\b|dimelo\b|(?:dame|ponme|con) un ejemplo\b|simplifica\b|por que\b|cuanto tiempo\b|que plazo\b|como (?:lo|la)\b)/.test(fold(text).replace(/^[¿¡\s]+/, ''));
  const followUp = isFollowUp(q) && !(current.lawId && current.article)
    && (!/^(?:cuanto tiempo|que plazo|como (?:lo|la))\b/.test(q) || detectArea(question)[0] === 'otros');
  const navigation = current.navigation && (/\barticulo\b/.test(q) || /^(?:y\s+)?(?:el\s+)?(?:siguiente|anterior|posterior|previo)[?\s.]*$/.test(q));
  let reference = current, reason = 'standalone', needsClarification = current.ambiguous, contextReference = null;
  const recent = recentTurns.slice(-6).filter(turn => !['system', 'tool', 'developer'].includes(turn?.role) && (turnText(turn) || turn?.role === 'assistant' || turn?.citations?.length));
  if (navigation || current.article && !current.lawId) {
    // Keep the request type even when its anchor is absent or ambiguous, so a
    // caller without the derived index cannot substitute a preceding article.
    reason = navigation ? 'article-navigation' : 'inherited-law';
    const candidates = [...recent].reverse().map(turnReference);
    const antecedent = candidates.find(ref => ref.ambiguous || ref.lawId || ref.article);
    if (!current.ambiguous && (current.lawId && current.article || antecedent && !antecedent.ambiguous && (!current.lawId || current.lawId === antecedent.lawId))) {
      reference = {...current, lawId: current.lawId ?? antecedent?.lawId, article: current.article ?? antecedent?.article};
      if (reference.lawId && reference.article) {
        query = navigation
          ? `Artículo ${current.navigation === 'next' ? 'siguiente' : 'anterior'} al artículo ${reference.article} de ${reference.lawId}.`
          : `${query} de ${reference.lawId}`;
      } else needsClarification = true;
    } else needsClarification = true;
  } else if (followUp) {
    const userTurns = recent.map(turnText).filter(Boolean);
    const prior = userTurns.at(-1);
    if (prior) {
      // Strip the old exact authority when a hypothetical changes the topic.
      // Reusing its article would suppress retrieval of the new legal issue.
      const hypothetical = /^y\s+si\b/.test(q);
      let context = prior;
      // Carry the last substantive user turn through chains of short anaphora.
      // Assistant prose never supplies facts or instructions for the rewrite.
      if (isFollowUp(prior)) {
        const anchor = [...userTurns].reverse().find(text => !isFollowUp(text));
        if (anchor) context = `${anchor.slice(0, 1000)} ${prior.slice(0, 600)}`;
      }
      if (hypothetical) {
        const antecedent = [...recent].reverse().map(turnReference).find(ref => ref.ambiguous || ref.lawId && ref.article);
        const own = detectArea(question).filter(a => a !== 'otros');
        if (antecedent && !antecedent.ambiguous && (!own.length || own.some(a => LAW_AREAS[antecedent.lawId]?.includes(a)))) contextReference = antecedent;
        context = stripLawTitles(context).replace(/\b(?:articulo|art\.?)\s+\d+(?:[-\s]+(?:bis|ter|quater))?/gi, '').replace(/\bMX-[A-Z]{2,3}-[A-Z0-9_-]+\b/gi, '');
        for (const title of Object.keys(TITLES)) context = context.replaceAll(title, '');
        for (const id of Object.keys(LAW_AREAS)) if (/^[A-Z]/.test(id.slice(7))) context = context.replace(new RegExp(`\\b${id.slice(7)}\\b`, 'gi'), '');
      }
      query = `Consulta: ${context.slice(0, 1600)}\nSeguimiento: ${question.trim()}`;
      reason = hypothetical ? 'hypothetical-follow-up' : 'context-follow-up';
    } else needsClarification = true;
  }
  const jurisdiction = matterJurisdiction ?? reference.lawId?.match(/^(MX-[A-Z]{2,3})-/)?.[1] ?? null;
  if (reference.lawId && jurisdiction && !reference.lawId.startsWith(jurisdiction + '-')) needsClarification = true;
  if (!jurisdiction) needsClarification = true;
  const ownAreas = detectArea(question);
  const detected = ownAreas[0] === 'otros' ? detectArea(query) : ownAreas;
  const queryLaw = extractReference(query).lawId;
  if (contextReference && !contextReference.lawId.startsWith(jurisdiction + '-')) contextReference = null;
  const areas = [...new Set([...(LAW_AREAS[queryLaw ?? contextReference?.lawId] ?? []), ...detected.filter(a => a !== 'otros')])];
  return {query, areas, jurisdiction, needsClarification, reason, contextReference, reference: reference.lawId && reference.article ? reference : null};
}
