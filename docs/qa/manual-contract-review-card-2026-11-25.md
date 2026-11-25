# Manual contract review card

Base: 45f54e6c145eefc4d582834f935655f8fbb791b4. Review before publication.

## Scope

A manual work tool in the existing encrypted intake, outside the task/generation editor. User selects an exact contractual span and optionally an exact legal span, writes an observation and next step, and declares role, jurisdiction, date, coverage and manual status. No automatic interpretation, risk score, signature approval, export, provider or new framework. Native preparation allowlist remains unchanged and denies all three new actions.

DocumentText is the existing reader. A saved card reopens exact quotes and can locate each range in the full local text. Repeated text requires an explicit occurrence. Each legal choice comes from the initial corpus, not the optional large public index. PDF and article hashes are checked locally; edition, pages, source URL and unverified currentness/applicability are visible. The available 21 articles are a narrow starting selection, not a complete legal basis for a contract. Selecting an article does not establish legal or logical support for a comment.

The encrypted record stores manual input, document hash/range/quote, source text hash/PDF hash/edition/range/quote and provenance. Missing source or context remains pending; manual text can be saved without a legal source. Human-declared excerpt cannot be promoted to full within the same card. A changed document hash or legal edition cannot be rebound silently: create a new card after review. List reads preserve historical citations and mark stale/unverifiable evidence. No original is edited.

## Verification

Tests cover real HTTP and encrypted persistence/reopen, duplicate concurrent save, strict fields and citations, foreign document ID, malformed range/hash/quote/date, stale revision, excerpt promotion refusal, changed document and changed law edition, unprotected store denial, audit-failure transaction rollback, no model or external fetch during the HTTP path and unchanged native allowlist. UI uses the real component and forwards API requests to the real local service. It selects both texts, saves/reopens and locates citations, preserves edit after injected HTTP failure, dismisses real reload/discard confirmation and checks narrow layout. Vite cache is temporary and unique per harness.

Screenshots desktop and 390px were inspected after styling: clear reader/quote/comment groups, visible edition warnings, saved source citation, retained edit/error, no horizontal overflow. This is Chromium, not the native app or real unlock dialog. No professional legal accuracy, model quality, confidentiality completeness or system-wide egress audit is claimed.

60 directed compatibility tests passed. Build passed with the prior chunk-size warning. No app/GUI/model/cloud execution. The first new HTTP test run failed because its inference stub lacked stop(), then timed out due its test listener; fixed the stub and reran. No user profile or external service affected. No native lock UX claim: these actions are intentionally unavailable in native preparation.

## Portable harness correction

Review caught the fixed /downloads screenshot fallback. It now uses a unique mkdtemp directory and removes it when no evidence environment variable is supplied. Every new harness is checked without REJON_UI_EVIDENCE_DIR before handoff. Additional UI assertions cover new-card selection reset, clearing old citations on document/law change, repeated-quote occurrence selection, disabled editing preserving text, canceled close preserving edits and confirmed close clearing texts. Disabled editing is not native session lock: this intake has no native lock lifecycle, and native preparation still denies the feature.
