# H5b.1 native viability spike — inactive, parity gate closed

This standalone crate is **not the LEX AI store**. It creates only fresh synthetic temporary vaults and does not accept a user directory. No production code imports it. The JavaScript file `server/privacy/vault-dao-contract.mjs` is an asynchronous **memory fixture**, not a Rust bridge and not encrypted persistence. `VAULT_PARITY_COMPLETE` remains `false`: this work establishes native viability and a partial domain contract, not completion of H5b.1 or H5.

## Boundary and supported operations

`SyntheticVault::create` allocates its own random temporary root (0700), precreates its sole database (0600), and opens SQLCipher without CREATE or URI flags. `reopen` accepts the opaque owned fixture and a key, never a path. `Vault` owns a private connection and exposes `get`, `list`, `put`, `insert_document`, `original`, `first_chunks`, `search`, `revision`, `capabilities`, and `close`. The synthetic harness can inspect **only its own ciphertext artifacts** for tests; this API must not be exposed to product agents.

Every data operation requires a validated `Scope` with nonempty workspace and matter IDs and an explicit optional thread. `None`/JSON `null` means precisely records without a thread, never all threads. Blank strings, wildcards and path-shaped identifiers fail. Scope columns are part of every primary key, foreign key and read predicate. Payload IDs and scope fields must agree with the operation. This is data partitioning, **not proof of an authenticated caller's authority to select a scope**; the future broker must authorize it independently. There is no SQL, callback transaction, shell, file-opening or connection-handle operation.

Only `note` (synthetic), `chat`, and immutable imported `document` kinds exist. Writes use `BEGIN IMMEDIATE` and a per-exact-scope monotonically increasing revision; stale `expectedRevision` fails atomically. Document import stores record, exact original bytes plus SHA-256, chunks and FTS in one native transaction. Generic `put` rejects documents. Reads return exact payload strings / original bytes; no Unicode normalization is applied to stored text. SHA-256 here is an internal consistency check, not a substitute for SQLCipher authentication.

Search uses actual FTS5 with quoted normalized terms, exact scope filtering and **insertion ordering**. It deliberately does not use global FTS `bm25` statistics to rank one scope using another scope's corpus. Ranking parity and exhaustive Unicode term equivalence with legacy search are pending. The Node fixture uses literal terms, so one-row search agreement does not establish native ranking parity. The fixture canonicalizes objects through the existing `canonicalJson`; Rust validates JSON and scope then preserves the supplied UTF-8 payload verbatim. Cross-language canonical validation, complete provenance/manifest/extractor contracts, native wire encoding, pagination, and dataset-scale memory bounds remain future work.

`KeyMaterial` gets 32 bytes from the maintained OS-backed `getrandom` library, is not Debug/Clone/Serialize, and zeroizes its own allocation on drop. The binary passphrase is supplied directly through the maintained `sqlite3_key` API, with SQLCipher's normal KDF; it never enters SQL text, environment variables or argv. This spike does not claim zeroization of every compiler/OS/library copy. A nonempty real `cipher_version`, CommonCrypto provider, FTS5, memory temp compile/runtime flags, DELETE journal and foreign keys are required. A schema-page read precedes any schema creation or configuration writes on reopen. Missing, wrong and plaintext-file keys fail closed without fallback. `close` drops the native connection and future operations reject; it is **not** application-wide lock, key custody, or cancellation of other connections.

## Reproduction (repository root, macOS Apple Silicon)

```sh
export PATH="$HOME/.cargo/bin:$PATH"
export CARGO_TARGET_DIR="$PWD/artifacts/vault-h5b1/target"
cargo build --locked --manifest-path crates/lex-vault/Cargo.toml
cargo test --locked --manifest-path crates/lex-vault/Cargo.toml -- --nocapture
cargo fmt --manifest-path crates/lex-vault/Cargo.toml -- --check
node --test tests/vault-dao-contract.test.mjs
cargo tree --locked --manifest-path crates/lex-vault/Cargo.toml --target aarch64-apple-darwin
cargo metadata --locked --manifest-path crates/lex-vault/Cargo.toml --format-version 1
```

Use `--locked`. Build binaries/cache remain under ignored `artifacts/vault-h5b1/target`; do not package them. There is no binary entry point or IPC server. Default native build uses the upstream Apple CommonCrypto path; this prototype rejects a different runtime cipher provider. Do not silently add OpenSSL, alternate backends or global installs. Other platforms are not evaluated.

