import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {getPilotTradeScenario, matchPilotTradeScenario} from '../server/pilot-trade-scenario.mjs';

const fixture = await readFile(new URL('../piloto/factura-ficticia.txt', import.meta.url), 'utf8');
const expected = fixture.trimEnd()
  .replace('Comercial Brújula Ficticia', '[[CLIENTE]]')
  .replace('Importación de piezas', '[[ASUNTO]]')
  .replace('Taller Modelo Ficticio', '[[PROVEEDOR]]');

test('recognizes the distributed invoice and reconstructs only its public text', () => {
  const canonical = getPilotTradeScenario('factura-origen-v1');
  assert.deepEqual(canonical, {scenarioId: 'factura-origen-v1', preview: expected});
  assert.ok(Object.isFrozen(canonical));
  for (const version of [fixture, fixture.trimEnd(), fixture.replaceAll('\n', '\r\n')]) {
    assert.strictEqual(matchPilotTradeScenario(version), canonical);
  }
});

test('overlapping and repeated private names stay in their own slots on the device', () => {
  const changed = fixture.replace('Comercial Brújula Ficticia', 'A & B, S.A. de C.V.')
    .replace('Taller Modelo Ficticio', 'A & B, S.A. de C.V.')
    .replace('Importación de piezas', 'A & B, S.A. de C.V. (operación 12/26)');
  assert.equal(matchPilotTradeScenario(changed)?.preview, expected);
  assert.equal(matchPilotTradeScenario(changed.replace('operación', 'operación'.normalize('NFD')))?.preview, expected);
});

test('additional facts, ambiguous boundaries, and marker injections never activate the preset', () => {
  for (const altered of [
    null, {}, '', fixture.repeat(30), ' ' + fixture, fixture + '\n', fixture + 'Origen Canadá',
    fixture.replace('La empresa', 'La autoridad'), fixture.replace('La factura no', 'La factura sí'),
    fixture.replace('Proveedor:', 'Cliente:'), fixture.replace('Proveedor:', 'Proveedor: Otro\nProveedor:'),
    ...['', ' ', '[CLIENTE]', '［［CLIENTE］］', '{{CLIENTE}}', 'Taller\u0000',
      'Taller\u200bOculto', 'Taller\u202eX', 'Taller\nNICO: 00', 'Taller\u2028Extra',
      'A'.repeat(201)].map(value => fixture.replace('Taller Modelo Ficticio', value)),
  ]) assert.equal(matchPilotTradeScenario(altered), null);
  for (const unknown of [null, 'constructor', '__proto__', 'factura-origen-v1 ', {scenarioId: 'factura-origen-v1'}]) {
    assert.equal(getPilotTradeScenario(unknown), null);
  }
});
