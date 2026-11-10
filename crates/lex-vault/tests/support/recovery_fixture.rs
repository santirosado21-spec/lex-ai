use lex_vault::recovery::{
    RecoveryError, RecoveryObject, RecoveryScope, SyntheticRecoveryExpectation,
};
use lex_vault::{Chunk, KeyMaterial, SyntheticVault, Vault};
use serde_json::json;
use sha2::{Digest, Sha256};
pub const CANARY: &[u8] = b"SYNTHETIC_RECOVERY_PRIVATE_9472";
pub const TEXT: &str = "SYNTHETIC_RECOVERY_PRIVATE_9472 obligación José 😀 e\u{301}";
pub const PDF: &[u8] = b"%PDF-1.4\n%\xff\xfe\nSYNTHETIC_RECOVERY_PRIVATE_9472\n%%EOF\n";
pub fn hash(b: &[u8]) -> String {
    format!("{:x}", Sha256::digest(b))
}
pub fn scope() -> RecoveryScope {
    RecoveryScope {
        workspace: "synthetic_firm".into(),
        matter: "matter_a".into(),
        thread: Some("thread_a".into()),
    }
}
pub fn fixture() -> Result<
    (
        SyntheticVault,
        Vault,
        KeyMaterial,
        SyntheticRecoveryExpectation,
    ),
    RecoveryError,
> {
    let key = KeyMaterial::generate().map_err(|_| RecoveryError::UnsupportedBackend)?;
    let (source, mut vault) =
        SyntheticVault::create(&key).map_err(|_| RecoveryError::StorageFailure)?;
    let s = scope();
    let native = s.native()?;
    let document=json!({"id":"document_a","workspaceId":s.workspace,"matterId":s.matter,"threadId":s.thread,"text":TEXT}).to_string();
    vault
        .insert_document(
            &native,
            "document_a",
            &document,
            PDF,
            &[Chunk {
                id: "chunk_a".into(),
                text: TEXT.into(),
            }],
            0,
        )
        .map_err(|_| RecoveryError::StorageFailure)?;
    let mapping=json!({"id":"map_a","workspaceId":s.workspace,"matterId":s.matter,"threadId":s.thread,"namespace":"lex-synthetic-opaque-map","mapVersion":1,"parentDocumentId":"document_a","parentOriginalSha256":hash(PDF),"parentTextSha256":hash(TEXT.as_bytes()),"mapping":"opaque-SYNTHETIC_RECOVERY_PRIVATE_9472-😀"}).to_string();
    vault
        .put(&native, lex_vault::Kind::Note, "map_a", &mapping, 1)
        .map_err(|_| RecoveryError::StorageFailure)?;
    let objects = vec![
        RecoveryObject {
            scope: s.clone(),
            id: "document_a".into(),
            kind: "document".into(),
            payload_sha256: hash(document.as_bytes()),
            original_sha256: Some(hash(PDF)),
            original_bytes: Some(PDF.len() as u64),
            parent_document_id: None,
            parent_original_sha256: None,
            parent_text_sha256: None,
            namespace: None,
            map_version: None,
        },
        RecoveryObject {
            scope: s,
            id: "map_a".into(),
            kind: "note".into(),
            payload_sha256: hash(mapping.as_bytes()),
            original_sha256: None,
            original_bytes: None,
            parent_document_id: Some("document_a".into()),
            parent_original_sha256: Some(hash(PDF)),
            parent_text_sha256: Some(hash(TEXT.as_bytes())),
            namespace: Some("lex-synthetic-opaque-map".into()),
            map_version: Some(1),
        },
    ];
    let expected = SyntheticRecoveryExpectation::capture(&vault, objects)?;
    Ok((source, vault, key, expected))
}
