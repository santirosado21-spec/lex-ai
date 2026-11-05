import test from 'node:test';
import assert from 'node:assert/strict';
import {routeAssistantRequest} from '../server/assistant-router.mjs';
import {validateConversationText} from '../server/grounded-output-mixed.mjs';
import {validateGroundedOutput} from '../server/grounded-output.mjs';

test('named laws and labour entitlements asked as questions go to retrieval', () => {
  for (const question of ['¿Qué es el aguinaldo y cuánto es lo mínimo según la LFT?', '¿Cuántos días de vacaciones me tocan?',
    'Mi patrón me corrió sin darme aviso por escrito. ¿Eso tiene alguna consecuencia según la ley?', '¿Cómo se calcula el finiquito?'])
    assert.equal(routeAssistantRequest({question}).kind, 'grounded', question);
  for (const question of ['Escribe un cuento sobre la ley de la gravedad', 'Me voy de vacaciones a Oaxaca, ¡qué emoción!', 'Sugiéreme un nombre para un despacho pequeño.'])
    assert.equal(routeAssistantRequest({question}).kind, 'chat', question);
});

test('chat about a non-legal request is judged sentence by sentence; legal claims still need evidence', () => {
  const names = '¡Claro! Para un despacho pequeño, el nombre debe ser memorable.\n* **Clásicos:** *Lex & Asociados*, *Derecho & Compromiso*.';
  assert.throws(() => validateConversationText(names, {generalConversation: true}), {code: 'UNGROUNDED_CLAIM'});
  assert.equal(validateConversationText(names, {generalConversation: true, sentenceLevel: true}), names);
  for (const claim of ['El plazo es de treinta días para demandar.', 'Según la ley, el despido es ilegal.'])
    assert.throws(() => validateConversationText(claim, {generalConversation: true, sentenceLevel: true}), {code: 'UNGROUNDED_CLAIM'}, claim);
});

test('numbers in a public article passage back its paragraph; private documents stay quote-strict', () => {
  const text = 'Artículo 47.- Son causas de rescisión de la relación de trabajo, sin responsabilidad para el patrón: I. Engañarlo el trabajador con certificados falsos. Esta causa de rescisión dejará de tener efecto después de treinta días de prestar sus servicios el trabajador.';
  const quote = 'Artículo 47.- Son causas de rescisión de la relación de trabajo, sin responsabilidad para el patrón:';
  const para = id => ({paragraphs: [{sourceId: id, quote, text: 'El artículo 47 permite rescindir sin responsabilidad, y esa causa deja de aplicar después de treinta días.'}]});
  const ok = validateGroundedOutput(JSON.stringify(para('L1')), [{id: 'L1', article: '47', text, allowedQuotes: [quote]}]);
  assert.equal(ok.paragraphs.length, 1);
  assert.throws(() => validateGroundedOutput(JSON.stringify(para('D1')), [{id: 'D1', text, allowedQuotes: [quote]}]), /respaldo/);
  const invented = {paragraphs: [{sourceId: 'L1', quote, text: 'El artículo 47 da un plazo de noventa días para rescindir la relación laboral.'}]};
  assert.throws(() => validateGroundedOutput(JSON.stringify(invented), [{id: 'L1', article: '47', text, allowedQuotes: [quote]}]), /respaldo/);
});

test('"artículo 14 de la Constitución" is not a date; real dates still are', async () => {
  const {numericClaims} = await import('../server/grounded-output.mjs');
  assert.ok(!numericClaims('El artículo 14 de la Constitución').some(c => /de la/.test(c)));
  assert.ok(numericClaims('vence el 5 de mayo de 2024').includes('5 de mayo de 2024'));
});

test('a thesis asked by its identifier is not answered with legislation', async () => {
  const {mkdtemp} = await import('node:fs/promises'); const os = await import('node:os'); const path = await import('node:path');
  const {createService} = await import('../server/service.mjs');
  const dir = await mkdtemp(path.join(os.tmpdir(), 'lex-tesis-'));
  let generated = 0;
  const inference = {async status() { return {state: 'ready'}; }, async *generate() { generated++; yield '{"paragraphs":[]}'; }};
  const service = await createService({dataDir: dir, corpusPath: path.resolve('resources/legal-corpus.json'), inference, schedulerEnabled: false});
  try {
    await service.dispatch('workspace.create', {name: 'x', practiceAreas: ['civil']});
    const answer = await service.analyze({mode: 'auto', question: '¿Cuál es la tesis 2a./J. 999/2031 de la Suprema Corte?'});
    assert.equal(answer.validation.status, 'needs-jurisprudence-source');
    assert.deepEqual(answer.citations, []); assert.equal(generated, 0);
  } finally { service.close(); }
});

