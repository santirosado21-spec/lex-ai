//! Inactive exact-decimal storage domain. No pricing, rounding, invoices or elapsed-time calculation.
use super::*;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Deserializer};
pub const TIME_BILLING_CONTRACT_VERSION: &str = "h5b1-time-billing-decimal-v1";
const MAX_MINOR: u64 = 9_007_199_254_740_991;
pub(crate) const SCHEMA: &str = "
CREATE TABLE billing_records(workspace TEXT NOT NULL,matter TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('entry','timer','fee','rate','resolution')),id TEXT NOT NULL,payload TEXT NOT NULL,sort_key TEXT NOT NULL,PRIMARY KEY(workspace,matter,kind,id));
CREATE TABLE billing_audit(workspace TEXT NOT NULL,matter TEXT NOT NULL,revision INTEGER NOT NULL CHECK(revision>0),ordinal INTEGER NOT NULL CHECK(ordinal>=0 AND ordinal<100),operation TEXT NOT NULL CHECK(operation IN ('time.create','time.status','timer.put','timer.delete','timer.stop','fee.put','rate.put','resolution.put')),record_id TEXT NOT NULL,PRIMARY KEY(workspace,matter,revision,ordinal));";
#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(transparent)]
pub struct Money(String);
impl Money {
    pub fn new(value: &str) -> Result<Self> {
        let (major, minor) = value.split_once('.').ok_or(Error::InvalidInput)?;
        if major.is_empty()
            || major.len() > 14
            || minor.len() != 2
            || major.len() > 1 && major.starts_with('0')
            || !major
                .bytes()
                .chain(minor.bytes())
                .all(|c| c.is_ascii_digit())
        {
            return Err(Error::InvalidInput);
        }
        let whole = major.parse::<u64>().map_err(|_| Error::InvalidInput)?;
        let cents = minor.parse::<u64>().map_err(|_| Error::InvalidInput)?;
        if whole
            .checked_mul(100)
            .and_then(|v| v.checked_add(cents))
            .is_none_or(|v| v > MAX_MINOR)
        {
            return Err(Error::InvalidInput);
        }
        Ok(Self(value.into()))
    }
    pub fn as_str(&self) -> &str {
        &self.0
    }
    fn zero(&self) -> bool {
        self.0 == "0.00"
    }
}
impl<'de> Deserialize<'de> for Money {
    fn deserialize<D: Deserializer<'de>>(d: D) -> std::result::Result<Self, D::Error> {
        let s = String::deserialize(d)?;
        Self::new(&s).map_err(|_| serde::de::Error::custom("invalid_money"))
    }
}
fn nullable<'de, D: Deserializer<'de>, T: Deserialize<'de>>(
    d: D,
) -> std::result::Result<Option<T>, D::Error> {
    Option::deserialize(d)
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TimeEntry {
    pub id: String,
    pub workspace_id: String,
    pub matter_id: String,
    #[serde(deserialize_with = "nullable")]
    pub thread_id: Option<String>,
    pub user_id: String,
    #[serde(deserialize_with = "nullable")]
    pub started_at: Option<String>,
    #[serde(deserialize_with = "nullable")]
    pub ended_at: Option<String>,
    #[serde(deserialize_with = "nullable")]
    pub manual_minutes: Option<u32>,
    pub duration_minutes: u32,
    pub billed_minutes: u32,
    pub description: String,
    pub billable: bool,
    pub rate_amount: Money,
    pub amount: Money,
    pub currency: String,
    pub source: String,
    pub billing_status: String,
    pub created_at: String,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ActiveTimer {
    pub workspace_id: String,
    pub matter_id: String,
    #[serde(deserialize_with = "nullable")]
    pub thread_id: Option<String>,
    pub user_id: String,
    pub started_at: String,
    pub accumulated_minutes: u32,
    #[serde(deserialize_with = "nullable")]
    pub paused_at: Option<String>,
    pub state: String,
    pub rate_amount: Money,
    pub billable: bool,
    pub description: String,
    pub currency: String,
    pub created_at: String,
    pub updated_at: String,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FeeArrangement {
    pub workspace_id: String,
    pub matter_id: String,
    #[serde(deserialize_with = "nullable")]
    pub thread_id: Option<String>,
    pub arrangement: String,
    #[serde(deserialize_with = "nullable")]
    pub hourly_rate_amount: Option<Money>,
    #[serde(deserialize_with = "nullable")]
    pub contingency_basis_points: Option<u32>,
    pub billing_increment_minutes: u32,
    pub currency: String,
    pub created_at: String,
    pub updated_at: String,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ClientHourlyRate {
    pub workspace_id: String,
    pub matter_id: String,
    #[serde(deserialize_with = "nullable")]
    pub thread_id: Option<String>,
    pub client_id: String,
    pub client_name: String,
    pub hourly_rate_amount: Money,
    pub currency: String,
    pub created_at: String,
    pub updated_at: String,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MatterResolution {
    pub workspace_id: String,
    pub matter_id: String,
    #[serde(deserialize_with = "nullable")]
    pub thread_id: Option<String>,
    pub status: String,
    #[serde(deserialize_with = "nullable")]
    pub outcome: Option<String>,
    #[serde(deserialize_with = "nullable")]
    pub resolution_date: Option<String>,
    #[serde(deserialize_with = "nullable")]
    pub notes: Option<String>,
    #[serde(deserialize_with = "nullable")]
    pub resolved_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BillingStatusChange {
    pub entry_ids: Vec<String>,
    pub billing_status: String,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TimerKey {
    pub user_id: String,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TimerStop {
    pub user_id: String,
    pub entry: TimeEntry,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(
    tag = "operation",
    content = "item",
    rename_all = "camelCase",
    deny_unknown_fields
)]
pub enum TimeBillingChange {
    CreateEntry(TimeEntry),
    SetBillingStatus(BillingStatusChange),
    PutTimer(ActiveTimer),
    DeleteTimer(TimerKey),
    StopTimer(TimerStop),
    PutFee(FeeArrangement),
    PutRate(ClientHourlyRate),
    PutResolution(MatterResolution),
}
#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TimeBillingAudit {
    pub workspace_id: String,
    pub matter_id: String,
    pub revision: i64,
    pub ordinal: u32,
    pub operation: String,
    pub record_id: String,
}
fn matter(s: &Scope) -> Result<()> {
    if s.thread.is_empty() {
        Ok(())
    } else {
        Err(Error::InvalidInput)
    }
}
fn scoped(s: &Scope, w: &str, m: &str, t: &Option<String>) -> bool {
    s.thread.is_empty() && s.workspace == w && s.matter == m && t.is_none()
}
fn text(s: &str, min: usize, max: usize) -> bool {
    s.len() >= min && s.len() <= max && !s.contains('\0')
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
fn date(s: &str) -> bool {
    s.len() == 10 && stamp(&format!("{s}T00:00:00.000Z"))
}
fn dates(created: &str, updated: &str) -> bool {
    stamp(created) && stamp(updated) && updated >= created
}
fn status(s: &str) -> bool {
    ["unbilled", "billed"].contains(&s)
}
fn entry(s: &Scope, e: &TimeEntry) -> Result<()> {
    if !scoped(s, &e.workspace_id, &e.matter_id, &e.thread_id)
        || !identifier(&e.id)
        || !identifier(&e.user_id)
        || !text(&e.description, 1, 2400)
        || e.duration_minutes > 10080
        || e.billed_minutes > 10080
        || e.currency != "MXN"
        || !status(&e.billing_status)
        || !stamp(&e.created_at)
        || !e.billable && (e.billed_minutes != 0 || !e.rate_amount.zero() || !e.amount.zero())
    {
        return Err(Error::InvalidInput);
    }
    match e.source.as_str() {
        "manual"
            if e.started_at.is_none()
                && e.ended_at.is_none()
                && e.manual_minutes == Some(e.duration_minutes) => {}
        "timer" if e.manual_minutes.is_none() => match (&e.started_at, &e.ended_at) {
            (Some(a), Some(b)) if stamp(a) && stamp(b) && b >= a && e.created_at >= *b => {}
            _ => return Err(Error::InvalidInput),
        },
        _ => return Err(Error::InvalidInput),
    }
    Ok(())
}
fn timer(s: &Scope, t: &ActiveTimer) -> Result<()> {
    if !scoped(s, &t.workspace_id, &t.matter_id, &t.thread_id)
        || !identifier(&t.user_id)
        || !text(&t.description, 1, 2400)
        || t.accumulated_minutes > 10080
        || t.currency != "MXN"
        || !dates(&t.created_at, &t.updated_at)
        || !stamp(&t.started_at)
        || t.started_at < t.created_at
        || t.started_at > t.updated_at
        || !t.billable && !t.rate_amount.zero()
    {
        return Err(Error::InvalidInput);
    }
    match (t.state.as_str(), &t.paused_at) {
        ("running", None) => {}
        ("paused", Some(p)) if stamp(p) && p >= &t.started_at && p <= &t.updated_at => {}
        _ => return Err(Error::InvalidInput),
    }
    Ok(())
}
fn fee(s: &Scope, f: &FeeArrangement) -> Result<()> {
    if !scoped(s, &f.workspace_id, &f.matter_id, &f.thread_id)
        || !["hourly", "fixed", "retainer", "contingency", "pro-bono"]
            .contains(&f.arrangement.as_str())
        || ![1, 6, 15].contains(&f.billing_increment_minutes)
        || f.currency != "MXN"
        || !dates(&f.created_at, &f.updated_at)
        || f.arrangement != "hourly" && f.hourly_rate_amount.is_some()
        || if f.arrangement == "contingency" {
            f.contingency_basis_points.is_none_or(|v| v > 10000)
        } else {
            f.contingency_basis_points.is_some()
        }
    {
        return Err(Error::InvalidInput);
    }
    Ok(())
}
fn rate(s: &Scope, r: &ClientHourlyRate) -> Result<()> {
    if !scoped(s, &r.workspace_id, &r.matter_id, &r.thread_id)
        || !identifier(&r.client_id)
        || !text(&r.client_name, 1, 800)
        || r.currency != "MXN"
        || !dates(&r.created_at, &r.updated_at)
    {
        Err(Error::InvalidInput)
    } else {
        Ok(())
    }
}
fn resolution(s: &Scope, r: &MatterResolution) -> Result<()> {
    if !scoped(s, &r.workspace_id, &r.matter_id, &r.thread_id)
        || !["abierto", "en-espera", "resuelto", "archivado"].contains(&r.status.as_str())
        || !dates(&r.created_at, &r.updated_at)
        || r.notes.as_ref().is_some_and(|v| !text(v, 0, 8000))
    {
        return Err(Error::InvalidInput);
    }
    if r.status == "resuelto" {
        if r.outcome.as_ref().is_none_or(|v| {
            ![
                "favorable",
                "desfavorable",
                "acuerdo",
                "desistimiento",
                "otro",
            ]
            .contains(&v.as_str())
        }) || r.resolution_date.as_ref().is_none_or(|v| !date(v))
            || r.resolved_at
                .as_ref()
                .is_none_or(|v| !stamp(v) || v < &r.created_at || v > &r.updated_at)
        {
            return Err(Error::InvalidInput);
        }
    } else if r.outcome.is_some()
        || r.resolution_date.is_some()
        || r.notes.is_some()
        || r.resolved_at.is_some()
    {
        return Err(Error::InvalidInput);
    }
    Ok(())
}
fn valid_change(s: &Scope, c: &TimeBillingChange) -> Result<usize> {
    use TimeBillingChange::*;
    match c {
        CreateEntry(e) => entry(s, e)?,
        PutTimer(t) => timer(s, t)?,
        PutFee(f) => fee(s, f)?,
        PutRate(r) => rate(s, r)?,
        PutResolution(r) => resolution(s, r)?,
        DeleteTimer(k) => {
            if !identifier(&k.user_id) {
                return Err(Error::InvalidInput);
            }
        }
        StopTimer(v) => {
            entry(s, &v.entry)?;
            if !identifier(&v.user_id) || v.entry.user_id != v.user_id || v.entry.source != "timer"
            {
                return Err(Error::InvalidInput);
            }
        }
        SetBillingStatus(v) => {
            if v.entry_ids.is_empty()
                || v.entry_ids.len() > 100
                || !status(&v.billing_status)
                || v.entry_ids.iter().any(|s| !identifier(s))
                || v.entry_ids
                    .iter()
                    .collect::<std::collections::HashSet<_>>()
                    .len()
                    != v.entry_ids.len()
            {
                return Err(Error::InvalidInput);
            }
            return Ok(v.entry_ids.len());
        }
    }
    Ok(1)
}
fn get<T: DeserializeOwned>(c: &Connection, s: &Scope, kind: &str, id: &str) -> Result<Option<T>> {
    let p:Option<String>=c.query_row("SELECT payload FROM billing_records WHERE workspace=? AND matter=? AND kind=? AND id=?",params![s.workspace,s.matter,kind,id],|r|r.get(0)).optional()?;
    p.map(|p| serde_json::from_str(&p).map_err(|_| Error::Storage))
        .transpose()
}
fn put<T: Serialize>(
    c: &Connection,
    s: &Scope,
    kind: &str,
    id: &str,
    v: &T,
    sort: &str,
    insert: bool,
) -> Result<()> {
    let payload = serde_json::to_string(v).map_err(|_| Error::InvalidInput)?;
    let sql = if insert {
        "INSERT INTO billing_records VALUES(?,?,?,?,?,?)"
    } else {
        "INSERT INTO billing_records VALUES(?,?,?,?,?,?) ON CONFLICT(workspace,matter,kind,id) DO UPDATE SET payload=excluded.payload,sort_key=excluded.sort_key"
    };
    c.execute(sql, params![s.workspace, s.matter, kind, id, payload, sort])?;
    Ok(())
}
fn remove(c: &Connection, s: &Scope, user: &str) -> Result<()> {
    if c.execute(
        "DELETE FROM billing_records WHERE workspace=? AND matter=? AND kind='timer' AND id=?",
        params![s.workspace, s.matter, user],
    )? != 1
    {
        return Err(Error::NotFound);
    }
    Ok(())
}
fn immutable(
    c: &Connection,
    s: &Scope,
    kind: &str,
    id: &str,
    created: &str,
    updated: &str,
) -> Result<()> {
    if let Some(v) = get::<serde_json::Value>(c, s, kind, id)? {
        if v["createdAt"].as_str() != Some(created) {
            return Err(Error::InvalidInput);
        }
        if v["updatedAt"].as_str().is_none_or(|old| updated < old) {
            return Err(Error::InvalidInput);
        }
    }
    Ok(())
}
fn audit(
    c: &Connection,
    s: &Scope,
    revision: i64,
    ordinal: &mut u32,
    operation: &str,
    id: &str,
) -> Result<()> {
    c.execute(
        "INSERT INTO billing_audit VALUES(?,?,?,?,?,?)",
        params![s.workspace, s.matter, revision, *ordinal, operation, id],
    )?;
    *ordinal += 1;
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
    pub fn commit_time_billing(
        &mut self,
        s: &Scope,
        changes: &[TimeBillingChange],
        expected: i64,
    ) -> Result<i64> {
        self.conn()?;
        matter(s)?;
        if changes.is_empty() || changes.len() > 100 || !(0..MAX_MINOR as i64).contains(&expected) {
            return Err(Error::InvalidInput);
        }
        let mut count = 0usize;
        for c in changes {
            count = count
                .checked_add(valid_change(s, c)?)
                .ok_or(Error::InvalidInput)?;
            if count > 100 {
                return Err(Error::InvalidInput);
            }
        }
        let tx = self
            .conn_mut()?
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let revision = advance(&tx, s, expected)?;
        let mut ordinal = 0;
        use TimeBillingChange::*;
        for change in changes {
            match change {
                CreateEntry(e) => {
                    put(&tx, s, "entry", &e.id, e, &e.created_at, true)?;
                    audit(&tx, s, revision, &mut ordinal, "time.create", &e.id)?;
                }
                SetBillingStatus(v) => {
                    for id in &v.entry_ids {
                        let mut e: TimeEntry = get(&tx, s, "entry", id)?.ok_or(Error::NotFound)?;
                        e.billing_status = v.billing_status.clone();
                        put(&tx, s, "entry", id, &e, &e.created_at, false)?;
                        audit(&tx, s, revision, &mut ordinal, "time.status", id)?;
                    }
                }
                PutTimer(t) => {
                    immutable(&tx, s, "timer", &t.user_id, &t.created_at, &t.updated_at)?;
                    put(&tx, s, "timer", &t.user_id, t, &t.created_at, false)?;
                    audit(&tx, s, revision, &mut ordinal, "timer.put", &t.user_id)?;
                }
                DeleteTimer(k) => {
                    remove(&tx, s, &k.user_id)?;
                    audit(&tx, s, revision, &mut ordinal, "timer.delete", &k.user_id)?;
                }
                StopTimer(v) => {
                    let t: ActiveTimer =
                        get(&tx, s, "timer", &v.user_id)?.ok_or(Error::NotFound)?;
                    let e = &v.entry;
                    if e.started_at.as_ref() != Some(&t.started_at)
                        || e.rate_amount != t.rate_amount
                        || e.billable != t.billable
                        || e.currency != t.currency
                        || e.duration_minutes < t.accumulated_minutes
                        || e.ended_at.as_ref().is_none_or(|end| end < &t.updated_at)
                    {
                        return Err(Error::InvalidInput);
                    }
                    put(&tx, s, "entry", &e.id, e, &e.created_at, true)?;
                    remove(&tx, s, &v.user_id)?;
                    audit(&tx, s, revision, &mut ordinal, "timer.stop", &e.id)?;
                }
                PutFee(f) => {
                    immutable(&tx, s, "fee", "singleton", &f.created_at, &f.updated_at)?;
                    put(&tx, s, "fee", "singleton", f, &f.created_at, false)?;
                    audit(&tx, s, revision, &mut ordinal, "fee.put", "singleton")?;
                }
                PutRate(r) => {
                    immutable(&tx, s, "rate", &r.client_id, &r.created_at, &r.updated_at)?;
                    put(&tx, s, "rate", &r.client_id, r, &r.created_at, false)?;
                    audit(&tx, s, revision, &mut ordinal, "rate.put", &r.client_id)?;
                }
                PutResolution(r) => {
                    immutable(
                        &tx,
                        s,
                        "resolution",
                        "singleton",
                        &r.created_at,
                        &r.updated_at,
                    )?;
                    put(&tx, s, "resolution", "singleton", r, &r.created_at, false)?;
                    audit(
                        &tx,
                        s,
                        revision,
                        &mut ordinal,
                        "resolution.put",
                        "singleton",
                    )?;
                }
            }
        }
        tx.commit()?;
        Ok(revision)
    }
    pub fn create_time_entry(&mut self, s: &Scope, e: &TimeEntry, expected: i64) -> Result<i64> {
        self.commit_time_billing(s, &[TimeBillingChange::CreateEntry(e.clone())], expected)
    }
    pub fn set_time_entries_billing_status(
        &mut self,
        s: &Scope,
        ids: &[String],
        status: &str,
        expected: i64,
    ) -> Result<i64> {
        self.commit_time_billing(
            s,
            &[TimeBillingChange::SetBillingStatus(BillingStatusChange {
                entry_ids: ids.to_vec(),
                billing_status: status.into(),
            })],
            expected,
        )
    }
    pub fn put_active_timer(&mut self, s: &Scope, t: &ActiveTimer, expected: i64) -> Result<i64> {
        self.commit_time_billing(s, &[TimeBillingChange::PutTimer(t.clone())], expected)
    }
    pub fn delete_active_timer(&mut self, s: &Scope, user: &str, expected: i64) -> Result<i64> {
        self.commit_time_billing(
            s,
            &[TimeBillingChange::DeleteTimer(TimerKey {
                user_id: user.into(),
            })],
            expected,
        )
    }
    pub fn stop_timer(
        &mut self,
        s: &Scope,
        user: &str,
        e: &TimeEntry,
        expected: i64,
    ) -> Result<i64> {
        self.commit_time_billing(
            s,
            &[TimeBillingChange::StopTimer(TimerStop {
                user_id: user.into(),
                entry: e.clone(),
            })],
            expected,
        )
    }
    pub fn put_fee_arrangement(
        &mut self,
        s: &Scope,
        f: &FeeArrangement,
        expected: i64,
    ) -> Result<i64> {
        self.commit_time_billing(s, &[TimeBillingChange::PutFee(f.clone())], expected)
    }
    pub fn put_client_hourly_rate(
        &mut self,
        s: &Scope,
        r: &ClientHourlyRate,
        expected: i64,
    ) -> Result<i64> {
        self.commit_time_billing(s, &[TimeBillingChange::PutRate(r.clone())], expected)
    }
    pub fn put_matter_resolution(
        &mut self,
        s: &Scope,
        r: &MatterResolution,
        expected: i64,
    ) -> Result<i64> {
        self.commit_time_billing(s, &[TimeBillingChange::PutResolution(r.clone())], expected)
    }
    pub fn get_time_entry(&self, s: &Scope, id: &str) -> Result<Option<TimeEntry>> {
        self.conn()?;
        matter(s)?;
        if !identifier(id) {
            return Err(Error::InvalidInput);
        }
        get(self.conn()?, s, "entry", id)
    }
    pub fn get_active_timer(&self, s: &Scope, user: &str) -> Result<Option<ActiveTimer>> {
        self.conn()?;
        matter(s)?;
        if !identifier(user) {
            return Err(Error::InvalidInput);
        }
        get(self.conn()?, s, "timer", user)
    }
    pub fn get_fee_arrangement(&self, s: &Scope) -> Result<Option<FeeArrangement>> {
        self.conn()?;
        matter(s)?;
        get(self.conn()?, s, "fee", "singleton")
    }
    pub fn get_client_hourly_rate(
        &self,
        s: &Scope,
        client: &str,
    ) -> Result<Option<ClientHourlyRate>> {
        self.conn()?;
        matter(s)?;
        if !identifier(client) {
            return Err(Error::InvalidInput);
        }
        get(self.conn()?, s, "rate", client)
    }
    pub fn get_matter_resolution(&self, s: &Scope) -> Result<Option<MatterResolution>> {
        self.conn()?;
        matter(s)?;
        get(self.conn()?, s, "resolution", "singleton")
    }
    pub fn list_time_entries(
        &self,
        s: &Scope,
        billing_status: Option<&str>,
        limit: u32,
        offset: u32,
    ) -> Result<Vec<TimeEntry>> {
        self.conn()?;
        matter(s)?;
        page(limit, offset)?;
        if billing_status.is_some_and(|v| !status(v)) {
            return Err(Error::InvalidInput);
        }
        let rows=self.conn()?.prepare("SELECT payload FROM billing_records WHERE workspace=? AND matter=? AND kind='entry' AND (? IS NULL OR json_extract(payload,'$.billingStatus')=?) ORDER BY sort_key COLLATE BINARY DESC,id COLLATE BINARY DESC LIMIT ? OFFSET ?")?.query_map(params![s.workspace,s.matter,billing_status,billing_status,limit,offset],|r|r.get::<_,String>(0))?.collect::<rusqlite::Result<Vec<_>>>()?;
        rows.into_iter()
            .map(|p| serde_json::from_str(&p).map_err(|_| Error::Storage))
            .collect()
    }
    pub fn list_time_billing_audits(
        &self,
        s: &Scope,
        limit: u32,
        offset: u32,
    ) -> Result<Vec<TimeBillingAudit>> {
        self.conn()?;
        matter(s)?;
        page(limit, offset)?;
        Ok(self.conn()?.prepare("SELECT workspace,matter,revision,ordinal,operation,record_id FROM billing_audit WHERE workspace=? AND matter=? ORDER BY revision,ordinal LIMIT ? OFFSET ?")?.query_map(params![s.workspace,s.matter,limit,offset],|r|Ok(TimeBillingAudit{workspace_id:r.get(0)?,matter_id:r.get(1)?,revision:r.get(2)?,ordinal:r.get(3)?,operation:r.get(4)?,record_id:r.get(5)?}))?.collect::<rusqlite::Result<_>>()?)
    }
}
#[cfg(test)]
mod internal_tests {
    use super::*;
    #[test]
    fn audit_failure_rolls_back_stop_delete_entry_and_prior_fee_after_reopen() {
        let key = KeyMaterial::generate().unwrap();
        let (f, mut v) = SyntheticVault::create(&key).unwrap();
        let s = Scope::new("w", "m", None).unwrap();
        let stamp = "2026-11-10T00:00:00.000Z";
        let t:ActiveTimer=serde_json::from_value(serde_json::json!({"workspaceId":"w","matterId":"m","threadId":null,"userId":"u","startedAt":stamp,"accumulatedMinutes":1,"pausedAt":null,"state":"running","rateAmount":"0.01","billable":true,"description":"Synthetic","currency":"MXN","createdAt":stamp,"updatedAt":stamp})).unwrap();
        let e:TimeEntry=serde_json::from_value(serde_json::json!({"id":"e","workspaceId":"w","matterId":"m","threadId":null,"userId":"u","startedAt":stamp,"endedAt":stamp,"manualMinutes":null,"durationMinutes":1,"billedMinutes":1,"description":"Synthetic","billable":true,"rateAmount":"0.01","amount":"0.01","currency":"MXN","source":"timer","billingStatus":"unbilled","createdAt":stamp})).unwrap();
        let fee:FeeArrangement=serde_json::from_value(serde_json::json!({"workspaceId":"w","matterId":"m","threadId":null,"arrangement":"hourly","hourlyRateAmount":"0.01","contingencyBasisPoints":null,"billingIncrementMinutes":6,"currency":"MXN","createdAt":stamp,"updatedAt":stamp})).unwrap();
        v.put_active_timer(&s, &t, 0).unwrap();
        v.conn().unwrap().execute_batch("CREATE TRIGGER fail_billing_audit BEFORE INSERT ON billing_audit WHEN NEW.operation='timer.stop' BEGIN SELECT RAISE(ABORT,'synthetic'); END;").unwrap();
        let cs = [
            TimeBillingChange::PutFee(fee),
            TimeBillingChange::StopTimer(TimerStop {
                user_id: "u".into(),
                entry: e,
            }),
        ];
        assert_eq!(v.commit_time_billing(&s, &cs, 1), Err(Error::Storage));
        v.close().unwrap();
        let mut v = f.reopen(Some(&key)).unwrap();
        assert_eq!(v.revision(&s).unwrap(), 1);
        assert_eq!(v.get_active_timer(&s, "u").unwrap(), Some(t));
        assert!(v.get_time_entry(&s, "e").unwrap().is_none());
        assert!(v.get_fee_arrangement(&s).unwrap().is_none());
        assert_eq!(v.list_time_billing_audits(&s, 100, 0).unwrap().len(), 1);
        v.conn()
            .unwrap()
            .execute_batch("PRAGMA user_version=3")
            .unwrap();
        v.close().unwrap();
        assert!(matches!(f.reopen(Some(&key)), Err(Error::CannotOpen)));
    }
}
