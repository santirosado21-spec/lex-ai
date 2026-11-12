// PROPUESTA F2 (2026-11-12) — implementación de referencia autocontenida para la política
// de división de artículos sobredimensionados. NO adoptada: no es código de producto, no
// modifica corpus ni contratos vigentes. Verifica con fixtures sintéticos: provenance,
// referencia exacta, recomposición sin pérdidas y consultas sin truncamiento silencioso.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ARTICLE_ID_PATTERN, articleCanonical} from '../server/article-id.mjs';

const sha = s => createHash('sha256').update(s).digest('hex');
const MAX = 60000; // cota vigente de publicSource/validateArticle

// Referencia: divide en el límite de párrafo más cercano sin exceder MAX; nunca parte párrafo.
function splitOversizedArticle(parent, opts = {}) {
  // opts.existingIds: Set de articleId ya presentes en la ley; una colisión PART-NNNN
  // con un artículo real existente es fail-closed (jamás sobrescribe ni se funde con él).
  // opts.pageOffsets: [{page, start, end}] offsets de carácter por página del texto unido
  // (los persiste el extractor v25+; el corpus v24 NO los conserva — verificado 2026-11-12:
  // ni records ni versions/ guardan offsets por página). Con offsets, sourcePages por parte
  // es exacto (solape de intervalos); sin ellos se hereda el intervalo del padre marcado
  // sourcePagesInherited: true. Nunca un subconjunto plausible presentado como exacto.
  const {existingIds = new Set(), pageOffsets = null} = opts;
  const text = parent.text;
  if (text.length <= MAX) throw new Error('split no aplica: artículo dentro de la cota');
  if (!/^\d{1,6}(?:-[A-Z0-9ÁÉÍÓÚÑ]{1,16}){0,2}$/.test(parent.articleId)) throw new Error('split rechaza padre con más de 2 sufijos (fail-closed)');
  // Unidades: párrafos; un párrafo que excede la cota se segmenta en oraciones.
  // Los 6 casos reales del corpus son UN solo párrafo (verificado 2026-11-12), así que
  // el nivel oración es obligatorio, no opcional. Una oración que excede la cota: fail-closed.
  // Lookbehind conserva separadores: la recomposición join('') es exacta en ambos niveles.
  const units = [];
  for (const p of text.split(/(?<=\n)/)) {
    if (p.length <= MAX) {units.push(p); continue;}
    for (const sent of p.split(/(?<=[.;:]\s)/)) {
      if (sent.length > MAX) throw new Error('oración individual excede la cota: requiere decisión de política distinta');
      units.push(sent);
    }
  }
  const parts = [];
  let buf = '';
  for (const u of units) {
    if (buf && buf.length + u.length > MAX) {parts.push(buf); buf = '';}
    buf += u;
  }
  if (buf) parts.push(buf);
  if (parts.length < 2) throw new Error('split improductivo');
  for (let idx = 1; idx <= parts.length; idx++) {
    if (existingIds.has(`${parent.articleId}-PART-${String(idx).padStart(4, '0')}`)) throw new Error('colisión PART-NNNN con artículo real existente: fail-closed');
  }
  const pageSpan = (start, end) => {
    if (!Array.isArray(pageOffsets)) return null;
    const hit = pageOffsets.filter(pg => start < pg.end && end > pg.start).map(pg => pg.page);
    return hit.length ? [Math.min(...hit), Math.max(...hit)] : null;
  };
  const parentSha = sha(text);
  let cursor = 0;
  const children = parts.map((partText, i) => {
    const child = {
      articleId: `${parent.articleId}-PART-${String(i + 1).padStart(4, '0')}`,
      text: partText,
      parentArticleId: parent.articleId,
      partIndex: i + 1,
      partCount: parts.length,
      charStart: cursor,
      charEnd: cursor + partText.length,
      parentTextSha256: parentSha,
      versionId: parent.versionId,
      pdfSha256: parent.pdfSha256,
      ...(pageSpan(cursor, cursor + partText.length)
        ? {sourcePages: pageSpan(cursor, cursor + partText.length)}
        : {sourcePages: parent.sourcePages, sourcePagesInherited: true}),
    };
    cursor += partText.length;
    return child;
  });
  return children;
}

function recompose(children) {
  for (let i = 0; i < children.length; i++) {
    const c = children[i];
    if (c.partIndex !== i + 1 || c.charStart !== (i ? children[i - 1].charEnd : 0)) throw new Error('secuencia de partes incompleta');
    if (c.parentTextSha256 !== children[0].parentTextSha256) throw new Error('partes de padres distintos');
  }
  const text = children.map(c => c.text).join('');
  if (sha(text) !== children[0].parentTextSha256) throw new Error('recomposición no coincide con el padre');
  return text;
}

// Referencia exacta: lookup del padre devuelve texto COMPLETO recomponiendo y verificando;
// jamás una parte truncada presentada como el artículo.
function lookupExact(children, articleId) {
  const canon = articleCanonical(articleId);
  const parent = children.find(c => articleCanonical(c.parentArticleId) === canon);
  if (parent) {
    const parts = children.filter(c => articleCanonical(c.parentArticleId) === canon);
    return {article: parent.parentArticleId, text: recompose(parts), split: true, parts: parts.length, textLength: recompose(parts).length, truncated: false};
  }
  const child = children.find(c => articleCanonical(c.articleId) === canon);
  if (child) return {article: child.articleId, text: child.text, split: false, partOf: child.parentArticleId, partIndex: child.partIndex, partCount: child.partCount, truncated: false};
  return null;
}

