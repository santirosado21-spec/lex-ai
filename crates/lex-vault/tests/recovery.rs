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
// Sole custody of every spawned Child. RSS uses the maintained libc task-info API,
// not an external process. No raw-PID signal is
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
    sampler: SamplerCounters,
    last_sample: SampleObservation,
}
// Numeric diagnostic vocabulary: wait0=not attempted,1=running,2=exited,3=error;
// rss0=not observed,1=zero,2=positive; result1=RSS,2=exited,3=error;
// exit0=not observed,1=success,2=nonzero exit,3=signal/other Unix termination.
#[derive(Clone, Copy, Default)]
struct SampleObservation {
    pre: u8,
    post: u8,
    pre_errno: i32,
    post_errno: i32,
    query_return: i32,
    expected: i32,
    query_attempted: bool,
    errno: i32,
    errno_captured: bool,
    rss: u8,
    result: u8,
    exit: u8,
}
#[derive(Clone, Copy, Default)]
struct SamplerCounters {
    calls: u64,
    queries: u64,
    positive: u64,
    zero: u64,
    short_or_failed: u64,
    exited: u64,
    errors: u64,
}
static DIAGNOSTIC_LINES: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
static PARENT_USAGE_CHECKS: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
static PARENT_USAGE_FAILURES: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
fn diagnostic_line(arguments: std::fmt::Arguments<'_>) {
    // Bounded even on a novel failure loop. No I/O while the Child mutex is held.
    if DIAGNOSTIC_LINES.fetch_add(1, std::sync::atomic::Ordering::SeqCst) < 192 {
        static START: std::sync::OnceLock<Instant> = std::sync::OnceLock::new();
        let elapsed = START.get_or_init(Instant::now).elapsed().as_millis();
        let mut out = std::io::stdout().lock();
        let _ = writeln!(out, "LEX_RECOVERY_RSS_V1 elapsed_ms={elapsed} {arguments}");
        let _ = out.flush();
    }
}
fn emit_sample(source: u8, o: SampleObservation, c: SamplerCounters) {
    diagnostic_line(format_args!(
        "source={source} pre={} post={} pre_errno={} post_errno={} query={} returned={} expected={} errno_captured={} errno={} rss={} result={} exit={} calls={} queries={} positive={} zero={} short_or_failed={} exited={} errors={}",
        o.pre,
        o.post,
        o.pre_errno,
        o.post_errno,
        u8::from(o.query_attempted),
        o.query_return,
        o.expected,
        u8::from(o.errno_captured),
        o.errno,
        o.rss,
        o.result,
        o.exit,
        c.calls,
        c.queries,
        c.positive,
        c.zero,
        c.short_or_failed,
        c.exited,
        c.errors
    ));
}
fn observed_wait(
    child: &mut Child,
    observation: &mut SampleObservation,
    pre: bool,
) -> std::io::Result<Option<ExitStatus>> {
    let result = child.try_wait();
    let (state, errno) = match &result {
        Ok(None) => (1, 0),
        Ok(Some(status)) => {
            observation.exit = if status.success() {
                1
            } else if status.code().is_some() {
                2
            } else {
                3
            };
            (2, 0)
        }
        Err(error) => (3, error.raw_os_error().unwrap_or(0)),
    };
    if pre {
        observation.pre = state;
        observation.pre_errno = errno;
    } else {
        observation.post = state;
        observation.post_errno = errno;
    }
    result
}
fn parent_usage(source: u8) -> Result<u64, ()> {
    let checks = PARENT_USAGE_CHECKS.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;
    let mut usage = std::mem::MaybeUninit::<libc::rusage>::uninit();
    let returned = unsafe { libc::getrusage(libc::RUSAGE_SELF, usage.as_mut_ptr()) };
    if returned != 0 {
        let errno = std::io::Error::last_os_error().raw_os_error().unwrap_or(0);
        let failures = PARENT_USAGE_FAILURES.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;
        diagnostic_line(format_args!(
            "source={source} parent_return={returned} errno={errno} checks={checks} failures={failures}"
        ));
        Err(())
    } else {
        Ok(unsafe { usage.assume_init() }.ru_maxrss as u64)
    }
}
enum OwnedSample {
    Exited(ExitStatus),
    Rss(u64),
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
        // Fixed bounded batch: at most 13 restores plus harmless supervisor fixtures.
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
    fn sample_rss(&self, id: usize) -> std::io::Result<OwnedSample> {
        // The owned Child remains unreaped during query, serialized with shutdown.
        let mut state = self.lock();
        let mut observation = SampleObservation::default();
        let result = (|| {
            if state.stopping {
                return Err(std::io::Error::other("supervisor stopped"));
            }
            let child = state
                .children
                .get_mut(id)
                .ok_or_else(|| std::io::Error::other("unknown owned child"))?;
            if let Some(status) = observed_wait(child, &mut observation, true)? {
                return Ok(OwnedSample::Exited(status));
            }
            #[cfg(target_os = "macos")]
            {
                let pid = libc::c_int::try_from(child.id())
                    .map_err(|_| std::io::Error::other("owned PID range"))?;
                let mut info = std::mem::MaybeUninit::<libc::proc_taskinfo>::zeroed();
                let size = std::mem::size_of::<libc::proc_taskinfo>() as libc::c_int;
                observation.query_attempted = true;
                observation.expected = size;
                let read = unsafe {
                    libc::proc_pidinfo(
                        pid,
                        libc::PROC_PIDTASKINFO,
                        0,
                        info.as_mut_ptr().cast::<libc::c_void>(),
                        size,
                    )
                };
                // Capture errno immediately, before postquery try_wait or any logging.
                // A short positive return need not set errno: observed value is not a causal claim.
                let errno = if read != size {
                    Some(std::io::Error::last_os_error().raw_os_error().unwrap_or(0))
                } else {
                    None
                };
                observation.query_return = read;
                observation.errno_captured = errno.is_some();
                observation.errno = errno.unwrap_or(0);
                if read == size {
                    let rss = unsafe { info.assume_init() }.pti_resident_size;
                    observation.rss = if rss > 0 { 2 } else { 1 };
                    if rss > 0 {
                        return Ok(OwnedSample::Rss(rss));
                    }
                }
            }
            if let Some(status) = observed_wait(child, &mut observation, false)? {
                return Ok(OwnedSample::Exited(status));
            }
            Err(std::io::Error::other("owned child RSS unavailable"))
        })();
        observation.result = match &result {
            Ok(OwnedSample::Rss(_)) => 1,
            Ok(OwnedSample::Exited(_)) => 2,
            Err(_) => 3,
        };
        let c = &mut state.sampler;
        c.calls += 1;
        c.queries += u64::from(observation.query_attempted);
        c.positive += u64::from(observation.rss == 2);
        c.zero += u64::from(observation.rss == 1);
        c.short_or_failed += u64::from(
            observation.query_attempted && observation.query_return != observation.expected,
        );
        c.exited += u64::from(observation.result == 2);
        c.errors += u64::from(observation.result == 3);
        let counters = *c;
        state.last_sample = observation;
        drop(state);
        if observation.result == 3 || observation.query_attempted && observation.rss != 2 {
            emit_sample(1, observation, counters);
        }
        result
    }
    fn emit_sampler_snapshot(&self, source: u8) {
        let state = self.lock();
        let observation = state.last_sample;
        let counters = state.sampler;
        drop(state);
        emit_sample(source, observation, counters);
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
        let observation = state.last_sample;
        let counters = state.sampler;
        drop(state);
        emit_sample(2, observation, counters);
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
                let bytes = match parent_usage(3) {
                    Ok(bytes) => bytes,
                    Err(()) => terminate_after_cleanup(&owned, 72),
                };
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
fn resolve_sample_failure(children: &Children, restore: usize) -> Result<ExitStatus, i32> {
    let observed = children.poll(restore);
    let (state, errno, exit) = match &observed {
        Ok(Some(status)) => (
            2,
            0,
            if status.success() {
                1
            } else if status.code().is_some() {
                2
            } else {
                3
            },
        ),
        Ok(None) => (1, 0, 0),
        Err(error) => (3, error.raw_os_error().unwrap_or(0), 0),
    };
    diagnostic_line(format_args!(
        "source=5 wait={state} errno={errno} exit={exit}"
    ));
    match observed {
        Ok(Some(status)) => Ok(status),
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
    let (child, _pid, stdin, child_stdout) = guard
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
        // Fixed native read of our owned child; no setuid ps executable under sandbox.
        match guard.children.sample_rss(child) {
            Ok(OwnedSample::Exited(status)) => break status,
            Err(_) => match resolve_sample_failure(&guard.children, child) {
                Ok(status) => break status,
                Err(code) => std::process::exit(code), // cleanup/reaping already completed
            },
            Ok(OwnedSample::Rss(rss)) => {
                peak = peak.max(rss);
                let parent_rss = parent_usage(4).unwrap_or(u64::MAX);
                if rss.saturating_add(parent_rss) > 805_306_368 {
                    assert!(guard.children.shutdown());
                    let _ = writer.join();
                    panic!("bounded recovery RSS")
                }
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
// Fixed, non-JSON diagnostic vocabulary only. These observations never reset the guard.
// START/DONE describes one operation, not acceptance; R01 still requires both R23 checks.
fn phase_marker(batch: Instant, phase: &str, done: bool) {
    let fixed = match phase {
        "PREP_FIXTURE" => "PREP_FIXTURE",
        "PREP_SEAL" => "PREP_SEAL",
        "PREP_PASSPHRASE" => "PREP_PASSPHRASE",
        "PREP_EXPORT" => "PREP_EXPORT",
        "PREP_READ_CIPHERTEXT" => "PREP_READ_CIPHERTEXT",
        "PREP_INTERNAL_ENVELOPE" => "PREP_INTERNAL_ENVELOPE",
        "PREP_OVERSIZE_ENVELOPE" => "PREP_OVERSIZE_ENVELOPE",
        "PREP_SECRET_SCAN" => "PREP_SECRET_SCAN",
        "PREP_VERIFY_RETIRE" => "PREP_VERIFY_RETIRE",
        "PREP_WRONG_PASSPHRASE" => "PREP_WRONG_PASSPHRASE",
        "R01" => "R01",
        "R03-wrong" => "R03-wrong",
        "R03-missing" => "R03-missing",
        "R04-missing" => "R04-missing",
        "R04-wrong" => "R04-wrong",
        "R05-live" => "R05-live",
        "R05-retained-closed" => "R05-retained-closed",
        "R06-final-truncate" => "R06-final-truncate",
        "R07-body-flip" => "R07-body-flip",
        "R09-foreign" => "R09-foreign",
        "R13-staging-collision" => "R13-staging-collision",
        "R17-cipher-size" => "R17-cipher-size",
        "R17-header" => "R17-header",
        "R17-plain-size" => "R17-plain-size",
        "R17-log19" => "R17-log19",
        "R23a-internal-append" => "R23a-internal-append",
        "R23b-external-append" => "R23b-external-append",
        "R18-scanner" => "R18-scanner",
        _ => panic!("invalid diagnostic phase"),
    };
    let state = if done { "DONE" } else { "START" };
    let mut out = std::io::stdout().lock();
    writeln!(
        out,
        "LEX_RECOVERY_PHASE_V1 phase={fixed} state={state} elapsed_ms={}",
        batch.elapsed().as_millis()
    )
    .unwrap();
    out.flush().unwrap();
}
#[test]
#[ignore = "18 supervised synthetic invocations require independent code review + root freeze; no automatic crypto tests"]
fn first_batch_18() {
    assert!(cfg!(target_os = "macos"));
    let guard = BatchGuard::start();
    let batch = Instant::now();
    phase_marker(batch, "PREP_FIXTURE", false);
    let (source, vault, key, expected) = fixture::fixture().unwrap();
    phase_marker(batch, "PREP_FIXTURE", true);
    phase_marker(batch, "PREP_SEAL", false);
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
    phase_marker(batch, "PREP_SEAL", true);
    phase_marker(batch, "PREP_PASSPHRASE", false);
    let passphrase = RecoveryPassphrase::generate_synthetic().unwrap();
    phase_marker(batch, "PREP_PASSPHRASE", true);
    phase_marker(batch, "PREP_EXPORT", false);
    let bundle = sealed
        .export_recovery(&passphrase, RecoveryFailpoint::None)
        .unwrap();
    phase_marker(batch, "PREP_EXPORT", true);
    phase_marker(batch, "PREP_READ_CIPHERTEXT", false);
    let ciphertext = bundle.ciphertext().unwrap();
    phase_marker(batch, "PREP_READ_CIPHERTEXT", true);
    // Exactly two deliberately malformed authenticated envelopes prepared, never retried.
    phase_marker(batch, "PREP_INTERNAL_ENVELOPE", false);
    let internal = synthetic_negative_envelope(
        &sealed,
        &passphrase,
        RecoveryFixtureMutation::InternalAppend,
    )
    .unwrap();
    phase_marker(batch, "PREP_INTERNAL_ENVELOPE", true);
    phase_marker(batch, "PREP_OVERSIZE_ENVELOPE", false);
    let oversize_plain = synthetic_negative_envelope(
        &sealed,
        &passphrase,
        RecoveryFixtureMutation::OversizedPlaintext,
    )
    .unwrap();
    phase_marker(batch, "PREP_OVERSIZE_ENVELOPE", true);
    phase_marker(batch, "PREP_SECRET_SCAN", false);
    for bytes in [&ciphertext, &internal, &oversize_plain] {
        sealed.ciphertext_secret_scan(&passphrase, bytes).unwrap();
    }
    phase_marker(batch, "PREP_SECRET_SCAN", true);
    phase_marker(batch, "PREP_VERIFY_RETIRE", false);
    sealed.verify_preserved().unwrap();
    let retained = sealed.retire_key(); // original DEK no longer exists in source owner
    phase_marker(batch, "PREP_VERIFY_RETIRE", true);
    let mut cases = Vec::new();
    let mut peak = 0;
    let mut run = |id: &str,
                   bytes: &[u8],
                   secret: Option<&RecoveryPassphrase>,
                   exp: &SyntheticRecoveryExpectation,
                   collision: bool,
                   expected_code: u8| {
        guard.next();
        phase_marker(batch, id, false);
        let (code, rss) = child_case(bytes, secret, exp, collision, batch, &guard);
        peak = peak.max(rss);
        assert_eq!(code, expected_code, "exact finite recovery category");
        retained.verify_ciphertext_preserved().unwrap();
        cases.push(serde_json::json!({"id":id,"categoryCode":code,"published":code==0}));
        phase_marker(batch, id, true);
    };
    run("R01", &ciphertext, Some(&passphrase), &expected, false, 0);
    phase_marker(batch, "PREP_WRONG_PASSPHRASE", false);
    let wrong = RecoveryPassphrase::generate_synthetic().unwrap();
    phase_marker(batch, "PREP_WRONG_PASSPHRASE", true);
    run("R03-wrong", &ciphertext, Some(&wrong), &expected, false, 3);
    run("R03-missing", &ciphertext, None, &expected, false, 2);
    // Release closure borrow before explicit source-ownership checks.
    drop(run);
    for missing in [true, false] {
        guard.next();
        let phase = if missing { "R04-missing" } else { "R04-wrong" };
        phase_marker(batch, phase, false);
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
        phase_marker(batch, phase, true);
    }
    for closed in [false, true] {
        guard.next();
        let phase = if closed {
            "R05-retained-closed"
        } else {
            "R05-live"
        };
        phase_marker(batch, phase, false);
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
        phase_marker(batch, phase, true);
    }
    let mut run = |id: &str,
                   bytes: &[u8],
                   exp: &SyntheticRecoveryExpectation,
                   collision: bool,
                   expected_code: u8| {
        guard.next();
        phase_marker(batch, id, false);
        let (code, rss) = child_case(bytes, Some(&passphrase), exp, collision, batch, &guard);
        peak = peak.max(rss);
        assert_ne!(expected_code, 0);
        assert_eq!(code, expected_code, "exact negative recovery category");
        retained.verify_ciphertext_preserved().unwrap();
        cases.push(serde_json::json!({"id":id,"categoryCode":code,"published":false}));
        phase_marker(batch, id, true);
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
    phase_marker(batch, "R18-scanner", false);
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
    phase_marker(batch, "R18-scanner", true);
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
        assert!(matches!(owned.sample_rss(id).unwrap(), OwnedSample::Rss(bytes) if bytes > 0));
        assert_eq!(cleanup_for_failure(&owned, code), code);
        reaped(pid);
        assert!(owned.spawn(&mut Command::new("/usr/bin/true")).is_err());
        assert!(owned.shutdown()); // idempotence, no second raw-PID kill
    }
    // Inject a failed sample while the owned restore is demonstrably live.
    // This exercises the actual failure cleanup branch without ps or crypto.
    let owned = Children::default();
    let (id, pid) = spawn_sleep(&owned);
    assert!(owned.poll(id).unwrap().is_none());
    assert_eq!(resolve_sample_failure(&owned, id).unwrap_err(), 72);
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
            Command::new("/usr/bin/true")
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
    assert!(resolve_sample_failure(&owned, id).unwrap().success());
    assert!(
        matches!(owned.sample_rss(id).unwrap(), OwnedSample::Exited(status) if status.success())
    );
    assert!(owned.sample_rss(usize::MAX).is_err());
    assert!(!owned.lock().stopping);
    assert!(owned.shutdown());
    reaped(pid);
    // Predeclared harmless rapid-exit investigation, not a crypto retry. At most24
    // fresh true children; with the7 existing fixtures this test spawns at most31.
    // Stop new dispatch after2s; each child is sampled once, then killed/reaped as needed.
    let rapid_started = Instant::now();
    let mut dispatched = 0u64;
    let mut rss_observed = 0u64;
    let mut exit_observed = 0u64;
    let mut sample_errors = 0u64;
    let mut monitoring_failures = 0u64;
    let mut reaped_count = 0u64;
    for iteration in 0..24 {
        if rapid_started.elapsed() >= Duration::from_secs(2) {
            break;
        }
        assert!(parent_usage(9).is_ok(), "diagnostic parent usage failure");
        let owned = Children::default();
        let (id, pid, _, _) = owned
            .spawn(
                Command::new("/usr/bin/true")
                    .env_clear()
                    .stdin(Stdio::null())
                    .stdout(Stdio::null())
                    .stderr(Stdio::null()),
            )
            .unwrap();
        dispatched += 1;
        match iteration % 3 {
            1 => thread::yield_now(),
            2 => thread::sleep(Duration::from_millis(1)),
            _ => {}
        }
        let sample = owned.sample_rss(id);
        owned.emit_sampler_snapshot(6);
        let result = match sample {
            Ok(OwnedSample::Rss(bytes)) => {
                rss_observed += 1;
                assert!(bytes > 0 && bytes <= 805306368);
                1
            }
            Ok(OwnedSample::Exited(status)) => {
                exit_observed += 1;
                assert!(status.success());
                2
            }
            Err(_) => {
                sample_errors += 1;
                match resolve_sample_failure(&owned, id) {
                    Ok(status) => {
                        exit_observed += 1;
                        assert!(status.success());
                        3
                    }
                    Err(code) => {
                        assert_eq!(code, 72);
                        monitoring_failures += 1;
                        4
                    }
                }
            }
        };
        assert!(owned.shutdown());
        reaped(pid);
        reaped_count += 1;
        diagnostic_line(format_args!(
            "source=7 iteration={iteration} schedule={} result={result} cleanup=1 reaped=1 rapid_elapsed_ms={}",
            iteration % 3,
            rapid_started.elapsed().as_millis()
        ));
    }
    let checks = PARENT_USAGE_CHECKS.load(std::sync::atomic::Ordering::SeqCst);
    let failures = PARENT_USAGE_FAILURES.load(std::sync::atomic::Ordering::SeqCst);
    diagnostic_line(format_args!(
        "source=8 dispatched={dispatched} rss_observed={rss_observed} exit_observed={exit_observed} sample_errors={sample_errors} monitoring_failures={monitoring_failures} reaped={reaped_count} parent_checks={checks} parent_failures={failures} rapid_elapsed_ms={}",
        rapid_started.elapsed().as_millis()
    ));
    assert!(dispatched <= 24);
    assert_eq!(dispatched, reaped_count);
    // Recording a monitor failure is not successful RSS acceptance. Finish evidence and
    // fail this supervisor regression if the predeclared probes exposed such a failure.
    assert_eq!(
        monitoring_failures, 0,
        "rapid-exit monitoring failure recorded"
    );
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
