//! Feature-gated synthetic recovery. No arbitrary paths, writable restore or product API.
use crate::{KeyMaterial, Scope, SyntheticVault, Vault};
use rusqlite::{Connection, OpenFlags, params, types::ValueRef};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    os::unix::fs::{MetadataExt, OpenOptionsExt, PermissionsExt},
    sync::Arc,
};
use tempfile::TempDir;
use zeroize::{Zeroize, Zeroizing};

pub const MAX_DATABASE: usize = 16 * 1024 * 1024;
pub const MAX_CIPHERTEXT: usize = 18 * 1024 * 1024;
pub const MAX_PLAINTEXT: usize = 17 * 1024 * 1024;
pub const MAX_MANIFEST: usize = 256 * 1024;
const MAX_HEADER: usize = 16 * 1024;
const MAGIC: &[u8] = b"LEXREC1\n";
type R<T> = std::result::Result<T, RecoveryError>;
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RecoveryError {
    InvalidInput,
    MissingCredential,
    CannotDecrypt,
    UnsupportedFormat,
    ScopeMismatch,
    RevisionConflict,
    SourceNotQuiescent,
    SourceIntegrity,
    ResourceLimit,
    Cancelled,
    StorageFailure,
    UnsupportedBackend,
}
impl From<std::io::Error> for RecoveryError {
    fn from(_: std::io::Error) -> Self {
        Self::StorageFailure
    }
}
impl From<rusqlite::Error> for RecoveryError {
    fn from(_: rusqlite::Error) -> Self {
        Self::SourceIntegrity
    }
}
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum RecoveryFailpoint {
    None,
    PreSeal,
    PostClose,
    CopyCiphertext,
    PreAgeFinish,
    PostFinishPreSync,
    PreBundlePublication,
    Decrypt,
    PreStagingWrite,
    StagingCollision,
    PostStagingWrite,
    ValidateDatabase,
    PreCapabilityPublication,
}
fn stop(at: RecoveryFailpoint, wanted: RecoveryFailpoint) -> R<()> {
    if at == wanted {
        Err(RecoveryError::Cancelled)
    } else {
        Ok(())
    }
}
fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn random_id() -> R<String> {
    let mut b = [0u8; 16];
    getrandom::fill(&mut b).map_err(|_| RecoveryError::UnsupportedBackend)?;
    Ok(b.iter().map(|v| format!("{v:02x}")).collect())
}
fn hex64(s: &str) -> bool {
    s.len() == 64
        && s.bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

// These claims contain synthetic metadata only, and are transported privately to the child.
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
#[derive(zeroize::Zeroize, zeroize::ZeroizeOnDrop)]
pub struct RecoveryScope {
    pub workspace: String,
    pub matter: String,
    pub thread: Option<String>,
}
impl RecoveryScope {
    pub fn native(&self) -> R<Scope> {
        Scope::new(&self.workspace, &self.matter, self.thread.as_deref())
            .map_err(|_| RecoveryError::InvalidInput)
    }
}
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
#[derive(zeroize::Zeroize, zeroize::ZeroizeOnDrop)]
pub struct RecoveryRevision {
    pub scope: RecoveryScope,
    pub revision: i64,
}
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
#[derive(zeroize::Zeroize, zeroize::ZeroizeOnDrop)]
pub struct RecoveryObject {
    pub scope: RecoveryScope,
    pub id: String,
    pub kind: String,
    pub payload_sha256: String,
    pub original_sha256: Option<String>,
    pub original_bytes: Option<u64>,
    pub parent_document_id: Option<String>,
    pub parent_original_sha256: Option<String>,
    pub parent_text_sha256: Option<String>,
    pub namespace: Option<String>,
    pub map_version: Option<u32>,
}
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
#[derive(zeroize::Zeroize, zeroize::ZeroizeOnDrop)]
struct TableDigest {
    name: String,
    rows: u64,
    sha256: String,
}
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
#[derive(zeroize::Zeroize, zeroize::ZeroizeOnDrop)]
struct Inventory {
    schema_digest: String,
    cipher_version: String,
    sqlite_version: String,
    provider: String,
    revisions: Vec<RecoveryRevision>,
    tables: Vec<TableDigest>,
    objects: Vec<RecoveryObject>,
}
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
#[derive(zeroize::Zeroize, zeroize::ZeroizeOnDrop)]
pub struct SyntheticRecoveryExpectation {
    snapshot_id: String,
    source_vault_id: String,
    source_lineage_id: String,
    key_version: u32,
    created_at: String,
    workspace_id: String,
    inventory: Inventory,
    extraction_versions: Vec<String>,
    policy_versions: Vec<String>,
}
impl SyntheticRecoveryExpectation {
    /// Captured independently from the fixture before sealing; never inferred from incoming bundle.
    pub fn capture(vault: &Vault, objects: Vec<RecoveryObject>) -> R<Self> {
        let c = vault
            .connection
            .as_ref()
            .ok_or(RecoveryError::InvalidInput)?;
        let inventory = inventory(c, &objects)?;
        let workspace_id = inventory
            .revisions
            .first()
            .ok_or(RecoveryError::InvalidInput)?
            .scope
            .workspace
            .clone();
        let value = Self {
            snapshot_id: random_id()?,
            source_vault_id: random_id()?,
            source_lineage_id: random_id()?,
            key_version: 1,
            created_at: "2026-11-10T00:00:00.000Z".into(),
            workspace_id,
            inventory,
            extraction_versions: vec!["synthetic-text-v1".into()],
            policy_versions: vec!["synthetic-inert-v1".into()],
        };
        value.validate()?;
        Ok(value)
    }
    pub fn to_private_bytes(&self) -> R<Zeroizing<Vec<u8>>> {
        let b = serde_json::to_vec(self).map_err(|_| RecoveryError::InvalidInput)?;
        if b.len() > MAX_MANIFEST {
            return Err(RecoveryError::ResourceLimit);
        }
        Ok(Zeroizing::new(b))
    }
    pub fn from_private_bytes(bytes: &[u8]) -> R<Self> {
        let value: Self = strict_json(bytes)?;
        value.validate()?;
        Ok(value)
    }
    fn validate(&self) -> R<()> {
        if !crate::identifier(&self.workspace_id)
            || !crate::identifier(&self.snapshot_id)
            || !crate::identifier(&self.source_vault_id)
            || !crate::identifier(&self.source_lineage_id)
            || self.key_version != 1
            || self.created_at != "2026-11-10T00:00:00.000Z"
            || self.inventory.revisions.is_empty()
            || self.inventory.revisions.len() > 8
            || self.inventory.objects.len() > 128
            || self.extraction_versions != ["synthetic-text-v1"]
            || self.policy_versions != ["synthetic-inert-v1"]
        {
            return Err(RecoveryError::InvalidInput);
        }
        let mut seen = BTreeSet::new();
        let mut matters = BTreeMap::<String, BTreeSet<Option<String>>>::new();
        for r in &self.inventory.revisions {
            r.scope.native()?;
            if r.scope.workspace != self.workspace_id
                || r.revision < 0
                || r.revision > 9_007_199_254_740_991
                || !seen.insert(r.scope.clone())
            {
                return Err(RecoveryError::ScopeMismatch);
            }
            matters
                .entry(r.scope.matter.clone())
                .or_default()
                .insert(r.scope.thread.clone());
        }
        if matters.len() > 2
            || matters
                .values()
                .any(|t| t.iter().filter(|t| t.is_some()).count() > 2)
        {
            return Err(RecoveryError::ResourceLimit);
        }
        Ok(())
    }
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct Manifest {
    format_version: u32,
    manifest_version: u32,
    payload_encoding: String,
    serialization_version: u32,
    crypto_profile: String,
    age_version: String,
    source_and_lock_pins: BTreeMap<String, String>,
    expected: SyntheticRecoveryExpectation,
    schema_version: u32,
    store_bytes: u64,
    store_sha256: String,
    key_bytes_sha256: String,
    scope_revision_digest: String,
    synthetic: bool,
    production_enabled: bool,
    no_execution: bool,
}
fn pins() -> BTreeMap<String, String> {
    BTreeMap::from([
        ("recovery.rs".into(), hash(include_bytes!("recovery.rs"))),
        ("lib.rs".into(), hash(include_bytes!("lib.rs"))),
        ("reminders.rs".into(), hash(include_bytes!("reminders.rs"))),
        ("proposals.rs".into(), hash(include_bytes!("proposals.rs"))),
        (
            "time_billing.rs".into(),
            hash(include_bytes!("time_billing.rs")),
        ),
        ("Cargo.lock".into(), hash(include_bytes!("../Cargo.lock"))),
        ("Cargo.toml".into(), hash(include_bytes!("../Cargo.toml"))),
    ])
}
fn strict_json<T: serde::de::DeserializeOwned>(bytes: &[u8]) -> R<T> {
    if bytes.len() > MAX_MANIFEST {
        return Err(RecoveryError::ResourceLimit);
    }
    // Validate depth and duplicate keys before typed serde; serde structs also deny unknowns.
    let mut de = serde_json::Deserializer::from_slice(bytes);
    let _ = serde::de::DeserializeSeed::deserialize(StrictSeed(0), &mut de)
        .map_err(|_| RecoveryError::UnsupportedFormat)?;
    de.end().map_err(|_| RecoveryError::UnsupportedFormat)?;
    let value: T = serde_json::from_slice(bytes).map_err(|_| RecoveryError::UnsupportedFormat)?;
    Ok(value)
}
struct StrictSeed(usize);
impl<'de> serde::de::DeserializeSeed<'de> for StrictSeed {
    type Value = ();
    fn deserialize<D: serde::Deserializer<'de>>(self, d: D) -> std::result::Result<(), D::Error> {
        if self.0 > 12 {
            return Err(serde::de::Error::custom("depth"));
        }
        d.deserialize_any(self)
    }
}
impl<'de> serde::de::Visitor<'de> for StrictSeed {
    type Value = ();
    fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        f.write_str("bounded JSON")
    }
    fn visit_bool<E: serde::de::Error>(self, _: bool) -> std::result::Result<(), E> {
        Ok(())
    }
    fn visit_i64<E: serde::de::Error>(self, _: i64) -> std::result::Result<(), E> {
        Ok(())
    }
    fn visit_u64<E: serde::de::Error>(self, _: u64) -> std::result::Result<(), E> {
        Ok(())
    }
    fn visit_f64<E: serde::de::Error>(self, _: f64) -> std::result::Result<(), E> {
        Err(E::custom("float"))
    }
    fn visit_str<E: serde::de::Error>(self, s: &str) -> std::result::Result<(), E> {
        if s.len() > 65536 || s.contains('\0') {
            Err(E::custom("string"))
        } else {
            Ok(())
        }
    }
    fn visit_none<E: serde::de::Error>(self) -> std::result::Result<(), E> {
        Ok(())
    }
    fn visit_unit<E: serde::de::Error>(self) -> std::result::Result<(), E> {
        Ok(())
    }
    fn visit_seq<A: serde::de::SeqAccess<'de>>(
        self,
        mut a: A,
    ) -> std::result::Result<(), A::Error> {
        let mut n = 0;
        while a.next_element_seed(StrictSeed(self.0 + 1))?.is_some() {
            n += 1;
            if n > 128 {
                return Err(serde::de::Error::custom("count"));
            }
        }
        Ok(())
    }
    fn visit_map<A: serde::de::MapAccess<'de>>(
        self,
        mut a: A,
    ) -> std::result::Result<(), A::Error> {
        let mut keys = BTreeSet::new();
        while let Some(k) = a.next_key::<String>()? {
            if k.len() > 128 || keys.len() >= 128 || !keys.insert(k) {
                return Err(serde::de::Error::custom("key"));
            }
            a.next_value_seed(StrictSeed(self.0 + 1))?;
        }
        Ok(())
    }
}