The installed toolchain lacked rustfmt. For this run only, the official `rustfmt-1.99.1-aarch64-apple-darwin.tar.xz` from the toolchain's 2026-10-15 Rust distribution manifest was downloaded (1,507,584 bytes), SHA-256 checked against that manifest, and extracted under ignored `artifacts/vault-h5b1/tools`. Its `rustfmt-preview/bin` was prepended to PATH for `cargo fmt`; no global toolchain changes were made. The initial `cargo fmt` reported missing component; formatting and `--check` then succeeded with that isolated component.

## Measured on 2026-11-09

- Rust 1.99.1, host `aarch64-apple-darwin`; Clang 21.0.0 reported by SQLite compile options. Native test executable: Mach-O 64-bit arm64.
- `rusqlite 0.41.1`, `libsqlite3-sys 0.39.1`, `sqlcipher-src 419.0.6+sqlcipher-4.19.0-sqlite-3.53.4-libtomcrypt-1.18.2`; actual SQLCipher **4.19.0 community**, SQLite **3.53.4**, `cipher_provider=commoncrypto`.
- Actual `ENABLE_FTS5`, `HAS_CODEC`, `TEMP_STORE=2`; runtime `temp_store=2`, `journal_mode=delete`, `foreign_keys=1`. FULL synchronous, secure_delete and cipher_memory_security are requested by source; these three are not separate reported acceptance measurements.
- `otool -L` test executable: system Security.framework, CoreFoundation.framework, libSystem and libiconv. No Homebrew/OpenSSL dynamic library. The source package also contains libtomcrypt sources, but CommonCrypto was the measured provider, not libtomcrypt.
- Initial dependency build: 6.73 s (Cargo report). Incremental native build: 0.23 s. Small debug fixture create/import/search/close/reopen: 213 ms in one run (320 ms in an earlier parallel run), **not** a startup percentile benchmark.
- A serial run of the six integration tests: 0.99 s wall, 10,190,848 bytes maximum RSS via `/usr/bin/time -l`. Debug `rlib`: 3,113,624 bytes at that measurement; integration-test executable: 4,926,552 bytes. These include debug/test overhead and can change with compiler/source; they are not a release package size or product RAM estimate.
- Original H5b.1a measurement: nine native tests passed (two internal + seven integration), six Node contract tests passed. The Node test initially compared SQLite null-prototype rows to normal JSON objects; it was corrected to compare wire JSON values. No native failure was hidden by backend replacement.

Assertions include exact binary/Unicode roundtrip and keyed reopen; missing/wrong key preserving database bytes; an independent plaintext control rejected by keyed open and an unkeyed read rejected on ciphertext; exact workspace/matter/thread filtering; document+original+chunk+FTS+revision rollback after a real duplicate-chunk constraint failure; two independent connections racing with one CAS winner; input limits; close rejecting empty searches; 0700/0600 permissions; encrypted database and live DELETE rollback journal not exposing tested UTF-8/UTF-16 canaries. The independent plaintext fixture confirms the scanner sees its canary. No raw canary, key or private path is printed in successful evidence lines.

This is a tiny synthetic native measurement on the development Mac, not an 8 GB device or the UI+daemon+detector tree. No SIGKILL, power-loss, ENOSPC, statement-journal stress, WAL, recovery, rotation, migration, Keychain, age, Office, WAV, editor, WebView, Tauri release/signing/notarization, or H3V encrypted persistence acceptance was run. `close` does not revoke other connections; production lock needs a separate supervised lifecycle. Temp-root cleanup is normal RAII only and does not prove crash cleanup. The legacy app storage remains unchanged and unencrypted.

## Full legacy DAO matrix and consumer gaps

The executable matrix is `VAULT_STORE_PARITY` in the Node contract. Its test extracts every current store method and fails if the matrix misses or adds a method. `supported-core` means the limited operation above, not product authorization or complete H5 acceptance. Existing `.db` is intentionally removed; `createStore(path)` has no production replacement. `searchTerms` is a helper with Unicode equivalence pending.

