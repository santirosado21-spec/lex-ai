# Fixed practice in the opt-in native preparation

Base: 44e7617cae97bfaaa785fe815ea187ac984e0f25.

This adds one fixed, preannotated, two-document synthetic practice. It proves workflow and persistence only. It does not test detection, anonymization quality, legal reasoning, real files, native foreground or distribution readiness. The original default entry remains unchanged and the preview feature remains off by default.

## Boundaries

- The new action accepts no fields and is enabled only by nativePilotPreparation.
- A protected empty workspace is required. An unrelated case is refused.
- Manifest hash is pinned. Retry requires the two expected sources and successful restoration of both exact texts, not only a receipt.
- Real store transaction encloses workspace, matter, source maps, practice receipt and audit. Early and late injected failures leave no partial workspace, matter or intake. Retry then completes once.
- Native preview has no arbitrary import or new generation/export route. The synthetic notice survives reopening.

## Measured locally

25 tests passed using:

    node --test tests/native-pilot-*.test.mjs tests/intake-version-comparison.test.mjs tests/intake-source-files.test.mjs

Frontend production build passed. Existing chunk-size warning remains.

HTTP/session/vault test uses real encrypted persistence and checks concurrent duplicate load, nonempty rejection, extra payload rejection, local restoration, lexical changes, absence of the synthetic folio in sealed file bytes, listener removal on lock, and exact restored original/result after reopening. An instrumented fetch blocks non-loopback/model endpoints and observed zero attempts during this test. This is bounded path evidence, not a system-wide network/privacy audit.

Chromium with mocked native IPC/API proves empty preview load, read, lexical comparison, immediate text removal on lock and notice/source recovery after reopen. Comparator is real but fixture texts are shorter than the backend practice. Desktop and 390px screenshots were inspected. No horizontal overflow; notices, controls and changes are legible. Screenshots disable animations to avoid capturing reveal fades.

Rust test fixture now exercises this fixed practice on its existing real Node-child/reopen/integrity path. Rust source changes only cfg(test) on a test-only outcome accessor and cleanup-on-panic guard. Cargo is unavailable here, so this updated Rust path must be run by the reviewer on Mac before publication. No native build, GUI, real secret dialog, model, heldout or cloud run occurred.

## Review

No push performed. Reviewer owns independent review, Mac checks and publication. After this milestone the next work should be substantive legal-work capability, not another synthetic demo.

Both native harness cases use unique temporary Vite optimizer caches and scan only their own fixture HTML, preserving the CI isolation fix. No claim is made about the exact competing process behind the previously observed optimizer invalidation.