#[must_use = "A seal failure owns the ORIGINAL fixture; recover its parts instead of discarding it."]
pub struct SealFailure {
    source: SyntheticVault,
    vault: Option<Vault>,
    key: Option<KeyMaterial>,
    expected: SyntheticRecoveryExpectation,
    reason: RecoveryError,
}
impl SealFailure {
    pub fn reason(&self) -> RecoveryError {
        self.reason
    }
    pub fn into_parts(
        self,
    ) -> (
        SyntheticVault,
        Option<Vault>,
        Option<KeyMaterial>,
        SyntheticRecoveryExpectation,
    ) {
        (self.source, self.vault, self.key, self.expected)
    }
}
#[derive(Clone, Copy, PartialEq, Eq)]
struct SourceStamp {
    device: u64,
    inode: u64,
    length: u64,
    mtime: i64,
    nanos: i64,
}
fn source_stamp(root: &TempDir) -> R<SourceStamp> {
    let m = fs::symlink_metadata(root.path().join("vault.sqlite"))?;
    if !m.is_file() || m.nlink() != 1 {
        return Err(RecoveryError::SourceIntegrity);
    }
    Ok(SourceStamp {
        device: m.dev(),
        inode: m.ino(),
        length: m.len(),
        mtime: m.mtime(),
        nanos: m.mtime_nsec(),
    })
}
pub struct ClosedSyntheticSource {
    source: SyntheticVault,
    key: KeyMaterial,
    expected: SyntheticRecoveryExpectation,
    store_hash: String,
    stamp: SourceStamp,
}
pub fn seal_for_recovery(
    source: SyntheticVault,
    vault: Vault,
    key: Option<KeyMaterial>,
    expected: SyntheticRecoveryExpectation,
    failpoint: RecoveryFailpoint,
) -> std::result::Result<ClosedSyntheticSource, SealFailure> {
    let mut owner = SealFailure {
        source,
        vault: Some(vault),
        key,
        expected,
        reason: RecoveryError::InvalidInput,
    };
    let result = (|| -> R<(String, SourceStamp)> {
        stop(failpoint, RecoveryFailpoint::PreSeal)?;
        if owner.key.is_none() {
            return Err(RecoveryError::MissingCredential);
        }
        let v = owner.vault.as_mut().ok_or(RecoveryError::InvalidInput)?;
        if !Arc::ptr_eq(&owner.source.root, &v._root) || Arc::strong_count(&owner.source.root) != 2
        {
            return Err(RecoveryError::SourceNotQuiescent);
        }
        owner.expected.validate()?;
        if let Some(connection) = v.connection.take() {
            if let Err((connection, _)) = connection.close() {
                v.connection = Some(connection);
                return Err(RecoveryError::StorageFailure);
            }
        }
        drop(owner.vault.take());
        if Arc::strong_count(&owner.source.root) != 1 {
            return Err(RecoveryError::SourceNotQuiescent);
        }
        stop(failpoint, RecoveryFailpoint::PostClose)?;
        let key = owner.key.as_ref().ok_or(RecoveryError::MissingCredential)?;
        let stamp = source_stamp(&owner.source.root)?;
        let bytes = read_source(&owner.source.root)?;
        let c = readonly(&owner.source.root, key)?;
        let actual = inventory(&c, &owner.expected.inventory.objects)?;
        if actual != owner.expected.inventory {
            return Err(RecoveryError::SourceIntegrity);
        }
        c.close().map_err(|_| RecoveryError::StorageFailure)?;
        let after = read_source(&owner.source.root)?;
        if bytes != after || source_stamp(&owner.source.root)? != stamp {
            return Err(RecoveryError::SourceIntegrity);
        }
        Ok((hash(&bytes), stamp))
    })();
    match result {
        Ok((store_hash, stamp)) => match owner.key.take() {
            Some(key) => Ok(ClosedSyntheticSource {
                source: owner.source,
                key,
                expected: owner.expected,
                store_hash,
                stamp,
            }),
            None => {
                owner.reason = RecoveryError::MissingCredential;
                Err(owner)
            }
        },
        Err(reason) => {
            owner.reason = reason;
            Err(owner)
        }
    }
}
impl ClosedSyntheticSource {
    pub fn verify_preserved(&self) -> R<()> {
        verify_source_readonly(&self.source, &self.key, &self.expected)?;
        if hash(&read_source(&self.source.root)?) != self.store_hash
            || source_stamp(&self.source.root)? != self.stamp
        {
            return Err(RecoveryError::SourceIntegrity);
        }
        Ok(())
    }
    pub fn expectation(&self) -> &SyntheticRecoveryExpectation {
        &self.expected
    }
}
/// Error-owner control: never opens writable or replays a sidecar.
pub fn verify_source_readonly(
    source: &SyntheticVault,
    key: &KeyMaterial,
    expected: &SyntheticRecoveryExpectation,
) -> R<()> {
    let stamp = source_stamp(&source.root)?;
    let before = read_source(&source.root)?;
    let c = readonly(&source.root, key)?;
    if inventory(&c, &expected.inventory.objects)? != expected.inventory {
        return Err(RecoveryError::SourceIntegrity);
    }
    c.close().map_err(|_| RecoveryError::StorageFailure)?;
    if before != read_source(&source.root)? || stamp != source_stamp(&source.root)? {
        return Err(RecoveryError::SourceIntegrity);
    }
    Ok(())
}
fn read_source(root: &TempDir) -> R<Vec<u8>> {
    let root_meta = fs::symlink_metadata(root.path())?;
    if !root_meta.is_dir() || root_meta.permissions().mode() & 0o777 != 0o700 {
        return Err(RecoveryError::SourceIntegrity);
    }
    let mut names = Vec::new();
    for e in fs::read_dir(root.path())? {
        names.push(e?.file_name());
    }
    if names != [std::ffi::OsString::from("vault.sqlite")] {
        return Err(RecoveryError::SourceNotQuiescent);
    }
    let path = root.path().join("vault.sqlite");
    let before = fs::symlink_metadata(&path)?;
    if !before.is_file()
        || before.nlink() != 1
        || before.permissions().mode() & 0o777 != 0o600
        || before.len() == 0
        || before.len() > MAX_DATABASE as u64
    {
        return Err(RecoveryError::SourceIntegrity);
    }
    let mut file = File::open(&path)?;
    let opened = file.metadata()?;
    if before.ino() != opened.ino() || before.dev() != opened.dev() {
        return Err(RecoveryError::SourceIntegrity);
    }
    let mut bytes = Vec::new();
    Read::by_ref(&mut file)
        .take((MAX_DATABASE + 1) as u64)
        .read_to_end(&mut bytes)?;
    let after = fs::symlink_metadata(&path)?;
    if bytes.len() != before.len() as usize
        || before.ino() != after.ino()
        || before.dev() != after.dev()
        || before.len() != after.len()
        || before.mtime() != after.mtime()
        || before.mtime_nsec() != after.mtime_nsec()
        || !after.is_file()
        || after.nlink() != 1
    {
        return Err(RecoveryError::SourceIntegrity);
    }
    Ok(bytes)
}
fn readonly(root: &TempDir, key: &KeyMaterial) -> R<Connection> {
    let c = Connection::open_with_flags(
        root.path().join("vault.sqlite"),
        OpenFlags::SQLITE_OPEN_READ_ONLY
            | OpenFlags::SQLITE_OPEN_NO_MUTEX
            | OpenFlags::SQLITE_OPEN_NOFOLLOW,
    )
    .map_err(|_| RecoveryError::SourceIntegrity)?;
    let rc = unsafe { rusqlite::ffi::sqlite3_key(c.handle(), key.0.as_ptr().cast(), 32) };
    if rc != rusqlite::ffi::SQLITE_OK {
        return Err(RecoveryError::SourceIntegrity);
    }
    c.execute_batch("PRAGMA query_only=ON; PRAGMA temp_store=MEMORY; PRAGMA foreign_keys=ON; PRAGMA cipher_memory_security=ON;")?;
    let version: i64 = c.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    if version != 4 {
        return Err(RecoveryError::UnsupportedFormat);
    }
    let provider: String = c.query_row("PRAGMA cipher_provider", [], |r| r.get(0))?;
    let cipher: String = c.query_row("PRAGMA cipher_version", [], |r| r.get(0))?;
    if provider != "commoncrypto" || cipher.is_empty() {
        return Err(RecoveryError::UnsupportedBackend);
    }
    let mode: String = c.query_row("PRAGMA journal_mode", [], |r| r.get(0))?;
    if mode != "delete" {
        return Err(RecoveryError::SourceNotQuiescent);
    }
    let check: String = c.query_row("PRAGMA integrity_check", [], |r| r.get(0))?;
    if check != "ok" {
        return Err(RecoveryError::SourceIntegrity);
    }
    for pragma in ["PRAGMA foreign_key_check", "PRAGMA cipher_integrity_check"] {
        let mut s = c.prepare(pragma)?;
        if s.column_count() == 0 {
            return Err(RecoveryError::UnsupportedBackend);
        }
        if s.query([])?.next()?.is_some() {
            return Err(RecoveryError::SourceIntegrity);
        }
    }
    Ok(c)
}

