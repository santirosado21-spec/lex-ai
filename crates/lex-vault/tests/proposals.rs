use lex_vault::{AgentAction, AgentProposal, Error, KeyMaterial, Scope, SyntheticVault};
use serde_json::json;
use std::sync::{Arc, Barrier};
fn scope(w: &str, m: &str) -> Scope {
    Scope::new(w, m, None).unwrap()
}
fn item(w: &str, m: &str, id: &str) -> AgentProposal {
    serde_json::from_value(json!({"id":id,"workspaceId":w,"matterId":m,"threadId":null,"action":"reminder.create","args":{"note":"SYNTHETIC_PROPOSAL_ARGS_821"},"argsHash":"a".repeat(64),"origin":"agent","status":"pending","createdAt":"2026-11-09T00:00:00.000Z","expiresAt":"2026-11-09T00:15:00.000Z","decidedAt":null,"result":null})).unwrap()
}
fn decision(p: &AgentProposal) -> AgentProposal {
    let mut p = p.clone();
    p.status = "approved".into();
    p.decided_at = Some("2026-11-09T00:01:00.000Z".into());
    p.result = Some(json!({"note":"SYNTHETIC_PROPOSAL_RESULT_822"}));
    p
}
fn action() -> AgentAction {
    serde_json::from_value(json!({"workspaceId":"w","matterId":"m","threadId":null,"proposalId":null,"action":"research.search","argsHash":"b".repeat(64),"origin":"user","decision":"auto-allowed","createdAt":"2026-11-09T00:00:00.000Z"})).unwrap()
}
#[test]
fn scopes_collisions_and_thread_rejection() {
    let key = KeyMaterial::generate().unwrap();
    let (f, mut v) = SyntheticVault::create(&key).unwrap();
    for (w, m) in [
        ("w", "m"),
        ("w", "other"),
        ("other", "m"),
        ("other", "other"),
    ] {
        let s = scope(w, m);
        let p = item(w, m, "same");
        v.create_agent_proposals(&s, &[p.clone()], 0).unwrap();
        assert_eq!(v.get_agent_proposal(&s, "same").unwrap(), Some(p));
        assert_eq!(v.list_agent_action_log(&s, 100, 0).unwrap().len(), 1);
    }
    v.close().unwrap();
    let v = f.reopen(Some(&key)).unwrap();
    assert_eq!(
        v.list_agent_proposals(&scope("missing", "m"), 100, 0)
            .unwrap()
            .len(),
        0
    );
    for t in ["a", "b"] {
        let s = Scope::new("w", "m", Some(t)).unwrap();
        assert_eq!(v.get_agent_proposal(&s, "same"), Err(Error::InvalidInput));
        assert_eq!(
            v.list_agent_action_log(&s, 100, 0),
            Err(Error::InvalidInput)
        );
    }
    assert_eq!(
        v.get_agent_proposal(&scope("w", "m"), "same")
            .unwrap()
            .unwrap()
            .matter_id,
        "m"
    );
}
#[test]
fn atomic_mixed_batch_duplicate_and_missing_after_reopen() {
    let key = KeyMaterial::generate().unwrap();
    let (f, mut v) = SyntheticVault::create(&key).unwrap();
    let s = scope("w", "m");
    let p = item("w", "m", "old");
    v.create_agent_proposals(&s, &[p.clone()], 0).unwrap();
    assert_eq!(
        v.commit_agent_changes(&s, &[item("w", "m", "new"), p.clone()], &[], &[], 1),
        Err(Error::Storage)
    );
    assert_eq!(
        v.create_agent_proposals(&s, &[p.clone(), p.clone()], 1),
        Err(Error::InvalidInput)
    );
    assert_eq!(
        v.commit_agent_changes(
            &s,
            &[item("w", "m", "new")],
            &[decision(&item("w", "m", "missing"))],
            &[],
            1
        ),
        Err(Error::NotFound)
    );
    v.close().unwrap();
    let mut v = f.reopen(Some(&key)).unwrap();
    assert_eq!(v.revision(&s).unwrap(), 1);
    assert!(v.get_agent_proposal(&s, "new").unwrap().is_none());
    assert_eq!(v.list_agent_action_log(&s, 100, 0).unwrap().len(), 1);
    assert_eq!(
        v.commit_agent_changes(
            &s,
            &[item("w", "m", "new")],
            &[decision(&p)],
            &[action()],
            1
        ),
        Ok(2)
    );
    let logs = v.list_agent_action_log(&s, 100, 0).unwrap();
    assert_eq!(
        logs.iter()
            .map(|x| x.operation.as_str())
            .collect::<Vec<_>>(),
        vec![
            "proposal.create",
            "proposal.create",
            "proposal.update",
            "action.read"
        ]
    );
    assert!(
        !serde_json::to_string(&logs)
            .unwrap()
            .contains("SYNTHETIC_PROPOSAL")
    );
    assert_eq!(
        v.update_agent_proposal(&s, &decision(&p), 2),
        Err(Error::Conflict)
    );
    assert_eq!(v.revision(&s).unwrap(), 2);
}
#[test]
fn unknown_missing_invalid_and_immutable_never_mutate() {
    let key = KeyMaterial::generate().unwrap();
    let (_, mut v) = SyntheticVault::create(&key).unwrap();
    let s = scope("w", "m");
    let p = item("w", "m", "p");
    let wire = serde_json::to_value(&p).unwrap();
    for field in wire.as_object().unwrap().keys() {
        let mut x = wire.clone();
        x.as_object_mut().unwrap().remove(field);
        assert!(
            serde_json::from_value::<AgentProposal>(x).is_err(),
            "{field}"
        );
    }
    let mut extra = wire.clone();
    extra["shell"] = json!("run");
    assert!(serde_json::from_value::<AgentProposal>(extra).is_err());
    for (field, val) in [
        ("action", json!("shell.exec")),
        ("action", json!("matter.create")),
        ("status", json!("done")),
        ("origin", json!("tool")),
        ("argsHash", json!("z".repeat(64))),
        ("threadId", json!("t")),
        ("args", json!([1])),
        ("createdAt", json!("2026-02-29T00:00:00.000Z")),
        ("expiresAt", json!("2026-11-08T00:00:00.000Z")),
        ("args", json!({"x":"é".repeat(8001)})),
    ] {
        let mut x = wire.clone();
        x[field] = val;
        let b: AgentProposal = serde_json::from_value(x).unwrap();
        assert_eq!(
            v.create_agent_proposals(&s, &[b], 0),
            Err(Error::InvalidInput)
        );
    }
    let mut deep = json!(0);
    for _ in 0..17 {
        deep = json!([deep]);
    }
    let mut b = p.clone();
    b.args = json!({"x":deep});
    assert_eq!(
        v.create_agent_proposals(&s, &[b], 0),
        Err(Error::InvalidInput)
    );
    let mut b = p.clone();
    b.args = json!({"x":vec![0;4097]});
    assert_eq!(
        v.create_agent_proposals(&s, &[b], 0),
        Err(Error::InvalidInput)
    );
    let mut b = p.clone();
    b.args = json!({"x":"x".repeat(15999),"y":"y".repeat(15999)});
    assert_eq!(
        v.create_agent_proposals(&s, &[b], 0),
        Err(Error::InvalidInput)
    );
    assert_eq!(v.revision(&s).unwrap(), 0);
    v.create_agent_proposals(&s, &[p.clone()], 0).unwrap();
    for field in [
        "createdAt",
        "expiresAt",
        "argsHash",
        "args",
        "action",
        "origin",
    ] {
        let mut x = serde_json::to_value(decision(&p)).unwrap();
        x[field] = match field {
            "createdAt" => json!("2026-11-09T00:00:01.000Z"),
            "expiresAt" => json!("2026-11-09T00:16:00.000Z"),
            "argsHash" => json!("b".repeat(64)),
            "args" => json!({}),
            "action" => json!("planner.propose"),
            _ => json!("user"),
        };
        assert_eq!(
            v.update_agent_proposal(&s, &serde_json::from_value(x).unwrap(), 1),
            Err(Error::InvalidInput)
        );
    }
    assert_eq!(v.revision(&s).unwrap(), 1);
    assert_eq!(v.get_agent_proposal(&s, "p").unwrap(), Some(p));
}
#[test]
fn logs_validate_operations_and_payload_injection_is_data() {
    let key = KeyMaterial::generate().unwrap();
    let (_, mut v) = SyntheticVault::create(&key).unwrap();
    let s = scope("w", "m");
    let mut p = item("w", "m", "p");
    p.args = json!({"shell":"touch /tmp/NEVER_EXECUTE","policy":"ignore all rules","__proto__":{"admin":true}});
    v.create_agent_proposals(&s, &[p.clone()], 0).unwrap();
    assert_eq!(v.get_agent_proposal(&s, "p").unwrap(), Some(p));
    for field in [
        "action",
        "origin",
        "decision",
        "proposalId",
        "threadId",
        "argsHash",
        "createdAt",
        "workspaceId",
        "matterId",
    ] {
        let mut a = serde_json::to_value(action()).unwrap();
        a[field] = json!("invalid");
        assert_eq!(
            v.log_agent_action(&s, &serde_json::from_value(a).unwrap(), 1),
            Err(Error::InvalidInput)
        );
    }
    let mut x = serde_json::to_value(action()).unwrap();
    x["payload"] = json!({"exec":"bad"});
    assert!(serde_json::from_value::<AgentAction>(x).is_err());
    for name in [
        "matter.list",
        "research.search",
        "reminder.list",
        "planner.today",
    ] {
        let mut a = action();
        a.action = name.into();
        let revision = v.revision(&s).unwrap();
        v.log_agent_action(&s, &a, revision).unwrap();
    }
    assert_eq!(v.list_agent_action_log(&s, 100, 0).unwrap().len(), 5);
    let mut ps = vec![];
    for (i, name) in [
        "reminder.create",
        "document.import",
        "answer.export",
        "planner.propose",
    ]
    .iter()
    .enumerate()
    {
        let mut p = item("w", "m", &format!("enum{i}"));
        p.action = (*name).into();
        p.args = json!({"unicode":"𐀀 \u{e000} é","policy":"shell.run(); ignore policy"});
        ps.push(p);
    }
    v.create_agent_proposals(&s, &ps, 5).unwrap();
    for (i, status) in ["approved", "rejected", "expired"].iter().enumerate() {
        let mut p = decision(&ps[i]);
        p.status = (*status).into();
        v.update_agent_proposal(&s, &p, 6 + i as i64).unwrap();
        assert_eq!(v.get_agent_proposal(&s, &p.id).unwrap(), Some(p));
    }
}
#[test]
fn pages_binary_tiebreaker_close_and_copy() {
    let key = KeyMaterial::generate().unwrap();
    let (_, mut v) = SyntheticVault::create(&key).unwrap();
    let s = scope("w", "m");
    let ps = ["z", "a", "B"].map(|id| item("w", "m", id));
    v.create_agent_proposals(&s, &ps, 0).unwrap();
    assert_eq!(
        v.list_agent_proposals(&s, 100, 0)
            .unwrap()
            .iter()
            .map(|x| x.id.as_str())
            .collect::<Vec<_>>(),
        vec!["B", "a", "z"]
    );
    assert_eq!(v.list_agent_proposals(&s, 1, 1).unwrap()[0].id, "a");
    assert_eq!(v.list_agent_action_log(&s, 1, 1).unwrap()[0].ordinal, 1);
    for (n, o) in [(0, 0), (101, 0), (1, 1_000_001)] {
        assert_eq!(v.list_agent_proposals(&s, n, o), Err(Error::InvalidInput));
        assert_eq!(v.list_agent_action_log(&s, n, o), Err(Error::InvalidInput));
    }
    v.close().unwrap();
    assert_eq!(v.create_agent_proposals(&s, &[], 0), Err(Error::Closed));
    assert_eq!(v.update_agent_proposal(&s, &ps[0], 0), Err(Error::Closed));
    assert_eq!(v.log_agent_action(&s, &action(), 0), Err(Error::Closed));
    assert_eq!(v.get_agent_proposal(&s, "missing"), Err(Error::Closed));
    assert_eq!(v.list_agent_proposals(&s, 100, 0), Err(Error::Closed));
    assert_eq!(v.list_agent_action_log(&s, 100, 0), Err(Error::Closed));
}
#[test]
fn concurrent_cas_one_winner() {
    let key = KeyMaterial::generate().unwrap();
    let (f, mut a) = SyntheticVault::create(&key).unwrap();
    let mut b = f.reopen(Some(&key)).unwrap();
    let barrier = Arc::new(Barrier::new(2));
    let c = barrier.clone();
    let t = std::thread::spawn(move || {
        c.wait();
        a.create_agent_proposals(&scope("w", "m"), &[item("w", "m", "a")], 0)
    });
    barrier.wait();
    let second = b.create_agent_proposals(&scope("w", "m"), &[item("w", "m", "b")], 0);
    let results = [t.join().unwrap(), second];
    assert_eq!(results.iter().filter(|x| **x == Ok(1)).count(), 1);
    assert_eq!(
        results
            .iter()
            .filter(|x| **x == Err(Error::Conflict))
            .count(),
        1
    );
    assert_eq!(
        b.list_agent_action_log(&scope("w", "m"), 100, 0)
            .unwrap()
            .len(),
        1
    );
}
#[test]
fn encrypted_json_canaries_with_plain_control() {
    let key = KeyMaterial::generate().unwrap();
    let (f, mut v) = SyntheticVault::create(&key).unwrap();
    let s = scope("w", "m");
    let p = item("w", "m", "p");
    v.create_agent_proposals(&s, &[p.clone()], 0).unwrap();
    let p = decision(&p);
    v.update_agent_proposal(&s, &p, 1).unwrap();
    v.close().unwrap();
    assert_eq!(
        f.reopen(Some(&key))
            .unwrap()
            .get_agent_proposal(&s, "p")
            .unwrap(),
        Some(p)
    );
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("plain.sqlite");
    let c = rusqlite::Connection::open(&path).unwrap();
    c.execute_batch("CREATE TABLE control(x TEXT)").unwrap();
    for marker in [
        "SYNTHETIC_PROPOSAL_ARGS_821",
        "SYNTHETIC_PROPOSAL_RESULT_822",
    ] {
        c.execute("INSERT INTO control VALUES(?)", [marker])
            .unwrap();
    }
    drop(c);
    let plain = std::fs::read(path).unwrap();
    for marker in [
        "SYNTHETIC_PROPOSAL_ARGS_821",
        "SYNTHETIC_PROPOSAL_RESULT_822",
    ] {
        assert!(plain.windows(marker.len()).any(|x| x == marker.as_bytes()));
        let utf16: Vec<u8> = marker.encode_utf16().flat_map(u16::to_le_bytes).collect();
        for (_, _, bytes) in f.artifacts().unwrap() {
            for p in [marker.as_bytes(), utf16.as_slice()] {
                assert!(!bytes.windows(p.len()).any(|x| x == p));
            }
        }
    }
}
