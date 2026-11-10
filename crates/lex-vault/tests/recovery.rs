#![cfg(feature = "synthetic-recovery")]
//! All crypto cases are ignored by default; run only after independent source freeze.
use lex_vault::KeyMaterial;
use lex_vault::recovery::*;
use std::{
    fs,
    io::{Read, Write},
    process::{Child, ChildStdin, ChildStdout, Command, ExitStatus, Stdio},
    sync::{Arc, Condvar, Mutex},
    thread,
    time::{Duration, Instant},
};
use zeroize::Zeroizing;
#[path = "support/recovery_fixture.rs"]
mod fixture;
// Sole custody of every spawned Child, including the RSS sampler. No raw-PID signal is
// issued: Child::kill tracks already-reaped children, so a reused PID cannot be killed.
// Registry operations never perform pipe I/O, wait, join or callbacks while locked.
// spawn is serialized with shutdown; no child can escape between spawn and registration.
#[derive(Default)]
struct Children {
    state: Mutex<ChildrenState>,
    finished: Condvar,
}
#[derive(Default)]
struct ChildrenState {
    children: Vec<Child>,
    stopping: bool,
    done: bool,
    cleanup_ok: bool,
}
impl Children {
    fn lock(&self) -> std::sync::MutexGuard<'_, ChildrenState> {
        self.state.lock().unwrap_or_else(|e| e.into_inner())
    }
    fn spawn(
        &self,
        command: &mut Command,
    ) -> std::io::Result<(usize, u32, Option<ChildStdin>, Option<ChildStdout>)> {
        let mut state = self.lock();
        if state.stopping {
            return Err(std::io::Error::other("supervisor stopped"));
        }
        // Fixed bounded batch: at most 13 restores + 6000 RSS samples + synthetic tests.
        if state.children.len() >= 8192 {
            return Err(std::io::Error::other("supervisor child limit"));
        }
        state
            .children
            .try_reserve(1)
            .map_err(|_| std::io::Error::other("supervisor capacity"))?;
        let mut child = command.spawn()?;
        let id = state.children.len();
        let pid = child.id();
        let stdin = child.stdin.take();
        let stdout = child.stdout.take();
        state.children.push(child);
        Ok((id, pid, stdin, stdout))
    }
    fn poll(&self, id: usize) -> std::io::Result<Option<ExitStatus>> {
        let mut state = self.lock();
        if state.stopping {
            return Err(std::io::Error::other("supervisor stopped"));
        }
        state
            .children
            .get_mut(id)
            .ok_or_else(|| std::io::Error::other("unknown owned child"))?
            .try_wait()
    }
    fn shutdown(&self) -> bool {
        let mut state = self.lock();
        if state.stopping {
            while !state.done {
                state = self.finished.wait(state).unwrap_or_else(|e| e.into_inner());
            }
            return state.cleanup_ok;
        }
        state.stopping = true;
        let mut children = std::mem::take(&mut state.children);
        drop(state);
        // Kill every live owned process before waiting on any of them. wait observes/reaps
        // even if kill races natural exit. No writer join is needed to unblock cleanup.
        for child in &mut children {
            let _ = child.kill();
        }
        let mut ok = true;
        for child in &mut children {
            ok &= child.wait().is_ok();
        }
        let mut state = self.lock();
        state.cleanup_ok = ok;
        state.done = true;
        self.finished.notify_all();
        ok
    }
}
impl Drop for Children {
    fn drop(&mut self) {
        let _ = self.shutdown();
    }
}
// Independent supervisor covers preparation and inline seal negatives as well as child restores.
// getrusage reads only this synthetic test process; no foreign process environment or argv.
struct BatchGuard {
    stop: std::sync::Arc<std::sync::atomic::AtomicBool>,
    stage: std::sync::Arc<std::sync::atomic::AtomicU64>,
    peak: std::sync::Arc<std::sync::atomic::AtomicU64>,
    join: Option<thread::JoinHandle<()>>,
    started: Instant,
    children: Arc<Children>,
}
impl BatchGuard {
    fn start() -> Self {
        use std::sync::{
            Arc,
            atomic::{AtomicBool, AtomicU64, Ordering},
        };
        let stop = Arc::new(AtomicBool::new(false));
        let stage = Arc::new(AtomicU64::new(0));
        let peak = Arc::new(AtomicU64::new(0));
        let started = Instant::now();
        let children = Arc::new(Children::default());
        let owned = children.clone();
        let (stop_thread, stage_thread, peak_thread) = (stop.clone(), stage.clone(), peak.clone());
        let join = thread::spawn(move || {
            while !stop_thread.load(Ordering::SeqCst) {
                let elapsed = started.elapsed().as_millis() as u64;
                if elapsed >= 300000
                    || elapsed.saturating_sub(stage_thread.load(Ordering::SeqCst)) >= 60000
                {
                    terminate_after_cleanup(&owned, 71)
                }
                let mut usage = std::mem::MaybeUninit::<libc::rusage>::uninit();
                if unsafe { libc::getrusage(libc::RUSAGE_SELF, usage.as_mut_ptr()) } != 0 {
                    terminate_after_cleanup(&owned, 72)
                }
                let bytes = unsafe { usage.assume_init() }.ru_maxrss as u64;
                peak_thread.fetch_max(bytes, Ordering::SeqCst);
                if bytes > 805306368 {
                    terminate_after_cleanup(&owned, 73)
                }
                thread::sleep(Duration::from_millis(50));
            }
        });
        Self {
            stop,
            stage,
            peak,
            join: Some(join),
            started,
            children,
        }
    }
    fn next(&self) {
        self.stage.store(
            self.started.elapsed().as_millis() as u64,
            std::sync::atomic::Ordering::SeqCst,
        );
    }
    fn peak(&self) -> u64 {
        self.peak.load(std::sync::atomic::Ordering::SeqCst)
    }
}
impl Drop for BatchGuard {
    fn drop(&mut self) {
        let clean = self.children.shutdown();
        self.stop.store(true, std::sync::atomic::Ordering::SeqCst);
        if let Some(join) = self.join.take() {
            let _ = join.join();
        }
        if !clean {
            std::process::exit(74);
        }
    }
}
fn cleanup_for_failure(children: &Children, code: i32) -> i32 {
    if children.shutdown() { code } else { 74 }
}
fn terminate_after_cleanup(children: &Children, code: i32) -> ! {
    std::process::exit(cleanup_for_failure(children, code))
}
// A failed RSS sampler is harmless only when the owned restore has already exited.
// Otherwise monitoring is unavailable: clean up and return the finite sampler-failure code.
fn check_sampler_exit(
    children: &Children,
    restore: usize,
    sampler_status: ExitStatus,
) -> Result<Option<ExitStatus>, i32> {
    if sampler_status.success() {
        return Ok(None);
    }
    match children.poll(restore) {
        Ok(Some(status)) => Ok(Some(status)),
        Ok(None) | Err(_) => Err(cleanup_for_failure(children, 72)),
    }
}
fn part(writer: &mut impl Write, bytes: &[u8]) {
    writer
        .write_all(&(bytes.len() as u32).to_be_bytes())
        .unwrap();
    writer.write_all(bytes).unwrap();
}
fn child_case(
    bytes: &[u8],
    secret: Option<&RecoveryPassphrase>,
    expected: &SyntheticRecoveryExpectation,
    collision: bool,
    batch: Instant,
    guard: &BatchGuard,
) -> (u8, u64) {
    assert!(batch.elapsed() < Duration::from_secs(300));
    let root = tempfile::Builder::new()
        .prefix("lex-recovery-child-synthetic-")
        .tempdir()
        .unwrap();
    fs::create_dir(root.path().join("home")).unwrap();
    fs::create_dir(root.path().join("tmp")).unwrap();
    let mut input = Zeroizing::new(Vec::with_capacity(
        1 + 12 + 128 + MAX_MANIFEST + MAX_CIPHERTEXT + 1,
    ));
    input.push(u8::from(collision));
    if let Some(s) = secret {
        s.write_private(&mut *input).unwrap()
    } else {
        part(&mut *input, &[])
    }
    part(&mut *input, &expected.to_private_bytes().unwrap());
    part(&mut *input, bytes);
    let (child, pid, stdin, child_stdout) = guard
        .children
        .spawn(
            Command::new(env!("CARGO_BIN_EXE_lex-vault-recovery-fixture"))
                .env_clear()
                .env("HOME", root.path().join("home"))
                .env("TMPDIR", root.path().join("tmp"))
                .env("PATH", "/usr/bin:/bin")
                .env("LANG", "C")
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::null()),
        )
        .unwrap();
    // Pipe writer is separate so a stalled child cannot block the supervisor before its timer.
    let mut stdin = stdin.unwrap();
    let writer = thread::spawn(move || {
        let result = stdin.write_all(&input);
        drop(stdin);
        drop(input);
        result
    });
    let started = Instant::now();
    let mut peak = 0u64;
    let status = loop {
        if let Some(status) = guard.children.poll(child).unwrap() {
            break status;
        }
        if started.elapsed() > Duration::from_secs(60) || batch.elapsed() > Duration::from_secs(300)
        {
            assert!(guard.children.shutdown());
            let _ = writer.join();
            panic!("bounded recovery deadline")
        }
        // Development-only monitor: owned child PID, fixed numeric ps column, no names/argv.
        let (sampler, _, _, output) = guard
            .children
            .spawn(
                Command::new("/bin/ps")
                    .args(["-o", "rss=", "-p", &pid.to_string()])
                    .env_clear()
                    .env("PATH", "/usr/bin:/bin")
                    .stdin(Stdio::null())
                    .stdout(Stdio::piped())
                    .stderr(Stdio::null()),
            )
            .unwrap();
        // This sampler also belongs to the batch watchdog, including while its pipe stalls.
        let mut output_bytes = Vec::new();
        output
            .unwrap()
            .take(129)
            .read_to_end(&mut output_bytes)
            .unwrap();
        let sampler_status = loop {
            if let Some(status) = guard.children.poll(sampler).unwrap() {
                break status;
            }
            thread::sleep(Duration::from_millis(1));
        };
        match check_sampler_exit(&guard.children, child, sampler_status) {
            Ok(Some(status)) => break status,
            Ok(None) => {}
            Err(code) => std::process::exit(code), // cleanup/reaping already completed
        }
        assert!(output_bytes.len() <= 128);
        if sampler_status.success() {
            let rss = std::str::from_utf8(&output_bytes)
                .unwrap()
                .trim()
                .parse::<u64>()
                .unwrap()
                .checked_mul(1024)
                .unwrap();
            peak = peak.max(rss);
            let mut usage = std::mem::MaybeUninit::<libc::rusage>::uninit();
            let measured = unsafe { libc::getrusage(libc::RUSAGE_SELF, usage.as_mut_ptr()) } == 0;
            let parent_rss = if measured {
                unsafe { usage.assume_init() }.ru_maxrss as u64
            } else {
                u64::MAX
            };
            if rss.saturating_add(parent_rss) > 805_306_368 {
                assert!(guard.children.shutdown());
                let _ = writer.join();
                panic!("bounded recovery RSS")
            }
        }
        thread::sleep(Duration::from_millis(50));
    };
    let _ = writer.join().unwrap();
    let mut stdout = Vec::new();
    child_stdout
        .unwrap()
        .take(4097)
        .read_to_end(&mut stdout)
        .unwrap();
    assert!(stdout.len() <= 4096);
    assert!(
        !stdout
            .windows(fixture::CANARY.len())
            .any(|w| w == fixture::CANARY)
    );
    let receipt: serde_json::Value = serde_json::from_slice(&stdout).unwrap();
    assert_eq!(receipt.as_object().unwrap().len(), 3);
    assert_eq!(receipt["version"], 1);
    let code = receipt["categoryCode"].as_u64().unwrap();
    assert!(code <= 13);
    assert_eq!(receipt["capabilityPublished"], code == 0);
    assert_eq!(status.success(), code == 0);
    // Only ciphertext residuals may exist. Clean child capabilities should remove all owned DBs.
    assert_eq!(fs::read_dir(root.path().join("tmp")).unwrap().count(), 0);
    (code as u8, peak)
}
#[test]
#[ignore = "18 supervised synthetic invocations require independent code review + root freeze; no automatic crypto tests"]
fn first_batch_18() {
    assert!(cfg!(target_os = "macos"));
    let guard = BatchGuard::start();
    let batch = Instant::now();
    let (source, vault, key, expected) = fixture::fixture().unwrap();
    let sealed = match seal_for_recovery(
        source,
        vault,
        Some(key),
        expected.clone(),
        RecoveryFailpoint::None,
    ) {
        Ok(s) => s,
        Err(e) => panic!("seal category {:?}", e.reason()),
    };
    let passphrase = RecoveryPassphrase::generate_synthetic().unwrap();
    let bundle = sealed
        .export_recovery(&passphrase, RecoveryFailpoint::None)
        .unwrap();
    let ciphertext = bundle.ciphertext().unwrap();
    // Exactly two deliberately malformed authenticated envelopes prepared, never retried.
    let internal = synthetic_negative_envelope(
        &sealed,
        &passphrase,
        RecoveryFixtureMutation::InternalAppend,
    )
    .unwrap();
    let oversize_plain = synthetic_negative_envelope(
        &sealed,
        &passphrase,
        RecoveryFixtureMutation::OversizedPlaintext,
    )
    .unwrap();
    for bytes in [&ciphertext, &internal, &oversize_plain] {
        sealed.ciphertext_secret_scan(&passphrase, bytes).unwrap();
    }
    sealed.verify_preserved().unwrap();
    let retained = sealed.retire_key(); // original DEK no longer exists in source owner
    let mut cases = Vec::new();
    let mut peak = 0;
    let mut run = |id: &str,
                   bytes: &[u8],
                   secret: Option<&RecoveryPassphrase>,
                   exp: &SyntheticRecoveryExpectation,
                   collision: bool,
                   expected_code: u8| {
        guard.next();
        let (code, rss) = child_case(bytes, secret, exp, collision, batch, &guard);
        peak = peak.max(rss);
        assert_eq!(code, expected_code, "exact finite recovery category");
        retained.verify_ciphertext_preserved().unwrap();
        cases.push(serde_json::json!({"id":id,"categoryCode":code,"published":code==0}));
    };
    run("R01", &ciphertext, Some(&passphrase), &expected, false, 0);
    let wrong = RecoveryPassphrase::generate_synthetic().unwrap();
    run("R03-wrong", &ciphertext, Some(&wrong), &expected, false, 3);
    run("R03-missing", &ciphertext, None, &expected, false, 2);
    // Release closure borrow before explicit source-ownership checks.
    drop(run);
    for missing in [true, false] {
        guard.next();
        let (source, vault, key, e) = fixture::fixture().unwrap();
        let before = source.artifacts().unwrap();
        let supplied = if missing {
            None
        } else {
            Some(KeyMaterial::generate().unwrap())
        };
        let failed =
            match seal_for_recovery(source, vault, supplied, e.clone(), RecoveryFailpoint::None) {
                Err(f) => f,
                Ok(_) => panic!("negative seal published"),
            };
        let reason = failed.reason();
        assert_eq!(
            reason,
            if missing {
                RecoveryError::MissingCredential
            } else {
                RecoveryError::SourceIntegrity
            }
        );
        let (source, vault, _, _) = failed.into_parts();
        if missing {
            assert!(vault.is_some())
        } else {
            assert!(vault.is_none())
        }
        drop(vault);
        assert_eq!(source.artifacts().unwrap(), before);
        verify_source_readonly(&source, &key, &e).unwrap();
        cases.push(serde_json::json!({"id":if missing{"R04-missing"}else{"R04-wrong"},"categoryCode":format!("{reason:?}"),"published":false}));
    }
    for closed in [false, true] {
        guard.next();
        let (source, vault, key, e) = fixture::fixture().unwrap();
        let before = source.artifacts().unwrap();
        let mut other = source.reopen(Some(&key)).unwrap();
        if closed {
            other.close().unwrap()
        }
        let failed =
            match seal_for_recovery(source, vault, Some(key), e.clone(), RecoveryFailpoint::None) {
                Err(f) => f,
                Ok(_) => panic!("negative seal published"),
            };
        assert_eq!(failed.reason(), RecoveryError::SourceNotQuiescent);
        let (source, vault, key, _) = failed.into_parts();
        assert!(vault.is_some());
        drop(other);
        drop(vault);
        assert_eq!(source.artifacts().unwrap(), before);
        verify_source_readonly(&source, key.as_ref().unwrap(), &e).unwrap();
        cases.push(serde_json::json!({"id":if closed{"R05-retained-closed"}else{"R05-live"},"categoryCode":"SourceNotQuiescent","published":false}));
    }
    let mut run = |id: &str,
                   bytes: &[u8],
                   exp: &SyntheticRecoveryExpectation,
                   collision: bool,
                   expected_code: u8| {
        guard.next();
        let (code, rss) = child_case(bytes, Some(&passphrase), exp, collision, batch, &guard);
        peak = peak.max(rss);
        assert_ne!(expected_code, 0);
        assert_eq!(code, expected_code, "exact negative recovery category");
        retained.verify_ciphertext_preserved().unwrap();
        cases.push(serde_json::json!({"id":id,"categoryCode":code,"published":false}));
    };
    run(
        "R06-final-truncate",
        &ciphertext[..ciphertext.len() - 1],
        &expected,
        false,
        3,
    );
    let mut flipped = ciphertext.clone();
    let middle = flipped.len() / 2;
    flipped[middle] ^= 1;
    run("R07-body-flip", &flipped, &expected, false, 3);
    let foreign_bytes = Zeroizing::new(
        String::from_utf8(expected.to_private_bytes().unwrap().to_vec())
            .unwrap()
            .replace("synthetic_firm", "foreign_firm"),
    );
    let foreign =
        SyntheticRecoveryExpectation::from_private_bytes(foreign_bytes.as_bytes()).unwrap();
    run("R09-foreign", &ciphertext, &foreign, false, 5);
    run("R13-staging-collision", &ciphertext, &expected, true, 11);
    run(
        "R17-cipher-size",
        &vec![0; MAX_CIPHERTEXT + 1],
        &expected,
        false,
        9,
    );
    run("R17-header", &vec![b'A'; 16385], &expected, false, 9);
    run("R17-plain-size", &oversize_plain, &expected, false, 9);
    let mut high = ciphertext.clone();
    let position = high.windows(4).position(|w| w == b" 18\n").unwrap();
    high[position + 2] = b'9';
    run("R17-log19", &high, &expected, false, 9);
    run("R23a-internal-append", &internal, &expected, false, 4);
    let mut appended = ciphertext.clone();
    appended.push(0x42);
    run("R23b-external-append", &appended, &expected, false, 3);
    drop(run);
    assert!(
        fixture::PDF
            .windows(fixture::CANARY.len())
            .any(|w| w == fixture::CANARY)
    );
    for bytes in [&ciphertext, &internal, &oversize_plain] {
        assert!(
            !bytes
                .windows(fixture::CANARY.len())
                .any(|w| w == fixture::CANARY)
        );
        assert!(
            !bytes
                .windows(b"keyBytesSha256".len())
                .any(|w| w == b"keyBytesSha256")
        );
    }
    retained.verify_ciphertext_preserved().unwrap();
    cases.push(
        serde_json::json!({"id":"R18-scanner","positiveControl":true,"encryptedNegative":true}),
    );
    assert_eq!(cases.len(), 18);
    assert!(batch.elapsed() < Duration::from_secs(300));
    // Technical receipt only; R01 cannot be accepted until both preceding R23 checks passed.
    println!(
        "{}",
        serde_json::json!({"protocol":"vault-recovery-synthetic-v1","invocations":18,"caseMatrixRows":24,"firstBatchOnly":true,"eofChecksPassed":true,"roundtripProvisional":false,"productionEnabled":false,"h5Complete":false,"preparation":{"baseFixture":1,"negativeSealFixtures":4,"baseExports":1,"authenticatedNegativeEnvelopes":2},"peakSampledChildRssBytes":peak,"peakParentRssBytes":guard.peak(),"elapsedMs":batch.elapsed().as_millis(),"cases":cases})
    );
}

