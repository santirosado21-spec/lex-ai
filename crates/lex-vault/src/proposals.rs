//! Inactive matter-only data domain. Stored action names and JSON never execute capabilities.
use super::*;
use serde::Deserialize;
use serde_json::Value;
pub const PROPOSAL_CONTRACT_VERSION: &str = "h5b1-proposals-v1";
pub(crate) const SCHEMA: &str = "
CREATE TABLE agent_proposals(workspace TEXT NOT NULL,matter TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(workspace,matter,id));
CREATE TABLE agent_action_log(workspace TEXT NOT NULL,matter TEXT NOT NULL,revision INTEGER NOT NULL CHECK(revision>0),ordinal INTEGER NOT NULL CHECK(ordinal>=0 AND ordinal<100),operation TEXT NOT NULL CHECK(operation IN ('proposal.create','proposal.update','action.read')),payload TEXT NOT NULL,PRIMARY KEY(workspace,matter,revision,ordinal));";
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AgentProposal {
    pub id: String,
    pub workspace_id: String,
    pub matter_id: String,
    #[serde(deserialize_with = "nullable_string")]
    pub thread_id: Option<String>,
    pub action: String,
    pub args: Value,
    pub args_hash: String,
    pub origin: String,
    pub status: String,
    pub created_at: String,
    pub expires_at: String,
    #[serde(deserialize_with = "nullable_string")]
    pub decided_at: Option<String>,
    #[serde(deserialize_with = "nullable_value")]
    pub result: Option<Value>,
}
/// Only standalone read observations can be appended by callers. Proposal logs are derived.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AgentAction {
    pub workspace_id: String,
    pub matter_id: String,
    #[serde(deserialize_with = "nullable_string")]
    pub thread_id: Option<String>,
    #[serde(deserialize_with = "nullable_string")]
    pub proposal_id: Option<String>,
    pub origin: String,
    pub action: String,
    pub args_hash: String,
    pub decision: String,
    pub created_at: String,
}
#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AgentActionLog {
    pub revision: i64,
    pub ordinal: u32,
    pub operation: String,
    #[serde(flatten)]
    pub entry: AgentAction,
}
fn nullable_string<'de, D: serde::Deserializer<'de>>(
    d: D,
) -> std::result::Result<Option<String>, D::Error> {
    Option::deserialize(d)
}
fn nullable_value<'de, D: serde::Deserializer<'de>>(
    d: D,
) -> std::result::Result<Option<Value>, D::Error> {
    Option::deserialize(d)
}
fn matter(s: &Scope) -> Result<()> {
    if !s.thread.is_empty() {
        Err(Error::InvalidInput)
    } else {
        Ok(())
    }
}
fn text(s: &str, max: usize) -> bool {
    s.len() <= max && !s.contains('\0')
}
fn stamp(s: &str) -> bool {
    let b = s.as_bytes();
    if b.len() != 24 {
        return false;
    }
    let digits = |a: usize, z: usize| b[a..z].iter().all(u8::is_ascii_digit);
    if b[4] != b'-'
        || b[7] != b'-'
        || b[10] != b'T'
        || b[13] != b':'
        || b[16] != b':'
        || b[19] != b'.'
        || b[23] != b'Z'
        || ![
            (0, 4),
            (5, 7),
            (8, 10),
            (11, 13),
            (14, 16),
            (17, 19),
            (20, 23),
        ]
        .iter()
        .all(|&(a, z)| digits(a, z))
    {
        return false;
    }
    let n = |a: usize, z: usize| {
        b[a..z]
            .iter()
            .fold(0u32, |n, c| n * 10 + u32::from(c - b'0'))
    };
    let y = n(0, 4);
    let m = n(5, 7);
    let d = n(8, 10);
    let days = match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if y % 4 == 0 && (y % 100 != 0 || y % 400 == 0) {
                29
            } else {
                28
            }
        }
        _ => 0,
    };
    y > 0 && d > 0 && d <= days && n(11, 13) < 24 && n(14, 16) < 60 && n(17, 19) < 60
}
fn json_data(v: &Value, depth: usize, nodes: &mut usize) -> bool {
    *nodes += 1;
    if depth > 16 || *nodes > 4096 {
        return false;
    }
    match v {
        Value::String(x) => text(x, 16_000),
        Value::Array(xs) => xs.iter().all(|x| json_data(x, depth + 1, nodes)),
        Value::Object(xs) => xs
            .iter()
            .all(|(k, x)| text(k, 256) && json_data(x, depth + 1, nodes)),
        _ => true,
    }
}
fn bounded_json(v: &Value) -> bool {
    let mut nodes = 0;
    json_data(v, 0, &mut nodes) && serde_json::to_vec(v).is_ok_and(|x| x.len() <= 32_000)
}
fn hash(s: &str) -> bool {
    s.len() == 64
        && s.bytes()
            .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
}
fn origin(s: &str) -> bool {
    ["user", "agent"].contains(&s)
}
fn write_action(s: &str) -> bool {
    [
        "reminder.create",
        "document.import",
        "answer.export",
        "planner.propose",
    ]
    .contains(&s)
}
fn read_action(s: &str) -> bool {
    [
        "matter.list",
        "research.search",
        "reminder.list",
        "planner.today",
    ]
    .contains(&s)
}
fn proposal(s: &Scope, p: &AgentProposal) -> Result<()> {
    matter(s)?;
    if !identifier(&p.id)
        || p.workspace_id != s.workspace
        || p.matter_id != s.matter
        || p.thread_id.is_some()
        || !write_action(&p.action)
        || !p.args.is_object()
        || !bounded_json(&p.args)
        || !hash(&p.args_hash)
        || !origin(&p.origin)
        || !["pending", "approved", "rejected", "expired"].contains(&p.status.as_str())
        || !stamp(&p.created_at)
        || !stamp(&p.expires_at)
        || p.expires_at < p.created_at
        || p.decided_at
            .as_ref()
            .is_some_and(|x| !stamp(x) || x < &p.created_at)
        || p.result.as_ref().is_some_and(|x| !bounded_json(x))
        || ((p.status == "pending") != (p.decided_at.is_none() && p.result.is_none()))
    {
        return Err(Error::InvalidInput);
    }
    if p.status != "pending" && p.decided_at.is_none() {
        return Err(Error::InvalidInput);
    }
    Ok(())
}
fn action(s: &Scope, a: &AgentAction) -> Result<()> {
    matter(s)?;
    if a.workspace_id != s.workspace
        || a.matter_id != s.matter
        || a.thread_id.is_some()
        || a.proposal_id.is_some()
        || !read_action(&a.action)
        || !origin(&a.origin)
        || !hash(&a.args_hash)
        || a.decision != "auto-allowed"
        || !stamp(&a.created_at)
    {
        Err(Error::InvalidInput)
    } else {
        Ok(())
    }
}
fn encode<T: Serialize>(v: &T) -> Result<String> {
    serde_json::to_string(v).map_err(|_| Error::InvalidInput)
}
fn decode(p: String) -> Result<AgentProposal> {
    serde_json::from_str(&p).map_err(|_| Error::Storage)
}
fn immutable(old: &AgentProposal, new: &AgentProposal) -> bool {
    old.id == new.id
        && old.workspace_id == new.workspace_id
        && old.matter_id == new.matter_id
        && old.thread_id == new.thread_id
        && old.action == new.action
        && old.args == new.args
        && old.args_hash == new.args_hash
        && old.origin == new.origin
        && old.created_at == new.created_at
        && old.expires_at == new.expires_at
}
fn derived(p: &AgentProposal) -> AgentAction {
    AgentAction {
        workspace_id: p.workspace_id.clone(),
        matter_id: p.matter_id.clone(),
        thread_id: None,
        proposal_id: Some(p.id.clone()),
        origin: p.origin.clone(),
        action: p.action.clone(),
        args_hash: p.args_hash.clone(),
        decision: p.status.clone(),
        created_at: p.decided_at.clone().unwrap_or_else(|| p.created_at.clone()),
    }
}
fn append(
    c: &Connection,
    s: &Scope,
    a: &AgentAction,
    revision: i64,
    ordinal: usize,
    operation: &str,
) -> Result<()> {
    c.execute(
        "INSERT INTO agent_action_log VALUES(?,?,?,?,?,?)",
        params![
            s.workspace,
            s.matter,
            revision,
            ordinal as i64,
            operation,
            encode(a)?
        ],
    )?;
    Ok(())
}
fn page(limit: u32, offset: u32) -> Result<()> {
    if !(1..=100).contains(&limit) || offset > 1_000_000 {
        Err(Error::InvalidInput)
    } else {
        Ok(())
    }
}
impl Vault {
    /// One bounded transaction, no callback/SQL, no action execution. Approval side effects are absent.
    pub fn commit_agent_changes(
        &mut self,
        s: &Scope,
        creates: &[AgentProposal],
        updates: &[AgentProposal],
        actions: &[AgentAction],
        expected: i64,
    ) -> Result<i64> {
        self.conn()?;
        matter(s)?;
        let count = creates.len() + updates.len() + actions.len();
        if count == 0 || count > 100 || !(0..9_007_199_254_740_991).contains(&expected) {
            return Err(Error::InvalidInput);
        }
        for p in creates {
            proposal(s, p)?;
            if p.status != "pending" {
                return Err(Error::InvalidInput);
            }
        }
        for p in updates {
            proposal(s, p)?;
            if p.status == "pending" {
                return Err(Error::InvalidInput);
            }
        }
        for a in actions {
            action(s, a)?;
        }
        // Reject repeated proposal IDs even if the batch mixes create and transition.
        let mut ids = std::collections::HashSet::new();
        for p in creates.iter().chain(updates) {
            if !ids.insert(&p.id) {
                return Err(Error::InvalidInput);
            }
        }
        let tx = self
            .conn_mut()?
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let revision = advance(&tx, s, expected)?;
        let mut ordinal = 0;
        for p in creates {
            tx.execute(
                "INSERT INTO agent_proposals VALUES(?,?,?,?,?)",
                params![s.workspace, s.matter, p.id, encode(p)?, p.created_at],
            )?;
            append(&tx, s, &derived(p), revision, ordinal, "proposal.create")?;
            ordinal += 1;
        }
        for p in updates {
            let old: Option<String> = tx
                .query_row(
                    "SELECT payload FROM agent_proposals WHERE workspace=? AND matter=? AND id=?",
                    params![s.workspace, s.matter, p.id],
                    |r| r.get(0),
                )
                .optional()?;
            let old = decode(old.ok_or(Error::NotFound)?)?;
            if !immutable(&old, p) {
                return Err(Error::InvalidInput);
            }
            if old.status != "pending" {
                return Err(Error::Conflict);
            }
            tx.execute(
                "UPDATE agent_proposals SET payload=? WHERE workspace=? AND matter=? AND id=?",
                params![encode(p)?, s.workspace, s.matter, p.id],
            )?;
            append(&tx, s, &derived(p), revision, ordinal, "proposal.update")?;
            ordinal += 1;
        }
        for a in actions {
            append(&tx, s, a, revision, ordinal, "action.read")?;
            ordinal += 1;
        }
        tx.commit()?;
        Ok(revision)
    }
    pub fn create_agent_proposals(
        &mut self,
        s: &Scope,
        items: &[AgentProposal],
        expected: i64,
    ) -> Result<i64> {
        self.commit_agent_changes(s, items, &[], &[], expected)
    }
    pub fn update_agent_proposal(
        &mut self,
        s: &Scope,
        p: &AgentProposal,
        expected: i64,
    ) -> Result<i64> {
        self.commit_agent_changes(s, &[], std::slice::from_ref(p), &[], expected)
    }
    pub fn log_agent_action(&mut self, s: &Scope, a: &AgentAction, expected: i64) -> Result<i64> {
        self.commit_agent_changes(s, &[], &[], std::slice::from_ref(a), expected)
    }
    pub fn get_agent_proposal(&self, s: &Scope, id: &str) -> Result<Option<AgentProposal>> {
        self.conn()?;
        matter(s)?;
        if !identifier(id) {
            return Err(Error::InvalidInput);
        }
        let p: Option<String> = self
            .conn()?
            .query_row(
                "SELECT payload FROM agent_proposals WHERE workspace=? AND matter=? AND id=?",
                params![s.workspace, s.matter, id],
                |r| r.get(0),
            )
            .optional()?;
        p.map(decode).transpose()
    }
    pub fn list_agent_proposals(
        &self,
        s: &Scope,
        limit: u32,
        offset: u32,
    ) -> Result<Vec<AgentProposal>> {
        self.conn()?;
        matter(s)?;
        page(limit, offset)?;
        let rows=self.conn()?.prepare("SELECT payload FROM agent_proposals WHERE workspace=? AND matter=? ORDER BY created_at COLLATE BINARY,id COLLATE BINARY LIMIT ? OFFSET ?")?.query_map(params![s.workspace,s.matter,limit,offset],|r|r.get(0))?.collect::<rusqlite::Result<Vec<String>>>()?;
        rows.into_iter().map(decode).collect()
    }
    pub fn list_agent_action_log(
        &self,
        s: &Scope,
        limit: u32,
        offset: u32,
    ) -> Result<Vec<AgentActionLog>> {
        self.conn()?;
        matter(s)?;
        page(limit, offset)?;
        let rows=self.conn()?.prepare("SELECT revision,ordinal,operation,payload FROM agent_action_log WHERE workspace=? AND matter=? ORDER BY revision,ordinal LIMIT ? OFFSET ?")?.query_map(params![s.workspace,s.matter,limit,offset],|r|Ok((r.get::<_,i64>(0)?,r.get::<_,u32>(1)?,r.get::<_,String>(2)?,r.get::<_,String>(3)?)))?.collect::<rusqlite::Result<Vec<_>>>()?;
        rows.into_iter()
            .map(|(revision, ordinal, operation, payload)| {
                Ok(AgentActionLog {
                    revision,
                    ordinal,
                    operation,
                    entry: serde_json::from_str(&payload).map_err(|_| Error::Storage)?,
                })
            })
            .collect()
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn p() -> AgentProposal {
        serde_json::from_value(serde_json::json!({"id":"p","workspaceId":"w","matterId":"m","threadId":null,"action":"planner.propose","args":{},"argsHash":"a".repeat(64),"origin":"agent","status":"pending","createdAt":"2026-11-09T00:00:00.000Z","expiresAt":"2026-11-09T00:15:00.000Z","decidedAt":null,"result":null})).unwrap()
    }
    #[test]
    fn audit_constraint_rolls_back_creates_transitions_and_revision_after_reopen() {
        let key = KeyMaterial::generate().unwrap();
        let (f, mut v) = SyntheticVault::create(&key).unwrap();
        let s = Scope::new("w", "m", None).unwrap();
        let original = p();
        v.conn().unwrap().execute_batch("CREATE TRIGGER fail_agent_log BEFORE INSERT ON agent_action_log BEGIN SELECT RAISE(ABORT,'synthetic'); END;").unwrap();
        assert_eq!(
            v.create_agent_proposals(&s, &[original.clone()], 0),
            Err(Error::Storage)
        );
        v.close().unwrap();
        let mut v = f.reopen(Some(&key)).unwrap();
        assert_eq!(v.revision(&s).unwrap(), 0);
        assert!(v.get_agent_proposal(&s, "p").unwrap().is_none());
        v.conn()
            .unwrap()
            .execute_batch("DROP TRIGGER fail_agent_log")
            .unwrap();
        v.create_agent_proposals(&s, &[original.clone()], 0)
            .unwrap();
        v.conn().unwrap().execute_batch("CREATE TRIGGER fail_agent_log BEFORE INSERT ON agent_action_log BEGIN SELECT RAISE(ABORT,'synthetic'); END;").unwrap();
        let mut changed = original.clone();
        changed.status = "rejected".into();
        changed.decided_at = Some("2026-11-09T00:01:00.000Z".into());
        changed.result = Some(serde_json::json!({"reason":"synthetic"}));
        assert_eq!(
            v.update_agent_proposal(&s, &changed, 1),
            Err(Error::Storage)
        );
        v.close().unwrap();
        let v = f.reopen(Some(&key)).unwrap();
        assert_eq!(v.revision(&s).unwrap(), 1);
        assert_eq!(v.get_agent_proposal(&s, "p").unwrap(), Some(original));
        assert_eq!(v.list_agent_action_log(&s, 100, 0).unwrap().len(), 1);
    }
    #[test]
    fn unsupported_schema_reopen_rejected() {
        let key = KeyMaterial::generate().unwrap();
        let (f, mut v) = SyntheticVault::create(&key).unwrap();
        v.conn()
            .unwrap()
            .execute_batch("PRAGMA user_version=2")
            .unwrap();
        v.close().unwrap();
        assert!(matches!(f.reopen(Some(&key)), Err(Error::CannotOpen)));
    }
}
