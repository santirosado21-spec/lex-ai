//! H5b.2c: synthetic-only, local encrypted matter mapping history.
//! No product broker, caller authorization, plaintext export or remote API.
//! No sensitive entry text in errors, audit records or Debug implementations.
use crate::{advance, identifier, Error, Result, Scope, Vault};
use rusqlite::{params, OptionalExtension, TransactionBehavior};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

const MAX_ENTRIES: usize = 256;
const MAX_VERSIONS: i64 = 64;
const MAX_SOURCES: usize = 64;
const MAX_TEXT_UTF16: usize = 1024;

pub(crate) const SCHEMA: &str = r#"
CREATE TABLE pseudonym_spaces(
  workspace TEXT NOT NULL, matter TEXT NOT NULL, namespace TEXT NOT NULL UNIQUE,
  active_version TEXT, PRIMARY KEY(workspace,matter),
  FOREIGN KEY(workspace,matter,active_version)
    REFERENCES pseudonym_versions(workspace,matter,version_id) DEFERRABLE INITIALLY DEFERRED);
CREATE TABLE pseudonym_versions(
  workspace TEXT NOT NULL, matter TEXT NOT NULL, version_id TEXT NOT NULL,
  parent_version_id TEXT, serialization_version INTEGER NOT NULL CHECK(serialization_version=1),
  PRIMARY KEY(workspace,matter,version_id),
  FOREIGN KEY(workspace,matter,parent_version_id)
    REFERENCES pseudonym_versions(workspace,matter,version_id));
CREATE TABLE pseudonym_marker_registry(
  workspace TEXT NOT NULL, matter TEXT NOT NULL, marker TEXT NOT NULL, original_text TEXT NOT NULL,
  PRIMARY KEY(workspace,matter,marker),
  FOREIGN KEY(workspace,matter) REFERENCES pseudonym_spaces(workspace,matter));
CREATE TABLE pseudonym_version_entries(
  workspace TEXT NOT NULL, matter TEXT NOT NULL, version_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL CHECK(ordinal>=0), marker TEXT NOT NULL,
  PRIMARY KEY(workspace,matter,version_id,ordinal),
  UNIQUE(workspace,matter,version_id,marker),
  FOREIGN KEY(workspace,matter,version_id) REFERENCES pseudonym_versions(workspace,matter,version_id),
  FOREIGN KEY(workspace,matter,marker) REFERENCES pseudonym_marker_registry(workspace,matter,marker));
CREATE TABLE pseudonym_sources(
  workspace TEXT NOT NULL, matter TEXT NOT NULL, version_id TEXT NOT NULL,
  document_id TEXT NOT NULL, source_version TEXT NOT NULL,
  sha256 TEXT NOT NULL, source_thread TEXT NOT NULL DEFAULT '' CHECK(source_thread=''),
  PRIMARY KEY(workspace,matter,version_id,document_id),
  FOREIGN KEY(workspace,matter,version_id) REFERENCES pseudonym_versions(workspace,matter,version_id),
  FOREIGN KEY(workspace,matter,source_thread,document_id)
    REFERENCES originals(workspace,matter,thread,document_id));
CREATE TABLE pseudonym_audits(
  workspace TEXT NOT NULL, matter TEXT NOT NULL, revision INTEGER NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('commit','activate')),
  version_id TEXT NOT NULL, previous_version_id TEXT,
  PRIMARY KEY(workspace,matter,revision),
  FOREIGN KEY(workspace,matter,version_id) REFERENCES pseudonym_versions(workspace,matter,version_id));
