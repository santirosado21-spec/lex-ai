# Honorarios over authenticated HTTP

## Provenance

Adapted from the synthetic script created in the visible Orca worktree rejon-honorarios-http by Cursor Composer 2.5. The conductor reported executing the original on macOS against 8214790, before PR23. Original file SHA256: 5adaf3002c4cc37f254443be3e2b26de880b47fed1147bbca4b4f7f30a54c7e3.

The original imported absolute Mac paths, so it was not portable as delivered. This version uses repository-relative imports, node:test, bounded test time, failure cleanup and an inference provider that throws if initialization/generation is attempted. It runs in a temporary SQLite directory with a real loopback server and bearer authentication. Time is advanced through the service's injected clock, not wall-clock waiting and not SQLite edits. It starts the real server via startServer, not a separate CLI process.

## New retained checks

- 401 without a token and with the other server's token.
- Hourly arrangement, timer start/pause/resume/stop, listing, active timer removal, 31 duration minutes rounded to 30 billed minutes and 6,000 centavos.
- UTF-8 BOM and formula-prefix escaping in exported CSV.
- Empty results for another matter and another data directory; foreign matter access is rejected.
- Resolution closure and persistence across server/store reopening.
- PR23 over HTTP: four 29-second and four 31-second active fragments each close as two minutes and 400 centavos at a one-minute increment. These are additions to the Orca script, not claims about its original run.

On main dabbd56: `node --test tests/honorarios-http.test.mjs tests/http.test.mjs tests/time-billing.test.mjs` passes 14/14 tests (1 new HTTP lifecycle, 2 existing HTTP boundary tests, 11 time/billing tests). The new lifecycle plus time/billing alone is 12/12. Reverting only store.mjs/time-billing.mjs to 8214790 makes the new HTTP test fail with 0 instead of 2 minutes. Restoring the backend returns the focal tests to green. No product code changes in this cut. The portable CI gate includes the retained test.

No browser UI, real model, client data, external service validation or legal/tax validation. Separate data directories are separate server/store instances, not proof of multi-tenant access control in a shared database. No full suite or build repeated for this test-only change.
