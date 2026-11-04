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
    CREATE TABLE IF NOT EXISTS time_entries (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      matter_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      started_at TEXT,
      ended_at TEXT,
      manual_minutes INTEGER,
      duration_minutes INTEGER NOT NULL CHECK(duration_minutes >= 0),
      billed_minutes INTEGER NOT NULL CHECK(billed_minutes >= 0),
      description TEXT NOT NULL,
      billable INTEGER NOT NULL CHECK(billable IN (0,1)),
      rate_centavos INTEGER NOT NULL CHECK(rate_centavos >= 0),
      amount_centavos INTEGER NOT NULL CHECK(amount_centavos >= 0),
      currency TEXT NOT NULL CHECK(currency='MXN'),
      source TEXT NOT NULL CHECK(source IN ('timer','manual')),
      billing_status TEXT NOT NULL CHECK(billing_status IN ('unbilled','billed')),
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS time_entries_scope ON time_entries(workspace_id,matter_id,created_at);
    CREATE INDEX IF NOT EXISTS time_entries_client_status ON time_entries(workspace_id,billing_status,created_at);
    CREATE TABLE IF NOT EXISTS active_timers (
      workspace_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      matter_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      accumulated_minutes INTEGER NOT NULL CHECK(accumulated_minutes >= 0),
      paused_at TEXT,
      state TEXT NOT NULL CHECK(state IN ('running','paused')),
      rate_centavos INTEGER NOT NULL CHECK(rate_centavos >= 0),
      billable INTEGER NOT NULL CHECK(billable IN (0,1)),
      description TEXT NOT NULL,
      currency TEXT NOT NULL CHECK(currency='MXN'),
      PRIMARY KEY(workspace_id,user_id)
    );
    CREATE TABLE IF NOT EXISTS fee_arrangements (
      workspace_id TEXT NOT NULL,
      matter_id TEXT NOT NULL,
      arrangement TEXT NOT NULL CHECK(arrangement IN ('hourly','fixed','retainer','contingency','pro-bono')),
      hourly_rate_centavos INTEGER CHECK(hourly_rate_centavos IS NULL OR hourly_rate_centavos >= 0),
      contingency_basis_points INTEGER CHECK(contingency_basis_points IS NULL OR (contingency_basis_points >= 0 AND contingency_basis_points <= 10000)),
      billing_increment_minutes INTEGER NOT NULL CHECK(billing_increment_minutes IN (1,6,15)),
      currency TEXT NOT NULL CHECK(currency='MXN'),
      updated_at TEXT NOT NULL,
      PRIMARY KEY(workspace_id,matter_id)
    );
    CREATE TABLE IF NOT EXISTS client_hourly_rates (
      workspace_id TEXT NOT NULL,
      client_name TEXT NOT NULL,
      hourly_rate_centavos INTEGER NOT NULL CHECK(hourly_rate_centavos >= 0),
      currency TEXT NOT NULL CHECK(currency='MXN'),
      updated_at TEXT NOT NULL,
      PRIMARY KEY(workspace_id,client_name)
    );
    CREATE TABLE IF NOT EXISTS matter_resolutions (
      workspace_id TEXT NOT NULL,
      matter_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('abierto','en-espera','resuelto','archivado')),
      outcome TEXT CHECK(outcome IS NULL OR outcome IN ('favorable','desfavorable','acuerdo','desistimiento','otro')),
      resolution_date TEXT,
      notes TEXT,
      resolved_at TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY(workspace_id,matter_id)
    );`);
  const schemaVersion=db.prepare('PRAGMA user_version').get().user_version;
  const legacyMatters=db.prepare("SELECT id,payload FROM records WHERE kind='matter'").all()
    .filter(row=>{try{return !Object.hasOwn(JSON.parse(row.payload),'counterparties');}catch{return false;}});
  // Version 3 adds explicit counterparties to the JSON matter record. Some development
  // databases were already marked v3 by the agent-action tables, so detect their absent
  // field as well; this remains a no-op after the field has been persisted once.
  if(schemaVersion<3||legacyMatters.length){
    db.exec('BEGIN IMMEDIATE');
    try {
      for(const row of legacyMatters){
        const matter=JSON.parse(row.payload);
        db.prepare('UPDATE records SET payload=? WHERE id=? AND kind=?').run(JSON.stringify({...matter,counterparties:[]}),row.id,'matter');
      }
      db.exec(`PRAGMA user_version=${Math.max(schemaVersion,3)}; COMMIT`);
    } catch(error) {db.exec('ROLLBACK');throw error;}
  }
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
    createTimeEntry(entry) {
      db.prepare(`INSERT INTO time_entries (id,workspace_id,matter_id,user_id,started_at,ended_at,manual_minutes,duration_minutes,billed_minutes,description,billable,rate_centavos,amount_centavos,currency,source,billing_status,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(entry.id,entry.workspaceId,entry.matterId,entry.userId,entry.startedAt,entry.endedAt,entry.manualMinutes,entry.durationMinutes,entry.billedMinutes,entry.description,entry.billable?1:0,entry.rateCentavos,entry.amountCentavos,entry.currency,entry.source,entry.billingStatus,entry.createdAt);
      return entry;
    },
    listTimeEntries(workspaceId,{matterId=null,billingStatus=null}={}) {
      const conditions=['workspace_id=?'],params=[workspaceId];
      if(matterId!==null){conditions.push('matter_id=?');params.push(matterId);}
      if(billingStatus!==null){conditions.push('billing_status=?');params.push(billingStatus);}
      return db.prepare(`SELECT id,workspace_id AS workspaceId,matter_id AS matterId,user_id AS userId,started_at AS startedAt,ended_at AS endedAt,manual_minutes AS manualMinutes,duration_minutes AS durationMinutes,billed_minutes AS billedMinutes,description,billable,rate_centavos AS rateCentavos,amount_centavos AS amountCentavos,currency,source,billing_status AS billingStatus,created_at AS createdAt FROM time_entries WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC,id DESC`).all(...params).map(row=>({...row,billable:Boolean(row.billable)}));
    },
    setTimeEntriesBillingStatus(workspaceId,matterId,entryIds,billingStatus) {
      if(!entryIds.length)return 0;
      const placeholders=entryIds.map(()=>'?').join(',');
      const result=db.prepare(`UPDATE time_entries SET billing_status=? WHERE workspace_id=? AND matter_id=? AND id IN (${placeholders})`).run(billingStatus,workspaceId,matterId,...entryIds);
      return result.changes;
    },
    getActiveTimer(workspaceId,userId) {
      return db.prepare('SELECT workspace_id AS workspaceId,user_id AS userId,matter_id AS matterId,started_at AS startedAt,accumulated_minutes AS accumulatedMinutes,paused_at AS pausedAt,state,rate_centavos AS rateCentavos,billable,description,currency FROM active_timers WHERE workspace_id=? AND user_id=?').get(workspaceId,userId) ?? null;
    },
    putActiveTimer(timer) {
      db.prepare(`INSERT INTO active_timers (workspace_id,user_id,matter_id,started_at,accumulated_minutes,paused_at,state,rate_centavos,billable,description,currency)
        VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(workspace_id,user_id) DO UPDATE SET matter_id=excluded.matter_id,started_at=excluded.started_at,accumulated_minutes=excluded.accumulated_minutes,paused_at=excluded.paused_at,state=excluded.state,rate_centavos=excluded.rate_centavos,billable=excluded.billable,description=excluded.description,currency=excluded.currency`).run(timer.workspaceId,timer.userId,timer.matterId,timer.startedAt,timer.accumulatedMinutes,timer.pausedAt,timer.state,timer.rateCentavos,timer.billable?1:0,timer.description,timer.currency);
      return timer;
    },
    deleteActiveTimer(workspaceId,userId) {
      return db.prepare('DELETE FROM active_timers WHERE workspace_id=? AND user_id=?').run(workspaceId,userId).changes;
    },
    getFeeArrangement(workspaceId,matterId) {
      return db.prepare('SELECT workspace_id AS workspaceId,matter_id AS matterId,arrangement,hourly_rate_centavos AS hourlyRateCentavos,contingency_basis_points AS contingencyBasisPoints,billing_increment_minutes AS billingIncrementMinutes,currency,updated_at AS updatedAt FROM fee_arrangements WHERE workspace_id=? AND matter_id=?').get(workspaceId,matterId) ?? null;
    },
    putFeeArrangement(item) {
      db.prepare(`INSERT INTO fee_arrangements (workspace_id,matter_id,arrangement,hourly_rate_centavos,contingency_basis_points,billing_increment_minutes,currency,updated_at)
        VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(workspace_id,matter_id) DO UPDATE SET arrangement=excluded.arrangement,hourly_rate_centavos=excluded.hourly_rate_centavos,contingency_basis_points=excluded.contingency_basis_points,billing_increment_minutes=excluded.billing_increment_minutes,currency=excluded.currency,updated_at=excluded.updated_at`).run(item.workspaceId,item.matterId,item.arrangement,item.hourlyRateCentavos,item.contingencyBasisPoints,item.billingIncrementMinutes,item.currency,item.updatedAt);
      return item;
    },
    getClientHourlyRate(workspaceId,clientName) {
      return db.prepare('SELECT workspace_id AS workspaceId,client_name AS clientName,hourly_rate_centavos AS hourlyRateCentavos,currency,updated_at AS updatedAt FROM client_hourly_rates WHERE workspace_id=? AND client_name=?').get(workspaceId,clientName) ?? null;
    },
    putClientHourlyRate(item) {
      db.prepare(`INSERT INTO client_hourly_rates (workspace_id,client_name,hourly_rate_centavos,currency,updated_at) VALUES (?,?,?,?,?)
        ON CONFLICT(workspace_id,client_name) DO UPDATE SET hourly_rate_centavos=excluded.hourly_rate_centavos,currency=excluded.currency,updated_at=excluded.updated_at`).run(item.workspaceId,item.clientName,item.hourlyRateCentavos,item.currency,item.updatedAt);
      return item;
    },
    getMatterResolution(workspaceId,matterId) {
      return db.prepare('SELECT workspace_id AS workspaceId,matter_id AS matterId,status,outcome,resolution_date AS resolutionDate,notes,resolved_at AS resolvedAt,updated_at AS updatedAt FROM matter_resolutions WHERE workspace_id=? AND matter_id=?').get(workspaceId,matterId) ?? null;
    },
    putMatterResolution(item) {
      db.prepare(`INSERT INTO matter_resolutions (workspace_id,matter_id,status,outcome,resolution_date,notes,resolved_at,updated_at) VALUES (?,?,?,?,?,?,?,?)
        ON CONFLICT(workspace_id,matter_id) DO UPDATE SET status=excluded.status,outcome=excluded.outcome,resolution_date=excluded.resolution_date,notes=excluded.notes,resolved_at=excluded.resolved_at,updated_at=excluded.updated_at`).run(item.workspaceId,item.matterId,item.status,item.outcome,item.resolutionDate,item.notes,item.resolvedAt,item.updatedAt);
      return item;
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
