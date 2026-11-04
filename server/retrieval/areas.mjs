import lawAreas from '../../resources/law-areas.json' with {type: 'json'};
import {expandQuery} from './thesaurus.mjs';

export const AREAS = Object.freeze(['constitucional', 'civil', 'familiar', 'penal', 'laboral', 'mercantil', 'fiscal', 'amparo', 'administrativo', 'seguridad-social', 'otros']);
export const fold = value => String(value).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
export const LAW_AREAS = Object.freeze(Object.fromEntries(Object.entries(lawAreas).map(([id, areas]) => [id, Object.freeze([...areas])])));

// Reviewed against the public catalog titles, not a claim of legal validation.
// Numeric publisher IDs must be reviewed by title, never inferred from the number.
const groups = {
  'civil,familiar': ['CCF', 'CFPC', 'CNPCF', 'LFDEAPD'],
  constitucional: ['CPEUM', '10', '202', '219', 'REG_DIPUTADOS', 'LOCGEUM', 'LRART76_FRACVI', 'LRFIYII_ART105', 'LCNDH', 'LGIPE', 'LGPP', 'LGMIME', 'LFCPO', 'LFRM', 'LPPDDHP'],
  amparo: ['LAMP'],
  penal: ['CPF', 'CNPP', 'CJM', 'CMPP', '19', 'LAMN', '36', 'LFCDO', 'LFGR', 'LFPPIPP', 'LNEP', 'LNMASCMP', 'LNSIJPA', 'LGV', 'LNRD', 'LOPGJDF', 'LNED'],
  laboral: ['LFT', 'LFTSE', 'LAAT', 'LOCFCRL', 'LRFXIIIB_ART123', 'LGSCMM'],
  mercantil: ['CCOM', 'LGSM', 'LGTOC', 'LCM', 'LIC', 'LMV', 'LISF', 'LRITF', 'LGSC', 'LACP', 'LUC', 'LFI', '211', '105', '70', '71', '162', '164', '167', '256', 'LOBNCE', 'LOBNOSP', 'LOSHF', 'LRAF', 'LRSIC', 'LSP', 'LTOSF', 'LPAB', 'LPDUSF', 'LCNBV', 'LCEC', 'LFAAR', 'LESS'],
  fiscal: ['CFF', 'LISR', 'LIF_2026', 'LIGIE_2022', 'LFISAN', 'LIH', 'LFDC', 'LCF', '93', '30', 'LOPDC', 'LTF'],
  'seguridad-social': ['LSS', 'LISSSTE', 'LISSFAM', 'LSAR', 'LIFNVT', 'LIFNCT'],
  administrativo: ['LFPA', 'LGRA', 'LGSNA', 'LOAPF', 'LAASSP', 'LOPSRM', 'LAC', 'LGPC', 'LAGRA', '159', 'LGMHCTI', 'LCID', 'LGCFD', 'LPERC', 'LUPDECR', '238', '35', '53', '57', '65', '75', 'LAEM', 'LASOC', 'LCJPJF', 'LCMM', 'LDPAM', 'LDVUMA', 'LEN', 'LFEA', 'LGEO', 'LHHEUM', 'LICAL', 'LMTR', 'LPO', 'LTPCPIMCP', 'LVGC', 'LVZMM'],
  'administrativo,fiscal': ['LFPCA', 'LOTFJA', 'LFPRH', 'PEF_2026', 'LFRCF', 'LDFEFM', '136', 'LGCG'],
  'mercantil,administrativo': ['LFCE', 'LFPC', 'LFPPI', 'LCE', 'LNCM', '74'],
  'civil,mercantil': ['LFDA'],
  'civil,administrativo': ['LRCDN', 'LFRPE', 'LFRA'],
  'familiar,penal': ['LGAMVLV'],
  'familiar,administrativo': ['LGDNNA', 'LGPSACDII'],
  'constitucional,administrativo': ['LFPDPPP', 'LGPDPPSO', 'LGTAIP', 'LFPED', 'LGISMH', 'LGDLPI', 'LRART6_MDR'],
  'civil,mercantil,familiar': ['LGMASC'],
  otros: ['177'],
};
export const REVIEWED_LAWS = Object.freeze(Object.fromEntries(Object.entries(groups).flatMap(([areas, ids]) => ids.map(id => [`MX-FED-${id}`, areas.split(',')]))));