const TABLES: &[&str] = &[
    "revisions",
    "records",
    "originals",
    "chunks",
    "chunks_fts",
    "chunks_fts_config",
    "chunks_fts_content",
    "chunks_fts_data",
    "chunks_fts_docsize",
    "chunks_fts_idx",
    "reminders",
    "reminder_audit",
    "agent_proposals",
    "agent_action_log",
    "billing_records",
    "billing_audit",
];
fn inventory(c: &Connection, objects: &[RecoveryObject]) -> R<Inventory> {
    if objects.len() > 128 {
        return Err(RecoveryError::ResourceLimit);
    }
    // Validate schema against fixed declarations, never execute schema from an envelope.
    let declarations = format!(
        "{}{}{}{}",
        crate::SCHEMA,
        crate::reminders::SCHEMA,
        crate::proposals::SCHEMA,
        crate::time_billing::SCHEMA
    );
    let mut schema_rows =
        c.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name")?;
    let mut schema_cursor = schema_rows.query([])?;
    let mut schema_hash = Sha256::new();
    let mut names = BTreeSet::new();
    let mut schema_count = 0;
    while let Some(row) = schema_cursor.next()? {
        schema_count += 1;
        if schema_count > 64 {
            return Err(RecoveryError::SourceIntegrity);
        }
        let kind: String = row.get(0)?;
        let name: String = row.get(1)?;
        let table: String = row.get(2)?;
        let sql: Option<String> = row.get(3)?;
        if kind == "table" {
            if !TABLES.contains(&name.as_str()) || !names.insert(name.clone()) {
                return Err(RecoveryError::SourceIntegrity);
            }
            if !name.starts_with("chunks_fts_") {
                let actual = sql.as_deref().ok_or(RecoveryError::SourceIntegrity)?.trim();
                if !declarations.split(';').any(|d| d.trim() == actual) {
                    return Err(RecoveryError::SourceIntegrity);
                }
            } else if !sql
                .as_deref()
                .is_some_and(|s| s.starts_with("CREATE TABLE "))
            {
                return Err(RecoveryError::SourceIntegrity);
            }
        } else if kind != "index"
            || sql.is_some()
            || !name.starts_with("sqlite_autoindex_")
            || !TABLES.contains(&table.as_str())
        {
            return Err(RecoveryError::SourceIntegrity);
        }
        schema_hash.update(
            serde_json::to_vec(&(kind, name, table, sql))
                .map_err(|_| RecoveryError::SourceIntegrity)?,
        );
    }
    if names.len() != TABLES.len() {
        return Err(RecoveryError::SourceIntegrity);
    }
    let revisions=c.prepare("SELECT workspace,matter,thread,revision FROM revisions ORDER BY workspace,matter,thread")?.query_map([],|r|{let thread:String=r.get(2)?;Ok(RecoveryRevision{scope:RecoveryScope{workspace:r.get(0)?,matter:r.get(1)?,thread:if thread.is_empty(){None}else{Some(thread)}},revision:r.get(3)?})})?.collect::<rusqlite::Result<Vec<_>>>()?;
    if revisions.is_empty() || revisions.len() > 8 {
        return Err(RecoveryError::ResourceLimit);
    }
    let mut tables = Vec::new();
    for &name in TABLES {
        // Table names are compile-time allowlist entries; all column ordering is ordinal.
        let count: i64 = c.query_row(&format!("SELECT count(*) FROM {name}"), [], |r| r.get(0))?;
        if count < 0 || count > 128 {
            return Err(RecoveryError::ResourceLimit);
        }
        let mut stmt = c.prepare(&format!("SELECT * FROM {name}"))?;
        let columns = stmt.column_count();
        if columns > 16 {
            return Err(RecoveryError::SourceIntegrity);
        }
        let sort = (1..=columns)
            .map(|i| i.to_string())
            .collect::<Vec<_>>()
            .join(",");
        drop(stmt);
        stmt = c.prepare(&format!("SELECT * FROM {name} ORDER BY {sort}"))?;
        let mut rows = stmt.query([])?;
        let mut digest = Sha256::new();
        let mut total = 0usize;
        while let Some(row) = rows.next()? {
            digest.update(b"ROW");
            for i in 0..columns {
                let value = row.get_ref(i)?;
                match value {
                    ValueRef::Null => digest.update([0]),
                    ValueRef::Integer(n) => {
                        digest.update([1]);
                        digest.update(n.to_be_bytes());
                    }
                    ValueRef::Real(_) => return Err(RecoveryError::UnsupportedFormat),
                    ValueRef::Text(b) | ValueRef::Blob(b) => {
                        total = total
                            .checked_add(b.len())
                            .ok_or(RecoveryError::ResourceLimit)?;
                        if total > MAX_DATABASE {
                            return Err(RecoveryError::ResourceLimit);
                        }
                        digest.update([if matches!(value, ValueRef::Text(_)) {
                            2
                        } else {
                            3
                        }]);
                        digest.update((b.len() as u64).to_be_bytes());
                        digest.update(b);
                    }
                }
            }
        }
        tables.push(TableDigest {
            name: name.into(),
            rows: count as u64,
            sha256: format!("{:x}", digest.finalize()),
        });
    }
    // Every domain scope must belong to the independently expected revision vector.
    for name in [
        "records",
        "originals",
        "chunks",
        "reminders",
        "reminder_audit",
        "agent_proposals",
        "agent_action_log",
        "billing_records",
        "billing_audit",
    ] {
        let thread = if matches!(name, "records" | "originals" | "chunks") {
            "thread"
        } else {
            "''"
        };
        let mut s = c.prepare(&format!(
            "SELECT DISTINCT workspace,matter,{thread} FROM {name}"
        ))?;
        let mut rows = s.query([])?;
        while let Some(r) = rows.next()? {
            let w: String = r.get(0)?;
            let m: String = r.get(1)?;
            let t: String = r.get(2)?;
            if !revisions.iter().any(|v| {
                v.scope.workspace == w
                    && v.scope.matter == m
                    && v.scope.thread.as_deref().unwrap_or("") == t
            }) {
                return Err(RecoveryError::ScopeMismatch);
            }
        }
    }
    let chunks: i64 = c.query_row("SELECT count(*) FROM chunks", [], |r| r.get(0))?;
    let fts: i64 = c.query_row("SELECT count(*) FROM chunks_fts", [], |r| r.get(0))?;
    let matching:i64=c.query_row("SELECT count(*) FROM chunks c JOIN chunks_fts f ON c.workspace=f.workspace AND c.matter=f.matter AND c.thread=f.thread AND c.id=f.id AND c.text=f.text",[],|r|r.get(0))?;
    if chunks != fts || chunks != matching {
        return Err(RecoveryError::SourceIntegrity);
    }
    let records: i64 = c.query_row("SELECT count(*) FROM records", [], |r| r.get(0))?;
    if records != objects.len() as i64 {
        return Err(RecoveryError::SourceIntegrity);
    }
    let mut ids = BTreeSet::new();
    let mut pdfs = 0;
    let mut maps = 0;
    for o in objects {
        let s = o.scope.native()?;
        if !crate::identifier(&o.id)
            || !hex64(&o.payload_sha256)
            || !ids.insert((o.scope.clone(), o.kind.clone(), o.id.clone()))
        {
            return Err(RecoveryError::InvalidInput);
        }
        let payload:String=c.query_row("SELECT payload FROM records WHERE workspace=? AND matter=? AND thread=? AND kind=? AND id=?",params![s.workspace,s.matter,s.thread,o.kind,o.id],|r|r.get(0))?;
        if hash(payload.as_bytes()) != o.payload_sha256 {
            return Err(RecoveryError::SourceIntegrity);
        }
        if o.kind == "document" {
            pdfs += 1;
            let (bytes,stored_hash):(Vec<u8>,String)=c.query_row("SELECT bytes,sha256 FROM originals WHERE workspace=? AND matter=? AND thread=? AND document_id=?",params![s.workspace,s.matter,s.thread,o.id],|r|Ok((r.get(0)?,r.get(1)?)))?;
            if bytes.len() > 1024 * 1024
                || !bytes.starts_with(b"%PDF-")
                || o.original_bytes != Some(bytes.len() as u64)
                || o.original_sha256.as_deref() != Some(&hash(&bytes))
                || stored_hash != hash(&bytes)
                || o.parent_document_id.is_some()
                || o.namespace.is_some()
                || o.map_version.is_some()
                || o.parent_original_sha256.is_some()
                || o.parent_text_sha256.is_some()
            {
                return Err(RecoveryError::SourceIntegrity);
            }
        } else if o.kind == "note" {
            maps += 1;
            if payload.len() > 65536
                || o.original_sha256.is_some()
                || o.original_bytes.is_some()
                || o.namespace.as_deref() != Some("lex-synthetic-opaque-map")
                || o.map_version != Some(1)
            {
                return Err(RecoveryError::SourceIntegrity);
            }
            let note: MapNote = strict_json(payload.as_bytes())?;
            if note.id != o.id
                || note.workspace_id != s.workspace
                || note.matter_id != s.matter
                || note.thread_id.as_deref().unwrap_or("") != s.thread
                || Some(&note.parent_document_id) != o.parent_document_id.as_ref()
                || Some(&note.parent_original_sha256) != o.parent_original_sha256.as_ref()
                || Some(&note.parent_text_sha256) != o.parent_text_sha256.as_ref()
                || Some(&note.namespace) != o.namespace.as_ref()
                || Some(note.map_version) != o.map_version
                || note.mapping.len() > 65536
            {
                return Err(RecoveryError::SourceIntegrity);
            }
            let parent = objects
                .iter()
                .find(|p| {
                    p.kind == "document" && p.scope == o.scope && p.id == note.parent_document_id
                })
                .ok_or(RecoveryError::SourceIntegrity)?;
            if parent.original_sha256.as_ref() != Some(&note.parent_original_sha256) {
                return Err(RecoveryError::SourceIntegrity);
            }
            let text:String=c.query_row("SELECT text FROM chunks WHERE workspace=? AND matter=? AND thread=? AND document_id=? ORDER BY id LIMIT 1",params![s.workspace,s.matter,s.thread,note.parent_document_id],|r|r.get(0))?;
            if hash(text.as_bytes()) != note.parent_text_sha256 {
                return Err(RecoveryError::SourceIntegrity);
            }
        } else {
            return Err(RecoveryError::UnsupportedFormat);
        }
    }
    if pdfs == 0 || pdfs > 4 || maps == 0 || maps > 4 {
        return Err(RecoveryError::ResourceLimit);
    }
    Ok(Inventory {
        schema_digest: format!("{:x}", schema_hash.finalize()),
        cipher_version: c.query_row("PRAGMA cipher_version", [], |r| r.get(0))?,
        sqlite_version: c.query_row("SELECT sqlite_version()", [], |r| r.get(0))?,
        provider: c.query_row("PRAGMA cipher_provider", [], |r| r.get(0))?,
        revisions,
        tables,
        objects: objects.to_vec(),
    })
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
#[derive(zeroize::Zeroize, zeroize::ZeroizeOnDrop)]
struct MapNote {
    id: String,
    workspace_id: String,
    matter_id: String,
    thread_id: Option<String>,
    namespace: String,
    map_version: u32,
    parent_document_id: String,
    parent_original_sha256: String,
    parent_text_sha256: String,
    mapping: String,
}

pub struct RecoveryPassphrase(Zeroizing<String>);
impl RecoveryPassphrase {
    pub fn generate_synthetic() -> R<Self> {
        let mut bytes = Zeroizing::new([0u8; 32]);
        getrandom::fill(bytes.as_mut()).map_err(|_| RecoveryError::UnsupportedBackend)?;
        let mut text = Zeroizing::new(String::with_capacity(64));
        const HEX: &[u8] = b"0123456789abcdef";
        for b in bytes.iter() {
            text.push(HEX[(b >> 4) as usize] as char);
            text.push(HEX[(b & 15) as usize] as char);
        }
        Ok(Self(text))
    }
    pub fn from_private_bytes(bytes: &[u8]) -> R<Self> {
        if !(32..=128).contains(&bytes.len()) || !bytes.iter().all(|b| b.is_ascii_graphic()) {
            return Err(RecoveryError::MissingCredential);
        }
        Ok(Self(Zeroizing::new(
            String::from_utf8(bytes.to_vec()).map_err(|_| RecoveryError::MissingCredential)?,
        )))
    }
    pub fn write_private(&self, writer: &mut impl Write) -> R<()> {
        writer.write_all(&(self.0.len() as u32).to_be_bytes())?;
        writer.write_all(self.0.as_bytes())?;
        Ok(())
    }
    fn age_secret(&self) -> age::secrecy::SecretString {
        self.0.as_str().to_owned().into()
    }
}
pub struct SyntheticRecoveryBundle {
    root: TempDir,
}
impl SyntheticRecoveryBundle {
    pub fn ciphertext(&self) -> R<Vec<u8>> {
        let file = File::open(self.root.path().join("bundle.age"))?;
        let mut bytes = Vec::new();
        file.take((MAX_CIPHERTEXT + 1) as u64)
            .read_to_end(&mut bytes)?;
        if bytes.len() > MAX_CIPHERTEXT {
            return Err(RecoveryError::ResourceLimit);
        }
        Ok(bytes)
    }
}
struct LimitedWriter<W> {
    inner: W,
    written: usize,
}
impl<W: Write> Write for LimitedWriter<W> {
    fn write(&mut self, b: &[u8]) -> std::io::Result<usize> {
        if b.len() > MAX_CIPHERTEXT - self.written {
            return Err(std::io::ErrorKind::FileTooLarge.into());
        }
        let n = self.inner.write(b)?;
        self.written += n;
        Ok(n)
    }
    fn flush(&mut self) -> std::io::Result<()> {
        self.inner.flush()
    }
}
fn encode_age(bytes: &[u8], passphrase: &RecoveryPassphrase, at: RecoveryFailpoint) -> R<Vec<u8>> {
    let mut recipient = age::scrypt::Recipient::new(passphrase.age_secret());
    recipient.set_work_factor(18);
    let encryptor =
        age::Encryptor::with_recipients(std::iter::once(&recipient as &dyn age::Recipient))
            .map_err(|_| RecoveryError::CannotDecrypt)?;
    let writer = LimitedWriter {
        inner: Vec::new(),
        written: 0,
    };
    let mut output = encryptor.wrap_output(writer)?;
    output.write_all(bytes)?;
    stop(at, RecoveryFailpoint::PreAgeFinish)?;
    let writer = output.finish()?;
    Ok(writer.inner)
}
impl ClosedSyntheticSource {
    fn payload(&self) -> R<Zeroizing<Vec<u8>>> {
        self.verify_preserved()?;
        let store = read_source(&self.source.root)?;
        let manifest = Manifest {
            format_version: 1,
            manifest_version: 1,
            payload_encoding: "sqlcipher-bytes-v1".into(),
            serialization_version: 1,
            crypto_profile: "age-scrypt-log18".into(),
            age_version: "0.12.1".into(),
            source_and_lock_pins: pins(),
            expected: self.expected.clone(),
            schema_version: 4,
            store_bytes: store.len() as u64,
            store_sha256: hash(&store),
            key_bytes_sha256: hash(&self.key.0),
            scope_revision_digest: hash(
                &serde_json::to_vec(&self.expected.inventory.revisions)
                    .map_err(|_| RecoveryError::InvalidInput)?,
            ),
            synthetic: true,
            production_enabled: false,
            no_execution: true,
        };
        let json =
            Zeroizing::new(serde_json::to_vec(&manifest).map_err(|_| RecoveryError::InvalidInput)?);
        if json.len() > MAX_MANIFEST {
            return Err(RecoveryError::ResourceLimit);
        }
        let total = MAGIC
            .len()
            .checked_add(4)
            .and_then(|n| n.checked_add(json.len()))
            .and_then(|n| n.checked_add(32))
            .and_then(|n| n.checked_add(store.len()))
            .ok_or(RecoveryError::ResourceLimit)?;
        if total > MAX_PLAINTEXT {
            return Err(RecoveryError::ResourceLimit);
        }
        let mut bytes = Zeroizing::new(Vec::with_capacity(total));
        bytes.extend_from_slice(MAGIC);
        bytes.extend_from_slice(&(json.len() as u32).to_be_bytes());
        bytes.extend_from_slice(&json);
        bytes.extend_from_slice(&self.key.0);
        bytes.extend_from_slice(&store);
        Ok(bytes)
    }
    pub fn export_recovery(
        &self,
        passphrase: &RecoveryPassphrase,
        at: RecoveryFailpoint,
    ) -> R<SyntheticRecoveryBundle> {
        stop(at, RecoveryFailpoint::CopyCiphertext)?;
        let payload = self.payload()?;
        let encrypted = encode_age(&payload, passphrase, at)?;
        let root = tempfile::Builder::new()
            .prefix("lex-recovery-bundle-synthetic-")
            .tempdir()?;
        fs::set_permissions(root.path(), fs::Permissions::from_mode(0o700))?;
        let mut file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .mode(0o600)
            .open(root.path().join("bundle.age"))?;
        file.write_all(&encrypted)?;
        stop(at, RecoveryFailpoint::PostFinishPreSync)?;
        file.flush()?;
        file.sync_all()?;
        File::open(root.path())?.sync_all()?;
        self.verify_preserved()?;
        stop(at, RecoveryFailpoint::PreBundlePublication)?;
        Ok(SyntheticRecoveryBundle { root })
    }
}
/// A strict application profile preflight; age still parses/authenticates its own format.
pub fn recovery_preflight(ciphertext: &[u8]) -> R<()> {
    if ciphertext.len() > MAX_CIPHERTEXT {
        return Err(RecoveryError::ResourceLimit);
    }
    let mut header_end = None;
    for (i, b) in ciphertext.iter().take(MAX_HEADER + 1).enumerate() {
        if *b == b'\n' && i >= 4 {
            let line_start = ciphertext[..i]
                .iter()
                .rposition(|b| *b == b'\n')
                .map(|n| n + 1)
                .unwrap_or(0);
            if ciphertext[line_start..i].starts_with(b"--- ") {
                header_end = Some(i + 1);
                break;
            }
        }
    }
    let end = header_end.ok_or(RecoveryError::ResourceLimit)?;
    if end > MAX_HEADER {
        return Err(RecoveryError::ResourceLimit);
    }
    let header =
        std::str::from_utf8(&ciphertext[..end]).map_err(|_| RecoveryError::UnsupportedFormat)?;
    let lines: Vec<_> = header.lines().collect();
    if lines.len() != 4 || lines[0] != "age-encryption.org/v1" {
        return Err(RecoveryError::UnsupportedFormat);
    }
    let fields: Vec<_> = lines[1].split(' ').collect();
    if fields.len() != 4 || fields[0] != "->" || fields[1] != "scrypt" || fields[2].len() != 22 {
        return Err(RecoveryError::UnsupportedFormat);
    }
    if fields[3] != "18" {
        return Err(RecoveryError::ResourceLimit);
    }
    let b64 = |s: &str| {
        s.bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'+' || b == b'/')
    };
    if !b64(fields[2])
        || lines[2].len() != 43
        || !b64(lines[2])
        || !lines[3].starts_with("--- ")
        || lines[3].len() != 47
        || !b64(&lines[3][4..])
    {
        return Err(RecoveryError::UnsupportedFormat);
    }
    Ok(())
}
fn decode_age(ciphertext: &[u8], passphrase: &RecoveryPassphrase) -> R<Zeroizing<Vec<u8>>> {
    recovery_preflight(ciphertext)?;
    let mut cursor = std::io::Cursor::new(ciphertext);
    let decryptor =
        age::Decryptor::new_buffered(&mut cursor).map_err(|_| RecoveryError::CannotDecrypt)?;
    if !decryptor.is_scrypt() {
        return Err(RecoveryError::UnsupportedFormat);
    }
    let mut identity = age::scrypt::Identity::new(passphrase.age_secret());
    identity.set_max_work_factor(18);
    let mut reader = decryptor
        .decrypt(std::iter::once(&identity as &dyn age::Identity))
        .map_err(|_| RecoveryError::CannotDecrypt)?;
    let mut plain = Zeroizing::new(Vec::with_capacity(MAX_PLAINTEXT));
    let mut chunk = Zeroizing::new([0u8; 65536]);
    loop {
        let n = reader
            .read(chunk.as_mut())
            .map_err(|_| RecoveryError::CannotDecrypt)?;
        if n == 0 {
            break;
        }
        if n > MAX_PLAINTEXT - plain.len() {
            return Err(RecoveryError::ResourceLimit);
        }
        plain.extend_from_slice(&chunk[..n]);
    }
    drop(reader);
    if cursor.position() != ciphertext.len() as u64 {
        return Err(RecoveryError::CannotDecrypt);
    }
    Ok(plain)
}
pub struct RestoredSyntheticVault {
    vault: Vault,
    key: KeyMaterial,
    expected: SyntheticRecoveryExpectation,
    epoch: String,
}
impl RestoredSyntheticVault {
    pub fn restore_epoch(&self) -> &str {
        &self.epoch
    }
    fn scoped(&self, s: &Scope) -> R<()> {
        if !self.expected.inventory.revisions.iter().any(|r| {
            r.scope.workspace == s.workspace
                && r.scope.matter == s.matter
                && r.scope.thread.as_deref().unwrap_or("") == s.thread
        }) {
            return Err(RecoveryError::ScopeMismatch);
        }
        Ok(())
    }
    pub fn get(&self, s: &Scope, kind: crate::Kind, id: &str) -> R<Option<String>> {
        self.scoped(s)?;
        self.vault
            .get(s, kind, id)
            .map_err(|_| RecoveryError::SourceIntegrity)
    }
    pub fn original(&self, s: &Scope, id: &str) -> R<Option<Vec<u8>>> {
        self.scoped(s)?;
        self.vault
            .original(s, id)
            .map_err(|_| RecoveryError::SourceIntegrity)
    }
    pub fn search(&self, s: &Scope, query: &str, limit: u32) -> R<Vec<crate::Hit>> {
        self.scoped(s)?;
        self.vault
            .search(s, query, limit)
            .map_err(|_| RecoveryError::SourceIntegrity)
    }
    pub fn revision(&self, s: &Scope) -> R<i64> {
        self.scoped(s)?;
        self.vault
            .revision(s)
            .map_err(|_| RecoveryError::SourceIntegrity)
    }
    pub fn verify_readonly(&self) -> R<()> {
        let c = self
            .vault
            .connection
            .as_ref()
            .ok_or(RecoveryError::InvalidInput)?;
        if inventory(c, &self.expected.inventory.objects)? != self.expected.inventory {
            return Err(RecoveryError::SourceIntegrity);
        }
        Ok(())
    }
    pub fn close_and_reopen_readonly(&mut self) -> R<()> {
        if let Some(c) = self.vault.connection.take() {
            if let Err((c, _)) = c.close() {
                self.vault.connection = Some(c);
                return Err(RecoveryError::StorageFailure);
            }
        }
        self.vault.connection = Some(readonly(&self.vault._root, &self.key)?);
        self.verify_readonly()
    }
}
pub fn restore_synthetic(
    ciphertext: &[u8],
    passphrase: Option<&RecoveryPassphrase>,
    expected: &SyntheticRecoveryExpectation,
    at: RecoveryFailpoint,
) -> R<RestoredSyntheticVault> {
    expected.validate()?;
    let passphrase = passphrase.ok_or(RecoveryError::MissingCredential)?;
    stop(at, RecoveryFailpoint::Decrypt)?;
    let plain = decode_age(ciphertext, passphrase)?;
    if plain.len() < MAGIC.len() + 4 || &plain[..MAGIC.len()] != MAGIC {
        return Err(RecoveryError::UnsupportedFormat);
    }
    let n = u32::from_be_bytes(
        plain[MAGIC.len()..MAGIC.len() + 4]
            .try_into()
            .map_err(|_| RecoveryError::UnsupportedFormat)?,
    ) as usize;
    if n > MAX_MANIFEST {
        return Err(RecoveryError::ResourceLimit);
    }
    let start = MAGIC.len() + 4;
    let key_start = start.checked_add(n).ok_or(RecoveryError::ResourceLimit)?;
    let store_start = key_start
        .checked_add(32)
        .ok_or(RecoveryError::ResourceLimit)?;
    if store_start > plain.len() {
        return Err(RecoveryError::UnsupportedFormat);
    }
    let m: Manifest = strict_json(&plain[start..key_start])?;
    let canonical =
        Zeroizing::new(serde_json::to_vec(&m).map_err(|_| RecoveryError::UnsupportedFormat)?);
    if canonical.as_slice() != &plain[start..key_start] {
        return Err(RecoveryError::UnsupportedFormat);
    }
    if m.format_version != 1
        || m.manifest_version != 1
        || m.serialization_version != 1
        || m.schema_version != 4
        || m.payload_encoding != "sqlcipher-bytes-v1"
        || m.crypto_profile != "age-scrypt-log18"
        || m.age_version != "0.12.1"
        || m.source_and_lock_pins != pins()
        || !m.synthetic
        || m.production_enabled
        || !m.no_execution
    {
        return Err(RecoveryError::UnsupportedFormat);
    }
    if &m.expected != expected {
        return Err(RecoveryError::ScopeMismatch);
    }
    if m.store_bytes == 0
        || m.store_bytes > MAX_DATABASE as u64
        || store_start.checked_add(m.store_bytes as usize) != Some(plain.len())
    {
        return Err(RecoveryError::UnsupportedFormat);
    }
    if m.scope_revision_digest
        != hash(
            &serde_json::to_vec(&expected.inventory.revisions)
                .map_err(|_| RecoveryError::UnsupportedFormat)?,
        )
        || m.store_sha256 != hash(&plain[store_start..])
        || m.key_bytes_sha256 != hash(&plain[key_start..store_start])
    {
        return Err(RecoveryError::SourceIntegrity);
    }
    let mut key = KeyMaterial([0; 32]);
    key.0.copy_from_slice(&plain[key_start..store_start]);
    stop(at, RecoveryFailpoint::PreStagingWrite)?;
    let root = Arc::new(
        tempfile::Builder::new()
            .prefix("lex-recovery-restore-synthetic-")
            .tempdir()?,
    );
    fs::set_permissions(root.path(), fs::Permissions::from_mode(0o700))?;
    let path = root.path().join("vault.sqlite");
    if at == RecoveryFailpoint::StagingCollision {
        OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(&path)?;
    }
    let mut f = OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(&path)?;
    for chunk in plain[store_start..].chunks(65536) {
        f.write_all(chunk)?;
    }
    f.flush()?;
    f.sync_all()?;
    drop(f);
    File::open(root.path())?.sync_all()?;
    stop(at, RecoveryFailpoint::PostStagingWrite)?;
    stop(at, RecoveryFailpoint::ValidateDatabase)?;
    if hash(&read_source(&root)?) != m.store_sha256 {
        return Err(RecoveryError::SourceIntegrity);
    }
    let connection = readonly(&root, &key)?;
    if inventory(&connection, &expected.inventory.objects)? != expected.inventory {
        return Err(RecoveryError::SourceIntegrity);
    }
    let epoch = random_id()?;
    if epoch == expected.source_lineage_id
        || epoch == expected.source_vault_id
        || epoch == expected.snapshot_id
    {
        return Err(RecoveryError::SourceIntegrity);
    }
    let restored = RestoredSyntheticVault {
        vault: Vault {
            connection: Some(connection),
            _root: root,
        },
        key,
        expected: expected.clone(),
        epoch,
    };
    stop(at, RecoveryFailpoint::PreCapabilityPublication)?;
    Ok(restored)
}

