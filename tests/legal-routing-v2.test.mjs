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
