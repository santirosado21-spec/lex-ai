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
function splitOversizedArticle(parent) {
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
      sourcePages: parent.sourcePages, // subconjunto exacto por página: fuera de esta referencia
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
