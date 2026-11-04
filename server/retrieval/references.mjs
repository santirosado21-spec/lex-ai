import {LAW_AREAS, fold} from './areas.mjs';
import catalog from '../../resources/legal-library-catalog.json' with {type: 'json'};

const officialTitles = catalog.sources.map(source => ({title: fold(source.title), lawId: source.lawId}))
  .sort((a,b) => b.title.length-a.title.length);

export const TITLES = {
  'codigo civil federal': 'CCF', 'codigo de comercio': 'CCOM',
  'codigo fiscal de la federacion': 'CFF', 'codigo penal federal': 'CPF',
  'codigo nacional de procedimientos penales': 'CNPP',
  'codigo nacional de procedimientos civiles y familiares': 'CNPCF',
  'codigo federal de procedimientos civiles': 'CFPC',
  'constitucion politica de los estados unidos mexicanos': 'CPEUM',
  'ley federal del trabajo': 'LFT', 'ley del seguro social': 'LSS',
  'ley de amparo': 'LAMP', 'ley general de sociedades mercantiles': 'LGSM',
  'ley general de titulos y operaciones de credito': 'LGTOC',
  'ley federal de procedimiento administrativo': 'LFPA',
  'ley federal de procedimiento contencioso administrativo': 'LFPCA',
};

export function stripLawTitles(text) {
  let result = fold(text);
  for (const {title} of officialTitles) result = result.replaceAll(title, ' ');
  for (const title of Object.keys(TITLES)) result = result.replaceAll(title, ' ');
  return result;
}

export function extractReference(text) {
  let q = fold(text);
  const laws = new Set([...String(text).toUpperCase().matchAll(/\bMX-[A-Z]{2,3}-[A-Z0-9_]+(?:-[A-Z0-9_]+)*\b/g)].map(m => m[0]));
  // Long official titles can contain another law's title (e.g. a regulatory
  // law citing the Constitution). Consume the enclosing title first; a second
  // independent reference outside that span still remains ambiguous.
  for (const {title, lawId} of officialTitles) if (q.includes(title)) {
    laws.add(lawId); q = q.replaceAll(title, ' ');
  }
  for (const id of Object.keys(LAW_AREAS)) {
    const code = id.slice(7);
    if (/^[A-Z][A-Z0-9_]{2,}$/.test(code) && new RegExp(`\\b${code.toLowerCase()}\\b`).test(q)) laws.add(id);
  }
  for (const [title, code] of Object.entries(TITLES)) if (q.includes(title)) laws.add(`MX-FED-${code}`);
  const articles = [...q.replace(/\s*[-–]\s*/g, '-').matchAll(/\b(?:articulo|art)[.\s]+(\d{1,6}(?:-[a-z0-9]+){0,4})(?:\s+(bis|ter|quater|quinquies)(?:[-\s]+([a-z]|\d+)\b)?)?\b/g)].map(m => [m[1], m[2], m[3]].filter(Boolean).join('-').toUpperCase());
  // Lawyers say "la Constitución" or "artículo 14 constitucional" for the federal
  // Constitution. Only with an article number, and never for a local one
  // ("Constitución de Jalisco", "de la Ciudad de México", "estatal").
  if (!laws.size && articles.length && /\bconstitucion(?:al)?\b/.test(q)
    && !/\bconstitucion\s+(?:politica\s+)?(?:de|del)\s+(?!los estados unidos|mexico\b|la republica)/.test(q)
    && !/\b(?:cdmx|distrito federal|local|estatal|estado de)\b/.test(q)) laws.add('MX-FED-CPEUM');
  return {lawId: laws.size === 1 ? [...laws][0] : null, article: new Set(articles).size === 1 ? articles[0] : null, ambiguous: laws.size > 1 || new Set(articles).size > 1,
    navigation: /\b(?:siguiente|posterior)\b/.test(q) ? 'next' : /\b(?:anterior|previo)\b/.test(q) ? 'previous' : null};
}
