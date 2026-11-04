import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256, splitArticle, verifyFragment} from '../server/retrieval/fragments.mjs';

function article(text) { return {id: 'synthetic', lawId: 'MX-FED-SYNTHETIC', article: '7', jurisdiction: 'MX-FED', text, textSha256: sha256(text)}; }

test('fractions and subparagraphs retain exact offsets, parent markers and complete article hash', () => {
  const source = article('Artículo 7.- Supuesto sintético.\nI. Primera obligación.\nII. Segunda obligación:\na) Pago de alimentos.\nb) Entrega de recibos.\nUn párrafo posterior.');
  const fragments = splitArticle(source);
  assert.equal(fragments.length, 6);
  assert.equal(fragments[2].fraction, 'II.');
  assert.equal(fragments[3].inciso, 'a)');
  assert.equal(fragments[3].fraction, 'II.');
  assert.equal(fragments[3].text, 'a) Pago de alimentos.');
  assert.ok(fragments.every(f => verifyFragment(f, source)));
  assert.ok(fragments.every(f => f.articleSha256 === source.textSha256));
  assert.equal(fragments.map(f => f.text).join('').replace(/\s/g, ''), source.text.replace(/\s/g, ''));
  assert.deepEqual(splitArticle(source), fragments);
});

test('single-line extraction splits I., II.- and a) without calling approximate cuts official paragraphs', () => {
  const source = article('Artículo 7.- Lista: I. Salario sintético. II.- Indemnización sintética. a) Primer supuesto. b) Segundo supuesto.');
  const fragments = splitArticle(source);
  assert.equal(fragments.length, 5);
  assert.equal(fragments[2].text, 'II.- Indemnización sintética.');
  assert.ok(fragments.every(f => verifyFragment(f, source)));
  const long = article('Artículo 7.- ' + '😀 Texto sintético suficientemente largo. '.repeat(150));
  const parts = splitArticle(long, {maxChars: 150});
  assert.ok(parts.every(f => f.text.length <= 150 && verifyFragment(f, long)));
  assert.ok(parts.every(f => f.segmentation === 'approximate-size-boundary'));
  assert.equal(parts.map(f => f.text).join('').replace(/\s/g, ''), long.text.replace(/\s/g, ''));
});

test('citation verification rejects changed text, offsets, identity, jurisdiction and hash', () => {
  const source = article('Artículo 7.- Texto sintético con 😀 carácter astral. I. Obligación de prueba.');
  const fragment = splitArticle(source)[1];
  assert.equal(verifyFragment(fragment, source), true);
  for (const change of [{start: fragment.start + 1}, {text: 'inventado'}, {lawId: 'MX-FED-OTHER'}, {jurisdiction: 'MX-JAL'}, {articleSha256: '0'.repeat(64)}, {end: -1}]) assert.equal(verifyFragment({...fragment, ...change}, source), false);
  assert.equal(verifyFragment(fragment, {...source, text: source.text + ' adulterado'}), false);
  assert.throws(() => splitArticle({...source, textSha256: '0'.repeat(64)}), /hash/);
});