| Legacy API | Status | Gap / implemented subset |
| --- | --- | --- |
| `get` | partial | Exact scope; note/chat/document only; no unscoped legacy reads. |
| `list` | partial | Exact scope; no workspace-wide enumeration or all legacy kinds. |
| `put` | partial | Scoped note/chat CAS only; document mutations rejected. |
| `transaction` | not-implemented | Callback RPC prohibited; each compound domain needs its own atomic operation. |
| `audit` | not-implemented | Scoped audit domain/schema required. |
| `createReminder` | partial | Bounded matter-only reminder domain with atomic internal audit/CAS; service/planner integration and full date spelling parity pending. |
| `getReminder` | partial | Bounded matter-only reminder domain with atomic internal audit/CAS; service/planner integration and full date spelling parity pending. |
| `listReminders` | partial | Bounded matter-only reminder domain with atomic internal audit/CAS; service/planner integration and full date spelling parity pending. |
| `updateReminder` | partial | Bounded matter-only reminder domain with atomic internal audit/CAS; service/planner integration and full date spelling parity pending. |
| `createAgentProposal` | not-implemented | Proposal/decision/result/log compound atomic domain pending. |
| `getAgentProposal` | not-implemented | Proposal/decision/result/log compound atomic domain pending. |
| `listAgentProposals` | not-implemented | Proposal/decision/result/log compound atomic domain pending. |
| `updateAgentProposal` | not-implemented | Proposal/decision/result/log compound atomic domain pending. |
| `logAgentAction` | not-implemented | Proposal/decision/result/log compound atomic domain pending. |
| `listAgentActionLog` | not-implemented | Proposal/decision/result/log compound atomic domain pending. |
| `createTimeEntry` | not-implemented | Billing/timer/resolution constraints and compound atomic domains pending. |
| `listTimeEntries` | not-implemented | Billing/timer/resolution constraints and compound atomic domains pending. |
| `setTimeEntriesBillingStatus` | not-implemented | Billing/timer/resolution constraints and compound atomic domains pending. |
| `getActiveTimer` | not-implemented | Billing/timer/resolution constraints and compound atomic domains pending. |
| `putActiveTimer` | not-implemented | Billing/timer/resolution constraints and compound atomic domains pending. |
| `deleteActiveTimer` | not-implemented | Billing/timer/resolution constraints and compound atomic domains pending. |
| `getFeeArrangement` | not-implemented | Billing/timer/resolution constraints and compound atomic domains pending. |
| `putFeeArrangement` | not-implemented | Billing/timer/resolution constraints and compound atomic domains pending. |
| `getClientHourlyRate` | not-implemented | Billing/timer/resolution constraints and compound atomic domains pending. |
| `putClientHourlyRate` | not-implemented | Billing/timer/resolution constraints and compound atomic domains pending. |
| `getMatterResolution` | not-implemented | Billing/timer/resolution constraints and compound atomic domains pending. |
| `putMatterResolution` | not-implemented | Billing/timer/resolution constraints and compound atomic domains pending. |
| `insertDocument` | partial | Atomic bytes/record/chunks/FTS; legacy audit and full provenance/manifest pending. |
| `original` | supported-core | Exact bytes under exact scope; native SHA-256 check. |
| `search` | partial | Native FTS5, scope-stable insertion order; fixture literal terms. Legacy BM25 ranking parity pending. |
| `firstChunks` | supported-core | Scoped insertion-order chunks with bounded limit. |
| `close` | supported-core | Native connection close; fixture state close. Product lock/cancellation is pending. |

Read-only consumer inventory: `service.mjs`, `conversation.mjs`, `thread-memory.mjs`, `reply-drafts.mjs`, `matter-tasks.mjs`, `local-email.mjs`, `proactive-drafts.mjs`, and `time-billing.mjs`. The `bundled-model.mjs` textual `store` match concerns a model store, not the private DAO. No production direct `store.db` access was found; time-billing tests do inspect it. Callback transactions in service, drafts, tasks, mail, proactive jobs and time/billing must become versioned atomic domain operations (draft+version, proposal+decision+log/result, timer stop+entry+audit, import+audit, etc.). Replacing callbacks with several awaited RPC calls would lose atomicity. Workspace-level records/enumeration and all legacy kinds need explicit authority and provenance design; this prototype does not invent a wildcard to emulate them.

## Dependencies, licensing and official sources

The committed Cargo.lock pins the complete resolved graph, including packages for targets not built here. The table below reports package metadata licenses for the **actual aarch64-apple-darwin graph**, including build dependencies; it is inventory, not a legal opinion. The crate itself is unpublished and adds no new license grant. Before shipping, preserve applicable source/binary notices and complete the release notice bundle.

