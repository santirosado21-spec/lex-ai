use lex_vault::{Error, KeyMaterial, Reminder, Scope, SyntheticVault};
use std::sync::{Arc, Barrier};
fn scope(w: &str, m: &str) -> Scope {
    Scope::new(w, m, None).unwrap()
}
fn item(w: &str, m: &str, id: &str) -> Reminder {
    serde_json::from_value(serde_json::json!({"id":id,"workspaceId":w,"matterId":m,"threadId":null,"kind":"followup","title":"SYNTHETIC_REMINDER_TITLE_731","dueAt":null,"note":"SYNTHETIC_REMINDER_NOTE_732","status":"approved","source":"user","createdAt":"2026-11-09T00:00:00.000Z","updatedAt":"2026-11-09T00:00:00.000Z","plannerRule":null})).unwrap()
}
#[test]
fn collisions_scope_audit_and_reopen() {
    let key = KeyMaterial::generate().unwrap();
    let (f, mut v) = SyntheticVault::create(&key).unwrap();
    for (w, m) in [("w", "m"), ("w", "other"), ("other", "m")] {
        let s = scope(w, m);
        let mut r = item(w, m, "same");
        r.note = format!("synthetic {w} {m}");
        v.create_reminders(&s, &[r.clone()], 0).unwrap();
        assert_eq!(v.get_reminder(&s, "same").unwrap(), Some(r));
        assert_eq!(v.list_reminder_audits(&s, 100, 0).unwrap().len(), 1);
    }
    v.close().unwrap();
    let v = f.reopen(Some(&key)).unwrap();
    for (w, m) in [("w", "m"), ("w", "other"), ("other", "m")] {
        assert_eq!(
            v.get_reminder(&scope(w, m), "same").unwrap().unwrap().note,
            format!("synthetic {w} {m}")
        );
    }
    assert!(
        v.list_reminders(&scope("missing", "m"), 100, 0)
            .unwrap()
            .is_empty()
    );
    assert_eq!(
        v.get_reminder(&Scope::new("w", "m", Some("thread")).unwrap(), "same"),
        Err(Error::InvalidInput)
    );
}
#[test]
fn duplicate_halfway_rolls_back_everything_after_reopen() {
    let key = KeyMaterial::generate().unwrap();
    let (f, mut v) = SyntheticVault::create(&key).unwrap();
    let s = scope("w", "m");
    let r = item("w", "m", "r");
    v.create_reminders(&s, &[r.clone()], 0).unwrap();
    assert_eq!(
        v.create_reminders(&s, &[item("w", "m", "new"), r], 1),
        Err(Error::Storage)
    );
    v.close().unwrap();
    let v = f.reopen(Some(&key)).unwrap();
    assert_eq!(v.revision(&s).unwrap(), 1);
    assert_eq!(v.list_reminders(&s, 100, 0).unwrap().len(), 1);
    assert!(v.get_reminder(&s, "new").unwrap().is_none());
    assert_eq!(v.list_reminder_audits(&s, 100, 0).unwrap().len(), 1);
}
#[test]
fn validated_enums_dates_limits_and_immutable_fields() {
    let key = KeyMaterial::generate().unwrap();
    let (_, mut v) = SyntheticVault::create(&key).unwrap();
    let s = scope("w", "m");
    let r = item("w", "m", "r");
    let mut bad = vec![];
    for field in [
        "kind",
        "status",
        "source",
        "workspaceId",
        "matterId",
        "threadId",
        "createdAt",
        "updatedAt",
        "dueAt",
        "title",
        "plannerRule",
    ] {
        let mut value = serde_json::to_value(&r).unwrap();
        value[field] = serde_json::json!("invalid");
        if field == "title" {
            value[field] = serde_json::json!("x".repeat(801));
        }
        if field == "plannerRule" {
            value[field] = serde_json::json!("");
        }
        bad.push(serde_json::from_value::<Reminder>(value).unwrap());
    }
    for date in [
        "2026-02-29",
        "0000-01-01",
        "2026-11-09T24:00:00.000Z",
        "2026-11-09T12:00:00-06:00",
    ] {
        let mut b = r.clone();
        b.due_at = Some(date.into());
        bad.push(b);
    }
    let mut b = r.clone();
    b.note = "é".repeat(8001);
    bad.push(b);
    for b in bad {
        assert_eq!(v.create_reminders(&s, &[b], 0), Err(Error::InvalidInput));
    }
    assert_eq!(v.create_reminders(&s, &[], 0), Err(Error::InvalidInput));
    assert_eq!(
        v.create_reminders(&s, &vec![r.clone(); 101], 0),
        Err(Error::InvalidInput)
    );
    assert_eq!(v.update_reminder(&s, &r, 0), Err(Error::NotFound));
    assert_eq!(v.revision(&s).unwrap(), 0);
    assert!(v.list_reminder_audits(&s, 100, 0).unwrap().is_empty());
    let mut batch = vec![];
    for (i, (kind, status, source)) in [
        ("deadline", "proposed", "planner"),
        ("followup", "approved", "user"),
        ("draft-suggestion", "done", "planner"),
        ("deadline", "dismissed", "user"),
    ]
    .iter()
    .enumerate()
    {
        let mut x = r.clone();
        x.id = format!("r{i}");
        x.kind = kind.to_string();
        x.status = status.to_string();
        x.source = source.to_string();
        x.due_at = Some("2028-02-29".into());
        batch.push(x);
    }
    v.create_reminders(&s, &batch, 0).unwrap();
    let mut changed = batch[0].clone();
    changed.created_at = "2026-11-10T00:00:00.000Z".into();
    assert_eq!(v.update_reminder(&s, &changed, 1), Err(Error::InvalidInput));
    assert_eq!(v.revision(&s).unwrap(), 1);
    changed = batch[0].clone();
    changed.status = "done".into();
    assert_eq!(v.update_reminder(&s, &changed, 1).unwrap(), 2);
    assert_eq!(
        v.list_reminder_audits(&s, 100, 0)
            .unwrap()
            .last()
            .unwrap()
            .operation,
        "reminder.update"
    );
}
#[test]
fn binary_order_pages_and_closed_empty_reads() {
    let key = KeyMaterial::generate().unwrap();
    let (_, mut v) = SyntheticVault::create(&key).unwrap();
    let s = scope("w", "m");
    let mut rs = vec![];
    for (id, title, due) in [
        ("z", "a", None),
        ("b", "\u{10000}", Some("2026-11-09")),
        ("a", "\u{e000}", Some("2026-11-09")),
        ("c", "\u{e000}", Some("2026-11-09")),
        ("early", "z", Some("2026-11-08")),
    ] {
        let mut r = item("w", "m", id);
        r.title = title.into();
        r.due_at = due.map(str::to_owned);
        rs.push(r);
    }
    v.create_reminders(&s, &rs, 0).unwrap();
    assert_eq!(
        v.list_reminders(&s, 100, 0)
            .unwrap()
            .iter()
            .map(|r| r.id.as_str())
            .collect::<Vec<_>>(),
        vec!["early", "a", "c", "b", "z"]
    );
    assert_eq!(
        v.list_reminders(&s, 2, 1)
            .unwrap()
            .iter()
            .map(|r| r.id.as_str())
            .collect::<Vec<_>>(),
        vec!["a", "c"]
    );
    assert_eq!(v.list_reminders(&s, 101, 0), Err(Error::InvalidInput));
    assert_eq!(v.list_reminders(&s, 1, 1_000_001), Err(Error::InvalidInput));
    v.close().unwrap();
    assert_eq!(v.get_reminder(&s, "missing"), Err(Error::Closed));
    assert_eq!(v.list_reminders(&s, 100, 0), Err(Error::Closed));
    assert_eq!(v.list_reminder_audits(&s, 100, 0), Err(Error::Closed));
    assert_eq!(v.create_reminders(&s, &[], 0), Err(Error::Closed));
    assert_eq!(v.update_reminder(&s, &rs[0], 0), Err(Error::Closed));
}
#[test]
fn two_connections_one_cas_winner() {
    let key = KeyMaterial::generate().unwrap();
    let (f, mut first) = SyntheticVault::create(&key).unwrap();
    let mut second = f.reopen(Some(&key)).unwrap();
    let barrier = Arc::new(Barrier::new(2));
    let b = barrier.clone();
    let thread = std::thread::spawn(move || {
        b.wait();
        first.create_reminders(&scope("w", "m"), &[item("w", "m", "a")], 0)
    });
    barrier.wait();
    let other = second.create_reminders(&scope("w", "m"), &[item("w", "m", "b")], 0);
    let results = [thread.join().unwrap(), other];
    assert_eq!(results.iter().filter(|r| **r == Ok(1)).count(), 1);
    assert_eq!(
        results
            .iter()
            .filter(|r| **r == Err(Error::Conflict))
            .count(),
        1
    );
    assert_eq!(
        second
            .list_reminder_audits(&scope("w", "m"), 100, 0)
            .unwrap()
            .len(),
        1
    );
}
#[test]
fn ciphertext_canaries_and_plaintext_scanner_control() {
    let key = KeyMaterial::generate().unwrap();
    let (f, mut v) = SyntheticVault::create(&key).unwrap();
    let s = scope("w", "m");
    let r = item("w", "m", "r");
    v.create_reminders(&s, &[r.clone()], 0).unwrap();
    v.close().unwrap();
    let v = f.reopen(Some(&key)).unwrap();
    assert_eq!(v.get_reminder(&s, "r").unwrap(), Some(r.clone()));
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("plain.sqlite");
    let c = rusqlite::Connection::open(&path).unwrap();
    c.execute_batch("CREATE TABLE control(value TEXT)").unwrap();
    c.execute(
        "INSERT INTO control VALUES(?)",
        [format!("{} {}", r.title, r.note)],
    )
    .unwrap();
    drop(c);
    let plain = std::fs::read(path).unwrap();
    for text in [&r.title, &r.note] {
        assert!(plain.windows(text.len()).any(|w| w == text.as_bytes()));
        let utf16: Vec<u8> = text.encode_utf16().flat_map(u16::to_le_bytes).collect();
        for (_, _, bytes) in f.artifacts().unwrap() {
            for p in [text.as_bytes(), utf16.as_slice()] {
                assert!(!bytes.windows(p.len()).any(|w| w == p));
            }
        }
    }
}

#[test]
fn wire_decode_rejects_unknown_and_missing_nullable_fields() {
    let r = serde_json::to_value(item("w", "m", "r")).unwrap();
    for field in ["threadId", "dueAt", "plannerRule"] {
        let mut missing = r.clone();
        missing.as_object_mut().unwrap().remove(field);
        assert!(serde_json::from_value::<Reminder>(missing).is_err());
    }
    let mut extra = r;
    extra["unexpected"] = serde_json::json!(true);
    assert!(serde_json::from_value::<Reminder>(extra).is_err());
}
