//! Inactive H5b.1 spike. No production constructor, paths, SQL, shell, or IPC exposed.
mod proposals;
mod reminders;
mod time_billing;
pub use proposals::{AgentAction, AgentActionLog, AgentProposal, PROPOSAL_CONTRACT_VERSION};
pub use reminders::{REMINDER_CONTRACT_VERSION, Reminder, ReminderAudit};
use rusqlite::{Connection, OptionalExtension, TransactionBehavior, params};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    fmt, fs,
    os::unix::fs::{OpenOptionsExt, PermissionsExt},
    sync::Arc,
    time::Duration,
};
use tempfile::TempDir;
pub use time_billing::{
    ActiveTimer, BillingStatusChange, ClientHourlyRate, FeeArrangement, MatterResolution, Money,
    TIME_BILLING_CONTRACT_VERSION, TimeBillingAudit, TimeBillingChange, TimeEntry, TimerKey,
    TimerStop,
};
use unicode_normalization::{UnicodeNormalization, char::is_combining_mark};
use zeroize::{Zeroize, ZeroizeOnDrop};

pub type Result<T> = std::result::Result<T, Error>;
#[derive(Debug, PartialEq, Eq)]
pub enum Error {
    InvalidInput,
    KeyRequired,
    CannotOpen,
    BackendUnavailable,
    Storage,
    Conflict,
    NotFound,
    Closed,
}
impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{self:?}")
    }
}
impl std::error::Error for Error {}
impl From<rusqlite::Error> for Error {
    fn from(_: rusqlite::Error) -> Self {
        Self::Storage
    }
}
impl From<std::io::Error> for Error {
    fn from(_: std::io::Error) -> Self {
        Self::Storage
    }
}

/// Random 256-bit key material passed through sqlite3_key as a binary passphrase.
/// SQLCipher's default KDF derives the database key. Never Debug/Serialize/Clone.
#[derive(Zeroize, ZeroizeOnDrop)]
pub struct KeyMaterial([u8; 32]);
impl KeyMaterial {
    pub fn generate() -> Result<Self> {
        let mut key = Self([0; 32]);
        getrandom::fill(&mut key.0).map_err(|_| Error::BackendUnavailable)?;
        Ok(key)
    }
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Scope {
    workspace: String,
    matter: String,
    thread: String,
}
fn identifier(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 128
        && s.bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}
impl Scope {
    pub fn new(workspace: &str, matter: &str, thread: Option<&str>) -> Result<Self> {
        if !identifier(workspace) || !identifier(matter) || thread.is_some_and(|x| !identifier(x)) {
            return Err(Error::InvalidInput);
        }
        Ok(Self {
            workspace: workspace.into(),
            matter: matter.into(),
            thread: thread.unwrap_or("").into(),
        })
    }
}
#[derive(Clone, Copy, Debug)]
pub enum Kind {
    Note,
    Chat,
    Document,
}
impl Kind {
    fn as_str(self) -> &'static str {
        match self {
            Self::Note => "note",
            Self::Chat => "chat",
            Self::Document => "document",
        }
    }
}
#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Chunk {
    pub id: String,
    pub text: String,
}
#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Hit {
    pub id: String,
    pub document_id: String,
    pub text: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Capabilities {
    pub cipher_version: String,
    pub sqlite_version: String,
    pub cipher_provider: String,
    pub temp_store: i64,
    pub journal_mode: String,
    pub foreign_keys: i64,
    pub compile_options: Vec<String>,
}