The upstream [rusqlite v0.41.1 manifest](https://github.com/rusqlite/rusqlite/blob/v0.41.1/Cargo.toml) was retrieved before inclusion: `bundled-sqlcipher` selects the maintained bundled codec build, MIT license. Registry source for `libsqlite3-sys 0.39.1/build.rs` was inspected: FTS5, TEMP_STORE=2, and Apple `SQLCIPHER_CRYPTO_CC`/Security/CoreFoundation branch. Source-package [repository/license metadata](https://github.com/LucaCappelletti94/sqlcipher-src) and its bundled `LICENSE-sqlcipher`/`LICENSE-libtomcrypt` were inspected. SQLCipher BSD-3-Clause, SQLite public-domain blessing, source wrapper MIT; the package metadata also lists WTFPL for libtomcrypt. The runtime uses Apple's CommonCrypto framework. Official [SQLCipher design](https://www.zetetic.net/sqlcipher/design/) documents page/journal protection and the need to disable file-backed temp stores; [SQLCipher Community](https://www.zetetic.net/sqlcipher/community/) gives distribution/licensing context. Neither a successful build nor Community licensing is FIPS validation. The docs.rs feature page and SQLCipher API page were unavailable through the web tool; upstream source and actual bindings/build/runtime were inspected instead.

| Package | Version | Declared license |
| --- | --- | --- |
| bitflags | 2.13.2 | MIT OR Apache-2.0 |
| block-buffer | 0.10.4 | MIT OR Apache-2.0 |
| cc | 1.11.1 | MIT OR Apache-2.0 |
| cfg-if | 1.0.5 | MIT OR Apache-2.0 |
| cpufeatures | 0.2.17 | MIT OR Apache-2.0 |
| crypto-common | 0.1.7 | MIT OR Apache-2.0 |
| digest | 0.10.7 | MIT OR Apache-2.0 |
| errno | 0.3.14 | MIT OR Apache-2.0 |
| fallible-iterator | 0.3.0 | MIT/Apache-2.0 |
| fallible-streaming-iterator | 0.1.9 | MIT/Apache-2.0 |
| fastrand | 2.5.0 | Apache-2.0 OR MIT |
| find-msvc-tools | 0.1.15 | MIT OR Apache-2.0 |
| foldhash | 0.2.0 | Zlib |
| generic-array | 0.14.7 | MIT |
| getrandom | 0.3.4 | MIT OR Apache-2.0 |
| hashbrown | 0.17.1 | MIT OR Apache-2.0 |
| hashlink | 0.12.2 | MIT OR Apache-2.0 |
| itoa | 1.0.19 | MIT OR Apache-2.0 |
| lex-vault | 0.1.0 | No additional grant; unpublished spike |
| libc | 0.2.191 | MIT OR Apache-2.0 |
| libsqlite3-sys | 0.39.1 | MIT |
| memchr | 2.8.3 | Unlicense OR MIT |
| once_cell | 1.21.4 | MIT OR Apache-2.0 |
| pkg-config | 0.3.34 | MIT OR Apache-2.0 |
| proc-macro2 | 1.0.107 | MIT OR Apache-2.0 |
| quote | 1.0.47 | MIT OR Apache-2.0 |
| rusqlite | 0.41.1 | MIT |
| rustix | 1.1.6 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| ryu | 1.0.23 | Apache-2.0 OR BSL-1.0 |
| serde | 1.0.228 | MIT OR Apache-2.0 |
| serde_core | 1.0.228 | MIT OR Apache-2.0 |
| serde_derive | 1.0.228 | MIT OR Apache-2.0 |
| serde_json | 1.0.145 | MIT OR Apache-2.0 |
| sha2 | 0.10.9 | MIT OR Apache-2.0 |
| shlex | 2.0.1 | MIT OR Apache-2.0 |
| smallvec | 1.16.5 | MIT OR Apache-2.0 |
| sqlcipher-src | 419.0.6+sqlcipher-4.19.0-sqlite-3.53.4-libtomcrypt-1.18.2 | MIT AND BSD-3-Clause AND blessing AND WTFPL |
| syn | 2.0.119 | MIT OR Apache-2.0 |
| tempfile | 3.23.0 | MIT OR Apache-2.0 |
| tinyvec | 1.13.3 | Zlib OR Apache-2.0 OR MIT |
| typenum | 1.20.1 | MIT OR Apache-2.0 |
| unicode-ident | 1.0.27 | (MIT OR Apache-2.0) AND Unicode-3.0 |
| unicode-normalization | 0.1.24 | MIT/Apache-2.0 |
| vcpkg | 0.2.15 | MIT/Apache-2.0 |
| version_check | 0.9.5 | MIT/Apache-2.0 |
| zeroize | 1.8.2 | Apache-2.0 OR MIT |
| zeroize_derive | 1.5.0 | Apache-2.0 OR MIT |


## H5b.1b.1 reminder domain (inactive)

`h5b1-reminders-v1` adds native `create_reminders`, `get_reminder`, `list_reminders`, `update_reminder` and read-only `list_reminder_audits`. The JS memory fixture exposes corresponding camelCase operations; its overall contract is now `h5b1-domain-fixture-v2`. This is a domain slice, not a native bridge or an activated product store. F0's same-origin local browser → Node broker → eventual supervised Rust vault remains the integration target; this crate adds no browser, broker or process transport.

Only exact workspace/matter scopes with `threadId:null` are accepted. Payload IDs/scopes are checked, `createdAt` is immutable on update, and missing updates reject. The native API takes a typed `Reminder`; its serde representation and the memory JSON entry point deny unknown fields and require every field explicitly, including nulls. No generic callback transaction or arbitrary audit insertion API exists. IDs and scope fields are bounded ASCII identifiers; titles are 1–800 UTF-8 bytes, notes 0–16,000, optional planner rules 1–256. NUL and malformed Unicode are rejected. Kind/status/source match the existing reminder enum sets. Dates are deliberately narrower than legacy: due dates are null, valid Gregorian `YYYY-MM-DD`, or canonical UTC `YYYY-MM-DDTHH:mm:ss.sssZ`; creation/update timestamps require the latter, years 0001–9999. Offset spellings are rejected; no time-zone normalization or legal deadline calculation occurs.

Create accepts 1–100 reminders and advances the matter revision once. Update replaces mutable reminder fields and advances once. Both execute reminder writes, internally derived audit entries and CAS in one native IMMEDIATE transaction; memory publishes one cloned state only after validation succeeds, without interleaved awaits. Expected revisions are nonnegative safe JS integers below MAX_SAFE_INTEGER. Audit includes only scope, revision, batch ordinal, derived operation and reminder ID; never title/note. Create derives `planner.propose` for planner source and `reminder.create` otherwise; update derives `reminder.update`. This is storage integrity, not authorization of user/planner actions or validation of legal content.

Lists use `dueAt IS NULL, dueAt, title, id` with SQLite BINARY / JS UTF-8 Buffer comparison, page limit 1–100 and offset 0–1,000,000. Offset pages are stable within a revision only; consumers must restart if revision changes. Audit pages sort by revision/ordinal. No workspace-wide, wildcard or thread fallback exists. Fresh synthetic schema is version 2; reopen rejects version 1 without migrating it. Existing user databases are never accepted by this harness.

Measured for this slice: **17 native tests passed** (3 internal, 7 reminder integration, 7 existing viability), serial `--test-threads=1`; **13 targeted Node tests passed** (7 reminder, 6 existing contract). Native tests cover audit-trigger failure rollback for create/update, duplicate-halfway rollback after reopen, exact colliding IDs across scopes, concurrent connections with one CAS winner, invalid/missing/oversize nonmutation, Unicode byte ordering/pages, close including empty reads, keyed persistence and title/note ciphertext canaries against an independent plaintext scanner control. Node exercises corresponding contract cases and compares ordering with real SQLite BINARY; it is not a SQLCipher adapter and does not claim native durability or injectable audit-failure equivalence. Both suites passed on their first run. No SIGKILL/power-loss or 8 GB hardware measurement was added.

The exact 32-entry matrix moves from **3 supported-core / 5 partial / 24 not-implemented** to **3 / 9 / 20**. All four reminder rows are partial; generic `audit` and `transaction` remain not-implemented. `VAULT_PARITY_COMPLETE=false`. Existing service consumers still use the legacy synchronous store; state aggregation, planner deduplication/idempotency, action authorization, IPC, key custody, migration and full product parity remain pending. No main/service/UI integration, real keys/stores, provider calls or downloads were performed for this domain slice.