/// Retains original ciphertext ownership after deliberately dropping the original DEK.
/// No writable/reopen API or key survives in this capability.
pub struct RetainedCiphertextSource {
    source: SyntheticVault,
    sha256: String,
    stamp: SourceStamp,
}
impl ClosedSyntheticSource {
    pub fn retire_key(self) -> RetainedCiphertextSource {
        let Self {
            source,
            key,
            expected: _,
            store_hash,
            stamp,
        } = self;
        drop(key);
        RetainedCiphertextSource {
            source,
            sha256: store_hash,
            stamp,
        }
    }
}
impl RetainedCiphertextSource {
    pub fn verify_ciphertext_preserved(&self) -> R<()> {
        if hash(&read_source(&self.source.root)?) != self.sha256
            || source_stamp(&self.source.root)? != self.stamp
        {
            return Err(RecoveryError::SourceIntegrity);
        }
        Ok(())
    }
}

/// Explicitly synthetic negative-fixture builder. It never restores or publishes a capability.
/// Each use must be counted in the test preparation ledger, never hidden as a retry.
pub enum RecoveryFixtureMutation {
    InternalAppend,
    OversizedPlaintext,
}
pub fn synthetic_negative_envelope(
    source: &ClosedSyntheticSource,
    passphrase: &RecoveryPassphrase,
    mutation: RecoveryFixtureMutation,
) -> R<Vec<u8>> {
    let mut bytes = source.payload()?;
    match mutation {
        RecoveryFixtureMutation::InternalAppend => bytes.push(0x42),
        RecoveryFixtureMutation::OversizedPlaintext => bytes.resize(MAX_PLAINTEXT + 1, 0x42),
    }
    encode_age(&bytes, passphrase, RecoveryFailpoint::None)
}