/// Only factory available in this spike: owns a NEW, randomly named, synthetic temp root.
/// Never accepts an existing store or caller-specified path. Keep this harness out of product.
pub struct SyntheticVault {
    root: Arc<TempDir>,
}
impl SyntheticVault {
    pub fn create(key: &KeyMaterial) -> Result<(Self, Vault)> {
        let root = Arc::new(
            tempfile::Builder::new()
                .prefix("lex-vault-h5b1-synthetic-")
                .tempdir()?,
        );
        fs::set_permissions(root.path(), fs::Permissions::from_mode(0o700))?;
        let path = root.path().join("vault.sqlite");
        fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(&path)?;
        let mut connection = open(&root, Some(key))?;
        let tx = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
        tx.execute_batch(SCHEMA)?;
        tx.execute_batch(reminders::SCHEMA)?;
        tx.execute_batch(proposals::SCHEMA)?;
        tx.execute_batch(time_billing::SCHEMA)?;
        tx.commit()?;
        let vault = Vault {
            connection: Some(connection),
            _root: root.clone(),
        };
        Ok((Self { root }, vault))
    }
    pub fn reopen(&self, key: Option<&KeyMaterial>) -> Result<Vault> {
        let connection = open(&self.root, key)?;
        let version: i64 = connection.query_row("PRAGMA user_version", [], |r| r.get(0))?;
        if version != 4 {
            return Err(Error::CannotOpen);
        }
        Ok(Vault {
            connection: Some(connection),
            _root: self.root.clone(),
        })
    }
    /// Test-only observation of files in this owned root. Names/bytes never logged by this crate.
    pub fn artifacts(&self) -> Result<Vec<(String, u32, Vec<u8>)>> {
        let mut out = Vec::new();
        for item in fs::read_dir(self.root.path())? {
            let item = item?;
            let metadata = item.file_type()?;
            if !metadata.is_file() {
                return Err(Error::Storage);
            }
            out.push((
                item.file_name().to_string_lossy().into(),
                item.metadata()?.permissions().mode() & 0o777,
                fs::read(item.path())?,
            ));
        }
        Ok(out)
    }
    pub fn root_mode(&self) -> Result<u32> {
        Ok(fs::metadata(self.root.path())?.permissions().mode() & 0o777)
    }
}
fn open(root: &TempDir, key: Option<&KeyMaterial>) -> Result<Connection> {
    let key = key.ok_or(Error::KeyRequired)?;
    // File already exists inside the freshly owned root; never CREATE or URI-open here.
    let c = Connection::open_with_flags(
        root.path().join("vault.sqlite"),
        rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|_| Error::CannotOpen)?;
    // SAFETY: c owns a valid live connection; input is valid for 32 bytes during the call.
    // SQLCipher copies the key. No Rust alias can use this connection during initialization.
    let rc = unsafe { rusqlite::ffi::sqlite3_key(c.handle(), key.0.as_ptr().cast(), 32) };
    if rc != rusqlite::ffi::SQLITE_OK {
        return Err(Error::CannotOpen);
    }
    let cipher: String = c
        .query_row("PRAGMA cipher_version", [], |r| r.get(0))
        .map_err(|_| Error::BackendUnavailable)?;
    if cipher.is_empty() {
        return Err(Error::BackendUnavailable);
    }
    // Force a page read BEFORE schema creation or any mutation. Wrong keys never recreate data.
    c.query_row("SELECT count(*) FROM sqlite_master", [], |r| {
        r.get::<_, i64>(0)
    })
    .map_err(|_| Error::CannotOpen)?;
    c.busy_timeout(Duration::from_secs(3))?;
    c.execute_batch("PRAGMA foreign_keys=ON; PRAGMA temp_store=MEMORY; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA secure_delete=ON; PRAGMA cipher_memory_security=ON;")?;
    let caps = capabilities(&c)?;
    if caps.cipher_provider != "commoncrypto"
        || caps.temp_store != 2
        || caps.foreign_keys != 1
        || caps.journal_mode != "delete"
        || !caps.compile_options.iter().any(|v| v == "ENABLE_FTS5")
        || !caps
            .compile_options
            .iter()
            .any(|v| v == "TEMP_STORE=2" || v == "TEMP_STORE=3")
    {
        return Err(Error::BackendUnavailable);
    }
    Ok(c)
}
fn capabilities(c: &Connection) -> Result<Capabilities> {
    let options = c
        .prepare("PRAGMA compile_options")?
        .query_map([], |r| r.get(0))?
        .collect::<rusqlite::Result<Vec<String>>>()?;
    Ok(Capabilities {
        cipher_version: c.query_row("PRAGMA cipher_version", [], |r| r.get(0))?,
        sqlite_version: c.query_row("SELECT sqlite_version()", [], |r| r.get(0))?,
        cipher_provider: c.query_row("PRAGMA cipher_provider", [], |r| r.get(0))?,
        temp_store: c.query_row("PRAGMA temp_store", [], |r| r.get(0))?,
        journal_mode: c.query_row("PRAGMA journal_mode", [], |r| r.get(0))?,
        foreign_keys: c.query_row("PRAGMA foreign_keys", [], |r| r.get(0))?,
        compile_options: options,
    })
}
const SCHEMA:&str="
CREATE TABLE revisions(workspace TEXT NOT NULL,matter TEXT NOT NULL,thread TEXT NOT NULL,revision INTEGER NOT NULL CHECK(revision>=0),PRIMARY KEY(workspace,matter,thread));
CREATE TABLE records(workspace TEXT NOT NULL,matter TEXT NOT NULL,thread TEXT NOT NULL,kind TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(workspace,matter,thread,kind,id));
CREATE TABLE originals(workspace TEXT NOT NULL,matter TEXT NOT NULL,thread TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind='document'),document_id TEXT NOT NULL,bytes BLOB NOT NULL,sha256 TEXT NOT NULL,PRIMARY KEY(workspace,matter,thread,document_id),FOREIGN KEY(workspace,matter,thread,kind,document_id) REFERENCES records(workspace,matter,thread,kind,id));
CREATE TABLE chunks(workspace TEXT NOT NULL,matter TEXT NOT NULL,thread TEXT NOT NULL,id TEXT NOT NULL,document_id TEXT NOT NULL,text TEXT NOT NULL,PRIMARY KEY(workspace,matter,thread,id),FOREIGN KEY(workspace,matter,thread,document_id) REFERENCES originals(workspace,matter,thread,document_id));
CREATE VIRTUAL TABLE chunks_fts USING fts5(workspace UNINDEXED,matter UNINDEXED,thread UNINDEXED,id UNINDEXED,text,tokenize='unicode61 remove_diacritics 2');
PRAGMA user_version=4;";
pub struct Vault {
    connection: Option<Connection>,
    _root: Arc<TempDir>,
}
fn validate_record(scope: &Scope, id: &str, payload: &str) -> Result<()> {
    if !identifier(id) || payload.len() > 2_000_000 {
        return Err(Error::InvalidInput);
    }
    let value: serde_json::Value =
        serde_json::from_str(payload).map_err(|_| Error::InvalidInput)?;
    let v = value.as_object().ok_or(Error::InvalidInput)?;
    if v.get("id").and_then(|v| v.as_str()) != Some(id)
        || v.get("workspaceId").and_then(|v| v.as_str()) != Some(&scope.workspace)
        || v.get("matterId").and_then(|v| v.as_str()) != Some(&scope.matter)
    {
        return Err(Error::InvalidInput);
    }
    match v.get("threadId") {
        Some(serde_json::Value::Null) if scope.thread.is_empty() => {}
        Some(serde_json::Value::String(t)) if !scope.thread.is_empty() && t == &scope.thread => {}
        _ => return Err(Error::InvalidInput),
    }
    Ok(())
}
fn advance(c: &Connection, s: &Scope, expected: i64) -> Result<i64> {
    if expected < 0 || expected == i64::MAX {
        return Err(Error::InvalidInput);
    }
    c.execute(
        "INSERT INTO revisions VALUES(?,?,?,0) ON CONFLICT DO NOTHING",
        params![s.workspace, s.matter, s.thread],
    )?;
    let count=c.execute("UPDATE revisions SET revision=revision+1 WHERE workspace=? AND matter=? AND thread=? AND revision=?",params![s.workspace,s.matter,s.thread,expected])?;
    if count != 1 {
        return Err(Error::Conflict);
    }
    Ok(expected + 1)
}
impl Vault {
    fn conn(&self) -> Result<&Connection> {
        self.connection.as_ref().ok_or(Error::Closed)
    }
    fn conn_mut(&mut self) -> Result<&mut Connection> {
        self.connection.as_mut().ok_or(Error::Closed)
    }
    pub fn capabilities(&self) -> Result<Capabilities> {
        capabilities(self.conn()?)
    }
    pub fn revision(&self, s: &Scope) -> Result<i64> {
        Ok(self
            .conn()?
            .query_row(
                "SELECT revision FROM revisions WHERE workspace=? AND matter=? AND thread=?",
                params![s.workspace, s.matter, s.thread],
                |r| r.get(0),
            )
            .optional()?
            .unwrap_or(0))
    }
    pub fn get(&self, s: &Scope, kind: Kind, id: &str) -> Result<Option<String>> {
        if !identifier(id) {
            return Err(Error::InvalidInput);
        }
        Ok(self.conn()?.query_row("SELECT payload FROM records WHERE workspace=? AND matter=? AND thread=? AND kind=? AND id=?",params![s.workspace,s.matter,s.thread,kind.as_str(),id],|r|r.get(0)).optional()?)
    }
    pub fn list(&self, s: &Scope, kind: Kind) -> Result<Vec<String>> {
        Ok(self.conn()?.prepare("SELECT payload FROM records WHERE workspace=? AND matter=? AND thread=? AND kind=? ORDER BY rowid")?.query_map(params![s.workspace,s.matter,s.thread,kind.as_str()],|r|r.get(0))?.collect::<rusqlite::Result<_>>()?)
    }
    /// Document records can only be created by insert_document; they cannot drift from originals.
    pub fn put(
        &mut self,
        s: &Scope,
        kind: Kind,
        id: &str,
        payload: &str,
        expected: i64,
    ) -> Result<i64> {
        if matches!(kind, Kind::Document) {
            return Err(Error::InvalidInput);
        }
        validate_record(s, id, payload)?;
        let tx = self
            .conn_mut()?
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let revision = advance(&tx, s, expected)?;
        tx.execute("INSERT INTO records VALUES(?,?,?,?,?,?) ON CONFLICT(workspace,matter,thread,kind,id) DO UPDATE SET payload=excluded.payload",params![s.workspace,s.matter,s.thread,kind.as_str(),id,payload])?;
        tx.commit()?;
        Ok(revision)
    }
    pub fn insert_document(
        &mut self,
        s: &Scope,
        id: &str,
        payload: &str,
        bytes: &[u8],
        chunks: &[Chunk],
        expected: i64,
    ) -> Result<i64> {
        validate_record(s, id, payload)?;
        if bytes.len() > 10 * 1024 * 1024
            || chunks.len() > 1000
            || chunks
                .iter()
                .any(|c| !identifier(&c.id) || c.text.len() > 16_000)
        {
            return Err(Error::InvalidInput);
        }
        let tx = self
            .conn_mut()?
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let revision = advance(&tx, s, expected)?;
        tx.execute(
            "INSERT INTO records VALUES(?,?,?,'document',?,?)",
            params![s.workspace, s.matter, s.thread, id, payload],
        )?;
        tx.execute(
            "INSERT INTO originals VALUES(?,?,?,'document',?,?,?)",
            params![
                s.workspace,
                s.matter,
                s.thread,
                id,
                bytes,
                format!("{:x}", Sha256::digest(bytes))
            ],
        )?;
        for c in chunks {
            tx.execute(
                "INSERT INTO chunks VALUES(?,?,?,?,?,?)",
                params![s.workspace, s.matter, s.thread, c.id, id, c.text],
            )?;
            tx.execute(
                "INSERT INTO chunks_fts VALUES(?,?,?,?,?)",
                params![s.workspace, s.matter, s.thread, c.id, c.text],
            )?;
        }
        tx.commit()?;
        Ok(revision)
    }
    pub fn original(&self, s: &Scope, id: &str) -> Result<Option<Vec<u8>>> {
        if !identifier(id) {
            return Err(Error::InvalidInput);
        }
        let row:Option<(Vec<u8>,String)>=self.conn()?.query_row("SELECT bytes,sha256 FROM originals WHERE workspace=? AND matter=? AND thread=? AND document_id=?",params![s.workspace,s.matter,s.thread,id],|r|Ok((r.get(0)?,r.get(1)?))).optional()?;
        match row {
            None => Ok(None),
            Some((bytes, hash)) => {
                if format!("{:x}", Sha256::digest(&bytes)) != hash {
                    return Err(Error::Storage);
                }
                Ok(Some(bytes))
            }
        }
    }
    pub fn first_chunks(&self, s: &Scope, limit: u32) -> Result<Vec<Hit>> {
        if !(1..=100).contains(&limit) {
            return Err(Error::InvalidInput);
        }
        Ok(self.conn()?.prepare("SELECT id,document_id,text FROM chunks WHERE workspace=? AND matter=? AND thread=? ORDER BY rowid LIMIT ?")?.query_map(params![s.workspace,s.matter,s.thread,limit],hit)?.collect::<rusqlite::Result<_>>()?)
    }
    pub fn search(&self, s: &Scope, query: &str, limit: u32) -> Result<Vec<Hit>> {
        self.conn()?;
        if query.len() > 16_000 || !(1..=100).contains(&limit) {
            return Err(Error::InvalidInput);
        }
        let terms = search_terms(query);
        if terms.is_empty() {
            return Ok(vec![]);
        }
        let q = terms
            .iter()
            .map(|v| format!("\"{v}\""))
            .collect::<Vec<_>>()
            .join(" OR ");
        Ok(self.conn()?.prepare("SELECT c.id,c.document_id,c.text FROM chunks_fts f JOIN chunks c ON c.workspace=f.workspace AND c.matter=f.matter AND c.thread=f.thread AND c.id=f.id WHERE chunks_fts MATCH ? AND c.workspace=? AND c.matter=? AND c.thread=? AND f.workspace=? AND f.matter=? AND f.thread=? ORDER BY c.rowid LIMIT ?")?.query_map(params![q,s.workspace,s.matter,s.thread,s.workspace,s.matter,s.thread,limit],hit)?.collect::<rusqlite::Result<_>>()?)
    }
    pub fn close(&mut self) -> Result<()> {
        if let Some(c) = self.connection.take() {
            c.close().map_err(|_| Error::Storage)?;
        }
        Ok(())
    }
}
fn hit(r: &rusqlite::Row<'_>) -> rusqlite::Result<Hit> {
    Ok(Hit {
        id: r.get(0)?,
        document_id: r.get(1)?,
        text: r.get(2)?,
    })
}
fn search_terms(text: &str) -> Vec<String> {
    const STOP: &[&str] = &[
        "que", "del", "las", "los", "una", "unos", "como", "para", "por", "con", "sobre", "este",
        "esta", "sus", "son", "hay", "cuales", "analiza", "analizar", "revisa", "revisar",
    ];
    let normalized: String = text
        .to_lowercase()
        .nfd()
        .filter(|c| !is_combining_mark(*c))
        .collect();
    let mut terms = Vec::new();
    for t in normalized
        .split(|c: char| !c.is_alphanumeric())
        .filter(|s| s.chars().count() >= 3)
    {
        if !STOP.contains(&t) && !terms.iter().any(|s| s == t) {
            terms.push(t.to_owned());
            if terms.len() == 32 {
                break;
            }
        }
    }
    terms
}