CREATE TRIGGER pseudonym_versions_no_update BEFORE UPDATE ON pseudonym_versions BEGIN SELECT RAISE(ABORT,'immutable'); END;
CREATE TRIGGER pseudonym_versions_no_delete BEFORE DELETE ON pseudonym_versions BEGIN SELECT RAISE(ABORT,'immutable'); END;
CREATE TRIGGER pseudonym_marker_no_update BEFORE UPDATE ON pseudonym_marker_registry BEGIN SELECT RAISE(ABORT,'immutable'); END;
CREATE TRIGGER pseudonym_marker_no_delete BEFORE DELETE ON pseudonym_marker_registry BEGIN SELECT RAISE(ABORT,'immutable'); END;
CREATE TRIGGER pseudonym_entries_no_update BEFORE UPDATE ON pseudonym_version_entries BEGIN SELECT RAISE(ABORT,'immutable'); END;
CREATE TRIGGER pseudonym_entries_no_delete BEFORE DELETE ON pseudonym_version_entries BEGIN SELECT RAISE(ABORT,'immutable'); END;
CREATE TRIGGER pseudonym_sources_no_update BEFORE UPDATE ON pseudonym_sources BEGIN SELECT RAISE(ABORT,'immutable'); END;
CREATE TRIGGER pseudonym_sources_no_delete BEFORE DELETE ON pseudonym_sources BEGIN SELECT RAISE(ABORT,'immutable'); END;
CREATE TRIGGER pseudonym_audits_no_update BEFORE UPDATE ON pseudonym_audits BEGIN SELECT RAISE(ABORT,'immutable'); END;
CREATE TRIGGER pseudonym_audits_no_delete BEFORE DELETE ON pseudonym_audits BEGIN SELECT RAISE(ABORT,'immutable'); END;
PRAGMA user_version=5;
"#;

