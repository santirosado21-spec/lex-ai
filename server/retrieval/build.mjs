import {DatabaseSync} from 'node:sqlite';
import {createReadStream} from 'node:fs';
import {mkdir, open, rename, stat, unlink} from 'node:fs/promises';
import {createHash, randomUUID} from 'node:crypto';
import path from 'node:path';
import {LAW_AREAS, AREAS, classifyLaw} from './areas.mjs';
import {FRAGMENT_VERSION, sha256, splitArticle} from './fragments.mjs';
import {ARTICLE_ID_PATTERN} from '../article-id.mjs';

export const INDEX_APPLICATION_ID = 1279613017;
export const DEFAULT_INPUT = new URL('../../resources/public-library.sqlite', import.meta.url);
export const DEFAULT_INDEX = new URL('../../artifacts/retrieval/fragments.sqlite', import.meta.url);
export async function hashFile(file) {
  const h = createHash('sha256');
  for await (const bytes of createReadStream(file)) h.update(bytes);
  return h.digest('hex');
}

function validateArticle(row, source) {
  if (!source || ['matterId', 'matter_id', 'firmId', 'workspaceId', 'documentId', 'client'].some(key => key in source)) throw new Error('Private fields forbidden');
  if (source.id !== row.id || source.lawId !== row.law_id || source.jurisdiction !== row.jurisdiction
      || !/^MX-[A-Z]{2,3}$/.test(source.jurisdiction) || !source.lawId.startsWith(source.jurisdiction + '-')
      || typeof source.text !== 'string' || source.text.length > 60000 || sha256(source.text) !== source.textSha256
      || typeof source.article !== 'string' || !ARTICLE_ID_PATTERN.test(source.article)
      || source.category !== 'official-public-legislation' || source.status !== 'structurally-verified-currentness-unverified'
      || !/^[a-f0-9]{64}$/.test(source.pdfSha256) || !source.version?.startsWith(source.lawId + '@')
      || !Array.isArray(source.pages) || !source.pages.length || !source.pages.every(p => Number.isInteger(p) && p > 0)
      || !Number.isFinite(Date.parse(source.retrievedAt)) || source.effectiveAt !== null
      || typeof source.title !== 'string' || typeof source.authority !== 'string') throw new Error(`Invalid public article: ${row.id}`);
  const url = new URL(source.url);
  if (url.protocol !== 'https:' || !/(?:^|\.)gob\.mx$/.test(url.hostname) || url.username || url.password || url.port) throw new Error('Official public source URL required');
}

