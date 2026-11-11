use lex_vault::{Chunk, Error, KeyMaterial, Kind, Scope, SyntheticVault};
use serde_json::json;
use std::{sync::Barrier, time::Instant};
fn scope() -> Scope {
    Scope::new("firm_a", "matter_a", Some("thread_a")).unwrap()
}
fn payload(id: &str) -> String {
    json!({"id":id,"workspaceId":"firm_a","matterId":"matter_a","threadId":"thread_a","text":"SYNTHETIC_PRIVATE_CANARY_782 José 🧑🏽‍⚖️ e\u{301}"}).to_string()
}
fn chunk(id: &str) -> Chunk {
    Chunk {
        id: id.into(),
        text: "SYNTHETIC_PRIVATE_CANARY_782 obligación contrato José".into(),
    }
}
#[test]
fn backend_and_encrypted_bytes_reopen() {
    let start = Instant::now();
    let key = KeyMaterial::generate().unwrap();
    let (fixture, mut vault) = SyntheticVault::create(&key).unwrap();
    let caps = vault.capabilities().unwrap();
    assert!(!caps.cipher_version.is_empty());
    assert_eq!(caps.cipher_provider, "commoncrypto");
    assert_eq!(caps.temp_store, 2);
    assert_eq!(caps.journal_mode, "delete");
    println!(
        "H5B1_CAPABILITIES {}",
        serde_json::to_string(&caps).unwrap()
    );
    let bytes = b"\0\xffSYNTHETIC_PRIVATE_CANARY_782\r\n\"original\"";
    vault
        .insert_document(
            &scope(),
            "doc_a",
            &payload("doc_a"),
            bytes,
            &[chunk("chunk_a")],
            0,
        )
        .unwrap();
    let before = vault.get(&scope(), Kind::Document, "doc_a").unwrap();
    assert_eq!(before, Some(payload("doc_a")));
    assert_eq!(
        vault.original(&scope(), "doc_a").unwrap(),
        Some(bytes.to_vec())
    );
    assert_eq!(vault.search(&scope(), "obligación", 6).unwrap().len(), 1);
    assert_eq!(fixture.root_mode().unwrap(), 0o700);
    let artifacts = fixture.artifacts().unwrap();
    assert!(!artifacts.is_empty());
    // Scanner positive control on the exact fixture bytes, independent of encrypted backend.
    let canary = b"SYNTHETIC_PRIVATE_CANARY_782";
    assert!(bytes.windows(canary.len()).any(|w| w == canary));
    for (_, mode, content) in &artifacts {
        assert_eq!(*mode, 0o600);
        assert!(!content.starts_with(b"SQLite format 3\0"));
        assert!(!content.windows(canary.len()).any(|w| w == canary));
    }
    vault.close().unwrap();
    assert_eq!(
        vault.get(&scope(), Kind::Document, "doc_a").unwrap_err(),
        Error::Closed
    );
    assert_eq!(vault.search(&scope(), "", 6).unwrap_err(), Error::Closed);
    let reopened = fixture.reopen(Some(&key)).unwrap();
    assert_eq!(
        reopened.get(&scope(), Kind::Document, "doc_a").unwrap(),
        before
    );
    assert_eq!(
        reopened.original(&scope(), "doc_a").unwrap(),
        Some(bytes.to_vec())
    );
    assert_eq!(reopened.first_chunks(&scope(), 6).unwrap().len(), 1);
    assert_eq!(reopened.revision(&scope()).unwrap(), 1);
    println!("H5B1_CORE_ELAPSED_MS {}", start.elapsed().as_millis());
}
#[test]
fn missing_and_wrong_keys_do_not_change_existing_bytes() {
    let key = KeyMaterial::generate().unwrap();
    let bad = KeyMaterial::generate().unwrap();
    let (f, mut v) = SyntheticVault::create(&key).unwrap();
    v.put(&scope(), Kind::Chat, "chat_a", &payload("chat_a"), 0)
        .unwrap();
    v.close().unwrap();
    let before = f.artifacts().unwrap();
    assert!(matches!(f.reopen(None), Err(Error::KeyRequired)));
    assert!(matches!(f.reopen(Some(&bad)), Err(Error::CannotOpen)));
    assert_eq!(f.artifacts().unwrap(), before);
    assert!(
        f.reopen(Some(&key))
            .unwrap()
            .get(&scope(), Kind::Chat, "chat_a")
            .unwrap()
            .is_some()
    );
}
#[test]
fn exact_workspace_matter_thread_on_every_read_and_write() {
    let key = KeyMaterial::generate().unwrap();
    let (_, mut v) = SyntheticVault::create(&key).unwrap();
    v.insert_document(
        &scope(),
        "doc_a",
        &payload("doc_a"),
        b"binary",
        &[chunk("chunk_a")],
        0,
    )
    .unwrap();
    let foreign = [
        Scope::new("firm_b", "matter_a", Some("thread_a")).unwrap(),
        Scope::new("firm_a", "matter_b", Some("thread_a")).unwrap(),
        Scope::new("firm_a", "matter_a", Some("thread_b")).unwrap(),
        Scope::new("firm_a", "matter_a", None).unwrap(),
    ];
    for s in foreign {
        assert_eq!(v.get(&s, Kind::Document, "doc_a").unwrap(), None);
        assert!(v.list(&s, Kind::Document).unwrap().is_empty());
        assert_eq!(v.original(&s, "doc_a").unwrap(), None);
        assert!(v.first_chunks(&s, 6).unwrap().is_empty());
        assert!(v.search(&s, "contrato", 6).unwrap().is_empty());
        assert_eq!(v.revision(&s).unwrap(), 0);
        assert_eq!(
            v.put(&s, Kind::Chat, "doc_a", &payload("doc_a"), 0)
                .unwrap_err(),
            Error::InvalidInput
        );
    }
    assert!(Scope::new("*", "matter_a", None).is_err());
    assert!(Scope::new("firm_a", "", None).is_err());
    assert!(Scope::new("firm_a", "matter_a", Some("*")).is_err());
}
#[test]
fn import_failure_rolls_back_record_original_chunks_fts_and_revision() {
    let key = KeyMaterial::generate().unwrap();
    let (f, mut v) = SyntheticVault::create(&key).unwrap();
    let duplicate = [chunk("same_chunk"), chunk("same_chunk")];
    assert_eq!(
        v.insert_document(
            &scope(),
            "doc_a",
            &payload("doc_a"),
            b"binary",
            &duplicate,
            0
        )
        .unwrap_err(),
        Error::Storage
    );
    v.close().unwrap();
    let mut v = f.reopen(Some(&key)).unwrap();
    assert_eq!(v.revision(&scope()).unwrap(), 0);
    assert!(v.list(&scope(), Kind::Document).unwrap().is_empty());
    assert!(v.original(&scope(), "doc_a").unwrap().is_none());
    assert!(v.first_chunks(&scope(), 6).unwrap().is_empty());
    assert!(v.search(&scope(), "contrato", 6).unwrap().is_empty());
    assert_eq!(
        v.insert_document(
            &scope(),
            "doc_a",
            &payload("doc_a"),
            b"binary",
            &[chunk("same_chunk")],
            0
        )
        .unwrap(),
        1
    );
}
#[test]
fn concurrent_connections_with_same_revision_commit_once() {
    let key = KeyMaterial::generate().unwrap();
    let (f, mut first) = SyntheticVault::create(&key).unwrap();
    let mut second = f.reopen(Some(&key)).unwrap();
    let barrier = Barrier::new(2);
    let results = std::thread::scope(|threads| {
        let barrier = &barrier;
        let a = threads.spawn(move || {
            barrier.wait();
            first.put(&scope(), Kind::Chat, "chat_a", &payload("chat_a"), 0)
        });
        let b = threads.spawn(move || {
            barrier.wait();
            second.put(&scope(), Kind::Chat, "chat_b", &payload("chat_b"), 0)
        });
        [a.join().unwrap(), b.join().unwrap()]
    });
    assert_eq!(results.iter().filter(|r| r.is_ok()).count(), 1);
    assert_eq!(
        results
            .iter()
            .filter(|r| **r == Err(Error::Conflict))
            .count(),
        1
    );
    let v = f.reopen(Some(&key)).unwrap();
    assert_eq!(v.revision(&scope()).unwrap(), 1);
    assert_eq!(v.list(&scope(), Kind::Chat).unwrap().len(), 1);
}
#[test]
fn bounded_domain_input_no_document_overwrite_or_query_escape() {
    let key = KeyMaterial::generate().unwrap();
    let (_, mut v) = SyntheticVault::create(&key).unwrap();
    assert_eq!(
        v.put(&scope(), Kind::Document, "doc_a", &payload("doc_a"), 0)
            .unwrap_err(),
        Error::InvalidInput
    );
    assert_eq!(
        v.put(&scope(), Kind::Note, "x", "{}", 0).unwrap_err(),
        Error::InvalidInput
    );
    assert_eq!(
        v.first_chunks(&scope(), 0).unwrap_err(),
        Error::InvalidInput
    );
    assert_eq!(
        v.search(&scope(), "x", 101).unwrap_err(),
        Error::InvalidInput
    );
    assert!(
        v.search(&scope(), "\" OR * NEAR(foo) --", 6)
            .unwrap()
            .is_empty()
    );
    assert!(v.search(&scope(), "para del con", 6).unwrap().is_empty());
}

