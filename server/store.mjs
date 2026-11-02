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
    CREATE TABLE IF NOT EXISTS agent_action_proposals (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, matter_id TEXT, action TEXT NOT NULL,
      args_json TEXT NOT NULL, args_hash TEXT NOT NULL, origin TEXT NOT NULL CHECK(origin IN ('user','agent')),
      status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected','expired','failed')),
      created_at TEXT NOT NULL, expires_at TEXT NOT NULL, decided_at TEXT, result_json TEXT
    );
    CREATE INDEX IF NOT EXISTS agent_action_proposals_scope ON agent_action_proposals(workspace_id,matter_id,status,created_at);
    CREATE TABLE IF NOT EXISTS agent_action_log (
      id TEXT PRIMARY KEY, proposal_id TEXT, workspace_id TEXT NOT NULL, matter_id TEXT, origin TEXT NOT NULL,
      action TEXT NOT NULL, args_hash TEXT NOT NULL, decision TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS agent_action_log_scope ON agent_action_log(workspace_id,matter_id,created_at);
    PRAGMA user_version=3;`);
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
    createAgentProposal(proposal) {
      db.prepare(`INSERT INTO agent_action_proposals
        (id,workspace_id,matter_id,action,args_json,args_hash,origin,status,created_at,expires_at,decided_at,result_json)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(proposal.id,proposal.workspaceId,proposal.matterId,proposal.action,JSON.stringify(proposal.args),proposal.argsHash,proposal.origin,proposal.status,proposal.createdAt,proposal.expiresAt,null,null);
      return proposal;
    },
    getAgentProposal(id) {
      const row=db.prepare('SELECT * FROM agent_action_proposals WHERE id=?').get(id);
      return row?{id:row.id,workspaceId:row.workspace_id,matterId:row.matter_id,action:row.action,args:JSON.parse(row.args_json),argsHash:row.args_hash,origin:row.origin,status:row.status,createdAt:row.created_at,expiresAt:row.expires_at,decidedAt:row.decided_at,result:row.result_json?JSON.parse(row.result_json):null}:null;
    },
    listAgentProposals(workspaceId,matterId) {
      const rows=matterId===undefined||matterId===null
        ?db.prepare('SELECT * FROM agent_action_proposals WHERE workspace_id=? ORDER BY created_at').all(workspaceId)
        :db.prepare('SELECT * FROM agent_action_proposals WHERE workspace_id=? AND matter_id=? ORDER BY created_at').all(workspaceId,matterId);
      return rows.map(row=>({id:row.id,workspaceId:row.workspace_id,matterId:row.matter_id,action:row.action,args:JSON.parse(row.args_json),argsHash:row.args_hash,origin:row.origin,status:row.status,createdAt:row.created_at,expiresAt:row.expires_at,decidedAt:row.decided_at,result:row.result_json?JSON.parse(row.result_json):null}));
    },
    updateAgentProposal(proposal) {
      const result=db.prepare(`UPDATE agent_action_proposals SET status=?,decided_at=?,result_json=? WHERE id=? AND workspace_id=? AND status='pending'`).run(proposal.status,proposal.decidedAt,proposal.result===null?null:JSON.stringify(proposal.result),proposal.id,proposal.workspaceId);
      return result.changes;
    },
    logAgentAction(entry) {
      db.prepare('INSERT INTO agent_action_log VALUES(?,?,?,?,?,?,?,?,?)').run(randomUUID(),entry.proposalId??null,entry.workspaceId,entry.matterId??null,entry.origin,entry.action,entry.argsHash,entry.decision,entry.createdAt);
    },
    listAgentActionLog(workspaceId,matterId,limit) {
      const query=matterId===undefined||matterId===null
        ?'SELECT proposal_id AS proposalId,workspace_id AS workspaceId,matter_id AS matterId,origin,action,args_hash AS argsHash,decision,created_at AS createdAt FROM agent_action_log WHERE workspace_id=? ORDER BY rowid DESC LIMIT ?'
        :'SELECT proposal_id AS proposalId,workspace_id AS workspaceId,matter_id AS matterId,origin,action,args_hash AS argsHash,decision,created_at AS createdAt FROM agent_action_log WHERE workspace_id=? AND matter_id=? ORDER BY rowid DESC LIMIT ?';
      return (matterId===undefined||matterId===null?db.prepare(query).all(workspaceId,limit):db.prepare(query).all(workspaceId,matterId,limit)).reverse();
    },
    insertDocument(document, bytes, chunks, {inTransaction=false}={}) {
      const write=() => {
        this.put('document', document);
        db.prepare('INSERT INTO originals VALUES(?,?)').run(document.id, bytes);
        for (const chunk of chunks) {
          db.prepare('INSERT INTO chunks VALUES(?,?,?,?)').run(chunk.id, document.id, document.matterId, chunk.text);
          db.prepare('INSERT INTO chunks_fts VALUES(?,?,?)').run(chunk.id, document.matterId, chunk.text);
        }
        this.audit('document.import', document.id);
      };
      if(inTransaction)write();else this.transaction(write);
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