test('chat legal turns drop distractor articles that do not open with the topic', async t => {
  const {existsSync} = await import('node:fs'); const path = await import('node:path');
  const file = path.resolve('resources/public-library.sqlite');
  if (!existsSync(file)) return t.skip('public library not built');
  const {openPublicLibrary} = await import('../server/public-library.mjs');
  const {createService} = await import('../server/service.mjs');
  const {mkdtemp} = await import('node:fs/promises'); const os = await import('node:os');
  const library = await openPublicLibrary(file);
  let seen = null;
  const inference = {async status() { return {state: 'ready'}; }, async *generate(messages) { const u = JSON.parse(messages.at(-1).content); if (u.sources) seen = u.sources; yield '{"paragraphs":[{"kind":"conversacion","text":"Listo."}]}'; }};
  const service = await createService({dataDir: await mkdtemp(path.join(os.tmpdir(), 'lex-distractor-')), corpusPath: path.resolve('resources/legal-corpus.json'), inference, publicLibrary: library, schedulerEnabled: false});
  try {
    await service.dispatch('workspace.create', {name: 'x', practiceAreas: ['laboral']});
    await service.analyze({mode: 'auto', question: '¿Qué es el aguinaldo y cuánto es lo mínimo según la LFT?'});
    assert.ok(seen?.length >= 1);
    assert.ok(seen.every(s => /aguinaldo/i.test(s.text.slice(0, 200))), JSON.stringify(seen.map(s => s.article)));
  } finally { service.close(); library.close(); }
});

test('a number written in words in the law backs the same number in digits', async () => {
  const {validateGroundedOutput} = await import('../server/grounded-output.mjs');
  const quote = 'Artículo 87.- Los trabajadores tendrán derecho a un aguinaldo anual que deberá pagarse antes del día veinte de diciembre, equivalente a quince días de salario, por lo menos.';
  const ev = [{id: 'L1', article: '87', text: quote, allowedQuotes: [quote]}];
  const ok = {paragraphs: [{sourceId: 'L1', quote, text: 'El aguinaldo es de al menos 15 días de salario y se paga antes del 20 de diciembre.'}]};
  assert.equal(validateGroundedOutput(JSON.stringify(ok), ev).paragraphs.length, 1);
  const bad = {paragraphs: [{sourceId: 'L1', quote, text: 'El aguinaldo es de al menos 30 días de salario y se paga antes del 20 de diciembre.'}]};
  assert.throws(() => validateGroundedOutput(JSON.stringify(bad), ev), /respaldo/);
});

test('"más corto" and similar after a grounded answer stay on the grounded thread', () => {
  const previousTurn = {kind: 'grounded', citations: [{id: 'L1'}], question: 'Explícame el artículo 1 de la Constitución.'};
  for (const question of ['Más corto, en dos líneas.', 'En pocas palabras, por favor', 'Más sencillo'])
    assert.equal(routeAssistantRequest({question, previousTurn}).kind, 'grounded', question);
  assert.equal(routeAssistantRequest({question: 'Más corto, en dos líneas.', previousTurn: {kind: 'chat', citations: []}}).kind, 'chat');
});

test('a too-short or bracketed paragraph is dropped; control characters still reject', async () => {
  const {validateMixedOutput} = await import('../server/grounded-output-mixed.mjs');
  const quote = 'En los Estados Unidos Mexicanos todas las personas gozarán de los derechos humanos reconocidos en esta Constitución.';
  const ev = [{id: 'L1', article: '1', text: quote, allowedQuotes: [quote]}];
  const good = {sourceId: 'L1', quote, text: 'Todas las personas en México gozan de los derechos humanos que reconoce la Constitución.'};
  const out = validateMixedOutput(JSON.stringify({paragraphs: [good, {sourceId: 'L1', quote, text: 'Corto [L1]'}]}), ev);
  assert.equal(out.citations.length, 1); assert.doesNotMatch(out.text, /Corto/);
  assert.throws(() => validateMixedOutput(JSON.stringify({paragraphs: [{...good, text: good.text + '\u0001'}]}), ev), /controles/);
});

test('a trailing marker of the same source is tolerated; a foreign marker is not', async () => {
  const {validateMixedOutput} = await import('../server/grounded-output-mixed.mjs');
  const quote = 'En los Estados Unidos Mexicanos todas las personas gozarán de los derechos humanos reconocidos en esta Constitución.';
  const ev = [{id: 'L1', article: '1', text: quote, allowedQuotes: [quote]}];
  const text = 'Todas las personas en México gozan de los derechos humanos que reconoce la Constitución.';
  assert.equal(validateMixedOutput(JSON.stringify({paragraphs: [{sourceId: 'L1', quote, text: text + ' [L1]'}]}), ev).citations.length, 1);
  assert.throws(() => validateMixedOutput(JSON.stringify({paragraphs: [{sourceId: 'L1', quote, text: text + ' [L2]'}]}), ev), {code: 'UNGROUNDED_CLAIM'});
});

test('a correction states the real profession; hypotheticals still do not', async () => {
  const {recallUserStatement} = await import('../server/conversation-recall.mjs');
  assert.match(recallUserStatement('Entonces, ¿qué área soy?', [{question: 'Te equivocaste antes: no soy penalista, soy fiscalista.'}]), /fiscalista/);
  assert.match(recallUserStatement('¿Cuál es mi profesión?', [{question: 'Si fuera juez, no soy abogado.'}]), /No encuentro/);
  assert.equal(routeAssistantRequest({question: 'Entonces, ¿qué área soy?'}).kind, 'chat');
});