export function classifyLaw({lawId, title}) {
  if (REVIEWED_LAWS[lawId]) return [...REVIEWED_LAWS[lawId]];
  const name = fold(title);
  const areas = [];
  if (/\b(amparo)\b/.test(name)) areas.push('amparo');
  if (/\b(penal|penales|delitos?|delincuencia|tortura|secuestro|extorsion|detenciones|desaparicion|armas de fuego)\b/.test(name)) areas.push('penal');
  if (/\b(familiares|familia|alimentaria|infantil)\b/.test(name)) areas.push('familiar');
  if (/\b(trabajo|trabajadores|laboral|remuneraciones)\b/.test(name)) areas.push('laboral');
  if (/\b(seguro social|seguridad social|servicios sociales|retiro)\b/.test(name)) areas.push('seguridad-social');
  if (/\b(fiscal|fiscales|impuesto|impuestos|tributaria|ingresos|hacienda|hacendaria|contribucion)\b/.test(name)) areas.push('fiscal');
  if (/\b(mercantil|mercantiles|comercio|credito|bancari\w*|financiera\w*|inversion|sociedades|seguros|fianzas)\b/.test(name)) areas.push('mercantil');
  if (/\b(civiles|civil por|contrato|propiedad)\b/.test(name)) areas.push('civil');
  if (/\b(constitucion|constitucional|electorales|derechos humanos)\b/.test(name)) areas.push('constitucional');
  if (/\b(organica|administracion|publica|publico|general|federal|nacional|nacionales|reglamento|energia|aguas|mineria|militar|armada|ejercito|instituto|universidad|desarrollo|fomento|disciplina|planeacion|servicio|proteccion|sanidad|vivienda|migracion|asociaciones|bio\w*|ferroviario|electric\w*|sector|culto|navegacion|refugiados|tratados|aeropuertos|tesoreria|ejecucion en mexico|mejora continua|profesiones)\b/.test(name) && !areas.length) areas.push('administrativo');
  return areas.length ? areas : ['otros'];
}

const VOCABULARY = {
  constitucional: /\b(constitucion|constitucional|derechos humanos|libertad de expresion|discriminacion|votar|elecciones)\b/,
  civil: /\b(civil|contrato|contratos|arrendamiento|renta|inquilino|casero|herencia|testamento|propiedad|danos|deuda|deudas)\b/,
  familiar: /\b(familiar|divorcio|custodia|patria potestad|espos[oa]|hij[oa]s?|pension alimenticia|alimentos|matrimonio|concubinato|convivencia|manutencion)\b/,
  penal: /\b(penal|delito|delitos|carcel|detuvieron|detenido|denuncia|robo|robaron|fraude|fiscalia|ministerio publico|secuestro|extorsion)\b/,
  laboral: /\b(laboral|despido|despidieron|despedid[oa]|corrieron|trabajo|patron|jefe|empleado|sueldo|salario|salarios|aguinaldo|vacaciones|finiquito|liquidacion|renuncia)\b/,
  mercantil: /\b(mercantil|pagare|pagares|sociedad|sociedades|accionistas|comercio|cheque|concurso mercantil|quiebra|credito|banco)\b/,
  fiscal: /\b(fiscal|sat|impuesto|impuestos|isr|iva|tributari\w*|declaracion anual|credito fiscal|hacienda|factura|facturas|aduana|aduanas)\b/,
  amparo: /\b(amparo|suspension provisional|suspension definitiva|acto reclamado|autoridad responsable|quejoso)\b/,
  administrativo: /\b(administrativo|administrativa|multa|multas|licencia|permiso|licitacion|servidor publico|ayuntamiento|clausura|tramite|concesion)\b/,
  'seguridad-social': /\b(seguridad social|imss|issste|infonavit|afore|jubilacion|jubilado|retiro|semanas cotizadas|pension de vejez|pension de invalidez|pension por viudez)\b/,
};
export function detectArea(question) {
  const q = fold(question);
  const mentioned = Object.keys(LAW_AREAS).filter(id => new RegExp(`\\b${id.toLowerCase()}\\b`).test(q) || /^[A-Z]/.test(id.slice(7)) && new RegExp(`\\b${id.slice(7).toLowerCase()}\\b`).test(q));
  const detected = new Set(mentioned.flatMap(id => LAW_AREAS[id]));
  for (const area of expandQuery(q).areas) detected.add(area);
  for (const [area, pattern] of Object.entries(VOCABULARY)) if (pattern.test(q)) detected.add(area);
  return detected.size ? [...detected] : ['otros'];
}