#[cfg(test)]
mod internal_tests {
    use super::*;
    #[test]
    fn plaintext_database_and_unkeyed_reads_are_rejected_without_fallback() {
        let key = KeyMaterial::generate().unwrap();
        let (f, mut v) = SyntheticVault::create(&key).unwrap();
        v.close().unwrap();
        let bare = Connection::open(f.root.path().join("vault.sqlite")).unwrap();
        assert!(
            bare.query_row("SELECT count(*) FROM sqlite_master", [], |r| r
                .get::<_, i64>(0))
                .is_err()
        );
        drop(bare);
        // Independent plaintext control created ONLY in its own random temp root.
        let plain = Arc::new(
            tempfile::Builder::new()
                .prefix("lex-vault-h5b1-plain-control-")
                .tempdir()
                .unwrap(),
        );
        let c = Connection::open(plain.path().join("vault.sqlite")).unwrap();
        c.execute_batch("CREATE TABLE negative_control(text); INSERT INTO negative_control VALUES('SYNTHETIC_PLAIN_CONTROL_391');").unwrap();
        drop(c);
        let before = fs::read(plain.path().join("vault.sqlite")).unwrap();
        assert!(before.starts_with(b"SQLite format 3\0"));
        assert!(
            before
                .windows(27)
                .any(|w| w == b"SYNTHETIC_PLAIN_CONTROL_391")
        );
        assert!(matches!(open(&plain, Some(&key)), Err(Error::CannotOpen)));
        assert_eq!(fs::read(plain.path().join("vault.sqlite")).unwrap(), before);
    }
    #[test]
    fn live_rollback_journal_and_database_do_not_contain_plain_preimage() {
        let key = KeyMaterial::generate().unwrap();
        let (f, mut v) = SyntheticVault::create(&key).unwrap();
        let s = Scope::new("firm_a", "matter_a", None).unwrap();
        let sentinel = "SYNTHETIC_JOURNAL_PREIMAGE_728";
        let p=serde_json::json!({"id":"chat_a","workspaceId":"firm_a","matterId":"matter_a","threadId":null,"text":sentinel.repeat(1000)}).to_string();
        v.put(&s, Kind::Chat, "chat_a", &p, 0).unwrap();
        let tx = v
            .conn_mut()
            .unwrap()
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .unwrap();
        tx.execute(
            "UPDATE records SET payload=? WHERE id='chat_a'",
            ["replacement".repeat(3000)],
        )
        .unwrap();
        let artifacts = f.artifacts().unwrap();
        assert!(
            artifacts
                .iter()
                .any(|(name, _, bytes)| name == "vault.sqlite-journal" && !bytes.is_empty())
        );
        let utf16: Vec<u8> = sentinel.encode_utf16().flat_map(u16::to_le_bytes).collect();
        for (_, mode, bytes) in artifacts {
            assert_eq!(mode, 0o600);
            for pattern in [sentinel.as_bytes(), utf16.as_slice()] {
                assert!(!bytes.windows(pattern.len()).any(|w| w == pattern));
            }
        }
        tx.rollback().unwrap();
        v.close().unwrap();
        let v = f.reopen(Some(&key)).unwrap();
        assert_eq!(v.get(&s, Kind::Chat, "chat_a").unwrap(), Some(p));
        assert_eq!(v.revision(&s).unwrap(), 1);
    }
}
