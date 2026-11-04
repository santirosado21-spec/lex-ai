import {createHash} from 'node:crypto';

export const FRAGMENT_VERSION = 1;
export const sha256 = value => createHash('sha256').update(value).digest('hex');

/** Exact slices of stored article text. Offsets are JS UTF-16, end-exclusive. */
export function splitArticle(article, {maxChars = 1200} = {}) {
  if (!article || typeof article.text !== 'string' || !article.text.trim()) throw new Error('Article text required');
  if (!Number.isInteger(maxChars) || maxChars < 100 || maxChars > 12000) throw new Error('Invalid fragment size');
  const {text} = article;
  const articleSha256 = sha256(text);
  if (article.textSha256 && article.textSha256 !== articleSha256) throw new Error('Article hash mismatch');
  const lawId = article.lawId ?? article.law_id;
  const articleId = article.article ?? article.articleId;
  if (typeof lawId !== 'string' || typeof articleId !== 'string') throw new Error('Article identity required');
  const boundaries = new Map([[0, {kind: 'paragraph', marker: null}]]);
  // Markers also survive normalized single-line extraction. Do not match bare
  // Roman numerals in references ("fracciones I y II"), or abbreviations ("S.A.").
  const markers = /(?:^|\s)((?:[IVXLCDM]+[.)](?:\s*[-–])?|[a-zñ]\)))(?=\s)/g;
  for (const match of text.matchAll(markers)) {
    const start = match.index + match[0].indexOf(match[1]);
    boundaries.set(start, {kind: /^[a-zñ]/.test(match[1]) ? 'inciso' : 'fraction', marker: match[1].replace(/\s+/g, '')});
  }
  for (const match of text.matchAll(/\r?\n[ \t\r\n]*/g)) {
    const start = match.index + match[0].length;
    if (start < text.length && !boundaries.has(start)) boundaries.set(start, {kind: 'paragraph', marker: null});
  }
  const starts = [...boundaries.keys()].sort((a, b) => a - b);
  const fragments = [];
  let fraction = null, inciso = null;
  for (let i = 0; i < starts.length; i++) {
    let start = starts[i];
    const end = starts[i + 1] ?? text.length;
    const boundary = boundaries.get(start);
    if (boundary.kind === 'fraction') { fraction = boundary.marker; inciso = null; }
    if (boundary.kind === 'inciso') inciso = boundary.marker;
    let part = 0;
    while (start < end) {
      while (start < end && /\s/u.test(text[start])) start++;
      if (start === end) break;
      let stop = Math.min(end, start + maxChars);
      const approximate = stop < end || part > 0;
      if (stop < end) {
        const window = text.slice(start, stop);
        const sentenceEnds = [...window.matchAll(/[.!?](?=\s+[A-ZÁÉÍÓÚÑ¿¡])/g)];
        const sentence = sentenceEnds.at(-1);
        const whitespace = window.search(/\s+\S*$/u);
        if (sentence && sentence.index > maxChars / 3) stop = start + sentence.index + 1;
        else if (whitespace > 0) stop = start + whitespace;
        // Never split a UTF-16 surrogate pair in the rare unbroken-token case.
        if (/[\uD800-\uDBFF]/.test(text[stop - 1])) stop--;
      }
      let trimmedEnd = stop;
      while (trimmedEnd > start && /\s/u.test(text[trimmedEnd - 1])) trimmedEnd--;
      const fragmentText = text.slice(start, trimmedEnd);
      const articleSourceId = article.id ?? `${lawId}:${articleId}:${articleSha256}`;
      fragments.push({
        id: 'FRAG-' + sha256(`${FRAGMENT_VERSION}:${articleSourceId}:${articleSha256}:${start}:${trimmedEnd}`),
        articleSourceId, lawId, article: articleId, jurisdiction: article.jurisdiction,
        ordinal: fragments.length, start, end: trimmedEnd, offsetUnit: 'utf16-code-unit',
        articleSha256, textSha256: sha256(fragmentText), text: fragmentText,
        kind: boundary.kind, marker: boundary.marker, fraction, inciso,
        segmentation: approximate ? 'approximate-size-boundary' : boundary.marker ? 'enumeration-marker' : 'stored-text-boundary',
      });
      part++; start = stop;
    }
  }
  return fragments;
}

export function verifyFragment(fragment, article) {
  if (!fragment || !article || typeof article.text !== 'string') return false;
  return fragment.lawId === (article.lawId ?? article.law_id)
    && fragment.article === (article.article ?? article.articleId)
    && fragment.jurisdiction === article.jurisdiction
    && (!article.id || fragment.articleSourceId === article.id)
    && fragment.offsetUnit === 'utf16-code-unit'
    && Number.isInteger(fragment.start) && Number.isInteger(fragment.end)
    && fragment.start >= 0 && fragment.end > fragment.start && fragment.end <= article.text.length
    && fragment.articleSha256 === sha256(article.text)
    && fragment.text === article.text.slice(fragment.start, fragment.end)
    && fragment.textSha256 === sha256(fragment.text);
}
