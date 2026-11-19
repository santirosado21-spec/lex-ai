const header = 'Factura ficticia para el piloto de Rejon.AI';
const narrative = 'La empresa pide revisar qué documentación falta para analizar el origen preferencial. La factura no acredita por sí sola el origen de las piezas.';
const slots = [
  ['Cliente: ', '[[CLIENTE]]'],
  ['Asunto: ', '[[ASUNTO]]'],
  ['Proveedor: ', '[[PROVEEDOR]]'],
];

const invoiceScenario = Object.freeze({
  scenarioId: 'factura-origen-v1',
  preview: [header, ...slots.map(([label, marker]) => label + marker), narrative].join('\n'),
});

export function getPilotTradeScenario(scenarioId) {
  return scenarioId === invoiceScenario.scenarioId ? invoiceScenario : null;
}

function matchesLocalField(line, label) {
  if (!line.startsWith(label)) return false;
  const value = line.slice(label.length).normalize('NFC');
  return value.length > 0 && value.length <= 200 && value.trim() === value &&
    /^[\p{Script=Latin}0-9]/u.test(value) &&
    !/[^\p{Script=Latin}0-9 .,&'’()/-]/u.test(value);
}

export function matchPilotTradeScenario(text) {
  if (typeof text !== 'string' || text.length > 1500) return null;
  const normalized = text.replace(/\r\n/g, '\n');
  const lines = (normalized.endsWith('\n') ? normalized.slice(0, -1) : normalized).split('\n');
  if (lines.length !== slots.length + 2 || lines[0] !== header || lines.at(-1) !== narrative) return null;
  if (!slots.every(([label], index) => matchesLocalField(lines[index + 1], label))) return null;
  // The only value eligible for cloud context is the same static text for every match.
  return invoiceScenario;
}
