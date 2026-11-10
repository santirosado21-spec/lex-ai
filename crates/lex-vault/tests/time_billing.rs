use lex_vault::*;
use serde_json::{Value, json};
use std::sync::{Arc, Barrier};
const STAMP: &str = "2026-11-10T00:00:00.000Z";
fn s() -> Scope {
    Scope::new("w", "m", None).unwrap()
}
fn entry(id: &str) -> TimeEntry {
    serde_json::from_value(json!({"id":id,"workspaceId":"w","matterId":"m","threadId":null,"userId":"u","startedAt":null,"endedAt":null,"manualMinutes":1,"durationMinutes":1,"billedMinutes":1,"description":"SYNTHETIC_TIME_DESCRIPTION_932","billable":true,"rateAmount":"0.01","amount":"0.01","currency":"MXN","source":"manual","billingStatus":"unbilled","createdAt":STAMP})).unwrap()
}
fn timer() -> ActiveTimer {
    serde_json::from_value(json!({"workspaceId":"w","matterId":"m","threadId":null,"userId":"u","startedAt":STAMP,"accumulatedMinutes":1,"pausedAt":null,"state":"running","rateAmount":"0.01","billable":true,"description":"SYNTHETIC_TIMER_933","currency":"MXN","createdAt":STAMP,"updatedAt":STAMP})).unwrap()
}
fn stopped(id: &str) -> TimeEntry {
    let mut e = entry(id);
    e.source = "timer".into();
    e.manual_minutes = None;
    e.started_at = Some(STAMP.into());
    e.ended_at = Some(STAMP.into());
    e
}
fn fee() -> FeeArrangement {
    serde_json::from_value(json!({"workspaceId":"w","matterId":"m","threadId":null,"arrangement":"hourly","hourlyRateAmount":"0.01","contingencyBasisPoints":null,"billingIncrementMinutes":6,"currency":"MXN","createdAt":STAMP,"updatedAt":STAMP})).unwrap()
}
fn rate() -> ClientHourlyRate {
    serde_json::from_value(json!({"workspaceId":"w","matterId":"m","threadId":null,"clientId":"client","clientName":"SYNTHETIC_CLIENT_934","hourlyRateAmount":"90071992547409.91","currency":"MXN","createdAt":STAMP,"updatedAt":STAMP})).unwrap()
}
fn resolution() -> MatterResolution {
    serde_json::from_value(json!({"workspaceId":"w","matterId":"m","threadId":null,"status":"resuelto","outcome":"otro","resolutionDate":"2026-11-10","notes":"SYNTHETIC_RESOLUTION_935","resolvedAt":STAMP,"createdAt":STAMP,"updatedAt":STAMP})).unwrap()
}
#[test]
fn decimal_exact_format_safe_bound_and_strict_wire() {
    for amount in ["0.00", "0.01", "12345678901234.56", "90071992547409.91"] {
        let m = Money::new(amount).unwrap();
        assert_eq!(m.as_str(), amount);
        assert_eq!(serde_json::to_value(&m).unwrap(), json!(amount));
    }
    for amount in [
        "90071992547409.92",
        "999999999999999999999.00",
        "-0.01",
        "-0.00",
        "+0.01",
        "01.00",
        ".01",
        "1",
        "1.0",
        "1.001",
        "1e2",
        "NaN",
        "Infinity",
        " 1.00",
        "1.00\n",
    ] {
        assert_eq!(Money::new(amount), Err(Error::InvalidInput));
    }
    for value in [json!(0.01), json!(1), Value::Null, json!(true)] {
        assert!(serde_json::from_value::<Money>(value).is_err());
    }
    let e = serde_json::to_value(entry("e")).unwrap();
    for field in ["threadId", "startedAt", "endedAt", "manualMinutes"] {
        let mut v = e.clone();
        v.as_object_mut().unwrap().remove(field);
        assert!(serde_json::from_value::<TimeEntry>(v).is_err());
    }
    let mut v = e;
    v["amountCentavos"] = json!(1);
    assert!(serde_json::from_value::<TimeEntry>(v).is_err());
    let change = json!({"operation":"deleteTimer","item":{"userId":"u"},"extra":true});
    assert!(serde_json::from_value::<TimeBillingChange>(change).is_err());
}
#[test]
fn exact_scope_collisions_and_thread_rejection() {
    let key = KeyMaterial::generate().unwrap();
    let (_, mut v) = SyntheticVault::create(&key).unwrap();
    for (w, m) in [
        ("w", "m"),
        ("w", "other"),
        ("other", "m"),
        ("other", "other"),
    ] {
        let scope = Scope::new(w, m, None).unwrap();
        let mut e = entry("same");
        e.workspace_id = w.into();
        e.matter_id = m.into();
        let mut t = timer();
        t.workspace_id = w.into();
        t.matter_id = m.into();
        let mut r = rate();
        r.workspace_id = w.into();
        r.matter_id = m.into();
        v.commit_time_billing(
            &scope,
            &[
                TimeBillingChange::CreateEntry(e.clone()),
                TimeBillingChange::PutTimer(t.clone()),
                TimeBillingChange::PutRate(r.clone()),
            ],
            0,
        )
        .unwrap();
        assert_eq!(v.get_time_entry(&scope, "same").unwrap(), Some(e));
        assert_eq!(v.get_active_timer(&scope, "u").unwrap(), Some(t));
        assert_eq!(v.get_client_hourly_rate(&scope, "client").unwrap(), Some(r));
    }
    let thread = Scope::new("w", "m", Some("t")).unwrap();
    assert_eq!(v.get_active_timer(&thread, "u"), Err(Error::InvalidInput));
    assert_eq!(
        v.create_time_entry(&thread, &entry("e"), 1),
        Err(Error::InvalidInput)
    );
    let mut wrong = entry("e");
    wrong.workspace_id = "other".into();
    assert_eq!(
        v.create_time_entry(&s(), &wrong, 1),
        Err(Error::InvalidInput)
    );
    assert!(
        v.list_time_entries(&Scope::new("missing", "m", None).unwrap(), None, 100, 0)
            .unwrap()
            .is_empty()
    );
}
#[test]
fn invalid_duration_enums_dates_bounds_never_mutate() {
    let key = KeyMaterial::generate().unwrap();
    let (_, mut v) = SyntheticVault::create(&key).unwrap();
    let mut bad = entry("e");
    bad.duration_minutes = 10081;
    assert_eq!(v.create_time_entry(&s(), &bad, 0), Err(Error::InvalidInput));
    bad = entry("e");
    bad.billed_minutes = 10081;
    assert_eq!(v.create_time_entry(&s(), &bad, 0), Err(Error::InvalidInput));
    bad = entry("e");
    bad.billable = false;
    assert_eq!(v.create_time_entry(&s(), &bad, 0), Err(Error::InvalidInput));
    for (field, value) in [
        ("currency", json!("USD")),
        ("source", json!("unknown")),
        ("billingStatus", json!("paid")),
        ("description", json!("x".repeat(2401))),
        ("createdAt", json!("2026-02-29T00:00:00.000Z")),
    ] {
        let mut raw = serde_json::to_value(entry("e")).unwrap();
        raw[field] = value;
        let e: TimeEntry = serde_json::from_value(raw).unwrap();
        assert_eq!(v.create_time_entry(&s(), &e, 0), Err(Error::InvalidInput));
    }
    assert_eq!(
        v.commit_time_billing(&s(), &[], 0),
        Err(Error::InvalidInput)
    );
    assert_eq!(
        v.commit_time_billing(
            &s(),
            &vec![TimeBillingChange::CreateEntry(entry("e")); 101],
            0
        ),
        Err(Error::InvalidInput)
    );
    assert_eq!(v.revision(&s()).unwrap(), 0);
    assert!(v.list_time_billing_audits(&s(), 100, 0).unwrap().is_empty());
    for minutes in [0, 10080] {
        let mut e = entry(&format!("e{minutes}"));
        e.duration_minutes = minutes;
        e.manual_minutes = Some(minutes);
        e.billed_minutes = minutes;
        let revision = v.revision(&s()).unwrap();
        v.create_time_entry(&s(), &e, revision).unwrap();
    }
}
#[test]
fn timer_stop_mid_batch_constraint_rolls_back_after_reopen() {
    let key = KeyMaterial::generate().unwrap();
    let (f, mut v) = SyntheticVault::create(&key).unwrap();
    let t = timer();
    v.put_active_timer(&s(), &t, 0).unwrap();
    v.create_time_entry(&s(), &entry("existing"), 1).unwrap();
    let changes = [
        TimeBillingChange::StopTimer(TimerStop {
            user_id: "u".into(),
            entry: stopped("new"),
        }),
        TimeBillingChange::CreateEntry(entry("existing")),
    ];
    assert_eq!(
        v.commit_time_billing(&s(), &changes, 2),
        Err(Error::Storage)
    );
    v.close().unwrap();
    let mut v = f.reopen(Some(&key)).unwrap();
    assert_eq!(v.revision(&s()).unwrap(), 2);
    assert_eq!(v.get_active_timer(&s(), "u").unwrap(), Some(t));
    assert!(v.get_time_entry(&s(), "new").unwrap().is_none());
    assert_eq!(v.list_time_billing_audits(&s(), 100, 0).unwrap().len(), 2);
    assert_eq!(v.stop_timer(&s(), "u", &stopped("new"), 2).unwrap(), 3);
    assert!(v.get_active_timer(&s(), "u").unwrap().is_none());
    assert_eq!(v.get_time_entry(&s(), "new").unwrap(), Some(stopped("new")));
    assert_eq!(
        v.list_time_billing_audits(&s(), 100, 0)
            .unwrap()
            .last()
            .unwrap()
            .operation,
        "timer.stop"
    );
}
#[test]
fn stop_binds_existing_timer_and_immutable_entry() {
    let key = KeyMaterial::generate().unwrap();
    let (_, mut v) = SyntheticVault::create(&key).unwrap();
    v.put_active_timer(&s(), &timer(), 0).unwrap();
    for (field, value) in [
        ("rateAmount", json!("0.02")),
        ("userId", json!("other")),
        ("durationMinutes", json!(0)),
        ("startedAt", json!("2026-11-09T23:59:00.000Z")),
    ] {
        let mut raw = serde_json::to_value(stopped("e")).unwrap();
        raw[field] = value;
        let e: TimeEntry = serde_json::from_value(raw).unwrap();
        assert!(v.stop_timer(&s(), "u", &e, 1).is_err());
    }
    let mut t = timer();
    t.created_at = "2026-11-09T23:59:00.000Z".into();
    assert_eq!(v.put_active_timer(&s(), &t, 1), Err(Error::InvalidInput));
    assert_eq!(v.revision(&s()).unwrap(), 1);
    v.create_time_entry(&s(), &entry("e"), 1).unwrap();
    let original = v.get_time_entry(&s(), "e").unwrap().unwrap();
    v.set_time_entries_billing_status(&s(), &["e".into()], "billed", 2)
        .unwrap();
    let mut expected = original.clone();
    expected.billing_status = "billed".into();
    assert_eq!(v.get_time_entry(&s(), "e").unwrap(), Some(expected));
    assert_eq!(
        v.set_time_entries_billing_status(&s(), &["e".into(), "missing".into()], "unbilled", 3),
        Err(Error::NotFound)
    );
    assert_eq!(v.revision(&s()).unwrap(), 3);
    assert_eq!(
        v.get_time_entry(&s(), "e").unwrap().unwrap().billing_status,
        "billed"
    );
}
#[test]
fn rates_fee_resolution_cas_upserts_and_reopen() {
    let key = KeyMaterial::generate().unwrap();
    let (f, mut v) = SyntheticVault::create(&key).unwrap();
    v.commit_time_billing(
        &s(),
        &[
            TimeBillingChange::PutFee(fee()),
            TimeBillingChange::PutRate(rate()),
            TimeBillingChange::PutResolution(resolution()),
        ],
        0,
    )
    .unwrap();
    assert_eq!(v.put_fee_arrangement(&s(), &fee(), 0), Err(Error::Conflict));
    let mut r = rate();
    r.hourly_rate_amount = Money::new("0.01").unwrap();
    v.put_client_hourly_rate(&s(), &r, 1).unwrap();
    let mut wrong = fee();
    wrong.created_at = "2026-11-09T00:00:00.000Z".into();
    assert_eq!(
        v.put_fee_arrangement(&s(), &wrong, 2),
        Err(Error::InvalidInput)
    );
    let mut f2 = fee();
    f2.arrangement = "contingency".into();
    f2.hourly_rate_amount = None;
    f2.contingency_basis_points = Some(10000);
    v.put_fee_arrangement(&s(), &f2, 2).unwrap();
    let mut res = resolution();
    res.status = "abierto".into();
    res.outcome = None;
    res.resolution_date = None;
    res.notes = None;
    res.resolved_at = None;
    v.put_matter_resolution(&s(), &res, 3).unwrap();
    v.close().unwrap();
    let v = f.reopen(Some(&key)).unwrap();
    assert_eq!(v.get_client_hourly_rate(&s(), "client").unwrap(), Some(r));
    assert_eq!(v.get_fee_arrangement(&s()).unwrap(), Some(f2));
    assert_eq!(v.get_matter_resolution(&s()).unwrap(), Some(res));
    assert_eq!(v.revision(&s()).unwrap(), 4);
    assert_eq!(v.list_time_billing_audits(&s(), 100, 0).unwrap().len(), 6);
}
#[test]
fn binary_pagination_filter_and_closed_operations() {
    let key = KeyMaterial::generate().unwrap();
    let (_, mut v) = SyntheticVault::create(&key).unwrap();
    let changes = ["Z", "a", "a-", "a_"].map(|id| TimeBillingChange::CreateEntry(entry(id)));
    v.commit_time_billing(&s(), &changes, 0).unwrap();
    assert_eq!(
        v.list_time_entries(&s(), None, 100, 0)
            .unwrap()
            .iter()
            .map(|e| e.id.as_str())
            .collect::<Vec<_>>(),
        vec!["a_", "a-", "a", "Z"]
    );
    assert_eq!(
        v.list_time_entries(&s(), None, 2, 1)
            .unwrap()
            .iter()
            .map(|e| e.id.as_str())
            .collect::<Vec<_>>(),
        vec!["a-", "a"]
    );
    assert!(
        v.list_time_entries(&s(), Some("billed"), 100, 0)
            .unwrap()
            .is_empty()
    );
    assert!(v.list_time_entries(&s(), None, 101, 0).is_err());
    v.close().unwrap();
    assert_eq!(v.commit_time_billing(&s(), &[], 0), Err(Error::Closed));
    assert_eq!(v.list_time_entries(&s(), None, 100, 0), Err(Error::Closed));
    assert_eq!(v.get_time_entry(&s(), "e"), Err(Error::Closed));
    assert_eq!(v.get_active_timer(&s(), "u"), Err(Error::Closed));
    assert_eq!(v.get_fee_arrangement(&s()), Err(Error::Closed));
    assert_eq!(v.get_client_hourly_rate(&s(), "client"), Err(Error::Closed));
    assert_eq!(v.get_matter_resolution(&s()), Err(Error::Closed));
    assert_eq!(v.list_time_billing_audits(&s(), 100, 0), Err(Error::Closed));
}
#[test]
fn concurrent_connections_have_one_cas_winner() {
    let key = KeyMaterial::generate().unwrap();
    let (f, mut a) = SyntheticVault::create(&key).unwrap();
    let mut b = f.reopen(Some(&key)).unwrap();
    let barrier = Arc::new(Barrier::new(2));
    let other = barrier.clone();
    let t = std::thread::spawn(move || {
        other.wait();
        a.put_fee_arrangement(&s(), &fee(), 0)
    });
    barrier.wait();
    let results = [b.put_fee_arrangement(&s(), &fee(), 0), t.join().unwrap()];
    assert_eq!(results.iter().filter(|r| **r == Ok(1)).count(), 1);
    assert_eq!(
        results
            .iter()
            .filter(|r| **r == Err(Error::Conflict))
            .count(),
        1
    );
    assert_eq!(b.list_time_billing_audits(&s(), 100, 0).unwrap().len(), 1);
}
#[test]
fn encrypted_canaries_vs_plain_control() {
    let key = KeyMaterial::generate().unwrap();
    let (f, mut v) = SyntheticVault::create(&key).unwrap();
    v.commit_time_billing(
        &s(),
        &[
            TimeBillingChange::CreateEntry(entry("e")),
            TimeBillingChange::PutTimer(timer()),
            TimeBillingChange::PutRate(rate()),
            TimeBillingChange::PutResolution(resolution()),
        ],
        0,
    )
    .unwrap();
    v.close().unwrap();
    let v = f.reopen(Some(&key)).unwrap();
    assert_eq!(v.get_time_entry(&s(), "e").unwrap(), Some(entry("e")));
    let plain = tempfile::tempdir().unwrap();
    let p = plain.path().join("control.sqlite");
    let c = rusqlite::Connection::open(&p).unwrap();
    c.execute_batch("CREATE TABLE control(text)").unwrap();
    let texts = [
        entry("e").description,
        timer().description,
        rate().client_name,
        resolution().notes.unwrap(),
    ];
    for t in &texts {
        c.execute("INSERT INTO control VALUES(?)", [t]).unwrap();
    }
    drop(c);
    let control = std::fs::read(&p).unwrap();
    for text in texts {
        assert!(control.windows(text.len()).any(|w| w == text.as_bytes()));
        let u16le: Vec<u8> = text.encode_utf16().flat_map(u16::to_le_bytes).collect();
        for (_, _, bytes) in f.artifacts().unwrap() {
            for pattern in [text.as_bytes(), u16le.as_slice()] {
                assert!(!bytes.windows(pattern.len()).any(|w| w == pattern));
            }
        }
    }
}