/** Offline build only. Never downloads data or opens a model. */
export async function buildFragmentIndex({inputFile = DEFAULT_INPUT, outputFile = DEFAULT_INDEX, lawAreas = LAW_AREAS, maxChars = 1200} = {}) {
  const {fileURLToPath} = await import('node:url');
  const input = path.resolve(inputFile instanceof URL ? fileURLToPath(inputFile) : inputFile);
  const output = path.resolve(outputFile instanceof URL ? fileURLToPath(outputFile) : outputFile);
  if (input === output) throw new Error('Source index must remain unchanged');
  const sourceIndexSha256 = await hashFile(input);
  await mkdir(path.dirname(output), {recursive: true});
  const lock = await open(output + '.lock', 'wx', 0o600); await lock.close();
  const temporary = output + '.' + randomUUID() + '.tmp';
  let sourceDb, db;
  try {
    sourceDb = new DatabaseSync(input, {readOnly: true});
    sourceDb.exec('PRAGMA query_only=ON; PRAGMA trusted_schema=OFF; PRAGMA cache_size=-8192; BEGIN;');
    db = new DatabaseSync(temporary);
    db.exec(`PRAGMA journal_mode=DELETE; PRAGMA cache_size=-16384; PRAGMA temp_store=FILE;
      PRAGMA application_id=${INDEX_APPLICATION_ID}; PRAGMA user_version=1;
      CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE articles(id TEXT PRIMARY KEY,law_id TEXT NOT NULL,article TEXT NOT NULL,jurisdiction TEXT NOT NULL,text TEXT NOT NULL,payload TEXT NOT NULL,is_latest INTEGER NOT NULL DEFAULT 0);
      CREATE INDEX articles_scope ON articles(jurisdiction,law_id,article);
      CREATE TABLE law_areas(law_id TEXT NOT NULL,area TEXT NOT NULL,PRIMARY KEY(law_id,area));
      CREATE TABLE fragments(rowid INTEGER PRIMARY KEY,id TEXT UNIQUE NOT NULL,article_source_id TEXT NOT NULL REFERENCES articles(id),ordinal INTEGER NOT NULL,text TEXT NOT NULL,payload TEXT NOT NULL);
      CREATE INDEX fragment_article ON fragments(article_source_id,ordinal);
      CREATE VIRTUAL TABLE fragments_fts USING fts5(text,content='fragments',content_rowid='rowid',tokenize='unicode61 remove_diacritics 2');
      BEGIN IMMEDIATE;`);
    const putArticle = db.prepare('INSERT INTO articles(id,law_id,article,jurisdiction,text,payload) VALUES(?,?,?,?,?,?)');
    const putArea = db.prepare('INSERT INTO law_areas VALUES(?,?)');
    const putFragment = db.prepare('INSERT INTO fragments(id,article_source_id,ordinal,text,payload) VALUES(?,?,?,?,?)');
    const laws = new Set(), segmentation = {};
    let articles = 0, fragments = 0;
    for (const row of sourceDb.prepare('SELECT id,law_id,jurisdiction,payload FROM articles ORDER BY id').iterate()) {
      const source = JSON.parse(row.payload); validateArticle(row, source);
      const areas = lawAreas[source.lawId] ?? classifyLaw(source);
      if (!Array.isArray(areas) || !areas.length || areas.some(a => !AREAS.includes(a))) throw new Error('Invalid law areas');
      if (!laws.has(source.lawId)) { for (const area of new Set(areas)) putArea.run(source.lawId, area); laws.add(source.lawId); }
      const metadata = Object.fromEntries(['id', 'originalId', 'title', 'lawId', 'article', 'url', 'jurisdiction', 'retrievedAt', 'version', 'pages', 'status', 'authority', 'category', 'pdfSha256', 'textSha256', 'amendedAt', 'effectiveAt', 'split'].map(key => [key, source[key]]));
      putArticle.run(source.id, source.lawId, source.article, source.jurisdiction, source.text, JSON.stringify(metadata));
      articles++;
      for (const fragment of splitArticle(source, {maxChars})) {
        const {text, ...provenance} = fragment;
        putFragment.run(fragment.id, source.id, fragment.ordinal, text, JSON.stringify(provenance));
        fragments++; segmentation[fragment.segmentation] = (segmentation[fragment.segmentation] ?? 0) + 1;
      }
    }
    if (!articles) throw new Error('Empty public corpus refused');
    const metadata = {schemaVersion: 1, kind: 'public-legal-fragments', fragmentVersion: FRAGMENT_VERSION, sourceIndexSha256,
      areaMapSha256: sha256(JSON.stringify(lawAreas)), maxChars, articles, fragments, laws: laws.size, segmentation,
      offsetUnit: 'utf16-code-unit', currentness: 'unverified', legalAccuracy: 'not-evaluated', privateDocumentsIncluded: false};
    db.prepare('INSERT INTO metadata VALUES(?,?)').run('index', JSON.stringify(metadata));
    db.exec(`UPDATE articles SET is_latest=1 WHERE id IN (SELECT id FROM (SELECT id,row_number() OVER (PARTITION BY jurisdiction,law_id,article ORDER BY json_extract(payload,'$.retrievedAt') DESC,id) AS n FROM articles) WHERE n=1);
      INSERT INTO fragments_fts(fragments_fts) VALUES('rebuild'); INSERT INTO fragments_fts(fragments_fts) VALUES('optimize'); COMMIT;`);
    db.exec("INSERT INTO fragments_fts(fragments_fts,rank) VALUES('integrity-check',1);");
    if (db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('Fragment integrity check failed');
    sourceDb.close(); sourceDb = null;
    if (await hashFile(input) !== sourceIndexSha256) throw new Error('Source index changed during build');
    db.close(); db = null;
    const report = {...metadata, outputFile: output, bytes: (await stat(temporary)).size, indexSha256: await hashFile(temporary)};
    await rename(temporary, output);
    return report;
  } finally {
    try { db?.close(); } finally { sourceDb?.close(); }
    await unlink(temporary).catch(() => {});
    await unlink(temporary + '-journal').catch(() => {});
    await unlink(output + '.lock').catch(() => {});
  }
}