// Separate, explicitly selected resource-supervision stage: no database, key, age or KDF.
// Never enabled by the crypto batch and ignored in ordinary/compile-only CI.
#[test]
#[ignore = "harmless process supervision requires separate reviewed clean-VM execution"]
fn supervisor_cleanup_without_crypto() {
    fn spawn_sleep(owned: &Children) -> (usize, u32) {
        let (id, pid, _, _) = owned
            .spawn(
                Command::new("/bin/sleep")
                    .arg("30")
                    .env_clear()
                    .stdin(Stdio::null())
                    .stdout(Stdio::null())
                    .stderr(Stdio::null()),
            )
            .unwrap();
        (id, pid)
    }
    fn reaped(pid: u32) {
        let mut status = 0;
        assert_eq!(
            unsafe { libc::waitpid(pid as libc::pid_t, &mut status, libc::WNOHANG) },
            -1
        );
        assert_eq!(
            std::io::Error::last_os_error().raw_os_error(),
            Some(libc::ECHILD)
        );
    }
    // The exact terminal cleanup used by the watchdog for time, sampler failure and RSS.
    for code in [71, 72, 73] {
        let owned = Children::default();
        let (id, pid) = spawn_sleep(&owned);
        assert!(owned.poll(id).unwrap().is_none());
        assert_eq!(cleanup_for_failure(&owned, code), code);
        reaped(pid);
        assert!(owned.spawn(&mut Command::new("/bin/true")).is_err());
        assert!(owned.shutdown()); // idempotence, no second raw-PID kill
    }
    // Inject an unsuccessful ps status while the owned restore is demonstrably live.
    // This exercises the same branch as the real sampler, without invoking ps or crypto.
    use std::os::unix::process::ExitStatusExt;
    let bad_ps = || ExitStatus::from_raw(1 << 8);
    let owned = Children::default();
    let (id, pid) = spawn_sleep(&owned);
    assert!(owned.poll(id).unwrap().is_none());
    assert_eq!(check_sampler_exit(&owned, id, bad_ps()).unwrap_err(), 72);
    reaped(pid);
    assert!(owned.lock().done);
    // Two racing shutdown callers both return only after the single owner has reaped.
    let owned = Arc::new(Children::default());
    let (_, pid) = spawn_sleep(&owned);
    let other = owned.clone();
    let join = thread::spawn(move || other.shutdown());
    assert!(owned.shutdown());
    assert!(join.join().unwrap());
    reaped(pid);
    // Natural exit + poll/reap before cleanup must not cause a stale-PID signal.
    let owned = Children::default();
    let (id, pid, _, _) = owned
        .spawn(
            Command::new("/bin/true")
                .env_clear()
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null()),
        )
        .unwrap();
    let deadline = Instant::now() + Duration::from_secs(2);
    loop {
        if let Some(status) = owned.poll(id).unwrap() {
            assert!(status.success());
            break;
        }
        if Instant::now() >= deadline {
            owned.shutdown();
            panic!("synthetic exit deadline");
        }
        thread::sleep(Duration::from_millis(1));
    }
    // The same failed sampler after normal restore exit preserves that exact exit status
    // and does not close the registry or turn it into a monitoring failure.
    assert!(
        check_sampler_exit(&owned, id, bad_ps())
            .unwrap()
            .unwrap()
            .success()
    );
    assert!(!owned.lock().stopping);
    assert!(owned.shutdown());
    reaped(pid);
    // Deliberately injected test panic is caught only to inspect RAII cleanup, not as
    // recovery success. Production crypto errors/panics still fail exact case checks.
    let mut observed = None;
    let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let guard = BatchGuard::start();
        let (_, pid) = spawn_sleep(&guard.children);
        observed = Some((guard.children.clone(), pid));
        panic!("synthetic supervisor unwind");
    }));
    assert!(outcome.is_err());
    let (owned, pid) = observed.unwrap();
    assert!(owned.lock().done);
    assert!(owned.lock().cleanup_ok);
    reaped(pid);
}