impl Drop for Manifest {
    fn drop(&mut self) {
        self.payload_encoding.zeroize();
        self.crypto_profile.zeroize();
        self.age_version.zeroize();
        for (mut key, mut value) in std::mem::take(&mut self.source_and_lock_pins) {
            key.zeroize();
            value.zeroize();
        }
        self.store_sha256.zeroize();
        self.key_bytes_sha256.zeroize();
        self.scope_revision_digest.zeroize();
    }
}

impl ClosedSyntheticSource {
    /// Synthetic scanner observes only supplied ciphertext and returns no key/secret bytes.
    pub fn ciphertext_secret_scan(
        &self,
        passphrase: &RecoveryPassphrase,
        ciphertext: &[u8],
    ) -> R<()> {
        if ciphertext.len() > MAX_CIPHERTEXT {
            return Err(RecoveryError::ResourceLimit);
        }
        if ciphertext
            .windows(self.key.0.len())
            .any(|w| w == self.key.0)
            || ciphertext
                .windows(passphrase.0.len())
                .any(|w| w == passphrase.0.as_bytes())
            || ciphertext
                .windows(b"keyBytesSha256".len())
                .any(|w| w == b"keyBytesSha256")
        {
            return Err(RecoveryError::SourceIntegrity);
        }
        Ok(())
    }
}