/// Exact sensitive entries, for the trusted local broker only. Deliberately no Debug.
#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PseudonymEntry {
    pub text: String,
    pub marker: String,
}
/// A provenance reference: SHA-256 is checked against the scoped immutable original.
/// sourceVersion is caller-provided metadata; the future authorized broker must authenticate it.
#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PseudonymSource {
    pub document_id: String,
    pub source_version: String,
    pub sha256: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NewPseudonymVersion {
    pub namespace: String,
    pub version_id: String,
    pub parent_version_id: Option<String>,
    pub serialization_version: u32,
    pub entries: Vec<PseudonymEntry>,
    pub sources: Vec<PseudonymSource>,
}
/// Returned only to a future authorized local adapter; never log or send this record.
pub struct PseudonymVersion {
    pub namespace: String,
    pub version_id: String,
    pub parent_version_id: Option<String>,
    pub serialization_version: u32,
    pub entries: Vec<PseudonymEntry>,
    pub sources: Vec<PseudonymSource>,
}
/// Metadata-only: no text, marker or document contents are accessible through audits.
#[derive(PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PseudonymAudit {
    pub revision: i64,
    pub action: String,
    pub version_id: String,
    pub previous_version_id: Option<String>,
}
fn opaque(s: &str) -> bool {
    s.len() == 32 && s.bytes().all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase())
}
fn digest(s: &str) -> bool {
    s.len() == 64 && s.bytes().all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
}
fn exact_matter(scope: &Scope) -> Result<()> {
    // H3's shared matter maps are intentionally exposed ONLY at null-thread scope.
    // A broker must validate the actual caller's thread before selecting this scope.
    if !scope.thread.is_empty() { return Err(Error::InvalidInput); }
    Ok(())
}
fn valid_entry(e: &PseudonymEntry, namespace: &str) -> bool {
    let len = e.text.encode_utf16().count();
    if len == 0 || len > MAX_TEXT_UTF16 || e.text.contains("[[LEX_") { return false; }
    let prefix = format!("[[LEX_{namespace}_");
    e.marker.starts_with(&prefix) &&
        e.marker.ends_with("]]") &&
        e.marker.len() == prefix.len()+32+2 &&
        opaque(&e.marker[prefix.len()..prefix.len()+32])
}
impl Vault {
    fn maps_schema(&self) -> Result<()> {
        let v: i64 = self.conn()?.query_row("PRAGMA user_version", [], |r| r.get(0))?;
        if v != 5 { return Err(Error::CannotOpen); }
        Ok(())
    }
    /// Commit immutable version and activate it atomically under a revision and active-ID CAS.
    /// Input is strict JSON so unexpected fields fail instead of silently changing contracts.
    /// Returns the one new scope revision; no sensitive contents are ever audited.
    pub fn commit_pseudonym_version(
        &mut self, scope: &Scope, expected_revision: i64,
        expected_active_version: Option<&str>, version_json: &str
    ) -> Result<i64> {
        self.maps_schema()?;
        exact_matter(scope)?;
        let v: NewPseudonymVersion =
            serde_json::from_str(version_json).map_err(|_| Error::InvalidInput)?;
        if !opaque(&v.namespace) || !opaque(&v.version_id) ||
            v.parent_version_id.as_deref().is_some_and(|p| !opaque(p)) ||
            v.parent_version_id.as_deref() == Some(v.version_id.as_str()) ||
            v.serialization_version != 1 || v.entries.len() > MAX_ENTRIES ||
            v.sources.len() > MAX_SOURCES ||
            expected_active_version.is_some_and(|id| !opaque(id)) ||
            v.entries.iter().any(|e| !valid_entry(e,&v.namespace)) ||
            v.sources.iter().any(|s| !identifier(&s.document_id) ||
                !identifier(&s.source_version) || !digest(&s.sha256))
        { return Err(Error::InvalidInput); }
        let mut texts=HashSet::new();
        let mut markers=HashSet::new();
        for e in &v.entries {
            if !texts.insert(e.text.as_str()) || !markers.insert(e.marker.as_str()) {
                return Err(Error::InvalidInput);
            }
        }
        let tx=self.conn_mut()?.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let current: Option<(String,Option<String>)> = tx.query_row(
            "SELECT namespace,active_version FROM pseudonym_spaces WHERE workspace=? AND matter=?",
            params![scope.workspace,scope.matter], |r| Ok((r.get(0)?,r.get(1)?))
        ).optional()?;
        let active=current.as_ref().and_then(|(_,active)|active.as_deref());
        if active != expected_active_version { return Err(Error::Conflict); }
        if current.as_ref().is_some_and(|(ns,_)|ns != &v.namespace) {
            return Err(Error::InvalidInput);
        }
        let count: i64=tx.query_row(
            "SELECT COUNT(*) FROM pseudonym_versions WHERE workspace=? AND matter=?",
            params![scope.workspace,scope.matter],|r|r.get(0))?;
        if count>=MAX_VERSIONS { return Err(Error::InvalidInput); }
        // New version MUST derive from the current active version. An activation
        // rollback never grants reuse of a discarded version ID or marker.
        if v.parent_version_id.as_deref() != active {
            return Err(Error::Conflict);
        }
        let parent_entries:Vec<(String,String)> = if let Some(parent)=active {
            let mut stmt=tx.prepare(
                "SELECT e.marker,r.original_text FROM pseudonym_version_entries e
                 JOIN pseudonym_marker_registry r ON r.workspace=e.workspace
                   AND r.matter=e.matter AND r.marker=e.marker
                 WHERE e.workspace=? AND e.matter=? AND e.version_id=? ORDER BY e.ordinal")?;
            stmt.query_map(params![scope.workspace,scope.matter,parent],
                |r|Ok((r.get(0)?,r.get(1)?)))?
                .collect::<rusqlite::Result<_>>()?
        } else {vec![]};
        if v.entries.len()<parent_entries.len() ||
           parent_entries.iter().zip(&v.entries).any(|((marker,text),e)| marker != &e.marker || text != &e.text) {
            return Err(Error::InvalidInput);
        }
        // Validate all references against originals, including exact bytes hash.
        for s in &v.sources {
            let original_hash: Option<String>=tx.query_row(
                "SELECT sha256 FROM originals WHERE workspace=? AND matter=? AND thread='' AND document_id=?",
                params![scope.workspace,scope.matter,s.document_id],|r|r.get(0)).optional()?;
            if original_hash.as_deref()!=Some(s.sha256.as_str()) {return Err(Error::InvalidInput);}
        }
        let revision=advance(&tx,scope,expected_revision)?;
        if current.is_none() {
            tx.execute("INSERT INTO pseudonym_spaces(workspace,matter,namespace,active_version) VALUES(?,?,?,NULL)",
                params![scope.workspace,scope.matter,v.namespace])?;
        }
        tx.execute(
            "INSERT INTO pseudonym_versions(workspace,matter,version_id,parent_version_id,serialization_version) VALUES(?,?,?,?,?)",
            params![scope.workspace,scope.matter,v.version_id,v.parent_version_id,v.serialization_version]
        )?;
        for (i,e) in v.entries.iter().enumerate() {
            if i>=parent_entries.len() {
                // A previously used token, including in a rolled-back branch, cannot be reused.
                tx.execute("INSERT INTO pseudonym_marker_registry VALUES(?,?,?,?)",
                    params![scope.workspace,scope.matter,e.marker,e.text])?;
            }
            tx.execute("INSERT INTO pseudonym_version_entries VALUES(?,?,?,?,?)",
                params![scope.workspace,scope.matter,v.version_id,i as i64,e.marker])?;
        }
        for s in &v.sources {
            tx.execute("INSERT INTO pseudonym_sources(workspace,matter,version_id,document_id,source_version,sha256,source_thread) VALUES(?,?,?,?,?,?,'')",
                params![scope.workspace,scope.matter,v.version_id,s.document_id,s.source_version,s.sha256])?;
        }
        tx.execute("UPDATE pseudonym_spaces SET active_version=? WHERE workspace=? AND matter=?",
            params![v.version_id,scope.workspace,scope.matter])?;
        tx.execute("INSERT INTO pseudonym_audits VALUES(?,?,?,?,?,?)",
            params![scope.workspace,scope.matter,revision,"commit",v.version_id,active])?;
        tx.commit()?;
        Ok(revision)
    }
    pub fn activate_pseudonym_version(
        &mut self, scope:&Scope, expected_revision:i64,
        expected_active_version: Option<&str>, retained_version_id:&str
    ) -> Result<i64> {
        self.maps_schema()?;
        exact_matter(scope)?;
        if !opaque(retained_version_id) ||
            expected_active_version.is_some_and(|id| !opaque(id)) {return Err(Error::InvalidInput);}
        let tx=self.conn_mut()?.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let active:Option<Option<String>>=tx.query_row(
            "SELECT active_version FROM pseudonym_spaces WHERE workspace=? AND matter=?",
            params![scope.workspace,scope.matter],|r|r.get(0)).optional()?;
        let Some(active)=active else{return Err(Error::NotFound);};
        if active.as_deref()!=expected_active_version {return Err(Error::Conflict);}
        let found:bool=tx.query_row(
            "SELECT 1 FROM pseudonym_versions WHERE workspace=? AND matter=? AND version_id=?",
            params![scope.workspace,scope.matter,retained_version_id], |_|Ok(())).optional()?.is_some();
        if !found {return Err(Error::NotFound);}
        let revision=advance(&tx,scope,expected_revision)?;
        tx.execute("UPDATE pseudonym_spaces SET active_version=? WHERE workspace=? AND matter=?",
            params![retained_version_id,scope.workspace,scope.matter])?;
        tx.execute("INSERT INTO pseudonym_audits VALUES(?,?,?,?,?,?)",
            params![scope.workspace,scope.matter,revision,"activate",retained_version_id,active])?;
        tx.commit()?;
        Ok(revision)
    }
    pub fn get_active_pseudonym_version(&self,scope:&Scope) -> Result<Option<PseudonymVersion>> {
        self.maps_schema()?;
        exact_matter(scope)?;
        let id:Option<String>=self.conn()?.query_row(
            "SELECT active_version FROM pseudonym_spaces WHERE workspace=? AND matter=?",
            params![scope.workspace,scope.matter],|r|r.get(0)).optional()?.flatten();
        match id {Some(id)=>self.get_pseudonym_version(scope,&id),None=>Ok(None)}
    }
    pub fn get_pseudonym_version(&self,scope:&Scope,id:&str) -> Result<Option<PseudonymVersion>> {
        self.maps_schema()?;
        exact_matter(scope)?;
        if !opaque(id) {return Err(Error::InvalidInput);}
        let c=self.conn()?;
        let meta:Option<(String,Option<String>,u32)>=c.query_row(
            "SELECT s.namespace,v.parent_version_id,v.serialization_version
             FROM pseudonym_versions v JOIN pseudonym_spaces s
              ON s.workspace=v.workspace AND s.matter=v.matter
             WHERE v.workspace=? AND v.matter=? AND v.version_id=?",
            params![scope.workspace,scope.matter,id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).optional()?;
        let Some((namespace,parent_version_id,serialization_version))=meta else{return Ok(None);};
        let entries=c.prepare(
            "SELECT r.original_text,e.marker FROM pseudonym_version_entries e
             JOIN pseudonym_marker_registry r ON r.workspace=e.workspace
              AND r.matter=e.matter AND r.marker=e.marker
             WHERE e.workspace=? AND e.matter=? AND e.version_id=? ORDER BY e.ordinal"
        )?.query_map(params![scope.workspace,scope.matter,id],
            |r|Ok(PseudonymEntry{text:r.get(0)?,marker:r.get(1)?}))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        let sources=c.prepare(
            "SELECT document_id,source_version,sha256 FROM pseudonym_sources
             WHERE workspace=? AND matter=? AND version_id=? ORDER BY rowid"
        )?.query_map(params![scope.workspace,scope.matter,id],
            |r|Ok(PseudonymSource{document_id:r.get(0)?,source_version:r.get(1)?,sha256:r.get(2)?}))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(Some(PseudonymVersion {namespace,version_id:id.into(),parent_version_id,
            serialization_version,entries,sources}))
    }
    pub fn list_pseudonym_audits(&self,scope:&Scope,limit:u32) -> Result<Vec<PseudonymAudit>> {
        self.maps_schema()?;
        exact_matter(scope)?;
        if !(1..=100).contains(&limit) {return Err(Error::InvalidInput);}
        Ok(self.conn()?.prepare(
            "SELECT revision,action,version_id,previous_version_id FROM pseudonym_audits
             WHERE workspace=? AND matter=? ORDER BY revision LIMIT ?"
        )?.query_map(params![scope.workspace,scope.matter,limit],
            |r|Ok(PseudonymAudit{revision:r.get(0)?,action:r.get(1)?,
              version_id:r.get(2)?,previous_version_id:r.get(3)?}))?
            .collect::<rusqlite::Result<Vec<_>>>()?)
    }
}


#[cfg(test)]
mod internal_schema_guards {
    use super::*;
    use serde_json::json;
    use sha2::{Digest,Sha256};

    #[test]
    fn immutable_history_tables_reject_update_and_delete_in_actual_sqlite() {
        let key=crate::KeyMaterial::generate().unwrap();
        let (_,mut v)=crate::SyntheticVault::create_with_pseudonym_maps(&key).unwrap();
        let s=Scope::new("firm","matter",None).unwrap();
        let bytes=b"FICTITIOUS_SOURCE_1";
        let payload=json!({"id":"doc_1","workspaceId":"firm","matterId":"matter","threadId":null}).to_string();
        let r=v.insert_document(&s,"doc_1",&payload,bytes,&[],0).unwrap();
        let ns="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        let id="11111111111111111111111111111111";
        let token=format!("[[LEX_{ns}_22222222222222222222222222222222]]");
        let data=json!({"namespace":ns,"versionId":id,"parentVersionId":null,
          "serializationVersion":1,
          "entries":[{"text":"PERSONA_FICTICIA_1","marker":token}],
          "sources":[{"documentId":"doc_1","sourceVersion":"source_1",
            "sha256":format!("{:x}",Sha256::digest(bytes))}]}).to_string();
        assert_eq!(v.commit_pseudonym_version(&s,r,None,&data).unwrap(),r+1);
        let statements=[
          "UPDATE pseudonym_versions SET serialization_version=1",
          "DELETE FROM pseudonym_versions",
          "UPDATE pseudonym_marker_registry SET original_text='MODIFICADO'",
          "DELETE FROM pseudonym_marker_registry",
          "UPDATE pseudonym_version_entries SET ordinal=0",
          "DELETE FROM pseudonym_version_entries",
          "UPDATE pseudonym_sources SET source_version='MODIFICADO'",
          "DELETE FROM pseudonym_sources",
          "UPDATE pseudonym_audits SET action='commit'",
          "DELETE FROM pseudonym_audits",
        ];
        for stmt in statements {
            assert!(v.conn().unwrap().execute(stmt,[]).is_err(),"immutable trigger missing");
        }
        assert_eq!(v.revision(&s).unwrap(),r+1);
        assert_eq!(v.get_pseudonym_version(&s,id).unwrap().unwrap().entries.len(),1);
        assert_eq!(v.list_pseudonym_audits(&s,10).unwrap().len(),1);
    }

    #[test]
    fn source_foreign_key_refuses_nonexistent_scoped_original_in_sql() {
        let key=crate::KeyMaterial::generate().unwrap();
        let (_,mut v)=crate::SyntheticVault::create_with_pseudonym_maps(&key).unwrap();
        let s=Scope::new("w","m",None).unwrap();
        let id="11111111111111111111111111111111";
        let ns="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        let data=json!({"namespace":ns,"versionId":id,"parentVersionId":null,
          "serializationVersion":1,"entries":[],"sources":[]}).to_string();
        v.commit_pseudonym_version(&s,0,None,&data).unwrap();
        let attempted=v.conn().unwrap().execute(
          "INSERT INTO pseudonym_sources(workspace,matter,version_id,document_id,source_version,sha256,source_thread) VALUES(?,?,?,?,?,?,'')",
          params!["w","m",id,"does_not_exist","v_1","0".repeat(64)]);
        assert!(attempted.is_err());
        assert!(v.get_pseudonym_version(&s,id).unwrap().unwrap().sources.is_empty());
    }
}
