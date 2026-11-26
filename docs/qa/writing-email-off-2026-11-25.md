# Writing/email smoke with reasoning OFF, 2026-11-25

Base: `f0b751baec93422e9d904a475e421b209677dc5e` (PR26).

## Cause

The old smoke clicked the disabled Preguntar button and expected two synthetic generations. It injected an unbounded service even though startServer wraps its engine with the product reasoning boundary. That setup disagreed with the current product. A timeout there did not establish an app defect.

## Change

Only smoke, CI wiring and this note change. No product behavior, local model, cloud route or real Mail connection is enabled.

The smoke now persists one explicitly synthetic historical chat record, wraps the injected service in the existing reasoning boundary and uses Vite with the real source UI plus authenticated HTTP/SQLite APIs. A fake Mail transport is the sole send destination. Temporary database and Vite cache are removed on close.

Checks:
- Both state and engine status expose reasoning unavailable. Typed input survives Enter, Preguntar remains disabled, no analyze request occurs.
- Historical text can be edited, reopened and restored as immutable versions. Original is preserved, current text and citation-integrity flag are verified.
- An actual DOCX download has version 3 filename and the restored historical text, extracted with Mammoth.
- Preparing email sends nothing. Fake send requires checked approval, preserves body and recipient. A future approved proposal can be revoked without another send.
- An opt-in rule remains enabled, but two completed scheduler HTTP responses report zero generation and waitingForAssistant. No jobs or review-draft buttons appear.
- Zero model starts/generation/analyze requests; one approved fake send. No page errors or horizontal overflow at 1440 and 390.

## Author execution

Smoke PASS repeatedly, including after mutation restore. Four focused backend suites PASS 11/11: reasoning-role, local-email, reply-drafts, proactive-drafts. Build PASS. Removing the injected service boundary makes the smoke fail on missing reasoning.available before edit/send steps, then restoration passes.

Visual evidence: desktop full-page, 390px top and 390px rules viewport. Full-page images do not guarantee internal scroll containers are fully captured. No product layout changes made.

## Limits

Synthetic history and transport only. One chat history type, not every answer type. No real model, legal quality, real Mail delivery, scheduler wall-time wait, macOS Mail integration or production deployment measured. Fake transport acceptance is not recipient delivery. Separate reviewer results are not asserted here.
