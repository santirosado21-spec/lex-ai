import test from 'node:test';
import assert from 'node:assert/strict';
import {arithmeticResult} from '../server/calculator.mjs';
import {buildChatMessages} from '../server/conversation.mjs';

test('explicit arithmetic is computed deterministically', () => {
  assert.equal(arithmeticResult('¿Cuánto es 17 por 23? Solo el número.').value, '391');
  assert.equal(arithmeticResult('cuanto es 2+2*3').value, '8');
  assert.equal(arithmeticResult('Calcula (1500 - 300) / 4').value, '300');
  assert.equal(arithmeticResult('¿cuánto es 1,250.5 más 10?').value, '1260.5');
  assert.equal(arithmeticResult('cuánto son 12 menos 20').value, '-8');
  assert.equal(arithmeticResult('¿cuánto es 10 dividido entre 4?').value, '2.5');
});

test('no calculation without an explicit, clean expression', () => {
  for (const q of ['cuánto es 10 entre 0', '¿Qué dice el artículo 47 de la LFT?', 'Me pagan 15 días por año, ¿cuánto es?', 'Dame 3 ideas', 'hola', 'cuánto es 2+'])
    assert.equal(arithmeticResult(q), null, q);
});

test('the chat prompt carries the verified result only when there is one', () => {
  const calc = buildChatMessages({question: '¿Cuánto es 17 por 23?', calculation: arithmeticResult('¿Cuánto es 17 por 23?')});
  assert.match(calc[0].content, /17 × 23 = 391/);
  assert.doesNotMatch(buildChatMessages({question: 'hola'})[0].content, /calculadora/);
});
