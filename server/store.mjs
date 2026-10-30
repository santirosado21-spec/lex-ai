import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export function createStore(dataDir) {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  chmodSync(dataDir, 0o700);
  const path = join(dataDir, 'lex.sqlite');
  const db = new DatabaseSync(path);
  chmodSync(path, 0o600);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=DELETE;
    CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, kind TEXT NOT NULL, matter_id TEXT, payload TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS records_scope ON records(kind,matter_id);
    CREATE TABLE IF NOT EXISTS originals (document_id TEXT PRIMARY KEY REFERENCES records(id), bytes BLOB NOT NULL);
    CREATE TABLE IF NOT EXISTS chunks (id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES records(id), matter_id TEXT NOT NULL, text TEXT NOT NULL);
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(id UNINDEXED,matter_id UNINDEXED,text,tokenize='unicode61 remove_diacritics 2');
    CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, action TEXT NOT NULL, entity_id TEXT, created_at TEXT NOT NULL);
    PRAGMA user_version=1;`);
  const parse = r => r ? JSON.parse(r.payload) : null;
  return {
    db,
    get(kind, id, matterId) {
      const row = matterId === undefined
        ? db.prepare('SELECT payload FROM records WHERE kind=? AND id=?').get(kind, id)
        : db.prepare('SELECT payload FROM records WHERE kind=? AND id=? AND matter_id=?').get(kind, id, matterId);
      return parse(row);
    },
    list(kind, matterId) {
      const rows = matterId === undefined
        ? db.prepare('SELECT payload FROM records WHERE kind=? ORDER BY rowid').all(kind)
        : db.prepare('SELECT payload FROM records WHERE kind=? AND matter_id=? ORDER BY rowid').all(kind, matterId);
      return rows.map(parse);
    },
    put(kind, entity) {
      db.prepare('INSERT INTO records(id,kind,matter_id,payload) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload')
        .run(entity.id, kind, entity.matterId ?? null, JSON.stringify(entity));
      return entity;
    },
    transaction(fn) {
      db.exec('BEGIN IMMEDIATE');
      try { const result=fn(); db.exec('COMMIT'); return result; }
      catch(e) { db.exec('ROLLBACK'); throw e; }
    },
    audit(action, id) {
      db.prepare('INSERT INTO audit VALUES(?,?,?,?)').run(randomUUID(), action, id ?? null, new Date().toISOString());
    },
    insertDocument(document, bytes, chunks) {
      this.transaction(() => {
        this.put('document', document);
        db.prepare('INSERT INTO originals VALUES(?,?)').run(document.id, bytes);
        for (const chunk of chunks) {
          db.prepare('INSERT INTO chunks VALUES(?,?,?,?)').run(chunk.id, document.id, document.matterId, chunk.text);
          db.prepare('INSERT INTO chunks_fts VALUES(?,?,?)').run(chunk.id, document.matterId, chunk.text);
        }
        this.audit('document.import', document.id);
      });
    },
    search(matterId, query, limit=6) {
      const terms=searchTerms(query);
      if (!terms.length) return [];
      return db.prepare(`SELECT c.id,c.document_id AS documentId,c.text FROM chunks_fts f
        JOIN chunks c ON c.id=f.id WHERE chunks_fts MATCH ? AND c.matter_id=? AND f.matter_id=?
        ORDER BY bm25(chunks_fts) LIMIT ?`).all(terms.map(t=>`"${t}"`).join(' OR '),matterId,matterId,limit);
    },
    firstChunks(matterId, limit=6) {
      return db.prepare('SELECT id,document_id AS documentId,text FROM chunks WHERE matter_id=? ORDER BY rowid LIMIT ?').all(matterId,limit);
    },
    close() { db.close(); },
  };
}

const STOP = new Set(['que','del','las','los','una','unos','como','para','por','con','sobre','este','esta','sus','son','hay','qué','cómo','cuáles','cuales','analiza','analizar','revisa','revisar']);
export function searchTerms(text) {
  return [...new Set(text.toLowerCase().normalize('NFD').replace(/\p{M}/gu,'').match(/[\p{L}\p{N}]{3,}/gu) ?? [])].filter(t=>!STOP.has(t)).slice(0,32);
}
