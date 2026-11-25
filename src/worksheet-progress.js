// Summarizes user-entered work states, never legal compliance or evidence quality.
const pendingStates = ['Por revisar', 'Solicitado', 'Recibido'];
export function worksheetProgress(rows) {
 const pending = rows.filter(row => pendingStates.includes(row.status));
 return {
  total: rows.length,
  pending: pending.map(({id, label, status}) => ({id, label, status})),
  checked: rows.filter(row => row.status === 'Cotejado').length,
  notApplicable: rows.filter(row => row.status === 'No aplica').length,
  unknown: rows.filter(row => ![...pendingStates, 'Cotejado', 'No aplica'].includes(row.status)).length,
 };
}
