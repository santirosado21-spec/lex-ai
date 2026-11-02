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
    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      matter_id TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('deadline','followup','draft-suggestion')),
      title TEXT NOT NULL,
      due_at TEXT,
      note TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('proposed','approved','done','dismissed')),
      source TEXT NOT NULL CHECK(source IN ('user','planner')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      planner_rule TEXT
    );
    CREATE INDEX IF NOT EXISTS reminders_scope ON reminders(workspace_id,matter_id,status,due_at);
    PRAGMA user_version=2;`);
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
    createReminder(reminder) {
      db.prepare(`INSERT INTO reminders
        (id,workspace_id,matter_id,kind,title,due_at,note,status,source,created_at,updated_at,planner_rule)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        reminder.id,reminder.workspaceId,reminder.matterId,reminder.kind,reminder.title,reminder.dueAt,
        reminder.note,reminder.status,reminder.source,reminder.createdAt,reminder.updatedAt,reminder.plannerRule ?? null,
      );
      return reminder;
    },
    getReminder(id, workspaceId, matterId) {
      return db.prepare(`SELECT id,workspace_id AS workspaceId,matter_id AS matterId,kind,title,due_at AS dueAt,note,status,source,
        created_at AS createdAt,updated_at AS updatedAt,planner_rule AS plannerRule
        FROM reminders WHERE id=? AND workspace_id=? AND matter_id=?`).get(id,workspaceId,matterId) ?? null;
    },
    listReminders(workspaceId, matterId) {
      return db.prepare(`SELECT id,workspace_id AS workspaceId,matter_id AS matterId,kind,title,due_at AS dueAt,note,status,source,
        created_at AS createdAt,updated_at AS updatedAt,planner_rule AS plannerRule
        FROM reminders WHERE workspace_id=? AND matter_id=? ORDER BY due_at IS NULL,due_at,title,id`).all(workspaceId,matterId);
    },
    updateReminder(reminder) {
      const result=db.prepare(`UPDATE reminders SET kind=?,title=?,due_at=?,note=?,status=?,source=?,updated_at=?,planner_rule=?
        WHERE id=? AND workspace_id=? AND matter_id=?`).run(
        reminder.kind,reminder.title,reminder.dueAt,reminder.note,reminder.status,reminder.source,reminder.updatedAt,
        reminder.plannerRule ?? null,reminder.id,reminder.workspaceId,reminder.matterId,
      );
      if(result.changes!==1)throw new Error('Recordatorio no encontrado en este asunto.');
      return reminder;
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
    original(documentId, matterId) {
      const row=db.prepare("SELECT o.bytes FROM originals o JOIN records r ON r.id=o.document_id WHERE r.kind='document' AND r.id=? AND r.matter_id=?").get(documentId,matterId);
      return row ? Buffer.from(row.bytes) : null;
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