#[test]
fn colliding_ids_across_two_firms_two_matters_and_threads_remain_independent() {
    let key = KeyMaterial::generate().unwrap();
    let (_, mut vault) = SyntheticVault::create(&key).unwrap();
    for firm in ["firm_a", "firm_b"] {
        for matter in ["matter_a", "matter_b"] {
            for thread in [Some("thread_a"), Some("thread_b"), None] {
                let s = Scope::new(firm, matter, thread).unwrap();
                let label = format!("{firm}_{matter}_{}", thread.unwrap_or("matter_only"));
                let p = json!({"id":"same_doc","workspaceId":firm,"matterId":matter,"threadId":thread,"text":label}).to_string();
                let chunks = [Chunk {
                    id: "same_chunk".into(),
                    text: format!("contrato {label}"),
                }];
                vault
                    .insert_document(&s, "same_doc", &p, label.as_bytes(), &chunks, 0)
                    .unwrap();
            }
        }
    }
    for firm in ["firm_a", "firm_b"] {
        for matter in ["matter_a", "matter_b"] {
            for thread in [Some("thread_a"), Some("thread_b"), None] {
                let s = Scope::new(firm, matter, thread).unwrap();
                let label = format!("{firm}_{matter}_{}", thread.unwrap_or("matter_only"));
                assert_eq!(vault.revision(&s).unwrap(), 1);
                assert_eq!(
                    vault.original(&s, "same_doc").unwrap(),
                    Some(label.as_bytes().to_vec())
                );
                assert_eq!(vault.list(&s, Kind::Document).unwrap().len(), 1);
                let hits = vault.search(&s, "contrato", 100).unwrap();
                assert_eq!(hits.len(), 1);
                assert_eq!(hits[0].text, format!("contrato {label}"));
            }
        }
    }
}
