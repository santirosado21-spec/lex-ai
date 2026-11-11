//! Inactive reminder domain v1: exact matter scope, atomic bounded writes and internal audit.
use super::*;
use serde::Deserialize;

pub const REMINDER_CONTRACT_VERSION: &str = "h5b1-reminders-v1";
pub(crate) const SCHEMA: &str = "
CREATE TABLE reminders(workspace TEXT NOT NULL,matter TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,due_at TEXT,title TEXT NOT NULL,PRIMARY KEY(workspace,matter,id));
CREATE TABLE reminder_audit(workspace TEXT NOT NULL,matter TEXT NOT NULL,revision INTEGER NOT NULL CHECK(revision>0),ordinal INTEGER NOT NULL CHECK(ordinal>=0 AND ordinal<100),operation TEXT NOT NULL CHECK(operation IN ('reminder.create','planner.propose','reminder.update')),reminder_id TEXT NOT NULL,PRIMARY KEY(workspace,matter,revision,ordinal),FOREIGN KEY(workspace,matter,reminder_id) REFERENCES reminders(workspace,matter,id));";

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Reminder {
    pub id: String,
    pub workspace_id: String,
    pub matter_id: String,
    #[serde(deserialize_with = "required_nullable")]
    pub thread_id: Option<String>,
    pub kind: String,
    pub title: String,
    #[serde(deserialize_with = "required_nullable")]
    pub due_at: Option<String>,
    pub note: String,
    pub status: String,
    pub source: String,
    pub created_at: String,
    pub updated_at: String,
    #[serde(deserialize_with = "required_nullable")]
    pub planner_rule: Option<String>,
}
fn required_nullable<'de, D: serde::Deserializer<'de>>(
    deserializer: D,
) -> std::result::Result<Option<String>, D::Error> {
    Option::<String>::deserialize(deserializer)
}
#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReminderAudit {
    pub workspace_id: String,
    pub matter_id: String,
    pub revision: i64,
    pub ordinal: u32,
    pub operation: String,
    pub reminder_id: String,
}
fn matter(s: &Scope) -> Result<()> {
    if !s.thread.is_empty() {
        Err(Error::InvalidInput)
    } else {
        Ok(())
    }
}
fn text(s: &str, min: usize, max: usize) -> bool {
    s.len() >= min && s.len() <= max && !s.contains('\0')
}
// No timezone normalization: v1 deliberately requires canonical UTC timestamps.
fn date(s: &str, timestamp: bool) -> bool {
    let b = s.as_bytes();
    if !(b.len() == 24 || (!timestamp && b.len() == 10)) {
        return false;
    }
    let digits = |start: usize, end: usize| b[start..end].iter().all(u8::is_ascii_digit);
    if b[4] != b'-' || b[7] != b'-' || !digits(0, 4) || !digits(5, 7) || !digits(8, 10) {
        return false;
    }
    let num = |start: usize, end: usize| {
        b[start..end]
            .iter()
            .fold(0u32, |n, c| n * 10 + u32::from(c - b'0'))
    };
    let y = num(0, 4);
    let m = num(5, 7);
    let d = num(8, 10);
    let leap = y % 4 == 0 && (y % 100 != 0 || y % 400 == 0);
    let days = match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if leap {
                29
            } else {
                28
            }
        }
        _ => 0,
    };
    if y == 0 || d == 0 || d > days {
        return false;
    }
    b.len() == 10
        || (b[10] == b'T'
            && b[13] == b':'
            && b[16] == b':'
            && b[19] == b'.'
            && b[23] == b'Z'
            && digits(11, 13)
            && digits(14, 16)
            && digits(17, 19)
            && digits(20, 23)
            && num(11, 13) < 24
            && num(14, 16) < 60
            && num(17, 19) < 60)
}
fn validate(s: &Scope, r: &Reminder) -> Result<()> {
    matter(s)?;
    if !identifier(&r.id)
        || r.workspace_id != s.workspace
        || r.matter_id != s.matter
        || r.thread_id.is_some()
        || !["deadline", "followup", "draft-suggestion"].contains(&r.kind.as_str())
        || !["proposed", "approved", "done", "dismissed"].contains(&r.status.as_str())
        || !["user", "planner"].contains(&r.source.as_str())
        || !text(&r.title, 1, 800)
        || !text(&r.note, 0, 16_000)
        || r.planner_rule.as_ref().is_some_and(|x| !text(x, 1, 256))
        || r.due_at.as_ref().is_some_and(|x| !date(x, false))
        || !date(&r.created_at, true)
        || !date(&r.updated_at, true)
    {
        return Err(Error::InvalidInput);
    }
    Ok(())
}
fn encode(r: &Reminder) -> Result<String> {
    serde_json::to_string(r).map_err(|_| Error::InvalidInput)
}
fn decode(p: String) -> Result<Reminder> {
    serde_json::from_str(&p).map_err(|_| Error::Storage)
}
fn audit(
    c: &Connection,
    s: &Scope,
    r: &Reminder,
    revision: i64,
    ordinal: usize,
    update: bool,
) -> Result<()> {
    let op = if update {
        "reminder.update"
    } else if r.source == "planner" {
        "planner.propose"
    } else {
        "reminder.create"
    };
    c.execute(
        "INSERT INTO reminder_audit VALUES(?,?,?,?,?,?)",
        params![s.workspace, s.matter, revision, ordinal as i64, op, r.id],
    )?;
    Ok(())
}
fn expected(n: i64) -> Result<()> {
    if !(0..9_007_199_254_740_991).contains(&n) {
        Err(Error::InvalidInput)
    } else {
        Ok(())
    }
}
impl Vault {
    pub fn create_reminders(
        &mut self,
        s: &Scope,
        items: &[Reminder],
        expected_revision: i64,
    ) -> Result<i64> {
        self.conn()?;
        matter(s)?;
        expected(expected_revision)?;
        if items.is_empty() || items.len() > 100 {
            return Err(Error::InvalidInput);
        }
        for r in items {
            validate(s, r)?;
        }
        let tx = self
            .conn_mut()?
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let revision = advance(&tx, s, expected_revision)?;
        for (i, r) in items.iter().enumerate() {
            tx.execute(
                "INSERT INTO reminders VALUES(?,?,?,?,?,?)",
                params![s.workspace, s.matter, r.id, encode(r)?, r.due_at, r.title],
            )?;
            audit(&tx, s, r, revision, i, false)?;
        }
        tx.commit()?;
        Ok(revision)
    }
    pub fn get_reminder(&self, s: &Scope, id: &str) -> Result<Option<Reminder>> {
        self.conn()?;
        matter(s)?;
        if !identifier(id) {
            return Err(Error::InvalidInput);
        }
        let p: Option<String> = self
            .conn()?
            .query_row(
                "SELECT payload FROM reminders WHERE workspace=? AND matter=? AND id=?",
                params![s.workspace, s.matter, id],
                |r| r.get(0),
            )
            .optional()?;
        p.map(decode).transpose()
    }
    /// Offset pages are deterministic within a revision; caller restarts on revision change.
    pub fn list_reminders(&self, s: &Scope, limit: u32, offset: u32) -> Result<Vec<Reminder>> {
        self.conn()?;
        matter(s)?;
        if !(1..=100).contains(&limit) || offset > 1_000_000 {
            return Err(Error::InvalidInput);
        }
        let rows=self.conn()?.prepare("SELECT payload FROM reminders WHERE workspace=? AND matter=? ORDER BY due_at IS NULL,due_at COLLATE BINARY,title COLLATE BINARY,id COLLATE BINARY LIMIT ? OFFSET ?")?.query_map(params![s.workspace,s.matter,limit,offset],|r|r.get(0))?.collect::<rusqlite::Result<Vec<String>>>()?;
        rows.into_iter().map(decode).collect()
    }
    pub fn update_reminder(
        &mut self,
        s: &Scope,
        r: &Reminder,
        expected_revision: i64,
    ) -> Result<i64> {
        self.conn()?;
        validate(s, r)?;
        expected(expected_revision)?;
        let tx = self
            .conn_mut()?
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let revision = advance(&tx, s, expected_revision)?;
        let old: Option<String> = tx
            .query_row(
                "SELECT payload FROM reminders WHERE workspace=? AND matter=? AND id=?",
                params![s.workspace, s.matter, r.id],
                |r| r.get(0),
            )
            .optional()?;
        let old = decode(old.ok_or(Error::NotFound)?)?;
        if old.created_at != r.created_at {
            return Err(Error::InvalidInput);
        }
        tx.execute("UPDATE reminders SET payload=?,due_at=?,title=? WHERE workspace=? AND matter=? AND id=?",params![encode(r)?,r.due_at,r.title,s.workspace,s.matter,r.id])?;
        audit(&tx, s, r, revision, 0, true)?;
        tx.commit()?;
        Ok(revision)
    }
    /// Read-only domain evidence; no arbitrary audit writer or callback transaction API.
    pub fn list_reminder_audits(
        &self,
        s: &Scope,
        limit: u32,
        offset: u32,
    ) -> Result<Vec<ReminderAudit>> {
        self.conn()?;
        matter(s)?;
        if !(1..=100).contains(&limit) || offset > 1_000_000 {
            return Err(Error::InvalidInput);
        }
        Ok(self.conn()?.prepare("SELECT workspace,matter,revision,ordinal,operation,reminder_id FROM reminder_audit WHERE workspace=? AND matter=? ORDER BY revision,ordinal LIMIT ? OFFSET ?")?.query_map(params![s.workspace,s.matter,limit,offset],|r|Ok(ReminderAudit{workspace_id:r.get(0)?,matter_id:r.get(1)?,revision:r.get(2)?,ordinal:r.get(3)?,operation:r.get(4)?,reminder_id:r.get(5)?}))?.collect::<rusqlite::Result<_>>()?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn item() -> Reminder {
        serde_json::from_value(serde_json::json!({"id":"r","workspaceId":"w","matterId":"m","threadId":null,"kind":"followup","title":"synthetic","dueAt":null,"note":"","status":"approved","source":"user","createdAt":"2026-11-09T00:00:00.000Z","updatedAt":"2026-11-09T00:00:00.000Z","plannerRule":null})).unwrap()
    }
    #[test]
    fn audit_constraint_rolls_back_both_create_and_update_after_reopen() {
        let key = KeyMaterial::generate().unwrap();
        let (f, mut v) = SyntheticVault::create(&key).unwrap();
        let s = Scope::new("w", "m", None).unwrap();
        let r = item();
        v.conn().unwrap().execute_batch("CREATE TRIGGER audit_failure BEFORE INSERT ON reminder_audit BEGIN SELECT RAISE(ABORT,'synthetic'); END;").unwrap();
        assert_eq!(v.create_reminders(&s, &[r.clone()], 0), Err(Error::Storage));
        assert_eq!(v.revision(&s).unwrap(), 0);
        assert!(v.get_reminder(&s, "r").unwrap().is_none());
        v.conn()
            .unwrap()
            .execute_batch("DROP TRIGGER audit_failure")
            .unwrap();
        v.create_reminders(&s, &[r.clone()], 0).unwrap();
        v.conn().unwrap().execute_batch("CREATE TRIGGER audit_failure BEFORE INSERT ON reminder_audit BEGIN SELECT RAISE(ABORT,'synthetic'); END;").unwrap();
        let mut changed = r.clone();
        changed.status = "done".into();
        assert_eq!(v.update_reminder(&s, &changed, 1), Err(Error::Storage));
        v.close().unwrap();
        let v = f.reopen(Some(&key)).unwrap();
        assert_eq!(v.revision(&s).unwrap(), 1);
        assert_eq!(v.get_reminder(&s, "r").unwrap(), Some(r));
        assert_eq!(v.list_reminder_audits(&s, 100, 0).unwrap().len(), 1);
    }
}