const parentText = Array.from({length: 4000}, (_, i) => `Fracción ${i + 1}. Texto sintético de tarifa con renglones repetidos para superar la cota.\n`).join('');
const parent = {articleId: '1', text: parentText, versionId: 'ligie-2022@sha256:demo', pdfSha256: 'b'.repeat(64), sourcePages: [1, 2, 3]};

test('split: ids dentro de la gramática compartida y provenance completa por parte', () => {
  assert.ok(parentText.length > MAX);
  const children = splitOversizedArticle(parent);
  assert.ok(children.length >= 2);
  for (const c of children) {
    assert.ok(ARTICLE_ID_PATTERN.test(c.articleId), c.articleId);
    assert.ok(c.text.length <= MAX);
    assert.equal(c.parentTextSha256, sha(parentText));
    assert.equal(c.pdfSha256, parent.pdfSha256);
    assert.equal(c.versionId, parent.versionId);
  }
});

test('recomposición sin pérdidas: concat == padre byte a byte (sha256)', () => {
  const children = splitOversizedArticle(parent);
  assert.equal(recompose(children), parentText);
  const tampered = children.map(c => ({...c}));
  tampered[1] = {...tampered[1], text: tampered[1].text + 'X'};
  assert.throws(() => recompose(tampered), /recomposición|secuencia/);
  const missing = children.slice(1);
  assert.throws(() => recompose(missing), /secuencia/);
});

test('referencia exacta del padre devuelve texto completo verificado, nunca truncado silencioso', () => {
  const children = splitOversizedArticle(parent);
  const full = lookupExact(children, '1');
  assert.equal(full.split, true);
  assert.equal(full.truncated, false);
  assert.equal(full.text.length, parentText.length);
  assert.equal(sha(full.text), sha(parentText));
  const part2 = lookupExact(children, '1-PART-0002');
  assert.equal(part2.split, false);
  assert.equal(part2.partOf, '1');
  assert.equal(part2.partIndex, 2);
  assert.equal(part2.truncated, false);
  assert.equal(lookupExact(children, '999'), null);
});

test('fail-closed: padre con >2 sufijos u oración individual sobredimensionada no se divide', () => {
  assert.throws(() => splitOversizedArticle({...parent, articleId: '26-QUÁTER-A-1'}), /fail-closed/);
  const hugeSentence = 'X'.repeat(MAX + 1) + '. cola';
  assert.throws(() => splitOversizedArticle({...parent, text: hugeSentence}), /oración individual/);
});

test('nivel oración: párrafo único sobredimensionado (forma real del corpus) se divide sin pérdidas', () => {
  const oneParagraph = Array.from({length: 3000}, (_, i) => `Inciso ${i + 1} con texto sintético de tarifa. `).join('');
  assert.ok(!oneParagraph.includes('\n') && oneParagraph.length > MAX);
  const children = splitOversizedArticle({...parent, text: oneParagraph});
  assert.ok(children.length >= 2);
  for (const c of children) assert.ok(c.text.length <= MAX && ARTICLE_ID_PATTERN.test(c.articleId));
  assert.equal(recompose(children), oneParagraph);
});

test('abreviaturas jurídicas: recomposición exacta aunque el corte caiga tras una abreviatura', () => {
  // "art. 5", "Fracc. II", "num. 3": el segmentador de oraciones corta tras el punto.
  // Es un corte no silábico subóptimo para contexto de recuperación, pero SIN pérdida:
  // join('') sigue siendo byte-exacto. Una lista curada de abreviaturas es refinamiento
  // opcional en adopción, nunca requisito de integridad.
  const text = ('Cláusula general conforme al art. 5 constitucional y a la Fracc. II del art. 123, apartado A, este supuesto no procede; véase el num. 3 del Anexo. ').repeat(900);
  assert.ok(text.length > MAX);
  const children = splitOversizedArticle({...parent, text});
  assert.ok(children.length >= 2);
  assert.equal(recompose(children), text);
});

test('unicode: recomposición byte-exacta con formas NFD, acentos y ñ', () => {
  const nfd = 'Artículo vigésimo sexto Quáter. La información pública estará disponible para toda persona. ';
  const text = nfd.repeat(1200);
  assert.ok(text.length > MAX);
  const children = splitOversizedArticle({...parent, text});
  assert.equal(recompose(children), text);
  assert.equal(Buffer.compare(Buffer.from(recompose(children), 'utf8'), Buffer.from(text, 'utf8')), 0);
  for (const c of children) assert.equal(sha(c.text), createHash('sha256').update(c.text).digest('hex'));
});

test('colisiones PART: fail-closed si un id hijo coincide con un artículo real existente', () => {
  const children = splitOversizedArticle(parent);
  const someChildId = children[0].articleId;
  assert.throws(() => splitOversizedArticle(parent, {existingIds: new Set([someChildId])}), /colisión/);
  assert.doesNotThrow(() => splitOversizedArticle(parent, {existingIds: new Set(['1-PART-9999'])}));
});

test('sourcePages: exacto por solape con offsets v25; heredado y marcado sin ellos (corpus v24)', () => {
  // Offsets coherentes con la longitud del padre grande; el solape de intervalos decide.
  const big = splitOversizedArticle(parent, {pageOffsets: [{page: 1, start: 0, end: parentText.length / 2}, {page: 2, start: parentText.length / 2, end: parentText.length}]});
  for (const c of big) {
    assert.deepEqual(c.sourcePages, c.charStart < parentText.length / 2 && c.charEnd > parentText.length / 2 ? [1, 2] : c.charEnd <= parentText.length / 2 ? [1, 1] : [2, 2]);
    assert.equal(c.sourcePagesInherited, undefined);
  }
  const legacy = splitOversizedArticle(parent);
  for (const c of legacy) {
    assert.deepEqual(c.sourcePages, parent.sourcePages);
    assert.equal(c.sourcePagesInherited, true);
  }
});
